"""DhanLaxmi LLM facade — MockLLMProvider is the Phase 2 default.

ClaudeProvider and OpenAIProvider interfaces are available via llm_providers.
"""

from __future__ import annotations

from llm_providers import (
    BaseLLMProvider,
    ClaudeProvider,
    LLMRouter,
    MockLLMProvider,
    OpenAIProvider,
    get_default_provider,
    validate_ai_json,
)

# Backward-compatible local alias
LocalLLMProvider = MockLLMProvider

__all__ = [
    "BaseLLMProvider",
    "ClaudeProvider",
    "LLMRouter",
    "LocalLLMProvider",
    "MockLLMProvider",
    "OpenAIProvider",
    "get_default_provider",
    "validate_ai_json",
]
