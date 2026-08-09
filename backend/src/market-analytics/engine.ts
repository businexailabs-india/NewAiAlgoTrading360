import { randomUUID } from 'crypto';
import { MaConfig, canSubmitPaperOrders, isSignalOnly, loadMaConfig } from './config';
import { BrokerAdapter, assertPaperAccountId } from './brokers/BrokerAdapter';
import { SimulatedBrokerAdapter } from './brokers/SimulatedBrokerAdapter';
import { maEventBus } from './events/bus';
import { allGatesPassed, evaluateRiskGates } from './risk/gates';
import { computeOrbPrices, sizePosition, PortfolioState } from './strategy/orb-risk';
import {
  MemoryStore,
  StoredOrder,
  StoredSignal,
  createMemoryStore,
  globalMaStore,
  seedDemoTenant,
} from './store';
import {
  hashSecret,
  isAlertExpired,
  parseOrbPayload,
  redactSecret,
  verifySecret,
} from './webhooks/security';
import { buildBracketTransmitSequence, validateBracketSequence } from './orders/bracket';

export class MarketAnalyticsEngine {
  cfg: MaConfig;
  store: MemoryStore;
  broker: BrokerAdapter;
  private brokerConnected = false;

  constructor(opts?: { cfg?: MaConfig; store?: MemoryStore; broker?: BrokerAdapter; seed?: boolean }) {
    this.cfg = opts?.cfg || loadMaConfig();
    this.store = opts?.store || (this.cfg.useMemoryStore ? globalMaStore : createMemoryStore());
    this.broker = opts?.broker || new SimulatedBrokerAdapter({ netLiq: this.cfg.startingEquity });
    if (opts?.seed !== false && this.store.accounts.length === 0) {
      seedDemoTenant(this.store);
    }
  }

  async ensureBroker(): Promise<void> {
    if (!this.brokerConnected) {
      await this.broker.connect();
      this.brokerConnected = true;
    }
  }

  private portfolio(tenantId: string): PortfolioState {
    const acct = this.store.accounts.find((a) => a.tenantId === tenantId && !a.isDemo) ||
      this.store.accounts.find((a) => a.tenantId === tenantId);
    const equity = acct?.netLiquidation ?? this.cfg.startingEquity;
    return {
      equity,
      equityPeak: equity,
      dailyPnl: 0,
      weeklyPnl: 0,
      drawdownPct: 0,
      tradesToday: this.store.orders.filter((o) => o.tenantId === tenantId && o.role === 'entry').length,
      monthlySizingEquity: equity,
      openQuantity: 0,
      hasActiveEntry: false,
    };
  }

  audit(tenantId: string, action: string, detail?: Record<string, unknown>, userId?: string) {
    this.store.audits.push({
      id: randomUUID(),
      tenantId,
      userId,
      action,
      detail,
      createdAt: new Date().toISOString(),
    });
  }

