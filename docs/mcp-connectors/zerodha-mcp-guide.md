# Zerodha Kite Connect Provider Guide

| Field | Value |
|-------|-------|
| provider_id | `zerodha` |
| adapter | `ZerodhaMCPProvider` |
| auth | api_key, api_secret, redirect_url → request_token → access_token |
| status | placeholder until OAuth session wired |

Without credentials, `connect()` / `health_check()` return `not_configured` gracefully.

Enable: `MCP_ENABLE_ZERODHA=true`  
Env: `ZERODHA_API_KEY`, `ZERODHA_API_SECRET`, `ZERODHA_REDIRECT_URL`

Symbol style: Kite `NSE:RELIANCE`. Status map uses Kite strings (`COMPLETE` → `FILLED`).
