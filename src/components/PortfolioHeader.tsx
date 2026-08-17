import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { API_BASE_URL } from '@/lib/api';
import {
  portfolioService,
  type PortfolioSummary,
  type PortfolioView,
} from '../services/portfolioService';

type BookFilter = 'all' | 'paper' | 'live';

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
  pnlPercentage: number;
  product: string;
  broker: string;
  isPaper: boolean;
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
  isPaper: boolean;
};

type TradeRow = {
  id: string;
  symbol: string;
  tradeType: string;
  quantity: number;
  price: number;
  status: string;
  executedAt: string;
  broker: string;
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

function pct(n: number) {
  const v = Number(n || 0);
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

const pill = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12,
  border: active ? '1px solid rgba(34,211,238,0.55)' : '1px solid rgba(148,163,184,0.2)',
  background: active ? 'rgba(6,182,212,0.18)' : 'transparent',
  color: active ? '#67e8f8' : '#94a3b8',
  cursor: 'pointer',
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

export function PortfolioHeader() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioView | null>(null);
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [paperCash, setPaperCash] = useState<number | null>(null);
  const [paperRealized, setPaperRealized] = useState(0);
  const [filter, setFilter] = useState<BookFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'holdings' | 'positions' | 'trades'>('holdings');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryVal, portfoliosVal, holdRes, posRes, paperPosRes, tradesVal, paperRes] =
        await Promise.all([
          portfolioService.getSummary().catch(() => null),
          portfolioService.getPortfolios().catch(() => [] as PortfolioView[]),
          fetch(`${API_BASE_URL}/portfolio/holdings`, { headers: authHeaders() }).then((r) =>
            r.json()
          ),
          portfolioService.getPositions().catch(() => ({ positions: [] })),
          fetch(`${API_BASE_URL}/live/positions?isPaper=true`, { headers: authHeaders() }).then((r) =>
            r.json()
          ),
          portfolioService.getTrades().catch(() => []),
          fetch(`${API_BASE_URL}/paper/account`, { headers: authHeaders() }).then((r) => r.json()),
        ]);

      setSummary(summaryVal);
      setPortfolio(portfoliosVal[0] ?? null);

      if (paperRes?.success && paperRes.data) {
        setPaperCash(Number(paperRes.data.cashBalance ?? 0));
        setPaperRealized(Number(paperRes.data.realizedPnl ?? 0));
      }

      const rawHoldings = Array.isArray(holdRes?.data) ? holdRes.data : [];
      setHoldings(
        rawHoldings.map((h: Record<string, unknown>, i: number) => {
          const broker = String(
            (h.brokerConnection as { broker?: string } | undefined)?.broker || h.broker || '—'
          ).toLowerCase();
          const isPaper = broker === 'paper';
          return {
            id: String(h.id || i),
            symbol: String(h.symbol || '—'),
            exchange: String(h.exchange || '—'),
            quantity: Number(h.quantity || 0),
            averagePrice: Number(h.averagePrice || 0),
            lastPrice: Number(h.lastPrice || 0),
            investedValue: Number(h.investedValue || 0),
            currentValue: Number(h.currentValue || 0),
            pnl: Number(h.pnl || 0),
            pnlPercentage: Number(h.pnlPercentage || 0),
            product: String(h.product || 'CNC'),
            broker,
            isPaper,
          };
        }).filter((h: HoldingRow) => h.quantity > 0)
      );

      const fnoPaper = Array.isArray(paperPosRes?.data) ? paperPosRes.data : [];
      const portfolioPos = Array.isArray(posRes?.positions) ? posRes.positions : [];
      const mergedPos: PositionRow[] = [];

      for (const p of fnoPaper as Array<Record<string, unknown>>) {
        const qty = Math.abs(Number(p.quantity || 0));
        if (!qty) continue;
        mergedPos.push({
          id: String(p.id || `fno-${mergedPos.length}`),
          symbol: String(p.tradingSymbol || p.symbol || '—'),
          side: String(p.side || 'LONG'),
          quantity: qty,
          avgPrice: Number(p.avgPrice || p.averagePrice || 0),
          lastPrice: Number(p.lastPrice || 0),
          mtm: Number(p.mtm || 0),
          product: String(p.product || 'NRML'),
          isPaper: true,
        });
      }

      for (const p of portfolioPos as Array<Record<string, unknown>>) {
        if (String(p.status || '').toLowerCase() === 'closed') continue;
        if (String(p.source || '') === 'holding') continue;
        const qty = Math.abs(Number(p.quantity || 0));
        if (!qty) continue;
        const id = String(p.id || `pos-${mergedPos.length}`);
        if (mergedPos.some((m) => m.id === id || m.symbol === String(p.symbol))) continue;
        mergedPos.push({
          id,
          symbol: String(p.symbol || '—'),
          side: String(p.side || 'BUY'),
          quantity: qty,
          avgPrice: Number(p.averagePrice || p.avgPrice || 0),
          lastPrice: Number(p.lastPrice || p.ltp || 0),
          mtm: Number(p.pnl || p.mtm || 0),
          product: String(p.product || ''),
          isPaper: Boolean(p.isPaper),
        });
      }
      setPositions(mergedPos);

      setTrades(
        (Array.isArray(tradesVal) ? tradesVal : []).slice(0, 40).map((t: Record<string, unknown>, i: number) => ({
          id: String(t.id || i),
          symbol: String(t.symbol || '—'),
          tradeType: String(t.tradeType || t.side || 'BUY'),
          quantity: Number(t.quantity || 0),
          price: Number(t.price || 0),
          status: String(t.status || '—'),
          executedAt: String(t.executedAt || t.createdAt || ''),
          broker: String(
            (t.brokerConnection as { broker?: string } | undefined)?.broker || t.broker || '—'
          ),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load portfolio overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const visibleHoldings = useMemo(() => {
    if (filter === 'paper') return holdings.filter((h) => h.isPaper);
    if (filter === 'live') return holdings.filter((h) => !h.isPaper);
    return holdings;
  }, [holdings, filter]);

  const visiblePositions = useMemo(() => {
    if (filter === 'paper') return positions.filter((p) => p.isPaper);
    if (filter === 'live') return positions.filter((p) => !p.isPaper);
    return positions;
  }, [positions, filter]);

  const bookInvested = useMemo(
    () => visibleHoldings.reduce((s, h) => s + h.investedValue, 0),
    [visibleHoldings]
  );
  const bookCurrent = useMemo(
    () => visibleHoldings.reduce((s, h) => s + h.currentValue, 0),
    [visibleHoldings]
  );
  const bookPnl = bookCurrent - bookInvested;
  const bookPnlPct = bookInvested > 0 ? (bookPnl / bookInvested) * 100 : 0;
  const positionsMtm = useMemo(
    () => visiblePositions.reduce((s, p) => s + p.mtm, 0),
    [visiblePositions]
  );
  const dayChange = portfolio?.dayPnL;
  const totalCurrent = summary?.totalCurrent ?? bookCurrent;
  const totalInvested = summary?.totalInvested ?? bookInvested;
  const totalPnl = summary?.totalPnL ?? bookPnl;
  const totalPnlPct = summary?.totalPnLPercent ?? bookPnlPct;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Portfolio Overview</div>
          <h1 className="text-lg text-slate-200 font-semibold">
            {portfolio?.name || 'Combined book'}
          </h1>
          <div className="flex items-baseline gap-3 mt-2 flex-wrap">
            <span className="text-3xl text-white font-semibold tabular-nums">
              {loading && !summary ? '—' : inr(totalCurrent)}
            </span>
            <span
              className={`text-sm tabular-nums ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {pct(totalPnlPct)} · {inr(totalPnl)}
            </span>
            {dayChange == null ? (
              <span className="text-xs text-slate-500">Day change n/a</span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 text-sm ${
                  dayChange >= 0 ? 'text-cyan-400' : 'text-red-400'
                }`}
              >
                {dayChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {dayChange >= 0 ? '+' : ''}
                {inr(Math.abs(dayChange), 0)} today
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['all', 'paper', 'live'] as BookFilter[]).map((f) => (
            <button key={f} type="button" style={pill(filter === f)} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'paper' ? 'Paper' : 'Live'}
            </button>
          ))}
          <button type="button" style={pill(false)} onClick={() => void load()} disabled={loading}>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" style={{ opacity: loading ? 0.5 : 1 }} />
              Refresh
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Metric label="Invested" value={inr(totalInvested, 0)} />
        <Metric label="Current value" value={inr(totalCurrent, 0)} />
        <Metric
          label="Unrealized P&L"
          value={inr(totalPnl)}
          tone={totalPnl >= 0 ? 'up' : 'down'}
        />
        <Metric label="Holdings" value={String(visibleHoldings.length)} sub={`${summary?.holdingsCount ?? holdings.length} total`} />
        <Metric
          label="Paper cash"
          value={paperCash == null ? '—' : inr(paperCash, 0)}
          sub={`Realized ${inr(paperRealized)}`}
        />
        <Metric
          label="Open positions"
          value={String(visiblePositions.length)}
          sub={`MTM ${inr(positionsMtm)}`}
          tone={positionsMtm >= 0 ? 'up' : 'down'}
        />
      </div>

      {error ? (
        <div className="text-sm text-red-300 border border-red-500/30 rounded-lg px-3 py-2">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2 flex-wrap">
        {(
          [
            ['holdings', `Holdings (${visibleHoldings.length})`],
            ['positions', `Positions (${visiblePositions.length})`],
            ['trades', `Trades (${trades.length})`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" style={pill(detailTab === id)} onClick={() => setDetailTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {detailTab === 'holdings' && (
        <DetailTable
          loading={loading}
          empty={
            filter === 'paper'
              ? 'No paper holdings yet. Place a paper Buy from Trading Terminal.'
              : filter === 'live'
                ? 'No live broker holdings synced.'
                : 'No holdings yet. Sync a broker or place paper trades.'
          }
          headers={['Symbol', 'Exch', 'Broker', 'Qty', 'Avg', 'LTP', 'Invested', 'Current', 'P&L', '%', 'Product']}
          rows={visibleHoldings.map((h) => [
            h.symbol,
            h.exchange,
            <span key={`${h.id}-b`} className={h.isPaper ? 'text-sky-300' : 'text-emerald-300'}>
              {h.broker}
            </span>,
            String(h.quantity),
            inr(h.averagePrice),
            inr(h.lastPrice),
            inr(h.investedValue, 0),
            inr(h.currentValue, 0),
            <span key={`${h.id}-p`} className={h.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {inr(h.pnl)}
            </span>,
            <span key={`${h.id}-pp`} className={h.pnlPercentage >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {pct(h.pnlPercentage)}
            </span>,
            h.product,
          ])}
        />
      )}

      {detailTab === 'positions' && (
        <DetailTable
          loading={loading}
          empty="No open positions for this filter."
          headers={['Symbol', 'Side', 'Book', 'Qty', 'Avg', 'LTP', 'MTM', 'Product']}
          rows={visiblePositions.map((p) => [
            p.symbol,
            p.side,
            <span key={`${p.id}-b`} className={p.isPaper ? 'text-sky-300' : 'text-emerald-300'}>
              {p.isPaper ? 'paper' : 'live'}
            </span>,
            String(p.quantity),
            inr(p.avgPrice),
            inr(p.lastPrice),
            <span key={`${p.id}-m`} className={p.mtm >= 0 ? 'text-emerald-400' : 'text-red-400'}>
              {inr(p.mtm)}
            </span>,
            p.product || '—',
          ])}
        />
      )}

      {detailTab === 'trades' && (
        <DetailTable
          loading={loading}
          empty="No trades recorded yet."
          headers={['Time', 'Symbol', 'Side', 'Qty', 'Price', 'Status', 'Broker']}
          rows={trades.map((t) => [
            (t.executedAt || '').replace('T', ' ').slice(0, 19) || '—',
            t.symbol,
            <span
              key={`${t.id}-s`}
              className={t.tradeType.toUpperCase() === 'BUY' ? 'text-emerald-400' : 'text-red-400'}
            >
              {t.tradeType}
            </span>,
            String(t.quantity),
            inr(t.price),
            t.status,
            t.broker,
          ])}
        />
      )}

      <div className="text-xs text-slate-500">
        Filter: <span className="text-slate-300">{filter}</span>
        {' · '}
        Cash available: {summary?.availableCash != null ? inr(summary.availableCash, 0) : '—'}
        {' · '}
        Active brokers: {summary?.activeBrokers ?? '—'}
        {' · '}
        Live engines: {summary?.liveStrategies ?? '—'}
      </div>
    </motion.div>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'up' | 'down';
}) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/50 px-3 py-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div
        className={`mt-1 text-sm font-semibold tabular-nums ${
          tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-red-400' : 'text-slate-100'
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div> : null}
    </div>
  );
}

function DetailTable({
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
    return <div className="text-sm text-slate-500 py-6">Loading portfolio detail…</div>;
  }
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-700/70 px-4 py-8 text-sm text-slate-400">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700/50">
      <table className="w-full border-collapse">
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
