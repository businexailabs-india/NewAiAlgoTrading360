from __future__ import annotations

from fastapi import HTTPException

from algo_platform_store import get_runtime
from algo_platform_store.fastapi_app import build_app
from schemas.strategy import RISK_WARNING

app = build_app("Portfolio Service (Paper)")
rt = get_runtime()


@app.get("/portfolio/{account_id}")
def portfolio(account_id: str):
    acct = rt.broker.get_account(account_id)
    if not acct:
        raise HTTPException(404, "account_not_found")
    positions = rt.broker.list_positions(account_id)
    equity = acct.cash_balance + acct.unrealized_pnl
    return {
        "success": True,
        "data": {
            "account_id": account_id,
            "cash_balance": acct.cash_balance,
            "realized_pnl": acct.realized_pnl,
            "unrealized_pnl": acct.unrealized_pnl,
            "equity": equity,
            "positions": positions,
            "live_trading_enabled": False,
            "risk_warning": RISK_WARNING,
        },
    }
