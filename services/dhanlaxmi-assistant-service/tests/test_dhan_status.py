"""DhanLaxmi answers Dhan account status without exposing secrets."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.service import DhanLaxmiService


@pytest.mark.asyncio
async def test_mera_dhan_account_status_batao():
    svc = DhanLaxmiService()
    tenant, user = str(uuid4()), str(uuid4())
    data = await svc.chat(
        tenant,
        user,
        "mera Dhan account status batao",
        language_hint="hi",
        context={
            "broker_status": "connected",
            "broker": "dhan",
            "dhan_status": {
                "connected": True,
                "health_status": "connected",
                "masked_client_id": "****6215",
                "available_margin": 125000.0,
                "holdings_count": 2,
                "open_positions_count": 1,
                "open_orders_count": 1,
                "live_trading_enabled": False,
                "access_token": "should-be-stripped",
            },
            "risk_profile_completed": True,
        },
    )
    text = (data.get("response_text") or "").lower()
    blob = str(data).lower()
    assert "should-be-stripped" not in blob
    assert "access_token" not in blob
    cards = data.get("cards") or []
    assert any(c.get("type") == "dhan_provider_status" for c in cards)
    assert "dhan" in text
    assert "disabled" in text or "connected" in text
    assert "****6215" in text or "6215" in text
