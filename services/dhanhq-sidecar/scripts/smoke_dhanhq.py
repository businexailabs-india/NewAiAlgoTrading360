"""
Smoke-test official DhanHQ-py against your credentials.

Usage (PowerShell):
  cd services/dhanhq-sidecar
  python -m venv .venv
  .\\.venv\\Scripts\\Activate.ps1
  pip install -r requirements.txt
  $env:DHAN_CLIENT_ID="..."
  $env:DHAN_ACCESS_TOKEN="..."
  python scripts/smoke_dhanhq.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow `python scripts/smoke_dhanhq.py` from sidecar root
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT.parents[1] / "backend" / ".env")
except ImportError:
    pass


def main() -> int:
    cid = os.getenv("DHAN_CLIENT_ID", "").strip()
    tok = os.getenv("DHAN_ACCESS_TOKEN", "").strip()
    if not cid or not tok:
        print("FAIL: set DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN")
        return 1

    from app.client import DhanHqClient

    client = DhanHqClient(cid, tok)
    print("=== fund_limits ===")
    funds = client.fund_limits()
    print(json.dumps(funds, indent=2, default=str)[:2000])

    print("\n=== holdings (truncated) ===")
    holdings = client.holdings()
    if isinstance(holdings, list):
        print(f"count={len(holdings)}")
        if holdings:
            print(json.dumps(holdings[0], indent=2, default=str)[:800])
    else:
        print(json.dumps(holdings, indent=2, default=str)[:1200])

    print("\n=== ohlc HDFCBANK (1333) ===")
    try:
        q = client.ohlc_data({"NSE_EQ": [1333]})
        print(json.dumps(q, indent=2, default=str)[:1200])
    except Exception as exc:  # noqa: BLE001
        print(f"ohlc skipped: {exc}")

    print("\n=== expiry_list NIFTY (13) ===")
    try:
        exp = client.expiry_list(13, "IDX_I")
        print(json.dumps(exp, indent=2, default=str)[:1200])
    except Exception as exc:  # noqa: BLE001
        print(f"expiry skipped: {exc}")

    print("\nSMOKE OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
