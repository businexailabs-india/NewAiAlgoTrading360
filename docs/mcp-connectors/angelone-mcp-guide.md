# Angel One SmartAPI Provider Guide

| Field | Value |
|-------|-------|
| provider_id | `angelone` |
| adapter | `AngelOneMCPProvider` |
| auth | client_code, api_key, password/token, optional TOTP → JWT + feed_token |
| status | placeholder |

Returns `not_configured` until credentials and SmartAPI session are bound.

Enable: `MCP_ENABLE_ANGELONE=true`  
Env: `ANGELONE_API_KEY`, `ANGELONE_CLIENT_CODE`, `ANGELONE_TOTP_SECRET`

JWT/feed tokens must stay in SecretManager — never in DhanLaxmi prompts.
