/**
 * US Stocks Manual Trading workstation (IBKR paper / live).
 * Environment identity comes only from the selected connection profile.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { usStocksApi } from './api';
import {
  accountFingerprint,
  documentTitleForEnv,
  environmentFromProfile,
  formatPrice,
  formatQty,
  formatTs,
  formatUsd,
  formatUsdSigned,
  liveConfirmButtonLabel,
  quoteFingerprint,
  tabularStyle,
} from './format';
import type {
  IBKRConnectionProfile,
  ManualOrderIntent,
  Order,
  OrderPreview,
  OrderSide,
  OrderType,
  TimeInForce,
  TradingEnvironment,
  USStockInstrument,
} from './types';
import { UsStocksApiError } from './types';
import {
  ConfirmModal,
  EmptyState,
  EnvBanner,
  EnvChip,
  ErrorBanner,
  FreshnessBadge,
  MoneyTone,
  SectionCard,
  SessionBadge,
} from './ui';

type BottomTab = 'positions' | 'orders' | 'executions' | 'audit';

const STRATEGY_TAG = 'Manual Trade';
const POLL_MS = 12_000;

const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-50';
const btnOutline =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 disabled:opacity-50';
const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50';
const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500';
const labelCls = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500';

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof UsStocksApiError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

function openOrderStatuses(status: string): boolean {
  return [
    'SUBMITTING',
    'BROKER_CONFIRMATION_REQUIRED',
    'SUBMITTED',
    'ACKNOWLEDGED',
    'PARTIAL_FILLED',
    'CANCEL_PENDING',
    'PREVIEWED',
  ].includes(status);
}

export function UsStocksManualTradingPage() {
  const qc = useQueryClient();

  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [accountId, setAccountId] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [instrument, setInstrument] = useState<USStockInstrument | null>(null);

  const [side, setSide] = useState<OrderSide>('BUY');
  const [qty, setQty] = useState<string>('10');
  const [orderType, setOrderType] = useState<OrderType>('LMT');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [tif, setTif] = useState<TimeInForce>('DAY');
  const [outsideRth, setOutsideRth] = useState(false);

  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState('');
  const [bottomTab, setBottomTab] = useState<BottomTab>('positions');
  const [paperNoticeOpen, setPaperNoticeOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [paperConfirmOpen, setPaperConfirmOpen] = useState(false);
  const [liveConfirmOpen, setLiveConfirmOpen] = useState(false);
  const [liveAck, setLiveAck] = useState(false);
  const [liveTyped, setLiveTyped] = useState('');
  const [brokerReplyOrder, setBrokerReplyOrder] = useState<Order | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(searchQ.trim()), 280);
    return () => window.clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const profilesQuery = useQuery({
    queryKey: ['us-stocks', 'profiles'],
    queryFn: () => usStocksApi.getProfiles(),
    staleTime: 30_000,
    retry: 1,
  });

  const sessionQuery = useQuery({
    queryKey: ['us-stocks', 'session'],
    queryFn: () => usStocksApi.getSession(),
    refetchInterval: (q) => (q.state.data?.state === 'TRADING_READY' ? POLL_MS : 30_000),
    retry: 1,
  });

  const profiles = profilesQuery.data || [];
  const session = sessionQuery.data;

  const activeProfile: IBKRConnectionProfile | null = useMemo(() => {
    const id = selectedProfileId || session?.selectedProfileId || '';
    return profiles.find((p) => p.id === id) || profiles.find((p) => p.isDefault) || profiles[0] || null;
  }, [profiles, selectedProfileId, session?.selectedProfileId]);

  const environment: TradingEnvironment | null = environmentFromProfile(activeProfile);

  useEffect(() => {
    document.title = documentTitleForEnv(environment);
    return () => {
      document.title = 'AlgoTradingV360';
    };
  }, [environment]);

  useEffect(() => {
    if (activeProfile && !selectedProfileId) {
      setSelectedProfileId(activeProfile.id);
    }
  }, [activeProfile, selectedProfileId]);

  const accountsQuery = useQuery({
    queryKey: ['us-stocks', 'accounts', activeProfile?.id],
    queryFn: () => usStocksApi.getAccounts(),
    enabled: !!activeProfile,
    retry: 1,
  });

  const accounts = useMemo(() => {
    const all = accountsQuery.data || session?.accounts || [];
    if (!environment) return all;
    return all.filter((a) => a.environment === environment);
  }, [accountsQuery.data, session?.accounts, environment]);

  useEffect(() => {
    if (!accounts.length) {
      setAccountId('');
      return;
    }
    if (!accountId || !accounts.some((a) => a.accountId === accountId)) {
      const fromProfile = activeProfile?.accountIds?.[0];
      const hit = accounts.find((a) => a.accountId === fromProfile) || accounts[0];
      setAccountId(hit.accountId);
    }
  }, [accounts, accountId, activeProfile]);

  const tradingReady = session?.state === 'TRADING_READY';

  const summaryQuery = useQuery({
    queryKey: ['us-stocks', 'summary', accountId],
    queryFn: () => usStocksApi.getAccountSummary(accountId),
    enabled: !!accountId,
    refetchInterval: tradingReady ? POLL_MS : false,
    retry: 1,
  });

  const marketSessionQuery = useQuery({
    queryKey: ['us-stocks', 'market-session'],
    queryFn: () => usStocksApi.getMarketSession(),
    refetchInterval: 60_000,
    retry: 1,
  });

  const searchQuery = useQuery({
    queryKey: ['us-stocks', 'search', debouncedQ],
    queryFn: () => usStocksApi.searchInstruments(debouncedQ),
    enabled: debouncedQ.length >= 1,
    retry: 0,
  });

  const quoteQuery = useQuery({
    queryKey: ['us-stocks', 'quote', instrument?.conId],
    queryFn: () => usStocksApi.getQuote(instrument!.conId),
    enabled: !!instrument?.conId,
    refetchInterval: tradingReady ? 8_000 : false,
    retry: 1,
  });

  const capsQuery = useQuery({
    queryKey: ['us-stocks', 'caps', instrument?.conId],
    queryFn: () => usStocksApi.getCapabilities(instrument!.conId),
    enabled: !!instrument?.conId,
    staleTime: 60_000,
    retry: 1,
  });

  const positionsQuery = useQuery({
    queryKey: ['us-stocks', 'positions', accountId],
    queryFn: () => usStocksApi.getPositions(accountId),
    enabled: !!accountId,
    refetchInterval: tradingReady ? POLL_MS : false,
    retry: 1,
  });

  const ordersQuery = useQuery({
    queryKey: ['us-stocks', 'orders', accountId],
    queryFn: () => usStocksApi.getOrders(accountId),
    enabled: !!accountId,
    refetchInterval: tradingReady ? POLL_MS : false,
    retry: 1,
  });

  const executionsQuery = useQuery({
    queryKey: ['us-stocks', 'executions', accountId],
    queryFn: () => usStocksApi.getExecutions(accountId),
    enabled: !!accountId && bottomTab === 'executions',
    refetchInterval: tradingReady ? POLL_MS : false,
    retry: 1,
  });

  const auditQuery = useQuery({
    queryKey: ['us-stocks', 'audit'],
    queryFn: () => usStocksApi.getAudit(),
    enabled: bottomTab === 'audit',
    refetchInterval: tradingReady ? POLL_MS : false,
    retry: 1,
  });

  const capabilities = capsQuery.data;
  const quote = quoteQuery.data;
  const summary = summaryQuery.data;

  useEffect(() => {
    if (!capabilities) return;
    if (!capabilities.supportedOrderTypes.includes(orderType)) {
      setOrderType(capabilities.supportedOrderTypes[0] || 'MKT');
    }
    if (!capabilities.supportedTif.includes(tif)) {
      setTif(capabilities.supportedTif[0] || 'DAY');
    }
    if (!capabilities.outsideRthAllowed && outsideRth) {
      setOutsideRth(false);
    }
  }, [capabilities, orderType, tif, outsideRth]);

  useEffect(() => {
    if (quote?.last != null && instrument && quote.conId === instrument.conId) {
      setLimitPrice((prev) => (prev.trim() === '' ? String(quote.last) : prev));
    }
  }, [quote?.last, quote?.conId, instrument]);

  // Invalidate preview when quote / account change materially
  useEffect(() => {
    if (!preview) return;
    const fp = `${quoteFingerprint(quote)}::${accountFingerprint(summary)}`;
    if (previewFingerprint && fp && fp !== previewFingerprint) {
      setPreview(null);
      setToast('Preview invalidated — quote or account changed. Re-run Preview Order.');
    }
  }, [quote, summary, preview, previewFingerprint]);

  // Surface broker confirmation from open orders
  useEffect(() => {
    const list = ordersQuery.data || [];
    const pending = list.find(
      (o) => o.status === 'BROKER_CONFIRMATION_REQUIRED' && o.pendingReply?.messageId
    );
    if (pending) setBrokerReplyOrder(pending);
  }, [ordersQuery.data]);

  const selectProfileMut = useMutation({
    mutationFn: (profileId: string) => usStocksApi.selectProfile(profileId),
    onSuccess: async (status) => {
      setSelectedProfileId(status.selectedProfileId || selectedProfileId);
      setPreview(null);
      await qc.invalidateQueries({ queryKey: ['us-stocks'] });
      setToast(`Switched to profile environment ${status.environment || '—'}`);
    },
    onError: (e) => setToast(errMsg(e, 'Failed to select profile')),
  });

  const establishMut = useMutation({
    mutationFn: () => usStocksApi.establishSession(),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['us-stocks', 'session'] });
      setToast('Brokerage session establish requested');
    },
    onError: (e) => setToast(errMsg(e, 'Failed to establish session')),
  });

  const previewMut = useMutation({
    mutationFn: (intent: ManualOrderIntent) => usStocksApi.previewOrder(intent),
    onSuccess: (data) => {
      setPreview(data);
      setPreviewFingerprint(`${quoteFingerprint(quote)}::${accountFingerprint(summary)}`);
      setToast('Preview ready — review before placing');
    },
    onError: (e) => setToast(errMsg(e, 'Preview failed')),
  });

  const submitMut = useMutation({
    mutationFn: usStocksApi.submitOrder,
    onSuccess: async (order) => {
      setPaperConfirmOpen(false);
      setLiveConfirmOpen(false);
      setLiveAck(false);
      setLiveTyped('');
      setPreview(null);
      if (order.status === 'BROKER_CONFIRMATION_REQUIRED' && order.pendingReply) {
        setBrokerReplyOrder(order);
        setToast('IBKR broker confirmation required — review the exact message');
      } else {
        setToast(`Order ${order.orderId} → ${order.status}`);
      }
      await qc.invalidateQueries({ queryKey: ['us-stocks'] });
    },
    onError: (e) => setToast(errMsg(e, 'Submit failed')),
  });

  const confirmReplyMut = useMutation({
    mutationFn: (messageId: string) => usStocksApi.confirmBrokerReply(messageId),
    onSuccess: async (order) => {
      setBrokerReplyOrder(null);
      setToast(`Broker reply confirmed — order ${order.status}`);
      await qc.invalidateQueries({ queryKey: ['us-stocks'] });
    },
    onError: (e) => setToast(errMsg(e, 'Confirm reply failed')),
  });

  const rejectReplyMut = useMutation({
    mutationFn: (messageId: string) => usStocksApi.rejectBrokerReply(messageId),
    onSuccess: async () => {
      setBrokerReplyOrder(null);
      setToast('Broker reply rejected');
      await qc.invalidateQueries({ queryKey: ['us-stocks'] });
    },
    onError: (e) => setToast(errMsg(e, 'Reject reply failed')),
  });

  const cancelMut = useMutation({
    mutationFn: (orderId: string) => usStocksApi.cancelOrder(orderId),
    onSuccess: async (order) => {
      setToast(`Cancel requested — ${order.status}`);
      await qc.invalidateQueries({ queryKey: ['us-stocks', 'orders'] });
    },
    onError: (e) => setToast(errMsg(e, 'Cancel failed')),
  });

  const buildIntent = useCallback((): ManualOrderIntent | null => {
    if (!accountId || !instrument) return null;
    const quantity = Number(qty);
    if (!(quantity > 0)) return null;
    if (capabilities && !capabilities.allowFractional && !Number.isInteger(quantity)) {
      return null;
    }
    const intent: ManualOrderIntent = {
      accountId,
      conId: instrument.conId,
      side,
      orderType,
      quantity,
      tif,
      outsideRth,
      strategyTag: STRATEGY_TAG,
    };
    if (orderType === 'LMT' || orderType === 'STP_LMT') {
      const lp = Number(limitPrice);
      if (!(lp > 0)) return null;
      intent.limitPrice = lp;
    }
    if (orderType === 'STP' || orderType === 'STP_LMT') {
      const sp = Number(stopPrice);
      if (!(sp > 0)) return null;
      intent.stopPrice = sp;
    }
    return intent;
  }, [
    accountId,
    instrument,
    qty,
    capabilities,
    side,
    orderType,
    tif,
    outsideRth,
    limitPrice,
    stopPrice,
  ]);

  const onPreview = () => {
    const intent = buildIntent();
    if (!intent) {
      setToast('Complete ticket: ConID instrument, valid qty, and prices as required');
      return;
    }
    previewMut.mutate(intent);
  };

  const onPlaceClick = () => {
    if (!preview?.allowed) {
      setToast('Run a successful Preview Order first');
      return;
    }
    if (environment === 'LIVE') {
      setLiveAck(false);
      setLiveTyped('');
      setLiveConfirmOpen(true);
      return;
    }
    setPaperConfirmOpen(true);
  };

  const submitFromConfirm = (livePhrase?: string) => {
    const intent = buildIntent();
    if (!intent || !preview) return;
    submitMut.mutate({
      ...intent,
      previewId: preview.previewId,
      ...(livePhrase ? { liveConfirmPhrase: livePhrase } : {}),
    });
  };

  const selectedAccount = accounts.find((a) => a.accountId === accountId);
  const paperLimitations =
    activeProfile?.paperLimitations || session?.paperLimitations || [];
  const tradingBlocked =
    session?.tradingEnabled === false ||
    session?.readOnly ||
    session?.competingSession ||
    session?.state === 'COMPETING_SESSION' ||
    session?.state === 'READ_ONLY' ||
    (session?.state != null && session.state !== 'TRADING_READY');

  const blockedReason =
    session?.blockedReason ||
    (session?.competingSession || session?.state === 'COMPETING_SESSION'
      ? 'Competing IBKR session — resolve before trading'
      : session?.readOnly || session?.state === 'READ_ONLY'
        ? 'Session is read-only'
        : session?.state && session.state !== 'TRADING_READY'
          ? `Session state ${session.state} — trading not enabled`
          : null);

  const qtyNum = Number(qty) || 0;
  const liveBtn = liveConfirmButtonLabel(side, qtyNum);
  const liveReady = liveAck && liveTyped.trim() === 'LIVE';

  const openOrders = (ordersQuery.data || []).filter((o) => openOrderStatuses(o.status));

  const bootstrapError =
    profilesQuery.error || sessionQuery.error
      ? errMsg(profilesQuery.error || sessionQuery.error, 'Failed to load US Stocks trading API')
      : null;

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1600px] space-y-3 p-3 md:p-4">
        <EnvBanner environment={environment} profileLabel={activeProfile?.label} />

        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
              US Stocks Manual Trading
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              IBKR workstation · ConID-resolved equities &amp; ETFs · Preview before submit
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className={labelCls} htmlFor="us-profile">
                Connection profile
              </label>
              <select
                id="us-profile"
                className={cn(inputCls, 'min-w-[14rem]')}
                value={activeProfile?.id || ''}
                disabled={selectProfileMut.isPending || !profiles.length}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedProfileId(id);
                  selectProfileMut.mutate(id);
                }}
              >
                {!profiles.length ? <option value="">No profiles</option> : null}
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} — {p.environment}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={btnOutline}
              onClick={() => {
                void sessionQuery.refetch();
                void profilesQuery.refetch();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              className={btnPrimary}
              disabled={establishMut.isPending}
              onClick={() => establishMut.mutate()}
            >
              {establishMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Establish session
            </button>
          </div>
        </header>

        {toast ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            {toast}
          </div>
        ) : null}

        {bootstrapError ? <ErrorBanner message={bootstrapError} /> : null}

        {/* Session panel */}
        <SectionCard title="Session" subtitle="Account & trading gate from authenticated IBKR profile">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Meta label="Account alias" value={session?.accountAlias || selectedAccount?.accountTitle || '—'} />
            <Meta
              label="Account ID"
              value={
                session?.accountIdMasked ||
                selectedAccount?.accountIdMasked ||
                maskId(accountId) ||
                '—'
              }
            />
            <div>
              <div className={labelCls}>Environment</div>
              <EnvChip environment={environment} />
            </div>
            <div>
              <div className={labelCls}>Session state</div>
              <SessionBadge state={session?.state} />
            </div>
            <Meta
              label="Permissions"
              value={(session?.permissions || selectedAccount?.permissions || []).join(', ') || '—'}
            />
            <Meta label="Heartbeat" value={formatTs(session?.heartbeatAt)} />
            <div className="sm:col-span-2">
              <div className={labelCls}>Trading</div>
              {tradingBlocked ? (
                <p className="text-sm text-amber-800">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  Blocked{blockedReason ? `: ${blockedReason}` : ''}
                </p>
              ) : (
                <p className="text-sm text-emerald-700">Enabled</p>
              )}
            </div>
            {session?.isDemo || session?.mode === 'mock' ? (
              <div className="sm:col-span-2">
                <span className="rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-800">
                  DEMO IBKR DATA
                </span>
              </div>
            ) : null}
          </div>
        </SectionCard>

        {environment === 'PAPER' && paperLimitations.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-amber-950"
              onClick={() => setPaperNoticeOpen((v) => !v)}
            >
              {paperNoticeOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Paper trading limitations
            </button>
            {paperNoticeOpen ? (
              <ul className="list-disc space-y-1 px-8 pb-3 text-xs text-amber-900">
                {paperLimitations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* Main 3-column layout */}
        <div className="grid gap-3 lg:grid-cols-12">
          {/* Left: search + quote */}
          <div className="space-y-3 lg:col-span-3">
            <SectionCard title="Symbol search" subtitle="Select a contract ConID — required">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  className={cn(inputCls, 'pl-8')}
                  placeholder="Symbol, name, or ConID"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                />
              </div>
              {searchQuery.isError ? (
                <p className="mt-2 text-xs text-red-700">{errMsg(searchQuery.error, 'Search failed')}</p>
              ) : null}
              <div className="mt-2 max-h-48 overflow-auto rounded border border-slate-100">
                {(searchQuery.data || []).length === 0 && debouncedQ ? (
                  <EmptyState
                    title={searchQuery.isFetching ? 'Searching…' : 'No instruments'}
                    detail="Try AAPL, MSFT, SPY, or a numeric ConID"
                  />
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {(searchQuery.data || []).map((row) => (
                      <li key={row.conId}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full flex-col px-2.5 py-2 text-left hover:bg-sky-50',
                            instrument?.conId === row.conId && 'bg-sky-50'
                          )}
                          onClick={() => {
                            setInstrument(row);
                            setPreview(null);
                          }}
                        >
                          <span className="text-sm font-semibold text-slate-900">
                            {row.symbol}{' '}
                            <span className="font-normal text-slate-500">ConID {row.conId}</span>
                          </span>
                          <span className="truncate text-xs text-slate-500">
                            {row.description} · {row.primaryExchange}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {instrument ? (
                <p className="mt-2 text-xs text-slate-600">
                  Selected: <strong>{instrument.symbol}</strong> (ConID {instrument.conId})
                  {instrument.fractionalEligible ? ' · fractional eligible' : ' · whole shares'}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-700">Select a ConID before previewing an order.</p>
              )}
            </SectionCard>

            <SectionCard
              title="Quote"
              subtitle="US market session"
              actions={quote ? <FreshnessBadge freshness={quote.dataState} /> : undefined}
            >
              {!instrument ? (
                <EmptyState title="No contract selected" />
              ) : quoteQuery.isError ? (
                <ErrorBanner message={errMsg(quoteQuery.error, 'Quote unavailable')} />
              ) : !quote ? (
                <EmptyState title={quoteQuery.isFetching ? 'Loading quote…' : 'No quote'} />
              ) : (
                <div className="space-y-2" style={tabularStyle}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-500">{quote.symbol}</span>
                    <span className="text-xl font-semibold text-slate-900">
                      {formatPrice(quote.last)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Bid</div>
                      {formatPrice(quote.bid)}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Ask</div>
                      {formatPrice(quote.ask)}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Volume</div>
                      {quote.volume != null ? formatQty(quote.volume) : '—'}
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">As of</div>
                      {formatTs(quote.asOf)}
                    </div>
                  </div>
                  {quote.label ? (
                    <p className="text-[11px] font-medium text-sky-800">{quote.label}</p>
                  ) : null}
                </div>
              )}
              <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-600">
                {marketSessionQuery.data ? (
                  <>
                    US session:{' '}
                    <strong>{marketSessionQuery.data.session}</strong>
                    {marketSessionQuery.data.isOpen ? ' (open)' : ' (closed)'} ·{' '}
                    {marketSessionQuery.data.exchange}
                  </>
                ) : (
                  'US market session unavailable'
                )}
              </div>
            </SectionCard>
          </div>

          {/* Center: ticket */}
          <div className="space-y-3 lg:col-span-5">
            <SectionCard
              title="Order ticket"
              subtitle="Preview never submits — confirm modals gate placement"
              actions={<EnvChip environment={environment} />}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Account</label>
                  <select
                    className={inputCls}
                    value={accountId}
                    onChange={(e) => {
                      setAccountId(e.target.value);
                      setPreview(null);
                    }}
                  >
                    {!accounts.length ? <option value="">No accounts</option> : null}
                    {accounts.map((a) => (
                      <option key={a.accountId} value={a.accountId}>
                        {a.accountTitle} ({a.environment})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Side</label>
                  <div className="flex gap-1">
                    {(['BUY', 'SELL'] as OrderSide[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={cn(
                          'flex-1 rounded-md border px-2 py-1.5 text-sm font-semibold',
                          side === s && s === 'BUY' && 'border-teal-600 bg-teal-50 text-teal-800',
                          side === s && s === 'SELL' && 'border-red-500 bg-red-50 text-red-800',
                          side !== s && 'border-slate-300 bg-white text-slate-600'
                        )}
                        onClick={() => {
                          setSide(s);
                          setPreview(null);
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls} htmlFor="us-qty">
                    Quantity{capabilities?.allowFractional ? ' (fractional OK)' : ' (whole shares)'}
                  </label>
                  <input
                    id="us-qty"
                    className={inputCls}
                    style={tabularStyle}
                    value={qty}
                    onChange={(e) => {
                      setQty(e.target.value);
                      setPreview(null);
                    }}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className={labelCls}>Order type</label>
                  <select
                    className={inputCls}
                    value={orderType}
                    onChange={(e) => {
                      setOrderType(e.target.value as OrderType);
                      setPreview(null);
                    }}
                  >
                    {(capabilities?.supportedOrderTypes || (['MKT', 'LMT', 'STP', 'STP_LMT'] as OrderType[])).map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
                  </select>
                </div>
                {(orderType === 'LMT' || orderType === 'STP_LMT') && (
                  <div>
                    <label className={labelCls}>Limit price</label>
                    <input
                      className={inputCls}
                      style={tabularStyle}
                      value={limitPrice}
                      onChange={(e) => {
                        setLimitPrice(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </div>
                )}
                {(orderType === 'STP' || orderType === 'STP_LMT') && (
                  <div>
                    <label className={labelCls}>Stop price</label>
                    <input
                      className={inputCls}
                      style={tabularStyle}
                      value={stopPrice}
                      onChange={(e) => {
                        setStopPrice(e.target.value);
                        setPreview(null);
                      }}
                    />
                  </div>
                )}
                <div>
                  <label className={labelCls}>Time in force</label>
                  <select
                    className={inputCls}
                    value={tif}
                    onChange={(e) => {
                      setTif(e.target.value as TimeInForce);
                      setPreview(null);
                    }}
                  >
                    {(capabilities?.supportedTif || (['DAY', 'GTC', 'IOC'] as TimeInForce[])).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={outsideRth}
                      disabled={!capabilities?.outsideRthAllowed}
                      onChange={(e) => {
                        setOutsideRth(e.target.checked);
                        setPreview(null);
                      }}
                    />
                    <span>
                      Allow outside RTH
                      {outsideRth ? (
                        <span className="mt-0.5 block text-xs text-amber-700">
                          Warning: extended-hours liquidity and price discovery differ from RTH.
                        </span>
                      ) : null}
                      {!capabilities?.outsideRthAllowed ? (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          Outside RTH not permitted for this contract.
                        </span>
                      ) : null}
                    </span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Strategy tag</label>
                  <input className={inputCls} value={STRATEGY_TAG} readOnly />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={previewMut.isPending || !instrument || tradingBlocked}
                  onClick={onPreview}
                >
                  {previewMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Preview Order
                </button>
                <button
                  type="button"
                  className={cn(
                    btnOutline,
                    environment === 'LIVE' && 'border-red-400 text-red-800 hover:bg-red-50'
                  )}
                  disabled={!preview?.allowed || submitMut.isPending || tradingBlocked}
                  onClick={onPlaceClick}
                >
                  Place {environment === 'LIVE' ? 'Live' : 'Paper'} Order…
                </button>
              </div>
            </SectionCard>

            <SectionCard
              title="Order preview"
              subtitle="Platform validation only — does not route to IBKR"
              actions={<EnvChip environment={environment} />}
            >
              {!preview ? (
                <EmptyState title="No preview" detail="Click Preview Order after selecting a ConID" />
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <EnvChip environment={preview.intent.environment} />
                    <span style={tabularStyle}>
                      {preview.intent.side} {formatQty(preview.intent.quantity)} {preview.intent.instrument.symbol}{' '}
                      · {preview.intent.orderType}
                    </span>
                  </div>
                  <p style={tabularStyle}>
                    Est. notional: <strong>{formatUsd(preview.estimatedNotional)}</strong>
                    {preview.estimatedCommission != null
                      ? ` · Est. commission ${formatUsd(preview.estimatedCommission)}`
                      : ''}
                  </p>
                  {preview.warnings?.length ? (
                    <ul className="list-disc pl-5 text-xs text-amber-800">
                      {preview.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="overflow-auto rounded border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-2 py-1.5">Check</th>
                          <th className="px-2 py-1.5">Severity</th>
                          <th className="px-2 py-1.5">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.riskChecks.map((c) => (
                          <tr key={c.code} className="border-t border-slate-100">
                            <td className="px-2 py-1.5">{c.message}</td>
                            <td className="px-2 py-1.5">{c.severity}</td>
                            <td
                              className={cn(
                                'px-2 py-1.5 font-medium',
                                c.passed ? 'text-teal-700' : 'text-red-700'
                              )}
                            >
                              {c.passed ? 'PASS' : 'FAIL'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className={preview.allowed ? 'text-teal-700' : 'text-red-700'}>
                    {preview.allowed ? 'Preview allowed — proceed to confirm' : 'Preview blocked'}
                  </p>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Right: account summary */}
          <div className="lg:col-span-4">
            <SectionCard
              title="Account summary"
              subtitle="NLV, buying power, margins, P&L"
              actions={<EnvChip environment={summary?.environment || environment} />}
            >
              {summaryQuery.isError ? (
                <ErrorBanner message={errMsg(summaryQuery.error, 'Account summary unavailable')} />
              ) : !summary ? (
                <EmptyState
                  title={summaryQuery.isFetching ? 'Loading…' : 'No account summary'}
                  detail={!accountId ? 'Select an account' : undefined}
                />
              ) : (
                <div className="space-y-3">
                  {(summary.stale || summary.freshness === 'STALE') && (
                    <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                      <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                      Account figures may be stale{summary.asOf ? ` (as of ${formatTs(summary.asOf)})` : ''}.
                    </div>
                  )}
                  <dl className="grid grid-cols-2 gap-2 text-sm" style={tabularStyle}>
                    <SummaryStat label="Net liquidation" value={formatUsd(summary.netLiquidation)} />
                    <SummaryStat label="Buying power" value={formatUsd(summary.buyingPower)} />
                    <SummaryStat label="Available funds" value={formatUsd(summary.availableFunds)} />
                    <SummaryStat label="Excess liquidity" value={formatUsd(summary.excessLiquidity)} />
                    {summary.initMargin != null ? (
                      <SummaryStat label="Init. margin" value={formatUsd(summary.initMargin)} />
                    ) : null}
                    {summary.maintMargin != null ? (
                      <SummaryStat label="Maint. margin" value={formatUsd(summary.maintMargin)} />
                    ) : null}
                    <SummaryStat
                      label="Day P&L"
                      value={
                        <MoneyTone value={summary.dayPnl ?? 0}>
                          {formatUsdSigned(summary.dayPnl)}
                        </MoneyTone>
                      }
                    />
                    <SummaryStat
                      label="Unrealized P&L"
                      value={
                        <MoneyTone value={summary.unrealizedPnl ?? 0}>
                          {formatUsdSigned(summary.unrealizedPnl)}
                        </MoneyTone>
                      }
                    />
                  </dl>
                  {summary.label ? (
                    <p className="text-[11px] font-medium text-sky-800">{summary.label}</p>
                  ) : null}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {/* Bottom tabs */}
        <SectionCard title="Book & audit">
          <div className="mb-3 flex flex-wrap gap-1 border-b border-slate-100 pb-2">
            {(
              [
                ['positions', 'Positions'],
                ['orders', 'Open Orders'],
                ['executions', 'Executions'],
                ['audit', 'Audit'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm',
                  bottomTab === id
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
                onClick={() => setBottomTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {bottomTab === 'positions' && (
            <DataTable
              error={positionsQuery.error ? errMsg(positionsQuery.error, 'Positions failed') : null}
              empty={!positionsQuery.data?.length}
              emptyTitle="No positions"
              loading={positionsQuery.isFetching && !positionsQuery.data}
              headers={['Symbol', 'ConID', 'Qty', 'Avg cost', 'Mkt value', 'uPnL', 'Env']}
              rows={(positionsQuery.data || []).map((p) => [
                p.symbol,
                String(p.conId),
                formatQty(p.quantity, true),
                formatUsd(p.avgCost),
                formatUsd(p.marketValue),
                formatUsdSigned(p.unrealizedPnl),
                p.environment,
              ])}
            />
          )}

          {bottomTab === 'orders' && (
            <div className="space-y-2">
              <DataTable
                error={ordersQuery.error ? errMsg(ordersQuery.error, 'Orders failed') : null}
                empty={!openOrders.length}
                emptyTitle="No open orders"
                loading={ordersQuery.isFetching && !ordersQuery.data}
                headers={['Order', 'Symbol', 'Side', 'Qty', 'Type', 'Status', 'Env', '']}
                rows={openOrders.map((o) => [
                  o.orderId,
                  o.symbol,
                  o.side,
                  formatQty(o.quantity, true),
                  o.orderType,
                  o.status.replace(/_/g, ' '),
                  o.environment,
                  o.status !== 'CANCEL_PENDING' && o.status !== 'FILLED' && o.status !== 'CANCELLED' ? (
                    <button
                      key={`c-${o.orderId}`}
                      type="button"
                      className={btnDanger}
                      disabled={cancelMut.isPending}
                      onClick={() => cancelMut.mutate(o.orderId)}
                    >
                      Cancel
                    </button>
                  ) : (
                    '—'
                  ),
                ])}
              />
            </div>
          )}

          {bottomTab === 'executions' && (
            <DataTable
              error={executionsQuery.error ? errMsg(executionsQuery.error, 'Executions failed') : null}
              empty={!executionsQuery.data?.length}
              emptyTitle="No executions"
              loading={executionsQuery.isFetching && !executionsQuery.data}
              headers={['Exec', 'Symbol', 'Side', 'Qty', 'Price', 'Time', 'Env']}
              rows={(executionsQuery.data || []).map((e) => [
                e.execId,
                e.symbol,
                e.side,
                formatQty(e.quantity, true),
                formatUsd(e.price),
                formatTs(e.executedAt),
                e.environment,
              ])}
            />
          )}

          {bottomTab === 'audit' && (
            <DataTable
              error={auditQuery.error ? errMsg(auditQuery.error, 'Audit failed') : null}
              empty={!auditQuery.data?.length}
              emptyTitle="No audit events"
              loading={auditQuery.isFetching && !auditQuery.data}
              headers={['When', 'Action', 'Env', 'Order', 'Details']}
              rows={(auditQuery.data || []).map((a) => [
                formatTs(a.at),
                a.action,
                a.environment || '—',
                a.orderId || '—',
                a.details ? JSON.stringify(a.details) : '—',
              ])}
            />
          )}
        </SectionCard>
      </div>

      {/* Paper confirm */}
      <ConfirmModal
        open={paperConfirmOpen}
        title="Place Paper Order"
        confirmLabel="Place Paper Order"
        onCancel={() => setPaperConfirmOpen(false)}
        onConfirm={() => submitFromConfirm()}
        confirmDisabled={submitMut.isPending}
      >
        <div className="space-y-2">
          <EnvChip environment="PAPER" />
          <p>
            Submit <strong>{side}</strong> {formatQty(qtyNum, true)}{' '}
            {instrument?.symbol || '—'} ({orderType}) on paper profile{' '}
            <strong>{activeProfile?.label}</strong>.
          </p>
          <p className="text-xs text-slate-500">
            Paper path only — this does not flip to live. Preview id: {preview?.previewId || '—'}
          </p>
        </div>
      </ConfirmModal>

      {/* Live confirm */}
      <ConfirmModal
        open={liveConfirmOpen}
        title="Confirm LIVE order"
        confirmLabel={liveBtn}
        destructive
        confirmDisabled={!liveReady || submitMut.isPending}
        onCancel={() => {
          setLiveConfirmOpen(false);
          setLiveAck(false);
          setLiveTyped('');
        }}
        onConfirm={() => submitFromConfirm('LIVE')}
      >
        <div className="space-y-3">
          <EnvChip environment="LIVE" />
          <p className="text-red-800">
            Real capital at risk. Profile <strong>{activeProfile?.label}</strong> is LIVE.
          </p>
          <p style={tabularStyle}>
            {side} {formatQty(qtyNum, true)} {instrument?.symbol} · {orderType}
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={liveAck}
              onChange={(e) => setLiveAck(e.target.checked)}
            />
            <span>I understand this is a LIVE IBKR order and cannot be undone as paper.</span>
          </label>
          <div>
            <label className={labelCls}>Type LIVE to continue</label>
            <input
              className={inputCls}
              value={liveTyped}
              onChange={(e) => setLiveTyped(e.target.value)}
              autoComplete="off"
              placeholder="LIVE"
            />
          </div>
        </div>
      </ConfirmModal>

      {/* IBKR broker reply — never auto-confirm */}
      <ConfirmModal
        open={!!brokerReplyOrder?.pendingReply}
        title="IBKR broker confirmation required"
        confirmLabel="Confirm"
        cancelLabel="Reject"
        destructive
        confirmDisabled={confirmReplyMut.isPending}
        onCancel={() => {
          const id = brokerReplyOrder?.pendingReply?.messageId;
          if (id) rejectReplyMut.mutate(id);
          else setBrokerReplyOrder(null);
        }}
        onConfirm={() => {
          const id = brokerReplyOrder?.pendingReply?.messageId;
          if (id) confirmReplyMut.mutate(id);
        }}
      >
        <div className="space-y-2">
          <EnvChip environment={brokerReplyOrder?.environment} />
          <p className="text-xs text-slate-500">
            Exact broker message — review carefully. Nothing is auto-confirmed.
          </p>
          <div className="max-h-48 overflow-auto rounded border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap">
            {(brokerReplyOrder?.pendingReply?.message || []).join('\n') || '(empty message)'}
          </div>
          <p className="text-xs text-slate-500">
            Order {brokerReplyOrder?.orderId} · message{' '}
            {brokerReplyOrder?.pendingReply?.messageId}
          </p>
        </div>
      </ConfirmModal>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={labelCls}>{label}</div>
      <div className="truncate text-sm text-slate-800" title={value}>
        {value}
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function maskId(id: string): string {
  if (!id) return '';
  if (id.length <= 4) return '••••';
  return `${id.slice(0, 2)}••••${id.slice(-2)}`;
}

function DataTable({
  headers,
  rows,
  empty,
  emptyTitle,
  error,
  loading,
}: {
  headers: string[];
  rows: ReactNode[][];
  empty: boolean;
  emptyTitle: string;
  error: string | null;
  loading?: boolean;
}) {
  if (error) return <ErrorBanner message={error} />;
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (empty) return <EmptyState title={emptyTitle} />;
  return (
    <div className="overflow-auto rounded border border-slate-100">
      <table className="w-full min-w-[640px] text-left text-xs" style={tabularStyle}>
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-2.5 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50/80">
              {row.map((cell, j) => (
                <td key={j} className="whitespace-nowrap px-2.5 py-2 text-slate-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UsStocksManualTradingPage;