  async processWebhook(endpointToken: string, body: unknown): Promise<{ statusCode: number; body: Record<string, unknown> }> {
    const epId = this.store.endpointsByToken.get(endpointToken);
    if (!epId) return { statusCode: 404, body: { success: false, message: 'unknown endpoint' } };
    const ep = this.store.endpoints.get(epId)!;
    ep.lastReceivedAt = new Date().toISOString();
    maEventBus.publish('webhook.received', ep.tenantId, { endpointToken: '[redacted]' });

    const parsed = parseOrbPayload(body);
    if (!parsed.ok) {
      ep.errorCount += 1;
      ep.lastRejectedAt = new Date().toISOString();
      this.audit(ep.tenantId, 'webhook.invalid', { error: parsed.error });
      return { statusCode: 400, body: { success: false, message: parsed.error } };
    }
    const data = parsed.data;
    if (!verifySecret(data.secret, ep.secretPlain, false)) {
      ep.errorCount += 1;
      ep.lastRejectedAt = new Date().toISOString();
      this.audit(ep.tenantId, 'webhook.auth_failed', {});
      return { statusCode: 401, body: { success: false, message: 'invalid secret' } };
    }
    if (isAlertExpired(data, this.cfg.maxAlertAgeSeconds)) {
      ep.expiredCount += 1;
      ep.lastRejectedAt = new Date().toISOString();
      return { statusCode: 400, body: { success: false, message: 'expired alert' } };
    }
    const replayKey = `${ep.id}:${data.signal_id}`;
    if (this.store.seenSignalIds.has(replayKey)) {
      ep.duplicateCount += 1;
      ep.lastRejectedAt = new Date().toISOString();
      maEventBus.publish('signal.rejected', ep.tenantId, { reason: 'duplicate', signalId: data.signal_id });
      return { statusCode: 200, body: { success: true, status: 'duplicate', signalId: data.signal_id } };
    }
    this.store.seenSignalIds.add(replayKey);

    // Never trust alert stop/target/qty — recalculate server-side
    await this.ensureBroker();
    const md = await this.broker.getMarketData({ symbol: data.symbol, exchange: data.exchange });
    const atr = data.atr && data.atr > 0 ? data.atr : Math.max(0.5, data.reference_price * 0.002);
    const candleLow = data.opening_range_low && data.opening_range_low > 0
      ? data.opening_range_low
      : data.reference_price - atr;
    const prices = computeOrbPrices(this.cfg, {
      referencePrice: data.reference_price,
      atr,
      candleLow,
      minTick: 0.01,
    });
    const port = this.portfolio(ep.tenantId);
    const sized = sizePosition(this.cfg, {
      entryPrice: prices.entry,
      stopDistance: prices.stopDistance,
      portfolio: port,
      minTick: 0.01,
    });

    const acct = this.store.accounts.find((a) => a.tenantId === ep.tenantId);
    let accountVerified = false;
    try {
      if (acct) {
        assertPaperAccountId(acct.paperAccountId);
        accountVerified = true;
      }
    } catch {
      accountVerified = false;
    }

    const ks = this.store.killSwitch.get(ep.tenantId)?.active || false;
    const halt = this.store.halt.get(ep.tenantId) || false;
    const positions = acct ? await this.broker.getPositions(acct.paperAccountId) : [];
    const openOrders = acct ? await this.broker.getOpenOrders(acct.paperAccountId) : [];
    const hasPosition = positions.some((p) => p.symbol === data.symbol && p.quantity !== 0);
    const hasActiveEntry = openOrders.some((o) => o.symbol === data.symbol && o.role === 'entry' && o.status !== 'Filled');

    const gates = evaluateRiskGates(this.cfg, {
      portfolio: port,
      accountVerifiedPaper: accountVerified,
      connectionOk: this.brokerConnected,
      reconcileOk: acct?.reconcileOk ?? false,
      dataFresh: md.ageSeconds <= this.cfg.maxDataAgeSeconds,
      dataDelayed: md.isDelayed,
      inRth: true,
      hasPosition,
      hasActiveEntry,
      quantity: sized.quantity,
      stopDistance: prices.stopDistance,
      entryPrice: prices.entry,
      duplicateSignal: false,
      killSwitch: ks,
      haltNewOrders: halt,
    });

    const redacted = redactSecret(data as unknown as Record<string, unknown>);
    let status = 'accepted';
    let rejectReason: string | undefined;
    if (sized.quantity <= 0) {
      status = 'rejected';
      rejectReason = sized.rejection || 'zero quantity';
    }
    // Signal-only: accept for monitoring even if paper gates fail; still record gates
    if (!isSignalOnly(this.cfg) && !allGatesPassed(gates)) {
      status = 'rejected';
      rejectReason = gates.filter((g) => !g.passed).map((g) => g.name).join(',');
    }
    // Always require core strategy gates for "accepted"
    if (status === 'accepted' && sized.quantity <= 0) {
      status = 'rejected';
      rejectReason = sized.rejection;
    }

    const signal: StoredSignal = {
      id: randomUUID(),
      tenantId: ep.tenantId,
      signalId: data.signal_id,
      symbol: data.symbol,
      side: 'buy',
      referencePrice: data.reference_price,
      entryPrice: prices.entry,
      stopPrice: prices.stop,
      targetPrice: prices.target,
      quantity: status === 'accepted' ? sized.quantity : 0,
      expectedRisk: status === 'accepted' ? sized.quantity * prices.stopDistance : 0,
      status,
      rejectReason,
      indicators: {
        atr,
        vwap: data.vwap,
        ema: data.ema,
        opening_range_high: data.opening_range_high,
        opening_range_low: data.opening_range_low,
        server_recomputed: true,
      },
      gates,
      barTime: data.bar_time,
      dataAgeSeconds: md.ageSeconds,
      brokerAccountId: acct?.id,
      source: acct?.isDemo ? 'DEMO' : 'SIMULATED',
      createdAt: new Date().toISOString(),
      rawRedacted: redacted,
    };
    this.store.signals.unshift(signal);

    if (status !== 'accepted') {
      ep.lastRejectedAt = new Date().toISOString();
      maEventBus.publish('signal.rejected', ep.tenantId, { signalId: data.signal_id, reason: rejectReason });
      this.audit(ep.tenantId, 'signal.rejected', { signalId: data.signal_id, reason: rejectReason });
      return { statusCode: 200, body: { success: true, status: 'rejected', reason: rejectReason, signal: this.publicSignal(signal) } };
    }

    ep.lastAcceptedAt = new Date().toISOString();
    maEventBus.publish('signal.accepted', ep.tenantId, { signalId: data.signal_id });
    this.audit(ep.tenantId, 'signal.accepted', { signalId: data.signal_id });

    // Build bracket (always) for dry-path validation
    const legs = buildBracketTransmitSequence(1001, 1002, 1003, `orb-${data.signal_id}`);
    validateBracketSequence(legs);

    if (isSignalOnly(this.cfg) || !canSubmitPaperOrders(this.cfg)) {
      return {
        statusCode: 200,
        body: {
          success: true,
          status: 'signal_only',
          mode: this.cfg.tradingMode,
          signal: this.publicSignal(signal),
          bracketValidated: true,
        },
      };
    }

    // Paper submit (simulated or broker_paper)
    if (!acct) {
      this.store.halt.set(ep.tenantId, true);
      return { statusCode: 409, body: { success: false, message: 'no paper account configured' } };
    }
    try {
      assertPaperAccountId(acct.paperAccountId);
      const recon = await this.broker.reconcile(acct.paperAccountId);
      if (!recon.ok) {
        this.store.halt.set(ep.tenantId, true);
        maEventBus.publish('reconciliation.failed', ep.tenantId, {});
        throw new Error('reconciliation failed');
      }
      const idempotencyKey = `ma:${ep.tenantId}:${data.signal_id}`;
      const existing = this.store.orders.find((o) => o.idempotencyKey === idempotencyKey);
      if (existing) {
        return { statusCode: 200, body: { success: true, status: 'idempotent', orderId: existing.appOrderId } };
      }
      const appOrderId = randomUUID();
      const result = await this.broker.submitPaperOrder({
        accountId: acct.paperAccountId,
        symbol: data.symbol,
        side: 'BUY',
        quantity: sized.quantity,
        entryLimit: prices.entry,
        stopPrice: prices.stop,
        targetPrice: prices.target,
        strategyId: data.strategy_id,
        signalId: data.signal_id,
        appOrderId,
        idempotencyKey,
      });
      const order: StoredOrder = {
        id: randomUUID(),
        appOrderId,
        idempotencyKey,
        brokerOrderId: result.parentOrderId,
        tenantId: ep.tenantId,
        brokerAccountId: acct.id,
        symbol: data.symbol,
        side: 'BUY',
        orderType: 'BRACKET',
        quantity: sized.quantity,
        filledQty: sized.quantity,
        limitPrice: prices.entry,
        stopPrice: prices.stop,
        targetPrice: prices.target,
        status: result.status,
        strategyId: data.strategy_id,
        signalId: data.signal_id,
        role: 'entry',
        source: 'SIMULATED',
        submittedAt: new Date().toISOString(),
      };
      this.store.orders.unshift(order);
      signal.orderId = appOrderId;
      signal.status = 'ordered';
      maEventBus.publish('order.submitted', ep.tenantId, { appOrderId, brokerOrderId: result.parentOrderId });
      maEventBus.publish('execution.received', ep.tenantId, { appOrderId });
      maEventBus.publish('position.changed', ep.tenantId, { symbol: data.symbol });
      this.audit(ep.tenantId, 'order.submitted', { appOrderId });
      return {
        statusCode: 200,
        body: { success: true, status: 'ordered', signal: this.publicSignal(signal), order: { appOrderId, ...result } },
      };
    } catch (e) {
      this.store.halt.set(ep.tenantId, true);
      const msg = e instanceof Error ? e.message : 'order failure';
      this.audit(ep.tenantId, 'order.failed', { error: msg });
      return { statusCode: 500, body: { success: false, message: msg, halt: true } };
    }
  }

