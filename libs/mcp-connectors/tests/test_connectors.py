import pytest

from mcp_connectors import get_connector


@pytest.mark.asyncio
async def test_execute_disabled():
    conn = get_connector("mock")
    with pytest.raises(PermissionError):
        await conn.execute_order_disabled_by_default({"symbol": "RELIANCE", "qty": 1})


@pytest.mark.asyncio
async def test_placeholder_not_configured():
    conn = get_connector("zerodha")
    health = await conn.health_check()
    assert health["status"] == "not_configured"
