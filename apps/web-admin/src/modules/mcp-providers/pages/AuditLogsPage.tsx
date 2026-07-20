import { useMemo, useState } from 'react';
import { useProviderAuditLogs } from '@/hooks/mcp';
import { ProviderAuditTable, type AuditRow } from '@web-admin/components/mcp';

export function AuditLogsPage() {
  const { data, isLoading, error } = useProviderAuditLogs();
  const [filters, setFilters] = useState<{
    provider?: string;
    tenant?: string;
    action?: string;
    status?: string;
  }>({});

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return list.map((r) => r as AuditRow);
  }, [data]);

  return (
    <div className="space-y-4" data-testid="mcp-audit-page">
      <div>
        <h2 className="text-2xl font-bold text-white">MCP Audit Logs</h2>
        <p className="text-sm text-zinc-400">Compliance trail — secrets redacted by backend</p>
      </div>
      {isLoading && <p className="text-zinc-400">Loading audit…</p>}
      {error && (
        <p className="text-rose-300">
          {error instanceof Error ? error.message : 'Failed (admin role required)'}
        </p>
      )}
      <ProviderAuditTable rows={rows} filters={filters} onFiltersChange={setFilters} />
    </div>
  );
}
