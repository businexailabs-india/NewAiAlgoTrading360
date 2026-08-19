import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { canTradePaper, resolveRole } from '../auth/rbac';
import { getMaEngine } from '../engine';
import { maEventBus } from '../events/bus';
import { loadMaConfig, canSubmitPaperOrders } from '../config';
import { SimulatedBrokerAdapter } from '../brokers/SimulatedBrokerAdapter';
import { assertPaperAccountId } from '../brokers/BrokerAdapter';
import { randomUUID } from 'crypto';

const router = Router();

function userId(req: Request): string {
  return req.user?.id || 'demo-user';
}

/** Public webhook — authenticated via path token + body secret */
router.post('/webhooks/tradingview/:endpointToken', async (req: Request, res: Response) => {
  const engine = getMaEngine();
  const result = await engine.processWebhook(req.params.endpointToken, req.body);
  res.status(result.statusCode).json(result.body);
});

router.post('/webhooks/tradingview/test', authenticate, async (req: Request, res: Response) => {
  const engine = getMaEngine();
  const { tenantId, role } = resolveRole(engine.store, userId(req));
  if (!canTradePaper(role) && role !== 'viewer') {
    /* viewers can send test? no — traders+ */
  }
  if (role === 'viewer') {
    res.status(403).json({ success: false, message: 'viewers are read-only' });
    return;
  }
  const ep = [...engine.store.endpoints.values()].find((e) => e.tenantId === tenantId);
  if (!ep) {
    res.status(400).json({ success: false, message: 'no webhook endpoint; create one first' });
    return;
  }
  const payload = {
    schema_version: '1.0',
    secret: ep.secretPlain,
    strategy_id: 'orb-v1',
    signal_id: `TEST-${Date.now()}`,
    event: 'entry_signal',
    symbol: 'SPY',
    exchange: 'AMEX',
    timeframe: '15',
    bar_time: new Date().toISOString(),
    side: 'buy',
    reference_price: 500,
    opening_range_high: 499,
    opening_range_low: 497,
    vwap: 498,
    ema: 497.5,
    atr: 1.2,
    timestamp: Date.now(),
  };
  const result = await engine.processWebhook(ep.endpointToken, payload);
  res.status(result.statusCode).json(result.body);
});

router.get('/dashboard/summary', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  res.json({ success: true, data: engine.dashboardSummary(tenantId) });
});

router.get('/accounts', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const accounts = engine.store.accounts
    .filter((a) => a.tenantId === tenantId)
    .map((safe) => ({
      id: safe.id,
      connectionName: safe.connectionName,
      brokerType: safe.brokerType,
      paperAccountId: safe.paperAccountId,
      baseCurrency: safe.baseCurrency,
      status: safe.status,
      netLiquidation: safe.netLiquidation,
      cashBalance: safe.cashBalance,
      buyingPower: safe.buyingPower,
      realizedPnl: safe.realizedPnl,
      unrealizedPnl: safe.unrealizedPnl,
      reconcileOk: safe.reconcileOk,
      lastSyncAt: safe.lastSyncAt,
      isDemo: safe.isDemo,
      connectionHealth: safe.connectionHealth,
      dataEntitlement: safe.dataEntitlement,
      sourceLabel: safe.isDemo ? 'DEMO' : safe.brokerType,
    }));
  res.json({ success: true, data: accounts });
});

