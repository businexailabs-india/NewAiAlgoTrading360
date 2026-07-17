import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTradingDashboard } from '../../hooks/useTradingDashboard';

type OrderBucket = 'success' | 'pending' | 'failed';

function bucketOf(status: string): OrderBucket {
  const s = status.toUpperCase();
  if (['COMPLETE', 'FILLED', 'SUCCESS', 'EXECUTED'].includes(s)) return 'success';
  if (['REJECTED', 'CANCELLED', 'FAILED', 'EXPIRED'].includes(s)) return 'failed';
  return 'pending';
}

export function AlgosOrders() {
  const { orders, loading, error, refresh } = useTradingDashboard();
  const [tab, setTab] = useState<OrderBucket>('success');
  const [q, setQ] = useState('');

  const counts = useMemo(() => {
    const c = { success: 0, pending: 0, failed: 0 };
    (orders || []).forEach((o) => {
      c[bucketOf(String(o.status || ''))] += 1;
    });
    return c;
  }, [orders]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (orders || [])
      .filter((o) => bucketOf(String(o.status || '')) === tab)
      .filter((o) => {
        if (!needle) return true;
        return (
          String(o.symbol || '')
            .toLowerCase()
            .includes(needle) ||
          String(o.id || '')
            .toLowerCase()
            .includes(needle) ||
          String(o.source || '')
            .toLowerCase()
            .includes(needle)
        );
      });
  }, [orders, tab, q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(
            [
              ['success', 'Success'],
              ['pending', 'Pending'],
              ['failed', 'Failed']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                border: tab === id ? '1px solid rgba(52,211,153,0.55)' : '1px solid rgba(148,163,184,0.25)',
                background: tab === id ? 'rgba(16,185,129,0.12)' : 'transparent',
                color: tab === id ? '#6ee7b7' : '#94a3b8',
                cursor: 'pointer'
              }}
            >
              {label} ({counts[id]})
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.25)',
              background: 'rgba(15,23,42,0.6)'
            }}
          >
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search orders"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: 12, width: 160 }}
            />
          </div>
          <button
            type="button"
            onClick={() => refresh()}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.25)',
              background: 'transparent',
              color: '#94a3b8',
              fontSize: 12,
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading orders…</div>}
      {error && <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>}

      {!loading && rows.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>No orders match your search</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
            Try another keyword or clear search to see all orders.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#64748b', textAlign: 'left' }}>
                {['Time', 'B/S', 'Name', 'Algo', 'Qty', 'Order Type', 'Avg Price', 'Status'].map((h) => (
                  <th key={h} style={{ padding: '8px 6px', fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((o, i) => {
                const side = String(o.tradeType || o.side || 'BUY');
                const ts = o.createdAt || o.updatedAt || o.placedAt;
                return (
                  <tr key={String(o.id || i)} style={{ borderTop: '1px solid rgba(148,163,184,0.12)', color: '#e2e8f0' }}>
                    <td style={{ padding: '10px 6px', color: '#94a3b8' }}>
                      {ts ? new Date(String(ts)).toLocaleString() : '—'}
                    </td>
                    <td style={{ padding: '10px 6px', color: side.toUpperCase().includes('SELL') ? '#f87171' : '#34d399' }}>
                      {side}
                    </td>
                    <td style={{ padding: '10px 6px', fontWeight: 600 }}>{String(o.symbol || '—')}</td>
                    <td style={{ padding: '10px 6px', color: '#94a3b8' }}>{String(o.source || o.agentName || '—')}</td>
                    <td style={{ padding: '10px 6px' }}>{String(o.quantity ?? '—')}</td>
                    <td style={{ padding: '10px 6px' }}>{String(o.orderType || 'MARKET')}</td>
                    <td style={{ padding: '10px 6px' }}>{Number(o.price || o.avgPrice || 0).toFixed(2)}</td>
                    <td style={{ padding: '10px 6px' }}>{String(o.status || '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
