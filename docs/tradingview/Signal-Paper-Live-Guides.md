# Signal Validation & Paper / Live Guides

## Signal Validation Guide

Checks: symbol, side, freshness (ingest), ownership, kill/no-trade policy.
Status becomes `VALIDATED` or `REJECTED`.

## Paper Trading Flow Guide

1. Signal in inbox
2. **Paper test** → OMS paper order (`source=TRADINGVIEW`)
3. No live broker call
4. Result on `paper_test_requests`

## Live Trading Approval Guide

`POST /signals/:id/request-live-approval` always returns blocked while:

- live trading disabled (default)
- stop-loss missing
- RMS / kill switch / risk onboarding incomplete

Live never executes from the webhook path.