router.post('/accounts/connect', authenticate, async (req, res) => {
  const engine = getMaEngine();
  const { tenantId, role } = resolveRole(engine.store, userId(req));
  if (!canTradePaper(role)) {
    res.status(403).json({ success: false, message: 'trader or owner required' });
    return;
  }
  const { connectionName, brokerType, paperAccountId, baseCurrency } = req.body || {};
  try {
    assertPaperAccountId(String(paperAccountId || ''));
  } catch (e) {
    res.status(400).json({ success: false, message: e instanceof Error ? e.message : 'invalid account' });
    return;
  }
  // Never auto-pick first account — client must send exact ID
  const type = String(brokerType || 'SIMULATED').toUpperCase();
  if (type === 'IBKR_PAPER' || type === 'IBKR') {
    res.status(400).json({
      success: false,
      message: 'US/IBKR paper adapters removed — use SIMULATED (India paper only)'
    });
    return;
  }
  const acct = {
    id: randomUUID(),
    tenantId,
    userId: userId(req),
    connectionName: String(connectionName || 'Paper'),
    brokerType: type,
    paperAccountId: String(paperAccountId),
    baseCurrency: String(baseCurrency || 'INR'),
    status: 'connected',
    netLiquidation: engine.cfg.startingEquity,
    cashBalance: engine.cfg.startingEquity,
    buyingPower: engine.cfg.startingEquity * 0.9,
    realizedPnl: 0,
    unrealizedPnl: 0,
    reconcileOk: false,
    lastSyncAt: new Date().toISOString(),
    isDemo: false,
    connectionHealth: 'healthy',
    dataEntitlement: 'simulated',
  };
  engine.store.accounts.push(acct);
  engine.audit(tenantId, 'account.connect', { id: acct.id, paperAccountId: acct.paperAccountId }, userId(req));
  res.status(201).json({ success: true, data: { id: acct.id, paperAccountId: acct.paperAccountId, brokerType: acct.brokerType } });
});

router.post('/accounts/:id/reconcile', authenticate, async (req, res) => {
  const engine = getMaEngine();
  const { tenantId, role } = resolveRole(engine.store, userId(req));
  if (!canTradePaper(role)) {
    res.status(403).json({ success: false, message: 'forbidden' });
    return;
  }
  const acct = engine.store.accounts.find((a) => a.id === req.params.id && a.tenantId === tenantId);
  if (!acct) {
    res.status(404).json({ success: false, message: 'account not found' });
    return;
  }
  await engine.ensureBroker();
  const result = await engine.broker.reconcile(acct.paperAccountId);
  acct.reconcileOk = result.ok;
  acct.lastSyncAt = new Date().toISOString();
  engine.audit(tenantId, 'account.reconcile', { id: acct.id, ok: result.ok }, userId(req));
  res.json({ success: true, data: result });
});

router.get('/accounts/:id/positions', authenticate, async (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const acct = engine.store.accounts.find((a) => a.id === req.params.id && a.tenantId === tenantId);
  if (!acct) {
    res.status(404).json({ success: false, message: 'not found' });
    return;
  }
  await engine.ensureBroker();
  const positions = await engine.broker.getPositions(acct.paperAccountId);
  res.json({ success: true, data: positions, sourceLabel: acct.isDemo ? 'DEMO' : acct.brokerType });
});

router.get('/accounts/:id/orders', authenticate, async (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const acct = engine.store.accounts.find((a) => a.id === req.params.id && a.tenantId === tenantId);
  if (!acct) {
    res.status(404).json({ success: false, message: 'not found' });
    return;
  }
  const orders = engine.store.orders.filter((o) => o.brokerAccountId === acct.id);
  res.json({ success: true, data: orders });
});

router.get('/strategies', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const list = [...engine.store.strategies.values()].filter((s) => s.tenantId === tenantId);
  res.json({ success: true, data: list });
});

router.get('/strategies/:id', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const s = engine.store.strategies.get(req.params.id);
  if (!s || s.tenantId !== tenantId) {
    res.status(404).json({ success: false, message: 'not found' });
    return;
  }
  const signals = engine.store.signals.filter((x) => x.tenantId === tenantId);
  res.json({
    success: true,
    data: {
      ...s,
      signalsToday: signals.filter((x) => x.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length,
      acceptanceRate: signals.length
        ? signals.filter((x) => x.status !== 'rejected').length / signals.length
        : null,
      pineDownloadPath: '/tradingview/pine/orb_regime_long_strategy.pine',
    },
  });
});

