import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { OrderExecutionService } from '../order-execution.service';
import { RiskGateService } from '../risk-gate.service';
import { RiskJourneyService } from '../risk-journey/risk-journey.service';
import {
  buildIdempotencyKey,
  normalizeTradingViewPayload
} from '../../libs/tradingview/webhook-parser';
import {
  buildPayloadTemplate,
  defaultPaperRiskRules,
  systemPayloadTemplates,
  type PayloadKind
} from '../../libs/tradingview/payload-builder';
import {
  generateWebhookSecret,
  hashSecret,
  isFreshTimestamp,
  mapSymbol,
  secretHint,
  validateSecret
} from '../../libs/alerts/security';

function publicBaseUrl() {
  return (process.env.PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || 'http://localhost:3001/api').replace(
    /\/$/,
    ''
  );
}

async function audit(userId: string, action: string, detail: string, signalId?: string, meta?: object) {
  await prisma.alertAuditLog.create({
    data: { userId, action, detail, signalId, meta: meta || undefined }
  });
}

export class TradingViewConnectService {
  static async createConnection(userId: string, body?: { name?: string; defaultMode?: string }) {
    const secret = generateWebhookSecret();
    const conn = await prisma.tradingViewConnection.create({
      data: {
        userId,
        name: body?.name || 'TradingView Connect',
        secretHash: hashSecret(secret),
        secretHint: secretHint(secret),
        defaultMode: body?.defaultMode === 'live_request' ? 'live_request' : 'paper'
      }
    });
    await audit(userId, 'TV_CONNECTION_CREATED', `connection=${conn.id}`);
    return {
      connection: conn,
      secret, // shown once
      webhookUrl: `${publicBaseUrl()}/tradingview/webhook/${conn.id}`,
      samplePayload: buildPayloadTemplate('BUY', secret)
    };
  }

  static async listConnections(userId: string) {
    const rows = await prisma.tradingViewConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((c) => ({
      ...c,
      webhookUrl: `${publicBaseUrl()}/tradingview/webhook/${c.id}`,
      secretHash: undefined
    }));
  }

  static async getConnection(userId: string, id: string) {
    const c = await prisma.tradingViewConnection.findFirst({ where: { id, userId } });
    if (!c) throw new AppError('Connection not found', 404);
    return {
      ...c,
      secretHash: undefined,
      webhookUrl: `${publicBaseUrl()}/tradingview/webhook/${c.id}`
    };
  }

  static async deleteConnection(userId: string, id: string) {
    const c = await prisma.tradingViewConnection.findFirst({ where: { id, userId } });
    if (!c) throw new AppError('Connection not found', 404);
    await prisma.tradingViewConnection.delete({ where: { id } });
    await audit(userId, 'TV_CONNECTION_DELETED', `connection=${id}`);
    return { ok: true };
  }

  static async rotateSecret(userId: string, id: string) {
    const c = await prisma.tradingViewConnection.findFirst({ where: { id, userId } });
    if (!c) throw new AppError('Connection not found', 404);
    const secret = generateWebhookSecret();
    const updated = await prisma.tradingViewConnection.update({
      where: { id },
      data: { secretHash: hashSecret(secret), secretHint: secretHint(secret) }
    });
    await audit(userId, 'TV_SECRET_ROTATED', `connection=${id}`);
    return {
      connection: { ...updated, secretHash: undefined },
      secret,
      webhookUrl: `${publicBaseUrl()}/tradingview/webhook/${id}`,
      samplePayload: buildPayloadTemplate('BUY', secret)
    };
  }

