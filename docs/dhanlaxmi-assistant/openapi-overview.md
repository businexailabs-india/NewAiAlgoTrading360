# DhanLaxmi OpenAPI overview

Public surface is the TypeScript gateway (`/api/...`). Python services are internal-only and require HMAC service headers.

## Example chat request

```http
POST /api/dhanlaxmi/chat
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "message": "Reliance ke liye intraday algo banao",
  "language_hint": "hinglish",
  "mode": "web"
}
```

## Example response shape

```json
{
  "success": true,
  "data": {
    "conversation_id": "uuid",
    "language": "hinglish",
    "intent": "strategy_creation",
    "response_text": "...",
    "disclaimer": "...",
    "cards": [{ "type": "strategy_draft", "data": { "paper_only": true } }],
    "never_auto_executes": true,
    "paper_first": true
  }
}
```

## Example buy without auto-exec

User: `Buy 10 Reliance now` → intent routes to approval card; OMS is never called until explicit confirmation + RMS.
