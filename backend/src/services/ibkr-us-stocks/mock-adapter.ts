/**
 * Fully functional Mock IBKR trading adapter for US stocks.
 * All market/account data is labeled DEMO IBKR DATA.
 *
 * Paper vs Live comes ONLY from connection profile selection — never a client isPaper flag.
 * Orders are never marked FILLED or CANCELLED without an explicit broker-confirm simulation.
 */

import { appendAudit, listAudit } from './audit';
import {
  AccountSummary,
  AuditEvent,
  BrokerAccount,
  BrokerReplyMessage,
  Execution,
  IBKRConnectionProfile,
  IBKRSessionState,
  IBKRTradingAdapter,
  ManualOrderIntent,
  MarketQuote,
  MarketSessionInfo,
  ModifyOrderRequest,
  Order,
  OrderCapability,
  OrderEvent,
  OrderPlatformState,
  OrderPreview,
  Position,
  RiskCheck,
  SessionStatus,
  TradingEnvironment,
  USStockInstrument,
  ValidatedOrderIntent
} from './types';

export type MockScenarioFlag =
  | 'competing_session'
  | 'read_only'
  | 'stale_quote'
  | 'delayed_md'
  | 'insufficient_funds'
  | 'short_blocked'
  | 'fractional_unsupported'
  | 'broker_reply_required'
  | 'partial_fill'
  | 'reject'
  | 'cancel_confirm_immediate'
  | 'cancel_confirm_on_status_poll'
  | 'auto_fill_after_ack'

const PAPER_PROFILE_ID = 'ibkr-paper-demo';
const LIVE_PROFILE_ID = 'ibkr-live-demo';

const PAPER_ACCOUNT_ID = 'DU1234567';
const LIVE_ACCOUNT_ID = 'U9876543';

const PAPER_LIMITATIONS = [
  'Paper fills are simulated and may differ from live liquidity',
  'DEMO IBKR DATA — not for production decisions',
  'Market data may be delayed or stale in mock mode',
  'Competing session / read-only scenarios are injectable for testing'
];

const DEMO_INSTRUMENTS: USStockInstrument[] = [
  {
    conId: 265598,
    symbol: 'AAPL',
    description: 'APPLE INC',
    exchange: 'SMART',
    primaryExchange: 'NASDAQ',
    currency: 'USD',
    secType: 'STK',
    minTick: 0.01,
    fractionalEligible: true,
    tradingClass: 'NMS'
  },
  {
    conId: 272093,
    symbol: 'MSFT',
    description: 'MICROSOFT CORP',
    exchange: 'SMART',
    primaryExchange: 'NASDAQ',
    currency: 'USD',
    secType: 'STK',
    minTick: 0.01,
    fractionalEligible: true,
    tradingClass: 'NMS'
  },
  {
    conId: 756733,
    symbol: 'SPY',
    description: 'SPDR S&P 500 ETF TRUST',
    exchange: 'SMART',
    primaryExchange: 'ARCA',
    currency: 'USD',
    secType: 'STK',
    minTick: 0.01,
    fractionalEligible: true,
    tradingClass: 'SPY'
  },
  {
    conId: 76792991,
    symbol: 'TSLA',
    description: 'TESLA INC',
    exchange: 'SMART',
    primaryExchange: 'NASDAQ',
    currency: 'USD',
    secType: 'STK',
    minTick: 0.01,
    fractionalEligible: false,
    tradingClass: 'NMS'
  }
];

const BASE_QUOTES: Record<number, { bid: number; ask: number; last: number }> = {
  265598: { bid: 189.5, ask: 189.55, last: 189.52 },
  272093: { bid: 420.1, ask: 420.2, last: 420.15 },
  756733: { bid: 520.0, ask: 520.05, last: 520.02 },
  76792991: { bid: 248.3, ask: 248.4, last: 248.35 }
};

interface UserMockState {
  selectedProfileId: string;
  sessionState: IBKRSessionState;
  scenarios: Set<MockScenarioFlag>;
  orders: Map<string, Order>;
  events: Map<string, OrderEvent[]>;
  replies: Map<string, { orderId: string; reply: BrokerReplyMessage }>;
  positions: Map<string, Position[]>;
  executions: Execution[];
  previews: Map<string, OrderPreview>;
  liveSubmitCount: number;
  cancelPendingAt: Map<string, number>;
  orderSeq: number;
  eventSeq: number;
  replySeq: number;
  previewSeq: number;
  execSeq: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function id(prefix: string, n: number): string {
  return `${prefix}-${n}-${Date.now()}`;
}

export class MockIBKRTradingAdapter implements IBKRTradingAdapter {
  private users = new Map<string, UserMockState>();

