import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Radio, Shield } from 'lucide-react';
import { marketAnalyticsApi } from './api/marketAnalyticsApi';
import { ChartProviderHost } from './charts/ChartProvider';
import { lightweightChartsProvider } from './charts/LightweightChartsProvider';

type PageId =
  | 'overview'
  | 'markets'
  | 'strategies'
  | 'signals'
  | 'paper'
  | 'orders'
  | 'positions'
  | 'portfolio'
  | 'performance'
  | 'risk'
  | 'brokers'
  | 'tvsetup'
  | 'alerts'
  | 'audit'
  | 'settings';

const NAV: { id: PageId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'markets', label: 'Markets' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'signals', label: 'Signals' },
  { id: 'paper', label: 'Paper Trading' },
  { id: 'orders', label: 'Orders' },
  { id: 'positions', label: 'Positions' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'performance', label: 'Performance' },
  { id: 'risk', label: 'Risk' },
  { id: 'brokers', label: 'Broker Accounts' },
  { id: 'tvsetup', label: 'TradingView Setup' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'audit', label: 'Audit Log' },
  { id: 'settings', label: 'Settings' },
];

function Metric({
  label,
  value,
  currency,
  updated,
  stale,
}: {
  label: string;
  value: React.ReactNode;
  currency?: string;
  updated?: string;
  stale?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-100">
        {value}
        {currency ? <span className="ml-1 text-xs text-slate-400">{currency}</span> : null}
      </div>
      <div className={`mt-1 text-[10px] ${stale ? 'text-amber-400' : 'text-slate-500'}`}>
        {stale ? 'STALE · ' : ''}
        {updated ? `Updated ${updated}` : '—'}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-600 p-6 text-center text-sm text-slate-400">{text}</div>;
}

function ErrorBox({ error }: { error: Error }) {
  return (
    <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-200">
      {error.message}
    </div>
  );
}

export function MarketAnalyticsShell() {
  const [page, setPage] = useState<PageId>('overview');
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [webhookSecretOnce, setWebhookSecretOnce] = useState<string | null>(null);
  const qc = useQueryClient();

  const summaryQ = useQuery({ queryKey: ['ma', 'summary'], queryFn: () => marketAnalyticsApi.summary(), refetchInterval: 15000 });
  const signalsQ = useQuery({ queryKey: ['ma', 'signals'], queryFn: () => marketAnalyticsApi.signals(), refetchInterval: 10000 });
  const accountsQ = useQuery({ queryKey: ['ma', 'accounts'], queryFn: () => marketAnalyticsApi.accounts() });
  const strategiesQ = useQuery({ queryKey: ['ma', 'strategies'], queryFn: () => marketAnalyticsApi.strategies() });
  const riskQ = useQuery({ queryKey: ['ma', 'risk'], queryFn: () => marketAnalyticsApi.risk() });
  const perfQ = useQuery({ queryKey: ['ma', 'perf'], queryFn: () => marketAnalyticsApi.performance() });
  const auditQ = useQuery({ queryKey: ['ma', 'audit'], queryFn: () => marketAnalyticsApi.audit() });
  const healthQ = useQuery({ queryKey: ['ma', 'wh'], queryFn: () => marketAnalyticsApi.webhookHealth() });
  const safetyQ = useQuery({ queryKey: ['ma', 'safety'], queryFn: () => marketAnalyticsApi.safety() });

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['ma'] });
  }, [qc]);

  useEffect(() => {
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  const summary = summaryQ.data?.data;
  const signals = signalsQ.data?.data || [];
  const accounts = accountsQ.data?.data || [];
  const chart = useMemo(() => lightweightChartsProvider, []);

  return (
    <ChartProviderHost provider={chart}>
      <div className="flex h-full min-h-[640px] flex-col gap-3 text-slate-100">
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-teal-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
              <Shield className="h-3.5 w-3.5" /> BxAi Trade Market Analytics
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Paper-only market analytics</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              TradingView signals → server risk → simulated / broker-paper execution. Live trading is not available and cannot be enabled.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <div className="flex items-center gap-1 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" /> PAPER / SIGNAL ONLY
            </div>
            <div className="mt-1 text-amber-100/80">Mode: {summary?.tradingMode || safetyQ.data?.data?.tradingMode || '…'}</div>
            <div>Kill switch: {summary?.killSwitch ? 'ON' : 'OFF'}</div>
            <div>Source: {summary?.sourceLabel || '—'}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setPage(n.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                page === n.id ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {n.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-700/50 bg-slate-950/50 p-4">
          {page === 'overview' && (
            <div className="space-y-4">
              {summaryQ.isLoading && <Empty text="Loading dashboard…" />}
              {summaryQ.error && <ErrorBox error={summaryQ.error as Error} />}
              {summary && (
                <>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
                    <Metric label="Paper equity" value={summary.equity?.toFixed?.(2) ?? summary.equity} currency={summary.currency} updated={summary.lastUpdated} />
                    <Metric label="Daily P&L" value={summary.dailyPnl} currency={summary.currency} updated={summary.lastUpdated} />
                    <Metric label="Weekly P&L" value={summary.weeklyPnl} currency={summary.currency} updated={summary.lastUpdated} />
                    <Metric label="Buying power" value={summary.buyingPower} currency={summary.currency} updated={summary.lastUpdated} />
                    <Metric label="Capital deployed" value={summary.capitalDeployed?.toFixed?.(2)} currency={summary.currency} updated={summary.lastUpdated} />
                    <Metric label="Capital at risk" value={summary.capitalAtRisk?.toFixed?.(2)} currency={summary.currency} updated={summary.lastUpdated} />
                    <Metric label="Drawdown" value={`${(summary.drawdownPct * 100).toFixed(2)}%`} updated={summary.lastUpdated} />
                    <Metric label="Signals today" value={`${summary.acceptedToday}/${summary.signalsToday} acc`} updated={summary.lastUpdated} />
                    <Metric label="Rejected today" value={summary.rejectedToday} updated={summary.lastUpdated} />
                    <Metric label="Open orders" value={summary.openOrders} updated={summary.lastUpdated} />
                    <Metric label="Broker" value={summary.brokerHealth} updated={summary.lastUpdated} />
                    <Metric
                      label="Data age"
                      value={`${summary.dataFreshnessSeconds}s`}
                      updated={summary.lastUpdated}
                      stale={summary.dataFreshnessSeconds > 30}
                    />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Recent signals</h3>
                      {signals.length === 0 ? (
                        <Empty text="No signals yet — send a test alert from TradingView Setup." />
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {signals.slice(0, 8).map((s: any) => (
                            <li key={s.id} className="flex justify-between rounded-lg bg-slate-900/70 px-3 py-2">
                              <span>
                                {s.symbol} · {s.status}
                              </span>
                              <span className="text-slate-400">{s.createdAt}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">Webhook health</h3>
                      <pre className="overflow-auto rounded-lg bg-slate-900/70 p-3 text-xs text-slate-300">
                        {JSON.stringify(summary.webhookHealth, null, 2)}
                      </pre>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {page === 'markets' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400">{chart.licenseNote}</p>
              {chart.renderChart({
                symbol: 'SPY',
                candles: demoCandles(),
                overlays: signals[0]
                  ? {
                      entry: signals[0].entryPrice,
                      stop: signals[0].stopPrice,
                      target: signals[0].targetPrice,
                      orHigh: signals[0].indicators?.opening_range_high,
                      orLow: signals[0].indicators?.opening_range_low,
                      vwap: signals[0].indicators?.vwap,
                      ema: signals[0].indicators?.ema,
                    }
                  : undefined,
              })}
              <Empty text="Market data from simulated/broker adapters only — not scraped from TradingView." />
            </div>
          )}

          {page === 'strategies' && (
            <div className="space-y-3">
              {(strategiesQ.data?.data || []).map((s: any) => (
                <div key={s.id} className="rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-slate-400">
                        {s.strategyKey} · Pine v6 · {s.enabled ? 'enabled' : 'disabled'}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs"
                      onClick={() => marketAnalyticsApi.patchStrategy(s.id, { enabled: !s.enabled }).then(refresh)}
                    >
                      {s.enabled ? 'Disable signals' : 'Enable signals'}
                    </button>
                  </div>
                  <pre className="mt-2 text-xs text-slate-400">{JSON.stringify(s.parameters, null, 2)}</pre>
                  <a className="mt-2 inline-block text-xs text-teal-300 underline" href="/tradingview/pine/orb_regime_long_strategy.pine" download>
                    Download Pine strategy
                  </a>
                </div>
              ))}
              {!strategiesQ.data?.data?.length && <Empty text="No strategies — demo seed creates orb-v1." />}
            </div>
          )}

          {page === 'signals' && (
            <div className="space-y-3">
              {signalsQ.isLoading && <Empty text="Loading signals…" />}
              <div className="overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="p-2">Time</th>
                      <th>Symbol</th>
                      <th>Status</th>
                      <th>Qty</th>
                      <th>Entry</th>
                      <th>Stop</th>
                      <th>Target</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s: any) => (
                      <tr
                        key={s.id}
                        className="cursor-pointer border-t border-slate-800 hover:bg-slate-900/80"
                        onClick={() => setSelectedSignal(s.id)}
                      >
                        <td className="p-2">{s.createdAt}</td>
                        <td>{s.symbol}</td>
                        <td>{s.status}</td>
                        <td>{s.quantity}</td>
                        <td>{s.entryPrice}</td>
                        <td>{s.stopPrice}</td>
                        <td>{s.targetPrice}</td>
                        <td className="max-w-[180px] truncate text-slate-400">{s.rejectReason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedSignal && (
                <SignalDrawer id={selectedSignal} onClose={() => setSelectedSignal(null)} />
              )}
            </div>
          )}

          {page === 'paper' && (
            <div className="space-y-3 text-sm">
              <p>
                Modes: <strong>signal</strong> → <strong>simulated</strong> → <strong>broker_paper</strong>. Dual flags required:{' '}
                <code>ENABLE_PAPER_ORDERS=YES</code> and <code>PAPER_ORDER_CONFIRMATION=YES</code>.
              </p>
              <p className="text-amber-200">No browser order placement. All orders are server-side after risk gates.</p>
              <button
                type="button"
                className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-slate-950"
                onClick={() => marketAnalyticsApi.testWebhook().then(refresh)}
              >
                Send test alert (server)
              </button>
            </div>
          )}

          {page === 'orders' && (
            <OrdersFromAccounts accounts={accounts} />
          )}

          {page === 'positions' && (
            <PositionsFromAccounts accounts={accounts} />
          )}

          {page === 'portfolio' && summary && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Equity" value={summary.equity} currency={summary.currency} updated={summary.lastUpdated} />
              <Metric label="Peak" value={summary.equityPeak} currency={summary.currency} updated={summary.lastUpdated} />
              <Metric label="Realized" value={summary.realizedPnl} currency={summary.currency} updated={summary.lastUpdated} />
              <Metric label="Unrealized" value={summary.unrealizedPnl} currency={summary.currency} updated={summary.lastUpdated} />
            </div>
          )}

          {page === 'performance' && (
            <div className="space-y-2">
              {perfQ.error && <ErrorBox error={perfQ.error as Error} />}
              <pre className="rounded-lg bg-slate-900/70 p-3 text-xs">{JSON.stringify(perfQ.data?.data, null, 2)}</pre>
              <p className="text-xs text-slate-500">TV backtest / simulation / broker-paper series are labeled separately and never blended silently.</p>
            </div>
          )}

          {page === 'risk' && (
            <div className="space-y-3">
              <pre className="rounded-lg bg-slate-900/70 p-3 text-xs">{JSON.stringify(riskQ.data?.data, null, 2)}</pre>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold"
                  onClick={() => {
                    if (confirm('Activate kill switch? Blocks new entries; cancels strategy entries only.')) {
                      void marketAnalyticsApi.killOn('ui').then(refresh);
                    }
                  }}
                >
                  Activate kill switch
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-700 px-3 py-2 text-xs"
                  onClick={() => marketAnalyticsApi.killOff().then(refresh)}
                >
                  Deactivate
                </button>
              </div>
            </div>
          )}

          {page === 'brokers' && (
            <div className="space-y-3">
              {accounts.map((a: any) => (
                <div key={a.id} className="rounded-xl border border-slate-700/50 p-3 text-sm">
                  <div className="font-semibold">
                    {a.connectionName}{' '}
                    {a.isDemo ? <span className="text-amber-300">DEMO</span> : null}
                  </div>
                  <div className="text-xs text-slate-400">
                    {a.brokerType} · {a.paperAccountId} · NLV {a.netLiquidation} {a.baseCurrency}
                  </div>
                  <button
                    type="button"
                    className="mt-2 rounded bg-slate-800 px-2 py-1 text-xs"
                    onClick={() => marketAnalyticsApi.reconcile(a.id).then(refresh)}
                  >
                    Reconcile
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg bg-teal-700 px-3 py-2 text-xs"
                onClick={() =>
                  marketAnalyticsApi
                    .connectAccount({
                      connectionName: 'Sim Paper',
                      brokerType: 'SIMULATED',
                      paperAccountId: 'SIM-PAPER-002',
                      baseCurrency: 'USD',
                    })
                    .then(refresh)
                }
              >
                Connect simulated paper account
              </button>
              <p className="text-xs text-slate-500">Live account IDs (U*) are rejected. Never auto-selects first account.</p>
            </div>
          )}

          {page === 'tvsetup' && (
            <div className="space-y-3 text-sm leading-relaxed">
              <ol className="list-decimal space-y-1 pl-5 text-slate-300">
                <li>Select strategy orb-v1</li>
                <li>Use 15m chart, RTH session</li>
                <li>Copy Pine from <code>tradingview/pine/</code></li>
                <li>Create alert: Any alert() function call</li>
                <li>Create webhook endpoint below; copy URL + secret once</li>
                <li>Send test alert</li>
                <li>Stay in signal-only until 20+ sessions validated</li>
              </ol>
              <pre className="rounded-lg bg-slate-900/70 p-3 text-xs">{JSON.stringify(healthQ.data?.data, null, 2)}</pre>
              <button
                type="button"
                className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-slate-950"
                onClick={() =>
                  marketAnalyticsApi.createWebhook().then((r) => {
                    setWebhookSecretOnce(r.data?.secret || null);
                    refresh();
                  })
                }
              >
                Create / rotate webhook endpoint
              </button>
              {webhookSecretOnce && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 p-3 text-xs">
                  Secret (shown once): <code>{webhookSecretOnce}</code>
                </div>
              )}
              <button type="button" className="ml-2 rounded-lg bg-slate-700 px-3 py-2 text-xs" onClick={() => marketAnalyticsApi.testWebhook().then(refresh)}>
                Send test alert
              </button>
            </div>
          )}

          {page === 'alerts' && (
            <pre className="rounded-lg bg-slate-900/70 p-3 text-xs">{JSON.stringify(summary?.webhookHealth, null, 2)}</pre>
          )}

          {page === 'audit' && (
            <div className="space-y-1 text-xs">
              {(auditQ.data?.data || []).map((a: any) => (
                <div key={a.id} className="rounded bg-slate-900/70 px-2 py-1.5">
                  {a.createdAt} · {a.action}
                </div>
              ))}
              {!auditQ.data?.data?.length && <Empty text="No audit events yet." />}
            </div>
          )}

          {page === 'settings' && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-teal-300">
                <Radio className="h-4 w-4" /> Safety meta
              </div>
              <pre className="rounded-lg bg-slate-900/70 p-3 text-xs">{JSON.stringify(safetyQ.data?.data, null, 2)}</pre>
              <p>CSV exports: signals / orders / audit via API `/api/v1/exports/:kind.csv`</p>
              <p className="text-slate-500">Paper results do not predict live returns.</p>
            </div>
          )}
        </div>
      </div>
    </ChartProviderHost>
  );
}

function SignalDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['ma', 'signal', id], queryFn: () => marketAnalyticsApi.signal(id) });
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-auto border-l border-slate-700 bg-slate-950 p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Signal detail</h3>
        <button type="button" onClick={onClose} className="text-xs text-slate-400">
          Close
        </button>
      </div>
      {q.isLoading && <Empty text="Loading…" />}
      {q.data?.data && <pre className="whitespace-pre-wrap text-[11px] text-slate-300">{JSON.stringify(q.data.data, null, 2)}</pre>}
    </div>
  );
}

function OrdersFromAccounts({ accounts }: { accounts: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void (async () => {
      const all: any[] = [];
      for (const a of accounts) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/accounts/${a.id}/orders`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('accessToken') || ''}`,
              },
            }
          );
          const j = await res.json();
          all.push(...(j.data || []).map((o: any) => ({ ...o, account: a.paperAccountId })));
        } catch {
          /* ignore */
        }
      }
      setRows(all);
    })();
  }, [accounts]);
  if (!rows.length) return <Empty text="No orders (signal-only until paper flags enabled)." />;
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-slate-400">
        <tr>
          <th className="p-2">Account</th>
          <th>Symbol</th>
          <th>Status</th>
          <th>Qty</th>
          <th>Limit</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.id || o.appOrderId} className="border-t border-slate-800">
            <td className="p-2">{o.account}</td>
            <td>{o.symbol}</td>
            <td>{o.status}</td>
            <td>{o.quantity}</td>
            <td>{o.limitPrice}</td>
            <td>{o.source}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PositionsFromAccounts({ accounts }: { accounts: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    void (async () => {
      const all: any[] = [];
      for (const a of accounts) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/v1/accounts/${a.id}/positions`,
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('accessToken') || ''}`,
              },
            }
          );
          const j = await res.json();
          all.push(...(j.data || []).map((p: any) => ({ ...p, account: a.paperAccountId, sourceLabel: j.sourceLabel })));
        } catch {
          /* ignore */
        }
      }
      setRows(all);
    })();
  }, [accounts]);
  if (!rows.length) return <Empty text="No positions." />;
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((p, i) => (
        <li key={i} className="rounded-lg bg-slate-900/70 px-3 py-2">
          {p.symbol} · qty {p.quantity} · avg {p.avgPrice} · {p.sourceLabel || 'SIMULATED'}
        </li>
      ))}
    </ul>
  );
}

function demoCandles() {
  const out = [];
  let px = 500;
  const t0 = Math.floor(Date.now() / 1000) - 60 * 15 * 40;
  for (let i = 0; i < 40; i++) {
    const o = px;
    const c = px + (i % 5 === 0 ? 0.8 : 0.1);
    out.push({ time: t0 + i * 900, open: o, high: Math.max(o, c) + 0.4, low: Math.min(o, c) - 0.4, close: c, volume: 1e6 });
    px = c;
  }
  return out;
}
