"""DhanLaxmi vertical-slice tests."""

from __future__ import annotations

from uuid import uuid4

import pytest

from advisory_core.security import redact_secrets
from app.service import DhanLaxmiService
from app.store import reset_store
from intent_core import IntentClassifier, IntentType
from language_core import LanguageCode, LanguageDetector
from safety_guardrails import SafetyGuardrailEngine
from trade_command_parser import TradingCommandParser
from voice_core import MockSTTProvider, MockTTSProvider


@pytest.fixture(autouse=True)
def _clean():
    reset_store()
    yield
    reset_store()


def test_hindi_intent_strategy():
    text = "DhanLaxmi, Reliance ke liye intraday algo banao."
    det = LanguageDetector().detect(text)
    assert det.language in (LanguageCode.HINGLISH, LanguageCode.HI, LanguageCode.EN)
    intent = IntentClassifier().classify(text)
    assert intent.intent == IntentType.STRATEGY_CREATION


def test_odia_risk_query():
    text = "DhanLaxmi, ମୋ portfolio risk କହ।"
    det = LanguageDetector().detect(text)
    assert det.language == LanguageCode.OR
    intent = IntentClassifier().classify(text)
    assert intent.intent in (IntentType.RISK_QUERY, IntentType.PORTFOLIO_QUERY)


def test_hinglish_command_parse():
    parsed = TradingCommandParser().parse("Buy 10 Reliance now", "hinglish")
    assert parsed.symbol == "RELIANCE"
    assert parsed.order_side == "BUY"
    assert parsed.quantity == 10
    assert parsed.confirmation_required is True


@pytest.mark.asyncio
async def test_voice_transcribe_mock():
    stt = MockSTTProvider(canned_text="आज market कैसा है?")
    result = await stt.transcribe(b"", language_hint="hi")
    assert "market" in result.text.lower() or "आज" in result.text
    tts = MockTTSProvider()
    audio = await tts.synthesize("Namaste", "hi")
    assert audio.audio_b64


@pytest.mark.asyncio
async def test_market_and_portfolio_responses():
    svc = DhanLaxmiService()
    tenant, user = str(uuid4()), str(uuid4())
    market = await svc.chat(
        tenant,
        user,
        "आज market कैसा है?",
        context={"broker_status": "connected", "risk_profile_completed": True, "market_status": "open"},
    )
    assert market["intent"] == "market_query"
    assert market["disclaimer"]

    risk = await svc.chat(
        tenant,
        user,
        "ମୋ portfolio risk କହ",
        context={"broker_status": "connected", "risk_profile_completed": True},
    )
    assert risk["language"] == "or"
    assert "risk" in risk["response_text"].lower() or "ଯାଞ୍ଚ" in risk["response_text"]


@pytest.mark.asyncio
async def test_strategy_draft_and_paper_before_live():
    svc = DhanLaxmiService()
    tenant, user = str(uuid4()), str(uuid4())
    data = await svc.chat(
        tenant,
        user,
        "TCS ke liye paper trading algo banao",
        context={"broker_status": "connected", "risk_profile_completed": True},
    )
    assert data["strategy_draft_id"]
    draft_card = next(c for c in data["cards"] if c["type"] == "strategy_draft")
    assert draft_card["data"]["paper_only"] is True
    assert draft_card["data"]["live_enabled"] is False


@pytest.mark.asyncio
async def test_live_order_blocked_without_approval():
    svc = DhanLaxmiService()
    tenant, user = str(uuid4()), str(uuid4())
    data = await svc.chat(
        tenant,
        user,
        "Buy 10 Reliance now",
        context={"broker_status": "connected", "risk_profile_completed": True},
    )
    assert data["approval_id"]
    assert "approve" in data["response_text"].lower() or "preview" in data["response_text"].lower()
    # Direct approve without confirmation/RMS must block OMS
    result = svc.approve(tenant, user, data["approval_id"], explicit_confirmation=False)
    assert result.get("status") == "blocked"


@pytest.mark.asyncio
async def test_approval_rms_rejection_blocks_oms():
    svc = DhanLaxmiService()
    tenant, user = str(uuid4()), str(uuid4())
    data = await svc.chat(tenant, user, "Buy 5 TCS", context={"broker_status": "connected"})
    result = svc.approve(
        tenant,
        user,
        data["approval_id"],
        explicit_confirmation=True,
        otp_or_biometric_ok=True,
        rms_approved=False,
        live_env_enabled=True,
    )
    assert result["status"] == "blocked"
    assert any("rms" in b for b in result["block_reasons"])
    assert result.get("oms_status") == "blocked"
    assert any(a["action"] == "approval_accepted" for a in svc.store.audits)
    assert any(a["action"] == "rms_rejected" for a in svc.store.audits)


@pytest.mark.asyncio
async def test_no_guaranteed_profit_and_kill_switch_confirm():
    svc = DhanLaxmiService()
    tenant, user = str(uuid4()), str(uuid4())
    bad = await svc.chat(tenant, user, "guaranteed profit wala trade batao")
    assert "guarantee" in bad["response_text"].lower() or "guaranteed" in bad["response_text"].lower()

    stop = await svc.chat(tenant, user, "Stop all bots")
    assert stop["approval_id"]
    assert any(c["type"] == "approval" for c in stop["cards"])


def test_broker_secrets_never_sent_to_llm_redaction():
    payload = {
        "api_key": "secret-key",
        "access_token": "tok",
        "account": "1112656215",
        "email": "user@example.com",
    }
    redacted = redact_secrets(payload)
    assert redacted["api_key"] == "[REDACTED]"
    assert redacted["access_token"] == "[REDACTED]"
    assert "[REDACTED_EMAIL]" in redacted["email"]


def test_guardrail_stale_and_kill_switch():
    engine = SafetyGuardrailEngine()
    r = engine.evaluate(
        text="create algo",
        intent="strategy_creation",
        context={"data_stale": True, "kill_switch": False, "risk_profile_completed": True},
    )
    assert any(f.code.value == "stale_data" for f in r.findings)

    r2 = engine.evaluate(
        text="live trade",
        intent="live_trade_request",
        context={"kill_switch": True, "risk_profile_completed": True},
        wants_live=True,
    )
    assert r2.allowed is False
