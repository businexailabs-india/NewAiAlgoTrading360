# Trading Terminal API

| Method | Path |
|--------|------|
| GET | `/api/instruments/search?query=` |
| GET | `/api/instruments/:id` |
| GET | `/api/instruments/:id/tradability` |
| GET | `/api/instruments/:id/derivatives` |
| POST | `/api/orders/preview` |
| POST | `/api/orders/submit` |
| POST | `/api/orders/approve` |
| POST | `/api/orders/reject` |
| POST | `/api/baskets` … submit/cancel/duplicate |
| GET | `/api/chart/positions` |
| POST | `/api/chart/orders/add-quantity` |
| POST | `/api/chart/orders/reduce-quantity` |
| POST | `/api/chart/orders/exit-quantity` |
| POST | `/api/chart/orders/exit-full` |
| GET | `/api/trading-terminal/audits` |

Implementation: Express `TradingTerminalService` (Vite React FE). FastAPI folders under `/services/*` are README pointers.
