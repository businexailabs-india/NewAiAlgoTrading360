# TradingView Connect User Guide

TradingView Connect is the **primary** mass-market algo path in BusineXAi TradeOS360.

## Flow

1. Open **Strategies → TradingView Connect**
2. Create a webhook connection (copy URL + secret once)
3. In TradingView: create alert → webhook URL → paste JSON payload
4. Alerts arrive as **signals** (never live orders)
5. Validate → Paper test → Convert to strategy
6. Live requires approval + RMS + OMS (disabled by default)

QuantConnect / LEAN lives under **Quant Lab (optional)** only.
