"""DhanLaxmi LLM facade — OpenRouter is the default primary; Mock is the fallback.

ClaudeProvider and OpenAIProvider interfaces remain available via llm_providers.
"""

from __future__ import annotations

from llm_providers import (
    BaseLLMProvider,
    ClaudeProvider,
    LLMRouter,
    MockLLMProvider,
    OpenAIProvider,
    OpenRouterProvider,
    get_default_provider,
    validate_ai_json,
)

# Backward-compatible local alias (mock)
LocalLLMProvider = MockLLMProvider

__all__ = [
    "BaseLLMProvider",
    "ClaudeProvider",
    "LLMRouter",
    "LocalLLMProvider",
    "MockLLMProvider",
    "OpenAIProvider",
    "OpenRouterProvider",
    "get_default_provider",
    "validate_ai_json",
]
