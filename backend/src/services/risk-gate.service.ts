import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { isMarketOpen } from '../utils/helpers';
import { ResolvedExecutionTarget } from './execution-target.resolver';
import { blackScholesGreeks, daysToExpiry } from './options/greeks.service';
import { RiskJourneyService } from './risk-journey/risk-journey.service';

export interface PreTradeCheckInput {
  userId: string;
  symbol: string;
  tradeType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  isPaper: boolean;
  source: string;
  idempotencyKey?: string;
  target: ResolvedExecutionTarget;
  instrumentType?: string;
  optionsSelling?: boolean;
  nakedOption?: boolean;
  stopLossMissing?: boolean;
  marketDataStale?: boolean;
  algoName?: string;
}

export interface PreTradeCheckResult {
  allowed: boolean;
  estimatedValue: number;
  warnings: string[];
  controls: {
    liveTradingEnabled: boolean;
    killSwitch: boolean;
    approvalState: string;
    maxOrderValue: number | null;
    maxDailyOrderValue: number | null;
  };
}

async function getEffectiveControls(userId: string, brokerConnectionId?: string | null) {
  const [globalCtrl, userCtrl, accountCtrl] = await Promise.all([
    prisma.tradingControl.findFirst({ where: { scope: 'GLOBAL', userId: null, brokerConnectionId: null } }),
    prisma.tradingControl.findFirst({ where: { scope: 'USER', userId } }),
    brokerConnectionId
      ? prisma.tradingControl.findFirst({ where: { scope: 'ACCOUNT', userId, brokerConnectionId } })
      : null
  ]);

  const envLive = process.env.LIVE_TRADING_ENABLED === 'true';
  return {
    liveTradingEnabled:
      envLive &&
      (globalCtrl?.liveTradingEnabled ?? false) &&
      (userCtrl?.liveTradingEnabled ?? true) &&
      (accountCtrl?.liveTradingEnabled ?? true),
    killSwitch:
      !!(globalCtrl?.killSwitch || userCtrl?.killSwitch || accountCtrl?.killSwitch),
    approvalState: accountCtrl?.approvalState || userCtrl?.approvalState || globalCtrl?.approvalState || 'NONE',
    maxOrderValue: Number(accountCtrl?.maxOrderValue ?? userCtrl?.maxOrderValue ?? globalCtrl?.maxOrderValue ?? 0) || null,
    maxDailyOrderValue:
      Number(accountCtrl?.maxDailyOrderValue ?? userCtrl?.maxDailyOrderValue ?? globalCtrl?.maxDailyOrderValue ?? 0) || null,
    maxDailyLoss: Number(accountCtrl?.maxDailyLoss ?? userCtrl?.maxDailyLoss ?? globalCtrl?.maxDailyLoss ?? 0) || null,
    maxOpenExposure:
      Number(accountCtrl?.maxOpenExposure ?? userCtrl?.maxOpenExposure ?? globalCtrl?.maxOpenExposure ?? 0) || null,
    requirePaperQualify: globalCtrl?.requirePaperQualify ?? true
  };
}

export class RiskGateService {
  static async ensureGlobalControl() {
    const existing = await prisma.tradingControl.findFirst({
      where: { scope: 'GLOBAL', userId: null, brokerConnectionId: null }
    });
    if (existing) return existing;
    return prisma.tradingControl.create({
      data: {
        scope: 'GLOBAL',
        liveTradingEnabled: false,
        killSwitch: false,
        approvalState: 'NONE',
        requirePaperQualify: true,
        maxOrderValue: 100000,
        maxDailyOrderValue: 500000,
        maxDailyLoss: 25000
      }
    });
  }

  /** Snapshot of env ∧ TradingControl gates (used by TradingView live-approval, etc.). */
  static async getLiveControlsSnapshot(userId: string, brokerConnectionId?: string | null) {
    await this.ensureGlobalControl();
    return getEffectiveControls(userId, brokerConnectionId);
  }