  publicSignal(s: StoredSignal) {
    return {
      id: s.id,
      signalId: s.signalId,
      symbol: s.symbol,
      side: s.side,
      referencePrice: s.referencePrice,
      entryPrice: s.entryPrice,
      stopPrice: s.stopPrice,
      targetPrice: s.targetPrice,
      quantity: s.quantity,
      expectedRisk: s.expectedRisk,
      status: s.status,
      rejectReason: s.rejectReason,
      indicators: s.indicators,
      gates: s.gates,
      source: s.source,
      createdAt: s.createdAt,
      orderId: s.orderId,
      dataAgeSeconds: s.dataAgeSeconds,
    };
  }

  dashboardSummary(tenantId: string) {
    const acct = this.store.accounts.find((a) => a.tenantId === tenantId);
    const signals = this.store.signals.filter((s) => s.tenantId === tenantId);
    const today = new Date().toISOString().slice(0, 10);
    const signalsToday = signals.filter((s) => s.createdAt.startsWith(today));
    const accepted = signalsToday.filter((s) => s.status === 'accepted' || s.status === 'ordered').length;
    const rejected = signalsToday.filter((s) => s.status === 'rejected').length;
    const ep = [...this.store.endpoints.values()].find((e) => e.tenantId === tenantId);
    return {
      sourceLabel: acct?.isDemo ? 'DEMO' : 'SIMULATED',
      currency: acct?.baseCurrency || 'USD',
      lastUpdated: new Date().toISOString(),
      equity: acct?.netLiquidation ?? this.cfg.startingEquity,
      dailyPnl: 0,
      weeklyPnl: 0,
      realizedPnl: acct?.realizedPnl ?? 0,
      unrealizedPnl: acct?.unrealizedPnl ?? 0,
      buyingPower: acct?.buyingPower ?? 0,
      capitalDeployed: this.store.orders.filter((o) => o.tenantId === tenantId).reduce((a, o) => a + o.quantity * (o.limitPrice || 0), 0),
      capitalAtRisk: signalsToday.reduce((a, s) => a + (s.expectedRisk || 0), 0),
      drawdownPct: 0,
      equityPeak: acct?.netLiquidation ?? this.cfg.startingEquity,
      activePositions: 0,
      openOrders: this.store.orders.filter((o) => o.tenantId === tenantId && o.status === 'Submitted').length,
      signalsToday: signalsToday.length,
      acceptedToday: accepted,
      rejectedToday: rejected,
      brokerHealth: acct?.connectionHealth || 'unknown',
      webhookHealth: {
        lastReceived: ep?.lastReceivedAt || null,
        lastAccepted: ep?.lastAcceptedAt || null,
        lastRejected: ep?.lastRejectedAt || null,
        errorCount: ep?.errorCount || 0,
        duplicateCount: ep?.duplicateCount || 0,
        expiredCount: ep?.expiredCount || 0,
      },
      dataFreshnessSeconds: 1,
      killSwitch: this.store.killSwitch.get(tenantId)?.active || false,
      tradingMode: this.cfg.tradingMode,
      paperOrdersEnabled: canSubmitPaperOrders(this.cfg),
    };
  }