  private state(userId: string): UserMockState {
    let s = this.users.get(userId);
    if (!s) {
      s = {
        selectedProfileId: PAPER_PROFILE_ID,
        sessionState: 'TRADING_READY',
        scenarios: new Set(),
        orders: new Map(),
        events: new Map(),
        replies: new Map(),
        positions: new Map([
          [PAPER_ACCOUNT_ID, []],
          [LIVE_ACCOUNT_ID, []]
        ]),
        executions: [],
        previews: new Map(),
        liveSubmitCount: 0,
        cancelPendingAt: new Map(),
        orderSeq: 0,
        eventSeq: 0,
        replySeq: 0,
        previewSeq: 0,
        execSeq: 0
      };
      this.users.set(userId, s);
    }
    return s;
  }

  /** Test / ops: set or clear scenario flags. */
  setScenario(userId: string, flag: MockScenarioFlag, enabled = true): void {
    const s = this.state(userId);
    if (enabled) s.scenarios.add(flag);
    else s.scenarios.delete(flag);
    this.applyScenarioToSession(s);
  }

  getScenarios(userId: string): MockScenarioFlag[] {
    return [...this.state(userId).scenarios];
  }

  clearScenarios(userId: string): void {
    this.state(userId).scenarios.clear();
    this.applyScenarioToSession(this.state(userId));
  }

  resetUser(userId: string): void {
    this.users.delete(userId);
  }

  private applyScenarioToSession(s: UserMockState): void {
    if (s.scenarios.has('competing_session')) {
      s.sessionState = 'COMPETING_SESSION';
    } else if (s.scenarios.has('read_only')) {
      s.sessionState = 'READ_ONLY';
    } else if (s.sessionState === 'COMPETING_SESSION' || s.sessionState === 'READ_ONLY') {
      s.sessionState = 'TRADING_READY';
    }
  }

  private profileEnv(profileId: string): TradingEnvironment {
    return profileId === LIVE_PROFILE_ID ? 'LIVE' : 'PAPER';
  }

  private currentEnv(s: UserMockState): TradingEnvironment {
    return this.profileEnv(s.selectedProfileId);
  }

  private profiles(): IBKRConnectionProfile[] {
    return [
      {
        id: PAPER_PROFILE_ID,
        label: 'IBKR Paper (DEMO)',
        environment: 'PAPER',
        accountIds: [PAPER_ACCOUNT_ID],
        isDefault: true,
        paperLimitations: PAPER_LIMITATIONS,
        description: 'DEMO IBKR DATA — paper trading profile'
      },
      {
        id: LIVE_PROFILE_ID,
        label: 'IBKR Live (DEMO stub)',
        environment: 'LIVE',
        accountIds: [LIVE_ACCOUNT_ID],
        isDefault: false,
        description: 'DEMO IBKR DATA — separate live connection profile (mock)'
      }
    ];
  }

  private pushEvent(
    s: UserMockState,
    orderId: string,
    type: string,
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const list = s.events.get(orderId) || [];
    list.push({
      id: id('evt', ++s.eventSeq),
      orderId,
      type,
      message,
      at: nowIso(),
      meta
    });
    s.events.set(orderId, list);
  }

  private instrumentOrThrow(conId: number): USStockInstrument {
    const inst = DEMO_INSTRUMENTS.find((i) => i.conId === conId);
    if (!inst) {
      throw Object.assign(new Error(`Unknown conId ${conId}`), { statusCode: 404 });
    }
    return inst;
  }

  private assertAccountForEnv(accountId: string, env: TradingEnvironment): void {
    const expected = env === 'PAPER' ? PAPER_ACCOUNT_ID : LIVE_ACCOUNT_ID;
    if (accountId !== expected) {
      throw Object.assign(
        new Error(
          `Account ${accountId} does not belong to ${env} profile (expected ${expected}). Paper/Live are separate connection profiles.`
        ),
        { statusCode: 400 }
      );
    }
  }

  async getSessionStatus(userId: string): Promise<SessionStatus> {
    const s = this.state(userId);
    this.applyScenarioToSession(s);
    const env = this.currentEnv(s);
    return {
      state: s.sessionState,
      environment: env,
      selectedProfileId: s.selectedProfileId,
      accounts: await this.getAccounts(userId),
      paperLimitations: env === 'PAPER' ? PAPER_LIMITATIONS : undefined,
      competingSession: s.sessionState === 'COMPETING_SESSION',
      readOnly: s.sessionState === 'READ_ONLY',
      message:
        s.sessionState === 'COMPETING_SESSION'
          ? 'Competing brokerage session detected (DEMO)'
          : s.sessionState === 'READ_ONLY'
            ? 'Session is read-only (DEMO)'
            : 'DEMO IBKR DATA',
      isDemo: true,
      mode: 'mock'
    };
  }

