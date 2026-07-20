import { useProviders } from '@/hooks/mcp';
import { CapabilityMatrix } from '@web-admin/components/mcp';

export function CapabilityMatrixPage() {
  const { data, isLoading, error } = useProviders({ country: 'IN' });
  return (
    <div className="space-y-4" data-testid="mcp-capability-matrix-page">
      <div>
        <h2 className="text-2xl font-bold text-white">Capability Matrix</h2>
        <p className="text-sm text-zinc-400">
          Supported · Not supported · Placeholder · Locked · Requires subscription · Requires approval
        </p>
      </div>
      {isLoading && <p className="text-zinc-400">Loading…</p>}
      {error && <p className="text-rose-300">{error instanceof Error ? error.message : 'Error'}</p>}
      <CapabilityMatrix providers={data || []} />
    </div>
  );
}
