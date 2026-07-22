import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';

type OrderRow = {
  id: string;
  symbol: string;
  tradeType: string;
  quantity: number;
  price: number | null;
  status: string;
  isPaper: boolean;
  createdAt: string;
  instrumentType?: string;
  optionDetails?: { strategyTag?: string; strategyId?: string };
};

type StrategyPnl = {
  tag: string;
  strategyId: string | null;
  openMtm: number;
  realizedPnl: number;
  dayRealized: number;
  openLots: number;
  orderCount: number;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Journal + realized P&L by strategy tag. */
export function TradeJournalPanel() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [byTag, setByTag] = useState<StrategyPnl[]>([]);
  const [totals, setTotals] = useState({ openMtm: 0, realizedPnl: 0, dayRealized: 0 });
  const [filter, setFilter] = useState<'all' | 'paper' | 'live'>('all');

  const load = useCallback(async () => {
    const [oRes, jRes] = await Promise.all([
      fetch(`${API_BASE_URL}/orders`, { headers: authHeaders() }),
      fetch(`${API_BASE_URL}/paper/journal/by-strategy`, { headers: authHeaders() }),
    ]);
    const oJson = await oRes.json().catch(() => ({}));
    const jJson = await jRes.json().catch(() => ({}));
    if (!oRes.ok) throw new Error(oJson.message || 'Failed to load orders');
    const list = (oJson.data || oJson.orders || []) as OrderRow[];
    setOrders(list);
    if (jRes.ok) {
      setByTag(jJson.data?.rows || []);
      setTotals(jJson.data?.totals || { openMtm: 0, realizedPnl: 0, dayRealized: 0 });
    }
  }, []);

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
  }, [load]);

  const visible = orders.filter((o) => {
    if (filter === 'paper') return o.isPaper;
    if (filter === 'live') return !o.isPaper;
    return true;
  });

  return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <BookOpen className="h-4 w-4 text-amber-300" />
        <span style={{ fontWeight: 650, color: '#ffedd5' }}>Trade Journal / P&amp;L</span>
        <div style={{ flex: 1 }} />
        {(['all', 'paper', 'live'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              ...chip,
              background: filter === f ? 'rgba(245,158,11,0.25)' : 'transparent',
              borderColor: filter === f ? 'rgba(245,158,11,0.55)' : 'rgba(120,113,108,0.4)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 12, fontSize: 12, color: '#e7e5e4' }}>
        <span>Realized ₹{totals.realizedPnl.toLocaleString('en-IN')}</span>
        <span>Open MTM ₹{totals.openMtm.toLocaleString('en-IN')}</span>
        <span>Day realized ₹{totals.dayRealized.toLocaleString('en-IN')}</span>
        <span>{visible.length} orders</span>
      </div>

      <h3 style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 8px' }}>By strategy tag</h3>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#a8a29e', textAlign: 'left' }}>
              <th style={th}>Tag</th>
              <th style={th}>Open lots</th>
              <th style={th}>Open MTM</th>
              <th style={th}>Realized</th>
              <th style={th}>Day</th>
              <th style={th}>Orders</th>
            </tr>
          </thead>
          <tbody>
            {byTag.map((r) => (
              <tr key={r.tag} style={{ borderTop: '1px solid rgba(68,64,60,0.5)', color: '#e7e5e4' }}>
                <td style={td}>{r.tag}</td>
                <td style={td}>{r.openLots}</td>
                <td style={td}>{r.openMtm.toFixed(2)}</td>
                <td style={{ ...td, color: r.realizedPnl >= 0 ? '#86efac' : '#fca5a5' }}>
                  {r.realizedPnl.toFixed(2)}
                </td>
                <td style={td}>{r.dayRealized.toFixed(2)}</td>
                <td style={td}>{r.orderCount}</td>
              </tr>
            ))}
            {!byTag.length ? (
              <tr>
                <td colSpan={6} style={{ padding: 12, color: '#78716c', textAlign: 'center' }}>
                  No strategy-tagged P&amp;L yet — Send to Paper from Strategy Builder
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 13, color: '#cbd5e1', margin: '0 0 8px' }}>Orders</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#a8a29e', textAlign: 'left' }}>
              <th style={th}>When</th>
              <th style={th}>Mode</th>
              <th style={th}>Tag</th>
              <th style={th}>Side</th>
              <th style={th}>Symbol</th>
              <th style={th}>Qty</th>
              <th style={th}>Price</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((o) => (
              <tr key={o.id} style={{ borderTop: '1px solid rgba(68,64,60,0.5)', color: '#e7e5e4' }}>
                <td style={td}>{new Date(o.createdAt).toLocaleString()}</td>
                <td style={td}>{o.isPaper ? 'PAPER' : 'LIVE'}</td>
                <td style={td}>{o.optionDetails?.strategyTag || '—'}</td>
                <td style={td}>{o.tradeType}</td>
                <td style={td}>{o.symbol}</td>
                <td style={td}>{o.quantity}</td>
                <td style={td}>{Number(o.price || 0).toFixed(2)}</td>
                <td style={td}>{o.status}</td>
              </tr>
            ))}
            {!visible.length ? (
              <tr>
                <td colSpan={8} style={{ padding: 16, color: '#78716c', textAlign: 'center' }}>
                  No journal entries yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const shell: CSSProperties = { padding: 12 };
const chip: CSSProperties = {
  border: '1px solid',
  borderRadius: 999,
  padding: '4px 10px',
  fontSize: 11,
  color: '#e7e5e4',
  background: 'transparent',
  cursor: 'pointer',
  textTransform: 'uppercase',
};
const th: CSSProperties = { padding: '6px 8px', fontWeight: 500 };
const td: CSSProperties = { padding: '6px 8px' };