  async establishBrokerageSession(userId: string): Promise<SessionStatus> {
    const s = this.state(userId);
    if (s.scenarios.has('competing_session')) {
      s.sessionState = 'COMPETING_SESSION';
    } else if (s.scenarios.has('read_only')) {
      s.sessionState = 'READ_ONLY';
    } else {
      s.sessionState = 'ESTABLISHING_BROKERAGE_SESSION';
      s.sessionState = 'TRADING_READY';
    }
    appendAudit({
      userId,
      action: 'ESTABLISH_BROKERAGE_SESSION',
      environment: this.currentEnv(s),
      details: { state: s.sessionState }
    });
    return this.getSessionStatus(userId);
  }

  async getConnectionProfiles(_userId: string): Promise<IBKRConnectionProfile[]> {
    return this.profiles();
  }

  async selectConnectionProfile(userId: string, profileId: string): Promise<SessionStatus> {
    const profiles = this.profiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile) {
      throw Object.assign(new Error(`Unknown connection profile: ${profileId}`), { statusCode: 404 });
    }
    const s = this.state(userId);
    s.selectedProfileId = profileId;
    // Environment is derived from profile — never from client isPaper
    if (!s.scenarios.has('competing_session') && !s.scenarios.has('read_only')) {
      s.sessionState = 'TRADING_READY';
    }
    appendAudit({
      userId,
      action: 'SELECT_CONNECTION_PROFILE',
      environment: profile.environment,
      details: { profileId, environment: profile.environment }
    });
    return this.getSessionStatus(userId);
  }

  async getAccounts(userId: string): Promise<BrokerAccount[]> {
    const env = this.currentEnv(this.state(userId));
    if (env === 'PAPER') {
      return [
        {
          accountId: PAPER_ACCOUNT_ID,
          accountTitle: 'DEMO Paper Account',
          currency: 'USD',
          environment: 'PAPER',
          type: 'DEMO'
        }
      ];
    }
    return [
      {
        accountId: LIVE_ACCOUNT_ID,
        accountTitle: 'DEMO Live Account',
        currency: 'USD',
        environment: 'LIVE',
        type: 'DEMO'
      }
    ];
  }

  async getAccountSummary(userId: string, accountId: string): Promise<AccountSummary> {
    const env = this.currentEnv(this.state(userId));
    this.assertAccountForEnv(accountId, env);
    const funds = this.state(userId).scenarios.has('insufficient_funds') ? 10 : 100_000;
    return {
      accountId,
      environment: env,
      currency: 'USD',
      netLiquidation: funds,
      availableFunds: funds * 0.95,
      buyingPower: funds * 4,
      excessLiquidity: funds * 0.9,
      cushion: 0.25,
      label: 'DEMO IBKR DATA'
    };
  }

  async searchInstruments(_userId: string, query: string): Promise<USStockInstrument[]> {
    const q = (query || '').trim().toUpperCase();
    if (!q) return [...DEMO_INSTRUMENTS];
    return DEMO_INSTRUMENTS.filter(
      (i) => i.symbol.includes(q) || i.description.toUpperCase().includes(q) || String(i.conId) === q
    );
  }

  async getContractDetails(_userId: string, conId: number): Promise<USStockInstrument> {
    return this.instrumentOrThrow(conId);
  }

  async getOrderCapabilities(userId: string, conId: number): Promise<OrderCapability> {
    const inst = this.instrumentOrThrow(conId);
    const s = this.state(userId);
    const fractional =
      inst.fractionalEligible && !s.scenarios.has('fractional_unsupported');
    return {
      conId,
      supportedOrderTypes: ['MKT', 'LMT', 'STP', 'STP_LMT'],
      supportedTif: ['DAY', 'GTC', 'IOC'],
      allowFractional: fractional,
      allowShort: !s.scenarios.has('short_blocked'),
      minQuantity: fractional ? 0.0001 : 1,
      quantityIncrement: fractional ? 0.0001 : 1,
      outsideRthAllowed: true
    };
  }

