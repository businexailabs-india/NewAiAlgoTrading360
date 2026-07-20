import { useMemo } from 'react';
import { useProviders } from '@/hooks/mcp';
import { LiveTradingLockedBanner, MarketDataProviderCard } from '@web-admin/components/mcp';
import { useMcpNavStore } from '../navStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState } from 'react';

export function MarketDataProvidersPage() {
  const { data, isLoading } = useProviders({ country: 'IN' });
  const go = useMcpNavStore((s) => s.go);
  const [advisory, setAdvisory] = useState(true);
  const [paper, setPaper] = useState(true);
  const [backtest, setBacktest] = useState(false);

  const marketData = useMemo(() => {
    return (data || []).filter((p) => {
      const t = (p.provider_type || '').toLowerCase();
      const id = p.provider_id.toLowerCase();
      return (
        t.includes('market') ||
        t.includes('data') ||
        t.includes('exchange') ||
        id.includes('truedata') ||
        id.includes('globaldata') ||
        id.includes('accord') ||
        id.includes('nse') ||
        id.includes('bse') ||
        id.includes('mock')
      );
    });
  }, [data]);

  return (
    <div className="space-y-4" data-testid="mcp-market-data-page">
      <div>
        <h2 className="text-2xl font-bold text-white">Market Data Provider Setup</h2>
        <p className="text-sm text-zinc-400">
          TrueData, GlobalDataFeeds, Accord, exchange placeholders, mock feeds
        </p>
      </div>
      <LiveTradingLockedBanner compact />
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label>Enable for AI Advisory</Label>
          <Switch checked={advisory} onCheckedChange={setAdvisory} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Enable for Paper Trading</Label>
          <Switch checked={paper} onCheckedChange={setPaper} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Enable for Backtesting</Label>
          <Switch checked={backtest} onCheckedChange={setBacktest} />
        </div>
      </div>
      {isLoading && <p className="text-zinc-400">Loading…</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {marketData.map((p) => (
          <MarketDataProviderCard
            key={p.provider_id}
            provider={p}
            onConnect={() => go('connect', { providerId: p.provider_id })}
            onTest={() => go('detail', { providerId: p.provider_id })}
          />
        ))}
      </div>
      {!isLoading && marketData.length === 0 && (
        <p className="text-zinc-500">No market-data providers in registry yet.</p>
      )}
    </div>
  );
}
