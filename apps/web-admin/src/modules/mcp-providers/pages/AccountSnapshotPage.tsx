import { Button } from '@/components/ui/button';
import { useAccountSnapshot, useConnection } from '@/hooks/mcp';
import { AccountSnapshotCard, LiveTradingLockedBanner } from '@web-admin/components/mcp';
import { useMcpNavStore } from '../navStore';
import { getAdvisoryProviderContext, getDhanLaxmiContext } from '@/api/mcpProviders';
import { useQuery } from '@tanstack/react-query';

export function AccountSnapshotPage() {
  const connectionId = useMcpNavStore((s) => s.connectionId);
  const go = useMcpNavStore((s) => s.go);
  const { data: connection } = useConnection(connectionId);
  const { data: snapshot, isLoading } = useAccountSnapshot(connectionId);
  const dhanlaxmi = useQuery({
    queryKey: ['mcp', 'dhanlaxmi-context'],
    queryFn: getDhanLaxmiContext,
  });
  const advisory = useQuery({
    queryKey: ['mcp', 'advisory-context'],
    queryFn: getAdvisoryProviderContext,
  });

  if (!connectionId) {
    return (
      <p className="text-zinc-400">
        Select a connection.{' '}
        <button className="text-cyan-400" onClick={() => go('connections')}>
          Back
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="mcp-snapshot-page">
      <Button variant="ghost" size="sm" onClick={() => go('connections')}>
        ← Connections
      </Button>
      <h2 className="text-2xl font-bold text-white">Account Snapshot</h2>
      <p className="text-sm text-zinc-400">
        {connection?.provider_id} · {connection?.account_alias || connectionId.slice(0, 8)}
      </p>
      <LiveTradingLockedBanner compact />
      {isLoading ? (
        <p className="text-zinc-400">Loading snapshot…</p>
      ) : (
        <AccountSnapshotCard snapshot={snapshot as Record<string, unknown>} />
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-300">
          <div className="font-semibold text-white mb-1">DhanLaxmi visibility</div>
          <div>
            Visible:{' '}
            {dhanlaxmi.data && typeof dhanlaxmi.data === 'object' ? 'Yes (masked context)' : '—'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Preferred broker:{' '}
            {String((dhanlaxmi.data as { preferred_broker?: string })?.preferred_broker || '—')}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 text-sm text-zinc-300">
          <div className="font-semibold text-white mb-1">AI Advisory visibility</div>
          <div>
            Context source:{' '}
            {advisory.data && typeof advisory.data === 'object' ? 'Yes (redacted)' : '—'}
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Live trading:{' '}
            {String(
              (advisory.data as { live_trading_enabled?: boolean })?.live_trading_enabled ?? false
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
