import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type AuditRow = {
  timestamp?: string;
  created_at?: string;
  provider?: string;
  provider_id?: string;
  connection?: string;
  connection_id?: string;
  tenant?: string;
  tenant_id?: string;
  user?: string;
  user_id?: string;
  action?: string;
  result?: string;
  status?: string;
  ip?: string;
  device?: string;
  error_code?: string;
  details?: unknown;
};

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProviderAuditTable({
  rows,
  filters,
  onFiltersChange,
}: {
  rows: AuditRow[];
  filters: { provider?: string; tenant?: string; action?: string; status?: string };
  onFiltersChange: (f: typeof filters) => void;
}) {
  const filtered = rows.filter((r) => {
    if (filters.provider && !String(r.provider_id || r.provider || '').includes(filters.provider))
      return false;
    if (filters.tenant && !String(r.tenant_id || r.tenant || '').includes(filters.tenant)) return false;
    if (filters.action && !String(r.action || '').toLowerCase().includes(filters.action.toLowerCase()))
      return false;
    if (filters.status) {
      const s = String(r.result || r.status || '').toLowerCase();
      if (!s.includes(filters.status.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="space-y-3" data-testid="provider-audit-table">
      <div className="grid gap-2 md:grid-cols-5">
        <Input
          placeholder="Filter provider"
          value={filters.provider || ''}
          onChange={(e) => onFiltersChange({ ...filters, provider: e.target.value })}
          className="bg-zinc-900 border-zinc-700"
        />
        <Input
          placeholder="Filter tenant"
          value={filters.tenant || ''}
          onChange={(e) => onFiltersChange({ ...filters, tenant: e.target.value })}
          className="bg-zinc-900 border-zinc-700"
        />
        <Input
          placeholder="Filter action"
          value={filters.action || ''}
          onChange={(e) => onFiltersChange({ ...filters, action: e.target.value })}
          className="bg-zinc-900 border-zinc-700"
        />
        <Select
          value={filters.status || 'all'}
          onValueChange={(v) => onFiltersChange({ ...filters, status: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="bg-zinc-900 border-zinc-700">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              download(
                'mcp-audit.json',
                JSON.stringify(filtered, null, 2),
                'application/json'
              )
            }
          >
            Export JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const header = [
                'timestamp',
                'provider',
                'connection',
                'tenant',
                'user',
                'action',
                'result',
                'error_code',
              ];
              const lines = [
                header.join(','),
                ...filtered.map((r) =>
                  [
                    r.timestamp || r.created_at,
                    r.provider_id || r.provider,
                    r.connection_id || r.connection,
                    r.tenant_id || r.tenant,
                    r.user_id || r.user,
                    r.action,
                    r.result || r.status,
                    r.error_code,
                  ]
                    .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`)
                    .join(',')
                ),
              ];
              download('mcp-audit.csv', lines.join('\n'), 'text/csv');
            }}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border border-zinc-700/70">
        <table className="w-full text-left text-xs">
          <thead className="bg-zinc-950 text-zinc-400">
            <tr>
              {[
                'Timestamp',
                'Provider',
                'Connection',
                'Tenant',
                'User',
                'Action',
                'Result',
                'IP/Device',
                'Error',
              ].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} className="border-t border-zinc-800 text-zinc-200">
                <td className="px-3 py-2 whitespace-nowrap">{r.timestamp || r.created_at || '—'}</td>
                <td className="px-3 py-2">{r.provider_id || r.provider || '—'}</td>
                <td className="px-3 py-2 font-mono text-[10px]">
                  {String(r.connection_id || r.connection || '—').slice(0, 12)}
                </td>
                <td className="px-3 py-2 font-mono text-[10px]">
                  {String(r.tenant_id || r.tenant || '—').slice(0, 8)}
                </td>
                <td className="px-3 py-2 font-mono text-[10px]">
                  {String(r.user_id || r.user || '—').slice(0, 8)}
                </td>
                <td className="px-3 py-2">{r.action || '—'}</td>
                <td className="px-3 py-2">{r.result || r.status || '—'}</td>
                <td className="px-3 py-2">{r.ip || r.device || '—'}</td>
                <td className="px-3 py-2 text-rose-300">{r.error_code || ''}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                  No audit events
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
