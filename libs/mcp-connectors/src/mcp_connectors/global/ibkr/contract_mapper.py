"""Map TradeOS360 symbols ↔ IBKR Contract objects."""

from __future__ import annotations

from typing import Any

from .errors import IBKRContractNotFoundError
from .models import IBKRContract, IBKRContractRequest


# Mock contract catalog for paper/demo (no live IBKR required)
MOCK_CONTRACTS: dict[str, IBKRContract] = {
    "AAPL": IBKRContract(
        con_id=265598,
        symbol="AAPL",
        sec_type="STK",
        exchange="SMART",
        currency="USD",
        primary_exchange="NASDAQ",
        description="Apple Inc",
    ),
    "MSFT": IBKRContract(
        con_id=272093,
        symbol="MSFT",
        sec_type="STK",
        exchange="SMART",
        currency="USD",
        primary_exchange="NASDAQ",
        description="Microsoft Corp",
    ),
    "SPY": IBKRContract(
        con_id=756733,
        symbol="SPY",
        sec_type="STK",
        exchange="SMART",
        currency="USD",
        primary_exchange="ARCA",
        description="SPDR S&P 500 ETF",
    ),
    "EUR.USD": IBKRContract(
        con_id=12087792,
        symbol="EUR",
        sec_type="CASH",
        exchange="IDEALPRO",
        currency="USD",
        local_symbol="EUR.USD",
        description="EUR/USD forex placeholder",
    ),
}


def normalize_symbol(provider_symbol: str) -> str:
    s = (provider_symbol or "").strip().upper()
    if s.startswith("IBKR:"):
        s = s[5:]
    if s.startswith("SMART:"):
        s = s[6:]
    return s.replace(" ", "")


def denormalize_symbol(normalized_symbol: str) -> str:
    return f"IBKR:{normalize_symbol(normalized_symbol)}"


def to_contract_request(
    symbol: str,
    *,
    sec_type: str = "STK",
    exchange: str = "SMART",
    currency: str = "USD",
    **kwargs: Any,
) -> IBKRContractRequest:
    plain = normalize_symbol(symbol)
    st = (sec_type or "STK").upper()
    if st == "ETF":
        st = "STK"
    payload: dict[str, Any] = {
        "symbol": plain.split(".")[0] if st == "CASH" and "." in plain else plain,
        "sec_type": st if st in ("STK", "OPT", "FUT", "CASH", "BOND", "ETF") else "STK",
        "exchange": exchange or "SMART",
        "currency": currency or "USD",
    }
    if st == "CASH" and "." in plain:
        payload["symbol"] = plain.split(".")[0]
        payload["currency"] = plain.split(".")[-1]
        payload["local_symbol"] = plain
        payload["exchange"] = exchange or "IDEALPRO"
    for key in (
        "last_trade_date_or_contract_month",
        "strike",
        "right",
        "multiplier",
        "primary_exchange",
        "local_symbol",
        "con_id",
    ):
        if kwargs.get(key) is not None:
            payload[key] = kwargs[key]
    return IBKRContractRequest.model_validate(payload)


def stock_contract(symbol: str, currency: str = "USD", exchange: str = "SMART") -> IBKRContract:
    req = to_contract_request(symbol, sec_type="STK", currency=currency, exchange=exchange)
    return resolve_mock_contract(req)


def option_contract(
    symbol: str,
    *,
    expiry: str,
    strike: float,
    right: str,
    currency: str = "USD",
    exchange: str = "SMART",
    multiplier: str = "100",
) -> IBKRContract:
    r = (right or "C").upper()
    if r not in ("C", "P"):
        r = "C"
    return IBKRContract(
        symbol=normalize_symbol(symbol),
        sec_type="OPT",
        exchange=exchange,
        currency=currency,
        last_trade_date_or_contract_month=expiry,
        strike=float(strike),
        right=r,  # type: ignore[arg-type]
        multiplier=multiplier,
        description=f"{normalize_symbol(symbol)} {expiry} {strike}{r}",
    )


def resolve_mock_contract(req: IBKRContractRequest) -> IBKRContract:
    key = normalize_symbol(req.local_symbol or req.symbol)
    if req.sec_type == "OPT":
        if not req.last_trade_date_or_contract_month or req.strike is None or not req.right:
            raise IBKRContractNotFoundError("Option contract requires expiry, strike, and right")
        return option_contract(
            req.symbol,
            expiry=req.last_trade_date_or_contract_month,
            strike=req.strike,
            right=req.right,
            currency=req.currency,
            exchange=req.exchange,
            multiplier=req.multiplier or "100",
        )
    if req.sec_type in ("FUT", "BOND"):
        # Placeholder mapping — structure only until live contract details wired
        return IBKRContract(
            symbol=req.symbol,
            sec_type=req.sec_type,
            exchange=req.exchange,
            currency=req.currency,
            last_trade_date_or_contract_month=req.last_trade_date_or_contract_month,
            description=f"{req.sec_type} placeholder for {req.symbol}",
        )
    if key in MOCK_CONTRACTS:
        c = MOCK_CONTRACTS[key]
        return c.model_copy(
            update={
                "exchange": req.exchange or c.exchange,
                "currency": req.currency or c.currency,
            }
        )
    # Generic US equity placeholder for search/preview
    if req.sec_type in ("STK", "ETF") and key.isalpha() and 1 <= len(key) <= 5:
        return IBKRContract(
            symbol=key,
            sec_type="STK",
            exchange=req.exchange or "SMART",
            currency=req.currency or "USD",
            description=f"{key} (unresolved — request_contract_details required)",
        )
    raise IBKRContractNotFoundError(f"Contract not found: {key}")


def search_mock_contracts(query: str) -> list[IBKRContract]:
    q = normalize_symbol(query)
    if not q:
        return []
    hits = [c for k, c in MOCK_CONTRACTS.items() if q in k or q in (c.description or "").upper()]
    if not hits and q.isalpha() and 1 <= len(q) <= 5:
        hits = [resolve_mock_contract(to_contract_request(q))]
    return hits


def contract_to_ibapi_dict(contract: IBKRContract) -> dict[str, Any]:
    """Shape compatible with ibapi Contract fields (no ibapi import required)."""
    return {
        "conId": contract.con_id or 0,
        "symbol": contract.symbol,
        "secType": contract.sec_type,
        "exchange": contract.exchange,
        "currency": contract.currency,
        "localSymbol": contract.local_symbol or "",
        "primaryExchange": contract.primary_exchange or "",
        "lastTradeDateOrContractMonth": contract.last_trade_date_or_contract_month or "",
        "strike": contract.strike or 0.0,
        "right": contract.right or "",
        "multiplier": contract.multiplier or "",
    }
