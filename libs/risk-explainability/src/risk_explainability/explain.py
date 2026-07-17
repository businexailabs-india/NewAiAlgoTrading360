from __future__ import annotations

from typing import Any

from advisory_core.contracts import MarketRegime, RiskProfile


class RiskExplainer:
    """Deterministic risk narrative — never promises returns."""

    DISCLAIMER = (
        "Risk explanations are illustrative and not guarantees. "
        "Losses can exceed estimates. Paper test before live use."
    )

    def explain(
        self,
        strategy: dict[str, Any],
        portfolio: dict[str, Any],
        regime: MarketRegime,
        risk_profile: RiskProfile,
    ) -> dict[str, Any]:
        risk_score = float(strategy.get("risk_score") or 0.5)
        factors = []
        if regime.volatility in ("high", "extreme"):
            factors.append(
                {
                    "factor": "volatility",
                    "impact": f"Market volatility regime is {regime.volatility}",
                    "severity": 80 if regime.volatility == "extreme" else 65,
                }
            )
            risk_score = min(1.0, risk_score + 0.15)
        if not risk_profile.completed:
            factors.append(
                {
                    "factor": "risk_profile_incomplete",
                    "impact": "Complete risk profile before live deployment",
                    "severity": 70,
                }
            )
        concentration = len(portfolio.get("holdings") or [])
        if concentration and concentration < 3:
            factors.append(
                {
                    "factor": "concentration",
                    "impact": "Portfolio is concentrated in few holdings",
                    "severity": 55,
                }
            )

        overall = "LOW" if risk_score < 0.35 else "MEDIUM" if risk_score < 0.65 else "HIGH"
        if regime.volatility == "extreme":
            overall = "CRITICAL"

        return {
            "overallRisk": overall,
            "score": round(risk_score * 100, 1),
            "factors": factors
            or [{"factor": "baseline", "impact": "Standard market risk applies", "severity": 40}],
            "mitigation": [
                "Use hard stop-loss",
                "Cap daily max loss",
                "Paper test before live",
                "Reduce size in high volatility",
            ],
            "narrative": (
                f"Strategy risk assessed as {overall} under {regime.regime_label} regime. "
                f"{self.DISCLAIMER}"
            ),
            "warnings": [
                "Not financial advice",
                "No guaranteed returns",
                "Live trading disabled by default",
            ],
        }
