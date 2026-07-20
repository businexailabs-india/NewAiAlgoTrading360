from mcp_connectors.base.auth_refresh import AuthFlowType, placeholder_refresh

AUTH_FLOW = AuthFlowType.API_KEY_TOKEN


async def refresh_auth(credentials_present: bool, refresh_token_present: bool = False):
    return await placeholder_refresh("mock_market_data", AUTH_FLOW, credentials_present=credentials_present)
