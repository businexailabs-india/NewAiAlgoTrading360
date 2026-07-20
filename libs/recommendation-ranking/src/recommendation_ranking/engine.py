"""Algo recommendation ranking — always returns 3 to 5 options."""

from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4

MIN_OPTIONS = 3
MAX_OPTIONS = 5

_PAD_TEMPLATES: list[dict[str, Any]] = [
    {
        "title": "Paper Watchlist — Conservative Intraday",
        "type": "conservative_intraday",
        "recommendation_type": "conservative_intraday",
        "symbols": ["NSE:TCS"],
        "confidence_score": 0.34,
        "risk_score": 0.3,
        "required_capital": 10000,
        "timeframe": "5m",
        "rationale": "Low-confidence paper study option while primary advisory is cautionary.",
        "warnings": ["Paper only", "Not a live trade instruction"],
        "actions": ["paper_test", "save"],
        "paper_only": True,
    },
    {
        "title": "Paper Watchlist — VWAP Study",
        "type": "vwap_breakout",
        "recommendation_type": "vwap_breakout",
        "symbols": ["NSE:RELIANCE"],
        "confidence_score": 0.32,
        "risk_score": 0.4,
        "required_capital": 15000,
        "timeframe": "5m",
        "rationale": "Educational VWAP structure study for paper testing only.",
        "warnings": ["Paper only"],
        "actions": ["paper_test", "save"],
        "paper_only": True,
    },
    {
        "title": "Paper Watchlist — RSI Mean Reversion",
        "type": "rsi_mean_reversion",
        "recommendation_type": "rsi_mean_reversion",
        "symbols": ["NSE:ITC"],
        "confidence_score": 0.3,
        "risk_score": 0.45,
        "required_capital": 12000,
        "timeframe": "15m",
        "rationale": "Secondary paper candidate for mean-reversion study.",
        "warnings": ["Paper only"],
        "actions": ["paper_test", "save"],
        "paper_only": True,
    },
]


def rank_recommendations(
    options: list[dict[str, Any]],
    *,
    force_no_trade: bool = False,
    min_options: int = MIN_OPTIONS,
    max_options: int = MAX_OPTIONS,
) -> list[dict[str, Any]]:
    return RecommendationRankingEngine().rank(
        options,
        force_no_trade=force_no_trade,
        min_options=min_options,
        max_options=max_options,
    )


class RecommendationRankingEngine:
    def rank(
        self,
        options: list[dict[str, Any]],
        *,
        force_no_trade: bool = False,
        min_options: int = MIN_OPTIONS,
        max_options: int = MAX_OPTIONS,
    ) -> list[dict[str, Any]]:
        scored = [self._normalize(o) for o in options]
        scored.sort(
            key=lambda o: (
                0 if (force_no_trade and o.get("recommendation_type") == "no_trade") else 1,
                -float(o.get("confidence_score") or 0),
                float(o.get("risk_score") or 1),
            )
        )
        # Deduplicate by type keeping highest rank
        seen: set[str] = set()
        unique: list[dict[str, Any]] = []
        for o in scored:
            key = str(o.get("recommendation_type") or o.get("type") or o.get("title"))
            if key in seen:
                continue
            seen.add(key)
            unique.append(o)

        while len(unique) < min_options:
            pad = self._next_pad(seen)
            unique.append(pad)
            seen.add(str(pad.get("recommendation_type")))

        ranked = unique[:max_options]
        for i, o in enumerate(ranked):
            o["rank"] = i + 1
            o["paper_only"] = True
            if "id" not in o or not o["id"]:
                o["id"] = str(uuid4())
        return ranked

    def _normalize(self, o: dict[str, Any]) -> dict[str, Any]:
        row = deepcopy(o)
        rtype = row.get("recommendation_type") or row.get("type") or "vwap_breakout"
        row["recommendation_type"] = rtype
        row["type"] = row.get("type") or rtype
        row["confidence_score"] = float(row.get("confidence_score") or 0.5)
        row["risk_score"] = float(row.get("risk_score") or 0.5)
        row["paper_only"] = True
        row.setdefault("warnings", [])
        row.setdefault("actions", ["convert_to_algo", "paper_test", "save"])
        return row

    def _next_pad(self, seen: set[str]) -> dict[str, Any]:
        for tmpl in _PAD_TEMPLATES:
            key = str(tmpl["recommendation_type"])
            if key not in seen:
                row = deepcopy(tmpl)
                row["id"] = str(uuid4())
                return row
        row = deepcopy(_PAD_TEMPLATES[0])
        row["id"] = str(uuid4())
        row["title"] = f"{row['title']} ({row['id'][:6]})"
        row["recommendation_type"] = f"{row['recommendation_type']}_{row['id'][:6]}"
        row["type"] = row["recommendation_type"]
        return row
