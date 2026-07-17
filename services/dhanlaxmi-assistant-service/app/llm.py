"""Pluggable LLM providers for DhanLaxmi (structured, redacted).

When Bifrost is enabled, Claude traffic goes through the Anthropic drop-in:
  {BIFROST_BASE_URL}/anthropic/v1/messages
"""

from __future__ import annotations

import json
import os
import time
from abc import ABC, abstractmethod
from typing import Any

import httpx
from advisory_core.security import redact_secrets


def _truthy(val: str | None) -> bool:
    return (val or "").strip().lower() in {"1", "true", "on", "yes"}


def _falsy(val: str | None) -> bool:
    return (val or "").strip().lower() in {"0", "false", "off", "no"}


def bifrost_enabled() -> bool:
    flag = os.getenv("BIFROST_ENABLED")
    if _falsy(flag):
        return False
    if _truthy(flag):
        return True
    return bool((os.getenv("BIFROST_BASE_URL") or "").strip())


def force_anthropic() -> bool:
    flag = os.getenv("LLM_FORCE_ANTHROPIC") or os.getenv("BIFROST_FORCE_ANTHROPIC") or "true"
    return not _falsy(flag)


def anthropic_messages_url() -> str:
    override = (os.getenv("BIFROST_ANTHROPIC_URL") or "").strip()
    if override:
        return override.rstrip("/")
    if bifrost_enabled():
        base = (os.getenv("BIFROST_BASE_URL") or "http://localhost:8080").rstrip("/")
        return f"{base}/anthropic/v1/messages"
    return (os.getenv("ANTHROPIC_API_URL") or "https://api.anthropic.com/v1/messages").rstrip("/")


def anthropic_api_key() -> str:
    if _truthy(os.getenv("BIFROST_PASS_ANTHROPIC_KEY")):
        return os.getenv("ANTHROPIC_API_KEY") or "dummy-key"
    if bifrost_enabled():
        return os.getenv("BIFROST_API_KEY") or "dummy-key"
    return os.getenv("ANTHROPIC_API_KEY") or ""


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
        raise NotImplementedError(f"{self.name} remote call pending")


class ClaudeProvider(BaseLLMProvider):
    name = "claude"

    def available(self) -> bool:
        if bifrost_enabled():
            return True
        return bool(os.getenv("ANTHROPIC_API_KEY"))

    async def generate_response(self, prompt: str, context: dict[str, Any]) -> str:
        if not self.available():
            raise RuntimeError("claude not configured")

        model = os.getenv("ANTHROPIC_MODEL") or "claude-sonnet-5"
        lang = context.get("language") or "en"
        system = (
            "You are DhanLaxmi, a cautious Indian markets assistant. "
            "Paper-first; never promise profits. Keep answers concise. "
            f"Respond in language code: {lang}."
        )
        url = anthropic_messages_url()
        api_key = anthropic_api_key()
        timeout = float(os.getenv("LLM_TIMEOUT_SECONDS") or "30")

        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": model,
                    "max_tokens": 1024,
                    "temperature": 0.3,
                    "system": system,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
        if res.status_code >= 400:
            detail = ""
            try:
                detail = res.json().get("error", {}).get("message") or ""
            except Exception:
                detail = res.text[:200]
            via = "bifrost" if bifrost_enabled() else "direct"
            raise RuntimeError(f"Claude API error ({res.status_code}/{via}): {detail}")

        data = res.json()
        parts = data.get("content") or []
        text = "\n".join(
            (p.get("text") or "") for p in parts if isinstance(p, dict) and p.get("type") == "text"
        ).strip()
        if not text:
            raise RuntimeError("Claude returned empty content")
        return text


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
        if force_anthropic():
            self.default = "claude"
        else:
            self.default = os.getenv("DEFAULT_LLM_PROVIDER", "claude")
        self.fallback = os.getenv("FALLBACK_LLM_PROVIDER", "local")

    async def generate_response(self, prompt: str, context: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        safe_ctx = redact_secrets(context)
        start = time.perf_counter()
        order = [self.default, self.fallback, "mock"]
        if force_anthropic() and "claude" not in order[:1]:
            order = ["claude", *order]
        for name in order:
            provider = self.providers.get(name)
            if not provider or not provider.available():
                continue
            try:
                text = await provider.generate_response(prompt, safe_ctx)
                return text, {
                    "provider": provider.name,
                    "latency_ms": (time.perf_counter() - start) * 1000,
                    "via": "bifrost" if (provider.name == "claude" and bifrost_enabled()) else "direct",
                }
            except NotImplementedError:
                continue
            except Exception:
                continue
        text = await self.providers["mock"].generate_response(prompt, safe_ctx)
        return text, {"provider": "mock", "latency_ms": (time.perf_counter() - start) * 1000}
