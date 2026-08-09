from __future__ import annotations

from uuid import uuid4

from ibkr_orb_paper.domain.models import BracketOrderSpec, SignalResult


def build_bracket_spec(
    signal: SignalResult,
    *,
    account_id: str,
    strategy_id: str,
) -> BracketOrderSpec:
    if signal.entry_price is None or signal.stop_price is None or signal.target_price is None:
        raise ValueError("signal missing prices")
    if signal.quantity <= 0:
        raise ValueError("signal quantity must be positive")
    oca = f"{strategy_id}-{uuid4().hex[:10]}"
    return BracketOrderSpec(
        strategy_id=strategy_id,
        symbol=signal.symbol,
        account_id=account_id,
        quantity=signal.quantity,
        entry_limit=float(signal.entry_price),
        stop_price=float(signal.stop_price),
        target_price=float(signal.target_price),
        tif="DAY",
        outside_rth=False,
        oca_group=oca,
        meta={"signal_id": signal.signal_id, "breakout_key": signal.breakout_key},
    )


def build_ib_bracket_dicts(
    spec: BracketOrderSpec,
    parent_id: int,
    stop_id: int,
    target_id: int,
) -> list[dict]:
    """
    Validate parent/child relationships and transmit sequence without ibapi dependency.

    Transmit sequence:
      parent transmit=False
      stop transmit=False
      target transmit=True  (releases the bracket)
    Children reference parentId; exits share OCA group.
    """
    if parent_id <= 0 or stop_id <= 0 or target_id <= 0:
        raise ValueError("invalid order ids")
    if len({parent_id, stop_id, target_id}) != 3:
        raise ValueError("order ids must be unique")
    parent = {
        "orderId": parent_id,
        "action": "BUY",
        "orderType": "LMT",
        "totalQuantity": spec.quantity,
        "lmtPrice": spec.entry_limit,
        "tif": spec.tif,
        "outsideRth": spec.outside_rth,
        "transmit": False,
        "parentId": 0,
        "account": spec.account_id,
        "orderRef": spec.strategy_id,
    }
    stop = {
        "orderId": stop_id,
        "action": "SELL",
        "orderType": "STP",
        "totalQuantity": spec.quantity,
        "auxPrice": spec.stop_price,
        "tif": spec.tif,
        "outsideRth": spec.outside_rth,
        "transmit": False,
        "parentId": parent_id,
        "ocaGroup": spec.oca_group,
        "account": spec.account_id,
        "orderRef": spec.strategy_id,
    }
    target = {
        "orderId": target_id,
        "action": "SELL",
        "orderType": "LMT",
        "totalQuantity": spec.quantity,
        "lmtPrice": spec.target_price,
        "tif": spec.tif,
        "outsideRth": spec.outside_rth,
        "transmit": True,
        "parentId": parent_id,
        "ocaGroup": spec.oca_group,
        "account": spec.account_id,
        "orderRef": spec.strategy_id,
    }
    return [parent, stop, target]


def validate_bracket_sequence(orders: list[dict]) -> None:
    if len(orders) != 3:
        raise ValueError("bracket must have 3 orders")
    parent, stop, target = orders
    if parent["transmit"] is not False:
        raise ValueError("parent must transmit=False")
    if stop["transmit"] is not False:
        raise ValueError("stop must transmit=False")
    if target["transmit"] is not True:
        raise ValueError("target must transmit=True")
    if stop["parentId"] != parent["orderId"] or target["parentId"] != parent["orderId"]:
        raise ValueError("children must reference parentId")
    if stop.get("ocaGroup") != target.get("ocaGroup"):
        raise ValueError("exit orders must share OCA group")
