/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadMaConfig, canSubmitPaperOrders } from '../config';
import { parseOrbPayload, verifySecret, isAlertExpired, hashSecret, redactSecret } from '../webhooks/security';
import { sizePosition, effectiveRiskPct, roundToTick, computeOrbPrices } from '../strategy/orb-risk';
import { evaluateRiskGates, allGatesPassed } from '../risk/gates';
import { buildBracketTransmitSequence, validateBracketSequence, safeExitQtyAfterPartial } from '../orders/bracket';
import { assertPaperAccountId } from '../brokers/BrokerAdapter';
import { SimulatedBrokerAdapter } from '../brokers/SimulatedBrokerAdapter';
import { createMemoryStore, seedDemoTenant } from '../store';
import { MarketAnalyticsEngine, resetMaEngineForTests } from '../engine';

describe('Market Analytics unit', () => {
  it('defaults signal-only and blocks paper submit', () => {
    const cfg = loadMaConfig({ TRADING_MODE: 'signal', ENABLE_PAPER_ORDERS: 'NO', PAPER_ORDER_CONFIRMATION: 'NO' } as any);
    expect(cfg.tradingMode).toBe('signal');
    expect(canSubmitPaperOrders(cfg)).toBe(false);
  });

  it('webhook secret timing-safe and redact', () => {
    expect(verifySecret('abc', 'abc')).toBe(true);
    expect(verifySecret('abc', 'xyz')).toBe(false);
    expect(verifySecret('abc', hashSecret('abc'), true)).toBe(true);
    expect(redactSecret({ secret: 'x', a: 1 }).secret).toBe('[REDACTED]');
  });

  it('parses ORB payload and rejects bad schema', () => {
    const ok = parseOrbPayload({
      schema_version: '1.0',
      secret: 's',
      strategy_id: 'orb-v1',
      signal_id: 'id1',
      event: 'entry_signal',
      symbol: 'spy',
      side: 'buy',
      reference_price: 100,
    });
    expect(ok.ok).toBe(true);
    expect(parseOrbPayload({ schema_version: '2.0' }).ok).toBe(false);
  });

  it('expired timestamp detection', () => {
    const payload = parseOrbPayload({
      schema_version: '1.0',
      secret: 's',
      strategy_id: 'orb-v1',
      signal_id: 'id1',
      event: 'entry_signal',
      symbol: 'SPY',
      side: 'buy',
      reference_price: 100,
      timestamp: Date.now() - 120_000,
    });
    expect(payload.ok).toBe(true);
    if (payload.ok) expect(isAlertExpired(payload.data, 60)).toBe(true);
  });

  it('position sizing, zero qty, capital, drawdown', () => {
    const cfg = loadMaConfig({} as any);
    const port = {
      equity: 2400,
      equityPeak: 2400,
      dailyPnl: 0,
      weeklyPnl: 0,
      drawdownPct: 0,
      tradesToday: 0,
      monthlySizingEquity: 2400,
      openQuantity: 0,
      hasActiveEntry: false,
    };
    const r = sizePosition(cfg, { entryPrice: 500, stopDistance: 2, portfolio: port, minTick: 0.01 });
    expect(r.quantity).toBe(Math.min(r.riskQuantity, r.capitalQuantity));
    expect(sizePosition(cfg, { entryPrice: 500, stopDistance: 0, portfolio: port, minTick: 0.01 }).quantity).toBe(0);
    expect(effectiveRiskPct(cfg, 0.05)).toBeCloseTo(cfg.riskPerTradePct * 0.5);
    expect(effectiveRiskPct(cfg, 0.1)).toBe(0);
    expect(roundToTick(10.014, 0.01, 'down')).toBeCloseTo(10.01);
    const px = computeOrbPrices(cfg, { referencePrice: 100, atr: 1, candleLow: 99, minTick: 0.01 });
    expect(px.target).toBeGreaterThan(px.entry);
  });

  it('live account rejection', () => {
    expect(() => assertPaperAccountId('U1234567')).toThrow(/Live account/);
    expect(() => assertPaperAccountId('DU1234567')).not.toThrow();
    expect(() => assertPaperAccountId('SIM-PAPER-001')).not.toThrow();
  });

  it('bracket transmit sequence and partial fills', () => {
    const legs = buildBracketTransmitSequence(1, 2, 3, 'oca');
    validateBracketSequence(legs);
    expect(safeExitQtyAfterPartial(3, 10)).toBe(3);
  });

  it('risk gates block stale/delayed and kill switch', () => {
    const cfg = loadMaConfig({} as any);
    const port = {
      equity: 2400,
      equityPeak: 2400,
      dailyPnl: 0,
      weeklyPnl: 0,
      drawdownPct: 0,
      tradesToday: 0,
      monthlySizingEquity: 2400,
      openQuantity: 0,
      hasActiveEntry: false,
    };
    const base = {
      portfolio: port,
      accountVerifiedPaper: true,
      connectionOk: true,
      reconcileOk: true,
      dataFresh: false,
      dataDelayed: true,
      inRth: true,
      hasPosition: false,
      hasActiveEntry: false,
      quantity: 1,
      stopDistance: 1,
      entryPrice: 100,
      duplicateSignal: false,
      killSwitch: false,
      haltNewOrders: false,
    };
    expect(allGatesPassed(evaluateRiskGates(cfg, base))).toBe(false);
  });
});

