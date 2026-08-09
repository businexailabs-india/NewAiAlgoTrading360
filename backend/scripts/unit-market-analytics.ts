/**
 * Market Analytics unit + integration tests (no live broker).
 * npm run test:market-analytics
 */
import { loadMaConfig, canSubmitPaperOrders } from '../src/market-analytics/config';
import {
  parseOrbPayload,
  verifySecret,
  isAlertExpired,
  hashSecret,
  redactSecret,
} from '../src/market-analytics/webhooks/security';
import {
  sizePosition,
  effectiveRiskPct,
  roundToTick,
  computeOrbPrices,
} from '../src/market-analytics/strategy/orb-risk';
import { evaluateRiskGates, allGatesPassed } from '../src/market-analytics/risk/gates';
import {
  buildBracketTransmitSequence,
  validateBracketSequence,
  safeExitQtyAfterPartial,
} from '../src/market-analytics/orders/bracket';
import { assertPaperAccountId } from '../src/market-analytics/brokers/BrokerAdapter';
import { SimulatedBrokerAdapter } from '../src/market-analytics/brokers/SimulatedBrokerAdapter';
import { createMemoryStore, seedDemoTenant } from '../src/market-analytics/store';
import { MarketAnalyticsEngine } from '../src/market-analytics/engine';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main() {
  const cfg = loadMaConfig({
    TRADING_MODE: 'signal',
    ENABLE_PAPER_ORDERS: 'NO',
    PAPER_ORDER_CONFIRMATION: 'NO',
  } as NodeJS.ProcessEnv);
  assert(cfg.tradingMode === 'signal', 'default signal');
  assert(!canSubmitPaperOrders(cfg), 'paper blocked');

  assert(verifySecret('abc', 'abc'), 'secret ok');
  assert(!verifySecret('abc', 'xyz'), 'secret bad');
  assert(verifySecret('abc', hashSecret('abc'), true), 'hash ok');
  assert(redactSecret({ secret: 'x' } as any).secret === '[REDACTED]', 'redact');

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
  assert(ok.ok, 'parse ok');
  assert(!parseOrbPayload({ schema_version: '2.0' }).ok, 'bad schema');

  const expired = parseOrbPayload({
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
  assert(expired.ok && isAlertExpired(expired.data, 60), 'expired');

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
  const sized = sizePosition(cfg, { entryPrice: 500, stopDistance: 2, portfolio: port, minTick: 0.01 });
  assert(sized.quantity === Math.min(sized.riskQuantity, sized.capitalQuantity), 'size min');
  assert(sizePosition(cfg, { entryPrice: 500, stopDistance: 0, portfolio: port, minTick: 0.01 }).quantity === 0, 'zero qty');
  assert(Math.abs(effectiveRiskPct(cfg, 0.05) - cfg.riskPerTradePct * 0.5) < 1e-9, 'dd reduce');
  assert(effectiveRiskPct(cfg, 0.1) === 0, 'dd pause');
  assert(Math.abs(roundToTick(10.014, 0.01, 'down') - 10.01) < 1e-9, 'tick');
  const px = computeOrbPrices(cfg, { referencePrice: 100, atr: 1, candleLow: 99, minTick: 0.01 });
  assert(px.target > px.entry, 'target');

  let liveRejected = false;
  try {
    assertPaperAccountId('U1234567');
  } catch {
    liveRejected = true;
  }
  assert(liveRejected, 'live reject');
  assertPaperAccountId('DU1234567');
  assertPaperAccountId('SIM-PAPER-001');

  const legs = buildBracketTransmitSequence(1, 2, 3, 'oca');
  validateBracketSequence(legs);
  assert(safeExitQtyAfterPartial(3, 10) === 3, 'partial');

  const gates = evaluateRiskGates(cfg, {
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
  });
  assert(!allGatesPassed(gates), 'stale gates fail');

  // Integration
  const store = createMemoryStore();
  seedDemoTenant(store);
  const broker = new SimulatedBrokerAdapter({ netLiq: 2400 });
  const engine = new MarketAnalyticsEngine({
    store,
    broker,
    seed: false,
    cfg: loadMaConfig({
      TRADING_MODE: 'simulated',
      ENABLE_PAPER_ORDERS: 'YES',
      PAPER_ORDER_CONFIRMATION: 'YES',
      MA_USE_MEMORY_STORE: 'true',
    } as NodeJS.ProcessEnv),
  });
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
  assert(r1.statusCode === 200, 'webhook 200');
  assert(['ordered', 'signal_only', 'accepted'].includes(String(r1.body.status)), `status ${r1.body.status}`);
  assert(engine.store.signals.length > 0, 'signal stored');
  const r2 = await engine.processWebhook(ep.endpointToken, payload);
  assert(r2.body.status === 'duplicate', 'duplicate');
  const bad = await engine.processWebhook(ep.endpointToken, { ...payload, signal_id: 'x2', secret: 'nope' });
  assert(bad.statusCode === 401, 'auth fail');

  // restart idempotency via seen set
  const store2 = createMemoryStore();
  seedDemoTenant(store2);
  store2.seenSignalIds.add(`${ep.id}:SPY-15-test-1-long`);
  // use same token mapping
  const ep2 = [...store2.endpoints.values()][0];
  store2.seenSignalIds.add(`${ep2.id}:restart-key`);
  const eng2 = new MarketAnalyticsEngine({
    store: store2,
    broker: new SimulatedBrokerAdapter(),
    seed: false,
    cfg: engine.cfg,
  });
  const rd = await eng2.processWebhook(ep2.endpointToken, { ...payload, signal_id: 'restart-key', secret: ep2.secretPlain });
  assert(rd.body.status === 'duplicate', 'restart duplicate');

  const staleBroker = new SimulatedBrokerAdapter({ dataAgeMs: 120_000 });
  const staleStore = createMemoryStore();
  seedDemoTenant(staleStore);
  const staleEng = new MarketAnalyticsEngine({
    store: staleStore,
    broker: staleBroker,
    seed: false,
    cfg: loadMaConfig({
      TRADING_MODE: 'simulated',
      ENABLE_PAPER_ORDERS: 'YES',
      PAPER_ORDER_CONFIRMATION: 'YES',
      MAX_DATA_AGE_SECONDS: '30',
    } as NodeJS.ProcessEnv),
  });
  const eps = [...staleEng.store.endpoints.values()][0];
  const rs = await staleEng.processWebhook(eps.endpointToken, {
    ...payload,
    secret: eps.secretPlain,
    signal_id: 'stale-1',
  });
  assert(rs.body.status === 'rejected', 'stale rejected');

  console.log('PASS: market-analytics unit + integration');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
