import sys
from pathlib import Path
from uuid import uuid4

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT.parents[1] / "libs" / "advisory-core" / "src"))
sys.path.insert(0, str(ROOT.parents[1] / "libs" / "mcp-connectors" / "src"))
sys.path.insert(0, str(ROOT.parents[1] / "libs" / "strategy-normalizer" / "src"))

from app.engine import PaperTestOrchestrator


@pytest.mark.asyncio
async def test_paper_test_runs_and_risky_options_not_live_qualified():
    orch = PaperTestOrchestrator()
    option = {
        "id": str(uuid4()),
        "strategy_type": "options_straddle_monitor",
        "entry_rules_json": [{"indicator": "atm"}],
        "exit_rules_json": [{"type": "stop_loss_pct", "value": 2}],
        "risk_rules_json": [
            {"type": "stop_loss", "value_pct": 2},
            {"type": "daily_max_loss", "value": 1000},
            {"type": "anti_lookahead", "value": True},
            {"type": "idempotent_orders", "value": True},
            {"type": "unbounded_options_risk", "value": True, "live_blocked_by_default": True},
        ],
        "position_sizing_json": {"required_capital": 50000},
        "instruments_json": ["NSE:NIFTY"],
        "timeframe": "5m",
        "source_license_status": "internal",
    }
    result = await orch.run(option, str(uuid4()))
    assert result["trade_count"] >= 0
    assert result["qualified_for_live"] is False
