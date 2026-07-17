"""STT/TTS provider abstractions for DhanLaxmi voice."""

from __future__ import annotations

import base64
import os
import time
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class TranscriptionResult(BaseModel):
    text: str
    language_hint: str | None = None
    confidence: float = 0.0
    provider: str
    latency_ms: float = 0.0
    raw: dict[str, Any] = Field(default_factory=dict)


class SynthesisResult(BaseModel):
    audio_b64: str
    mime_type: str = "audio/wav"
    language_code: str
    provider: str
    latency_ms: float = 0.0
    voice: str | None = None


class BaseSpeechToTextProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def transcribe(self, audio: bytes, language_hint: str | None = None) -> TranscriptionResult: ...

    def available(self) -> bool:
        return True


class BaseTextToSpeechProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def synthesize(
        self, text: str, language_code: str, voice_preference: str | None = None
    ) -> SynthesisResult: ...

    def available(self) -> bool:
        return True


class MockSTTProvider(BaseSpeechToTextProvider):
    name = "mock_stt"

    def __init__(self, canned_text: str | None = None):
        self.canned_text = canned_text

    async def transcribe(self, audio: bytes, language_hint: str | None = None) -> TranscriptionResult:
        start = time.perf_counter()
        # Decode optional UTF-8 payload used in tests
        try:
            text = audio.decode("utf-8") if audio and not self.canned_text else (self.canned_text or "")
        except UnicodeDecodeError:
            text = self.canned_text or "market summary please"
        return TranscriptionResult(
            text=text or "market summary please",
            language_hint=language_hint,
            confidence=0.91,
            provider=self.name,
            latency_ms=(time.perf_counter() - start) * 1000,
        )


class MockTTSProvider(BaseTextToSpeechProvider):
    name = "mock_tts"

    async def synthesize(
        self, text: str, language_code: str, voice_preference: str | None = None
    ) -> SynthesisResult:
        start = time.perf_counter()
        payload = base64.b64encode(f"[TTS:{language_code}]{text}".encode("utf-8")).decode("ascii")
        return SynthesisResult(
            audio_b64=payload,
            language_code=language_code,
            provider=self.name,
            latency_ms=(time.perf_counter() - start) * 1000,
            voice=voice_preference or "default",
        )


class _PlaceholderSTT(BaseSpeechToTextProvider):
    def __init__(self, name: str, env_key: str):
        self.name = name
        self.env_key = env_key

    def available(self) -> bool:
        return bool(os.getenv(self.env_key))

    async def transcribe(self, audio: bytes, language_hint: str | None = None) -> TranscriptionResult:
        if not self.available():
            raise RuntimeError(f"{self.name} not configured ({self.env_key})")
        # Placeholder: fall back behavior documented — wire real SDK in production
        raise NotImplementedError(f"{self.name} SDK integration pending — use mock/local for now")


class OpenAIWhisperSTTProvider(_PlaceholderSTT):
    def __init__(self):
        super().__init__("openai_whisper", "OPENAI_API_KEY")


class AzureSpeechSTTProvider(_PlaceholderSTT):
    def __init__(self):
        super().__init__("azure_speech", "AZURE_SPEECH_KEY")


class GoogleSpeechSTTProvider(_PlaceholderSTT):
    def __init__(self):
        super().__init__("google_speech", "GOOGLE_SPEECH_KEY")


class AWSTranscribeSTTProvider(_PlaceholderSTT):
    def __init__(self):
        super().__init__("aws_transcribe", "AWS_TRANSCRIBE_CONFIG")


class LocalWhisperSTTProvider(BaseSpeechToTextProvider):
    name = "local_whisper"

    async def transcribe(self, audio: bytes, language_hint: str | None = None) -> TranscriptionResult:
        # Local path uses mock-quality transcription until whisper.cpp is bundled
        mock = MockSTTProvider()
        result = await mock.transcribe(audio, language_hint)
        result.provider = self.name
        return result


class _PlaceholderTTS(BaseTextToSpeechProvider):
    def __init__(self, name: str, env_key: str):
        self.name = name
        self.env_key = env_key

    def available(self) -> bool:
        return bool(os.getenv(self.env_key))

    async def synthesize(
        self, text: str, language_code: str, voice_preference: str | None = None
    ) -> SynthesisResult:
        if not self.available():
            raise RuntimeError(f"{self.name} not configured ({self.env_key})")
        raise NotImplementedError(f"{self.name} SDK integration pending — use mock for now")


class AzureTTSProvider(_PlaceholderTTS):
    def __init__(self):
        super().__init__("azure_tts", "AZURE_SPEECH_KEY")


class GoogleTTSProvider(_PlaceholderTTS):
    def __init__(self):
        super().__init__("google_tts", "GOOGLE_SPEECH_KEY")


class AWSPollyTTSProvider(_PlaceholderTTS):
    def __init__(self):
        super().__init__("aws_polly", "AWS_TRANSCRIBE_CONFIG")


class OpenAITTSProvider(_PlaceholderTTS):
    def __init__(self):
        super().__init__("openai_tts", "OPENAI_API_KEY")


class SpeechToTextRouter:
    def __init__(self, default: str | None = None):
        self.providers: dict[str, BaseSpeechToTextProvider] = {
            "mock": MockSTTProvider(),
            "local_whisper": LocalWhisperSTTProvider(),
            "openai_whisper": OpenAIWhisperSTTProvider(),
            "azure": AzureSpeechSTTProvider(),
            "google": GoogleSpeechSTTProvider(),
            "aws": AWSTranscribeSTTProvider(),
        }
        self.default = default or os.getenv("DEFAULT_STT_PROVIDER", "mock")

    async def transcribe(self, audio: bytes, language_hint: str | None = None) -> TranscriptionResult:
        primary = self.providers.get(self.default) or self.providers["mock"]
        try:
            if primary.available():
                return await primary.transcribe(audio, language_hint)
        except NotImplementedError:
            pass
        return await self.providers["mock"].transcribe(audio, language_hint)


class TextToSpeechRouter:
    def __init__(self, default: str | None = None):
        self.providers: dict[str, BaseTextToSpeechProvider] = {
            "mock": MockTTSProvider(),
            "azure": AzureTTSProvider(),
            "google": GoogleTTSProvider(),
            "aws": AWSPollyTTSProvider(),
            "openai": OpenAITTSProvider(),
        }
        self.default = default or os.getenv("DEFAULT_TTS_PROVIDER", "mock")

    async def synthesize(
        self, text: str, language_code: str, voice_preference: str | None = None
    ) -> SynthesisResult:
        primary = self.providers.get(self.default) or self.providers["mock"]
        try:
            if primary.available():
                return await primary.synthesize(text, language_code, voice_preference)
        except NotImplementedError:
            pass
        return await self.providers["mock"].synthesize(text, language_code, voice_preference)
