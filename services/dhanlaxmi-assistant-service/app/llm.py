"""Pluggable LLM providers for DhanLaxmi (structured, redacted)."""

from __future__ import annotations

import json
import os
import time
from abc import ABC, abstractmethod
from typing import Any

from advisory_core.security import redact_secrets


class BaseLLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def generate_response(self, prompt: str, context: dict[str, Any]) -> str: ...

    async def classify_intent(self, text: str) -> dict[str, Any]:
        return {"intent": "unknown_intent", "confidence": 0.5}

    async def generate_strategy_draft(self, text: str, context: dict[str, Any]) -> dict[str, Any]:
        return {}

    async def explain_risk(self, payload: dict[str, Any]) -> str:
        return "Trading involves risk; profit is not guaranteed."

    async def translate_response(self, text: str, target_language: str) -> str:
        return text

    def validate_json_output(self, raw: str) -> dict[str, Any]:
        try:
            data = json.loads(raw)
            if not isinstance(data, dict):
                raise ValueError("JSON root must be object")
            return data
        except Exception as exc:
            raise ValueError(f"Invalid JSON output: {exc}") from exc

    def available(self) -> bool:
        return True


class MockLLMProvider(BaseLLMProvider):
    name = "mock"

    async def generate_response(self, prompt: str, context: dict[str, Any]) -> str:
        lang = context.get("language") or "en"
        return f"[mock:{lang}] Acknowledged. Paper-first. Risk warning applies."

    async def classify_intent(self, text: str) -> dict[str, Any]:
        return {"intent": "market_query", "confidence": 0.6}

    async def generate_strategy_draft(self, text: str, context: dict[str, Any]) -> dict[str, Any]:
        return {
            "strategy_type": "vwap_breakout",
            "timeframe": "5m",
            "paper_only": True,
        }


class LocalLLMProvider(MockLLMProvider):
    name = "local"


class _EnvLLM(BaseLLMProvider):
    def __init__(self, name: str, env_key: str):
        self.name = name
        self.env_key = env_key

    def available(self) -> bool:
        return bool(os.getenv(self.env_key))

    async def generate_response(self, prompt: str, context: dict[str, Any]) -> str:
        if not self.available():
            raise RuntimeError(f"{self.name} not configured")
        # Production: call vendor SDK. Fallback path uses mock-quality safe text.
        raise NotImplementedError(f"{self.name} remote call pending")


class ClaudeProvider(_EnvLLM):
    def __init__(self):
        super().__init__("claude", "ANTHROPIC_API_KEY")


class OpenAIProvider(_EnvLLM):
    def __init__(self):
        super().__init__("openai", "OPENAI_API_KEY")


class GeminiProvider(_EnvLLM):
    def __init__(self):
        super().__init__("gemini", "GEMINI_API_KEY")


class OpenRouterProvider(_EnvLLM):
    def __init__(self):
        super().__init__("openrouter", "OPENROUTER_API_KEY")


class LLMRouter:
    def __init__(self) -> None:
        self.providers: dict[str, BaseLLMProvider] = {
            "mock": MockLLMProvider(),
            "local": LocalLLMProvider(),
            "claude": ClaudeProvider(),
            "openai": OpenAIProvider(),
            "gemini": GeminiProvider(),
            "openrouter": OpenRouterProvider(),
        }
        self.default = os.getenv("DEFAULT_LLM_PROVIDER", "mock")
        self.fallback = os.getenv("FALLBACK_LLM_PROVIDER", "local")

    async def generate_response(self, prompt: str, context: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        safe_ctx = redact_secrets(context)
        start = time.perf_counter()
        for name in (self.default, self.fallback, "mock"):
            provider = self.providers.get(name)
            if not provider or not provider.available():
                continue
            try:
                text = await provider.generate_response(prompt, safe_ctx)
                return text, {
                    "provider": provider.name,
                    "latency_ms": (time.perf_counter() - start) * 1000,
                }
            except NotImplementedError:
                continue
            except Exception:
                continue
        text = await self.providers["mock"].generate_response(prompt, safe_ctx)
        return text, {"provider": "mock", "latency_ms": (time.perf_counter() - start) * 1000}
