import { Button } from '@/components/ui/button';
import { useConnections, useDisconnectConnection, useTestConnection } from '@/hooks/mcp';
import { ProviderHealthBadge, ProviderStatusBadge } from '@web-admin/components/mcp';
import { useMcpNavStore } from '../navStore';
import { refreshConnectionSession } from '@/api/mcpProviders';
import { toast } from 'sonner';

export function ConnectionsPage() {
  const { data, isLoading, refetch } = useConnections();
  const go = useMcpNavStore((s) => s.go);
  const test = useTestConnection();
  const disconnect = useDisconnectConnection();
  const rows = data || [];

  return (
    <div className="space-y-4" data-testid="mcp-connections-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Provider Connections</h2>
          <p className="text-sm text-zinc-400">Tenant/user broker & data connections</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="overflow-auto rounded-xl border border-zinc-700/70">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-950 text-zinc-400">
            <tr>
              {[
                'Alias',
                'Provider',
                'Tenant',
                'Owner',
                'Status',
                'Auth',
                'Health',
                'Last connected',
                'Last health',
                'Actions',
              ].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-zinc-500">
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-zinc-800 text-zinc-200">
                <td className="px-3 py-2">{c.account_alias || '—'}</td>
                <td className="px-3 py-2">{c.provider_id}</td>
                <td className="px-3 py-2 font-mono text-[10px]">
                  {String(c.tenant_id || '—').slice(0, 8)}
                </td>
                <td className="px-3 py-2 font-mono text-[10px]">
                  {String(c.user_id || '—').slice(0, 8)}
                </td>
                <td className="px-3 py-2">
                  <ProviderStatusBadge status={c.status || 'unknown'} />
                </td>
                <td className="px-3 py-2">{c.auth_status || '—'}</td>
                <td className="px-3 py-2">
                  <ProviderHealthBadge health={c.health_status} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{c.last_connected_at || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.last_health_check_at || '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => go('snapshot', { connectionId: c.id })}
                    >
                      Snapshot
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await test.mutateAsync(c.id);
                          toast.success('Test OK');
                          refetch();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Test failed');
                        }
                      }}
                    >
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await refreshConnectionSession(c.id);
                          toast.success('Session refreshed');
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Refresh failed');
                        }
                      }}
                    >
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-300"
                      onClick={async () => {
                        try {
                          await disconnect.mutateAsync(c.id);
                          toast.success('Disconnected');
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Disconnect failed');
                        }
                      }}
                    >
                      Disconnect
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => go('audit')}>
                      Audit
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                  No connections yet. Connect a provider from the marketplace.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
