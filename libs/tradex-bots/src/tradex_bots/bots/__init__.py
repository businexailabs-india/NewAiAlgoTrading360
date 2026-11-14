"""Multi-bot strategy registry."""

from __future__ import annotations

from tradex_bots.bots.base import BotStrategy, Features, GuardState
from tradex_bots.bots.bot01 import Bot01VwapEmaVolume
from tradex_bots.bots.bot02 import Bot02OpeningRangeBreakout
from tradex_bots.bots.bot03 import Bot03EmaCrossover
from tradex_bots.bots.bot04 import Bot04RsiMeanReversion
from tradex_bots.bots.bot05 import Bot05SupertrendAdx
from tradex_bots.bots.bot06 import Bot06VwapPullbackVolume

BOT_REGISTRY: dict[str, type[BotStrategy]] = {
    cls.bot_id: cls
    for cls in (
        Bot01VwapEmaVolume, Bot02OpeningRangeBreakout, Bot03EmaCrossover,
        Bot04RsiMeanReversion, Bot05SupertrendAdx, Bot06VwapPullbackVolume,
    )
}


def create_bot(bot_id: str, params: dict | None = None) -> BotStrategy:
    if bot_id not in BOT_REGISTRY:
        raise KeyError(f"unknown bot_id {bot_id}")
    return BOT_REGISTRY[bot_id](params)


def ensure_bots(store, tenant_id: str, account_id: str, actor: str = "system") -> int:
    """Register the six bots for an account (PAPER, STOPPED, live_enabled=0). Idempotent; never enables live."""
    import json

    from tradex_bots.timeutil import now_ist

    n = 0
    with store.tx() as c:
        for bot_id, cls in BOT_REGISTRY.items():
            d = cls(None).describe()
            cur = c.execute(
                "INSERT OR IGNORE INTO algo_bots(tenant_id,account_id,bot_id,name,strategy_type,status,"
                "execution_mode,live_enabled,version,config_json,config_hash,updated_at,updated_by) "
                "VALUES(?,?,?,?,?,'STOPPED','PAPER',0,?,?,?,?,?)",
                (tenant_id, account_id, bot_id, d["name"], d["strategy_type"], d["version"],
                 json.dumps(d["params"]), d["config_hash"], now_ist().isoformat(), actor))
            n += cur.rowcount
    return n


__all__ = ["BotStrategy", "Features", "GuardState", "BOT_REGISTRY", "create_bot", "ensure_bots"]
