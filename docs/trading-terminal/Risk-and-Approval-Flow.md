# Risk and Approval Flow

1. Order preview created (audited).
2. Paper: may submit after preview allowed.
3. Live: requires stop-loss, `LIVE_TRADING_ENABLED`, TradingControl live+approval, kill switch off.
4. Basket: leg + basket risk, then approve, then OMS child orders.
5. Chart add blocked on kill switch; exits allowed when policy permits.
