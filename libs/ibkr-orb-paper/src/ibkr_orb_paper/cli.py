from __future__ import annotations

import argparse
import sys

from ibkr_orb_paper.broker.fake import FakeIBKRAdapter, make_synthetic_orb_day
from ibkr_orb_paper.config import RunMode, load_settings
from ibkr_orb_paper.logging_setup import setup_logging
from ibkr_orb_paper.app.runner import AppRunner
from ibkr_orb_paper.reporting.service import ReportingService
from ibkr_orb_paper.persistence.repository import TradeRepository


def _build_broker(settings, *, use_fake: bool):
    if use_fake:
        bars = make_synthetic_orb_day(breakout=True)
        account = settings.ibkr_paper_account_id or "DU1234567"
        return FakeIBKRAdapter(accounts=[account, "DU9999999"], selected=account, bars=bars)
    from ibkr_orb_paper.broker.ibkr_adapter import IBKRPaperAdapter

    return IBKRPaperAdapter(settings)


def main(argv: list[str] | None = None) -> int:
    setup_logging()
    parser = argparse.ArgumentParser(
        prog="ibkr_orb_paper",
        description="IBKR paper-only opening-range breakout bot (research/paper trading only)",
    )
    parser.add_argument(
        "--fake-ibkr",
        action="store_true",
        help="Use in-memory FakeIBKRAdapter (tests/demo; no TWS)",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    run_p = sub.add_parser("run", help="Run strategy once")
    run_p.add_argument(
        "--mode",
        choices=["signal", "dry-run", "paper"],
        required=True,
        help="signal | dry-run | paper (no live mode exists)",
    )

    sub.add_parser("status", help="Connection/account/order status")
    sub.add_parser("reconcile", help="Reconcile local state with IBKR")
    sub.add_parser("kill-switch", help="Block new entries; cancel strategy entry orders only")

    report_p = sub.add_parser("report", help="Daily console/CSV report")
    report_p.add_argument("--date", required=True, help="YYYY-MM-DD")
    report_p.add_argument("--csv", default="", help="Optional CSV output path")

    args = parser.parse_args(argv)
    settings = load_settings()

    if args.cmd == "report":
        repo = TradeRepository(settings.sqlite_path)
        svc = ReportingService(repo)
        day = svc.build_day_report(args.date)
        print(day)
        if args.csv:
            path = svc.write_csv(args.date, args.csv)
            print(f"Wrote {path}")
        return 0

    broker = _build_broker(settings, use_fake=args.fake_ibkr)
    runner = AppRunner(settings, broker)
    try:
        if args.cmd == "run":
            mode = RunMode(args.mode)
            runner.run_once(mode)
            return 0
        if args.cmd == "status":
            print(runner.status())
            return 0
        if args.cmd == "reconcile":
            runner.connect_and_verify(require_account=bool(settings.ibkr_paper_account_id))
            print(runner.orders.reconcile())
            return 0
        if args.cmd == "kill-switch":
            print(runner.kill_switch())
            return 0
    finally:
        try:
            broker.disconnect()
        except Exception:  # noqa: BLE001
            pass
    return 1


if __name__ == "__main__":
    sys.exit(main())