router.patch('/strategies/:id', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId, role } = resolveRole(engine.store, userId(req));
  if (!canTradePaper(role)) {
    res.status(403).json({ success: false, message: 'forbidden' });
    return;
  }
  const s = engine.store.strategies.get(req.params.id);
  if (!s || s.tenantId !== tenantId) {
    res.status(404).json({ success: false, message: 'not found' });
    return;
  }
  if (typeof req.body?.enabled === 'boolean') s.enabled = req.body.enabled;
  if (req.body?.parameters && typeof req.body.parameters === 'object') {
    s.parameters = { ...s.parameters, ...req.body.parameters };
  }
  engine.audit(tenantId, 'strategy.patch', { id: s.id }, userId(req));
  res.json({ success: true, data: s });
});

router.get('/signals', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  let rows = engine.store.signals.filter((s) => s.tenantId === tenantId);
  if (req.query.status) rows = rows.filter((s) => s.status === String(req.query.status));
  if (req.query.symbol) rows = rows.filter((s) => s.symbol === String(req.query.symbol).toUpperCase());
  const page = Number(req.query.page || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize || 50));
  const slice = rows.slice((page - 1) * pageSize, page * pageSize).map((s) => engine.publicSignal(s));
  res.json({ success: true, data: slice, pagination: { page, pageSize, total: rows.length } });
});

router.get('/signals/:id', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const s = engine.store.signals.find((x) => x.id === req.params.id && x.tenantId === tenantId);
  if (!s) {
    res.status(404).json({ success: false, message: 'not found' });
    return;
  }
  res.json({
    success: true,
    data: {
      ...engine.publicSignal(s),
      rawPayloadRedacted: s.rawRedacted,
      riskGates: s.gates,
    },
  });
});

router.get('/performance', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  res.json({
    success: true,
    data: {
      sourceLabel: 'SIMULATED',
      note: 'TradingView backtests, internal simulation, and broker-paper results are never mixed without labels.',
      winRate: null,
      profitFactor: null,
      expectancy: null,
      maxDrawdown: 0,
      grossPnl: 0,
      netPnl: 0,
      trades: engine.store.orders.filter((o) => o.tenantId === tenantId).length,
      sharpeNote: 'Sharpe requires sufficient return series; null until populated.',
      hypotheticalCompoundingLabel: 'Mathematical scenario only — not a forecast.',
    },
  });
});

router.get('/risk/status', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const summary = engine.dashboardSummary(tenantId);
  res.json({
    success: true,
    data: {
      killSwitch: summary.killSwitch,
      tradingMode: summary.tradingMode,
      paperOrdersEnabled: summary.paperOrdersEnabled,
      liveTradingOption: false,
      gates: [
        'paper_account',
        'connection',
        'reconciliation',
        'market_data_fresh',
        'rth',
        'daily_loss',
        'weekly_loss',
        'drawdown',
        'kill_switch',
      ],
      cfg: {
        riskPerTradePct: engine.cfg.riskPerTradePct,
        maxTradesPerDay: engine.cfg.maxTradesPerDay,
        drawdownPausePct: engine.cfg.drawdownPausePct,
      },
    },
  });
});

router.post('/kill-switch/activate', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId, role } = resolveRole(engine.store, userId(req));
  if (!canTradePaper(role)) {
    res.status(403).json({ success: false, message: 'forbidden' });
    return;
  }
  const out = engine.activateKillSwitch(tenantId, userId(req), String(req.body?.reason || 'manual'));
  res.json({ success: true, data: out });
});

router.post('/kill-switch/deactivate', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId, role } = resolveRole(engine.store, userId(req));
  if (!canTradePaper(role)) {
    res.status(403).json({ success: false, message: 'forbidden' });
    return;
  }
  res.json({ success: true, data: engine.deactivateKillSwitch(tenantId, userId(req)) });
});

router.get('/audit', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const rows = engine.store.audits.filter((a) => a.tenantId === tenantId).slice(0, 200);
  res.json({ success: true, data: rows });
});

