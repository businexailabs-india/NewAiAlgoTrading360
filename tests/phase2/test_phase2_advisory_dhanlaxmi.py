"""Phase 2 vertical-slice tests — Advisory-to-Algo + DhanLaxmi Prompt-to-Algo."""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

import pytest
from schemas.strategy import StrategyConfig

from advisory_core.events import EventEnvelope, KafkaTopics
from advisory_to_strategy import convert_recommendation_to_strategy_config
from llm_providers import ClaudeProvider, MockLLMProvider, OpenAIProvider, validate_ai_json
from llm_providers.base import AdvisoryLLMOutput
from prompt_to_strategy import PromptToStrategyConverter
from recommendation_ranking import RecommendationRankingEngine

ROOT = Path(__file__).resolve().parents[2]


def _clear_app_modules() -> None:
    for key in list(sys.modules):
        if key == "app" or key.startswith("app."):
            del sys.modules[key]


def _prefer_service_path(service_dir: Path) -> None:
    path = str(service_dir.resolve())
    mod = sys.modules.get("app.service")
    if mod is not None:
        loaded = (getattr(mod, "__file__", "") or "").replace("\\", "/")
        if path.replace("\\", "/") in loaded:
            return
    _clear_app_modules()
    while path in sys.path:
        sys.path.remove(path)
    sys.path.insert(0, path)


@pytest.fixture
def advisory_svc():
    _prefer_service_path(ROOT / "services" / "ai-advisory-service")
    from app.service import AIAdvisoryService
    from app.store import reset_store

    reset_store()
    svc = AIAdvisoryService(kafka_bootstrap="memory://")
    yield svc
    reset_store()


@pytest.fixture
def dhan_svc():
    _prefer_service_path(ROOT / "services" / "dhanlaxmi-assistant-service")
    from app.service import DhanLaxmiService
    from app.store import reset_store

    reset_store()
    svc = DhanLaxmiService()
    yield svc
    reset_store()


@pytest.mark.asyncio
async def test_login_triggers_advisory_async(advisory_svc):
    tenant, user = str(uuid4()), str(uuid4())
    event = EventEnvelope.create(
        KafkaTopics.USER_LOGIN_SUCCESS,
        tenant,
        user,
        {
            "broker_status": "connected",
            "broker": "mock",
            "risk_profile_completed": True,
            "available_margin": 80000,
            "market_status": "open",
            "data_stale": False,
        },
        idempotency_key=f"p2-login-{user}",
    )
    data = await advisory_svc.handle_login_event(event)
    assert data["status"] == "preparing"
    await advisory_svc.wait_pending()
    ready = advisory_svc.to_login_response(advisory_svc.store.get_session(data["advisory_id"]))
    assert ready["status"] == "ready"
    assert 3 <= len(ready["recommendations"]) <= 5


@pytest.mark.asyncio
async def test_advisory_returns_3_to_5_algos(advisory_svc):
    data = await advisory_svc.generate_login_advisory(
        str(uuid4()),
        str(uuid4()),
        {
            "broker_status": "connected",
            "broker": "mock",
            "risk_profile_completed": True,
            "available_margin": 90000,
            "market_status": "open",
        },
    )
    assert 3 <= len(data["recommendations"]) <= 5
    assert all(r.get("paper_only", True) for r in data["recommendations"])


@pytest.mark.asyncio
async def test_recommendation_converts_to_strategy_config(advisory_svc):
    tenant, user = str(uuid4()), str(uuid4())
    adv = await advisory_svc.generate_login_advisory(
        user,
        tenant,
        {
            "broker_status": "connected",
            "broker": "mock",
            "risk_profile_completed": True,
            "available_margin": 90000,
        },
    )
    rec = next(r for r in adv["recommendations"] if "no-trade" not in r["title"].lower())
    option = await advisory_svc.convert_to_algo(tenant, user, adv["advisory_id"], rec["id"])
    assert option["strategy_config"]
    cfg = StrategyConfig.model_validate(option["strategy_config"])
    assert cfg.paper_trading_required is True
    assert cfg.live_trading_enabled is False
    assert cfg.symbols
    direct = convert_recommendation_to_strategy_config(rec, created_by=user)
    assert isinstance(direct, StrategyConfig)


@pytest.mark.asyncio
async def test_hinglish_prompt_creates_vwap_strategy(dhan_svc):
    tenant, user = str(uuid4()), str(uuid4())
    data = await dhan_svc.chat(
        tenant,
        user,
        "Reliance ke liye intraday algo banao",
        context={"broker_status": "connected", "risk_profile_completed": True},
    )
    assert data["strategy_draft_id"]
    draft = next(c["data"] for c in data["cards"] if c["type"] == "strategy_draft")
    assert draft["strategy_type"] == "vwap_breakout"
    assert draft["symbol"] == "RELIANCE"
    assert draft["live_enabled"] is False


