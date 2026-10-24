import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw } from 'lucide-react';
import { portfolioService } from '../../services/portfolioService';
import { API_BASE_URL } from '../../lib/api';
import { useTheme } from '../../contexts/ThemeContext';

interface PositionRow {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  product?: string;
  status: 'open' | 'closed';
  isPaper?: boolean;
}

export function AlgosPositions() {
  const { theme } = useTheme();
  const light = theme === 'light';
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('');

  const mapRows = (raw: unknown[], fallbackPaper?: boolean): PositionRow[] =>
    (Array.isArray(raw) ? raw : []).map((p, i) => {
      const rec = (p || {}) as Record<string, unknown>;
      const qty = Math.abs(Number(rec.quantity ?? rec.qty ?? rec.netQty ?? 0));
      const statusRaw = String(rec.status || '').toLowerCase();
      const status: 'open' | 'closed' =
        statusRaw === 'closed' || statusRaw === 'complete' ? 'closed' : qty > 0 ? 'open' : 'closed';
      return {
        id: String(rec.id || rec.symbol || rec.tradingSymbol || i),
        symbol: String(rec.symbol || rec.tradingSymbol || rec.tradingsymbol || '—'),
        side: String(rec.side || rec.transactionType || (Number(rec.quantity) >= 0 ? 'BUY' : 'SELL')),
        qty,
        avgPrice: Number(rec.averagePrice ?? rec.avgPrice ?? rec.avg_price ?? 0),
        ltp: Number(rec.lastPrice ?? rec.ltp ?? rec.last_price ?? 0),
        pnl: Number(rec.pnl ?? rec.unrealised ?? rec.unrealized ?? rec.unrealizedPnl ?? 0),
        product: String(rec.product || rec.productType || ''),
        status,
        isPaper: rec.isPaper != null ? Boolean(rec.isPaper) : Boolean(fallbackPaper)
      };
    });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await portfolioService.getPositions();
      const rows = mapRows(data?.positions || []);
      setPositions(rows);
      setSource(String(data?.source || ''));
    } catch {
      try {
        const token = localStorage.getItem('authToken');
        const res = await fetch(`${API_BASE_URL}/live/positions?isPaper=true&refresh=0`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        });
        const body = await res.json().catch(() => ({}));
        const raw = Array.isArray(body.data) ? body.data : body.data?.positions || [];
        setPositions(mapRows(raw, true));
        setSource('paper');
        setError(null);
      } catch {
        setPositions([]);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const visible = useMemo(() => positions.filter((p) => p.status === tab), [positions, tab]);
  const unrealised = visible.reduce((s, p) => s + p.pnl, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: light ? '#0f172a' : '#e2e8f0' }}>Today&apos;s Positions</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Unrealised P&L:{' '}
            <strong style={{ color: unrealised >= 0 ? '#34d399' : '#f87171' }}>
              ₹{unrealised.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </strong>
            {' · '}Open: {positions.filter((p) => p.status === 'open').length}
            {source ? ` · Source: ${source}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={load}
            title="Refresh"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              borderRadius: 8,
              border: light ? '1px solid #cbd5e1' : '1px solid rgba(148,163,184,0.35)',
              background: light ? '#ffffff' : 'rgba(15,23,42,0.85)',
              color: light ? '#334155' : '#e2e8f0',
              cursor: 'pointer',
              fontSize: 11
            }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </button>
          <Eye className="h-4 w-4 text-slate-400" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(
          [
            ['open', 'Open'],
            ['closed', 'Closed']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              border: tab === id ? '1px solid #0d9488' : '1px solid #cbd5e1',
              background: tab === id ? '#ccfbf1' : '#ffffff',
              color: tab === id ? '#0f766e' : '#475569',
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading live positions…</div>}
      {error && <div style={{ color: '#f87171', fontSize: 12 }}>{error}</div>}

      {!loading && visible.length === 0 ? (
        <div style={{ padding: '48px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600 }}>No live positions</div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
            You don&apos;t have any {tab} positions right now. Deploy an algo or place paper/live orders.
          </div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ color: '#334155', textAlign: 'left' }}>
                {['Symbol', 'B/S', 'Qty', 'Avg', 'LTP', 'P&L', 'Product', 'Mode'].map((h) => (
                  <th key={h} style={{ padding: '8px 6px', fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid #e2e8f0', color: '#0f172a' }}>
                  <td style={{ padding: '10px 6px', fontWeight: 600 }}>{p.symbol}</td>
                  <td
                    style={{
                      padding: '10px 6px',
                      color: p.side.toUpperCase().includes('SELL') ? '#f87171' : '#34d399'
                    }}
                  >
                    {p.side}
                  </td>
                  <td style={{ padding: '10px 6px' }}>{p.qty}</td>
                  <td style={{ padding: '10px 6px' }}>{p.avgPrice.toFixed(2)}</td>
                  <td style={{ padding: '10px 6px' }}>{p.ltp.toFixed(2)}</td>
                  <td style={{ padding: '10px 6px', color: p.pnl >= 0 ? '#34d399' : '#f87171' }}>
                    {p.pnl.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 6px', color: '#94a3b8' }}>{p.product || '—'}</td>
                  <td style={{ padding: '10px 6px', color: '#94a3b8' }}>{p.isPaper ? 'Paper' : 'Live'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
