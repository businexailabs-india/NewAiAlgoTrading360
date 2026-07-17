"""Deterministic market regime + advisory signal engine (no LLM)."""

from __future__ import annotations

from typing import Any

from advisory_core.contracts import MarketRegime


def _sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def _rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) <= period:
        return None
    gains = []
    losses = []
    for i in range(-period, 0):
        diff = closes[i] - closes[i - 1]
        gains.append(max(diff, 0))
        losses.append(max(-diff, 0))
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _atr(bars: list[dict[str, Any]], period: int = 14) -> float | None:
    if len(bars) < period + 1:
        return None
    trs = []
    for i in range(-period, 0):
        h = float(bars[i]["high"])
        l = float(bars[i]["low"])
        pc = float(bars[i - 1]["close"])
        trs.append(max(h - l, abs(h - pc), abs(l - pc)))
    return sum(trs) / period


class MarketRegimeDetector:
    def detect(self, bars: list[dict[str, Any]], extras: dict[str, Any] | None = None) -> MarketRegime:
        extras = extras or {}
        if not bars or len(bars) < 20:
            return MarketRegime(
                trend="unknown",
                volatility="moderate",
                risk_on=False,
                regime_label="insufficient_data",
                explanation="Not enough bars to detect regime. Prefer no-trade / paper-only.",
            )

        closes = [float(b["close"]) for b in bars]
        volumes = [float(b.get("volume") or 0) for b in bars]
        sma_fast = _sma(closes, 9)
        sma_slow = _sma(closes, 21)
        rsi = _rsi(closes)
        atr = _atr(bars)
        last = closes[-1]
        prev = closes[-2]
        gap_pct = ((last - prev) / prev * 100) if prev else 0

        if sma_fast and sma_slow:
            trend = "bullish" if sma_fast > sma_slow else "bearish" if sma_fast < sma_slow else "sideways"
        else:
            trend = "unknown"

        vol_ratio = 0.0
        if atr and last:
            vol_ratio = (atr / last) * 100
        if vol_ratio >= 3.5:
            volatility = "extreme"
        elif vol_ratio >= 2.0:
            volatility = "high"
        elif vol_ratio >= 1.0:
            volatility = "moderate"
        else:
            volatility = "low"

        avg_vol = sum(volumes[-20:]) / 20 if volumes else 0
        vol_anomaly = volumes[-1] > avg_vol * 1.8 if avg_vol else False
        risk_on = trend == "bullish" and volatility in ("low", "moderate")

        label = f"{trend}_{volatility}"
        rsi_txt = f"{rsi:.1f}" if rsi is not None else "n/a"
        return MarketRegime(
            trend=trend,  # type: ignore[arg-type]
            volatility=volatility,  # type: ignore[arg-type]
            risk_on=risk_on,
            regime_label=label,
            signals={
                "sma_fast": sma_fast,
                "sma_slow": sma_slow,
                "rsi": rsi,
                "atr": atr,
                "gap_pct": gap_pct,
                "volume_anomaly": vol_anomaly,
                "breadth": extras.get("breadth"),
                "sectors": extras.get("sectors"),
            },
            explanation=(
                f"Trend {trend}, volatility {volatility}. "
                f"RSI={rsi_txt}, gap={gap_pct:.2f}%."
            ),
        )


class MarketAdvisoryEngine:
    """Evaluate market conditions and suggest advisory option archetypes."""

    def __init__(self) -> None:
        self.detector = MarketRegimeDetector()

    def evaluate(
        self,
        bars: list[dict[str, Any]],
        market_status: str,
        broker_status: str,
        data_stale: bool,
        risk_profile_completed: bool,
        available_margin: float,
        extras: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        regime = self.detector.detect(bars, extras)
        guardrails: list[str] = []
        force_no_trade = False
        paper_only = True

        if data_stale:
            guardrails.append("Stale market data — no-trade advisory")
            force_no_trade = True
        if broker_status != "connected":
            guardrails.append("Broker disconnected — paper-only advisory")
            paper_only = True
        if not risk_profile_completed:
            guardrails.append("Risk profile incomplete — complete before live")
        if available_margin < 10000:
            guardrails.append("Insufficient margin — watchlist/paper-test only")
        if market_status in ("closed", "unknown"):
            guardrails.append("Market closed — backtest/paper-test advisory only")
            paper_only = True
        if regime.volatility in ("high", "extreme"):
            guardrails.append("High volatility — reduce size and tighten stops")

        option_types = []
        if force_no_trade:
            option_types = ["no_trade"]
        else:
            option_types = ["conservative_intraday", "vwap_breakout", "rsi_mean_reversion"]
            if regime.volatility in ("high", "extreme"):
                option_types.append("protective_put")
            else:
                option_types.append("aggressive_intraday")
            option_types.append("portfolio_rebalance")
            # Always include explicit no-trade alternative under elevated risk
            if regime.volatility in ("high", "extreme") or not risk_profile_completed:
                option_types.insert(0, "no_trade")

        return {
            "regime": regime,
            "guardrails": guardrails,
            "paper_only": paper_only,
            "force_no_trade": force_no_trade,
            "option_types": option_types[:5],
            "indicators": regime.signals,
        }