@pytest.mark.asyncio
async def test_odia_portfolio_query_localized(dhan_svc):
    data = await dhan_svc.chat(
        str(uuid4()),
        str(uuid4()),
        "ମୋ portfolio risk କହ",
        context={"broker_status": "connected", "risk_profile_completed": True},
    )
    assert data["language"] == "or"
    assert data["response_text"]
    text = data["response_text"].lower()
    assert "risk" in text or "ଯାଞ୍ଚ" in data["response_text"] or "ପୋର୍ଟ" in data["response_text"]


@pytest.mark.asyncio
async def test_direct_buy_does_not_execute(dhan_svc):
    tenant, user = str(uuid4()), str(uuid4())
    data = await dhan_svc.chat(
        tenant,
        user,
        "Buy 10 Reliance now",
        context={"broker_status": "connected", "risk_profile_completed": True},
    )
    assert data["approval_id"]
    assert data.get("never_auto_executes", True)
    preview = next((c["data"] for c in data["cards"] if c["type"] == "order_preview"), None)
    assert preview is not None
    assert preview.get("executed") is False
    assert preview.get("live_trading_enabled") is False
    assert "risk" in (preview.get("risk_warning") or "").lower()
    result = dhan_svc.approve(
        tenant,
        user,
        data["approval_id"],
        explicit_confirmation=True,
        otp_or_biometric_ok=True,
    )
    assert result.get("oms_status") == "blocked" or result.get("status") == "blocked"


@pytest.mark.asyncio
async def test_paper_test_works(dhan_svc):
    tenant, user = str(uuid4()), str(uuid4())
    data = await dhan_svc.chat(
        tenant,
        user,
        "TCS ke liye intraday algo banao",
        context={"broker_status": "connected", "risk_profile_completed": True},
    )
    assert data["strategy_draft_id"]
    result = dhan_svc.run_paper_test(tenant, user, data["strategy_draft_id"])
    assert result["status"] == "completed"
    assert result["paper_only"] is True
    assert result["live_trading_enabled"] is False
    assert "metrics" in result
    assert result["metrics"]["qualified_for_live"] is False


@pytest.mark.asyncio
async def test_advisory_ai_decisions_audited(advisory_svc):
    await advisory_svc.generate_login_advisory(
        str(uuid4()),
        str(uuid4()),
        {
            "broker_status": "connected",
            "broker": "mock",
            "risk_profile_completed": True,
            "available_margin": 50000,
        },
    )
    assert any(a["action"] == "advisory_generated" for a in advisory_svc.store.audits)
    assert any(a["action"] == "ai_json_validated" for a in advisory_svc.store.audits)


@pytest.mark.asyncio
async def test_dhanlaxmi_ai_decisions_audited(dhan_svc):
    tenant, user = str(uuid4()), str(uuid4())
    await dhan_svc.chat(
        tenant,
        user,
        "Aaj safe algo suggest karo",
        context={"broker_status": "connected", "risk_profile_completed": True},
    )
    actions = {a["action"] for a in dhan_svc.store.audits}
    assert "command_received" in actions
    assert "response_generated" in actions


def test_mock_llm_is_default_and_interfaces_exist():
    mock = MockLLMProvider()
    assert mock.name == "mock"
    assert mock.available()
    assert ClaudeProvider().name == "claude"
    assert OpenAIProvider().name == "openai"


@pytest.mark.asyncio
async def test_mock_llm_json_validated():
    mock = MockLLMProvider()
    data = await mock.generate_advisory_json("", {"available_margin": 50000})
    validated = validate_ai_json(data, AdvisoryLLMOutput)
    assert 3 <= len(validated["recommendations"]) <= 5
    assert validated["live_trading_enabled"] is False


def test_ranking_engine_pads_to_three():
    engine = RecommendationRankingEngine()
    ranked = engine.rank(
        [{"title": "No-Trade", "type": "no_trade", "confidence_score": 0.9, "risk_score": 0.1}],
        force_no_trade=True,
    )
    assert 3 <= len(ranked) <= 5
    assert ranked[0]["recommendation_type"] == "no_trade"


def test_prompt_to_strategy_vwap():
    conv = PromptToStrategyConverter()
    draft = conv.to_draft("Reliance ke liye intraday algo banao", language="hinglish")
    assert draft["strategy_type"] == "vwap_breakout"
    assert draft["symbol"] == "RELIANCE"
    cfg = StrategyConfig.model_validate(draft["strategy_config"])
    assert cfg.live_trading_enabled is False
