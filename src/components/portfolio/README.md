# SENSEX & Multi-Account Portfolio

Institutional multi-account portfolio surface for BSE SENSEX context, NSE books, and cross-broker aggregation.

## Integration

This app uses **section routing** inside `App.tsx` (Vite + React), not a Next.js `/portfolio` path.

**Already wired:** Sidebar → **Portfolio** opens `SensexMultiAccountPortfolioPage` in window id `sensex-multi-account-portfolio`.

```tsx
import { SensexMultiAccountPortfolioPage } from '@/components/portfolio';
```

Ensure the tree is under `QueryProvider` (`@tanstack/react-query`) — already provided in `main.tsx`.

## Mock vs live backend

| Layer | Current | Live swap |
| --- | --- | --- |
| `api.ts` → `portfolioApi` | `mockPortfolioService` (demo delays + fixtures) | Replace export with HTTP adapters implementing `PortfolioService` |
| `realtime.ts` | Polling fallback (`createDefaultRealtimeTransport`) | `WebSocketRealtimeTransport` or SSE when streams exist |
| Market quotes / session | Always labeled **DEMO** via `FreshnessBadge` | Still require explicit freshness from backend — never invent LIVE |

Do not hardcode live lot sizes, expiries, or strikes in the UI. Contracts come from `getDerivativeContracts`; missing metadata shows as **from instrument master** / **UNAVAILABLE**.

## Data rules

- Aggregate positions only for identical contracts (`aggregatePositions`) — BSE and NSE stay separate.
- Order submit in LIVE mode requires typing `Confirm live order`.
- Kill switch requires typing `KILL SWITCH`.
- Cancel / kill responses must not claim broker confirmation until the adapter says so.

## Tests

```bash
npm test -- src/components/portfolio/__tests__/format-calc.test.ts
```
