import { Building2, Lock, Newspaper } from 'lucide-react';
import type { McpProvider } from '@/api/mcpProviders';
import { Button } from '@/components/ui/button';
import { CapabilityBadge } from './CapabilityBadge';
import { ProviderHealthBadge } from './ProviderHealthBadge';
import { ProviderStatusBadge } from './ProviderStatusBadge';

export function ProviderCard({
  provider,
  onConnect,
  onConfigure,
  onDetails,
}: {
  provider: McpProvider;
  onConnect?: () => void;
  onConfigure?: () => void;
  onDetails?: () => void;
}) {
  const caps = provider.capabilities || [];
  return (
    <article
      className="flex flex-col rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4 shadow-sm backdrop-blur transition hover:border-cyan-500/40"
      data-testid="provider-card"
      data-provider-id={provider.provider_id}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-600 bg-zinc-800/80">
          <Building2 className="h-6 w-6 text-cyan-300" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-white">{provider.provider_name}</h3>
          <p className="text-xs text-zinc-400">
            {provider.provider_type} · {provider.country}
          </p>
        </div>
        <ProviderStatusBadge status={provider.enabled ? 'enabled' : 'disabled'} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(provider.supported_exchanges || []).slice(0, 4).map((ex) => (
          <span key={ex} className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
            {ex}
          </span>
        ))}
        {(provider.supported_asset_classes || []).slice(0, 3).map((a) => (
          <span key={a} className="rounded bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-400">
            {a}
          </span>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {provider.live_trading_default === false && (
          <span className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">
            <Lock className="h-3 w-3" /> Live locked
          </span>
        )}
        {provider.paper_trading_default && (
          <span className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
            <Newspaper className="h-3 w-3" /> Paper
          </span>
        )}
        <ProviderHealthBadge health={provider.status} />
        <span className="text-[10px] text-zinc-500">{caps.length} capabilities</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {caps.slice(0, 5).map((c) => (
          <CapabilityBadge key={c} capability={c} />
        ))}
        {caps.length > 5 && (
          <span className="text-[10px] text-zinc-500">+{caps.length - 5}</span>
        )}
      </div>

      <div className="mt-auto flex gap-2">
        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-500" onClick={onConnect}>
          Connect
        </Button>
        <Button size="sm" variant="outline" className="border-zinc-600" onClick={onConfigure}>
          Configure
        </Button>
        <Button size="sm" variant="ghost" className="text-zinc-300" onClick={onDetails}>
          View Details
        </Button>
      </div>
    </article>
  );
}
