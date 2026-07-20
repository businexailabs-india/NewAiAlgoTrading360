"""OpenRouterProvider — OpenAI-compatible chat completions via OpenRouter."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from llm_providers.base import AdvisoryLLMOutput, BaseLLMProvider, LLMJsonValidationError


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "openai/gpt-4o-mini"


class OpenRouterProvider(BaseLLMProvider):
    name = "openrouter"

    def available(self) -> bool:
        return bool(os.getenv("OPENROUTER_API_KEY", "").strip())

    def _model(self) -> str:
        return (os.getenv("OPENROUTER_MODEL") or DEFAULT_MODEL).strip()

    def _timeout(self) -> float:
        try:
            return float(os.getenv("LLM_TIMEOUT_SECONDS") or "30")
        except ValueError:
            return 30.0

    def _headers(self) -> dict[str, str]:
        referer = (
            os.getenv("FRONTEND_URL")
            or os.getenv("OPENROUTER_HTTP_REFERER")
            or "http://localhost:3000"
        )
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY', '').strip()}",
            "HTTP-Referer": referer,
            "X-Title": os.getenv("OPENROUTER_APP_TITLE") or "BusineXAi TradeOS360",
        }

    async def _chat(
        self,
        messages: list[dict[str, str]],
        *,
        json_mode: bool = False,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> str:
        if not self.available():
            raise RuntimeError("OPENROUTER_API_KEY not configured")

        body: dict[str, Any] = {
            "model": self._model(),
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}

        retries = max(0, int(os.getenv("LLM_MAX_RETRIES") or "2"))
        last_err: Exception | None = None
        for attempt in range(retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self._timeout()) as client:
                    res = await client.post(OPENROUTER_URL, headers=self._headers(), json=body)
                if res.status_code in (408, 429) or res.status_code >= 500:
                    last_err = RuntimeError(f"OpenRouter API error: {res.status_code}")
                    continue
                if res.status_code >= 400:
                    raise RuntimeError(f"OpenRouter API error: {res.status_code} {res.text[:200]}")
                data = res.json()
                text = (
                    ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
                )
                if not text.strip():
                    raise RuntimeError("OpenRouter returned empty content")
                return text
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_err = exc
                continue
        raise RuntimeError(f"OpenRouter request failed: {last_err}")

    async def generate_response(self, prompt: str, context: dict[str, Any]) -> str:
        system = (
            "You are DhanLaxmi / BusineXAi TradeOS360 assistant. "
            "Never place live trades. Paper trading is default. "
            "Never promise profit. Always mention risk. "
            "Do not ask for or echo broker API secrets or PII."
        )
        user_payload = {"prompt": prompt, "context": context}
        return await self._chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(user_payload, default=str)},
            ],
            json_mode=False,
        )

    async def generate_advisory_json(self, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        system = (
            "You are a trading advisory engine. Reply with ONLY valid JSON matching: "
            '{"summary": string, "recommendations": [1-5 objects], "warnings": string[], '
            '"paper_only": true, "live_trading_enabled": false}. '
            "Never recommend live trading. Profit is not guaranteed."
        )
        user_payload = {"prompt": prompt, "context": context}
        raw = await self._chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(user_payload, default=str)},
            ],
            json_mode=True,
        )
        # Strip markdown fences if the model ignores json_mode
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            return self.validate_json_output(cleaned, AdvisoryLLMOutput)
        except LLMJsonValidationError:
            # Soft-fail: wrap free text into a minimal valid advisory shape
            return {
                "summary": cleaned[:800] or "Advisory unavailable",
                "recommendations": [
                    {
                        "title": "Review paper-only options",
                        "summary": "LLM output was not schema-valid; use deterministic engine options.",
                        "paper_test_required": True,
                    }
                ],
                "warnings": ["LLM JSON validation failed; treat as paper-only."],
                "paper_only": True,
                "live_trading_enabled": False,
            }
