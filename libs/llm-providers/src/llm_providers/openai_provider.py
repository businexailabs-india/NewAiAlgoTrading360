"""OpenAIProvider interface — stub until configured; Mock remains default."""

from __future__ import annotations

import os
from typing import Any

from llm_providers.base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    """OpenAI-compatible interface. Raises until OPENAI_API_KEY is set and wired."""

    name = "openai"

    def available(self) -> bool:
        return bool(os.getenv("OPENAI_API_KEY"))

    async def generate_response(self, prompt: str, context: dict[str, Any]) -> str:
        if not self.available():
            raise RuntimeError("openai not configured")
        raise NotImplementedError(
            "OpenAIProvider remote call is intentionally not enabled; use MockLLMProvider"
        )
