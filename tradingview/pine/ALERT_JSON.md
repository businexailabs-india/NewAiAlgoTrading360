# TradingView ORB alert JSON & validation

## Alert payload (schema 1.0)

Backend endpoint: `POST /api/v1/webhooks/tradingview/{endpointToken}`

```json
{
  "schema_version": "1.0",
  "secret": "<webhook secret>",
  "strategy_id": "orb-v1",
  "signal_id": "SPY-15-<bar_time>-long",
  "event": "entry_signal",
  "symbol": "SPY",
  "exchange": "AMEX",
  "timeframe": "15",
  "bar_time": "2024-06-03T10:15:00-04:00",
  "side": "buy",
  "reference_price": 500.0,
  "opening_range_high": 499.0,
  "opening_range_low": 497.0,
  "vwap": 498.0,
  "ema": 497.5,
  "atr": 1.2,
  "stop_price": 498.8,
  "target_price": 501.8,
  "timestamp": 1717421700000
}
```

**Server never trusts** stop, target, quantity, or unchecked timestamps from the alert — it recalculates risk and size.

Replace `REPLACE_SECRET` / `{{secret}}` in Pine with your one-time secret from Market Analytics → TradingView Setup.

## Manual Pine validation checklist

- [ ] Signals only on confirmed bars (`barstate.isconfirmed` / `process_orders_on_close`)
- [ ] No repainting when scrolling history
- [ ] No signal before opening range completes
- [ ] One valid breakout produces one label
- [ ] Duplicate breakout same day blocked
- [ ] Session / day reset clears OR levels
- [ ] Strategy tester commission + slippage inputs applied
- [ ] Alert JSON parses; webhook accepts once; duplicate rejected
- [ ] Understand: TV Strategy Tester ≠ broker paper ≠ live
