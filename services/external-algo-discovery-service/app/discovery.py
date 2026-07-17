"""ExternalAlgoDiscoveryService — APIs, licensed repos, uploads only."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from advisory_core.telemetry import external_algos_discovered_count, external_algos_rejected_count
from strategy_normalizer import StrategyNormalizer

INTERNAL_LIBRARY = [
    {
        "title": "BusineXAi VWAP Breakout Template",
        "description": "Internal licensed VWAP breakout template for paper testing",
        "strategy_type": "vwap_breakout",
        "symbols": ["NSE:RELIANCE"],
        "timeframe": "5m",
        "license": "internal",
        "entry_rules": [{"indicator": "vwap", "condition": "price_above"}],
        "exit_rules": [{"type": "stop_loss_pct", "value": 1.5}],
        "risk_rules": [
            {"type": "stop_loss", "value_pct": 1.5},
            {"type": "daily_max_loss", "value": 1000},
            {"type": "anti_lookahead", "value": True},
            {"type": "idempotent_orders", "value": True},
        ],
    },
    {
        "title": "BusineXAi RSI Mean Reversion Template",
        "description": "Internal RSI mean reversion candidate",
        "strategy_type": "rsi_mean_reversion",
        "symbols": ["NSE:ITC"],
        "timeframe": "15m",
        "license": "internal",
    },
]


class ExternalAlgoDiscoveryService:
    def __init__(self) -> None:
        self.candidates: dict[str, dict[str, Any]] = {}
        self.normalizer = StrategyNormalizer()
        self.audits: list[dict[str, Any]] = []

    def discover_sources(self) -> list[dict[str, Any]]:
        return [
            {"name": "Internal BusineXAi Strategy Library", "type": "internal", "enabled": True},
            {"name": "GitHub public repositories", "type": "github", "enabled": True, "mode": "license_metadata_only"},
            {"name": "QuantConnect public examples", "type": "partner_placeholder", "enabled": False, "note": "license check required"},
            {"name": "TradingView public script metadata", "type": "partner_placeholder", "enabled": False, "note": "terms-restricted"},
            {"name": "Partner algo marketplace API", "type": "partner_api", "enabled": False},
            {"name": "User-uploaded strategy file", "type": "user_uploaded", "enabled": True},
            {"name": "CSV/JSON strategy catalog", "type": "user_uploaded", "enabled": True},
        ]

    def fetch_public_strategies(self, tenant_id: str | None = None, user_id: str | None = None) -> list[dict[str, Any]]:
        created = []
        for item in INTERNAL_LIBRARY:
            c = self.create_external_algo_candidate(
                {
                    "source_name": "Internal BusineXAi Strategy Library",
                    "source_url": None,
                    "source_type": "internal",
                    "title": item["title"],
                    "description": item["description"],
                    "asset_class": "equity",
                    "exchange": "NSE",
                    "strategy_logic_raw": item,
                    "license_status": "internal",
                    "verification_status": "discovered",
                    "performance_claims_json": {},
                    "risk_warnings": ["Third-party claims not applicable — internal template", "Paper test required"],
                },
                tenant_id=tenant_id,
                user_id=user_id,
            )
            created.append(c)
        # Placeholder GitHub metadata candidate (not scraped content)
        created.append(
            self.create_external_algo_candidate(
                {
                    "source_name": "GitHub",
                    "source_url": "https://github.com/example/public-strategy",
                    "source_type": "github",
                    "title": "Public repo strategy metadata placeholder",
                    "description": "Metadata-only placeholder; license unknown until validated",
                    "asset_class": "equity",
                    "exchange": "NSE",
                    "strategy_logic_raw": {
                        "strategy_type": "moving_average_crossover",
                        "symbols": ["NSE:NIFTY"],
                        "note": "Declarative rules must be provided by user/partner API",
                    },
                    "license_status": "license_unknown",
                    "verification_status": "discovered",
                    "performance_claims_json": {"note": "unverified"},
                    "risk_warnings": [
                        "not verified",
                        "third-party strategy candidate",
                        "Cannot deploy live until license validated",
                    ],
                },
                tenant_id=tenant_id,
                user_id=user_id,
            )
        )
        external_algos_discovered_count.inc(len(created))
        return created

    def validate_license(self, candidate_id: str, status: str = "license_validated") -> dict[str, Any]:
        c = self.candidates[candidate_id]
        if status not in ("license_validated", "license_rejected", "internal", "user_provided"):
            raise ValueError("Invalid license status")
        c["license_status"] = status
        if status == "license_rejected":
            c["verification_status"] = "rejected"
            external_algos_rejected_count.inc()
            self._audit("external_algo_rejected", c)
        else:
            c["verification_status"] = "license_validated" if status == "license_validated" else c["verification_status"]
        return c

    def normalize_strategy(self, candidate_id: str) -> dict[str, Any]:
        c = self.candidates[candidate_id]
        if c["license_status"] == "license_rejected":
            raise ValueError("Rejected license cannot be normalized")
        try:
            rules = self.normalizer.normalize_external(c.get("strategy_logic_raw") or {})
        except ValueError as exc:
            c["verification_status"] = "rejected"
            c["risk_warnings"] = list(c.get("risk_warnings") or []) + [str(exc)]
            external_algos_rejected_count.inc()
            self._audit("external_algo_rejected", c)
            raise
        c["normalized_strategy_json"] = rules.model_dump()
        c["verification_status"] = "normalized"
        if c["license_status"] == "license_unknown":
            c["verification_status"] = "not_verified"
            # still keep normalized payload but mark not verified
            c["verification_status"] = "normalized"
            c["risk_warnings"] = list(dict.fromkeys([*(c.get("risk_warnings") or []), "not verified"]))
        self._audit("external_algo_normalized", c)
        return c

    def risk_scan_strategy(self, candidate_id: str) -> dict[str, Any]:
        c = self.candidates[candidate_id]
        if not c.get("normalized_strategy_json"):
            raise ValueError("Normalize before risk scan")
        from advisory_core.contracts import StrategyRules

        rules = StrategyRules(**c["normalized_strategy_json"])
        rms = self.normalizer.validate_rms(rules, historical_bars=60)
        c["rms"] = rms.model_dump()
        c["verification_status"] = "risk_scanned" if rms.allowed else "rejected"
        if not rms.allowed:
            external_algos_rejected_count.inc()
            self._audit("external_algo_rejected", c)
        else:
            c["verification_status"] = "paper_test_ready"
            self._audit("external_algo_risk_scanned", c)
        return c

    def create_external_algo_candidate(
        self, data: dict[str, Any], tenant_id: str | None = None, user_id: str | None = None
    ) -> dict[str, Any]:
        cid = str(uuid4())
        candidate = {
            "id": cid,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "imported_at": datetime.now(timezone.utc).isoformat(),
            "source_name": data["source_name"],
            "source_url": data.get("source_url"),
            "source_type": data.get("source_type") or "third_party_strategy_candidate",
            "title": data["title"],
            "description": data.get("description"),
            "asset_class": data.get("asset_class") or "equity",
            "exchange": data.get("exchange") or "NSE",
            "strategy_logic_raw": data.get("strategy_logic_raw") or {},
            "normalized_strategy_json": None,
            "license_status": data.get("license_status") or "license_unknown",
            "verification_status": data.get("verification_status") or "discovered",
            "performance_claims_json": data.get("performance_claims_json") or {},
            "risk_warnings": data.get("risk_warnings")
            or ["third-party strategy candidate", "Paper test required", "Live blocked until validated"],
        }
        # Mark external as third-party unless internal
        if candidate["source_type"] != "internal":
            candidate["source_type"] = "third_party_strategy_candidate"
            if candidate["license_status"] == "license_unknown":
                candidate["risk_warnings"] = list(
                    dict.fromkeys([*candidate["risk_warnings"], "not verified"])
                )
        self.candidates[cid] = candidate
        self._audit("external_algo_imported", candidate)
        return candidate

    def rank_candidates(self, risk_level: str = "balanced") -> list[dict[str, Any]]:
        items = list(self.candidates.values())

        def score(c: dict[str, Any]) -> float:
            s = 0.0
            if c["license_status"] in ("internal", "license_validated", "user_provided"):
                s += 2
            if c["verification_status"] == "paper_test_ready":
                s += 2
            if c["license_status"] == "license_unknown":
                s -= 1
            if risk_level == "conservative" and "aggressive" in (c.get("title") or "").lower():
                s -= 0.5
            return s

        return sorted(items, key=score, reverse=True)

    def recommend_for_paper_test(self) -> list[dict[str, Any]]:
        return [c for c in self.rank_candidates() if c["verification_status"] == "paper_test_ready"]

    def can_request_live(self, candidate_id: str) -> tuple[bool, list[str]]:
        c = self.candidates[candidate_id]
        blocks = []
        if c["license_status"] in ("license_unknown", "not_verified", "license_rejected"):
            blocks.append("Unknown/unvalidated license cannot deploy live")
        if c["source_type"] == "third_party_strategy_candidate" and c["license_status"] != "license_validated":
            blocks.append("Third-party candidate requires license validation")
        if c["verification_status"] != "paper_test_ready":
            blocks.append("Must reach paper_test_ready before any further promotion")
        # Never allow direct live from discovery
        blocks.append("External strategies cannot skip paper test and user approval")
        return False, blocks

    def ingest_upload(self, payload: dict[str, Any], tenant_id: str, user_id: str) -> dict[str, Any]:
        # Sandbox: reject code payloads
        raw = payload.get("strategy") or payload
        if any(k in raw for k in ("code", "script", "python", "executable")):
            external_algos_rejected_count.inc()
            raise ValueError("Executable uploads are sandboxed/rejected; provide declarative JSON rules only")
        if len(str(raw)) > 200_000:
            raise ValueError("Upload too large")
        return self.create_external_algo_candidate(
            {
                "source_name": "User upload",
                "source_type": "user_uploaded",
                "title": raw.get("title") or raw.get("name") or "User strategy",
                "description": raw.get("description"),
                "strategy_logic_raw": raw,
                "license_status": "user_provided",
                "verification_status": "discovered",
                "risk_warnings": ["User-provided strategy", "Paper test required", "not verified until risk scan"],
            },
            tenant_id=tenant_id,
            user_id=user_id,
        )

    def _audit(self, action: str, candidate: dict[str, Any]) -> None:
        self.audits.append(
            {
                "action": action,
                "candidate_id": candidate.get("id"),
                "license_status": candidate.get("license_status"),
                "verification_status": candidate.get("verification_status"),
                "at": datetime.now(timezone.utc).isoformat(),
            }
        )
