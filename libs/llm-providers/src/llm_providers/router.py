"""LLM router — Bifrost/Claude is the default primary; OpenRouter then Mock as fallbacks."""



from __future__ import annotations



import os

import time

from typing import Any



from advisory_core.security import redact_secrets



from llm_providers.base import BaseLLMProvider

from llm_providers.claude import ClaudeProvider

from llm_providers.mock import MockLLMProvider

from llm_providers.openai_provider import OpenAIProvider

from llm_providers.openrouter import OpenRouterProvider





def _normalize_provider_name(raw: str | None, default: str = "claude") -> str:

    name = (raw or default).strip().lower()

    if name in {"bifrost", "anthropic"}:

        return "claude"

    return name





def _provider_map() -> dict[str, BaseLLMProvider]:

    return {

        "claude": ClaudeProvider(),

        "bifrost": ClaudeProvider(),

        "openrouter": OpenRouterProvider(),

        "mock": MockLLMProvider(),

        "openai": OpenAIProvider(),

    }





def get_default_provider() -> BaseLLMProvider:

    name = _normalize_provider_name(os.getenv("DEFAULT_LLM_PROVIDER"), "claude")

    providers = _provider_map()

    chosen = providers.get(name) or providers["claude"]

    if not chosen.available():

        if providers["openrouter"].available():

            return providers["openrouter"]

        return providers["mock"]

    return chosen





class LLMRouter:

    def __init__(self) -> None:

        self.providers = _provider_map()

        self.default = _normalize_provider_name(os.getenv("DEFAULT_LLM_PROVIDER"), "claude")

        self.fallback = _normalize_provider_name(os.getenv("FALLBACK_LLM_PROVIDER"), "openrouter")



    async def generate_response(

        self, prompt: str, context: dict[str, Any]

    ) -> tuple[str, dict[str, Any]]:

        safe_ctx = redact_secrets(context)

        start = time.perf_counter()

        order = [self.default, self.fallback, "claude", "openrouter", "mock"]

        seen: set[str] = set()

        for name in order:

            name = _normalize_provider_name(name, name)

            if name in seen:

                continue

            seen.add(name)

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

        order = [self.default, self.fallback, "claude", "openrouter", "mock"]

        seen: set[str] = set()

        last_err: Exception | None = None

        for name in order:

            name = _normalize_provider_name(name, name)

            if name in seen:

                continue

            seen.add(name)

            provider = self.providers.get(name)

            if not provider or not provider.available():

                continue

            try:

                data = await provider.generate_advisory_json(prompt, safe_ctx)

                return data, {

                    "provider": provider.name,

                    "latency_ms": (time.perf_counter() - start) * 1000,

                    "json_validated": True,

                }

            except NotImplementedError as exc:

                last_err = exc

                continue

            except Exception as exc:

                last_err = exc

                continue

        data = await self.providers["mock"].generate_advisory_json(prompt, safe_ctx)

        return data, {

            "provider": "mock",

            "latency_ms": (time.perf_counter() - start) * 1000,

            "json_validated": True,

            "fallback_reason": str(last_err)[:200] if last_err else None,

        }