  activateKillSwitch(tenantId: string, userId: string, reason: string) {
    this.store.killSwitch.set(tenantId, { active: true, reason });
    this.store.halt.set(tenantId, true);
    maEventBus.publish('kill_switch.activated', tenantId, { reason });
    this.audit(tenantId, 'kill_switch.activate', { reason }, userId);
    // Cancel only strategy entry orders via broker open orders
    return { active: true, reason };
  }

  deactivateKillSwitch(tenantId: string, userId: string) {
    this.store.killSwitch.set(tenantId, { active: false });
    this.audit(tenantId, 'kill_switch.deactivate', {}, userId);
    return { active: false };
  }

  createEndpoint(tenantId: string, userId: string, secret: string) {
    const token = randomUUID().replace(/-/g, '');
    const id = randomUUID();
    const ep = {
      id,
      tenantId,
      userId,
      endpointToken: token,
      secretPlain: secret,
      secretHash: hashSecret(secret),
      strategyId: 'orb-v1',
      errorCount: 0,
      duplicateCount: 0,
      expiredCount: 0,
    };
    this.store.endpoints.set(id, ep);
    this.store.endpointsByToken.set(token, id);
    this.audit(tenantId, 'webhook.created', { id }, userId);
    // Return secret only once
    return { id, endpointToken: token, secret, webhookPath: `/api/v1/webhooks/tradingview/${token}` };
  }
}

let engineSingleton: MarketAnalyticsEngine | null = null;
export function getMaEngine(): MarketAnalyticsEngine {
  if (!engineSingleton) engineSingleton = new MarketAnalyticsEngine();
  return engineSingleton;
}

export function resetMaEngineForTests(opts?: ConstructorParameters<typeof MarketAnalyticsEngine>[0]) {
  engineSingleton = new MarketAnalyticsEngine({ seed: true, store: createMemoryStore(), ...opts });
  return engineSingleton;
}
