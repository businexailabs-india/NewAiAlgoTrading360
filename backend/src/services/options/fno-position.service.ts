import { prisma } from '../../config/database';
import { OptionQuoteService } from './option-quote.service';
import { MarketService } from '../market.service';
import {
  blackScholesPrice,
  daysToExpiry,
  estimateIndexOptionIv,
  yearsToExpiry
} from './greeks.service';
import { FO_INDEX_CATALOG } from '../../libs/trading/fo-index-catalog';
import { logger } from '../../utils/logger';

/** Longest-first so BANKNIFTY wins over NIFTY. */
const UNDERLYING_PREFIXES = [...FO_INDEX_CATALOG.map((x) => x.symbol)].sort(
  (a, b) => b.length - a.length
);

function inferUnderlying(tradingSymbol: string): string | null {
  const s = tradingSymbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  for (const u of UNDERLYING_PREFIXES) {
    if (s.startsWith(u)) return u;
  }
  return null;
}

function parseOptionLeg(
  tradingSymbol: string,
  existing?: { strike?: number | null; optionType?: string | null }
): { underlying: string | null; strike: number | null; optionType: 'CE' | 'PE' | null } {
  const underlying = inferUnderlying(tradingSymbol);
  let strike = existing?.strike != null && Number.isFinite(existing.strike) ? Number(existing.strike) : null;
  let optionType =
    existing?.optionType === 'CE' || existing?.optionType === 'PE'
      ? existing.optionType
      : null;
  if (underlying && (strike == null || !optionType)) {
    const rest = tradingSymbol
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(underlying.length);
    const m = rest.match(/^(\d+)(CE|PE)$/);
    if (m) {
      strike = Number(m[1]);
      optionType = m[2] as 'CE' | 'PE';
    }
  }
  return { underlying, strike, optionType };
}

function modelOptionLtp(params: {
  spot: number;
  strike: number;
  optionType: 'CE' | 'PE';
  expiry: Date;
  indiaVix?: number | null;
}): number {
  const expYmd = params.expiry.toISOString().slice(0, 10);
  const dte = daysToExpiry(params.expiry);
  const iv = estimateIndexOptionIv(params.spot, params.strike, dte, params.optionType, {
    indiaVix: params.indiaVix
  });
  return blackScholesPrice({
    spot: params.spot,
    strike: params.strike,
    timeYears: yearsToExpiry(expYmd),
    ivPct: iv,
    optionType: params.optionType
  });
}

export type ApplyFillInput = {
  userId: string;
  tradingSymbol: string;
  tradeType: 'BUY' | 'SELL';
  quantity: number;
  fillPrice: number;
  isPaper: boolean;
  instrumentId?: string | null;
  instrumentToken?: string | null;
  exchange?: string;
  segment?: string;
  optionType?: string | null;
  strike?: number | null;
  expiry?: Date | string | null;
  lotSize?: number;
  product?: string;
  brokerConnectionId?: string | null;
  strategyId?: string | null;
  strategyTag?: string | null;
};

