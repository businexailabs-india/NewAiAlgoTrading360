import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Fragment,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  Calculator,
  FileText,
  Layers,
  LineChart,
  LogOut,
  RefreshCw,
  Shield,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';
import { tradingApi } from '@/api/trading';
import { tradingService } from '@/services/tradingService';
import { StockChartModal } from '@/components/StockChartModal';
import { FundTransferModal } from '@/components/algos/FundTransferModal';
import type { WatchlistItem } from '@/api/watchlist';

type Tab = 'positions' | 'orders';

type PositionRow = {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  mtm: number;
  product: string;
  exchange?: string;
  optionType?: string;
  strike?: number;
  expiry?: string;
  mtmSource?: string;
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

const UNDERLYING_PREFIXES = [
  'BANKNIFTY',
  'MIDCPNIFTY',
  'FINNIFTY',
  'NIFTYNXT50',
  'NIFTYFPI',
  'SENSEX50',
  'BANKEX',
  'SENSEX',
  'NIFTY',
  'FOCIT',
];

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

function inferUnderlying(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const u of UNDERLYING_PREFIXES) {
    if (s.startsWith(u)) return u;
  }
  return symbol.replace(/(\d+)(CE|PE)$/i, '').toUpperCase() || symbol;
}

function approxPnl(side: string, qty: number, avg: number, exitPx: number): number {
  return side.toUpperCase() === 'SHORT' || side.toUpperCase() === 'SELL'
    ? (avg - exitPx) * qty
    : (exitPx - avg) * qty;
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

const actionBtn = (color: string): CSSProperties => ({
  padding: '4px 8px',
  borderRadius: 6,
  fontSize: 11,
  border: `1px solid ${color}`,
  background: 'transparent',
  color,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
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

const inputSm: CSSProperties = {
  width: 88,
  padding: '4px 6px',
  borderRadius: 6,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(15,23,42,0.85)',
  color: '#e2e8f0',
  fontSize: 12,
};

export function PaperBookPanel({ initialTab = 'positions' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cash, setCash] = useState<number | null>(null);
  const [realizedPnl, setRealizedPnl] = useState(0);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [mtmMeta, setMtmMeta] = useState<{ quoteSource?: string; modelMarks?: number } | null>(
    null
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [whatIfId, setWhatIfId] = useState<string | null>(null);
  const [whatIfPrice, setWhatIfPrice] = useState('');
  const [fundOpen, setFundOpen] = useState(false);
  const [fundMode, setFundMode] = useState<'add' | 'withdraw'>('add');
  const [chartStock, setChartStock] = useState<WatchlistItem | null>(null);
  const [chartTrade, setChartTrade] = useState<{
    instrument_id: string;
    symbol: string;
    instrument_type: string;
    lot_size: number;
    direct_trading_allowed: boolean;
    exchange?: string;
    display_name?: string;
    strike?: number | null;
    option_type?: string | null;
    underlying_symbol?: string | null;
  } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [acctRes, posRes, ordRes] = await Promise.all([
        fetch(`${API_BASE_URL}/paper/account`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/live/positions?isPaper=true`, { headers: authHeaders() }).then((r) =>
          r.json()
        ),
        fetch(`${API_BASE_URL}/orders?isPaper=true`, { headers: authHeaders() }).then((r) => r.json()),
      ]);

      if (acctRes?.success && acctRes.data) {
        setCash(Number(acctRes.data.cashBalance ?? 0));
        setRealizedPnl(Number(acctRes.data.realizedPnl ?? 0));
      }

      const rawPos = Array.isArray(posRes?.data) ? posRes.data : [];
      if (posRes?.meta) {
        setMtmMeta({
          quoteSource: String(posRes.meta.quoteSource || ''),
          modelMarks: Number(posRes.meta.modelMarks || 0),
        });
      } else {
        setMtmMeta(null);
      }
      setPositions(
        rawPos
          .filter((p: Record<string, unknown>) => Number(p.quantity || 0) !== 0)
          .map((p: Record<string, unknown>, i: number) => {
            const meta = (p.meta as Record<string, unknown> | null) || null;
            return {
              id: String(p.id || i),
              symbol: String(p.tradingSymbol || p.symbol || '—'),
              side: String(p.side || 'LONG'),
              quantity: Math.abs(Number(p.quantity || 0)),
              avgPrice: Number(p.avgPrice || p.averagePrice || 0),
              lastPrice: Number(p.lastPrice || 0),
              mtm: Number(p.mtm || p.unrealizedPnl || 0),
              product: String(p.product || 'NRML'),
              exchange: p.exchange ? String(p.exchange) : undefined,
              optionType: p.optionType ? String(p.optionType) : undefined,
              strike: p.strike != null ? Number(p.strike) : undefined,
              expiry: p.expiry ? String(p.expiry).slice(0, 10) : undefined,
              mtmSource: meta?.mtmSource ? String(meta.mtmSource) : undefined,
            };
          })
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

  const positionsMtm = useMemo(() => positions.reduce((s, p) => s + p.mtm, 0), [positions]);

  const exitPosition = async (p: PositionRow, exitPrice?: number) => {
    const side = p.side.toUpperCase() === 'SHORT' || p.side.toUpperCase() === 'SELL' ? 'BUY' : 'SELL';
    const px = exitPrice && exitPrice > 0 ? exitPrice : p.lastPrice > 0 ? p.lastPrice : p.avgPrice;
    if (!(px > 0)) {
      toast.error('Need a mark price to exit — wait for LTP or enter a what-if price');
      return;
    }
    const pnl = approxPnl(p.side, p.quantity, p.avgPrice, px);
    if (
      !window.confirm(
        `Exit ${p.symbol} ${p.side} × ${p.quantity} at ≈ ${inr(px)}?\nApprox P&L: ${inr(pnl)}`
      )
    ) {
      return;
    }
    setBusyId(p.id);
    try {
      const optType =
        p.optionType === 'CE' || p.optionType === 'PE'
          ? p.optionType
          : /CE$/i.test(p.symbol)
            ? 'CE'
            : /PE$/i.test(p.symbol)
              ? 'PE'
              : undefined;
      await tradingService.placeOrder({
        symbol: p.symbol,
        tradeType: side,
        quantity: p.quantity,
        orderType: 'LIMIT',
        product: p.product || 'NRML',
        price: px,
        isPaper: true,
        instrumentType: /CE$|PE$/i.test(p.symbol) ? 'OPTION' : 'EQUITY',
        optionDetails:
          optType && p.strike != null && p.expiry
            ? { strike: p.strike, expiry: p.expiry, optionType: optType }
            : undefined,
        source: 'PAPER_BOOK_EXIT',
      });
      toast.success(`Exited ${p.symbol} · approx ${inr(pnl)}`);
      setWhatIfId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Exit failed');
    } finally {
      setBusyId(null);
    }
  };

  const openChart = async (p: PositionRow) => {
    setBusyId(p.id);
    try {
      const und = inferUnderlying(p.symbol);
      const rows = await tradingApi.searchInstruments(p.symbol);
      const hit =
        rows.find((x) => x.symbol.toUpperCase() === p.symbol.toUpperCase()) ||
        rows.find(
          (x) =>
            p.strike != null &&
            Number(x.strike) === p.strike &&
            (x.option_type || '').toUpperCase() === (p.optionType || '').toUpperCase()
        ) ||
        rows[0];
      setChartStock({
        id: `paper-${p.id}`,
        symbol: und,
        exchange: p.exchange === 'BFO' || und === 'SENSEX' ? 'BSE' : 'NSE',
        sortOrder: 0,
        name: `${p.symbol} · ${p.side}`,
      });
      setChartTrade(
        hit
          ? {
              instrument_id: hit.instrument_id,
              symbol: hit.symbol,
              instrument_type: hit.instrument_type,
              lot_size: hit.lot_size || p.quantity || 1,
              direct_trading_allowed: hit.direct_trading_allowed,
              exchange: hit.exchange,
              display_name: hit.display_name,
              strike: hit.strike ?? p.strike,
              option_type: hit.option_type ?? p.optionType,
              underlying_symbol: hit.underlying_symbol ?? und,
            }
          : {
              instrument_id: p.id,
              symbol: p.symbol,
              instrument_type: 'OPTION',
              lot_size: p.quantity || 1,
              direct_trading_allowed: true,
              exchange: p.exchange || 'NFO',
              display_name: p.symbol,
              strike: p.strike,
              option_type: p.optionType,
              underlying_symbol: und,
            }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open chart');
    } finally {
      setBusyId(null);
    }
  };

  const toggleWhatIf = (p: PositionRow) => {
    if (whatIfId === p.id) {
      setWhatIfId(null);
      return;
    }
    setWhatIfId(p.id);
    setWhatIfPrice(
      p.lastPrice > 0 ? String(Math.round(p.lastPrice * 100) / 100) : String(p.avgPrice || '')
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 420 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: 16,
              color: '#f1f5f9',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <Shield className="h-4 w-4 text-sky-300" />
            Paper Book
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Simulated F&amp;O positions and order fills — no live broker risk
          </div>
          {mtmMeta?.quoteSource === 'model' || (mtmMeta?.modelMarks || 0) > 0 ? (
            <div style={{ fontSize: 11, color: '#fcd34d', marginTop: 6 }}>
              F&amp;O marks use model premiums (Dhan not connected). Connect Dhan for exchange LTP.
            </div>
          ) : mtmMeta?.quoteSource === 'broker' ? (
            <div style={{ fontSize: 11, color: '#86efac', marginTop: 6 }}>
              F&amp;O LTP from broker quotes
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            setFundMode('add');
            setFundOpen(true);
          }}
          style={{
            ...tabBtn(false),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#059669',
            color: '#fff',
            border: 'none',
          }}
        >
          <Wallet className="h-3.5 w-3.5" />
          Add Funds
        </button>
        <button
          type="button"
          onClick={() => {
            setFundMode('withdraw');
            setFundOpen(true);
          }}
          style={{
            ...tabBtn(false),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#be123c',
            color: '#fff',
            border: 'none',
          }}
        >
          Withdraw Funds
        </button>
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

      {tab === 'positions' && (
        <PositionsTable
          loading={loading}
          positions={positions}
          busyId={busyId}
          whatIfId={whatIfId}
          whatIfPrice={whatIfPrice}
          onWhatIfPrice={setWhatIfPrice}
          onToggleWhatIf={toggleWhatIf}
          onExit={(p, px) => void exitPosition(p, px)}
          onChart={(p) => void openChart(p)}
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

      {chartStock ? (
        <StockChartModal
          stock={chartStock}
          tradeInstrument={chartTrade}
          onClose={() => {
            setChartStock(null);
            setChartTrade(null);
          }}
        />
      ) : null}

      <FundTransferModal
        open={fundOpen}
        initialMode={fundMode}
        onClose={() => setFundOpen(false)}
        onDone={() => void load()}
      />
    </div>
  );
}

function PositionsTable({
  loading,
  positions,
  busyId,
  whatIfId,
  whatIfPrice,
  onWhatIfPrice,
  onToggleWhatIf,
  onExit,
  onChart,
}: {
  loading: boolean;
  positions: PositionRow[];
  busyId: string | null;
  whatIfId: string | null;
  whatIfPrice: string;
  onWhatIfPrice: (v: string) => void;
  onToggleWhatIf: (p: PositionRow) => void;
  onExit: (p: PositionRow, exitPx?: number) => void;
  onChart: (p: PositionRow) => void;
}) {
  if (loading && !positions.length) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>Loading paper book…</div>;
  }
  if (!positions.length) {
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
        No open paper F&amp;O positions. Option fills appear here when typed as OPTION.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(148,163,184,0.15)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['Symbol', 'Side', 'Qty', 'Avg', 'LTP', 'MTM', 'Expiry', 'Actions'].map((h) => (
              <th key={h} style={th}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const target = Number(whatIfPrice);
            const whatIfPnl =
              whatIfId === p.id && Number.isFinite(target) && target > 0
                ? approxPnl(p.side, p.quantity, p.avgPrice, target)
                : null;
            const premiumAtRisk = p.avgPrice * p.quantity;
            const whatIfPct =
              whatIfPnl != null && premiumAtRisk > 0 ? (whatIfPnl / premiumAtRisk) * 100 : null;
            const busy = busyId === p.id;

            return (
              <Fragment key={p.id}>
                <tr>
                  <td style={td}>{p.symbol}</td>
                  <td style={td}>{p.side}</td>
                  <td style={td}>{p.quantity}</td>
                  <td style={td}>{inr(p.avgPrice)}</td>
                  <td style={td}>
                    {inr(p.lastPrice)}
                    {p.mtmSource === 'model' ? (
                      <span style={{ marginLeft: 4, fontSize: 10, color: '#fcd34d' }}>mdl</span>
                    ) : null}
                  </td>
                  <td style={{ ...td, color: p.mtm >= 0 ? '#34d399' : '#f87171' }}>{inr(p.mtm)}</td>
                  <td style={td}>{p.expiry || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={busy}
                        style={actionBtn('rgba(248,113,113,0.75)')}
                        onClick={() => onExit(p)}
                        title="Square off at current LTP"
                      >
                        <LogOut className="h-3 w-3" />
                        Exit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={actionBtn('rgba(56,189,248,0.75)')}
                        onClick={() => onChart(p)}
                        title="Open chart"
                      >
                        <LineChart className="h-3 w-3" />
                        Chart
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        style={actionBtn(
                          whatIfId === p.id ? 'rgba(52,211,153,0.85)' : 'rgba(251,191,36,0.75)'
                        )}
                        onClick={() => onToggleWhatIf(p)}
                        title="Approximate P&L at a target premium"
                      >
                        <Calculator className="h-3 w-3" />
                        What-if
                      </button>
                    </div>
                  </td>
                </tr>
                {whatIfId === p.id ? (
                  <tr>
                    <td colSpan={8} style={{ ...td, background: 'rgba(15,23,42,0.65)', whiteSpace: 'normal' }}>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 12,
                          alignItems: 'center',
                          padding: '4px 0',
                        }}
                      >
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>
                          Approx P&amp;L if exit premium =
                        </span>
                        <input
                          style={inputSm}
                          type="number"
                          min={0}
                          step={0.05}
                          value={whatIfPrice}
                          onChange={(e) => onWhatIfPrice(e.target.value)}
                          aria-label="Target exit premium"
                        />
                        {whatIfPnl != null ? (
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: whatIfPnl >= 0 ? '#34d399' : '#f87171',
                            }}
                          >
                            {inr(whatIfPnl)}
                            {whatIfPct != null
                              ? ` (${whatIfPct >= 0 ? '+' : ''}${whatIfPct.toFixed(1)}% on premium)`
                              : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#64748b' }}>Enter a price &gt; 0</span>
                        )}
                        <span style={{ fontSize: 11, color: '#64748b' }}>
                          Formula: ({p.side === 'SHORT' ? 'avg − exit' : 'exit − avg'}) × qty
                        </span>
                        <button
                          type="button"
                          disabled={busy || !(whatIfPnl != null)}
                          style={actionBtn('rgba(248,113,113,0.75)')}
                          onClick={() => onExit(p, target)}
                        >
                          Exit at this price
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
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
