"""Unit tests for OpenRouterProvider + LLMRouter (no live API)."""



from __future__ import annotations



import json

from unittest.mock import AsyncMock, MagicMock, patch



import pytest



from llm_providers.claude import ClaudeProvider

from llm_providers.openrouter import OpenRouterProvider

from llm_providers.router import LLMRouter, get_default_provider





@pytest.fixture(autouse=True)

def _clean_llm_env(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    monkeypatch.delenv("OPENROUTER_MODEL", raising=False)

    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    monkeypatch.setenv("BIFROST_ENABLED", "false")

    monkeypatch.setenv("DEFAULT_LLM_PROVIDER", "openrouter")

    monkeypatch.setenv("FALLBACK_LLM_PROVIDER", "mock")

    yield





def test_openrouter_unavailable_without_key():

    assert OpenRouterProvider().available() is False





def test_openrouter_available_with_key(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")

    assert OpenRouterProvider().available() is True





def test_get_default_falls_back_to_mock_without_key():

    provider = get_default_provider()

    assert provider.name == "mock"





def test_get_default_openrouter_when_key_set(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")

    provider = get_default_provider()

    assert provider.name == "openrouter"





def test_get_default_claude_via_bifrost(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.setenv("DEFAULT_LLM_PROVIDER", "claude")

    monkeypatch.setenv("BIFROST_ENABLED", "true")

    provider = get_default_provider()

    assert provider.name == "claude"

    assert ClaudeProvider().available() is True





def test_bifrost_alias_resolves_to_claude(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.setenv("DEFAULT_LLM_PROVIDER", "bifrost")

    monkeypatch.setenv("BIFROST_ENABLED", "true")

    provider = get_default_provider()

    assert provider.name == "claude"





@pytest.mark.asyncio

async def test_router_falls_back_to_mock_without_key():

    router = LLMRouter()

    text, meta = await router.generate_response("hello", {"language": "en"})

    assert meta["provider"] == "mock"

    assert "Paper" in text or "mock" in text.lower()





@pytest.mark.asyncio

async def test_router_selects_openrouter_when_key_set(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")



    mock_response = MagicMock()

    mock_response.status_code = 200

    mock_response.json.return_value = {

        "choices": [{"message": {"content": "OpenRouter says paper-first."}}]

    }

    mock_response.text = ""



    mock_client = AsyncMock()

    mock_client.post = AsyncMock(return_value=mock_response)

    mock_client.__aenter__ = AsyncMock(return_value=mock_client)

    mock_client.__aexit__ = AsyncMock(return_value=None)



    with patch("llm_providers.openrouter.httpx.AsyncClient", return_value=mock_client):

        router = LLMRouter()

        text, meta = await router.generate_response("status?", {"language": "en"})



    assert meta["provider"] == "openrouter"

    assert "paper-first" in text.lower()

    mock_client.post.assert_awaited()

    call_kwargs = mock_client.post.await_args.kwargs

    assert "Authorization" in call_kwargs["headers"]

    assert call_kwargs["headers"]["X-Title"]





@pytest.mark.asyncio

async def test_router_selects_claude_via_bifrost(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.setenv("DEFAULT_LLM_PROVIDER", "claude")

    monkeypatch.setenv("BIFROST_ENABLED", "true")

    monkeypatch.setenv("BIFROST_BASE_URL", "http://bifrost.test:8080")



    mock_response = MagicMock()

    mock_response.status_code = 200

    mock_response.json.return_value = {

        "content": [{"type": "text", "text": "Claude via Bifrost — paper-first."}]

    }

    mock_response.text = ""



    mock_client = AsyncMock()

    mock_client.post = AsyncMock(return_value=mock_response)

    mock_client.__aenter__ = AsyncMock(return_value=mock_client)

    mock_client.__aexit__ = AsyncMock(return_value=None)



    with patch("llm_providers.claude.httpx.AsyncClient", return_value=mock_client):

        router = LLMRouter()

        text, meta = await router.generate_response("status?", {"language": "en"})



    assert meta["provider"] == "claude"

    assert "bifrost" in text.lower() or "paper" in text.lower()

    url = mock_client.post.await_args.args[0]

    assert "bifrost.test" in url

    assert "/anthropic/v1/messages" in url





@pytest.mark.asyncio

async def test_router_advisory_json_falls_back_to_mock():

    router = LLMRouter()

    data, meta = await router.generate_advisory_json("advise me", {"symbol": "RELIANCE"})

    assert meta["provider"] == "mock"

    assert data.get("paper_only") is True or "recommendations" in data





@pytest.mark.asyncio

async def test_openrouter_advisory_json_mode(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")

    payload = {

        "summary": "Hold paper",

        "recommendations": [

            {

                "title": "Paper RSI",

                "summary": "Test on paper",

                "paper_test_required": True,

            }

        ],

        "warnings": ["Risk applies"],

        "paper_only": True,

        "live_trading_enabled": False,

    }

    mock_response = MagicMock()

    mock_response.status_code = 200

    mock_response.json.return_value = {

        "choices": [{"message": {"content": json.dumps(payload)}}]

    }

    mock_response.text = ""



    mock_client = AsyncMock()

    mock_client.post = AsyncMock(return_value=mock_response)

    mock_client.__aenter__ = AsyncMock(return_value=mock_client)

    mock_client.__aexit__ = AsyncMock(return_value=None)



    with patch("llm_providers.openrouter.httpx.AsyncClient", return_value=mock_client):

        data = await OpenRouterProvider().generate_advisory_json("advise", {})



    assert data["summary"] == "Hold paper"

    body = mock_client.post.await_args.kwargs["json"]

    assert body["response_format"] == {"type": "json_object"}





@pytest.mark.asyncio

async def test_router_falls_back_when_openrouter_errors(monkeypatch: pytest.MonkeyPatch):

    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")

    monkeypatch.setenv("LLM_MAX_RETRIES", "0")



    mock_response = MagicMock()

    mock_response.status_code = 500

    mock_response.text = "server error"



    mock_client = AsyncMock()

    mock_client.post = AsyncMock(return_value=mock_response)

    mock_client.__aenter__ = AsyncMock(return_value=mock_client)

    mock_client.__aexit__ = AsyncMock(return_value=None)



    with patch("llm_providers.openrouter.httpx.AsyncClient", return_value=mock_client):

        router = LLMRouter()

        text, meta = await router.generate_response("hello", {})



    assert meta["provider"] == "mock"

    assert text


