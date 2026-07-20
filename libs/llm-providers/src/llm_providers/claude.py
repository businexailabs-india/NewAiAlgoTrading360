"""ClaudeProvider interface — optional remote; Mock remains default."""

from __future__ import annotations

import os
from typing import Any

import httpx

from llm_providers.base import BaseLLMProvider


def _truthy(val: str | None) -> bool:
    return (val or "").strip().lower() in {"1", "true", "on", "yes"}


def _falsy(val: str | None) -> bool:
    return (val or "").strip().lower() in {"0", "false", "off", "no"}


def bifrost_enabled() -> bool:
    """Bifrost is enabled by default; set BIFROST_ENABLED=false to disable."""
    flag = os.getenv("BIFROST_ENABLED")
    if flag is None or not str(flag).strip():
        return True
    if _falsy(flag):
        return False
    if _truthy(flag):
        return True
    return bool((os.getenv("BIFROST_BASE_URL") or "").strip())


class ClaudeProvider(BaseLLMProvider):
    """Anthropic Claude interface. Not used unless explicitly selected and keyed."""

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
            "You are a cautious Indian markets assistant. "
            "Paper-first; never promise profits. Respond as JSON when asked. "
            f"Language code: {lang}."
        )
        if bifrost_enabled():
            base = (os.getenv("BIFROST_BASE_URL") or "http://localhost:8080").rstrip("/")
            url = f"{base}/anthropic/v1/messages"
            api_key = os.getenv("BIFROST_API_KEY") or "dummy-key"
        else:
            url = (os.getenv("ANTHROPIC_API_URL") or "https://api.anthropic.com/v1/messages").rstrip(
                "/"
            )
            api_key = os.getenv("ANTHROPIC_API_KEY") or ""

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
            raise RuntimeError(f"Claude API error ({res.status_code})")
        data = res.json()
        parts = data.get("content") or []
        text = "\n".join(
            (p.get("text") or "") for p in parts if isinstance(p, dict) and p.get("type") == "text"
        ).strip()
        if not text:
            raise RuntimeError("Claude returned empty content")
        return text
