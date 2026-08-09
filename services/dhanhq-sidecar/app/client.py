"""Thin wrapper around official dhanhq SDK with safe fallbacks."""

from __future__ import annotations

import os
from typing import Any, Optional


def credentials_from_env() -> tuple[str, str]:
    return os.getenv("DHAN_CLIENT_ID", "").strip(), os.getenv("DHAN_ACCESS_TOKEN", "").strip()


class DhanHqClient:
    def __init__(self, client_id: str, access_token: str) -> None:
        from dhanhq import DhanContext, dhanhq

        self.client_id = client_id
        self.access_token = access_token
        self._ctx = DhanContext(client_id, access_token)
        self._dhan = dhanhq(self._ctx)

    def _call(self, fn_name: str, *args: Any, **kwargs: Any) -> Any:
        fn = getattr(self._dhan, fn_name, None)
        if fn is None:
            raise AttributeError(f"dhanhq has no method {fn_name}")
        return fn(*args, **kwargs)

    def user_profile(self) -> Any:
        try:
            from dhanhq import DhanLogin

            return DhanLogin(self.client_id).user_profile(self.access_token)
        except Exception:
            return {"note": "user_profile via DhanLogin unavailable; try funds as health check"}

    def fund_limits(self) -> Any:
        return self._call("get_fund_limits")

    def holdings(self) -> Any:
        return self._call("get_holdings")

    def positions(self) -> Any:
        return self._call("get_positions")

    def orders(self) -> Any:
        return self._call("get_order_list")

    def ohlc_data(self, securities: dict[str, list[int]]) -> Any:
        return self._call("ohlc_data", securities=securities)

    def option_chain(
        self, under_security_id: int, under_exchange_segment: str, expiry: str
    ) -> Any:
        return self._call(
            "option_chain",
            under_security_id=under_security_id,
            under_exchange_segment=under_exchange_segment,
            expiry=expiry,
        )

    def expiry_list(self, under_security_id: int, under_exchange_segment: str) -> Any:
        return self._call(
            "expiry_list",
            under_security_id=under_security_id,
            under_exchange_segment=under_exchange_segment,
        )

    def historical_daily_data(
        self,
        security_id: str,
        exchange_segment: str,
        instrument_type: str,
        from_date: str,
        to_date: str,
    ) -> Any:
        return self._call(
            "historical_daily_data",
            security_id,
            exchange_segment,
            instrument_type,
            from_date,
            to_date,
        )

    def intraday_minute_data(
        self,
        security_id: str,
        exchange_segment: str,
        instrument_type: str,
        from_date: str,
        to_date: str,
    ) -> Any:
        return self._call(
            "intraday_minute_data",
            security_id,
            exchange_segment,
            instrument_type,
            from_date,
            to_date,
        )

    def place_order(
        self,
        security_id: str,
        exchange_segment: str,
        transaction_type: str,
        quantity: int,
        order_type: str,
        product_type: str,
        price: float = 0,
        trigger_price: float = 0,
        validity: str = "DAY",
    ) -> Any:
        dhan = self._dhan
        seg = getattr(dhan, exchange_segment, exchange_segment)
        txn = getattr(dhan, transaction_type, transaction_type)
        otype = getattr(dhan, order_type, order_type)
        ptype = getattr(dhan, product_type, product_type)
        valid = getattr(dhan, validity, validity)
        return dhan.place_order(
            security_id=str(security_id),
            exchange_segment=seg,
            transaction_type=txn,
            quantity=quantity,
            order_type=otype,
            product_type=ptype,
            price=price,
            trigger_price=trigger_price,
            validity=valid,
        )

    def security_list(self, mode: str = "compact") -> Any:
        return self._call("fetch_security_list", mode)