  static async preflight(input: PreTradeCheckInput): Promise<PreTradeCheckResult> {
    await this.ensureGlobalControl();
    const controls = await getEffectiveControls(input.userId, input.target.brokerConnectionId);
    const warnings: string[] = [];
    const estimatedValue = input.quantity * (input.price || 0);

    if (input.idempotencyKey) {
      const dup = await prisma.executionAttempt.findUnique({
        where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } }
      });
      if (dup) throw new AppError('Duplicate idempotency key — order already submitted', 409);
    }

    if (input.quantity <= 0) throw new AppError('Quantity must be positive', 400);
    if (!input.symbol?.trim()) throw new AppError('Symbol is required', 400);

    // ₹1L RiskGuard360 journey — applies after onboarding profile exists
    const journeyProfile = await prisma.userRiskProfile.findUnique({ where: { userId: input.userId } });
    if (journeyProfile) {
      const brokerOk = input.isPaper
        ? true
        : !!(input.target.brokerConnectionId || input.target.direct || input.target.mcp);
      const journey = await RiskJourneyService.assertTradeAllowed({
        userId: input.userId,
        isPaper: input.isPaper,
        estimatedValue,
        tradeType: input.tradeType,
        instrumentType: input.instrumentType,
        optionsSelling: input.optionsSelling,
        nakedOption: input.nakedOption,
        stopLossMissing: input.stopLossMissing,
        brokerConnected: brokerOk,
        marketDataStale: input.marketDataStale,
        algoName: input.algoName
      });
      if (!journey.allowed) {
        await this.logRiskEvent(
          input.userId,
          'TRADE_BLOCKED',
          journey.blockers.join('; '),
          'Review Daily Control Room / risk onboarding',
          'WARN',
          { blockers: journey.blockers, symbol: input.symbol }
        );
        throw new AppError(`RiskGuard360 blocked: ${journey.blockers.join('; ')}`, 403, {
          reason: 'RISK_JOURNEY_BLOCK',
          correctiveAction: 'Open Daily Control Room and review risk limits',
          details: { blockers: journey.blockers }
        });
      }
    } else if (!input.isPaper) {
      throw new AppError('RiskGuard360: complete Rs 1L risk onboarding before live trading', 403, {
        reason: 'RISK_PROFILE_MISSING',
        correctiveAction: 'POST /api/risk-onboarding/profile'
      });
    }

    if (!input.isPaper) {
      if (controls.killSwitch) throw new AppError('Live trading kill switch is active', 403);
      if (!controls.liveTradingEnabled) {
        throw new AppError('Live trading is disabled. Keep paper mode or get admin approval.', 403);
      }
      if (controls.approvalState !== 'APPROVED') {
        throw new AppError('Live trading not approved for this account/user', 403);
      }
      if (!input.target.brokerConnectionId) {
        throw new AppError('Live order requires a selected active account', 400);
      }
      if (!isMarketOpen()) {
        warnings.push('Market appears closed (IST weekday window)');
      }
      if (controls.maxOrderValue && estimatedValue > controls.maxOrderValue) {
        throw new AppError(`Order value ${estimatedValue} exceeds max order value ${controls.maxOrderValue}`, 400);
      }
      if (controls.maxDailyOrderValue) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const todays = await prisma.order.findMany({
          where: {
            userId: input.userId,
            isPaper: false,
            createdAt: { gte: start },
            status: { notIn: ['REJECTED', 'CANCELLED'] }
          }
        });
        const spent = todays.reduce((s, o) => s + o.quantity * Number(o.price || 0), 0);
        if (spent + estimatedValue > controls.maxDailyOrderValue) {
          throw new AppError('Daily order value limit exceeded', 400);
        }
      }

      // Optional funds check via adapter
      try {
        if (input.target.mcp) {
          await input.target.mcp.getFunds();
        } else if (input.target.direct) {
          await input.target.direct.getFunds();
        }
      } catch (err) {
        warnings.push(`Funds probe failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      allowed: true,
      estimatedValue,
      warnings,
      controls: {
        liveTradingEnabled: controls.liveTradingEnabled,
        killSwitch: controls.killSwitch,
        approvalState: controls.approvalState,
        maxOrderValue: controls.maxOrderValue,
        maxDailyOrderValue: controls.maxDailyOrderValue
      }
    };
  }

  static async getOrCreateRiskProfile(userId: string) {
    let profile = await prisma.riskProfile.findUnique({ where: { userId } });
    if (!profile) {
      profile = await prisma.riskProfile.create({ data: { userId } });
    }
    return profile;
  }

  static async updateRiskLimits(
    userId: string,
    patch: Partial<{
      maxLotsPerOrder: number;
      maxDailyLoss: number;
      blockNakedShort: boolean;
      expiryDayWarn: boolean;
      maxOpenLots: number;
      maxAbsDelta: number;
      maxAbsVega: number;
      maxNetNotional: number;
    }>
  ) {
    await this.getOrCreateRiskProfile(userId);
    return prisma.riskProfile.update({
      where: { userId },
      data: {
        ...(patch.maxLotsPerOrder != null && { maxLotsPerOrder: patch.maxLotsPerOrder }),
        ...(patch.maxDailyLoss != null && { maxDailyLoss: patch.maxDailyLoss }),
        ...(patch.blockNakedShort != null && { blockNakedShort: patch.blockNakedShort }),
        ...(patch.expiryDayWarn != null && { expiryDayWarn: patch.expiryDayWarn }),
        ...(patch.maxOpenLots != null && { maxOpenLots: patch.maxOpenLots }),
        ...(patch.maxAbsDelta != null && { maxAbsDelta: patch.maxAbsDelta }),
        ...(patch.maxAbsVega != null && { maxAbsVega: patch.maxAbsVega }),
        ...(patch.maxNetNotional != null && { maxNetNotional: patch.maxNetNotional })
      }
    });
  }

  static async logRiskEvent(
    userId: string,
    kind: string,
    reason: string,
    corrective?: string,
    severity = 'WARN',
    meta?: object
  ) {
    return prisma.riskEvent.create({
      data: { userId, kind, reason, corrective, severity, meta: meta as object | undefined }
    });
  }

  /** F&O-specific preflight — used by paper options + risk check API */
  static async preflightDerivatives(input: {
    userId: string;
    isPaper: boolean;
    instrument: {
      id: string;
      tradingSymbol: string;
      tradable: boolean;
      expiry: Date;
      lotSize: number;
      freezeQty: number | null;
      optionType: string | null;
      instrumentType: string;
      strike?: number | null;
    };
    side: 'BUY' | 'SELL';
    lots: number;
    quantity: number;
    premium: number;
  }) {
    const profile = await this.getOrCreateRiskProfile(input.userId);
    const warnings: string[] = [];

    if (!input.instrument.tradable) {
      await this.logRiskEvent(
        input.userId,
        'BLOCK',
        'Contract not tradable',
        'Select a tradable instrument from the master',
        'ERROR'
      );
      throw new AppError('Contract is not tradable', 400, {
        reason: 'NOT_TRADABLE',
        correctiveAction: 'Select a tradable contract from the options chain'
      });
    }

    if (input.instrument.expiry.getTime() < Date.now() - 86_400_000) {
      await this.logRiskEvent(input.userId, 'BLOCK', 'Expired contract', 'Pick a future expiry', 'ERROR');
      throw new AppError('Contract has expired', 400, {
        reason: 'EXPIRED_CONTRACT',
        correctiveAction: 'Select a future expiry from the master'
      });
    }

    if (input.quantity <= 0 || input.lots <= 0) {
      throw new AppError('Lots / quantity must be positive', 400, {
        reason: 'INVALID_QTY',
        correctiveAction: 'Enter a positive lot count'
      });
    }

    if (input.quantity % input.instrument.lotSize !== 0) {
      await this.logRiskEvent(
        input.userId,
        'BLOCK',
        `Invalid lot size for ${input.instrument.tradingSymbol}`,
        `Use multiples of ${input.instrument.lotSize}`,
        'ERROR'
      );
      throw new AppError(`Quantity must be a multiple of lot size ${input.instrument.lotSize}`, 400, {
        reason: 'INVALID_LOT_SIZE',
        correctiveAction: `Order in whole lots of ${input.instrument.lotSize} units`
      });
    }

    if (input.instrument.freezeQty && input.quantity > input.instrument.freezeQty) {
      throw new AppError(`Exceeds freeze quantity ${input.instrument.freezeQty}`, 400, {
        reason: 'FREEZE_QTY',
        correctiveAction: `Reduce size to ≤ ${input.instrument.freezeQty} units`
      });
    }

    if (input.lots > profile.maxLotsPerOrder) {
      throw new AppError(`Lots ${input.lots} exceed maxLotsPerOrder ${profile.maxLotsPerOrder}`, 400, {
        reason: 'MAX_LOTS',
        correctiveAction: `Reduce lots to ≤ ${profile.maxLotsPerOrder} or raise limit in Risk Center`
      });
    }

    // Open lots across F&O book
    const openPositions = await prisma.derivativePosition.findMany({
      where: { userId: input.userId, isPaper: input.isPaper }
    });
    const openLots = openPositions.reduce(
      (s, p) => s + Math.ceil(p.quantity / Math.max(p.lotSize || 1, 1)),
      0
    );
    if (profile.maxOpenLots > 0 && openLots + input.lots > profile.maxOpenLots) {
      await this.logRiskEvent(
        input.userId,
        'BLOCK',
        `Open lots ${openLots}+${input.lots} exceed maxOpenLots ${profile.maxOpenLots}`,
        'Reduce size or close positions',
        'ERROR'
      );
      throw new AppError(
        `Open lots would be ${openLots + input.lots}, exceeds maxOpenLots ${profile.maxOpenLots}`,
        400,
        {
          reason: 'MAX_OPEN_LOTS',
          correctiveAction: `Close positions or raise maxOpenLots in Risk Center (current open ${openLots})`
        }
      );
    }

    if (
      profile.blockNakedShort &&
      input.side === 'SELL' &&
      (input.instrument.optionType === 'CE' || input.instrument.optionType === 'PE')
    ) {
      // Phase 1: block naked short options when config says so (no hedge inventory check yet)
      await this.logRiskEvent(
        input.userId,
        'BLOCK',
        'Naked short option blocked',
        'Disable blockNakedShort or sell only with hedge',
        'ERROR'
      );
      throw new AppError('Naked short options are blocked by risk profile', 403, {
        reason: 'NAKED_SHORT_BLOCK',
        correctiveAction: 'Turn off blockNakedShort in Risk Center or use a hedged strategy'
      });
    }

    const expiryDay = input.instrument.expiry.toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (profile.expiryDayWarn && expiryDay === today) {
      warnings.push('Expiry-day trade — elevated gamma/assignment risk');
    }

    // Session daily loss: sum REALIZED ledger entries since local midnight
    if (profile.maxDailyLoss > 0) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const paper = await prisma.paperAccount.findUnique({
        where: { userId_currency: { userId: input.userId, currency: 'INR' } },
        include: {
          ledger: {
            where: { kind: 'REALIZED', createdAt: { gte: start } },
            select: { amount: true }
          }
        }
      });
      const dayRealized = (paper?.ledger || []).reduce((s, e) => s + e.amount, 0);
      if (dayRealized < 0 && Math.abs(dayRealized) >= profile.maxDailyLoss) {
        throw new AppError('Daily loss limit reached', 403, {
          reason: 'DAILY_LOSS',
          correctiveAction: 'Wait for next session or raise maxDailyLoss in Risk Center'
        });
      }
    }

    // Portfolio notional + Greek exposure (model estimates)
    const exposure = this.estimatePortfolioExposure(openPositions);
    const orderNotional = input.premium * input.quantity;
    const projectedNotional = exposure.netNotional + orderNotional;

    if (profile.maxNetNotional > 0 && projectedNotional > profile.maxNetNotional) {
      throw new AppError(
        `Net notional ₹${projectedNotional.toFixed(0)} exceeds maxNetNotional ₹${profile.maxNetNotional}`,
        400,
        {
          reason: 'MAX_NET_NOTIONAL',
          correctiveAction: 'Reduce size or raise maxNetNotional in Risk Center'
        }
      );
    }

    const controls = await getEffectiveControls(input.userId, null);
    if (controls.maxOpenExposure && projectedNotional > controls.maxOpenExposure) {
      throw new AppError(
        `Net notional ₹${projectedNotional.toFixed(0)} exceeds TradingControl maxOpenExposure ₹${controls.maxOpenExposure}`,
        400,
        {
          reason: 'MAX_OPEN_EXPOSURE',
          correctiveAction: 'Reduce size or ask admin to raise maxOpenExposure'
        }
      );
    }

    // Project order into greek book (rough): treat BUY as long, SELL as short
    const orderGreeks = this.legGreeksEstimate({
      optionType: input.instrument.optionType,
      strike: input.instrument.strike,
      expiry: input.instrument.expiry,
      side: input.side === 'BUY' ? 'LONG' : 'SHORT',
      quantity: input.quantity,
      lastPrice: input.premium
    });
    const projDelta = exposure.netDelta + orderGreeks.delta;
    const projVega = exposure.netVega + orderGreeks.vega;

    if (profile.maxAbsDelta > 0 && Math.abs(projDelta) > profile.maxAbsDelta) {
      throw new AppError(
        `|Δ| ${Math.abs(projDelta).toFixed(2)} exceeds maxAbsDelta ${profile.maxAbsDelta}`,
        400,
        {
          reason: 'MAX_ABS_DELTA',
          correctiveAction: 'Hedge delta or raise maxAbsDelta in Risk Center'
        }
      );
    }
    if (profile.maxAbsVega > 0 && Math.abs(projVega) > profile.maxAbsVega) {
      throw new AppError(
        `|ν| ${Math.abs(projVega).toFixed(2)} exceeds maxAbsVega ${profile.maxAbsVega}`,
        400,
        {
          reason: 'MAX_ABS_VEGA',
          correctiveAction: 'Reduce vega or raise maxAbsVega in Risk Center'
        }
      );
    }

    return {
      allowed: true as const,
      warnings,
      profile,
      exposure: {
        openLots,
        netNotional: exposure.netNotional,
        netDelta: exposure.netDelta,
        netVega: exposure.netVega,
        projectedNotional,
        projectedDelta: projDelta,
        projectedVega: projVega
      }
    };
  }

  /** Rough portfolio exposure from open F&O positions (BS model estimates). */
  static estimatePortfolioExposure(
    positions: Array<{
      side: string;
      quantity: number;
      avgPrice: number;
      lastPrice: number;
      optionType: string | null;
      strike: number | null;
      expiry: Date | null;
    }>
  ) {
    let netNotional = 0;
    let netDelta = 0;
    let netVega = 0;
    for (const p of positions) {
      const px = p.lastPrice > 0 ? p.lastPrice : p.avgPrice;
      netNotional += px * p.quantity;
      const g = this.legGreeksEstimate({
        optionType: p.optionType,
        strike: p.strike,
        expiry: p.expiry,
        side: p.side,
        quantity: p.quantity,
        lastPrice: px
      });
      netDelta += g.delta;
      netVega += g.vega;
    }
    return {
      netNotional: Number(netNotional.toFixed(2)),
      netDelta: Number(netDelta.toFixed(4)),
      netVega: Number(netVega.toFixed(4))
    };
  }

  static legGreeksEstimate(input: {
    optionType: string | null | undefined;
    strike: number | null | undefined;
    expiry: Date | null | undefined;
    side: string;
    quantity: number;
    lastPrice: number;
  }) {
    const ot = input.optionType === 'PE' ? 'PE' : input.optionType === 'CE' ? 'CE' : null;
    if (!ot || !input.strike || !input.expiry) {
      return { delta: 0, vega: 0 };
    }
    const spot = Number(input.strike); // ATM-proxy; labeled as estimate in Risk Center
    const g = blackScholesGreeks({
      spot,
      strike: Number(input.strike),
      timeYears: daysToExpiry(input.expiry) / 365,
      ivPct: 15,
      optionType: ot
    });
    const sign = input.side === 'SHORT' || input.side === 'SELL' ? -1 : 1;
    return {
      delta: g.delta * input.quantity * sign,
      vega: g.vega * input.quantity * sign
    };
  }

  static async check(userId: string, body: Record<string, unknown>) {
    const instrumentId = String(body.instrumentId || '');
    if (!instrumentId) throw new AppError('instrumentId required', 400);
    const instrument = await prisma.derivativeInstrument.findUnique({ where: { id: instrumentId } });
    if (!instrument) throw new AppError('Instrument not found', 404);
    return this.preflightDerivatives({
      userId,
      isPaper: body.isPaper !== false,
      instrument,
      side: (String(body.side || 'BUY').toUpperCase() as 'BUY' | 'SELL'),
      lots: Number(body.lots || 1),
      quantity: Number(body.quantity || Number(body.lots || 1) * instrument.lotSize),
      premium: Number(body.premium || 0)
    });
  }

  static async portfolioSnapshot(userId: string, isPaper = true) {
    const profile = await this.getOrCreateRiskProfile(userId);
    const positions = await prisma.derivativePosition.findMany({ where: { userId, isPaper } });
    const exposure = this.estimatePortfolioExposure(positions);
    const openLots = positions.reduce(
      (s, p) => s + Math.ceil(p.quantity / Math.max(p.lotSize || 1, 1)),
      0
    );
    return { profile, openLots, positions: positions.length, ...exposure, model: 'black-scholes-estimate' };
  }
}
