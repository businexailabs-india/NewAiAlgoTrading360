"""BusineX AI TradeX - six NSE cash-equity intraday bots on one risk-controlled platform.

Live trading is disabled by default. Nothing in this package places a real order unless the Dhan live
executor is explicitly authorised through `live_gate.LiveModeGate`.
"""

from tradex_bots.config import (  # noqa: F401
    ALL_BOT_IDS,
    BOT_01,
    BOT_02,
    BOT_03,
    BOT_04,
    BOT_05,
    BOT_06,
    EngineConfig,
    ExecutionMode,
    RiskConfig,
)

__version__ = "1.0.0"
