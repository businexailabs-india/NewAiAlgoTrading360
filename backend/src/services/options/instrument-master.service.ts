import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { logger } from '../../utils/logger';
import { DhanInstrumentAdapter } from '../brokers/adapters/dhan.instrument.adapter';
import {
  BrokerInstrumentAdapter,
  NotConfiguredInstrumentAdapter
} from '../brokers/adapters/instrument-adapter';

const adapters: Record<string, BrokerInstrumentAdapter> = {
  dhan: new DhanInstrumentAdapter(),
  zerodha: new NotConfiguredInstrumentAdapter('zerodha'),
  upstox: new NotConfiguredInstrumentAdapter('upstox'),
  angel: new NotConfiguredInstrumentAdapter('angel'),
  fyers: new NotConfiguredInstrumentAdapter('fyers')
};

export class InstrumentMasterService {
  static getAdapter(brokerSource = 'dhan'): BrokerInstrumentAdapter {
    return adapters[brokerSource] || new NotConfiguredInstrumentAdapter(brokerSource);
  }

  static async sync(brokerSource = 'dhan') {
    const adapter = this.getAdapter(brokerSource);
    if (!adapter.configured) {
      throw new AppError(`${brokerSource} instrument adapter is not configured`, 400);
    }

    const run = await prisma.instrumentSyncRun.create({
      data: { brokerSource, status: 'RUNNING' }
    });

    try {
      const rows = await adapter.fetchDerivativeInstruments();
      if (!rows.length) {
        throw new AppError('Instrument sync returned zero F&O rows — refusing empty master', 502);
      }

      // Hard guard: sync must not invent a fixed strike ladder
      const uniqueStrikes = new Set(rows.filter((r) => r.strike != null).map((r) => r.strike));
      if (uniqueStrikes.size < 3 && rows.some((r) => r.optionType)) {
        logger.warn('Instrument sync produced very few unique strikes — check master feed');
      }

      let underlyingsUpserted = 0;
      let instrumentsUpserted = 0;
      const underlyingCache = new Map<string, string>();

      for (const row of rows) {
        const ukey = `${row.underlying}|${row.exchange}|${row.segment}`;
        let underlyingId = underlyingCache.get(ukey);
        if (!underlyingId) {
          const u = await prisma.derivativeUnderlying.upsert({
            where: {
              symbol_exchange_segment: {
                symbol: row.underlying,
                exchange: row.exchange,
                segment: row.segment
              }
            },
            create: {
              symbol: row.underlying,
              exchange: row.exchange,
              segment: row.segment,
              name: row.name || row.underlying,
              instrumentKind: row.instrumentKind,
              lotSizeHint: row.lotSize,
              tickSize: row.tickSize,
              brokerSource,
              tradable: true,
              syncedAt: new Date()
            },
            update: {
              name: row.name || row.underlying,
              instrumentKind: row.instrumentKind,
              lotSizeHint: row.lotSize,
              tickSize: row.tickSize,
              brokerSource,
              tradable: true,
              syncedAt: new Date()
            }
          });
          underlyingId = u.id;
          underlyingCache.set(ukey, underlyingId);
          underlyingsUpserted++;
        }

        await prisma.derivativeInstrument.upsert({
          where: {
            brokerSource_instrumentToken: {
              brokerSource,
              instrumentToken: row.instrumentToken
            }
          },
          create: {
            underlyingId,
            exchange: row.exchange,
            segment: row.segment,
            tradingSymbol: row.tradingSymbol,
            instrumentToken: row.instrumentToken,
            instrumentType: row.instrumentType,
            optionType: row.optionType,
            strike: row.strike,
            expiry: row.expiry,
            lotSize: row.lotSize,
            freezeQty: row.freezeQty,
            tickSize: row.tickSize,
            tradable: true,
            brokerSource,
            rawMeta: row.rawMeta as object | undefined,
            syncedAt: new Date()
          },
          update: {
            underlyingId,
            tradingSymbol: row.tradingSymbol,
            instrumentType: row.instrumentType,
            optionType: row.optionType,
            strike: row.strike,
            expiry: row.expiry,
            lotSize: row.lotSize,
            freezeQty: row.freezeQty,
            tickSize: row.tickSize,
            tradable: true,
            rawMeta: row.rawMeta as object | undefined,
            syncedAt: new Date()
          }
        });
        instrumentsUpserted++;
      }

      await prisma.instrumentSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCESS',
          underlyingsUpserted,
          instrumentsUpserted,
          finishedAt: new Date(),
          meta: { uniqueStrikes: uniqueStrikes.size, rowCount: rows.length }
        }
      });

      return {
        runId: run.id,
        underlyingsUpserted,
        instrumentsUpserted,
        uniqueStrikes: uniqueStrikes.size
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.instrumentSyncRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', errorMessage: message, finishedAt: new Date() }
      });
      throw err instanceof AppError ? err : new AppError(message, 502);
    }
  }

  static async listUnderlyings(opts?: { segment?: string }) {
    return prisma.derivativeUnderlying.findMany({
      where: {
        tradable: true,
        ...(opts?.segment ? { segment: opts.segment } : {})
      },
      orderBy: { symbol: 'asc' },
      select: {
        id: true,
        symbol: true,
        exchange: true,
        segment: true,
        name: true,
        instrumentKind: true,
        lotSizeHint: true,
        syncedAt: true,
        brokerSource: true
      }
    });
  }

  static async listExpiries(underlying: string, segment?: string) {
    const u = await prisma.derivativeUnderlying.findFirst({
      where: {
        symbol: underlying.toUpperCase(),
        tradable: true,
        ...(segment ? { segment } : {})
      }
    });
    if (!u) return [] as string[];

    const rows = await prisma.derivativeInstrument.findMany({
      where: { underlyingId: u.id, tradable: true, expiry: { gte: new Date(Date.now() - 86400000) } },
      select: { expiry: true },
      distinct: ['expiry'],
      orderBy: { expiry: 'asc' }
    });
    return rows.map((r) => r.expiry.toISOString().slice(0, 10));
  }

  /** Master expiries when present; otherwise paper weekly+monthly calendar. */
  static async listExpiryCalendar(underlying: string, segment?: string) {
    const { generateFoExpiryCalendar, classifyExpiryDates, filterExpiriesByKind } = await import(
      '../../libs/trading/fo-expiry-calendar'
    );
    const { getFoIndex, hasWeeklyExpiries, isMonthlyOnlyUnderlying } = await import(
      '../../libs/trading/fo-index-catalog'
    );
    const sym = underlying.toUpperCase();
    const masterDates = await this.listExpiries(sym, segment);
    const calendar =
      masterDates.length > 0
        ? classifyExpiryDates(sym, masterDates)
        : generateFoExpiryCalendar(sym, { weeks: 26, months: 8 });
    const meta = getFoIndex(sym);
    const monthlyOnly = isMonthlyOnlyUnderlying(sym);
    return {
      underlying: sym,
      expiries: calendar.map((e) => e.date),
      calendar,
      weekly: filterExpiriesByKind(calendar, 'WEEKLY'),
      monthly: filterExpiriesByKind(calendar, 'MONTHLY'),
      has_weekly: hasWeeklyExpiries(sym),
      monthly_only: monthlyOnly,
      expiry_mode: meta?.expiryMode || (monthlyOnly ? 'MONTHLY_ONLY' : 'WEEKLY_AND_MONTHLY'),
      source: masterDates.length > 0 ? ('instrument_master' as const) : ('paper_calendar' as const)
    };
  }

  static async getContracts(underlying: string, expiry: string, segment?: string) {
    const u = await prisma.derivativeUnderlying.findFirst({
      where: {
        symbol: underlying.toUpperCase(),
        tradable: true,
        ...(segment ? { segment } : {})
      }
    });
    if (!u) return { underlying: null, contracts: [] as Awaited<ReturnType<typeof prisma.derivativeInstrument.findMany>> };

    const dayStart = new Date(expiry + 'T00:00:00.000Z');
    const dayEnd = new Date(expiry + 'T23:59:59.999Z');

    const contracts = await prisma.derivativeInstrument.findMany({
      where: {
        underlyingId: u.id,
        tradable: true,
        expiry: { gte: dayStart, lte: dayEnd }
      },
      orderBy: [{ strike: 'asc' }, { optionType: 'asc' }]
    });

    return { underlying: u, contracts };
  }

  /** Upcoming index/stock futures for an underlying (from Dhan master FUTIDX/FUTSTK). */
  static async listFutures(underlying: string, segment?: string) {
    const u = await prisma.derivativeUnderlying.findFirst({
      where: {
        symbol: underlying.toUpperCase(),
        tradable: true,
        ...(segment ? { segment } : {})
      }
    });
    if (!u) return { underlying: underlying.toUpperCase(), futures: [] as Awaited<ReturnType<typeof prisma.derivativeInstrument.findMany>> };

    const futures = await prisma.derivativeInstrument.findMany({
      where: {
        underlyingId: u.id,
        tradable: true,
        instrumentType: 'FUT',
        expiry: { gte: new Date(Date.now() - 86400000) }
      },
      orderBy: { expiry: 'asc' }
    });
    return { underlying: u.symbol, futures };
  }
}
