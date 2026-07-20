import { CheckCircle2, XCircle } from 'lucide-react';
import { ProviderHealthBadge } from './ProviderHealthBadge';

export function ConnectionTestResult({
  result,
  error,
}: {
  result?: Record<string, unknown> | null;
  error?: string | null;
}) {
  if (error) {
    return (
      <div
        className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-rose-100"
        data-testid="connection-test-result"
        data-status="failure"
      >
        <div className="flex items-center gap-2 font-semibold">
          <XCircle className="h-5 w-5" /> Connection test failed
        </div>
        <p className="mt-2 text-sm text-rose-200/80">{error}</p>
      </div>
    );
  }
  if (!result) return null;
  const ok = result.ok !== false && result.status !== 'error';
  const latency = result.latency_ms ?? result.latency;
  const masked = (result.masked_client_id || result.account_id_masked || '****') as string;
  return (
    <div
      className={`rounded-xl border p-4 ${
        ok
          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-50'
          : 'border-rose-500/40 bg-rose-950/40 text-rose-100'
      }`}
      data-testid="connection-test-result"
      data-status={ok ? 'success' : 'failure'}
    >
      <div className="flex items-center gap-2 font-semibold">
        {ok ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
        {ok ? 'Connection successful' : 'Connection unhealthy'}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <div className="text-xs text-zinc-400">Masked account</div>
          <div className="font-mono">{masked}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-400">Latency</div>
          <div>{latency != null ? `${latency} ms` : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-400">Health</div>
          <ProviderHealthBadge health={String(result.status || (ok ? 'healthy' : 'error'))} />
        </div>
        <div>
          <div className="text-xs text-zinc-400">Mode</div>
          <div>{String(result.mode || '—')}</div>
        </div>
      </div>
    </div>
  );
}
