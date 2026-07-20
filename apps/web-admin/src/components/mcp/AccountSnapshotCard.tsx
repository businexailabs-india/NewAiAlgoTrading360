export function AccountSnapshotCard({
  snapshot,
}: {
  snapshot: Record<string, unknown> | null | undefined;
}) {
  if (!snapshot) {
    return (
      <div className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-6 text-zinc-400">
        No snapshot available
      </div>
    );
  }
  const profile = (snapshot.profile || {}) as Record<string, unknown>;
  const margins = (snapshot.margins || {}) as Record<string, unknown>;
  const holdings = (snapshot.holdings as unknown[]) || [];
  const positions = (snapshot.positions as unknown[]) || [];
  const orders = (snapshot.orders as unknown[]) || [];
  const trades = (snapshot.trades as unknown[]) || [];
  const health = (snapshot.health || {}) as Record<string, unknown>;

  return (
    <div className="space-y-4" data-testid="account-snapshot-card">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Masked account',
            value: String(profile.masked_client_id || snapshot.masked_client_id || '****'),
          },
          { label: 'Provider', value: String(snapshot.provider_id || snapshot.broker || '—') },
          {
            label: 'Available margin',
            value:
              margins.available != null
                ? `₹${Number(margins.available).toLocaleString('en-IN')}`
                : '—',
          },
          { label: 'Holdings', value: String(holdings.length) },
          { label: 'Open positions', value: String(positions.length) },
          { label: 'Orders', value: String(orders.length) },
          { label: 'Trades', value: String(trades.length) },
          {
            label: 'Health',
            value: String(
              health.status ||
                (health.ok === true ? 'healthy' : health.ok === false ? 'error' : '—')
            ),
          },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-zinc-700/70 bg-zinc-900/50 p-4">
            <div className="text-xs text-zinc-500">{m.label}</div>
            <div className="mt-1 text-lg font-semibold text-white">{m.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-zinc-700/70 bg-zinc-900/40 p-4 text-sm text-zinc-300">
        <div>
          Live order execution:{' '}
          <span className="text-rose-300 font-medium">
            {snapshot.live_order_execution === true ? 'Enabled' : 'Disabled (locked)'}
          </span>
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Secrets included: {String(snapshot.secrets_included ?? false)} · Last sync:{' '}
          {String(snapshot.last_sync_at || snapshot.synced_at || 'just now')}
        </div>
      </div>
    </div>
  );
}
