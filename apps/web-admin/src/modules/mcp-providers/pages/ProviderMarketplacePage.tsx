import { useMemo, useState } from 'react';
import type { ProviderFilters } from '@/api/mcpProviders';
import { useProviders } from '@/hooks/mcp';
import {
  LiveTradingLockedBanner,
  ProviderCard,
  ProviderFilterBar,
} from '@web-admin/components/mcp';
import { useMcpNavStore } from '../navStore';
import { Button } from '@/components/ui/button';
import { reloadProviders } from '@/api/mcpProviders';
import { toast } from 'sonner';

type Section =
  | 'all'
  | 'enabled'
  | 'broker'
  | 'market_data'
  | 'paper'
  | 'exchange';

export function ProviderMarketplacePage() {
  const go = useMcpNavStore((s) => s.go);
  const [filters, setFilters] = useState<ProviderFilters>({ country: 'IN' });
  const [section, setSection] = useState<Section>('all');
  const { data, isLoading, error, refetch } = useProviders(filters);

  const providers = useMemo(() => {
    const list = data || [];
    return list.filter((p) => {
      const t = (p.provider_type || '').toLowerCase();
      if (section === 'enabled') return p.enabled;
      if (section === 'broker') return t.includes('broker') || t.includes('trading');
      if (section === 'market_data') return t.includes('market') || t.includes('data');
      if (section === 'paper') return t.includes('paper') || t.includes('mock') || p.paper_trading_default;
      if (section === 'exchange')
        return t.includes('exchange') || t.includes('direct') || String(p.status).includes('placeholder');
      return true;
    });
  }, [data, section]);

  const sections: Array<{ id: Section; label: string }> = [
    { id: 'all', label: 'All Providers' },
    { id: 'enabled', label: 'Enabled' },
    { id: 'broker', label: 'Broker Providers' },
    { id: 'market_data', label: 'Market Data' },
    { id: 'paper', label: 'Paper Trading' },
    { id: 'exchange', label: 'Direct Exchange Placeholders' },
  ];

  return (
    <div className="space-y-4" data-testid="mcp-marketplace-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">MCP Provider Marketplace</h2>
          <p className="text-sm text-zinc-400">
            Indian brokers & market-data providers — loaded dynamically from mcp-connector-service
          </p>
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await reloadProviders();
              await refetch();
              toast.success('Provider registry reloaded');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Reload failed');
            }
          }}
        >
          Reload registry
        </Button>
      </div>

      <LiveTradingLockedBanner compact />
      <ProviderFilterBar filters={filters} onChange={setFilters} />

      <div className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`rounded-full px-3 py-1 text-xs ${
              section === s.id
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-zinc-400">Loading providers…</p>}
      {error && (
        <p className="text-rose-300">
          Failed to load providers: {error instanceof Error ? error.message : 'error'}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {providers.map((p) => (
          <ProviderCard
            key={p.provider_id}
            provider={p}
            onConnect={() => go('connect', { providerId: p.provider_id })}
            onConfigure={() => go('detail', { providerId: p.provider_id })}
            onDetails={() => go('detail', { providerId: p.provider_id })}
          />
        ))}
      </div>
      {!isLoading && providers.length === 0 && (
        <p className="text-zinc-500">No providers match the current filters.</p>
      )}
    </div>
  );
}
