import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LiveTradingLockedBanner } from '@web-admin/components/mcp';
import { useLiveTradingStatus, useProviders } from '@/hooks/mcp';
import { useAuth } from '@/contexts/AuthContext';
import { adminListConnections, setConnectionLiveTrading } from '@/api/mcpProviders';
import { mcpKeys } from '@/hooks/mcp/keys';

export function LiveTradingControlsPage() {
  const { data: status } = useLiveTradingStatus();
  const { data: providers } = useProviders({ country: 'IN' });
  const { data: connections } = useQuery({
    queryKey: [...mcpKeys.connections(), 'admin'],
    queryFn: () => adminListConnections(),
  });
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSuperAdmin = (user?.role || '').toLowerCase() === 'admin';
  const liveEnabled = Boolean(status?.live_trading_enabled);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onToggleConnection(connectionId: string, enabled: boolean) {
    if (!isSuperAdmin || !liveEnabled) return;
    setBusyId(connectionId);
    setError(null);
    try {
      await setConnectionLiveTrading(connectionId, enabled);
      await qc.invalidateQueries({ queryKey: [...mcpKeys.connections(), 'admin'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update connection live flag');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4" data-testid="mcp-live-controls-page">
      <div>
        <h2 className="text-2xl font-bold text-white">Live Trading Controls</h2>
        <p className="text-sm text-zinc-400">
          Live trading is disabled by default. Connection toggles require LIVE_TRADING_ENABLED and
          admin role.
        </p>
      </div>
      {!liveEnabled ? <LiveTradingLockedBanner /> : null}

      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4 space-y-3">
        <div className="flex items-center justify-between opacity-80">
          <Label>Platform LIVE_TRADING_ENABLED</Label>
          <Switch checked={liveEnabled} disabled />
        </div>
        <p className="text-xs text-zinc-500">
          Platform flag is env-controlled (not flipped from UI). Current: {String(liveEnabled)}.
          Connection-level live requires this flag first.
        </p>
        <div className="grid gap-2 md:grid-cols-2 text-sm text-zinc-300">
          <div>RMS required: Yes</div>
          <div>OMS required: Yes</div>
          <div>Approval required: Yes</div>
          <div>Kill switch: Env / OMS controlled</div>
          <div>Paper trading: {String(status?.paper_trading_enabled ?? true)}</div>
          <div>Providers loaded: {status?.providers_loaded ?? providers?.length ?? '—'}</div>
        </div>
        {error ? <p className="text-xs text-rose-400">{error}</p> : null}
      </div>

      <div className="overflow-auto rounded-xl border border-zinc-700/70">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-950 text-zinc-400">
            <tr>
              {['Connection', 'Provider', 'Status', 'Connection live', 'Direct exec'].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(connections || []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-zinc-500">
                  No connections — create a Dhan connection first.
                </td>
              </tr>
            ) : (
              (connections || []).map((c) => (
                <tr key={c.id} className="border-t border-zinc-800 text-zinc-200">
                  <td className="px-3 py-2 font-mono text-[11px]">{c.id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">{c.provider_id}</td>
                  <td className="px-3 py-2">{c.status}</td>
                  <td className="px-3 py-2">
                    <Switch
                      checked={Boolean(c.live_trading_enabled)}
                      disabled={!isSuperAdmin || !liveEnabled || busyId === c.id}
                      onCheckedChange={(v) => onToggleConnection(c.id, v)}
                    />
                  </td>
                  <td className="px-3 py-2 text-rose-300">OMS only</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