  async getQuote(userId: string, conId: number): Promise<MarketQuote> {
    const inst = this.instrumentOrThrow(conId);
    const base = BASE_QUOTES[conId] || { bid: 100, ask: 100.05, last: 100.02 };
    const s = this.state(userId);
    let dataState: MarketQuote['dataState'] = 'DEMO';
    let label = 'DEMO IBKR DATA';
    let asOf = nowIso();

    if (s.scenarios.has('stale_quote')) {
      dataState = 'STALE';
      label = 'DEMO IBKR DATA / STALE';
      asOf = new Date(Date.now() - 15 * 60_000).toISOString();
    } else if (s.scenarios.has('delayed_md')) {
      dataState = 'DELAYED';
      label = 'DEMO IBKR DATA / DELAYED';
      asOf = new Date(Date.now() - 15 * 60_000).toISOString();
    }

    return {
      conId,
      symbol: inst.symbol,
      bid: base.bid,
      ask: base.ask,
      last: base.last,
      bidSize: 100,
      askSize: 100,
      volume: 1_000_000,
      asOf,
      dataState,
      label
    };
  }

  async getPositions(userId: string, accountId: string): Promise<Position[]> {
    const env = this.currentEnv(this.state(userId));
    this.assertAccountForEnv(accountId, env);
    return [...(this.state(userId).positions.get(accountId) || [])];
  }

  async getOpenOrders(userId: string, accountId: string): Promise<Order[]> {
    const env = this.currentEnv(this.state(userId));
    this.assertAccountForEnv(accountId, env);
    const open: OrderPlatformState[] = [
      'SUBMITTING',
      'BROKER_CONFIRMATION_REQUIRED',
      'SUBMITTED',
      'ACKNOWLEDGED',
      'PARTIAL_FILLED',
      'CANCEL_PENDING'
    ];
    return [...this.state(userId).orders.values()].filter(
      (o) => o.accountId === accountId && open.includes(o.status)
    );
  }

  async getRecentTrades(userId: string, accountId: string): Promise<Execution[]> {
    return this.getExecutions(userId, accountId);
  }

  async getExecutions(userId: string, accountId: string): Promise<Execution[]> {
    const env = this.currentEnv(this.state(userId));
    this.assertAccountForEnv(accountId, env);
    return this.state(userId).executions.filter((e) => e.accountId === accountId);
  }

  private async validateIntent(
    userId: string,
    intent: ManualOrderIntent
  ): Promise<{ validated?: ValidatedOrderIntent; checks: RiskCheck[]; warnings: string[] }> {
    const s = this.state(userId);
    const env = this.currentEnv(s);
    const checks: RiskCheck[] = [];
    const warnings: string[] = [];

    this.assertAccountForEnv(intent.accountId, env);
    const instrument = this.instrumentOrThrow(intent.conId);
    const caps = await this.getOrderCapabilities(userId, intent.conId);
    const quote = await this.getQuote(userId, intent.conId);
    const px =
      intent.limitPrice ??
      (intent.side === 'BUY' ? quote.ask ?? quote.last : quote.bid ?? quote.last) ??
      0;
    const estimatedNotional = Math.abs(intent.quantity * px);

    if (!Number.isFinite(intent.quantity) || intent.quantity <= 0) {
      checks.push({
        code: 'QTY_INVALID',
        severity: 'BLOCK',
        message: 'Quantity must be positive',
        passed: false
      });
    }

    if (!Number.isInteger(intent.quantity) && !caps.allowFractional) {
      checks.push({
        code: 'FRACTIONAL_UNSUPPORTED',
        severity: 'BLOCK',
        message: 'Fractional shares not supported for this contract/session',
        passed: false
      });
    } else if (!Number.isInteger(intent.quantity) && instrument.fractionalEligible === false) {
      checks.push({
        code: 'FRACTIONAL_UNSUPPORTED',
        severity: 'BLOCK',
        message: `${instrument.symbol} is not fractional-eligible`,
        passed: false
      });
    }

    if (intent.side === 'SELL' && s.scenarios.has('short_blocked')) {
      const pos = (s.positions.get(intent.accountId) || []).find((p) => p.conId === intent.conId);
      const longQty = pos?.quantity ?? 0;
      if (intent.quantity > longQty) {
        checks.push({
          code: 'SHORT_BLOCKED',
          severity: 'BLOCK',
          message: 'Short selling blocked by scenario / account permissions',
          passed: false
        });
      }
    }

    if (s.scenarios.has('insufficient_funds') && intent.side === 'BUY') {
      checks.push({
        code: 'INSUFFICIENT_FUNDS',
        severity: 'BLOCK',
        message: 'Insufficient funds (DEMO scenario)',
        passed: false
      });
    }

    if (quote.dataState === 'STALE') {
      warnings.push('Quote is STALE — DEMO IBKR DATA');
      checks.push({
        code: 'STALE_QUOTE',
        severity: 'WARN',
        message: 'Market data is stale',
        passed: true
      });
    }
    if (quote.dataState === 'DELAYED') {
      warnings.push('Quote is DELAYED — DEMO IBKR DATA');
    }

    checks.push({
      code: 'DEMO_LABEL',
      severity: 'INFO',
      message: 'DEMO IBKR DATA',
      passed: true
    });

    const blocked = checks.some((c) => c.severity === 'BLOCK' && !c.passed);
    if (blocked) {
      return { checks, warnings };
    }

    const validated: ValidatedOrderIntent = {
      ...intent,
      tif: intent.tif || 'DAY',
      instrument,
      environment: env,
      estimatedNotional
    };
    return { validated, checks, warnings };
  }

