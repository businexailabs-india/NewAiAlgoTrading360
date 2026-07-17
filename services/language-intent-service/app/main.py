"""Language + intent microservice."""

from __future__ import annotations

import os

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel

from advisory_core.security import ServiceAuth
from intent_core import IntentClassifier
from language_core import LanguageDetector
from trade_command_parser import TradingCommandParser

app = FastAPI(title="Language Intent Service", version="0.1.0")
auth = ServiceAuth(os.getenv("SERVICE_HMAC_SECRET", "dev-service-hmac-secret-change-me"))
detector = LanguageDetector()
classifier = IntentClassifier()
parser = TradingCommandParser()


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


class AnalyzeBody(BaseModel):
    message: str
    language_hint: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "language-intent-service"}


@app.post("/language/detect")
async def detect(body: AnalyzeBody, identity=Depends(require_service)):
    return {"success": True, "data": detector.detect(body.message, body.language_hint).model_dump()}


@app.post("/intent/classify")
async def classify(body: AnalyzeBody, identity=Depends(require_service)):
    return {"success": True, "data": classifier.classify(body.message).model_dump()}


@app.post("/command/parse")
async def parse_command(body: AnalyzeBody, identity=Depends(require_service)):
    lang = detector.detect(body.message, body.language_hint)
    intent = classifier.classify(body.message)
    parsed = parser.parse(body.message, lang.language.value)
    return {
        "success": True,
        "data": {
            "language": lang.model_dump(),
            "intent": intent.model_dump(),
            "parsed": parsed.model_dump(),
            "user_id": str(identity.user_id),
        },
    }
