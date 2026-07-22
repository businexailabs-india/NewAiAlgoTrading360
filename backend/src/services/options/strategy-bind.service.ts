import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { OptionsChainService } from './options-chain.service';
import { analyzeStrategy, type StrategyLegInput } from './strategy-analytics.service';
import { ExecutionTargetResolver } from '../execution-target.resolver';
import { logger } from '../../utils/logger';

export type BindLegInput = {
  side: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE' | 'FUT';
  strike: number;
  premium?: number;
  lots: number;
  lotSize?: number;
  instrumentId?: string;
  tradingSymbol?: string;
  instrumentToken?: string;
};

export type BoundLeg = BindLegInput & {
  instrumentId: string;
  tradingSymbol: string;
  instrumentToken: string;
  lotSize: number;
  freezeQty: number | null;
  premium: number;
  bound: boolean;
  bindNote?: string;
};

/**
 * Resolve strategy legs onto instrument-master contracts for a given underlying/expiry.
 */
export class StrategyBindService {
  static async bindLegs(params: {
    userId: string;
    underlying: string;
    expiry: string;
    legs: BindLegInput[];
  }): Promise<{
    underlying: string;
    expiry: string;
    spot: number;
    legs: BoundLeg[];
    unboundCount: number;
    analytics: ReturnType<typeof analyzeStrategy>;
    margin: {
      estimate: number;
      method: string;
      availableFunds: number | null;
      fundsSource: string | null;
    };
  }> {
    const underlying = params.underlying.toUpperCase();
    const { underlying: u, contracts } = await (
      await import('./instrument-master.service')
    ).InstrumentMasterService.getContracts(underlying, params.expiry);

    if (!u || !contracts.length) {
      throw new AppError('No master contracts for underlying/expiry — sync instrument master', 400, {
        reason: 'MASTER_EMPTY',
        correctiveAction: 'POST /api/options/sync then retry bind'
      });
    }

    const chain = await OptionsChainService.getChain({
      underlying,
      expiry: params.expiry,
      userId: params.userId
    });
    const spot = chain.spotPrice || 0;

    const quoteByKey = new Map<string, { ltp: number; id?: string }>();
    if ('rows' in chain) {
      for (const row of chain.rows) {
        if (row.ce) quoteByKey.set(`${row.strike}|CE`, { ltp: row.ce.ltp, id: row.ce.id });
        if (row.pe) quoteByKey.set(`${row.strike}|PE`, { ltp: row.pe.ltp, id: row.pe.id });
      }
    }

    const bound: BoundLeg[] = [];
    let unboundCount = 0;

    for (const leg of params.legs) {
      if (leg.instrumentId) {
        const inst = await prisma.derivativeInstrument.findUnique({ where: { id: leg.instrumentId } });
        if (inst?.tradable) {
          const q = quoteByKey.get(`${inst.strike}|${inst.optionType || leg.optionType}`);
          bound.push({
            ...leg,
            instrumentId: inst.id,
            tradingSymbol: inst.tradingSymbol,
            instrumentToken: inst.instrumentToken,
            lotSize: inst.lotSize,
            freezeQty: inst.freezeQty,
            premium: leg.premium && leg.premium > 0 ? leg.premium : q?.ltp || leg.premium || 0,
            optionType: (inst.optionType as 'CE' | 'PE') || leg.optionType,
            strike: Number(inst.strike ?? leg.strike),
            bound: true
          });
          continue;
        }
      }

      // Nearest strike match on master for CE/PE
      const candidates = contracts.filter(
        (c) =>
          c.tradable &&
          c.instrumentType !== 'FUT' &&
          (c.optionType || c.instrumentType) === leg.optionType
      );
      if (!candidates.length) {
        unboundCount++;
        bound.push({
          ...leg,
          instrumentId: '',
          tradingSymbol: leg.tradingSymbol || '',
          instrumentToken: '',
          lotSize: leg.lotSize || u.lotSizeHint || 25,
          freezeQty: null,
          premium: leg.premium || 0,
          bound: false,
          bindNote: `No ${leg.optionType} contracts in master`
        });
        continue;
      }

      const nearest = candidates.reduce((best, c) =>
        Math.abs(Number(c.strike) - leg.strike) < Math.abs(Number(best.strike) - leg.strike) ? c : best
      );
      const q = quoteByKey.get(`${nearest.strike}|${leg.optionType}`);
      const strikeDelta = Math.abs(Number(nearest.strike) - leg.strike);
      bound.push({
        ...leg,
        instrumentId: nearest.id,
        tradingSymbol: nearest.tradingSymbol,
        instrumentToken: nearest.instrumentToken,
        lotSize: nearest.lotSize,
        freezeQty: nearest.freezeQty,
        strike: Number(nearest.strike),
        premium: leg.premium && leg.premium > 0 ? leg.premium : q?.ltp || leg.premium || 0,
        bound: true,
        bindNote: strikeDelta > 0 ? `Snapped strike ${leg.strike} → ${nearest.strike}` : undefined
      });
    }

    unboundCount = bound.filter((l) => !l.bound).length;

    const analyticsLegs: StrategyLegInput[] = bound.map((l) => ({
      side: l.side,
      optionType: l.optionType,
      strike: l.strike,
      premium: l.premium,
      lots: l.lots,
      lotSize: l.lotSize
    }));
    const analytics = analyzeStrategy(analyticsLegs, spot || undefined);
    const margin = await this.estimateMarginWithFunds(params.userId, analytics.marginEstimate, bound, spot);

    return {
      underlying,
      expiry: params.expiry,
      spot,
      legs: bound,
      unboundCount,
      analytics: { ...analytics, marginEstimate: margin.estimate },
      margin
    };
  }

