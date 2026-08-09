# multi-account-allocation-service

Parent signal → child order intents:

- `TradingViewConnectService.allocateSignal`
- Tables: `parent_signals`, `child_order_intents`
- APIs: `POST /api/signals/:id/allocate`, `GET /api/signals/:id/child-orders`
