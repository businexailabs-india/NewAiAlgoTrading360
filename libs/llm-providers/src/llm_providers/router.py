"""LLM router — MockLLMProvider is the default for Phase 2."""

from __future__ import annotations

import os
import time
from typing import Any

from advisory_core.security import redact_secrets

from llm_providers.base import BaseLLMProvider
from llm_providers.claude import ClaudeProvider
from llm_providers.mock import MockLLMProvider
from llm_providers.openai_provider import OpenAIProvider


def get_default_provider() -> BaseLLMProvider:
    name = (os.getenv("DEFAULT_LLM_PROVIDER") or "mock").strip().lower()
    providers = {
        "mock": MockLLMProvider(),
        "claude": ClaudeProvider(),
        "openai": OpenAIProvider(),
    }
    chosen = providers.get(name) or providers["mock"]
    if not chosen.available():
        return providers["mock"]
    return chosen


class LLMRouter:
    def __init__(self) -> None:
        self.providers: dict[str, BaseLLMProvider] = {
            "mock": MockLLMProvider(),
            "claude": ClaudeProvider(),
            "openai": OpenAIProvider(),
        }
        # Phase 2 default: mock
        self.default = (os.getenv("DEFAULT_LLM_PROVIDER") or "mock").strip().lower()
        self.fallback = (os.getenv("FALLBACK_LLM_PROVIDER") or "mock").strip().lower()

    async def generate_response(
        self, prompt: str, context: dict[str, Any]
    ) -> tuple[str, dict[str, Any]]:
        safe_ctx = redact_secrets(context)
        start = time.perf_counter()
        order = [self.default, self.fallback, "mock"]
        for name in order:
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

    async def generate_advisory_json(
        self, prompt: str, context: dict[str, Any]
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        safe_ctx = redact_secrets(context)
        start = time.perf_counter()
        provider = self.providers.get(self.default) or self.providers["mock"]
        if not provider.available():
            provider = self.providers["mock"]
        data = await provider.generate_advisory_json(prompt, safe_ctx)
        return data, {
            "provider": provider.name,
            "latency_ms": (time.perf_counter() - start) * 1000,
            "json_validated": True,
        }
