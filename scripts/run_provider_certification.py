"""Run Phase-2 ProviderCertificationChecklist for all Indian providers.

Writes reports to /reports/provider-certification/
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "libs" / "advisory-core" / "src"))
sys.path.insert(0, str(ROOT / "libs" / "mcp-connectors" / "src"))

os.environ.setdefault("MCP_PROVIDERS_CONFIG_DIR", str(ROOT / "config" / "mcp-providers"))
os.environ.setdefault("LIVE_TRADING_ENABLED", "false")
os.environ.setdefault("PROVIDER_ALLOW_LIVE_HTTP", "false")

from mcp_connectors.base.certification import (  # noqa: E402
    ProviderCertificationChecklist,
    run_provider_certification,
    write_certification_report,
)
from mcp_connectors.registry import get_registry  # noqa: E402


REPORTS_DIR = ROOT / "reports" / "provider-certification"

# Broker + sim providers to certify (market data included separately)
PROVIDER_ORDER = [
    "dhan",
    "zerodha",
    "angelone",
    "upstox",
    "fyers",
    "icici_breeze",
    "kotak_neo",
    "alice_blue",
    "finvasia_shoonya",
    "iifl",
    "motilal_oswal",
    "hdfc_sky",
    "groww",
    "paytm_money",
    "samco",
    "sharekhan",
    "paper_trading",
    "mock_trading",
    "truedata",
    "globaldatafeeds",
    "accord",
    "bse_direct",
    "nse_direct",
    "mock_market_data",
]


def _env_configured(provider) -> bool:
    checker = getattr(provider, "env_credentials_present", None)
    if callable(checker):
        return bool(checker())
    return False


async def certify_one(provider_id: str) -> ProviderCertificationChecklist:
    reg = get_registry(reload=False)
    provider = reg.get_provider(provider_id, fresh=True)
    cfg = reg._configs.get(provider_id)
    name = cfg.provider_name if cfg else getattr(provider, "provider_name", provider_id)
    checklist = await run_provider_certification(
        provider,
        provider_name=name,
        credentials_env_configured=_env_configured(provider),
    )
    write_certification_report(checklist, REPORTS_DIR)
    return checklist


async def main(selected: list[str] | None = None) -> int:
    reg = get_registry(reload=True)
    available = {p.provider_id for p in reg.list_providers()}
    targets = selected or [p for p in PROVIDER_ORDER if p in available]
    # also include any yaml providers not in order
    for pid in sorted(available):
        if pid not in targets:
            targets.append(pid)

    results: list[ProviderCertificationChecklist] = []
    for pid in targets:
        print(f"certifying {pid} ...")
        results.append(await certify_one(pid))

    summary = {
        "phase": "phase_2_real_provider_readiness",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(results),
        "passed": sum(1 for r in results if r.overall_passed),
        "failed": sum(1 for r in results if not r.overall_passed),
        "providers": [
            {
                "provider_id": r.provider_id,
                "provider_name": r.provider_name,
                "score": r.score,
                "overall_passed": r.overall_passed,
                "mode": r.mode,
            }
            for r in results
        ],
    }
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    summary_path = REPORTS_DIR / "SUMMARY.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    md_lines = [
        "# Indian MCP Provider Certification Summary",
        "",
        f"- Generated: `{summary['generated_at']}`",
        f"- Total: **{summary['total']}**",
        f"- Passed: **{summary['passed']}**",
        f"- Failed: **{summary['failed']}**",
        "",
        "| Provider | Score | Result | Mode |",
        "|----------|------:|--------|------|",
    ]
    for row in summary["providers"]:
        md_lines.append(
            f"| `{row['provider_id']}` | {row['score']}% | "
            f"{'PASS' if row['overall_passed'] else 'FAIL'} | {row['mode']} |"
        )
    md_lines.append("")
    md_lines.append("Per-provider JSON/Markdown reports: `*-latest.json`, `*-latest.md`.")
    (REPORTS_DIR / "SUMMARY.md").write_text("\n".join(md_lines), encoding="utf-8")
    print(f"wrote {summary_path}")
    print(f"passed={summary['passed']} failed={summary['failed']}")
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", action="append", dest="providers", default=None)
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.providers)))
