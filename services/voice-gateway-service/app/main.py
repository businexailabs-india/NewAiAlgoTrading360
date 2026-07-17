"""Voice gateway — STT/TTS + command relay to DhanLaxmi."""

from __future__ import annotations

import base64
import os
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from advisory_core.security import ServiceAuth
from voice_core import SpeechToTextRouter, TextToSpeechRouter

from app.telemetry import stt_latency, tts_latency, voice_commands_total, timed

app = FastAPI(title="DhanLaxmi Voice Gateway", version="0.1.0")
auth = ServiceAuth(os.getenv("SERVICE_HMAC_SECRET", "dev-service-hmac-secret-change-me"))
stt = SpeechToTextRouter()
tts = TextToSpeechRouter()
ASSISTANT_URL = os.getenv("DHANLAXMI_SERVICE_URL", "http://localhost:8095")


def require_service(
    x_tenant_id: str = Header(alias="X-Tenant-Id"),
    x_user_id: str = Header(alias="X-User-Id"),
    x_user_role: str = Header(default="user", alias="X-User-Role"),
    x_request_id: str = Header(alias="X-Request-Id"),
    x_service_timestamp: str = Header(alias="X-Service-Timestamp"),
    x_service_signature: str = Header(alias="X-Service-Signature"),
):
    try:
        return auth.verify(
            {
                "X-Tenant-Id": x_tenant_id,
                "X-User-Id": x_user_id,
                "X-User-Role": x_user_role,
                "X-Request-Id": x_request_id,
                "X-Service-Timestamp": x_service_timestamp,
                "X-Service-Signature": x_service_signature,
            }
        )
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


class TranscribeBody(BaseModel):
    audio_b64: str
    language_hint: str | None = None


class RespondBody(BaseModel):
    text: str
    language_code: str = "en"
    voice_preference: str | None = None


class VoiceCommandBody(BaseModel):
    audio_b64: str | None = None
    text: str | None = None
    language_hint: str | None = None
    conversation_id: str | None = None
    context: dict[str, Any] = Field(default_factory=dict)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "voice-gateway-service"}


@app.post("/voice/transcribe")
async def transcribe(body: TranscribeBody, identity=Depends(require_service)):
    audio = base64.b64decode(body.audio_b64)
    with timed(stt_latency):
        result = await stt.transcribe(audio, body.language_hint)
    return {"success": True, "data": result.model_dump(), "user_id": str(identity.user_id)}


@app.post("/voice/respond")
async def respond(body: RespondBody, identity=Depends(require_service)):
    with timed(tts_latency):
        result = await tts.synthesize(body.text, body.language_code, body.voice_preference)
    return {"success": True, "data": result.model_dump()}


@app.post("/voice/command")
async def voice_command(body: VoiceCommandBody, identity=Depends(require_service)):
    import httpx

    voice_commands_total.inc()
    text = body.text
    transcription = None
    if body.audio_b64:
        audio = base64.b64decode(body.audio_b64)
        with timed(stt_latency):
            transcription = await stt.transcribe(audio, body.language_hint)
        text = transcription.text
    if not text:
        raise HTTPException(status_code=400, detail="text or audio_b64 required")

    headers = auth.sign(
        identity.tenant_id, identity.user_id, identity.role, identity.request_id
    )
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{ASSISTANT_URL}/dhanlaxmi/chat",
            headers=headers,
            json={
                "message": text,
                "conversation_id": body.conversation_id,
                "language_hint": body.language_hint,
                "mode": "voice",
                "context": body.context,
                "voice": True,
            },
        )
    if res.status_code >= 400:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    data = res.json().get("data") or res.json()
    lang = data.get("language") or "en"
    with timed(tts_latency):
        audio_out = await tts.synthesize(data.get("response_text") or "", lang)
    return {
        "success": True,
        "data": {
            **data,
            "transcription": transcription.model_dump() if transcription else None,
            "audio_response": audio_out.model_dump(),
        },
    }


@app.websocket("/voice/live-session")
async def live_session(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            payload = await ws.receive_json()
            text = payload.get("text") or ""
            if payload.get("audio_b64"):
                audio = base64.b64decode(payload["audio_b64"])
                tr = await stt.transcribe(audio, payload.get("language_hint"))
                text = tr.text
                await ws.send_json({"type": "transcription", "text": text})
            await ws.send_json(
                {
                    "type": "ack",
                    "message": "Live session received text; use /voice/command for full assistant flow.",
                    "text": text,
                }
            )
    except WebSocketDisconnect:
        return
