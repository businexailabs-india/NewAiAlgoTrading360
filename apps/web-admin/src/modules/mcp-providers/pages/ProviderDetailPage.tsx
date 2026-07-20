import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  useDisableProvider,
  useEnableProvider,
  useProvider,
  useProviderCapabilities,
  useProviderRequiredCredentials,
} from '@/hooks/mcp';
import {
  CapabilityBadge,
  LiveTradingLockedBanner,
  ProviderHealthBadge,
  ProviderStatusBadge,
} from '@web-admin/components/mcp';
import { useMcpNavStore } from '../navStore';
import { toast } from 'sonner';

export function ProviderDetailPage() {
  const providerId = useMcpNavStore((s) => s.providerId);
  const go = useMcpNavStore((s) => s.go);
  const { data: provider, isLoading } = useProvider(providerId);
  const { data: caps } = useProviderCapabilities(providerId);
  const { data: creds } = useProviderRequiredCredentials(providerId);
  const enable = useEnableProvider();
  const disable = useDisableProvider();
  const [dhanlaxmiVisible, setDhanlaxmiVisible] = useState(true);
  const [advisoryVisible, setAdvisoryVisible] = useState(true);
  const [useAdvisoryContext, setUseAdvisoryContext] = useState(true);
  const [useMarketData, setUseMarketData] = useState(false);
  const [usePaper, setUsePaper] = useState(true);
  const [devOpen, setDevOpen] = useState(false);

  if (!providerId) {
    return (
      <p className="text-zinc-400">
        Select a provider from the marketplace.{' '}
        <button className="text-cyan-400" onClick={() => go('marketplace')}>
          Back
        </button>
      </p>
    );
  }

  if (isLoading || !provider) {
    return <p className="text-zinc-400">Loading provider…</p>;
  }

  return (
    <div className="space-y-4" data-testid="mcp-provider-detail">
      <Button variant="ghost" size="sm" onClick={() => go('marketplace')}>
        ← Marketplace
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">{provider.provider_name}</h2>
          <p className="text-sm text-zinc-400">
            {provider.provider_type} · {provider.country} · auth: {provider.auth_type || creds?.auth_type || '—'}
          </p>
        </div>
        <div className="flex gap-2">
          <ProviderStatusBadge status={provider.enabled ? 'enabled' : 'disabled'} />
          <ProviderHealthBadge health={provider.status} />
        </div>
      </div>

      <LiveTradingLockedBanner />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 space-y-2 text-sm text-zinc-300">
          <div>Exchanges: {(provider.supported_exchanges || []).join(', ') || '—'}</div>
          <div>Segments: {(provider.supported_segments || []).join(', ') || '—'}</div>
          <div>Asset classes: {(provider.supported_asset_classes || []).join(', ') || '—'}</div>
          <div>
            Live trading default:{' '}
            <span className="text-rose-300">
              {provider.live_trading_default ? 'On (still gated)' : 'Locked / disabled'}
            </span>
          </div>
          <div>
            Docs:{' '}
            {provider.documentation_url ? (
              <a className="text-cyan-400" href={provider.documentation_url} target="_blank" rel="noreferrer">
                {provider.documentation_url}
              </a>
            ) : (
              '—'
            )}
          </div>
          <div>
            Required credentials:{' '}
            {(creds?.credentials_required || provider.credentials_required || []).join(', ') || '—'}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 space-y-3">
          <h3 className="font-semibold text-white">Assistant & Advisory visibility</h3>
          <div className="flex items-center justify-between">
            <Label className="text-zinc-300">Visible to DhanLaxmi</Label>
            <Switch checked={dhanlaxmiVisible} onCheckedChange={setDhanlaxmiVisible} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-zinc-300">Visible to AI Advisory</Label>
            <Switch checked={advisoryVisible} onCheckedChange={setAdvisoryVisible} />
          </div>
          <p className="text-xs text-zinc-500">
            DhanLaxmi can query masked broker status, portfolio, margins, holdings, and positions, but
            never sees raw credentials.
          </p>
          <div className="border-t border-zinc-700 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Use as advisory context source</Label>
              <Switch checked={useAdvisoryContext} onCheckedChange={setUseAdvisoryContext} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Use as market data source</Label>
              <Switch checked={useMarketData} onCheckedChange={setUseMarketData} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Use as paper trading provider</Label>
              <Switch checked={usePaper} onCheckedChange={setUsePaper} />
            </div>
            <div className="flex items-center justify-between opacity-60">
              <Label>Use as live execution provider (locked)</Label>
              <Switch checked={false} disabled />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
        <h3 className="mb-2 font-semibold text-white">Capability matrix</h3>
        <div className="flex flex-wrap gap-1">
          {(caps?.capabilities || provider.capabilities || []).map((c) => (
            <CapabilityBadge key={c} capability={c} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={async () => {
            try {
              await enable.mutateAsync(provider.provider_id);
              toast.success('Provider enabled');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Enable failed');
            }
          }}
        >
          Enable provider
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await disable.mutateAsync(provider.provider_id);
              toast.success('Provider disabled');
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Disable failed');
            }
          }}
        >
          Disable provider
        </Button>
        <Button onClick={() => go('connect', { providerId: provider.provider_id })}>Connect</Button>
        <Button variant="outline" onClick={() => go('connections')}>
          View connections
        </Button>
        <Button variant="outline" onClick={() => go('audit')}>
          View audit logs
        </Button>
        <Button variant="ghost" onClick={() => setDevOpen((v) => !v)}>
          {devOpen ? 'Hide' : 'Developer view'}
        </Button>
      </div>

      {devOpen && (
        <pre className="max-h-64 overflow-auto rounded-xl border border-zinc-700 bg-black/40 p-3 text-[10px] text-zinc-400">
          {JSON.stringify({ provider, caps, creds }, null, 2)}
        </pre>
      )}
    </div>
  );
}
