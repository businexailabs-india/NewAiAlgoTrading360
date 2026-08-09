"""
Research helper: dump Nifty option chain via DhanHQ-py.

Usage:
  $env:DHAN_CLIENT_ID="..."
  $env:DHAN_ACCESS_TOKEN="..."
  python scripts/research_option_chain.py
  python scripts/research_option_chain.py --expiry 2026-07-31
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    load_dotenv(ROOT.parents[1] / "backend" / ".env")
except ImportError:
    pass


def default_expiry() -> str:
    # Next Thursday-ish placeholder; prefer --expiry or expiry_list first
    d = datetime.utcnow().date()
    # advance to next Thursday
    while d.weekday() != 3:
        d += timedelta(days=1)
    return d.isoformat()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--under", type=int, default=13, help="NIFTY=13 BANKNIFTY=25")
    parser.add_argument("--segment", default="IDX_I")
    parser.add_argument("--expiry", default="", help="YYYY-MM-DD")
    parser.add_argument("--out", default="", help="optional JSON output path")
    args = parser.parse_args()

    cid = os.getenv("DHAN_CLIENT_ID", "").strip()
    tok = os.getenv("DHAN_ACCESS_TOKEN", "").strip()
    if not cid or not tok:
        print("FAIL: set DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN")
        return 1

    from app.client import DhanHqClient

    client = DhanHqClient(cid, tok)

    expiry = args.expiry
    if not expiry:
        try:
            listing = client.expiry_list(args.under, args.segment)
            print("=== expiry_list ===")
            print(json.dumps(listing, indent=2, default=str)[:2000])
            # Try to pick first expiry string from common shapes
            if isinstance(listing, dict):
                data = listing.get("data") or listing.get("expiryList") or listing
                if isinstance(data, list) and data:
                    expiry = str(data[0])
                elif isinstance(data, dict):
                    for v in data.values():
                        if isinstance(v, list) and v:
                            expiry = str(v[0])
                            break
        except Exception as exc:  # noqa: BLE001
            print(f"expiry_list failed: {exc}")
        if not expiry:
            expiry = default_expiry()
            print(f"using fallback expiry={expiry}")

    print(f"\n=== option_chain under={args.under} expiry={expiry} ===")
    chain = client.option_chain(args.under, args.segment, expiry)
    text = json.dumps(chain, indent=2, default=str)
    print(text[:4000])
    if len(text) > 4000:
        print(f"... truncated ({len(text)} chars)")

    out = args.out or str(ROOT / "scripts" / "output" / f"option_chain_{args.under}_{expiry}.json")
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    Path(out).write_text(text, encoding="utf-8")
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
