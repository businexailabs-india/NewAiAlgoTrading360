# Pine Alert Payload Guide

## Standard

```json
{
  "secret": "USER_WEBHOOK_SECRET",
  "strategy_id": "strat_123",
  "symbol": "{{ticker}}",
  "exchange": "{{exchange}}",
  "timeframe": "{{interval}}",
  "side": "BUY",
  "signal_type": "VWAP_BREAKOUT",
  "price": "{{close}}",
  "quantity": 1,
  "stop_loss": 0,
  "target": 0,
  "timestamp": "{{time}}"
}
```

## Simple

```json
{ "secret": "USER_WEBHOOK_SECRET", "symbol": "RELIANCE", "side": "BUY" }
```

## Natural

```json
{ "secret": "USER_WEBHOOK_SECRET", "message": "BUY RELIANCE VWAP breakout 5m" }
```

Use Payload Builder in the UI for BUY / SELL / EXIT / STOP_LOSS / OPTIONS / MULTI_ACCOUNT samples.