  async previewOrder(userId: string, intent: ManualOrderIntent): Promise<OrderPreview> {
    const s = this.state(userId);
    const { validated, checks, warnings } = await this.validateIntent(userId, intent);
    const allowed = !!validated && !checks.some((c) => c.severity === 'BLOCK' && !c.passed);
    const quote = await this.getQuote(userId, intent.conId);
    const preview: OrderPreview = {
      previewId: id('prev', ++s.previewSeq),
      intent: validated || {
        ...intent,
        tif: intent.tif || 'DAY',
        instrument: this.instrumentOrThrow(intent.conId),
        environment: this.currentEnv(s),
        estimatedNotional: 0
      },
      estimatedCommission: 1.0,
      estimatedNotional: validated?.estimatedNotional ?? 0,
      riskChecks: checks,
      allowed,
      warnings,
      quoteSnapshot: quote
    };
    s.previews.set(preview.previewId, preview);
    appendAudit({
      userId,
      action: 'PREVIEW_ORDER',
      environment: this.currentEnv(s),
      accountId: intent.accountId,
      details: { previewId: preview.previewId, allowed, conId: intent.conId }
    });
    return preview;
  }

  private assertCanTrade(s: UserMockState): void {
    if (s.sessionState === 'COMPETING_SESSION') {
      throw Object.assign(
        new Error('Cannot submit: competing brokerage session'),
        { statusCode: 409, reason: 'COMPETING_SESSION' }
      );
    }
    if (s.sessionState === 'READ_ONLY') {
      throw Object.assign(new Error('Cannot submit: session is read-only'), {
        statusCode: 403,
        reason: 'READ_ONLY'
      });
    }
    if (s.sessionState !== 'TRADING_READY') {
      throw Object.assign(
        new Error(`Cannot submit: session state is ${s.sessionState}`),
        { statusCode: 403, reason: s.sessionState }
      );
    }
  }

  async submitOrder(userId: string, intent: ManualOrderIntent): Promise<Order> {
    const s = this.state(userId);
    this.assertCanTrade(s);
    const env = this.currentEnv(s);

    const { validated, checks } = await this.validateIntent(userId, intent);
    if (!validated || checks.some((c) => c.severity === 'BLOCK' && !c.passed)) {
      const reason = checks.find((c) => c.severity === 'BLOCK' && !c.passed)?.message || 'Validation failed';
      throw Object.assign(new Error(reason), { statusCode: 400, details: { checks } });
    }

    if (s.scenarios.has('reject')) {
      const order = this.createOrder(s, validated, 'REJECTED');
      order.rejectReason = 'Order rejected by broker (DEMO scenario)';
      this.pushEvent(s, order.orderId, 'REJECTED', order.rejectReason);
      appendAudit({
        userId,
        action: 'SUBMIT_ORDER_REJECTED',
        environment: env,
        accountId: intent.accountId,
        orderId: order.orderId
      });
      return order;
    }

    const needsReply =
      s.scenarios.has('broker_reply_required') ||
      (env === 'LIVE' && s.liveSubmitCount === 0);

    if (env === 'LIVE') s.liveSubmitCount += 1;

    if (needsReply) {
      const order = this.createOrder(s, validated, 'BROKER_CONFIRMATION_REQUIRED');
      const messageId = id('msg', ++s.replySeq);
      const reply: BrokerReplyMessage = {
        messageId,
        orderId: order.orderId,
        message: [
          'DEMO IBKR DATA — broker confirmation required',
          'Confirm order price / quantity / exchange routing before submit'
        ],
        requiresConfirmation: true,
        createdAt: nowIso()
      };
      order.pendingReply = reply;
      s.replies.set(messageId, { orderId: order.orderId, reply });
      this.pushEvent(s, order.orderId, 'BROKER_REPLY', 'Awaiting confirmBrokerReply', {
        messageId
      });
      appendAudit({
        userId,
        action: 'SUBMIT_ORDER_BROKER_REPLY_REQUIRED',
        environment: env,
        accountId: intent.accountId,
        orderId: order.orderId,
        details: { messageId }
      });
      // Clear one-shot scenario after consuming
      s.scenarios.delete('broker_reply_required');
      return order;
    }

    const order = this.createOrder(s, validated, 'SUBMITTED');
    order.brokerOrderId = `BRK-${order.orderId}`;
    this.pushEvent(s, order.orderId, 'SUBMITTED', 'Order submitted to mock broker');
    order.status = 'ACKNOWLEDGED';
    order.updatedAt = nowIso();
    this.pushEvent(s, order.orderId, 'ACKNOWLEDGED', 'Broker acknowledged (DEMO)');
    s.orders.set(order.orderId, order);

    appendAudit({
      userId,
      action: 'SUBMIT_ORDER',
      environment: env,
      accountId: intent.accountId,
      orderId: order.orderId,
      details: { status: order.status }
    });

    if (env === 'PAPER' && s.scenarios.has('auto_fill_after_ack')) {
      this.simulateFillInternal(s, order, s.scenarios.has('partial_fill'));
    }

    return { ...order };
  }

