import { randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { OrderExecutionService } from '../order-execution.service';
import { RiskGateService } from '../risk-gate.service';
import { applySlippage, estimateCharges } from './charges.service';

export type PaperLeg = {
  instrumentId: string;
  tradingSymbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  optionType: 'CE' | 'PE' | 'FUT';
  premium?: number;
  strategyId?: string;
  strategyTag?: string;
};

const DEFAULT_CAPITAL = Number(process.env.PAPER_DEFAULT_CAPITAL || 1_000_000);

export class PaperOptionsService {
  static async getOrCreateAccount(userId: string) {
    let acct = await prisma.paperAccount.findUnique({
      where: { userId_currency: { userId, currency: 'INR' } }
    });
    if (!acct) {
      acct = await prisma.paperAccount.create({
        data: { userId, cashBalance: DEFAULT_CAPITAL }
      });
      await prisma.paperLedgerEntry.create({
        data: {
          paperAccountId: acct.id,
          kind: 'TOPUP',
          amount: DEFAULT_CAPITAL,
          balanceAfter: DEFAULT_CAPITAL,
          note: 'Initial virtual capital'
        }
      });
    }
    return acct;
  }

  static async topUp(userId: string, amount: number) {
    if (!(amount > 0)) throw new AppError('Top-up amount must be positive', 400);
    const acct = await this.getOrCreateAccount(userId);
    const next = acct.cashBalance + amount;
    const updated = await prisma.paperAccount.update({
      where: { id: acct.id },
      data: { cashBalance: next }
    });
    await prisma.paperLedgerEntry.create({
      data: {
        paperAccountId: acct.id,
        kind: 'TOPUP',
        amount,
        balanceAfter: next,
        note: 'Virtual capital top-up'
      }
    });
    return updated;
  }

  static async reset(userId: string, capital = DEFAULT_CAPITAL) {
    const acct = await this.getOrCreateAccount(userId);
    const updated = await prisma.paperAccount.update({
      where: { id: acct.id },
      data: { cashBalance: capital, reservedMargin: 0, realizedPnl: 0 }
    });
    await prisma.paperLedgerEntry.create({
      data: {
        paperAccountId: acct.id,
        kind: 'RESET',
        amount: capital,
        balanceAfter: capital,
        note: 'Paper account reset'
      }
    });
    return updated;
  }

  static async preview(userId: string, legs: PaperLeg[]) {
    if (!legs?.length) throw new AppError('At least one leg required', 400);
    const acct = await this.getOrCreateAccount(userId);
    const previews = [];

    for (const leg of legs) {
      const inst = await prisma.derivativeInstrument.findUnique({ where: { id: leg.instrumentId } });
      if (!inst || !inst.tradable) {
        throw new AppError(`Instrument not tradable: ${leg.tradingSymbol || leg.instrumentId}`, 400, {
          reason: 'INSTRUMENT_NOT_TRADABLE',
          correctiveAction: 'Pick a tradable contract from the options chain / instrument master'
        });
      }
      if (inst.expiry.getTime() < Date.now() - 86400000) {
        throw new AppError('Contract expired', 400, {
          reason: 'EXPIRED_CONTRACT',
          correctiveAction: 'Select a future expiry'
        });
      }

      const qty = leg.lots * inst.lotSize;
      if (leg.lots <= 0) throw new AppError('Lots must be positive', 400);
      if (qty % inst.lotSize !== 0) {
        throw new AppError(`Quantity must be a multiple of lot size ${inst.lotSize}`, 400, {
          reason: 'INVALID_LOT_SIZE',
          correctiveAction: `Use whole lots of ${inst.lotSize} units`
        });
      }
      if (inst.freezeQty && qty > inst.freezeQty) {
        throw new AppError(`Quantity ${qty} exceeds freeze qty ${inst.freezeQty}`, 400, {
          reason: 'FREEZE_QTY',
          correctiveAction: `Reduce lots so total units ≤ ${inst.freezeQty}`
        });
      }

      const mid = leg.premium && leg.premium > 0 ? leg.premium : 1;
      const fill = applySlippage(mid, leg.side);
      const charges = estimateCharges({
        premium: fill,
        quantity: qty,
        side: leg.side,
        optionType: (inst.optionType as 'CE' | 'PE') || 'FUT'
      });
      const notional = fill * qty;

      await RiskGateService.preflightDerivatives({
        userId,
        isPaper: true,
        instrument: inst,
        side: leg.side,
        lots: leg.lots,
        quantity: qty,
        premium: fill
      });

      previews.push({
        instrumentId: inst.id,
        tradingSymbol: inst.tradingSymbol,
        lotSize: inst.lotSize,
        freezeQty: inst.freezeQty,
        lots: leg.lots,
        quantity: qty,
        side: leg.side,
        mid,
        fillPrice: fill,
        notional,
        charges,
        totalDebit: leg.side === 'BUY' ? notional + charges.total : charges.total,
        totalCredit: leg.side === 'SELL' ? notional - charges.total : 0
      });
    }

    const netDebit = previews.reduce((s, p) => s + p.totalDebit - p.totalCredit, 0);
    return {
      account: acct,
      legs: previews,
      netDebit: Number(netDebit.toFixed(2)),
      sufficientCapital: acct.cashBalance >= netDebit,
      isPaper: true,
      liveBrokerSubmit: false
    };
  }

  static async place(
    userId: string,
    legs: PaperLeg[],
    opts?: { strategyId?: string; strategyTag?: string }
  ) {
    const preview = await this.preview(userId, legs);
    if (!preview.sufficientCapital) {
      throw new AppError('Insufficient paper capital', 400, {
        reason: 'INSUFFICIENT_PAPER_CAPITAL',
        correctiveAction: 'Top up virtual capital or reduce size'
      });
    }

    const strategyId = opts?.strategyId || legs.find((l) => l.strategyId)?.strategyId;
    const strategyTag = opts?.strategyTag || legs.find((l) => l.strategyTag)?.strategyTag;

    const orders = [];
    for (const leg of preview.legs) {
      const inst = await prisma.derivativeInstrument.findUnique({ where: { id: leg.instrumentId } });
      const inputLeg = legs.find((l) => l.instrumentId === leg.instrumentId);
      // Always paper — never call live broker submit from this path
      const order = await OrderExecutionService.placeOrder({
        userId,
        symbol: leg.tradingSymbol,
        exchange: 'NFO',
        tradeType: leg.side,
        quantity: leg.quantity,
        orderType: 'MARKET',
        product: 'NRML',
        price: leg.fillPrice,
        instrumentType: 'OPTION',
        isPaper: true,
        idempotencyKey: `paper-opt-${randomUUID()}`,
        source: strategyId ? 'STRATEGY' : 'MANUAL',
        instrumentToken: inst?.instrumentToken,
        exchangeSegment: inst?.segment === 'BFO' ? 'BSE_FNO' : 'NSE_FNO',
        optionDetails: {
          strike: Number(inst?.strike || 0),
          expiry: inst?.expiry?.toISOString().slice(0, 10) || '',
          optionType: (inst?.optionType as 'CE' | 'PE') || 'CE',
          ...(strategyId || inputLeg?.strategyId
            ? { strategyId: strategyId || inputLeg?.strategyId }
            : {}),
          ...(strategyTag || inputLeg?.strategyTag
            ? { strategyTag: strategyTag || inputLeg?.strategyTag }
            : {})
        }
      });
      orders.push(order);
    }

    const acct = await this.getOrCreateAccount(userId);
    const nextBal = acct.cashBalance - preview.netDebit;
    await prisma.paperAccount.update({
      where: { id: acct.id },
      data: { cashBalance: nextBal }
    });
    await prisma.paperLedgerEntry.create({
      data: {
        paperAccountId: acct.id,
        kind: 'FILL',
        amount: -preview.netDebit,
        balanceAfter: nextBal,
        note: `Paper options fill (${orders.length} legs)`,
        meta: {
          orderIds: orders.map((o) => o.id),
          liveBrokerSubmit: false,
          ...(strategyId ? { strategyId } : {}),
          ...(strategyTag ? { strategyTag } : {})
        }
      }
    });

    return {
      orders,
      preview,
      account: await this.getOrCreateAccount(userId),
      liveBrokerSubmit: false,
      isPaper: true,
      strategyId: strategyId || null,
      strategyTag: strategyTag || null
    };
  }

  /** Realized + open MTM P&L grouped by strategy tag. */
  static async journalByStrategyTag(userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [positions, strategies, acct] = await Promise.all([
      prisma.derivativePosition.findMany({ where: { userId, isPaper: true } }),
      prisma.paperStrategy.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
      prisma.paperAccount.findUnique({
        where: { userId_currency: { userId, currency: 'INR' } },
        include: {
          ledger: {
            where: { kind: 'REALIZED' },
            orderBy: { createdAt: 'desc' },
            take: 500
          }
        }
      })
    ]);

    const orders = await prisma.order.findMany({
      where: { userId, instrumentType: 'OPTION' },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    type Bucket = {
      tag: string;
      strategyId: string | null;
      openMtm: number;
      realizedPnl: number;
      dayRealized: number;
      openLots: number;
      orderCount: number;
    };
    const buckets = new Map<string, Bucket>();

    const bump = (tag: string, patch: Partial<Bucket> & { strategyId?: string | null }) => {
      const key = tag || 'untagged';
      const cur = buckets.get(key) || {
        tag: key,
        strategyId: null,
        openMtm: 0,
        realizedPnl: 0,
        dayRealized: 0,
        openLots: 0,
        orderCount: 0
      };
      if (patch.strategyId) cur.strategyId = patch.strategyId;
      if (patch.openMtm) cur.openMtm += patch.openMtm;
      if (patch.realizedPnl) cur.realizedPnl += patch.realizedPnl;
      if (patch.dayRealized) cur.dayRealized += patch.dayRealized;
      if (patch.openLots) cur.openLots += patch.openLots;
      if (patch.orderCount) cur.orderCount += patch.orderCount;
      buckets.set(key, cur);
    };

    for (const p of positions) {
      const meta = (p.meta || {}) as { strategyTag?: string; strategyId?: string };
      const tag = meta.strategyTag || 'untagged';
      bump(tag, {
        strategyId: meta.strategyId || null,
        openMtm: p.mtm,
        openLots: Math.ceil(p.quantity / Math.max(p.lotSize || 1, 1))
      });
    }

    for (const entry of acct?.ledger || []) {
      const meta = (entry.meta || {}) as { strategyTag?: string; strategyId?: string };
      const tag = meta.strategyTag || 'untagged';
      bump(tag, {
        strategyId: meta.strategyId || null,
        realizedPnl: entry.amount,
        dayRealized: entry.createdAt >= start ? entry.amount : 0
      });
    }

    for (const o of orders) {
      const details = (o.optionDetails || {}) as { strategyTag?: string; strategyId?: string };
      const tag = details.strategyTag || 'untagged';
      bump(tag, { strategyId: details.strategyId || null, orderCount: 1 });
    }

    // Ensure saved strategies appear even with zero fills
    for (const s of strategies) {
      const meta = (s.meta || {}) as { strategyTag?: string; tags?: string[] };
      const tag = meta.strategyTag || meta.tags?.[0] || s.name;
      if (!buckets.has(tag) && !buckets.has(s.name)) {
        bump(tag, { strategyId: s.id });
      }
    }

    const rows = [...buckets.values()].sort(
      (a, b) => Math.abs(b.realizedPnl + b.openMtm) - Math.abs(a.realizedPnl + a.openMtm)
    );

    return {
      rows,
      totals: {
        openMtm: rows.reduce((s, r) => s + r.openMtm, 0),
        realizedPnl: rows.reduce((s, r) => s + r.realizedPnl, 0),
        dayRealized: rows.reduce((s, r) => s + r.dayRealized, 0)
      },
      accountRealizedPnl: acct?.realizedPnl ?? 0
    };
  }

  static async saveStrategy(userId: string, name: string, legs: PaperLeg[], meta?: object) {
    return prisma.paperStrategy.create({
      data: { userId, name, legs: legs as object[], meta: meta as object | undefined }
    });
  }

  static async listStrategies(userId: string) {
    return prisma.paperStrategy.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
  }
}
