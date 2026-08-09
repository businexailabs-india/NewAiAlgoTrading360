from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from ibkr_orb_paper.config import Settings
from ibkr_orb_paper.domain.models import (
    Bar,
    PortfolioSnapshot,
    SignalDecision,
    SignalResult,
)
from ibkr_orb_paper.indicators.service import IndicatorService, round_to_tick
from ibkr_orb_paper.sizing.position_sizer import PositionSizer


class OpeningRangeBreakoutStrategy:
    """Long-only regime-filtered ORB. Modular for future shorts/other strategies."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.indicators = IndicatorService()
        self.sizer = PositionSizer(settings)
        self._traded_breakouts: set[str] = set()

    def mark_breakout_traded(self, key: str) -> None:
        self._traded_breakouts.add(key)

    def has_traded_breakout(self, key: str) -> bool:
        return key in self._traded_breakouts

    def evaluate(
        self,
        bars: list[Bar],
        *,
        portfolio: PortfolioSnapshot,
        has_position: bool,
        has_active_entry: bool,
        min_tick: float | None = None,
    ) -> SignalResult:
        settings = self.settings
        tick = min_tick if min_tick is not None else settings.min_tick
        symbol = settings.symbol

        completed = [b for b in bars if b.complete]
        if not completed:
            return SignalResult(SignalDecision.REJECT, symbol, datetime.now(ZoneInfo(settings.market_timezone)), reasons=["no completed bars"])

        last = completed[-1]
        snap = self.indicators.compute_with_prior_avg_volume(
            completed,
            ema_period=settings.ema_period,
            atr_period=settings.atr_period,
            volume_lookback=settings.volume_lookback,
            opening_range_minutes=settings.opening_range_minutes,
            bar_size=settings.bar_size,
            market_timezone=settings.market_timezone,
        )
        if snap is None:
            return SignalResult(SignalDecision.REJECT, symbol, last.ts, reasons=["insufficient indicator history"])

        reasons: list[str] = []
        if not snap.opening_range_complete:
            reasons.append("opening range incomplete")
        if last.close <= snap.opening_range_high:
            reasons.append("close not above opening-range high")
        if last.close <= snap.vwap:
            reasons.append("price not above VWAP")
        if last.close <= snap.ema:
            reasons.append("price not above EMA")
        if snap.ema_slope <= 0:
            reasons.append("EMA slope not positive")
        if last.volume < settings.volume_multiplier * snap.avg_volume:
            reasons.append("volume filter failed")
        if has_position:
            reasons.append("already in position")
        if has_active_entry:
            reasons.append("active entry order exists")
        if settings.allow_shorts is False:
            pass  # long-only

        breakout_key = f"{symbol}:{last.ts.astimezone(ZoneInfo(settings.market_timezone)).date()}:{snap.opening_range_high:.4f}"
        if self.has_traded_breakout(breakout_key):
            reasons.append("duplicate breakout already traded")

        if reasons:
            return SignalResult(
                SignalDecision.REJECT,
                symbol,
                last.ts,
                reasons=reasons,
                indicators=snap,
                breakout_key=breakout_key,
            )

        # Stops
        atr_stop = last.close - settings.atr_stop_multiple * snap.atr
        structural = last.low if settings.use_structural_stop else atr_stop
        # tighter stop = higher stop price for long
        stop_price = max(atr_stop, structural) if settings.use_structural_stop else atr_stop
        min_dist = last.close * settings.min_stop_distance_pct
        stop_distance = last.close - stop_price
        if stop_distance < min_dist:
            stop_price = last.close - min_dist
            stop_distance = min_dist
        if stop_distance <= 0:
            return SignalResult(
                SignalDecision.REJECT,
                symbol,
                last.ts,
                reasons=["invalid stop distance"],
                indicators=snap,
                breakout_key=breakout_key,
            )

        entry = round_to_tick(last.close + settings.limit_entry_offset_ticks * tick, tick, "up")
        stop_price = round_to_tick(stop_price, tick, "down")
        stop_distance = entry - stop_price
        target = round_to_tick(entry + settings.reward_risk_ratio * stop_distance, tick, "nearest")

        sized = self.sizer.size(
            entry_price=entry,
            stop_distance=stop_distance,
            portfolio=portfolio,
            min_tick=tick,
        )
        if sized.quantity <= 0:
            return SignalResult(
                SignalDecision.REJECT,
                symbol,
                last.ts,
                entry_price=entry,
                stop_price=stop_price,
                target_price=target,
                stop_distance=stop_distance,
                quantity=0,
                reasons=[sized.rejection or "zero quantity"],
                indicators=snap,
                breakout_key=breakout_key,
            )

        return SignalResult(
            SignalDecision.BUY,
            symbol,
            last.ts,
            entry_price=entry,
            stop_price=stop_price,
            target_price=target,
            stop_distance=stop_distance,
            quantity=sized.quantity,
            reasons=["valid long ORB breakout"],
            indicators=snap,
            breakout_key=breakout_key,
        )
