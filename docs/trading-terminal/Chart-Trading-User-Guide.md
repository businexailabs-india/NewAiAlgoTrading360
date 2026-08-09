# Chart Trading User Guide

Chart actions (Buy, Sell, Add Qty, Reduce Qty, Exit Qty, Exit Full) never execute live on click.

Flow: **Preview → User confirm → RMS → OMS → Paper broker** (default).

Live remains locked unless `LIVE_TRADING_ENABLED=true` and TradingControl gates pass.

Open a watchlist chart or **Trade → Trading Terminal → chart** tab.
