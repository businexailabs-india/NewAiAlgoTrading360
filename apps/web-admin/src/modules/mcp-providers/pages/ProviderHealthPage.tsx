import { useMemo } from 'react';
import { useMcpHealthSocket, useProviderHealth } from '@/hooks/mcp';
import { ProviderHealthBadge, ProviderHealthChart } from '@web-admin/components/mcp';

export function ProviderHealthPage() {
  const { data, isLoading, error } = useProviderHealth();
  const lastWs = useMcpHealthSocket();
  const rows = Array.isArray(data) ? data : [];

  const chartPoints = useMemo(() => {
    return rows.slice(-20).map((r, i) => {
      const row = r as Record<string, unknown>;
      return {
        time: String(row.at || row.checked_at || i),
        latency: Number(row.latency_ms || row.latency || 0),
        failures: Number(row.ok === false || row.status === 'error' ? 1 : 0),
      };
    });
  }, [rows]);

  const authFailures = rows.filter((r) => {
    const row = r as Record<string, unknown>;
    return String(row.error || row.status || '').toLowerCase().includes('auth');
  }).length;
  const rateLimits = rows.filter((r) =>
    String((r as Record<string, unknown>).error || '').toLowerCase().includes('rate')
  ).length;

  return (
    <div className="space-y-4" data-testid="mcp-health-page">
      <div>
        <h2 className="text-2xl font-bold text-white">Provider Health Dashboard</h2>
        <p className="text-sm text-zinc-400">
          Channel: mcp.connection.health.changed · last WS event:{' '}
          {lastWs ? 'received' : 'waiting / polling'}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Health samples', value: rows.length },
          { label: 'Auth failures', value: authFailures },
          { label: 'Rate-limit warnings', value: rateLimits },
          {
            label: 'Avg latency',
            value: `${Math.round(
              chartPoints.reduce((a, b) => a + b.latency, 0) / Math.max(1, chartPoints.length)
            )} ms`,
          },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-4">
            <div className="text-xs text-zinc-500">{m.label}</div>
            <div className="text-2xl font-bold text-white">{m.value}</div>
          </div>
        ))}
      </div>

      <ProviderHealthChart points={chartPoints} />

      {isLoading && <p className="text-zinc-400">Loading health…</p>}
      {error && (
        <p className="text-rose-300">
          {error instanceof Error ? error.message : 'Failed to load health (admin role required)'}
        </p>
      )}

      <div className="overflow-auto rounded-xl border border-zinc-700/70">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-950 text-zinc-400">
            <tr>
              {['Provider', 'Connection', 'Status', 'Latency', 'Quote feed', 'WS feed', 'Error'].map(
                (h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const row = r as Record<string, unknown>;
              return (
                <tr key={i} className="border-t border-zinc-800 text-zinc-200">
                  <td className="px-3 py-2">{String(row.provider_id || '—')}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">
                    {String(row.connection_id || '—').slice(0, 12)}
                  </td>
                  <td className="px-3 py-2">
                    <ProviderHealthBadge
                      health={String(row.status || (row.ok === true ? 'healthy' : 'error'))}
                    />
                  </td>
                  <td className="px-3 py-2">{String(row.latency_ms ?? '—')}</td>
                  <td className="px-3 py-2">{String(row.quote_feed || '—')}</td>
                  <td className="px-3 py-2">{String(row.websocket_feed || '—')}</td>
                  <td className="px-3 py-2 text-rose-300">{String(row.error || '')}</td>
                </tr>
              );
            })}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                  No health samples yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