  /** Improve margin: SPAN-ish heuristic + optional available funds from broker. */
  static async estimateMarginWithFunds(
    userId: string,
    baseEstimate: number,
    legs: BoundLeg[],
    spot: number
  ) {
    const shortNotional = legs
      .filter((l) => l.side === 'SELL')
      .reduce((s, l) => s + l.premium * l.lots * l.lotSize, 0);
    const longDebit = legs
      .filter((l) => l.side === 'BUY')
      .reduce((s, l) => s + l.premium * l.lots * l.lotSize, 0);

    // Index options rough SPAN proxy: short premium * 3 + 5% spot * lots * lotSize for naked risk
    const nakedShortLots = legs
      .filter((l) => l.side === 'SELL')
      .reduce((s, l) => s + l.lots, 0);
    const spanProxy =
      shortNotional * 2.5 +
      (spot > 0 ? spot * 0.03 * nakedShortLots * (legs[0]?.lotSize || 25) : 0) +
      longDebit * 0.1;
    const estimate = Number(Math.max(baseEstimate, spanProxy, longDebit).toFixed(2));

    let availableFunds: number | null = null;
    let fundsSource: string | null = null;
    try {
      // Read-only funds probe from broker connection (works even while desk is in PAPER).
      const target = await ExecutionTargetResolver.resolve(userId, { requireLive: true });
      if (target.direct) {
        const funds = await target.direct.getFunds();
        availableFunds = extractAvail(funds);
        fundsSource = 'dhan_direct';
      } else if (target.mcp) {
        const funds = await target.mcp.getFunds();
        availableFunds = extractAvail(funds);
        fundsSource = 'dhan_mcp';
      }
    } catch (err) {
      logger.warn(`Funds probe for margin skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      estimate,
      method: 'span_proxy_v1',
      availableFunds,
      fundsSource
    };
  }
}

function extractAvail(funds: unknown): number | null {
  if (!funds || typeof funds !== 'object') return null;
  const f = funds as Record<string, unknown>;
  const data = (f.data || f) as Record<string, unknown>;
  const candidates = [
    data.availabelBalance,
    data.availableBalance,
    data.sodLimit,
    data.collateralAmount,
    f.availabelBalance,
    f.availableBalance
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}
