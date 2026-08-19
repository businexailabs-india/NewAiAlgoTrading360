/**
 * SENSEX & Multi-Account Portfolio — institutional ops surface.
 * Data via portfolioApi (mock today); App wires this via section routing.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import {
  RefreshCw,
  Download,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { portfolioApi } from './api';
import {
  formatMoney,
  formatPct,
  formatTs,
  aggregatePositions,
  sumPnl,
} from './format';
import { createDefaultRealtimeTransport, isStale } from './realtime';
import {
  FreshnessBadge,
  ConnDot,
  RiskBadge,
  ReconBadge,
  SectionCard,
  MoneyTone,
  ConfirmModal,
  tabular,
} from './ui';
import type {
  BrokerAccount,
  BrokerId,
  ExchangeId,
  HistoryPeriod,
  MoneyFormat,
  OrderIntent,
  OrderPreview,
  OrderStatus,
  TradingModeLabel,
} from './types';

type TabId =
  | 'overview'
  | 'positions'
  | 'orders'
  | 'sensex'
  | 'strategies'
  | 'risk'
  | 'recon'
  | 'activity';

type AccountSelection = 'all' | string;

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'sensex', label: 'SENSEX Trading' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'risk', label: 'Risk' },
  { id: 'recon', label: 'Reconciliation' },
  { id: 'activity', label: 'Activity' },
];

const PERIODS: HistoryPeriod[] = ['1D', '1W', '1M', '3M', '6M', '1Y'];
const CHART_COLORS = ['#0284c7', '#0d9488', '#64748b', '#f59e0b', '#94a3b8'];
const OPEN_ORDER_STATUSES: OrderStatus[] = [
  'CREATED',
  'RISK_APPROVED',
  'SUBMITTED',
  'ACKNOWLEDGED',
  'PENDING',
  'PARTIALLY_FILLED',
  'MODIFY_PENDING',
  'CANCEL_PENDING',
];

function resolveAccountIds(
  selection: AccountSelection,
  accounts: BrokerAccount[],
  groupIds: Record<string, string[]>
): string[] {
  if (selection === 'all') return accounts.map((a) => a.id);
  if (groupIds[selection]) return groupIds[selection];
  return [selection];
}

function metaLabel(value: number | string | null | undefined, source?: string): string {
  if (value == null || value === '') {
    return source === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'from instrument master';
  }
  return String(value);
}

function downloadPositionsCsv(
  rows: { symbol: string; exchange: string; accountId: string; broker: string; netQty: number; avgPrice: number; marketValue: number; dayPnl: number; unrealizedPnl: number }[]
) {
  const header = [
    'symbol',
    'exchange',
    'accountId',
    'broker',
    'netQty',
    'avgPrice',
    'marketValue',
    'dayPnl',
    'unrealizedPnl',
  ];
  const lines = [
    header.join(','),
    ...rows.map((r) =>
      [
        r.symbol,
        r.exchange,
        r.accountId,
        r.broker,
        r.netQty,
        r.avgPrice,
        r.marketValue,
        r.dayPnl,
        r.unrealizedPnl,
      ].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `positions-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50';
const btnOutline =
  'inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:opacity-50';
const btnDanger =
  'inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50';
const inputCls =
  'rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
const selectCls = cn(inputCls, 'min-w-[8rem]');

type ConfirmState =
  | null
  | { kind: 'pause'; strategyId: string; name: string }
  | { kind: 'cancel'; orderId: string; symbol: string }
  | { kind: 'disable'; accountId: string; alias: string }
  | { kind: 'reconcile'; accountId: string; alias: string }
  | { kind: 'kill'; scope: 'GLOBAL' | 'ACCOUNT' | 'STRATEGY'; targetIds: string[] }
  | { kind: 'submit-order'; preview: OrderPreview };

export function SensexMultiAccountPortfolioPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>('overview');
  const [selection, setSelection] = useState<AccountSelection>('all');
  const [moneyFormat, setMoneyFormat] = useState<MoneyFormat>('exact');
  const [period, setPeriod] = useState<HistoryPeriod>('1M');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [livePulse, setLivePulse] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [killPhrase, setKillPhrase] = useState('');
  const [livePhrase, setLivePhrase] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Position filters
  const [posAccount, setPosAccount] = useState('all');
  const [posBroker, setPosBroker] = useState<BrokerId | 'all'>('all');
  const [posExchange, setPosExchange] = useState<ExchangeId | 'all'>('all');
  const [posSearch, setPosSearch] = useState('');
  const [expandedAgg, setExpandedAgg] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  // Order form (SENSEX)
  const [orderAccountId, setOrderAccountId] = useState('');
  const [instrumentType, setInstrumentType] = useState<'FUT' | 'CE' | 'PE'>('FUT');
  const [contractId, setContractId] = useState<string>('');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState(20);
  const [lots, setLots] = useState<number | ''>('');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL' | 'SL-M'>('LIMIT');
  const [limitPrice, setLimitPrice] = useState<number | ''>('');
  const [triggerPrice, setTriggerPrice] = useState<number | ''>('');
  const [productType, setProductType] = useState<'NRML' | 'MIS'>('NRML');
  const [tradingMode, setTradingMode] = useState<TradingModeLabel>('PAPER');
  const [strategyTag, setStrategyTag] = useState('');
  const [preview, setPreview] = useState<OrderPreview | null>(null);

  const accountsQ = useQuery({
    queryKey: ['portfolio', 'accounts'],
    queryFn: () => portfolioApi.getAccounts(),
  });
  const groupsQ = useQuery({
    queryKey: ['portfolio', 'groups'],
    queryFn: () => portfolioApi.getAccountGroups(),
  });

  const accounts = accountsQ.data ?? [];
  const groups = groupsQ.data ?? [];
  const groupMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const g of groups) m[g.id] = g.accountIds;
    return m;
  }, [groups]);

  const accountIds = useMemo(
    () => resolveAccountIds(selection, accounts, groupMap),
    [selection, accounts, groupMap]
  );

  const accountLabel = useCallback(
    (id: string) => accounts.find((a) => a.id === id)?.alias ?? id,
    [accounts]
  );

  useEffect(() => {
    if (!orderAccountId && accounts.length) {
      const tradable = accounts.find((a) => a.tradingEnabled && a.markets.includes('BSE'));
      setOrderAccountId(tradable?.id ?? accounts[0].id);
    }
  }, [accounts, orderAccountId]);

  useEffect(() => {
    const transport = createDefaultRealtimeTransport();
    void transport.connect();
    const unsub = transport.subscribe(['pnl', 'connectivity', 'order'], (e) => {
      setLivePulse(e.timestamp);
    });
    setLivePulse(transport.lastEventAt());
    return () => {
      unsub();
      transport.disconnect();
    };
  }, []);

  const summaryQ = useQuery({
    queryKey: ['portfolio', 'summary', accountIds],
    queryFn: () => portfolioApi.getPortfolioSummary(accountIds),
    enabled: accounts.length > 0,
  });
  const historyQ = useQuery({
    queryKey: ['portfolio', 'history', accountIds, period],
    queryFn: () => portfolioApi.getPortfolioHistory(accountIds, period, 'SENSEX'),
    enabled: accounts.length > 0,
  });
  const positionsQ = useQuery({
    queryKey: ['portfolio', 'positions', accountIds],
    queryFn: () => portfolioApi.getPositions(accountIds),
    enabled: accounts.length > 0,
  });
  const ordersQ = useQuery({
    queryKey: ['portfolio', 'orders', accountIds],
    queryFn: () => portfolioApi.getOrders(accountIds),
    enabled: accounts.length > 0,
  });
  const strategiesQ = useQuery({
    queryKey: ['portfolio', 'strategies', accountIds],
    queryFn: () => portfolioApi.getStrategyAllocations(accountIds),
    enabled: accounts.length > 0,
  });
  const riskQ = useQuery({
    queryKey: ['portfolio', 'risk', accountIds],
    queryFn: () => portfolioApi.getRiskSnapshot(accountIds),
    enabled: accounts.length > 0,
  });
  const reconQ = useQuery({
    queryKey: ['portfolio', 'recon', accountIds],
    queryFn: () => portfolioApi.getReconciliationStatus(accountIds),
    enabled: accounts.length > 0,
  });
  const marketQ = useQuery({
    queryKey: ['portfolio', 'market'],
    queryFn: () => portfolioApi.getMarketContext(),
  });
  const exposureQ = useQuery({
    queryKey: ['portfolio', 'exposure', accountIds],
    queryFn: () => portfolioApi.getExposure(accountIds),
    enabled: accounts.length > 0,
  });
  const activityQ = useQuery({
    queryKey: ['portfolio', 'activity', accountIds],
    queryFn: () => portfolioApi.getActivity(accountIds),
    enabled: accounts.length > 0,
  });
  const contractsQ = useQuery({
    queryKey: ['portfolio', 'contracts', 'BSE', 'SENSEX'],
    queryFn: () => portfolioApi.getDerivativeContracts('BSE', 'SENSEX'),
  });

  const contracts = useMemo(
    () => (contractsQ.data ?? []).filter((c) => c.instrumentType === instrumentType),
    [contractsQ.data, instrumentType]
  );

  useEffect(() => {
    if (contracts.length && !contracts.find((c) => c.canonicalId === contractId)) {
      setContractId(contracts[0].canonicalId);
    }
    if (!contracts.length) setContractId('');
  }, [contracts, contractId]);

  const invalidateAll = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['portfolio'] });
  }, [qc]);

  const pauseMut = useMutation({
    mutationFn: (id: string) => portfolioApi.pauseStrategy(id),
    onSuccess: () => {
      setToast('Strategy pause requested');
      invalidateAll();
    },
  });
  const cancelMut = useMutation({
    mutationFn: (id: string) => portfolioApi.cancelOrder(id),
    onSuccess: (res) => {
      setToast(res.message);
      invalidateAll();
    },
  });
  const killMut = useMutation({
    mutationFn: portfolioApi.triggerKillSwitch,
    onSuccess: (res) => {
      setToast(res.message);
      setKillPhrase('');
      invalidateAll();
    },
  });
  const previewMut = useMutation({
    mutationFn: (intent: OrderIntent) => portfolioApi.previewOrder(intent),
    onSuccess: (p) => setPreview(p),
    onError: (e: Error) => setToast(e.message),
  });
  const submitMut = useMutation({
    mutationFn: ({ previewId, phrase }: { previewId: string; phrase?: string }) =>
      portfolioApi.submitOrder(previewId, phrase),
    onSuccess: (ord) => {
      setToast(`Order ${ord.status} — awaiting broker acknowledgement (not assumed filled)`);
      setPreview(null);
      setLivePhrase('');
      invalidateAll();
      setTab('orders');
    },
    onError: (e: Error) => setToast(e.message),
  });

  const positions = positionsQ.data ?? [];
  const filteredPositions = useMemo(() => {
    return positions.filter((p) => {
      if (posAccount !== 'all' && p.accountId !== posAccount) return false;
      if (posBroker !== 'all' && p.broker !== posBroker) return false;
      if (posExchange !== 'all' && p.exchange !== posExchange) return false;
      if (posSearch.trim()) {
        const q = posSearch.trim().toLowerCase();
        if (!p.symbol.toLowerCase().includes(q) && !p.canonicalInstrumentId.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [positions, posAccount, posBroker, posExchange, posSearch]);

  const aggregated = useMemo(() => aggregatePositions(filteredPositions), [filteredPositions]);
  const pnlTotals = useMemo(() => sumPnl(filteredPositions), [filteredPositions]);

  const summary = summaryQ.data;
  const currency = summary?.reportingCurrency ?? 'INR';
  const money = (n: number) => formatMoney(n, moneyFormat, currency);
  const staleLive = isStale(livePulse, 60_000);
  const lastSync =
    accounts.reduce<string | null>((best, a) => {
      if (!best) return a.lastSyncAt;
      return new Date(a.lastSyncAt) > new Date(best) ? a.lastSyncAt : best;
    }, null) ?? summary?.asOf ?? null;

  const chartData = useMemo(() => {
    return (historyQ.data ?? []).map((pt) => ({
      t: new Date(pt.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      portfolio: Math.round(pt.portfolioValue),
      bse: Math.round(pt.bseExposure),
      nse: Math.round(pt.nseExposure),
      benchmark: pt.benchmarkValue != null ? Number(pt.benchmarkValue.toFixed(2)) : null,
    }));
  }, [historyQ.data]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    if (toast) {
      const id = window.setTimeout(() => setToast(null), 5500);
      return () => window.clearTimeout(id);
    }
  }, [toast]);

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === 'pause') {
      await pauseMut.mutateAsync(confirm.strategyId);
    } else if (confirm.kind === 'cancel') {
      await cancelMut.mutateAsync(confirm.orderId);
    } else if (confirm.kind === 'disable') {
      showToast(`Trading disable queued for ${confirm.alias} (demo — wire to account control API)`);
    } else if (confirm.kind === 'reconcile') {
      await qc.invalidateQueries({ queryKey: ['portfolio', 'recon'] });
      showToast(`Reconciliation refresh requested for ${confirm.alias}`);
    } else if (confirm.kind === 'kill') {
      await killMut.mutateAsync({
        scope: confirm.scope,
        targetIds: confirm.targetIds,
        confirmationPhrase: killPhrase,
        reason: 'Operator emergency control',
      });
    } else if (confirm.kind === 'submit-order') {
      await submitMut.mutateAsync({
        previewId: confirm.preview.previewId,
        phrase: confirm.preview.intent.tradingMode === 'LIVE' ? livePhrase : undefined,
      });
    }
    setConfirm(null);
    setKillPhrase('');
    setLivePhrase('');
  };

  const buildIntent = (): OrderIntent | null => {
    if (!orderAccountId) return null;
    const contract = contracts.find((c) => c.canonicalId === contractId);
    return {
      accountId: orderAccountId,
      exchange: 'BSE',
      underlying: 'SENSEX',
      instrumentType,
      canonicalInstrumentId: contract?.canonicalId ?? null,
      expiry: contract?.expiry ?? null,
      strike: contract?.strike ?? null,
      optionType: contract?.optionType ?? (instrumentType === 'FUT' ? null : instrumentType),
      side,
      quantity: Number(qty) || 0,
      lots: lots === '' ? null : Number(lots),
      orderType,
      limitPrice: limitPrice === '' ? null : Number(limitPrice),
      triggerPrice: triggerPrice === '' ? null : Number(triggerPrice),
      timeInForce: 'DAY',
      productType,
      strategyTag: strategyTag || null,
      clientReference: `CLI-SX-${Date.now()}`,
      tradingMode,
    };
  };

  const onPreview = () => {
    const intent = buildIntent();
    if (!intent) {
      showToast('Select a trading account');
      return;
    }
    previewMut.mutate(intent);
  };

  const toggleSet = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const exposure = exposureQ.data;
  const market = marketQ.data;
  const openOrders = (ordersQ.data ?? []).filter((o) => OPEN_ORDER_STATUSES.includes(o.status));

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] space-y-4 p-3 sm:p-5">
        {/* Header */}
        <header className="rounded-lg border border-slate-200 bg-white px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                SENSEX & Multi-Account Portfolio
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Cross-broker India book with BSE SENSEX derivatives context. Market figures are DEMO unless
                freshness says otherwise — never treat as live.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <span>
                  Last sync: <span style={tabular}>{formatTs(lastSync)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      staleLive ? 'bg-amber-500' : 'bg-emerald-500'
                    )}
                    aria-hidden
                  />
                  {staleLive ? 'Feed stale / polling' : 'Live pulse'}
                </span>
                {summary ? <FreshnessBadge freshness={summary.freshness} /> : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={selectCls}
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                aria-label="Account selector"
              >
                <option value="all">All accounts</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.alias}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className={inputCls}
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                aria-label="As-of date"
              />
              <button type="button" className={btnOutline} onClick={invalidateAll}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <button
                type="button"
                className={btnOutline}
                onClick={() =>
                  downloadPositionsCsv(
                    positions.map((p) => ({
                      symbol: p.symbol,
                      exchange: p.exchange,
                      accountId: p.accountId,
                      broker: p.broker,
                      netQty: p.netQty,
                      avgPrice: p.avgPrice,
                      marketValue: p.marketValue,
                      dayPnl: p.dayPnl,
                      unrealizedPnl: p.unrealizedPnl,
                    }))
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
              <button type="button" className={btnPrimary} onClick={() => setTab('sensex')}>
                <Plus className="h-3.5 w-3.5" />
                New Order
              </button>
            </div>
          </div>
        </header>

        {/* Market context */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {(market?.quotes ?? []).map((q) => (
            <div
              key={q.symbol}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">{q.label}</span>
                <FreshnessBadge freshness={q.freshness} />
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-lg font-semibold text-slate-900" style={tabular}>
                  {q.last != null ? q.last.toLocaleString('en-IN') : '—'}
                </span>
                <MoneyTone value={q.change ?? 0}>
                  <span className="text-xs">
                    {q.change != null ? q.change.toFixed(2) : '—'} ({formatPct(q.changePct)})
                  </span>
                </MoneyTone>
              </div>
            </div>
          ))}
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">Market Status</span>
              <FreshnessBadge freshness="DEMO" />
            </div>
            <div className="mt-1 space-y-1 text-sm">
              {(market?.status ?? []).map((s) => (
                <div key={s.exchange} className="flex justify-between text-slate-700">
                  <span>{s.exchange}</span>
                  <span style={tabular}>{s.session}</span>
                </div>
              ))}
              {!market?.status?.length ? <span className="text-slate-400">—</span> : null}
            </div>
          </div>
        </div>

        {/* KPI row */}
        <SectionCard
          title="Portfolio KPIs"
          subtitle={summary?.fxWarning ?? undefined}
          actions={
            <div className="flex rounded-md border border-slate-200 p-0.5 text-xs">
              {(['exact', 'lakhs', 'compact'] as MoneyFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={cn(
                    'rounded px-2 py-1 capitalize',
                    moneyFormat === f ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                  )}
                  onClick={() => setMoneyFormat(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Net liquidation', value: summary?.netLiquidation },
              { label: 'Invested', value: summary?.investedValue },
              { label: 'Available cash', value: summary?.availableCash },
              { label: 'Day P&L', value: summary?.dayPnl, tone: true },
              { label: 'Total P&L', value: summary?.totalPnl, tone: true },
              { label: 'Margin used', value: summary?.marginUtilized },
            ].map((k) => (
              <div key={k.label} className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{k.label}</div>
                <div className="mt-1 text-base font-semibold text-slate-900">
                  {k.value == null ? (
                    '—'
                  ) : k.tone ? (
                    <MoneyTone value={k.value}>{money(k.value)}</MoneyTone>
                  ) : (
                    <span style={tabular}>{money(k.value)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {summary ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span>
                Risk: <RiskBadge level={summary.riskStatus} />
              </span>
              <span style={tabular}>Buying power {money(summary.buyingPower)}</span>
              <span style={tabular}>As of {formatTs(summary.asOf)}</span>
            </div>
          ) : null}
        </SectionCard>

        {/* Tabs */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <div className="flex min-w-max gap-0 border-b border-slate-100" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={cn(
                  'px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px',
                  tab === t.id
                    ? 'border-sky-600 text-sky-700 font-medium'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                )}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="space-y-4 p-4">
            {tab === 'overview' && (
              <>
                <SectionCard
                  title="Performance"
                  subtitle="Dividends not included in return series. Benchmark is SENSEX index level (demo)."
                  actions={
                    <div className="flex flex-wrap gap-1">
                      {PERIODS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          className={cn(
                            'rounded px-2 py-1 text-xs',
                            period === p ? 'bg-sky-600 text-white' : 'border border-slate-200 text-slate-600'
                          )}
                          onClick={() => setPeriod(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  }
                >
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={70} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="#0284c7" dot={false} strokeWidth={2} />
                        <Line type="monotone" dataKey="bse" name="BSE exposure" stroke="#0d9488" dot={false} />
                        <Line type="monotone" dataKey="nse" name="NSE exposure" stroke="#64748b" dot={false} />
                        <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke="#f59e0b" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                  <AllocationPie title="By account" slices={exposure?.byAccount ?? []} />
                  <AllocationPie title="By asset class" slices={exposure?.byAssetClass ?? []} />
                  <AllocationPie title="By exchange" slices={exposure?.byExchange ?? []} />
                </div>

                {exposure ? (
                  <SectionCard title="Long / Short exposure">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <KpiMini label="Long" value={money(exposure.longExposure)} tone={1} />
                      <KpiMini label="Short" value={money(exposure.shortExposure)} tone={-1} />
                      <KpiMini label="Net" value={money(exposure.netExposure)} tone={exposure.netExposure} />
                    </div>
                    <div className="mt-3 h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'Long', value: exposure.longExposure },
                            { name: 'Short', value: exposure.shortExposure },
                            { name: 'Net', value: exposure.netExposure },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="name" />
                          <YAxis width={70} />
                          <Tooltip />
                          <Bar dataKey="value" fill="#0284c7" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </SectionCard>
                ) : null}

                <AccountsTable
                  accounts={accounts.filter((a) => accountIds.includes(a.id))}
                  strategies={strategiesQ.data ?? []}
                  positions={positions}
                  money={money}
                  expanded={expandedAccounts}
                  onToggle={(id) => setExpandedAccounts(toggleSet(expandedAccounts, id))}
                  onPause={(s) => setConfirm({ kind: 'pause', strategyId: s.id, name: s.name })}
                  onCancelOpen={(accountId) => {
                    const o = openOrders.find((x) => x.accountId === accountId);
                    if (o) setConfirm({ kind: 'cancel', orderId: o.id, symbol: o.symbol });
                    else showToast('No open orders on this account');
                  }}
                  onDisable={(a) => setConfirm({ kind: 'disable', accountId: a.id, alias: a.alias })}
                  onReconcile={(a) => setConfirm({ kind: 'reconcile', accountId: a.id, alias: a.alias })}
                  onView={() => setTab('positions')}
                />
              </>
            )}

            {tab === 'positions' && (
              <SectionCard
                title="Positions"
                subtitle="Consolidated by identical contract (BSE vs NSE kept separate). Expand for account children."
                actions={
                  <div className="text-xs text-slate-500" style={tabular}>
                    Long {money(pnlTotals.longExposure)} · Short {money(pnlTotals.shortExposure)} · Day{' '}
                    <MoneyTone value={pnlTotals.day}>{money(pnlTotals.day)}</MoneyTone>
                  </div>
                }
              >
                <div className="mb-3 flex flex-wrap gap-2">
                  <select className={selectCls} value={posAccount} onChange={(e) => setPosAccount(e.target.value)}>
                    <option value="all">All accounts</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.alias}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectCls}
                    value={posBroker}
                    onChange={(e) => setPosBroker(e.target.value as BrokerId | 'all')}
                  >
                    <option value="all">All brokers</option>
                    <option value="dhan">dhan</option>
                    <option value="zerodha">zerodha</option>
                    <option value="upstox">upstox</option>
                    <option value="paper">paper</option>
                  </select>
                  <select
                    className={selectCls}
                    value={posExchange}
                    onChange={(e) => setPosExchange(e.target.value as ExchangeId | 'all')}
                  >
                    <option value="all">All exchanges</option>
                    <option value="BSE">BSE</option>
                    <option value="NSE">NSE</option>
                  </select>
                  <input
                    className={cn(inputCls, 'min-w-[10rem] flex-1')}
                    placeholder="Search symbol…"
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-2" />
                        <th className="px-2 py-2">Symbol</th>
                        <th className="px-2 py-2">Exch</th>
                        <th className="px-2 py-2">Qty</th>
                        <th className="px-2 py-2">Avg</th>
                        <th className="px-2 py-2">Mkt value</th>
                        <th className="px-2 py-2">Day P&L</th>
                        <th className="px-2 py-2">Unreal.</th>
                        <th className="px-2 py-2">Accounts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregated.map((row) => {
                        const open = expandedAgg.has(row.key);
                        return (
                          <FragmentRows key={row.key}>
                            <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  className="text-slate-500"
                                  onClick={() => setExpandedAgg(toggleSet(expandedAgg, row.key))}
                                  aria-label="Expand"
                                >
                                  {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </td>
                              <td className="px-2 py-2 font-medium">{row.symbol}</td>
                              <td className="px-2 py-2">{row.exchange}</td>
                              <td className="px-2 py-2" style={tabular}>
                                {row.netQty}
                              </td>
                              <td className="px-2 py-2" style={tabular}>
                                {row.weightedAvgPrice.toFixed(2)}
                              </td>
                              <td className="px-2 py-2" style={tabular}>
                                {money(row.marketValue)}
                              </td>
                              <td className="px-2 py-2">
                                <MoneyTone value={row.dayPnl}>{money(row.dayPnl)}</MoneyTone>
                              </td>
                              <td className="px-2 py-2">
                                <MoneyTone value={row.unrealizedPnl}>{money(row.unrealizedPnl)}</MoneyTone>
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-500">{row.children.length}</td>
                            </tr>
                            {open
                              ? row.children.map((c) => (
                                  <tr key={c.id} className="border-b border-slate-50 bg-slate-50/50 text-xs">
                                    <td />
                                    <td className="px-2 py-1.5 pl-6 text-slate-600">
                                      {accountLabel(c.accountId)} · {c.broker}
                                    </td>
                                    <td className="px-2 py-1.5">{c.exchange}</td>
                                    <td className="px-2 py-1.5" style={tabular}>
                                      {c.netQty}
                                    </td>
                                    <td className="px-2 py-1.5" style={tabular}>
                                      {c.avgPrice.toFixed(2)}
                                    </td>
                                    <td className="px-2 py-1.5" style={tabular}>
                                      {money(c.marketValue)}
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <MoneyTone value={c.dayPnl}>{money(c.dayPnl)}</MoneyTone>
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <MoneyTone value={c.unrealizedPnl}>{money(c.unrealizedPnl)}</MoneyTone>
                                    </td>
                                    <td className="px-2 py-1.5">
                                      <ReconBadge status={c.reconciliationStatus} />
                                    </td>
                                  </tr>
                                ))
                              : null}
                          </FragmentRows>
                        );
                      })}
                      {!aggregated.length ? (
                        <tr>
                          <td colSpan={9} className="px-2 py-6 text-center text-slate-400">
                            No positions for current filters
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {tab === 'orders' && (
              <SectionCard
                title="Open & recent orders"
                subtitle="Cancel requests are accepted locally until broker confirms — do not assume cancelled."
              >
                <OrdersTable
                  orders={ordersQ.data ?? []}
                  accountLabel={accountLabel}
                  money={money}
                  onCancel={(o) => setConfirm({ kind: 'cancel', orderId: o.id, symbol: o.symbol })}
                />
              </SectionCard>
            )}

            {tab === 'sensex' && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <SectionCard
                  title="SENSEX order ticket"
                  subtitle="Exchange BSE · Underlying SENSEX is a benchmark (not tradable spot). Trade FUT / CE / PE only."
                >
                  <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                    Spot SENSEX is not a security. Lot / expiry / strike come from instrument master — never invent live specs.
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Account">
                      <select
                        className={selectCls}
                        value={orderAccountId}
                        onChange={(e) => setOrderAccountId(e.target.value)}
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.alias} {!a.tradingEnabled ? '(disabled)' : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Exchange">
                      <input className={inputCls} value="BSE" readOnly />
                    </Field>
                    <Field label="Underlying">
                      <input className={inputCls} value="SENSEX (benchmark)" readOnly />
                    </Field>
                    <Field label="Instrument type">
                      <select
                        className={selectCls}
                        value={instrumentType}
                        onChange={(e) => setInstrumentType(e.target.value as 'FUT' | 'CE' | 'PE')}
                      >
                        <option value="FUT">FUT</option>
                        <option value="CE">CE</option>
                        <option value="PE">PE</option>
                      </select>
                    </Field>
                    <Field label="Contract">
                      <select
                        className={selectCls}
                        value={contractId}
                        onChange={(e) => setContractId(e.target.value)}
                      >
                        {!contracts.length ? <option value="">No contracts</option> : null}
                        {contracts.map((c) => (
                          <option key={c.canonicalId} value={c.canonicalId}>
                            {c.tradingSymbol} [{c.metadataSource}]
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Mode">
                      <select
                        className={cn(
                          selectCls,
                          tradingMode === 'LIVE' ? 'border-red-400 text-red-800' : 'border-teal-400 text-teal-800'
                        )}
                        value={tradingMode}
                        onChange={(e) => setTradingMode(e.target.value as TradingModeLabel)}
                      >
                        <option value="PAPER">PAPER</option>
                        <option value="LIVE">LIVE</option>
                      </select>
                    </Field>
                    <Field label="Side">
                      <select className={selectCls} value={side} onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}>
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </select>
                    </Field>
                    <Field label="Order type">
                      <select
                        className={selectCls}
                        value={orderType}
                        onChange={(e) => setOrderType(e.target.value as typeof orderType)}
                      >
                        <option value="MARKET">MARKET</option>
                        <option value="LIMIT">LIMIT</option>
                        <option value="SL">SL</option>
                        <option value="SL-M">SL-M</option>
                      </select>
                    </Field>
                    <Field label="Quantity">
                      <input
                        type="number"
                        className={inputCls}
                        value={qty}
                        min={1}
                        onChange={(e) => setQty(Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Lots (optional)">
                      <input
                        type="number"
                        className={inputCls}
                        value={lots}
                        placeholder="—"
                        onChange={(e) => setLots(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Limit price">
                      <input
                        type="number"
                        className={inputCls}
                        value={limitPrice}
                        disabled={orderType === 'MARKET' || orderType === 'SL-M'}
                        onChange={(e) => setLimitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Trigger">
                      <input
                        type="number"
                        className={inputCls}
                        value={triggerPrice}
                        disabled={orderType === 'MARKET' || orderType === 'LIMIT'}
                        onChange={(e) => setTriggerPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Product">
                      <select
                        className={selectCls}
                        value={productType}
                        onChange={(e) => setProductType(e.target.value as 'NRML' | 'MIS')}
                      >
                        <option value="NRML">NRML</option>
                        <option value="MIS">MIS</option>
                      </select>
                    </Field>
                    <Field label="Strategy tag">
                      <input
                        className={inputCls}
                        value={strategyTag}
                        onChange={(e) => setStrategyTag(e.target.value)}
                        placeholder="optional"
                      />
                    </Field>
                  </div>
                  {(() => {
                    const c = contracts.find((x) => x.canonicalId === contractId);
                    return (
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 sm:grid-cols-4">
                        <div>
                          <dt className="text-slate-400">Lot size</dt>
                          <dd style={tabular}>{metaLabel(c?.lotSize, c?.metadataSource)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Tick</dt>
                          <dd style={tabular}>{metaLabel(c?.tickSize, c?.metadataSource)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Expiry</dt>
                          <dd>{metaLabel(c?.expiry, c?.metadataSource)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Strike</dt>
                          <dd style={tabular}>{metaLabel(c?.strike, c?.metadataSource)}</dd>
                        </div>
                      </dl>
                    );
                  })()}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={previewMut.isPending}
                      onClick={onPreview}
                    >
                      Preview order
                    </button>
                    {tradingMode === 'PAPER' ? (
                      <span className="self-center rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800">
                        PAPER
                      </span>
                    ) : (
                      <span className="self-center rounded border border-red-400 bg-red-50 px-2 py-1 text-xs font-semibold text-red-800">
                        LIVE — real capital
                      </span>
                    )}
                  </div>
                </SectionCard>

                <SectionCard title="Order preview" subtitle="Confirm only after reviewing risk warnings and validation.">
                  {!preview ? (
                    <p className="text-sm text-slate-500">Run Preview to validate against risk and instrument master.</p>
                  ) : (
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded border border-slate-200 px-2 py-0.5 text-xs">{preview.accountAlias}</span>
                        <span className="rounded border border-slate-200 px-2 py-0.5 text-xs">{preview.broker}</span>
                        <span className="rounded border border-slate-200 px-2 py-0.5 text-xs">{preview.instrumentLabel}</span>
                        <FreshnessBadge freshness="DEMO" />
                      </div>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-slate-400">Est. value</dt>
                          <dd style={tabular}>{money(preview.estimatedValue.amount)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Est. margin</dt>
                          <dd style={tabular}>{money(preview.estimatedMargin.amount)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Charges</dt>
                          <dd style={tabular}>{money(preview.estimatedCharges.amount)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Resulting qty</dt>
                          <dd style={tabular}>{preview.resultingPositionQty}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Lot / tick / freeze</dt>
                          <dd style={tabular}>
                            {metaLabel(preview.lotSize, preview.lotSize == null ? 'UNAVAILABLE' : undefined)} /{' '}
                            {metaLabel(preview.tickSize, preview.tickSize == null ? 'UNAVAILABLE' : undefined)} /{' '}
                            {metaLabel(preview.freezeQty, preview.freezeQty == null ? 'UNAVAILABLE' : undefined)}
                          </dd>
                        </div>
                      </dl>
                      {preview.validationErrors.length ? (
                        <ul className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                          {preview.validationErrors.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : null}
                      {preview.riskWarnings.length ? (
                        <ul className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {preview.riskWarnings.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      ) : null}
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={!!preview.validationErrors.length || submitMut.isPending}
                        onClick={() => setConfirm({ kind: 'submit-order', preview })}
                      >
                        Confirm & submit
                      </button>
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {tab === 'strategies' && (
              <SectionCard title="Strategy allocation">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Strategy</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Allocated</th>
                        <th className="px-2 py-2">Used</th>
                        <th className="px-2 py-2">Day P&L</th>
                        <th className="px-2 py-2">Total P&L</th>
                        <th className="px-2 py-2">DD%</th>
                        <th className="px-2 py-2">Risk</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {(strategiesQ.data ?? []).map((s) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="px-2 py-2 font-medium">{s.name}</td>
                          <td className="px-2 py-2 text-xs">{s.status}</td>
                          <td className="px-2 py-2" style={tabular}>
                            {money(s.capitalAllocated)}
                          </td>
                          <td className="px-2 py-2" style={tabular}>
                            {money(s.capitalUsed)}
                          </td>
                          <td className="px-2 py-2">
                            <MoneyTone value={s.dayPnl}>{money(s.dayPnl)}</MoneyTone>
                          </td>
                          <td className="px-2 py-2">
                            <MoneyTone value={s.totalPnl}>{money(s.totalPnl)}</MoneyTone>
                          </td>
                          <td className="px-2 py-2" style={tabular}>
                            {formatPct(s.drawdownPct)}
                          </td>
                          <td className="px-2 py-2">
                            <RiskBadge level={s.riskState} />
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              className={btnDanger}
                              disabled={s.status === 'PAUSED' || s.status === 'STOPPED'}
                              onClick={() => setConfirm({ kind: 'pause', strategyId: s.id, name: s.name })}
                            >
                              Pause
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {tab === 'risk' && (
              <>
                <SectionCard
                  title="Risk centre"
                  subtitle={riskQ.data ? `As of ${formatTs(riskQ.data.asOf)}` : undefined}
                  actions={riskQ.data ? <RiskBadge level={riskQ.data.overall} /> : null}
                >
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <KpiMini label="Gross" value={money(riskQ.data?.grossExposure ?? 0)} />
                    <KpiMini label="Net" value={money(riskQ.data?.netExposure ?? 0)} />
                    <KpiMini label="Margin util %" value={formatPct(riskQ.data?.marginUtilizationPct)} />
                    <KpiMini label="Concentration %" value={formatPct(riskQ.data?.concentrationPct)} />
                  </div>
                  <div className="mt-4 space-y-3">
                    {(riskQ.data?.limits ?? []).map((lim) => {
                      const pct = lim.limit > 0 ? Math.min(100, (lim.current / lim.limit) * 100) : 0;
                      const bar =
                        lim.level === 'CRITICAL' || lim.level === 'TRADING_BLOCKED'
                          ? 'bg-red-500'
                          : lim.level === 'WARNING'
                            ? 'bg-amber-500'
                            : 'bg-sky-600';
                      return (
                        <div key={lim.id}>
                          <div className="mb-1 flex justify-between text-xs text-slate-600">
                            <span>{lim.label}</span>
                            <span style={tabular}>
                              {lim.unit === 'PCT' || lim.unit === 'OPS' || lim.unit === 'COUNT'
                                ? `${lim.current} / ${lim.limit} ${lim.unit}`
                                : `${money(lim.current)} / ${money(lim.limit)}`}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded bg-slate-100">
                            <div className={cn('h-full rounded', bar)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>

                <SectionCard title="Emergency controls" subtitle="Destructive actions require typed confirmation.">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() =>
                        setConfirm({ kind: 'kill', scope: 'GLOBAL', targetIds: accountIds })
                      }
                    >
                      Kill Switch (global)
                    </button>
                    <button
                      type="button"
                      className={btnDanger}
                      onClick={() =>
                        setConfirm({
                          kind: 'kill',
                          scope: 'ACCOUNT',
                          targetIds: accountIds.slice(0, 1),
                        })
                      }
                    >
                      Kill Switch (selected accounts)
                    </button>
                  </div>
                </SectionCard>
              </>
            )}

            {tab === 'recon' && (
              <SectionCard title="Reconciliation centre">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2 py-2">Account</th>
                        <th className="px-2 py-2">Pos platform</th>
                        <th className="px-2 py-2">Pos broker</th>
                        <th className="px-2 py-2">Pos diff</th>
                        <th className="px-2 py-2">Cash diff</th>
                        <th className="px-2 py-2">Status</th>
                        <th className="px-2 py-2">Last</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reconQ.data ?? []).map((r) => (
                        <tr key={r.accountId} className="border-b border-slate-100">
                          <td className="px-2 py-2 font-medium">{r.accountAlias}</td>
                          <td className="px-2 py-2" style={tabular}>
                            {money(r.platformPositionValue)}
                          </td>
                          <td className="px-2 py-2" style={tabular}>
                            {money(r.brokerPositionValue)}
                          </td>
                          <td className="px-2 py-2">
                            <MoneyTone value={r.positionDiff}>{money(r.positionDiff)}</MoneyTone>
                          </td>
                          <td className="px-2 py-2">
                            <MoneyTone value={r.cashDiff}>{money(r.cashDiff)}</MoneyTone>
                          </td>
                          <td className="px-2 py-2">
                            <ReconBadge status={r.status} />
                          </td>
                          <td className="px-2 py-2 text-xs" style={tabular}>
                            {formatTs(r.lastReconciledAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {tab === 'activity' && (
              <SectionCard title="Activity feed">
                <ul className="space-y-2">
                  {(activityQ.data ?? []).map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-col gap-1 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={cn(
                              'rounded border px-1.5 py-0.5 font-semibold',
                              a.severity === 'CRITICAL' || a.severity === 'ERROR'
                                ? 'border-red-300 text-red-800'
                                : a.severity === 'WARN'
                                  ? 'border-amber-300 text-amber-900'
                                  : 'border-slate-300 text-slate-600'
                            )}
                          >
                            {a.severity}
                          </span>
                          <span className="text-slate-400">{a.kind}</span>
                          {a.instrument ? <span className="text-slate-600">{a.instrument}</span> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-800">{a.description}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400" style={tabular}>
                          {a.correlationId}
                          {a.accountId ? ` · ${accountLabel(a.accountId)}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-500" style={tabular}>
                        {formatTs(a.timestamp)}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>
        </div>
      </div>

      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-md"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      <ConfirmModal
        open={!!confirm}
        title={
          confirm?.kind === 'kill'
            ? 'Kill Switch'
            : confirm?.kind === 'submit-order'
              ? 'Submit order'
              : confirm?.kind === 'pause'
                ? 'Pause strategy'
                : confirm?.kind === 'cancel'
                  ? 'Cancel order'
                  : confirm?.kind === 'disable'
                    ? 'Disable trading'
                    : confirm?.kind === 'reconcile'
                      ? 'Reconcile account'
                      : 'Confirm'
        }
        confirmLabel={
          confirm?.kind === 'kill'
            ? 'Activate kill switch'
            : confirm?.kind === 'submit-order'
              ? 'Submit'
              : 'Confirm'
        }
        destructive={
          confirm?.kind === 'kill' ||
          confirm?.kind === 'cancel' ||
          confirm?.kind === 'disable' ||
          confirm?.kind === 'pause' ||
          (confirm?.kind === 'submit-order' && confirm.preview.intent.tradingMode === 'LIVE')
        }
        confirmDisabled={
          (confirm?.kind === 'kill' && killPhrase !== 'KILL SWITCH') ||
          (confirm?.kind === 'submit-order' &&
            confirm.preview.intent.tradingMode === 'LIVE' &&
            livePhrase !== 'Confirm live order')
        }
        onCancel={() => {
          setConfirm(null);
          setKillPhrase('');
          setLivePhrase('');
        }}
        onConfirm={() => void runConfirm()}
      >
        {confirm?.kind === 'pause' ? (
          <p>
            Pause strategy <strong>{confirm.name}</strong>? Open positions remain until managed separately.
          </p>
        ) : null}
        {confirm?.kind === 'cancel' ? (
          <p>
            Request cancel for <strong>{confirm.symbol}</strong>? Status stays pending until broker confirms.
          </p>
        ) : null}
        {confirm?.kind === 'disable' ? (
          <p>
            Disable trading on <strong>{confirm.alias}</strong>?
          </p>
        ) : null}
        {confirm?.kind === 'reconcile' ? (
          <p>
            Refresh reconciliation for <strong>{confirm.alias}</strong>?
          </p>
        ) : null}
        {confirm?.kind === 'kill' ? (
          <div className="space-y-2">
            <p>
              Scope <strong>{confirm.scope}</strong> · targets {confirm.targetIds.length}. Type{' '}
              <code className="rounded bg-slate-100 px-1">KILL SWITCH</code> to proceed.
            </p>
            <input
              className={cn(inputCls, 'w-full')}
              value={killPhrase}
              onChange={(e) => setKillPhrase(e.target.value)}
              placeholder="KILL SWITCH"
              autoComplete="off"
            />
          </div>
        ) : null}
        {confirm?.kind === 'submit-order' ? (
          <div className="space-y-2">
            <p>
              Submit {confirm.preview.intent.tradingMode} {confirm.preview.intent.side}{' '}
              {confirm.preview.instrumentLabel} × {confirm.preview.intent.quantity}?
            </p>
            {confirm.preview.intent.tradingMode === 'LIVE' ? (
              <>
                <p className="text-red-700">
                  LIVE requires typing <code className="rounded bg-red-50 px-1">Confirm live order</code>
                </p>
                <input
                  className={cn(inputCls, 'w-full')}
                  value={livePhrase}
                  onChange={(e) => setLivePhrase(e.target.value)}
                  placeholder="Confirm live order"
                  autoComplete="off"
                />
              </>
            ) : (
              <p className="text-teal-800">PAPER mode — simulated path, not broker live.</p>
            )}
          </div>
        ) : null}
      </ConfirmModal>
    </div>
  );
}

function FragmentRows({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function KpiMini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: number;
}) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold">
        {tone != null ? <MoneyTone value={tone}>{value}</MoneyTone> : <span style={tabular}>{value}</span>}
      </div>
    </div>
  );
}

function AllocationPie({
  title,
  slices,
}: {
  title: string;
  slices: { name: string; value: number; pct: number }[];
}) {
  return (
    <SectionCard title={title}>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" outerRadius={70} label={false}>
              {slices.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function AccountsTable({
  accounts,
  strategies,
  positions,
  money,
  expanded,
  onToggle,
  onPause,
  onCancelOpen,
  onDisable,
  onReconcile,
  onView,
}: {
  accounts: BrokerAccount[];
  strategies: { id: string; name: string; accountIds: string[]; status: string }[];
  positions: { accountId: string; dayPnl: number; marketValue: number }[];
  money: (n: number) => string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onPause: (s: { id: string; name: string }) => void;
  onCancelOpen: (accountId: string) => void;
  onDisable: (a: BrokerAccount) => void;
  onReconcile: (a: BrokerAccount) => void;
  onView: () => void;
}) {
  return (
    <SectionCard title="Multi-account breakdown" subtitle="Expand for linked strategies and quick actions.">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2" />
              <th className="px-2 py-2">Account</th>
              <th className="px-2 py-2">Broker</th>
              <th className="px-2 py-2">Connection</th>
              <th className="px-2 py-2">Day P&L</th>
              <th className="px-2 py-2">Mkt value</th>
              <th className="px-2 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const open = expanded.has(a.id);
              const day = positions.filter((p) => p.accountId === a.id).reduce((s, p) => s + p.dayPnl, 0);
              const mv = positions.filter((p) => p.accountId === a.id).reduce((s, p) => s + p.marketValue, 0);
              const linked = strategies.filter((s) => s.accountIds.includes(a.id));
              return (
                <FragmentRows key={a.id}>
                  <tr className="border-b border-slate-100">
                    <td className="px-2 py-2">
                      <button type="button" onClick={() => onToggle(a.id)} aria-label="Expand account">
                        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <div className="font-medium">{a.alias}</div>
                      <div className="text-xs text-slate-400">{a.accountIdMasked}</div>
                    </td>
                    <td className="px-2 py-2 uppercase text-xs">{a.broker}</td>
                    <td className="px-2 py-2">
                      <ConnDot state={a.connectionState} />
                    </td>
                    <td className="px-2 py-2">
                      <MoneyTone value={day}>{money(day)}</MoneyTone>
                    </td>
                    <td className="px-2 py-2" style={tabular}>
                      {money(mv)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button type="button" className={btnOutline + ' !px-2 !py-1 !text-xs'} onClick={onView}>
                          View
                        </button>
                        <button
                          type="button"
                          className={btnDanger}
                          onClick={() => {
                            const s = linked.find((x) => x.status === 'ACTIVE');
                            if (s) onPause({ id: s.id, name: s.name });
                          }}
                        >
                          Pause strategies
                        </button>
                        <button type="button" className={btnDanger} onClick={() => onCancelOpen(a.id)}>
                          Cancel orders
                        </button>
                        <button type="button" className={btnDanger} onClick={() => onDisable(a)}>
                          Disable
                        </button>
                        <button
                          type="button"
                          className={btnOutline + ' !px-2 !py-1 !text-xs'}
                          onClick={() => onReconcile(a)}
                        >
                          Reconcile
                        </button>
                      </div>
                    </td>
                  </tr>
                  {open ? (
                    <tr className="border-b border-slate-50 bg-slate-50/60">
                      <td />
                      <td colSpan={6} className="px-2 py-2 text-xs text-slate-600">
                        Markets: {a.markets.join(', ')} · Risk profile: {a.riskProfile} · Trading{' '}
                        {a.tradingEnabled ? 'enabled' : 'disabled'} · Strategies:{' '}
                        {linked.map((s) => s.name).join(', ') || '—'}
                      </td>
                    </tr>
                  ) : null}
                </FragmentRows>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function OrdersTable({
  orders,
  accountLabel,
  money,
  onCancel,
}: {
  orders: {
    id: string;
    symbol: string;
    accountId: string;
    side: string;
    orderType: string;
    quantity: number;
    filledQty: number;
    remainingQty: number;
    price: number | null;
    status: OrderStatus;
    tradingMode: TradingModeLabel;
    exchange: string;
    submittedAt: string;
  }[];
  accountLabel: (id: string) => string;
  money: (n: number) => string;
  onCancel: (o: { id: string; symbol: string }) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-2 py-2">Symbol</th>
            <th className="px-2 py-2">Account</th>
            <th className="px-2 py-2">Side</th>
            <th className="px-2 py-2">Type</th>
            <th className="px-2 py-2">Qty</th>
            <th className="px-2 py-2">Filled</th>
            <th className="px-2 py-2">Price</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Mode</th>
            <th className="px-2 py-2">Exch</th>
            <th className="px-2 py-2">Submitted</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-slate-100">
              <td className="px-2 py-2 font-medium">{o.symbol}</td>
              <td className="px-2 py-2 text-xs">{accountLabel(o.accountId)}</td>
              <td className="px-2 py-2">{o.side}</td>
              <td className="px-2 py-2">{o.orderType}</td>
              <td className="px-2 py-2" style={tabular}>
                {o.quantity}
              </td>
              <td className="px-2 py-2" style={tabular}>
                {o.filledQty}/{o.quantity}
              </td>
              <td className="px-2 py-2" style={tabular}>
                {o.price != null ? money(o.price) : '—'}
              </td>
              <td className="px-2 py-2 text-xs">{o.status.replace(/_/g, ' ')}</td>
              <td className="px-2 py-2 text-xs">{o.tradingMode}</td>
              <td className="px-2 py-2">{o.exchange}</td>
              <td className="px-2 py-2 text-xs" style={tabular}>
                {formatTs(o.submittedAt)}
              </td>
              <td className="px-2 py-2">
                {OPEN_ORDER_STATUSES.includes(o.status) ? (
                  <button type="button" className={btnDanger} onClick={() => onCancel(o)}>
                    Cancel
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {!orders.length ? (
            <tr>
              <td colSpan={12} className="px-2 py-6 text-center text-slate-400">
                No orders
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default SensexMultiAccountPortfolioPage;
