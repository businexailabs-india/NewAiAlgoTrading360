import type {
  KillSwitchRequest,
  Order,
  OrderIntent,
  OrderPreview,
  PortfolioService,
  HistoryPeriod,
  BenchmarkId,
} from './types';
import {
  DEMO_ACCOUNTS,
  DEMO_ACCOUNT_GROUPS,
  DEMO_ACTIVITY,
  DEMO_CONTRACTS,
  DEMO_EXCHANGE_STATUS,
  DEMO_ORDER_EVENTS,
  DEMO_ORDERS,
  DEMO_POSITIONS,
  DEMO_QUOTES,
  DEMO_RECON,
  DEMO_STRATEGIES,
  buildDemoExposure,
  buildDemoHistory,
  buildDemoRisk,
  buildDemoSummary,
} from './mock-data';

const delay = (ms = 180) => new Promise((r) => setTimeout(r, ms));

const previews = new Map<string, OrderPreview>();

function filterByAccounts<T extends { accountId?: string; accountIds?: string[] }>(
  rows: T[],
  accountIds: string[],
  getIds: (row: T) => string[]
): T[] {
  if (!accountIds.length) return rows;
  const set = new Set(accountIds);
  return rows.filter((r) => getIds(r).some((id) => set.has(id)));
}

export const mockPortfolioService: PortfolioService = {
  async getAccounts() {
    await delay();
    return DEMO_ACCOUNTS;
  },
  async getAccountGroups() {
    await delay();
    return DEMO_ACCOUNT_GROUPS;
  },
  async getPortfolioSummary(accountIds) {
    await delay();
    const summary = buildDemoSummary();
    return summary;
  },
  async getPortfolioHistory(_accountIds, _period: HistoryPeriod, _benchmark: BenchmarkId) {
    await delay();
    return buildDemoHistory();
  },
  async getPositions(accountIds) {
    await delay();
    return filterByAccounts(DEMO_POSITIONS, accountIds, (p) => [p.accountId]);
  },
  async getOrders(accountIds) {
    await delay();
    return filterByAccounts(DEMO_ORDERS, accountIds, (o) => [o.accountId]);
  },
  async getOrderEvents(orderId) {
    await delay();
    return DEMO_ORDER_EVENTS[orderId] || [];
  },
  async getStrategyAllocations(accountIds) {
    await delay();
    return filterByAccounts(DEMO_STRATEGIES, accountIds, (s) => s.accountIds);
  },
  async getRiskSnapshot(_accountIds) {
    await delay();
    return buildDemoRisk();
  },
  async getReconciliationStatus(accountIds) {
    await delay();
    return filterByAccounts(DEMO_RECON, accountIds, (r) => [r.accountId]);
  },
  async getMarketContext() {
    await delay();
    return { quotes: DEMO_QUOTES, status: DEMO_EXCHANGE_STATUS, demo: true };
  },
  async getDerivativeContracts(exchange, underlying) {
    await delay();
    return DEMO_CONTRACTS.filter(
      (c) => c.exchange === exchange && c.underlying.toUpperCase() === underlying.toUpperCase()
    );
  },
  async getExposure(_accountIds) {
    await delay();
    return buildDemoExposure();
  },
  async getActivity(accountIds) {
    await delay();
    if (!accountIds.length) return DEMO_ACTIVITY;
    const set = new Set(accountIds);
    return DEMO_ACTIVITY.filter((a) => !a.accountId || set.has(a.accountId));
  },
  async previewOrder(intent: OrderIntent): Promise<OrderPreview> {
    await delay(240);
    const account = DEMO_ACCOUNTS.find((a) => a.id === intent.accountId);
    const contract = DEMO_CONTRACTS.find((c) => c.canonicalId === intent.canonicalInstrumentId);
    const errors: string[] = [];
    if (!account) errors.push('Account not found');
    if (account && !account.tradingEnabled) errors.push('Trading disabled on selected account');
    if (account?.connectionState === 'DISCONNECTED') errors.push('Account disconnected');
    if (!intent.canonicalInstrumentId) errors.push('Instrument required — spot index is not tradable');
    if (intent.underlying === 'SENSEX' && intent.instrumentType === 'EQUITY') {
      errors.push('SENSEX spot is a benchmark, not a tradable security. Select futures, options, ETF or basket.');
    }
    if (!(intent.quantity > 0)) errors.push('Quantity must be positive');
    if (intent.lots != null && intent.lots <= 0) errors.push('Lots must be positive when provided');
    if (intent.orderType === 'LIMIT' && !(intent.limitPrice && intent.limitPrice > 0)) {
      errors.push('Limit price required');
    }
    if (contract?.metadataSource === 'UNAVAILABLE') {
      errors.push(
        'Contract lot size / tick / freeze metadata unavailable from instrument master — resolve before live submit.'
      );
    }

    const warnings: string[] = [];
    if (intent.tradingMode === 'LIVE') {
      warnings.push('LIVE mode — real capital at risk. Confirmation phrase required on submit.');
    } else {
      warnings.push('PAPER mode — simulated fill path; not broker live.');
    }
    if (account?.connectionState === 'STALE') warnings.push('Account sync is stale');
    if (intent.exchange === 'BSE') warnings.push('BSE instrument — do not mix with NSE margin assumptions');

    const pos = DEMO_POSITIONS.find(
      (p) => p.accountId === intent.accountId && p.canonicalInstrumentId === intent.canonicalInstrumentId
    );
    const currentQty = pos?.netQty ?? 0;
    const signed = intent.side === 'BUY' ? intent.quantity : -intent.quantity;
    const previewId = `prev-${Date.now()}`;
    const preview: OrderPreview = {
      previewId,
      intent,
      broker: account?.broker || 'other',
      accountAlias: account?.alias || '—',
      instrumentLabel: contract?.tradingSymbol || intent.canonicalInstrumentId || intent.underlying,
      lotSize: contract?.lotSize ?? null,
      tickSize: contract?.tickSize ?? null,
      freezeQty: contract?.freezeQty ?? null,
      estimatedValue: { amount: (intent.limitPrice || 0) * intent.quantity, currency: 'INR' },
      estimatedMargin: { amount: Math.max(5000, intent.quantity * 80), currency: 'INR' },
      estimatedCharges: { amount: 28.5, currency: 'INR' },
      availableMargin: { amount: 6_43_530, currency: 'INR' },
      currentPositionQty: currentQty,
      resultingPositionQty: currentQty + signed,
      maxLossEstimate:
        intent.instrumentType === 'CE' || intent.instrumentType === 'PE'
          ? { amount: (intent.limitPrice || 0) * intent.quantity, currency: 'INR' }
          : null,
      riskWarnings: warnings,
      validationErrors: errors,
      marketSessionOk: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    previews.set(previewId, preview);
    return preview;
  },
  async submitOrder(approvedPreviewId, liveConfirmPhrase) {
    await delay(300);
    const preview = previews.get(approvedPreviewId);
    if (!preview) throw new Error('Preview expired or not found — regenerate preview');
    if (preview.validationErrors.length) {
      throw new Error(`Cannot submit: ${preview.validationErrors.join('; ')}`);
    }
    if (preview.intent.tradingMode === 'LIVE') {
      if (liveConfirmPhrase !== 'Confirm live order') {
        throw new Error('Live submit requires exact confirmation phrase: Confirm live order');
      }
    }
    const order: Order = {
      id: `ord-${Date.now()}`,
      brokerOrderId: null,
      clientReference: preview.intent.clientReference,
      accountId: preview.intent.accountId,
      broker: preview.broker,
      exchange: preview.intent.exchange,
      segment: 'FO',
      canonicalInstrumentId: preview.intent.canonicalInstrumentId || '',
      brokerInstrumentId: null,
      symbol: preview.instrumentLabel,
      strategyId: null,
      side: preview.intent.side,
      orderType: preview.intent.orderType,
      quantity: preview.intent.quantity,
      filledQty: 0,
      remainingQty: preview.intent.quantity,
      price: preview.intent.limitPrice,
      triggerPrice: preview.intent.triggerPrice,
      avgFillPrice: null,
      status: 'SUBMITTED',
      productType: preview.intent.productType,
      tradingMode: preview.intent.tradingMode,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      correlationId: `corr-${approvedPreviewId}`,
    };
    // Never mark FILLED here — wait for broker acknowledgement in real adapters.
    return order;
  },
  async modifyOrder(orderId) {
    await delay();
    const order = DEMO_ORDERS.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');
    return { ...order, status: 'MODIFY_PENDING', updatedAt: new Date().toISOString() };
  },
  async cancelOrder(orderId) {
    await delay();
    const order = DEMO_ORDERS.find((o) => o.id === orderId);
    if (!order) return { accepted: false, message: 'Order not found' };
    // Do not claim cancelled until broker confirms — demo returns pending acceptance.
    return {
      accepted: true,
      message: 'Cancel request accepted locally; awaiting broker confirmation (demo).',
    };
  },
  async pauseStrategy(_strategyId) {
    await delay();
  },
  async triggerKillSwitch(req: KillSwitchRequest) {
    await delay(400);
    if (req.confirmationPhrase !== 'KILL SWITCH') {
      return {
        accepted: false,
        auditId: '',
        message: 'Confirmation phrase mismatch. Type exactly: KILL SWITCH',
      };
    }
    return {
      accepted: true,
      auditId: `audit-kill-${Date.now()}`,
      message:
        'Kill switch recorded (demo). Broker cancel confirmations are still required before orders are treated as cancelled.',
    };
  },
};

/** Swap to live HTTP adapters when backend multi-account APIs are ready. */
export const portfolioApi: PortfolioService = mockPortfolioService;
