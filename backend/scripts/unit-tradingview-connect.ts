/**
 * Unit + integration tests for TradingView Connect
 * npm run test:tradingview
 */
import {
  buildIdempotencyKey,
  normalizeTradingViewPayload
} from '../src/libs/tradingview/webhook-parser';
import { defaultPaperRiskRules, buildPayloadTemplate } from '../src/libs/tradingview/payload-builder';
import {
  generateWebhookSecret,
  hashSecret,
  isFreshTimestamp,
  mapSymbol,
  validateSecret
} from '../src/libs/alerts/security';
import { TradingViewConnectService } from '../src/services/tradingview/tradingview-connect.service';
import { prisma } from '../src/config/database';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function main() {
  // --- Unit: parsers ---
  const standard = normalizeTradingViewPayload({
    secret: 'x',
    strategy_id: 'strat_123',
    symbol: 'RELIANCE',
    exchange: 'NSE',
    timeframe: '5',
    side: 'BUY',
    signal_type: 'VWAP_BREAKOUT',
    price: 1400,
    quantity: 1,
    timestamp: new Date().toISOString()
  });
  assert(standard.side === 'BUY' && standard.symbol === 'RELIANCE', 'standard parser');

  const simple = normalizeTradingViewPayload({ secret: 'x', symbol: 'TCS', side: 'SELL' });
  assert(simple.side === 'SELL' && simple.symbol === 'TCS', 'simple parser');

  const natural = normalizeTradingViewPayload({
    secret: 'x',
    message: 'BUY RELIANCE VWAP breakout 5m'
  });
  assert(natural.side === 'BUY' && natural.symbol === 'RELIANCE', 'natural parser');
  assert(mapSymbol('INFOSYS') === 'INFY', 'symbol map');

  const secret = generateWebhookSecret();
  const hash = hashSecret(secret);
  assert(validateSecret(secret, hash), 'secret valid');
  assert(!validateSecret('wrong', hash), 'secret invalid');

  const fresh = new Date();
  assert(isFreshTimestamp(fresh), 'fresh ok');
  assert(!isFreshTimestamp(new Date(Date.now() - 10 * 60 * 1000)), 'stale rejected');

  const key = buildIdempotencyKey('conn1', standard, {});
  const key2 = buildIdempotencyKey('conn1', standard, {});
  assert(key === key2, 'idempotency stable in same minute');

  const rules = defaultPaperRiskRules(100000);
  assert(rules.paper_only === true && rules.max_daily_loss === 1000, 'default risk rules');
  assert(buildPayloadTemplate('BUY').side === 'BUY', 'payload builder');
  console.log('OK unit parsers/security');

  // --- Integration ---
  const email = `tv_${Date.now()}@test.local`;
  const user = await prisma.user.create({
    data: { email, passwordHash: 'x', name: 'TV Test', role: 'user' }
  });
  const userId = user.id;

  const created = await TradingViewConnectService.createConnection(userId, { name: 'TV Test Conn' });
  assert(created.webhookUrl.includes(created.connection.id), 'webhook url');
  assert(!!created.secret, 'secret once');
  console.log('OK connection');

  const ingested = await TradingViewConnectService.ingestWebhook(created.connection.id, {
    secret: created.secret,
    symbol: 'RELIANCE',
    side: 'BUY',
    signal_type: 'VWAP_BREAKOUT',
    price: 1400,
    quantity: 1,
    timestamp: new Date().toISOString()
  });
  assert(ingested.signal.status === 'VALIDATED' || ingested.validation.passed, 'normalized+validated');
  console.log('OK webhook ingest');

  let dupBlocked = false;
  try {
    await TradingViewConnectService.ingestWebhook(created.connection.id, {
      secret: created.secret,
      symbol: 'RELIANCE',
      side: 'BUY',
      signal_type: 'VWAP_BREAKOUT',
      price: 1400,
      quantity: 1,
      timestamp: new Date().toISOString()
    });
  } catch {
    dupBlocked = true;
  }
  assert(dupBlocked, 'duplicate blocked');
  console.log('OK duplicate');

  let staleBlocked = false;
  try {
    await TradingViewConnectService.ingestWebhook(created.connection.id, {
      secret: created.secret,
      symbol: 'TCS',
      side: 'BUY',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
    });
  } catch {
    staleBlocked = true;
  }
  assert(staleBlocked, 'stale blocked');
  console.log('OK stale');

  const paper = await TradingViewConnectService.paperTest(userId, ingested.signal.id);
  assert(paper.status === 'PASSED', 'paper test passed');
  assert(paper.resultJson && (paper.resultJson as { live?: boolean }).live !== true, 'no live');
  console.log('OK paper test', paper.orderId);

  const conv = await TradingViewConnectService.convertToStrategy(userId, ingested.signal.id);
  assert(!!conv.strategy.id, 'strategy created');
  console.log('OK convert');

  const live = await TradingViewConnectService.requestLiveApproval(userId, ingested.signal.id);
  assert(live.blocked === true && live.approved === false, 'live blocked');
  console.log('OK live blocked');

  const explain = TradingViewConnectService.explainSignal(ingested.signal, 'hinglish');
  assert(/RELIANCE/i.test(explain) && /paper/i.test(explain), 'dhanlaxmi explain');
  console.log('OK explain');

  const audits = await prisma.alertAuditLog.count({ where: { userId } });
  assert(audits >= 3, 'audit logs');
  console.log('OK audits', audits);

  await prisma.user.delete({ where: { id: userId } });
  console.log('\nunit-tradingview-connect: PASS');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
