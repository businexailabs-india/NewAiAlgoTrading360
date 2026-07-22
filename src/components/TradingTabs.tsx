import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { BarChart3, FileText, Radio, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '@/lib/api';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { tradingService } from '@/services/tradingService';

interface CurvePoint {
  date: string;
  value: number;
}

interface MetricRow {
  label: string;
  backtest: string;
  paper: string;
  live: string;
}

interface OrderRow {
  id: string;
  symbol: string;
  tradeType: string;
  quantity: number;
  price: number;
  status: string;
  isPaper: boolean;
  createdAt: string;
  source?: string;
}

interface TradingTabsProps {
  backtestData?: CurvePoint[];
  performanceMetrics?: MetricRow[];
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function buildCurveFromOrders(orders: OrderRow[], paper: boolean): CurvePoint[] {
  const filtered = orders
    .filter((o) => Boolean(o.isPaper) === paper)
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (!filtered.length) return [];

  let equity = 100;
  const byDay = new Map<string, number>();
  for (const o of filtered) {
    const day = (o.createdAt || '').slice(0, 10) || 'n/a';
    const notional = Math.abs(Number(o.price || 0) * Number(o.quantity || 0));
    const bump = notional > 0 ? Math.min(2.5, notional / 50_000) : 0.2;
    equity += o.tradeType?.toUpperCase() === 'SELL' ? bump : -bump * 0.35;
    byDay.set(day, Number(equity.toFixed(2)));
  }
  return Array.from(byDay.entries()).map(([date, value]) => ({ date, value }));
}

function summarizeOrders(orders: OrderRow[]) {
  const buys = orders.filter((o) => o.tradeType?.toUpperCase() === 'BUY').length;
  const sells = orders.filter((o) => o.tradeType?.toUpperCase() === 'SELL').length;
  const complete = orders.filter((o) => String(o.status).toUpperCase() === 'COMPLETE').length;
  const winRate = orders.length ? Math.round((complete / orders.length) * 100) : 0;
  return { buys, sells, complete, winRate, count: orders.length };
}

const tabBtn = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12,
  border: active ? '1px solid rgba(52,211,153,0.55)' : '1px solid rgba(148,163,184,0.2)',
  background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
  color: active ? '#6ee7b7' : '#94a3b8',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

function CurveChart({
  data,
  gradientId,
  stroke,
}: {
  data: CurvePoint[];
  gradientId: string;
  stroke: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 10 }} />
        <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(34,211,238,0.28)',
            borderRadius: 8,
          }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={stroke}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MetricCards({
  metrics,
  valueKey,
}: {
  metrics: MetricRow[];
  valueKey: 'backtest' | 'paper' | 'live';
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {metrics.map((metric) => (
        <div
          key={metric.label}
          style={{
            borderRadius: 10,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(2,6,23,0.4)',
            padding: 12,
          }}
        >
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{metric.label}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0', marginTop: 4 }}>
            {metric[valueKey]}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TradingTabs({
  backtestData: backtestProp,
  performanceMetrics: metricsProp,
}: TradingTabsProps) {
  const { mode, liveLocked, brokers, refresh: refreshMode } = useTradingMode();
  const [activeTab, setActiveTab] = useState<'backtest' | 'paper' | 'live'>(
    mode === 'live' ? 'live' : 'paper'
  );
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string; mode: string; isActive: boolean }>>(
    []
  );
  const [paperCash, setPaperCash] = useState<number | null>(null);
  const [benchCurve, setBenchCurve] = useState<CurvePoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(mode === 'live' ? 'live' : 'paper');
  }, [mode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordRes, paperRes, perfRes, agentList] = await Promise.all([
        fetch(`${API_BASE_URL}/orders`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/paper/account`, { headers: authHeaders() }).then((r) => r.json()),
        fetch(`${API_BASE_URL}/portfolio/performance-comparison?timeRange=3M`, {
          headers: authHeaders(),
        }).then((r) => r.json()),
        tradingService.listAgents().catch(() => []),
      ]);

      const orderRows: OrderRow[] = Array.isArray(ordRes?.data)
        ? ordRes.data.map((o: Record<string, unknown>, i: number) => ({
            id: String(o.id || i),
            symbol: String(o.symbol || '—'),
            tradeType: String(o.tradeType || o.side || 'BUY'),
            quantity: Number(o.quantity || 0),
            price: Number(o.price || o.avgPrice || 0),
            status: String(o.status || '—'),
            isPaper: Boolean(o.isPaper),
            createdAt: String(o.createdAt || o.executedAt || ''),
            source: String(o.source || ''),
          }))
        : [];
      setOrders(orderRows);

      if (paperRes?.success && paperRes.data) {
        setPaperCash(Number(paperRes.data.cashBalance));
      }

      const perf = Array.isArray(perfRes?.data?.performanceData)
        ? perfRes.data.performanceData.map((p: { date: string; smallcap?: number }) => ({
            date: String(p.date).slice(5),
            value: Number(p.smallcap || 100),
          }))
        : [];
      setBenchCurve(perf);

      setAgents(
        (Array.isArray(agentList) ? agentList : []).map((a: Record<string, unknown>) => ({
          id: String(a.id),
          name: String(a.name || 'Agent'),
          mode: String(a.mode || 'paper'),
          isActive: Boolean(a.isActive),
        }))
      );

      await refreshMode().catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trading desk');
    } finally {
      setLoading(false);
    }
  }, [refreshMode]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const paperOrders = useMemo(() => orders.filter((o) => o.isPaper), [orders]);
  const liveOrders = useMemo(() => orders.filter((o) => !o.isPaper), [orders]);
  const paperCurve = useMemo(
    () => (backtestProp?.length ? backtestProp : buildCurveFromOrders(orders, true)),
    [backtestProp, orders]
  );
  const liveCurve = useMemo(() => buildCurveFromOrders(orders, false), [orders]);
  const backtestCurve = useMemo(
    () => (backtestProp?.length ? backtestProp : benchCurve),
    [backtestProp, benchCurve]
  );

  const paperSum = summarizeOrders(paperOrders);
  const liveSum = summarizeOrders(liveOrders);
  const dhan = brokers?.connections?.find((c) => String(c.broker).toLowerCase() === 'dhan');

  const metrics: MetricRow[] = metricsProp?.length
    ? metricsProp
    : [
        {
          label: 'Orders',
          backtest: String(backtestCurve.length || '—'),
          paper: String(paperSum.count),
          live: String(liveSum.count),
        },
        {
          label: 'Fill rate',
          backtest: backtestCurve.length ? '—' : '—',
          paper: paperSum.count ? `${paperSum.winRate}%` : '—',
          live: liveSum.count ? `${liveSum.winRate}%` : '—',
        },
        {
          label: 'Buy / Sell',
          backtest: '—',
          paper: paperSum.count ? `${paperSum.buys}/${paperSum.sells}` : '—',
          live: liveSum.count ? `${liveSum.buys}/${liveSum.sells}` : '—',
        },
        {
          label: 'Capital / status',
          backtest: benchCurve.length ? 'Benchmark' : 'No QC run',
          paper: paperCash != null ? `₹${Math.round(paperCash).toLocaleString('en-IN')}` : '—',
          live: dhan
            ? dhan.status === 'CONNECTED'
              ? 'Dhan CONNECTED'
              : `Dhan ${dhan.status}`
            : liveLocked
              ? 'No broker'
              : mode === 'live'
                ? 'LIVE mode'
                : 'PAPER mode',
        },
      ];

  const tabOrders =
    activeTab === 'live' ? liveOrders : activeTab === 'paper' ? paperOrders : paperOrders.slice(0, 8);
  const tabCurve =
    activeTab === 'backtest' ? backtestCurve : activeTab === 'paper' ? paperCurve : liveCurve;
  const curveStroke =
    activeTab === 'live' ? '#34d399' : activeTab === 'paper' ? '#38bdf8' : '#67e8f9';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 420 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#f1f5f9' }}>Trading Desk</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Live desk · backtest benchmark · paper fills · live broker orders
          </div>
        </div>
        <button type="button" onClick={() => void load()} style={tabBtn(false)} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5" style={{ opacity: loading ? 0.5 : 1 }} />
          {loading ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={() => setActiveTab('backtest')} style={tabBtn(activeTab === 'backtest')}>
          <BarChart3 className="h-3.5 w-3.5" /> Backtest
        </button>
        <button type="button" onClick={() => setActiveTab('paper')} style={tabBtn(activeTab === 'paper')}>
          <FileText className="h-3.5 w-3.5" /> Paper Trade
        </button>
        <button type="button" onClick={() => setActiveTab('live')} style={tabBtn(activeTab === 'live')}>
          <Radio className="h-3.5 w-3.5" /> Live
        </button>
        <span style={{ fontSize: 11, color: mode === 'live' ? '#6ee7b7' : '#7dd3fc', marginLeft: 4 }}>
          TopBar mode: {mode.toUpperCase()}
          {agents.length ? ` · ${agents.filter((a) => a.isActive).length}/${agents.length} agents active` : ''}
        </span>
      </div>

      {error ? (
        <div style={{ fontSize: 12, color: '#fca5a5', padding: 10, borderRadius: 8, border: '1px solid rgba(248,113,113,0.35)' }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background:
                activeTab === 'live'
                  ? mode === 'live'
                    ? '#34d399'
                    : '#fbbf24'
                  : activeTab === 'paper'
                    ? '#38bdf8'
                    : '#67e8f9',
            }}
          />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
            {activeTab === 'backtest'
              ? 'Backtest / benchmark'
              : activeTab === 'paper'
                ? 'Paper Trading (Active fills)'
                : mode === 'live'
                  ? 'Live Trading (mode ON)'
                  : 'Live Trading (mode OFF — switch TopBar to LIVE)'}
          </h3>
        </div>

        {activeTab === 'live' && dhan && dhan.status !== 'CONNECTED' ? (
          <div style={warnBox}>
            <div style={{ fontWeight: 650, marginBottom: 4 }}>Dhan is {dhan.status} — live curve stays empty</div>
            <div style={{ color: '#fde68a', lineHeight: 1.45 }}>
              Platform Broker Connections uses a Direct API token (separate from Cursor Dhan MCP). Fix:
              1) Dhan web → profile → API / Access Token → copy fresh token
              2) App → Integrations / Broker Connections → paste Client ID + Access Token → Save &amp; Sync
              3) Or update <code style={{ color: '#fef3c7' }}>DHAN_ACCESS_TOKEN</code> in{' '}
              <code style={{ color: '#fef3c7' }}>backend/.env</code> then Import from .env &amp; Sync
              <br />
              Paper fills remain under <strong>Paper Trade</strong> until Dhan shows CONNECTED.
            </div>
          </div>
        ) : null}

        {tabCurve.length ? (
          <CurveChart
            data={tabCurve}
            gradientId={`desk-${activeTab}`}
            stroke={curveStroke}
          />
        ) : (
          <div style={emptyBox}>
            {activeTab === 'live'
              ? 'No live broker orders yet. Paper activity is under Paper Trade.'
              : activeTab === 'paper'
                ? 'No paper orders yet — run Paper Momentum Desk or Place Paper Order.'
                : 'No backtest/benchmark series yet — sync holdings or run a strategy backtest.'}
          </div>
        )}

        <MetricCards
          metrics={metrics}
          valueKey={activeTab === 'backtest' ? 'backtest' : activeTab === 'paper' ? 'paper' : 'live'}
        />

        <div>
          <div style={{ fontSize: 12, fontWeight: 650, color: '#e2e8f0', marginBottom: 8 }}>
            Recent {activeTab === 'backtest' ? 'paper' : activeTab} orders
          </div>
          <div style={tableWrap}>
            {!tabOrders.length ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                No orders in this lane
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ color: '#94a3b8' }}>
                    <th style={th}>When</th>
                    <th style={th}>Symbol</th>
                    <th style={th}>Side</th>
                    <th style={th}>Qty</th>
                    <th style={th}>Price</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tabOrders.slice(0, 12).map((o) => (
                    <tr key={o.id} style={{ borderTop: '1px solid rgba(148,163,184,0.12)', color: '#e2e8f0' }}>
                      <td style={td}>{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{o.symbol}</td>
                      <td
                        style={{
                          ...td,
                          color: o.tradeType.toUpperCase().includes('SELL') ? '#f87171' : '#34d399',
                        }}
                      >
                        {o.tradeType}
                      </td>
                      <td style={td}>{o.quantity}</td>
                      <td style={td}>{o.price ? o.price.toFixed(2) : '—'}</td>
                      <td style={td}>{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          borderRadius: 12,
          border: '1px solid rgba(34,211,238,0.22)',
          background: 'rgba(15,23,42,0.7)',
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 12 }}>Performance Comparison</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: 8,
            padding: '8px 10px',
            fontSize: 11,
            color: '#64748b',
            borderBottom: '1px solid rgba(148,163,184,0.2)',
          }}
        >
          <span>Metric</span>
          <span style={{ textAlign: 'right' }}>Backtest</span>
          <span style={{ textAlign: 'right' }}>Paper</span>
          <span style={{ textAlign: 'right' }}>Live</span>
        </div>
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 8,
              padding: '12px 10px',
              borderBottom: '1px solid rgba(148,163,184,0.12)',
              color: '#e2e8f0',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#cbd5e1' }}>{metric.label}</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>{metric.backtest}</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>{metric.paper}</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>{metric.live}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const emptyBox: CSSProperties = {
  height: 220,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#64748b',
  fontSize: 13,
  borderRadius: 12,
  border: '1px dashed rgba(148,163,184,0.25)',
  background: 'rgba(2,6,23,0.35)',
  padding: 16,
  textAlign: 'center',
};

const warnBox: CSSProperties = {
  fontSize: 12,
  color: '#fbbf24',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(251,191,36,0.35)',
  background: 'rgba(120,53,15,0.25)',
};

const tableWrap: CSSProperties = {
  maxHeight: 240,
  overflow: 'auto',
  borderRadius: 8,
  border: '1px solid rgba(34,211,238,0.2)',
  background: 'rgba(2,6,23,0.85)',
};

const th: CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  position: 'sticky',
  top: 0,
  background: '#0f172a',
};

const td: CSSProperties = { padding: '8px 10px' };
