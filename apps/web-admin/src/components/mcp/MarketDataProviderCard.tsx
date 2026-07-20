import type { McpProvider } from '@/api/mcpProviders';
import { Button } from '@/components/ui/button';
import { ProviderStatusBadge } from './ProviderStatusBadge';

export function MarketDataProviderCard({
  provider,
  onConnect,
  onTest,
}: {
  provider: McpProvider;
  onConnect?: () => void;
  onTest?: () => void;
}) {
  return (
    <div
      className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4"
      data-testid="market-data-provider-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">{provider.provider_name}</h3>
        <ProviderStatusBadge status={provider.status || (provider.enabled ? 'enabled' : 'disabled')} />
      </div>
      <p className="mb-3 text-xs text-zinc-400">
        Exchanges: {(provider.supported_exchanges || []).join(', ') || '—'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onConnect}>
          Connect data provider
        </Button>
        <Button size="sm" variant="outline" onClick={onTest}>
          Test quote feed
        </Button>
      </div>
    </div>
  );
}
