# Phase 2 — AI Advisory-to-Algo + DhanLaxmi Prompt-to-Algo

## Services
- `ai-advisory-service` — login advisory (async), ranking 3–5 algos, convert-to-algo
- `dhanlaxmi-assistant-service` — multilingual prompt-to-strategy drafts, paper test, never executes
- `language-intent-service` — language + intent classification

## Shared libs
- `llm-providers` — ClaudeProvider via Bifrost (default), OpenRouterProvider + MockLLMProvider (fallbacks); JSON validation
- `recommendation-ranking` — ensures 3–5 ranked options
- `advisory-to-strategy` — recommendation → Phase 1 `StrategyConfig`
- `prompt-to-strategy` — NL prompt → strategy draft + `StrategyConfig`

## APIs
| Method | Path |
|--------|------|
| POST | `/advisory/generate` |
| GET | `/advisory/latest` |
| POST | `/advisory/{id}/recommendations/{recommendation_id}/convert-to-algo` |
| POST | `/dhanlaxmi/chat` |
| POST | `/dhanlaxmi/strategy-draft` |
| POST | `/dhanlaxmi/paper-test` |

## Hard rules
- Live trading disabled by default
- Direct buy → order preview + approval + risk warning (no execution)
- AI output JSON-validated; decisions audited
- Bifrost/Claude is the default provider; OpenRouter then MockLLMProvider are fallbacks
