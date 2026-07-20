import { Check, Lock, Minus, CircleDashed, CreditCard, ShieldCheck } from 'lucide-react';
import type { McpProvider } from '@/api/mcpProviders';
import { cn } from '@/components/ui/utils';

export const MATRIX_COLUMNS = [
  'account_profile',
  'margins',
  'holdings',
  'positions',
  'orders',
  'trades',
  'live_quotes',
  'websocket_feed',
  'historical_data',
  'option_chain',
  'greeks',
  'order_preview',
  'paper_execution',
  'live_execution',
  'market_depth',
  'news',
  'corporate_actions',
] as const;

export type MatrixStatus =
  | 'supported'
  | 'not_supported'
  | 'placeholder'
  | 'locked'
  | 'requires_subscription'
  | 'requires_approval';

function resolveStatus(provider: McpProvider, col: string): MatrixStatus {
  const caps = (provider.capabilities || []).map((c) => c.toLowerCase());
  const status = (provider.status || '').toLowerCase();
  const type = (provider.provider_type || '').toLowerCase();

  if (col === 'live_execution') {
    if (provider.live_trading_default) return 'requires_approval';
    return 'locked';
  }
  if (status.includes('placeholder') || type.includes('placeholder') || type.includes('direct')) {
    return 'placeholder';
  }
  const aliases: Record<string, string[]> = {
    account_profile: ['profile', 'account'],
    margins: ['margin'],
    holdings: ['holding'],
    positions: ['position'],
    orders: ['order'],
    trades: ['trade'],
    live_quotes: ['quote', 'ltp', 'live_quote'],
    websocket_feed: ['websocket', 'ws', 'tick'],
    historical_data: ['historical', 'ohlc', 'candle'],
    option_chain: ['option', 'chain'],
    greeks: ['greek'],
    order_preview: ['preview'],
    paper_execution: ['paper'],
    market_depth: ['depth', 'market_depth'],
    news: ['news'],
    corporate_actions: ['corporate'],
  };
  const keys = aliases[col] || [col];
  const hit = caps.some((c) => keys.some((k) => c.includes(k)));
  if (hit) {
    if (col.includes('live') && type.includes('data')) return 'requires_subscription';
    return 'supported';
  }
  if (provider.paper_trading_default && col === 'paper_execution') return 'supported';
  return 'not_supported';
}

function StatusIcon({ status }: { status: MatrixStatus }) {
  const map = {
    supported: <Check className="h-4 w-4 text-emerald-400" aria-label="Supported" />,
    not_supported: <Minus className="h-4 w-4 text-zinc-600" aria-label="Not Supported" />,
    placeholder: <CircleDashed className="h-4 w-4 text-amber-400" aria-label="Placeholder" />,
    locked: <Lock className="h-4 w-4 text-rose-400" aria-label="Locked" />,
    requires_subscription: (
      <CreditCard className="h-4 w-4 text-violet-400" aria-label="Requires Subscription" />
    ),
    requires_approval: (
      <ShieldCheck className="h-4 w-4 text-orange-400" aria-label="Requires Approval" />
    ),
  };
  return map[status];
}

export function CapabilityMatrix({ providers }: { providers: McpProvider[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-zinc-700/70" data-testid="capability-matrix">
      <table className="min-w-max w-full text-left text-xs">
        <thead className="sticky top-0 bg-zinc-950">
          <tr>
            <th className="sticky left-0 z-10 bg-zinc-950 px-3 py-2 text-zinc-300">Provider</th>
            {MATRIX_COLUMNS.map((col) => (
              <th key={col} className="px-2 py-2 font-medium text-zinc-400 whitespace-nowrap">
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.provider_id} className="border-t border-zinc-800">
              <td className="sticky left-0 bg-zinc-900/95 px-3 py-2 font-medium text-white whitespace-nowrap">
                {p.provider_name}
              </td>
              {MATRIX_COLUMNS.map((col) => {
                const st = resolveStatus(p, col);
                return (
                  <td
                    key={col}
                    className={cn('px-2 py-2 text-center', st === 'locked' && 'bg-rose-950/20')}
                    title={st}
                  >
                    <StatusIcon status={st} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