  static setupGuide(connectionId: string, secret?: string) {
    const url = `${publicBaseUrl()}/tradingview/webhook/${connectionId}`;
    return {
      title: 'TradingView Setup Guide',
      steps: [
        'Open TradingView chart.',
        'Add indicator or strategy.',
        'Create alert.',
        'Select webhook URL.',
        `Paste BusineXAi webhook URL: ${url}`,
        'Paste JSON payload from Payload Builder.',
        'Save alert.',
        'Send a test signal from TradingView Connect → Test webhook.',
        'Run paper mode first — live is disabled by default.'
      ],
      webhookUrl: url,
      samplePayload: buildPayloadTemplate('BUY', secret || 'USER_WEBHOOK_SECRET'),
      safety: [
        'Alerts never execute live trades directly.',
        'Every alert becomes a signal first.',
        'Paper trading is default.',
        'Live requires approval + RMS + OMS.'
      ]
    };
  }

  static async ingestWebhook(connectionId: string, body: Record<string, unknown>, headers?: Record<string, string>) {
    const conn = await prisma.tradingViewConnection.findUnique({ where: { id: connectionId } });
    if (!conn || !conn.isActive) {
      throw new AppError('Invalid webhook connection', 404);
    }

    const secret = String(body.secret || headers?.['x-tv-secret'] || '');
    if (!validateSecret(secret, conn.secretHash)) {
      await prisma.tradingViewWebhookEvent.create({
        data: {
          connectionId,
          userId: conn.userId,
          idempotencyKey: `badsec-${Date.now()}`,
          status: 'REJECTED',
          rejectReason: 'Invalid webhook secret',
          rawPayloadRedacted: { ...body, secret: '[REDACTED]' },
          headersRedacted: { 'user-agent': headers?.['user-agent'] || null }
        }
      });
      await audit(conn.userId, 'TV_WEBHOOK_REJECTED', 'Invalid secret');
      throw new AppError('Invalid webhook secret', 401);
    }

    let draft;
    try {
      draft = normalizeTradingViewPayload(body);
      draft.symbol = mapSymbol(draft.symbol);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Parse failed';
      await prisma.tradingViewWebhookEvent.create({
        data: {
          connectionId,
          userId: conn.userId,
          idempotencyKey: `parse-${Date.now()}`,
          status: 'REJECTED',
          rejectReason: reason,
          rawPayloadRedacted: { ...body, secret: '[REDACTED]' }
        }
      });
      throw new AppError(reason, 400);
    }

    if (!isFreshTimestamp(draft.timestamp)) {
      await prisma.tradingViewWebhookEvent.create({
        data: {
          connectionId,
          userId: conn.userId,
          idempotencyKey: `stale-${Date.now()}`,
          status: 'REJECTED',
          rejectReason: 'Stale or future-dated alert',
          rawPayloadRedacted: draft.rawPayloadRedacted
        }
      });
      await audit(conn.userId, 'TV_STALE_ALERT', `${draft.symbol} ${draft.side}`);
      throw new AppError('Stale alert rejected', 400);
    }

    const idempotencyKey = buildIdempotencyKey(connectionId, draft, body);
    const dupEvent = await prisma.tradingViewWebhookEvent.findUnique({
      where: { connectionId_idempotencyKey: { connectionId, idempotencyKey } }
    });
    if (dupEvent) {
      await audit(conn.userId, 'TV_DUPLICATE_ALERT', idempotencyKey);
      throw new AppError('Duplicate alert', 409);
    }

    const event = await prisma.tradingViewWebhookEvent.create({
      data: {
        connectionId,
        userId: conn.userId,
        idempotencyKey,
        status: 'RECEIVED',
        rawPayloadRedacted: draft.rawPayloadRedacted
      }
    });

    const existingSignal = await prisma.normalizedSignal.findUnique({
      where: { userId_idempotencyKey: { userId: conn.userId, idempotencyKey } }
    });
    if (existingSignal) {
      await prisma.tradingViewWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'REJECTED', rejectReason: 'Duplicate signal' }
      });
      throw new AppError('Duplicate alert', 409);
    }

    const signal = await prisma.normalizedSignal.create({
      data: {
        userId: conn.userId,
        connectionId,
        strategyId: draft.strategyId,
        source: 'TRADINGVIEW',
        symbol: draft.symbol,
        exchange: draft.exchange,
        assetClass: draft.assetClass,
        side: draft.side,
        signalType: draft.signalType,
        timeframe: draft.timeframe,
        price: draft.price,
        quantity: draft.quantity,
        stopLoss: draft.stopLoss,
        target: draft.target,
        confidenceScore: draft.confidenceScore,
        timestamp: draft.timestamp,
        rawPayloadRedacted: draft.rawPayloadRedacted,
        idempotencyKey,
        status: 'NEW'
      }
    });

    await prisma.tradingViewWebhookEvent.update({
      where: { id: event.id },
      data: { status: 'NORMALIZED' }
    });
    await audit(conn.userId, 'TV_SIGNAL_NORMALIZED', `${signal.symbol} ${signal.side}`, signal.id);

    const validation = await this.validateSignal(conn.userId, signal.id);
    return { eventId: event.id, signal, validation };
  }

  static async validateSignal(userId: string, signalId: string) {
    const signal = await prisma.normalizedSignal.findFirst({ where: { id: signalId, userId } });
    if (!signal) throw new AppError('Signal not found', 404);

    const checks: Record<string, boolean> = {};
    const blockers: string[] = [];

    checks.symbol_valid = !!signal.symbol && signal.symbol !== 'UNKNOWN';
    checks.side_valid = ['BUY', 'SELL', 'EXIT'].includes(signal.side);
    checks.timestamp_fresh = isFreshTimestamp(signal.timestamp, 24 * 60 * 60 * 1000); // inbox may be older
    checks.connection_owned = !!signal.connectionId;

    if (!checks.symbol_valid) blockers.push('Invalid symbol');
    if (!checks.side_valid) blockers.push('Invalid side');

    // Live-path extras (informational for paper)
    checks.stop_loss_present = signal.stopLoss != null && signal.stopLoss > 0;
    checks.live_trading_disabled = true;

    try {
      const policy = await RiskJourneyService.getCapitalPolicy(userId);
      checks.within_trade_budget = signal.quantity > 0;
      if (policy.killSwitchActive) blockers.push('Kill switch active');
      if (policy.noTradeMode) blockers.push('No-trade mode enabled');
    } catch {
      checks.risk_policy = false;
    }

    const passed = blockers.length === 0 && checks.symbol_valid && checks.side_valid;
    const row = await prisma.signalValidationResult.create({
      data: { signalId, passed, checks, blockers }
    });
    await prisma.normalizedSignal.update({
      where: { id: signalId },
      data: { status: passed ? 'VALIDATED' : 'REJECTED' }
    });
    await audit(userId, passed ? 'TV_SIGNAL_VALIDATED' : 'TV_SIGNAL_REJECTED', blockers.join('; ') || 'ok', signalId);
    return row;
  }

  static async listSignals(userId: string) {
    return prisma.normalizedSignal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { validations: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });
  }

  static async getSignal(userId: string, signalId: string) {
    const s = await prisma.normalizedSignal.findFirst({
      where: { id: signalId, userId },
      include: {
        validations: { orderBy: { createdAt: 'desc' }, take: 3 },
        paperTests: { orderBy: { createdAt: 'desc' }, take: 3 },
        conversions: true,
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 }
      }
    });
    if (!s) throw new AppError('Signal not found', 404);
    return s;
  }

  static async paperTest(userId: string, signalId: string) {
    const signal = await this.getSignal(userId, signalId);
    if (signal.status === 'REJECTED') throw new AppError('Cannot paper-test rejected signal', 400);

    const req = await prisma.paperTestRequest.create({
      data: { userId, signalId, status: 'RUNNING' }
    });

    try {
      if (signal.side === 'EXIT') {
        const updated = await prisma.paperTestRequest.update({
          where: { id: req.id },
          data: {
            status: 'PASSED',
            resultJson: { note: 'EXIT signal recorded — no new entry order in paper lab' }
          }
        });
        await prisma.normalizedSignal.update({ where: { id: signalId }, data: { status: 'PAPER_TESTED' } });
        await audit(userId, 'TV_PAPER_TEST', 'EXIT acknowledged', signalId);
        return updated;
      }

      const order = await OrderExecutionService.placeOrder({
        userId,
        symbol: signal.symbol,
        exchange: signal.exchange || 'NSE',
        tradeType: signal.side === 'SELL' ? 'SELL' : 'BUY',
        quantity: Math.max(1, Math.floor(signal.quantity || 1)),
        orderType: 'MARKET',
        product: 'CNC',
        price: signal.price || undefined,
        isPaper: true,
        source: 'TRADINGVIEW',
        idempotencyKey: `tv-paper-${signal.idempotencyKey}`
      });

      const updated = await prisma.paperTestRequest.update({
        where: { id: req.id },
        data: {
          status: 'PASSED',
          orderId: order.id,
          resultJson: {
            orderId: order.id,
            symbol: signal.symbol,
            side: signal.side,
            mode: 'paper',
            live: false
          }
        }
      });
      await prisma.normalizedSignal.update({ where: { id: signalId }, data: { status: 'PAPER_TESTED' } });
      await audit(userId, 'TV_PAPER_TEST', `order=${order.id}`, signalId);
      return updated;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.paperTestRequest.update({
        where: { id: req.id },
        data: { status: 'FAILED', resultJson: { error: msg } }
      });
      await audit(userId, 'TV_PAPER_TEST_FAILED', msg, signalId);
      throw e;
    }
  }

  static async convertToStrategy(userId: string, signalId: string) {
    const signal = await this.getSignal(userId, signalId);
    const riskRules = defaultPaperRiskRules(100000);
    if (signal.stopLoss) {
      (riskRules as { stop_loss_absolute?: number }).stop_loss_absolute = signal.stopLoss;
    }

    const strategy = await prisma.strategy.create({
      data: {
        userId,
        name: `TV ${signal.signalType} ${signal.symbol}`,
        description: `Converted from TradingView signal ${signal.id}`,
        category: 'tradingview',
        code: `# TradingView Alert-to-Algo\nsignal_type=${signal.signalType}\nsymbol=${signal.symbol}\nside=${signal.side}\n`,
        parameters: {
          symbols: [signal.symbol],
          rules: [
            { source: 'TRADINGVIEW', signalType: signal.signalType, side: signal.side },
            riskRules
          ],
          paper_only: true
        },
        isActive: false
      }
    });

    const conversion = await prisma.signalToStrategyConversion.create({
      data: { signalId, strategyId: strategy.id, riskRules }
    });
    await prisma.normalizedSignal.update({
      where: { id: signalId },
      data: { status: 'CONVERTED', strategyId: strategy.id }
    });
    await audit(userId, 'TV_CONVERT_STRATEGY', strategy.id, signalId);
    return { strategy, conversion, riskRules };
  }

  static async requestLiveApproval(userId: string, signalId: string) {
    const signal = await this.getSignal(userId, signalId);
    const blockers: string[] = [];
    if (signal.stopLoss == null) blockers.push('Stop-loss required for live');
    blockers.push('Live trading disabled by default');
    blockers.push('Explicit user approval + RMS + OMS required');

    // Align with OrderExecutionService / RiskGateService TradingControl gates
    const controls = await RiskGateService.getLiveControlsSnapshot(userId);
    if (process.env.LIVE_TRADING_ENABLED !== 'true') {
      blockers.push('LIVE_TRADING_ENABLED env is not true');
    }
    if (!controls.liveTradingEnabled) blockers.push('TradingControl liveTradingEnabled=false');
    if (controls.killSwitch) blockers.push('TradingControl kill switch active');
    if (controls.approvalState !== 'APPROVED') {
      blockers.push(`TradingControl approvalState=${controls.approvalState}`);
    }
    if (controls.requirePaperQualify) blockers.push('Paper qualify required before live');

    try {
      const policy = await RiskJourneyService.getCapitalPolicy(userId);
      if (!policy.liveTradingEnabled) blockers.push('Capital policy live_trading_enabled=false');
      if (policy.killSwitchActive) blockers.push('Capital policy kill switch active');
    } catch {
      blockers.push('Complete risk onboarding first');
    }

    await prisma.normalizedSignal.update({
      where: { id: signalId },
      data: { status: 'LIVE_PENDING' }
    });
    await audit(userId, 'TV_LIVE_REQUEST_BLOCKED', blockers.join('; '), signalId);

    return {
      approved: false,
      blocked: true,
      blockers,
      controls,
      message: 'Live trading remains disabled. Complete paper tests, risk profile, and admin/RMS approval.'
    };
  }

  static async ignoreSignal(userId: string, signalId: string) {
    await this.getSignal(userId, signalId);
    const s = await prisma.normalizedSignal.update({
      where: { id: signalId },
      data: { status: 'IGNORED' }
    });
    await audit(userId, 'TV_SIGNAL_IGNORED', signalId, signalId);
    return s;
  }

  static async allocate(userId: string, signalId: string, accounts: Array<{ label: string; allocation_pct: number; quantity?: number }>) {
    const signal = await this.getSignal(userId, signalId);
    const parent = await prisma.parentSignal.upsert({
      where: { signalId },
      create: { signalId },
      update: {}
    });
    await prisma.childOrderIntent.deleteMany({ where: { parentSignalId: parent.id } });
    const totalQty = Math.max(1, Number(signal.quantity) || 1);
    const children = [];
    for (const a of accounts) {
      const pct = Number(a.allocation_pct) || 0;
      const qty = a.quantity != null ? Number(a.quantity) : Math.max(1, Math.floor((totalQty * pct) / 100));
      children.push(
        await prisma.childOrderIntent.create({
          data: {
            parentSignalId: parent.id,
            accountLabel: a.label,
            quantity: qty,
            allocationPct: pct,
            status: 'PENDING'
          }
        })
      );
    }
    await audit(userId, 'TV_ALLOCATE', `${children.length} child intents`, signalId);
    return { parent, children };
  }

  static async childOrders(userId: string, signalId: string) {
    await this.getSignal(userId, signalId);
    const parent = await prisma.parentSignal.findUnique({
      where: { signalId },
      include: { childIntents: true }
    });
    return parent?.childIntents || [];
  }

  static listPayloadTemplates() {
    return systemPayloadTemplates();
  }

  static generatePayload(kind: PayloadKind, secret?: string) {
    return buildPayloadTemplate(kind, secret || 'USER_WEBHOOK_SECRET');
  }

  static async listWebhookEvents(userId: string) {
    return prisma.tradingViewWebhookEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  static async getWebhookEvent(userId: string, eventId: string) {
    const e = await prisma.tradingViewWebhookEvent.findFirst({ where: { id: eventId, userId } });
    if (!e) throw new AppError('Event not found', 404);
    return e;
  }

  static explainSignal(signal: {
    symbol: string;
    side: string;
    signalType: string;
    status: string;
    stopLoss?: number | null;
    price?: number | null;
  }, language = 'hinglish') {
    const en = `TradingView signal ${signal.side} ${signal.symbol} (${signal.signalType}). Status: ${signal.status}. Paper-first — live needs approval + RMS. Profit is not guaranteed.`;
    const hi = `TradingView signal: ${signal.side} ${signal.symbol} (${signal.signalType}). Status: ${signal.status}. Pehle paper test karein. Live ke liye approval + RMS zaroori. Profit guaranteed nahi.`;
    if (language === 'odia') return `${en} (Odia)`;
    if (language === 'hi' || language === 'hindi' || language === 'hinglish') return hi;
    return en;
  }
}