  private createOrder(
    s: UserMockState,
    validated: ValidatedOrderIntent,
    status: OrderPlatformState
  ): Order {
    const orderId = id('ord', ++s.orderSeq);
    const order: Order = {
      orderId,
      accountId: validated.accountId,
      conId: validated.conId,
      symbol: validated.instrument.symbol,
      side: validated.side,
      orderType: validated.orderType,
      quantity: validated.quantity,
      filledQuantity: 0,
      remainingQuantity: validated.quantity,
      limitPrice: validated.limitPrice,
      stopPrice: validated.stopPrice,
      tif: validated.tif,
      status,
      environment: validated.environment,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    s.orders.set(orderId, order);
    s.events.set(orderId, []);
    this.pushEvent(s, orderId, 'CREATED', `Order created with status ${status}`);
    return order;
  }

  async confirmBrokerReply(userId: string, messageId: string): Promise<Order> {
    const s = this.state(userId);
    const pending = s.replies.get(messageId);
    if (!pending) {
      throw Object.assign(new Error(`Unknown broker reply messageId: ${messageId}`), {
        statusCode: 404
      });
    }
    const order = s.orders.get(pending.orderId);
    if (!order) {
      throw Object.assign(new Error('Order not found for reply'), { statusCode: 404 });
    }
    if (order.status !== 'BROKER_CONFIRMATION_REQUIRED') {
      throw Object.assign(
        new Error(`Order is not awaiting confirmation (status=${order.status})`),
        { statusCode: 409 }
      );
    }

    order.pendingReply = undefined;
    order.status = 'SUBMITTED';
    order.brokerOrderId = `BRK-${order.orderId}`;
    order.updatedAt = nowIso();
    this.pushEvent(s, order.orderId, 'REPLY_CONFIRMED', `User confirmed reply ${messageId}`);
    this.pushEvent(s, order.orderId, 'SUBMITTED', 'Order submitted after broker reply confirm');

    order.status = 'ACKNOWLEDGED';
    order.updatedAt = nowIso();
    this.pushEvent(s, order.orderId, 'ACKNOWLEDGED', 'Broker acknowledged after reply (DEMO)');
    s.replies.delete(messageId);
    s.orders.set(order.orderId, order);

    appendAudit({
      userId,
      action: 'CONFIRM_BROKER_REPLY',
      environment: order.environment,
      accountId: order.accountId,
      orderId: order.orderId,
      details: { messageId }
    });

    // Never FILLED here — only via simulateFill / status poll for paper after ack
    if (order.environment === 'PAPER' && s.scenarios.has('auto_fill_after_ack')) {
      this.simulateFillInternal(s, order, s.scenarios.has('partial_fill'));
    }

    return { ...order };
  }

  async rejectBrokerReply(userId: string, messageId: string): Promise<Order> {
    const s = this.state(userId);
    const pending = s.replies.get(messageId);
    if (!pending) {
      throw Object.assign(new Error(`Unknown broker reply messageId: ${messageId}`), {
        statusCode: 404
      });
    }
    const order = s.orders.get(pending.orderId);
    if (!order) {
      throw Object.assign(new Error('Order not found for reply'), { statusCode: 404 });
    }
    order.pendingReply = undefined;
    order.status = 'CANCELLED';
    order.rejectReason = 'User rejected broker reply';
    order.updatedAt = nowIso();
    this.pushEvent(s, order.orderId, 'REPLY_REJECTED', `User rejected reply ${messageId}`);
    s.replies.delete(messageId);
    s.orders.set(order.orderId, order);
    appendAudit({
      userId,
      action: 'REJECT_BROKER_REPLY',
      environment: order.environment,
      accountId: order.accountId,
      orderId: order.orderId,
      details: { messageId }
    });
    return { ...order };
  }

  async modifyOrder(userId: string, orderId: string, patch: ModifyOrderRequest): Promise<Order> {
    const s = this.state(userId);
    this.assertCanTrade(s);
    const order = s.orders.get(orderId);
    if (!order) {
      throw Object.assign(new Error(`Order not found: ${orderId}`), { statusCode: 404 });
    }
    if (['FILLED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
      throw Object.assign(new Error(`Cannot modify order in status ${order.status}`), {
        statusCode: 409
      });
    }
    if (order.status === 'BROKER_CONFIRMATION_REQUIRED') {
      throw Object.assign(new Error('Confirm or reject broker reply before modify'), {
        statusCode: 409
      });
    }
    if (patch.quantity != null) {
      order.quantity = patch.quantity;
      order.remainingQuantity = Math.max(0, patch.quantity - order.filledQuantity);
    }
    if (patch.limitPrice != null) order.limitPrice = patch.limitPrice;
    if (patch.stopPrice != null) order.stopPrice = patch.stopPrice;
    if (patch.tif != null) order.tif = patch.tif;
    order.updatedAt = nowIso();
    this.pushEvent(s, orderId, 'MODIFIED', 'Order modified (DEMO)', patch as Record<string, unknown>);
    s.orders.set(orderId, order);
    appendAudit({
      userId,
      action: 'MODIFY_ORDER',
      environment: order.environment,
      accountId: order.accountId,
      orderId,
      details: patch as Record<string, unknown>
    });
    return { ...order };
  }

  async cancelOrder(userId: string, orderId: string): Promise<Order> {
    const s = this.state(userId);
    this.assertCanTrade(s);
    const order = s.orders.get(orderId);
    if (!order) {
      throw Object.assign(new Error(`Order not found: ${orderId}`), { statusCode: 404 });
    }
    if (['FILLED', 'CANCELLED', 'REJECTED'].includes(order.status)) {
      throw Object.assign(new Error(`Cannot cancel order in status ${order.status}`), {
        statusCode: 409
      });
    }

    // Never jump to CANCELLED without broker confirmation path
    order.status = 'CANCEL_PENDING';
    order.updatedAt = nowIso();
    s.cancelPendingAt.set(orderId, Date.now());
    this.pushEvent(s, orderId, 'CANCEL_PENDING', 'Cancel requested; awaiting broker confirm');
    s.orders.set(orderId, order);

    appendAudit({
      userId,
      action: 'CANCEL_ORDER_PENDING',
      environment: order.environment,
      accountId: order.accountId,
      orderId
    });

    if (s.scenarios.has('cancel_confirm_immediate')) {
      this.confirmCancelInternal(s, order);
    }

    return { ...order };
  }

  private confirmCancelInternal(s: UserMockState, order: Order): void {
    order.status = 'CANCELLED';
    order.updatedAt = nowIso();
    s.cancelPendingAt.delete(order.orderId);
    this.pushEvent(s, order.orderId, 'CANCELLED', 'Broker confirmed cancel (DEMO)');
    s.orders.set(order.orderId, order);
  }

  /** Explicit broker-confirm cancel (test / ops). */
  confirmCancel(userId: string, orderId: string): Order {
    const s = this.state(userId);
    const order = s.orders.get(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    if (order.status !== 'CANCEL_PENDING') {
      throw new Error(`Order not CANCEL_PENDING (status=${order.status})`);
    }
    this.confirmCancelInternal(s, order);
    appendAudit({
      userId,
      action: 'CANCEL_CONFIRMED',
      environment: order.environment,
      accountId: order.accountId,
      orderId
    });
    return { ...order };
  }

  /**
   * Explicit fill simulation. Never called implicitly on submit/confirm unless
   * auto_fill_after_ack scenario is set (paper only).
   */
  simulateFill(userId: string, orderId: string, partial = false): Order {
    const s = this.state(userId);
    const order = s.orders.get(orderId);
    if (!order) throw new Error(`Order not found: ${orderId}`);
    if (!['ACKNOWLEDGED', 'SUBMITTED', 'PARTIAL_FILLED'].includes(order.status)) {
      throw new Error(`Cannot fill order in status ${order.status}`);
    }
    this.simulateFillInternal(s, order, partial);
    return { ...order };
  }

  private simulateFillInternal(s: UserMockState, order: Order, partial: boolean): void {
    const fillQty = partial ? Math.max(1, Math.floor(order.remainingQuantity / 2)) : order.remainingQuantity;
    const quote = BASE_QUOTES[order.conId] || { bid: 100, ask: 100, last: 100 };
    const price = order.limitPrice ?? quote.last;
    order.filledQuantity += fillQty;
    order.remainingQuantity = Math.max(0, order.quantity - order.filledQuantity);
    order.avgFillPrice = price;
    order.status = order.remainingQuantity > 0 ? 'PARTIAL_FILLED' : 'FILLED';
    order.updatedAt = nowIso();

    const exec: Execution = {
      execId: id('exec', ++s.execSeq),
      orderId: order.orderId,
      accountId: order.accountId,
      conId: order.conId,
      symbol: order.symbol,
      side: order.side,
      quantity: fillQty,
      price,
      commission: 1,
      executedAt: nowIso(),
      environment: order.environment
    };
    s.executions.push(exec);
    this.pushEvent(s, order.orderId, order.status, `Fill ${fillQty} @ ${price} (DEMO)`, {
      execId: exec.execId
    });

    const positions = s.positions.get(order.accountId) || [];
    let pos = positions.find((p) => p.conId === order.conId);
    const signed = order.side === 'BUY' ? fillQty : -fillQty;
    if (!pos) {
      pos = {
        accountId: order.accountId,
        conId: order.conId,
        symbol: order.symbol,
        quantity: signed,
        avgCost: price,
        marketPrice: price,
        marketValue: signed * price,
        unrealizedPnl: 0,
        currency: 'USD',
        environment: order.environment
      };
      positions.push(pos);
    } else {
      const newQty = pos.quantity + signed;
      if (newQty === 0) {
        s.positions.set(
          order.accountId,
          positions.filter((p) => p.conId !== order.conId)
        );
      } else {
        pos.avgCost =
          (pos.avgCost * Math.abs(pos.quantity) + price * fillQty) /
          (Math.abs(pos.quantity) + fillQty);
        pos.quantity = newQty;
        pos.marketPrice = price;
        pos.marketValue = newQty * price;
      }
    }
    if (pos && pos.quantity !== 0) {
      s.positions.set(order.accountId, positions);
    }
    s.orders.set(order.orderId, order);
  }

  async getOrderStatus(userId: string, orderId: string): Promise<Order> {
    const s = this.state(userId);
    const order = s.orders.get(orderId);
    if (!order) {
      throw Object.assign(new Error(`Order not found: ${orderId}`), { statusCode: 404 });
    }

    // Advance CANCEL_PENDING → CANCELLED only with explicit broker-confirm path:
    // scenario cancel_confirm_on_status_poll (optional delay already elapsed), never silently.
    if (order.status === 'CANCEL_PENDING' && s.scenarios.has('cancel_confirm_on_status_poll')) {
      const at = s.cancelPendingAt.get(orderId) || 0;
      if (Date.now() - at >= 0) {
        this.confirmCancelInternal(s, order);
        appendAudit({
          userId,
          action: 'CANCEL_CONFIRMED_VIA_STATUS_POLL',
          environment: order.environment,
          accountId: order.accountId,
          orderId
        });
      }
    }

    // Paper-only: optional fill on status poll after ack when scenario set
    if (
      order.environment === 'PAPER' &&
      s.scenarios.has('auto_fill_after_ack') &&
      (order.status === 'ACKNOWLEDGED' || order.status === 'SUBMITTED')
    ) {
      this.simulateFillInternal(s, order, s.scenarios.has('partial_fill'));
    }

    return { ...s.orders.get(orderId)! };
  }

  async getOrderEvents(userId: string, orderId: string): Promise<OrderEvent[]> {
    const s = this.state(userId);
    if (!s.orders.has(orderId)) {
      throw Object.assign(new Error(`Order not found: ${orderId}`), { statusCode: 404 });
    }
    return [...(s.events.get(orderId) || [])];
  }

  async getAuditEvents(userId: string): Promise<AuditEvent[]> {
    return listAudit(userId);
  }

  async getMarketSession(_userId: string): Promise<MarketSessionInfo> {
    const asOf = nowIso();
    // Rough US RTH check in America/New_York terms via UTC offset approximation
    const d = new Date();
    const etHour = (d.getUTCHours() - 4 + 24) % 24; // EDT approx
    const dow = d.getUTCDay();
    const isWeekday = dow >= 1 && dow <= 5;
    let session: MarketSessionInfo['session'] = 'CLOSED';
    if (isWeekday) {
      if (etHour >= 4 && etHour < 9) session = 'PRE';
      else if (etHour >= 9 && etHour < 16) session = 'RTH';
      else if (etHour >= 16 && etHour < 20) session = 'POST';
    }
    return {
      exchange: 'NASDAQ',
      isOpen: session === 'RTH',
      session,
      asOf,
      nextOpen: undefined,
      nextClose: undefined
    };
  }
}

export const mockIbkrTradingAdapter = new MockIBKRTradingAdapter();
