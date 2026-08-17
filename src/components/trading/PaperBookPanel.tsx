import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Briefcase, FileText, Layers, RefreshCw, Shield } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

type Tab = 'holdings' | 'positions' | 'orders';

type HoldingRow = {
  id: string;
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  investedValue: number;
  currentValue: number;
  pnl: number;
  product: string;
  broker: string;
};

type PositionRow = {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  mtm: number;
  product: string;
  optionType?: string;
  strike?: number;
  expiry?: string;
};

type OrderRow = {
  id: string;
  symbol: string;
  tradeType: string;
  quantity: number;
  price: number;
  status: string;
  product: string;
  createdAt: string;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function inr(n: number, digits = 2) {
  return `₹${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

const tabBtn = (active: boolean): CSSProperties => ({
  padding: '7px 12px',
  borderRadius: 8,
  fontSize: 12,
  border: active ? '1px solid rgba(56,189,248,0.55)' : '1px solid rgba(148,163,184,0.2)',
  background: active ? 'rgba(14,165,233,0.18)' : 'transparent',
  color: active ? '#7dd3fc' : '#94a3b8',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

const th: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 11,
  color: '#64748b',
  borderBottom: '1px solid rgba(148,163,184,0.15)',
  whiteSpace: 'nowrap',
};

const td: CSSProperties = {
  padding: '9px 10px',
  fontSize: 12,
  color: '#e2e8f0',
  borderBottom: '1px solid rgba(148,163,184,0.08)',
  whiteSpace: 'nowrap',
};

export function PaperBookPanel({ initialTab = 'holdings' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acctRes, holdRes, posRes, ordRes] = await Promise.all([
        fetch(`${API_BASE_URL}/paper/account`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/portfolio/holdings`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/live/positions?isPaper=true`, { headers: authHeaders() }).then((r) =>
          r.json()
        ),
        fetch(`${API_BASE_URL}/orders?isPaper=true`, { headers: authHeaders() }).then((r) => r.json()),
      ]);

      if (acctRes?.success && acctRes.data) {
        setCash(Number(acctRes.data.cashBalance ?? 0));
        setRealizedPnl(Number(acctRes.data.realizedPnl ?? 0));
      }

      const rawHoldings = Array.isArray(holdRes?.data) ? holdRes.data : [];
      const mapped = rawHoldings.map((h: Record<string, unknown>, i: number) => {
        const broker = String(
          (h.brokerConnection as { broker?: string } | undefined)?.broker || h.broker || ''
        ).toLowerCase();
        return {
          id: String(h.id || i),
          symbol: String(h.symbol || '—'),
          exchange: String(h.exchange || '—'),
          quantity: Number(h.quantity || 0),
          averagePrice: Number(h.averagePrice || 0),
          lastPrice: Number(h.lastPrice || h.currentPrice || 0),
          investedValue: Number(h.investedValue || 0),
          currentValue: Number(h.currentValue || 0),
          pnl: Number(h.pnl || 0),
          product: String(h.product || 'CNC'),
          broker: broker || '—',
        };
      });
      const paperOnly = mapped.filter((h) => h.quantity > 0 && h.broker === 'paper');
      setHoldings(
        paperOnly.length
          ? paperOnly
          : mapped.filter((h) => h.quantity > 0 && /CE$|PE$/i.test(h.symbol))
      );

      const rawPos = Array.isArray(posRes?.data) ? posRes.data : [];
      setPositions(
        rawPos
          .filter((p: Record<string, unknown>) => Number(p.quantity || 0) !== 0)
          .map((p: Record<string, unknown>, i: number) => ({
            id: String(p.id || i),
            symbol: String(p.tradingSymbol || p.symbol || '—'),
            side: String(p.side || 'LONG'),
            quantity: Math.abs(Number(p.quantity || 0)),
            avgPrice: Number(p.avgPrice || p.averagePrice || 0),
            lastPrice: Number(p.lastPrice || 0),
            mtm: Number(p.mtm || p.unrealizedPnl || 0),
            product: String(p.product || 'NRML'),
            optionType: p.optionType ? String(p.optionType) : undefined,
            strike: p.strike != null ? Number(p.strike) : undefined,
            expiry: p.expiry ? String(p.expiry).slice(0, 10) : undefined,
          }))
      );

      const rawOrders = Array.isArray(ordRes?.data) ? ordRes.data : [];
      setOrders(
        rawOrders
          .filter((o: Record<string, unknown>) => o.isPaper !== false)
          .map((o: Record<string, unknown>, i: number) => ({
            id: String(o.id || i),
            symbol: String(o.symbol || '—'),
            tradeType: String(o.tradeType || o.side || 'BUY'),
            quantity: Number(o.quantity || 0),
            price: Number(o.price || o.avgPrice || 0),
            status: String(o.status || '—'),
            product: String(o.product || ''),
            createdAt: String(o.createdAt || o.executedAt || ''),
          }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load paper book');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  const holdingsInvested = useMemo(
    () => holdings.reduce((s, h) => s + h.investedValue, 0),
    [holdings]
  );
  const holdingsMtm = useMemo(() => holdings.reduce((s, h) => s + h.pnl, 0), [holdings]);
  const positionsMtm = useMemo(() => positions.reduce((s, p) => s + p.mtm, 0), [positions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 420 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#f1f5f9', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Shield className="h-4 w-4 text-sky-300" />
            Paper Book
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Simulated holdings, F&amp;O positions, and order fills — no live broker risk
          </div>
        </div>
        <button type="button" onClick={() => void load()} style={tabBtn(false)} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" style={{ opacity: loading ? 0.5 : 1 }} />
          {loading ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
        }}
      >
        <SummaryCard label="Paper cash" value={cash == null ? '—' : inr(cash, 0)} />
        <SummaryCard label="Holdings invested" value={inr(holdingsInvested, 0)} />
        <SummaryCard
          label="Holdings P&L"
          value={inr(holdingsMtm)}
          tone={holdingsMtm >= 0 ? 'up' : 'down'}
        />
        <SummaryCard
          label="F&O MTM"
          value={inr(positionsMtm)}
          tone={positionsMtm >= 0 ? 'up' : 'down'}
        />
        <SummaryCard
          label="Realized P&L"
          value={inr(realizedPnl)}
          tone={realizedPnl >= 0 ? 'up' : 'down'}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setTab('holdings')} style={tabBtn(tab === 'holdings')}>
          <Briefcase className="h-3.5 w-3.5" />
          Holdings ({holdings.length})
        </button>
        <button type="button" onClick={() => setTab('positions')} style={tabBtn(tab === 'positions')}>
          <Layers className="h-3.5 w-3.5" />
          Positions ({positions.length})
        </button>
        <button type="button" onClick={() => setTab('orders')} style={tabBtn(tab === 'orders')}>
          <FileText className="h-3.5 w-3.5" />
          Orders ({orders.length})
        </button>
      </div>

      {error ? (
        <div
          style={{
            fontSize: 12,
            color: '#fca5a5',
            padding: 10,
            borderRadius: 8,
            border: '1px solid rgba(248,113,113,0.35)',
          }}
        >
          {error}
        </div>
      ) : null}

      {tab === 'holdings' && (
        <BookTable
          empty="No paper holdings yet. Place a paper Buy from Trading Terminal."
          loading={loading}
          headers={['Symbol', 'Exch', 'Qty', 'Avg', 'LTP', 'Invested', 'P&L', 'Product']}
          rows={holdings.map((h) => [
            h.symbol,
            h.exchange,
            String(h.quantity),
            inr(h.averagePrice),
            inr(h.lastPrice),
            inr(h.investedValue, 0),
            <span key={`${h.id}-pnl`} style={{ color: h.pnl >= 0 ? '#34d399' : '#f87171' }}>
              {inr(h.pnl)}
            </span>,
            h.product,
          ])}
        />
      )}

      {tab === 'positions' && (
        <BookTable
          empty="No open paper F&O positions. Option fills appear here when typed as OPTION."
          loading={loading}
          headers={['Symbol', 'Side', 'Qty', 'Avg', 'LTP', 'MTM', 'Expiry', 'Product']}
          rows={positions.map((p) => [
            p.symbol,
            p.side,
            String(p.quantity),
            inr(p.avgPrice),
            inr(p.lastPrice),
            <span key={`${p.id}-mtm`} style={{ color: p.mtm >= 0 ? '#34d399' : '#f87171' }}>
              {inr(p.mtm)}
            </span>,
            p.expiry || '—',
            p.product,
          ])}
        />
      )}

      {tab === 'orders' && (
        <BookTable
          empty="No paper orders yet."
          loading={loading}
          headers={['Time', 'Symbol', 'Side', 'Qty', 'Fill', 'Status', 'Product']}
          rows={orders.map((o) => [
            (o.createdAt || '').replace('T', ' ').slice(0, 19) || '—',
            o.symbol,
            <span
              key={`${o.id}-side`}
              style={{ color: o.tradeType.toUpperCase() === 'BUY' ? '#34d399' : '#f87171' }}
            >
              {o.tradeType}
            </span>,
            String(o.quantity),
            inr(o.price),
            o.status,
            o.product || '—',
          ])}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid rgba(148,163,184,0.18)',
        background: 'rgba(15,23,42,0.45)',
      }}
    >
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
      <div
        style={{
          marginTop: 4,
          fontSize: 15,
          fontWeight: 600,
          color: tone === 'up' ? '#34d399' : tone === 'down' ? '#f87171' : '#f1f5f9',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BookTable({
  headers,
  rows,
  empty,
  loading,
}: {
  headers: string[];
  rows: Array<Array<ReactNode>>;
  empty: string;
  loading: boolean;
}) {
  if (loading && !rows.length) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>Loading paper book…</div>;
  }
  if (!rows.length) {
    return (
      <div
        style={{
          padding: 18,
          borderRadius: 10,
          border: '1px dashed rgba(148,163,184,0.25)',
          color: '#94a3b8',
          fontSize: 13,
        }}
      >
        {empty}
      </div>
    );
  }
  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(148,163,184,0.15)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j} style={td}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
