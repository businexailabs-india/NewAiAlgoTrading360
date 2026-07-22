import { randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { OrderExecutionService } from '../order-execution.service';
import { RiskGateService } from '../risk-gate.service';
import { TradingModeService } from '../trading-mode.service';
import { analyzeStrategy, type StrategyLegInput } from './strategy-analytics.service';
import { applySlippage, estimateCharges } from './charges.service';
import type { PaperLeg } from './paper-options.service';

export type LiveLeg = PaperLeg & {
  strike?: number;
  lotSize?: number;
  instrumentToken?: string;
};

function featureLiveOptionsOn() {
  return process.env.FEATURE_LIVE_OPTIONS === 'true';
}

export class LiveOptionsService {
  static async preview(userId: string, legs: LiveLeg[], opts?: { pin?: string; confirmLive?: boolean }) {
    const mode = await TradingModeService.getMode(userId);
    if (mode.mode !== 'live') {
      throw new AppError('Switch to LIVE MODE before live preview', 403, {
        reason: 'NOT_LIVE_MODE',
        correctiveAction: 'Use Mode switch with Trading PIN'
      });
    }
    if (mode.liveLocked) {
      throw new AppError('No connected broker — live locked', 403, {
        reason: 'BROKER_LOCKED',
        correctiveAction: 'Connect a broker in Broker Connections'
      });
    }
    if (!mode.liveEnabled) {
      throw new AppError('Live trading not enabled for this account', 403, {
        reason: 'LIVE_DISABLED',
        correctiveAction: 'Get TradingControl approval / enable LIVE_TRADING_ENABLED'
      });
    }

    if (!legs?.length) throw new AppError('At least one leg required', 400);

    const previews = [];
    const analyticsLegs: StrategyLegInput[] = [];

    for (const leg of legs) {
      const inst = await prisma.derivativeInstrument.findUnique({ where: { id: leg.instrumentId } });
      if (!inst || !inst.tradable) {
        throw new AppError(`Instrument not tradable: ${leg.tradingSymbol || leg.instrumentId}`, 400, {
          reason: 'INSTRUMENT_NOT_TRADABLE',
          correctiveAction: 'Pick contracts from instrument master'
        });
      }

      const qty = leg.lots * inst.lotSize;
      const mid = leg.premium && leg.premium > 0 ? leg.premium : 1;
      const fill = applySlippage(mid, leg.side);
      const charges = estimateCharges({
        premium: fill,
        quantity: qty,
        side: leg.side,
        optionType: (inst.optionType as 'CE' | 'PE') || 'FUT'
      });

      await RiskGateService.preflightDerivatives({
        userId,
        isPaper: false,
        instrument: inst,
        side: leg.side,
        lots: leg.lots,
        quantity: qty,
        premium: fill
      });

      previews.push({
        instrumentId: inst.id,
        tradingSymbol: inst.tradingSymbol,
        instrumentToken: inst.instrumentToken,
        exchange: inst.exchange,
        segment: inst.segment,
        lotSize: inst.lotSize,
        freezeQty: inst.freezeQty,
        lots: leg.lots,
        quantity: qty,
        side: leg.side,
        optionType: (inst.optionType as 'CE' | 'PE') || 'FUT',
        strike: inst.strike,
        expiry: inst.expiry.toISOString().slice(0, 10),
        mid,
        fillPrice: fill,
        charges,
        exchangeSegment: inst.segment === 'BFO' ? 'BSE_FNO' : 'NSE_FNO'
      });

      analyticsLegs.push({
        side: leg.side,
        optionType: (inst.optionType as 'CE' | 'PE') || 'FUT',
        strike: Number(inst.strike || 0),
        premium: fill,
        lots: leg.lots,
        lotSize: inst.lotSize
      });
    }

    const analytics = analyzeStrategy(analyticsLegs);
    const submitAllowed = featureLiveOptionsOn();

    return {
      isPaper: false,
      liveBrokerSubmit: false,
      submitAllowed,
      featureLiveOptions: submitAllowed,
      warnings: [
        'REAL MONEY preview — no broker order was sent',
        submitAllowed
          ? 'FEATURE_LIVE_OPTIONS is ON — confirm + PIN required to submit'
          : 'FEATURE_LIVE_OPTIONS is OFF — submit blocked until acceptance tests pass'
      ],
      legs: previews,
      analytics,
      brokers: mode.brokers,
      requiresPinToSubmit: true,
      requiresConfirmLive: true
    };
  }

  static async cloneFromPaperStrategy(userId: string, strategyId: string) {
    const strat = await prisma.paperStrategy.findFirst({
      where: { id: strategyId, userId }
    });
    if (!strat) throw new AppError('Paper strategy not found', 404);
    const legs = (Array.isArray(strat.legs) ? strat.legs : []) as LiveLeg[];
    const preview = await this.preview(userId, legs);
    return {
      sourceStrategyId: strat.id,
      sourceName: strat.name,
      clonedLegs: legs,
      preview
    };
  }

  static async submit(userId: string, legs: LiveLeg[], opts: { pin: string; confirmLive: boolean }) {
    if (!featureLiveOptionsOn()) {
      throw new AppError('Live options submit disabled (FEATURE_LIVE_OPTIONS=false)', 403, {
        reason: 'FEATURE_LIVE_OPTIONS_OFF',
        correctiveAction: 'Keep using paper / live preview until flag is enabled'
      });
    }
    if (!opts.confirmLive) {
      throw new AppError('confirmLive required for live submit', 400);
    }
    // Re-validate PIN via mode service switch check path
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    const hash = (settings?.settings as { tradingPinHash?: string } | null)?.tradingPinHash;
    if (!hash) throw new AppError('Trading PIN required', 400);
    const bcrypt = await import('bcryptjs');
    if (!(await bcrypt.compare(String(opts.pin || ''), hash))) {
      throw new AppError('Invalid Trading PIN', 403, { reason: 'INVALID_PIN' });
    }

    const preview = await this.preview(userId, legs);
    const orders = [];

    for (const leg of preview.legs) {
      const order = await OrderExecutionService.placeOrder({
        userId,
        symbol: leg.tradingSymbol,
        exchange: leg.segment === 'BFO' ? 'BSE' : 'NFO',
        tradeType: leg.side,
        quantity: leg.quantity,
        orderType: 'MARKET',
        product: 'NRML',
        price: leg.fillPrice,
        instrumentType: 'OPTION',
        isPaper: false,
        idempotencyKey: `live-opt-${randomUUID()}`,
        source: 'MANUAL',
        instrumentToken: leg.instrumentToken,
        exchangeSegment: leg.exchangeSegment,
        optionDetails: {
          strike: Number(leg.strike || 0),
          expiry: leg.expiry,
          optionType: (leg.optionType as 'CE' | 'PE') || 'CE'
        }
      });
      orders.push(order);
    }

    return {
      orders,
      preview,
      liveBrokerSubmit: true,
      isPaper: false
    };
  }

  static async cancel(userId: string, orderId: string) {
    if (!featureLiveOptionsOn()) {
      throw new AppError('Live options cancel gated by FEATURE_LIVE_OPTIONS', 403);
    }
    return OrderExecutionService.cancelOrder(userId, orderId);
  }

  static async modify(
    userId: string,
    orderId: string,
    patch: { quantity?: number; price?: number; triggerPrice?: number; orderType?: string }
  ) {
    if (!featureLiveOptionsOn()) {
      throw new AppError('Live options modify gated by FEATURE_LIVE_OPTIONS', 403);
    }
    return OrderExecutionService.modifyOrder(userId, orderId, patch);
  }

  static async squareOff(userId: string, orderId: string) {
    if (!featureLiveOptionsOn()) {
      throw new AppError('Live options square-off gated by FEATURE_LIVE_OPTIONS', 403);
    }
    const order = await OrderExecutionService.getOrderById(userId, orderId);
    if (order.isPaper) throw new AppError('Use paper path for paper orders', 400);
    const details = order.optionDetails as { strike?: number; expiry?: string; optionType?: 'CE' | 'PE' } | null;
    const flip = order.tradeType === 'BUY' ? 'SELL' : 'BUY';
    return OrderExecutionService.placeOrder({
      userId,
      symbol: order.symbol,
      exchange: order.exchange,
      tradeType: flip as 'BUY' | 'SELL',
      quantity: order.quantity,
      orderType: 'MARKET',
      product: (order.product as 'NRML') || 'NRML',
      instrumentType: 'OPTION',
      isPaper: false,
      idempotencyKey: `live-sqoff-${randomUUID()}`,
      source: 'MANUAL',
      optionDetails: details
        ? {
            strike: details.strike || 0,
            expiry: details.expiry || '',
            optionType: details.optionType || 'CE'
          }
        : undefined
    });
  }

  /** Resolve paper legs that still need instrument IDs from chain ATM (helper for UI). */
  static async attachMasterIdsFromSymbols(legs: LiveLeg[]) {
    const out: LiveLeg[] = [];
    for (const leg of legs) {
      if (leg.instrumentId) {
        out.push(leg);
        continue;
      }
      const inst = await prisma.derivativeInstrument.findFirst({
        where: { tradingSymbol: leg.tradingSymbol, tradable: true },
        orderBy: { syncedAt: 'desc' }
      });
      if (!inst) {
        throw new AppError(`No master contract for ${leg.tradingSymbol}`, 400);
      }
      out.push({
        ...leg,
        instrumentId: inst.id,
        tradingSymbol: inst.tradingSymbol
      });
    }
    return out;
  }
}
