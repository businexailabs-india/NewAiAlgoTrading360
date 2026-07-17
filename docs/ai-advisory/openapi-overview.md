# Advisory OpenAPI Overview

Primary public surface is the TypeScript gateway (`/api/*`). Python services are internal.

## Login advisory response

```json
{
  "advisory_id": "adv_123",
  "status": "ready",
  "generated_at": "2026-07-17T09:20:00+05:30",
  "market_status": "open",
  "broker_status": "connected",
  "risk_profile": "balanced",
  "summary": "Market is moderately volatile. Prefer controlled intraday strategies with strict stop-loss.",
  "recommendations": [
    {
      "id": "rec_1",
      "title": "VWAP Breakout Intraday Strategy",
      "type": "intraday",
      "symbols": ["NSE:RELIANCE", "NSE:TCS"],
      "confidence_score": 0.72,
      "risk_score": 0.48,
      "required_capital": 50000,
      "timeframe": "5m",
      "rationale": "Volume expansion with price trading above VWAP.",
      "warnings": ["Paper test required", "Avoid if spread widens"],
      "actions": ["convert_to_algo", "paper_test", "save"]
    }
  ]
}
```

Interactive OpenAPI: start each FastAPI service and open `/docs`.