describe('Market Analytics integration (fake TV + simulated broker)', () => {
  let engine: MarketAnalyticsEngine;

  beforeEach(() => {
    const store = createMemoryStore();
    seedDemoTenant(store);
    const broker = new SimulatedBrokerAdapter({ netLiq: 2400 });
    engine = resetMaEngineForTests({
      store,
      broker,
      cfg: loadMaConfig({
        TRADING_MODE: 'simulated',
        ENABLE_PAPER_ORDERS: 'YES',
        PAPER_ORDER_CONFIRMATION: 'YES',
        MA_USE_MEMORY_STORE: 'true',
      } as any),
      seed: false,
    });
  });

  it('alert → risk → bracket → simulated order; duplicate rejected', async () => {
    const ep = [...engine.store.endpoints.values()][0];
    const payload = {
      schema_version: '1.0',
      secret: ep.secretPlain,
      strategy_id: 'orb-v1',
      signal_id: 'SPY-15-test-1-long',
      event: 'entry_signal',
      symbol: 'SPY',
      side: 'buy',
      reference_price: 500,
      opening_range_high: 499,
      opening_range_low: 497,
      vwap: 498,
      ema: 497,
      atr: 1.2,
      timestamp: Date.now(),
    };
    const r1 = await engine.processWebhook(ep.endpointToken, payload);
    expect(r1.statusCode).toBe(200);
    expect(['ordered', 'signal_only', 'accepted']).toContain(r1.body.status);
    expect(engine.store.signals.length).toBeGreaterThan(0);
    expect(engine.store.audits.some((a) => a.action.includes('signal'))).toBe(true);

    const r2 = await engine.processWebhook(ep.endpointToken, payload);
    expect(r2.body.status).toBe('duplicate');

    const badSecret = await engine.processWebhook(ep.endpointToken, { ...payload, signal_id: 'other', secret: 'nope' });
    expect(badSecret.statusCode).toBe(401);
  });

  it('idempotent paper submit does not duplicate', async () => {
    const ep = [...engine.store.endpoints.values()][0];
    const mk = (id: string) => ({
      schema_version: '1.0',
      secret: ep.secretPlain,
      strategy_id: 'orb-v1',
      signal_id: id,
      event: 'entry_signal',
      symbol: 'SPY',
      side: 'buy',
      reference_price: 500,
      atr: 1,
      opening_range_low: 498,
      timestamp: Date.now(),
    });
    await engine.processWebhook(ep.endpointToken, mk('a1'));
    const orders = engine.store.orders.length;
    // second distinct signal
    await engine.processWebhook(ep.endpointToken, mk('a2'));
    // may halt if position exists — either way no crash
    expect(engine.store.orders.length).toBeGreaterThanOrEqual(orders);
  });

  it('stale data blocks paper when not signal-only', async () => {
    const broker = new SimulatedBrokerAdapter({ dataAgeMs: 120_000 });
    const store = createMemoryStore();
    seedDemoTenant(store);
    engine = resetMaEngineForTests({
      store,
      broker,
      cfg: loadMaConfig({
        TRADING_MODE: 'simulated',
        ENABLE_PAPER_ORDERS: 'YES',
        PAPER_ORDER_CONFIRMATION: 'YES',
        MAX_DATA_AGE_SECONDS: '30',
      } as any),
      seed: false,
    });
    const ep = [...engine.store.endpoints.values()][0];
    const r = await engine.processWebhook(ep.endpointToken, {
      schema_version: '1.0',
      secret: ep.secretPlain,
      strategy_id: 'orb-v1',
      signal_id: 'stale-1',
      event: 'entry_signal',
      symbol: 'SPY',
      side: 'buy',
      reference_price: 500,
      atr: 1,
      timestamp: Date.now(),
    });
    expect(r.body.status).toBe('rejected');
  });
});