router.post('/webhooks/endpoints', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId, role } = resolveRole(engine.store, userId(req));
  if (!canTradePaper(role)) {
    res.status(403).json({ success: false, message: 'forbidden' });
    return;
  }
  const secret = String(req.body?.secret || randomUUID());
  const created = engine.createEndpoint(tenantId, userId(req), secret);
  res.status(201).json({ success: true, data: created, note: 'Secret shown once — store securely' });
});

router.get('/webhooks/health', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const ep = [...engine.store.endpoints.values()].find((e) => e.tenantId === tenantId);
  res.json({
    success: true,
    data: ep
      ? {
          hasEndpoint: true,
          endpointTokenSuffix: ep.endpointToken.slice(-6),
          lastReceivedAt: ep.lastReceivedAt,
          lastAcceptedAt: ep.lastAcceptedAt,
          lastRejectedAt: ep.lastRejectedAt,
          errorCount: ep.errorCount,
          duplicateCount: ep.duplicateCount,
          expiredCount: ep.expiredCount,
          secret: undefined,
        }
      : { hasEndpoint: false },
  });
});

router.get('/exports/:kind.csv', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  const kind = req.params.kind;
  let csv = 'type,id,detail\n';
  if (kind === 'signals') {
    csv = 'signalId,symbol,status,qty,entry,stop,target,source,createdAt\n';
    for (const s of engine.store.signals.filter((x) => x.tenantId === tenantId)) {
      csv += `${s.signalId},${s.symbol},${s.status},${s.quantity},${s.entryPrice},${s.stopPrice},${s.targetPrice},${s.source},${s.createdAt}\n`;
    }
  } else if (kind === 'orders') {
    csv = 'appOrderId,symbol,status,qty,source,submittedAt\n';
    for (const o of engine.store.orders.filter((x) => x.tenantId === tenantId)) {
      csv += `${o.appOrderId},${o.symbol},${o.status},${o.quantity},${o.source},${o.submittedAt}\n`;
    }
  } else if (kind === 'audit') {
    csv = 'action,createdAt\n';
    for (const a of engine.store.audits.filter((x) => x.tenantId === tenantId)) {
      csv += `${a.action},${a.createdAt}\n`;
    }
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ma-${kind}.csv"`);
  res.send(csv);
});

router.get('/events/stream', authenticate, (req, res) => {
  const engine = getMaEngine();
  const { tenantId } = resolveRole(engine.store, userId(req));
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  let lastSeq = Number(req.query.since || 0);
  const send = (evt: { seq: number; type: string; at: string; payload: Record<string, unknown> }) => {
    res.write(`id: ${evt.seq}\n`);
    res.write(`event: ${evt.type}\n`);
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  };
  for (const e of maEventBus.since(lastSeq, tenantId)) send(e);
  const onEvt = (evt: { seq: number; tenantId: string; type: string; at: string; payload: Record<string, unknown> }) => {
    if (evt.tenantId !== tenantId) return;
    lastSeq = evt.seq;
    send(evt);
  };
  maEventBus.on('event', onEvt);
  req.on('close', () => maEventBus.off('event', onEvt));
});

router.get('/meta/safety', (_req, res) => {
  const cfg = loadMaConfig();
  res.json({
    success: true,
    data: {
      paperTradingOnly: true,
      liveTradingAvailable: false,
      tradingMode: cfg.tradingMode,
      enablePaperOrders: cfg.enablePaperOrders,
      paperOrderConfirmation: cfg.paperOrderConfirmation,
      canSubmitPaperOrders: canSubmitPaperOrders(cfg),
      adapters: ['SIMULATED'],
    },
  });
});

router.get('/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'BxAi Trade Market Analytics API',
      version: '1.0.0',
      description: 'Paper-trading-only. Live trading is not available.',
    },
    paths: {
      '/api/v1/webhooks/tradingview/{endpointToken}': { post: { summary: 'TradingView webhook' } },
      '/api/v1/dashboard/summary': { get: { summary: 'Dashboard summary' } },
      '/api/v1/signals': { get: { summary: 'List signals' } },
      '/api/v1/kill-switch/activate': { post: { summary: 'Activate kill switch' } },
    },
  });
});

export default router;

void SimulatedBrokerAdapter;