function toExpiry(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function recordRealized(userId: string, amount: number, meta: object, isPaper: boolean) {
  if (!isPaper || !(Math.abs(amount) > 0)) return;
  const acct = await prisma.paperAccount.findUnique({
    where: { userId_currency: { userId, currency: 'INR' } }
  });
  if (!acct) return;
  const nextPnl = acct.realizedPnl + amount;
  await prisma.paperAccount.update({
    where: { id: acct.id },
    data: { realizedPnl: Number(nextPnl.toFixed(2)) }
  });
  await prisma.paperLedgerEntry.create({
    data: {
      paperAccountId: acct.id,
      kind: 'REALIZED',
      amount: Number(amount.toFixed(2)),
      balanceAfter: acct.cashBalance,
      note: `Realized P&L ${amount >= 0 ? '+' : ''}${amount.toFixed(2)}`,
      meta: meta as object
    }
  });
}

/**
 * Persist open F&O positions and mark-to-market.
 */
export class FnoPositionService {
  static async applyFill(input: ApplyFillInput) {
    const product = input.product || 'NRML';
    const tagMeta = {
      ...(input.strategyId ? { strategyId: input.strategyId } : {}),
      ...(input.strategyTag ? { strategyTag: input.strategyTag } : {})
    };
    const key = {
      userId_tradingSymbol_isPaper_product: {
        userId: input.userId,
        tradingSymbol: input.tradingSymbol.toUpperCase(),
        isPaper: input.isPaper,
        product
      }
    };

    const existing = await prisma.derivativePosition.findUnique({ where: key });
    const qtySigned = input.tradeType === 'BUY' ? input.quantity : -input.quantity;

    if (!existing) {
      const side = qtySigned >= 0 ? 'LONG' : 'SHORT';
      return prisma.derivativePosition.create({
        data: {
          userId: input.userId,
          instrumentId: input.instrumentId || null,
          instrumentToken: input.instrumentToken || null,
          tradingSymbol: input.tradingSymbol.toUpperCase(),
          exchange: input.exchange || 'NFO',
          segment: input.segment || 'NFO',
          optionType: input.optionType || null,
          strike: input.strike ?? null,
          expiry: toExpiry(input.expiry),
          side,
          quantity: Math.abs(input.quantity),
          lotSize: input.lotSize || 1,
          avgPrice: input.fillPrice,
          lastPrice: input.fillPrice,
          mtm: 0,
          realizedPnl: 0,
          product,
          isPaper: input.isPaper,
          brokerConnectionId: input.brokerConnectionId || null,
          meta: Object.keys(tagMeta).length ? tagMeta : undefined
        }
      });
    }

    const prevMeta = (existing.meta as Record<string, unknown>) || {};
    const nextMeta = { ...prevMeta, ...tagMeta };

    // Netting
    const curSigned = existing.side === 'LONG' ? existing.quantity : -existing.quantity;
    const nextSigned = curSigned + qtySigned;

    if (nextSigned === 0) {
      const closePnl =
        existing.side === 'LONG'
          ? (input.fillPrice - existing.avgPrice) * existing.quantity
          : (existing.avgPrice - input.fillPrice) * existing.quantity;
      await prisma.derivativePosition.delete({ where: { id: existing.id } });
      await recordRealized(input.userId, closePnl, {
        ...nextMeta,
        tradingSymbol: existing.tradingSymbol,
        closed: true
      }, input.isPaper);
      return {
        closed: true,
        realizedPnl: Number(closePnl.toFixed(2)),
        tradingSymbol: existing.tradingSymbol,
        strategyTag: (nextMeta.strategyTag as string) || null
      };
    }

    // Same direction → average in; flip → reset avg on remainder
    const sameDirection = Math.sign(curSigned) === Math.sign(nextSigned);
    let avgPrice = existing.avgPrice;
    let realizedPnl = existing.realizedPnl;
    let realizedThisFill = 0;

    if (sameDirection) {
      const absCur = Math.abs(curSigned);
      const add = Math.abs(qtySigned);
      avgPrice = (existing.avgPrice * absCur + input.fillPrice * add) / (absCur + add);
    } else {
      // closing portion then open opposite
      const closeQty = Math.min(Math.abs(curSigned), Math.abs(qtySigned));
      const closePnl =
        curSigned > 0
          ? (input.fillPrice - existing.avgPrice) * closeQty
          : (existing.avgPrice - input.fillPrice) * closeQty;
      realizedPnl += closePnl;
      realizedThisFill = closePnl;
      avgPrice = input.fillPrice;
    }

    const side = nextSigned > 0 ? 'LONG' : 'SHORT';
    const quantity = Math.abs(nextSigned);
    const mtm =
      side === 'LONG'
        ? (input.fillPrice - avgPrice) * quantity
        : (avgPrice - input.fillPrice) * quantity;

    if (realizedThisFill !== 0) {
      await recordRealized(input.userId, realizedThisFill, {
        ...nextMeta,
        tradingSymbol: existing.tradingSymbol,
        partial: true
      }, input.isPaper);
    }

    return prisma.derivativePosition.update({
      where: { id: existing.id },
      data: {
        side,
        quantity,
        avgPrice: Number(avgPrice.toFixed(4)),
        lastPrice: input.fillPrice,
        mtm: Number(mtm.toFixed(2)),
        realizedPnl: Number(realizedPnl.toFixed(2)),
        instrumentId: input.instrumentId || existing.instrumentId,
        instrumentToken: input.instrumentToken || existing.instrumentToken,
        optionType: input.optionType || existing.optionType,
        strike: input.strike ?? existing.strike,
        expiry: toExpiry(input.expiry) || existing.expiry,
        meta: nextMeta
      }
    });
  }

  static async list(userId: string, isPaper?: boolean) {
    return prisma.derivativePosition.findMany({
      where: {
        userId,
        ...(isPaper !== undefined ? { isPaper } : {})
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  static async refreshMtm(userId: string, opts?: { isPaper?: boolean; underlying?: string }) {
    const positions = await this.list(userId, opts?.isPaper);
    if (!positions.length) {
      return {
        updated: 0,
        positions: [] as typeof positions,
        quoteSource: 'none' as const,
        brokerMarks: 0,
        modelMarks: 0
      };
    }

    const tokens = positions.map((p) => p.instrumentToken).filter(Boolean) as string[];
    const feed = await OptionQuoteService.fetchMarketfeedQuotes(tokens, userId);

    /** `${underlying}|${expiry}|${strike}|CE` → ltp */
    const byStrike = new Map<string, number>();

    const underlyings = [
      ...new Set(
        [
          opts?.underlying?.toUpperCase(),
          ...positions.map((p) => inferUnderlying(p.tradingSymbol))
        ].filter(Boolean) as string[]
      )
    ];

    for (const underlying of underlyings) {
      const expiries = [
        ...new Set(
          positions
            .filter((p) => !opts?.underlying || inferUnderlying(p.tradingSymbol) === underlying)
            .map((p) => (p.expiry ? p.expiry.toISOString().slice(0, 10) : null))
            .filter(Boolean) as string[]
        )
      ];
      for (const expiry of expiries.slice(0, 3)) {
        try {
          const overlay = await OptionQuoteService.fetchOverlay({
            underlying,
            expiry,
            userId
          });
          for (const [k, q] of overlay.byStrikeType) {
            if (q.ltp > 0) byStrike.set(`${underlying}|${expiry}|${k}`, q.ltp);
          }
          for (const [sid, q] of overlay.bySecurityId) {
            if (q.ltp > 0) feed.set(sid, { ltp: q.ltp, oi: q.oi, bid: q.bid, ask: q.ask });
          }
        } catch (err) {
          logger.warn(`MTM overlay failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    let indiaVix: number | null = null;
    try {
      const vixQ = await MarketService.getQuote('INDIAVIX', userId);
      if (vixQ.price > 0 && vixQ.price < 80) indiaVix = vixQ.price;
    } catch {
      /* optional */
    }

    const spotByUnderlying = new Map<string, number>();
    const loadSpot = async (u: string) => {
      if (spotByUnderlying.has(u)) return spotByUnderlying.get(u)!;
      try {
        const q = await MarketService.getQuote(u, userId);
        const px = q.price > 0 ? q.price : 0;
        spotByUnderlying.set(u, px);
        return px;
      } catch {
        spotByUnderlying.set(u, 0);
        return 0;
      }
    };

    let brokerMarks = 0;
    let modelMarks = 0;
    const updated = [];
    for (const pos of positions) {
      let last = 0;
      let source: 'broker' | 'model' | 'stale' = 'stale';

      if (pos.instrumentToken && feed.get(pos.instrumentToken)?.ltp) {
        last = feed.get(pos.instrumentToken)!.ltp;
        source = 'broker';
      }

      const und = inferUnderlying(pos.tradingSymbol);
      const expYmd = pos.expiry ? pos.expiry.toISOString().slice(0, 10) : null;
      const leg = parseOptionLeg(pos.tradingSymbol, {
        strike: pos.strike,
        optionType: pos.optionType
      });
      if (!(last > 0) && und && expYmd && leg.strike != null && leg.optionType) {
        const hit =
          byStrike.get(`${und}|${expYmd}|${leg.strike}|${leg.optionType}`) ||
          byStrike.get(`${und}|${expYmd}|${leg.strike}|${String(leg.optionType).toUpperCase()}`);
        if (hit && hit > 0) {
          last = hit;
          source = 'broker';
        }
      }

      // No Dhan LTP — mark options with BS model from live index spot (Yahoo/etc.)
      if (!(last > 0) && und && pos.expiry && leg.strike != null && leg.optionType) {
        const spot = await loadSpot(und);
        if (spot > 0) {
          last = modelOptionLtp({
            spot,
            strike: leg.strike,
            optionType: leg.optionType,
            expiry: pos.expiry,
            indiaVix
          });
          source = 'model';
        }
      }

      if (!(last > 0)) {
        last = pos.lastPrice;
        source = 'stale';
      }

      if (source === 'broker') brokerMarks++;
      else if (source === 'model') modelMarks++;

      if (!(last > 0)) {
        updated.push(pos);
        continue;
      }

      const mtm =
        pos.side === 'LONG'
          ? (last - pos.avgPrice) * pos.quantity
          : (pos.avgPrice - last) * pos.quantity;
      const prevMeta = (pos.meta as Record<string, unknown>) || {};
      const row = await prisma.derivativePosition.update({
        where: { id: pos.id },
        data: {
          lastPrice: last,
          mtm: Number(mtm.toFixed(2)),
          meta: { ...prevMeta, mtmSource: source, mtmAt: new Date().toISOString() }
        }
      });
      updated.push(row);
    }

    const quoteSource =
      brokerMarks > 0 ? ('broker' as const) : modelMarks > 0 ? ('model' as const) : ('stale' as const);

    return {
      updated: updated.length,
      positions: updated,
      quoteSource,
      brokerMarks,
      modelMarks
    };
  }
}
