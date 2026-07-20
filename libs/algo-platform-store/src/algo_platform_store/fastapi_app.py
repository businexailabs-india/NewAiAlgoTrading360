"""Helpers to build FastAPI services for Algo MVP."""

from __future__ import annotations

from fastapi import FastAPI


def build_app(title: str, version: str = "0.1.0") -> FastAPI:
    app = FastAPI(
        title=title,
        version=version,
        description=(
            "BusineXAi TradeOS360 Algo Library + Paper Trading MVP. "
            "Live trading is disabled. Paper mode only. Strategies never promise profit."
        ),
    )

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "service": title,
            "live_trading_enabled": False,
            "paper_trading_only": True,
        }

    return app
