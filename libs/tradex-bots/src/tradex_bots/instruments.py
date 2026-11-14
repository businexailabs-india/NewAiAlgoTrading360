"""Instrument metadata, tick-size handling and Dhan scrip-master parsing."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from decimal import ROUND_CEILING, ROUND_FLOOR, ROUND_HALF_UP, Decimal

# Curated seed universe (symbols only; security IDs must come from the synced instrument master).
# Index membership changes - review before use. Penny/illiquid/circuit-prone names are intentionally absent.
CURATED_UNIVERSE: tuple[str, ...] = (
    "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "SBIN", "BHARTIARTL", "ITC", "LT", "HINDUNILVR",
    "AXISBANK", "KOTAKBANK", "MARUTI", "SUNPHARMA", "TATAMOTORS", "NTPC", "POWERGRID", "ONGC",
    "TITAN", "ULTRACEMCO", "BAJFINANCE", "ASIANPAINT", "WIPRO", "HCLTECH", "TECHM", "COALINDIA",
    "TATASTEEL", "JSWSTEEL", "ADANIPORTS", "GRASIM",
)


def round_to_tick(price: float, tick: float, mode: str = "nearest") -> float:
    """Round to a valid tick. mode: 'nearest' | 'down' | 'up'. Decimal arithmetic avoids float drift."""
    if tick <= 0:
        raise ValueError("tick must be > 0")
    p, t = Decimal(str(price)), Decimal(str(tick))
    n = p / t
    rounding = {"nearest": ROUND_HALF_UP, "down": ROUND_FLOOR, "up": ROUND_CEILING}[mode]
    q = n.quantize(Decimal(1), rounding=rounding)
    return float((q * t).quantize(Decimal("0.0001")))


@dataclass(frozen=True)
class Instrument:
    symbol: str
    security_id: str
    exchange_segment: str = "NSE_EQ"
    tick_size: float = 0.05
    lot_size: int = 1
    series: str = "EQ"
    isin: str | None = None
    asm_gsm_flag: str = "N"
    buy_sell_allowed: bool = True

    def validate(self) -> list[str]:
        problems: list[str] = []
        if not self.security_id:
            problems.append("missing_security_id")
        if self.tick_size <= 0:
            problems.append("invalid_tick_size")
        if self.series.upper() != "EQ":
            problems.append(f"series_not_eq:{self.series}")
        if self.asm_gsm_flag.upper() == "Y":
            problems.append("asm_gsm_listed")
        if not self.buy_sell_allowed:
            problems.append("buy_sell_not_allowed")
        if self.lot_size != 1:
            problems.append("lot_size_not_1")
        return problems


def normalize_tick_size(raw: float) -> float:
    """ASSUMPTION (verify against the live scrip master): values >= 1 are expressed in paise (5.0 => 0.05)."""
    return round(raw / 100.0, 4) if raw >= 1.0 else raw


_COL_ALIASES = {
    "exch": ("SEM_EXM_EXCH_ID", "EXCH_ID"),
    "segment": ("SEM_SEGMENT", "SEGMENT"),
    "security_id": ("SEM_SMST_SECURITY_ID", "SECURITY_ID"),
    "instrument": ("SEM_INSTRUMENT_NAME", "INSTRUMENT"),
    "symbol": ("SEM_TRADING_SYMBOL", "UNDERLYING_SYMBOL", "SYMBOL_NAME"),
    "lot": ("SEM_LOT_UNITS", "LOT_SIZE"),
    "tick": ("SEM_TICK_SIZE", "TICK_SIZE"),
    "series": ("SEM_SERIES", "SERIES"),
    "isin": ("ISIN",),
    "asm": ("ASM_GSM_FLAG",),
    "bs": ("BUY_SELL_INDICATOR",),
}


def _col(row: dict[str, str], key: str) -> str:
    for name in _COL_ALIASES[key]:
        if name in row and row[name] is not None:
            return row[name].strip()
    return ""


def parse_scrip_master(csv_text: str, symbols: set[str] | None = None) -> dict[str, Instrument]:
    """Parse Dhan compact/detailed scrip master into NSE equity instruments keyed by symbol."""
    reader = csv.DictReader(io.StringIO(csv_text))
    out: dict[str, Instrument] = {}
    for row in reader:
        if _col(row, "exch") != "NSE" or _col(row, "segment") != "E":
            continue
        if _col(row, "instrument") not in ("EQUITY", ""):
            continue
        series = _col(row, "series") or "EQ"
        if series.upper() != "EQ":
            continue
        sym = _col(row, "symbol").upper()
        if not sym or (symbols and sym not in symbols):
            continue
        try:
            tick = normalize_tick_size(float(_col(row, "tick") or 0))
            lot = int(float(_col(row, "lot") or 1))
        except ValueError:
            continue
        out[sym] = Instrument(
            symbol=sym,
            security_id=_col(row, "security_id"),
            tick_size=tick,
            lot_size=lot,
            series=series,
            isin=_col(row, "isin") or None,
            asm_gsm_flag=_col(row, "asm") or "N",
            buy_sell_allowed=(_col(row, "bs") or "A").upper() == "A",
        )
    return out
