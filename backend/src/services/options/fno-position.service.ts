import { prisma } from '../../config/database';
import { OptionQuoteService } from './option-quote.service';
import { logger } from '../../utils/logger';

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
    if (!positions.length) return { updated: 0, positions: [] as typeof positions };

    const tokens = positions.map((p) => p.instrumentToken).filter(Boolean) as string[];
    const feed = await OptionQuoteService.fetchMarketfeedQuotes(tokens, userId);

    // Also try optionchain overlay if underlying provided
    let byStrike = new Map<string, { ltp: number }>();
    if (opts?.underlying) {
      const expiries = [
        ...new Set(
          positions
            .map((p) => (p.expiry ? p.expiry.toISOString().slice(0, 10) : null))
            .filter(Boolean) as string[]
        )
      ];
      for (const expiry of expiries.slice(0, 2)) {
        try {
          const overlay = await OptionQuoteService.fetchOverlay({
            underlying: opts.underlying,
            expiry,
            userId
          });
          for (const [k, q] of overlay.byStrikeType) {
            byStrike.set(k, { ltp: q.ltp });
          }
          for (const [sid, q] of overlay.bySecurityId) {
            feed.set(sid, { ltp: q.ltp, oi: q.oi, bid: q.bid, ask: q.ask });
          }
        } catch (err) {
          logger.warn(`MTM overlay failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    const updated = [];
    for (const pos of positions) {
      let last = pos.lastPrice;
      if (pos.instrumentToken && feed.get(pos.instrumentToken)?.ltp) {
        last = feed.get(pos.instrumentToken)!.ltp;
      } else if (pos.strike != null && pos.optionType) {
        const hit = byStrike.get(`${pos.strike}|${pos.optionType}`);
        if (hit?.ltp) last = hit.ltp;
      }
      if (!(last > 0)) {
        updated.push(pos);
        continue;
      }
      const mtm =
        pos.side === 'LONG'
          ? (last - pos.avgPrice) * pos.quantity
          : (pos.avgPrice - last) * pos.quantity;
      const row = await prisma.derivativePosition.update({
        where: { id: pos.id },
        data: { lastPrice: last, mtm: Number(mtm.toFixed(2)) }
      });
      updated.push(row);
    }

    return { updated: updated.length, positions: updated };
  }
}
