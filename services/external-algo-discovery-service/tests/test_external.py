import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.discovery import ExternalAlgoDiscoveryService


def test_unknown_license_cannot_deploy_live():
    svc = ExternalAlgoDiscoveryService()
    c = svc.create_external_algo_candidate(
        {
            "source_name": "GitHub",
            "source_type": "github",
            "title": "Unknown license strategy",
            "strategy_logic_raw": {
                "strategy_type": "vwap_breakout",
                "symbols": ["NSE:TCS"],
                "entry_rules": [{"indicator": "vwap"}],
                "exit_rules": [{"type": "stop_loss_pct", "value": 1}],
                "risk_rules": [
                    {"type": "stop_loss", "value_pct": 1},
                    {"type": "daily_max_loss", "value": 500},
                    {"type": "anti_lookahead", "value": True},
                    {"type": "idempotent_orders", "value": True},
                ],
            },
            "license_status": "license_unknown",
        }
    )
    svc.normalize_strategy(c["id"])
    svc.risk_scan_strategy(c["id"])
    ok, blocks = svc.can_request_live(c["id"])
    assert ok is False
    assert any("license" in b.lower() or "paper" in b.lower() for b in blocks)


def test_external_can_paper_test_after_normalize():
    svc = ExternalAlgoDiscoveryService()
    items = svc.fetch_public_strategies("t", "u")
    internal = next(i for i in items if i["license_status"] == "internal")
    svc.normalize_strategy(internal["id"])
    scanned = svc.risk_scan_strategy(internal["id"])
    assert scanned["verification_status"] == "paper_test_ready"


def test_reject_executable_upload():
    svc = ExternalAlgoDiscoveryService()
    try:
        svc.ingest_upload({"strategy": {"title": "x", "code": "print(1)"}}, "t", "u")
        assert False, "should reject"
    except ValueError as exc:
        assert "Executable" in str(exc) or "declarative" in str(exc)
