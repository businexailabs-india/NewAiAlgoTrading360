# TradingView Signal Flow

Webhook → NormalizedSignal → ExecutionIntent(source=TRADINGVIEW_ALERT) → evaluate → SIGNAL_ACCEPTED, can_execute_directly=false → approval/RMS → OMS only.
