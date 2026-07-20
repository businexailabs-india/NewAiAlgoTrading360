import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { MarketService, type Quote } from './market.service';

const DEFAULT_NAME = 'NSE Focus';
const DEFAULT_SYMBOLS: Array<{ symbol: string; exchange: string }> = [
  { symbol: 'RELIANCE', exchange: 'NSE' },
  { symbol: 'TCS', exchange: 'NSE' },
  { symbol: 'INFY', exchange: 'NSE' },
  { symbol: 'HDFCBANK', exchange: 'NSE' },
  { symbol: 'ICICIBANK', exchange: 'NSE' },
  { symbol: 'SBIN', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', exchange: 'NSE' },
  { symbol: 'ITC', exchange: 'NSE' },
  { symbol: 'LT', exchange: 'NSE' },
  { symbol: 'AXISBANK', exchange: 'NSE' }
];

type QuoteFields = {
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  buyers?: number;
  sellers?: number;
  quoteAsOf?: string;
  quoteSource?: string;
};

async function quotesBySymbol(symbols: string[]): Promise<Map<string, Quote>> {
  const map = new Map<string, Quote>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const q = await MarketService.getQuote(symbol);
        if (q) map.set(symbol, q);
      } catch {
        /* leave missing — UI shows — */
      }
    })
  );
  return map;
}

function serialize(
  list: {
    id: string;
    name: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      symbol: string;
      exchange: string;
      notes: string | null;
      sortOrder: number;
      createdAt: Date;
    }>;
  },
  quoteMap?: Map<string, Quote>
) {
  return {
    id: list.id,
    name: list.name,
    isDefault: list.isDefault,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
    items: list.items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.symbol.localeCompare(b.symbol))
      .map((i) => {
        const q = quoteMap?.get(i.symbol.toUpperCase());
        const quote: QuoteFields = q
          ? {
              name: q.name,
              price: q.price,
              change: q.change,
              changePercent: q.changePercent,
              open: q.open,
              high: q.high,
              low: q.low,
              previousClose: q.previousClose,
              volume: q.volume,
              bid: q.bid,
              ask: q.ask,
              buyers: q.buyers,
              sellers: q.sellers,
              quoteAsOf: q.asOf || q.timestamp,
              quoteSource: q.source
            }
          : {};
        return {
          id: i.id,
          symbol: i.symbol,
          exchange: i.exchange,
          notes: i.notes,
          sortOrder: i.sortOrder,
          createdAt: i.createdAt,
          ...quote
        };
      })
  };
}

export class WatchlistService {
  static async ensureDefault(userId: string) {
    const existing = await prisma.watchlist.findFirst({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: 'asc' }
    });
    if (existing) return existing;

    return prisma.watchlist.create({
      data: {
        userId,
        name: DEFAULT_NAME,
        isDefault: true,
        items: {
          create: DEFAULT_SYMBOLS.map((s, idx) => ({
            symbol: s.symbol,
            exchange: s.exchange,
            sortOrder: idx
          }))
        }
      },
      include: { items: true }
    });
  }

  static async list(userId: string) {
    await this.ensureDefault(userId);
    const rows = await prisma.watchlist.findMany({
      where: { userId },
      include: { items: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
    const allSymbols = rows.flatMap((r) => r.items.map((i) => i.symbol));
    const quoteMap = await quotesBySymbol(allSymbols);
    return rows.map((r) => serialize(r, quoteMap));
  }

  static async get(userId: string, watchlistId: string) {
    const row = await prisma.watchlist.findFirst({
      where: { id: watchlistId, userId },
      include: { items: true }
    });
    if (!row) throw new AppError('Watchlist not found', 404);
    const quoteMap = await quotesBySymbol(row.items.map((i) => i.symbol));
    return serialize(row, quoteMap);
  }

  static async create(userId: string, name: string, symbols?: string[]) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new AppError('Watchlist name is required', 400);

    const unique = [...new Set((symbols || []).map((s) => s.trim().toUpperCase()).filter(Boolean))];
    try {
      const row = await prisma.watchlist.create({
        data: {
          userId,
          name: trimmed,
          isDefault: false,
          items: {
            create: unique.map((symbol, idx) => ({
              symbol,
              exchange: 'NSE',
              sortOrder: idx
            }))
          }
        },
        include: { items: true }
      });
      const quoteMap = await quotesBySymbol(row.items.map((i) => i.symbol));
      return serialize(row, quoteMap);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') throw new AppError('A watchlist with this name already exists', 409);
      throw err;
    }
  }

  static async rename(userId: string, watchlistId: string, name: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new AppError('Watchlist name is required', 400);
    await this.get(userId, watchlistId);
    try {
      const row = await prisma.watchlist.update({
        where: { id: watchlistId },
        data: { name: trimmed },
        include: { items: true }
      });
      const quoteMap = await quotesBySymbol(row.items.map((i) => i.symbol));
      return serialize(row, quoteMap);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') throw new AppError('A watchlist with this name already exists', 409);
      throw err;
    }
  }

  static async remove(userId: string, watchlistId: string) {
    const row = await prisma.watchlist.findFirst({ where: { id: watchlistId, userId } });
    if (!row) throw new AppError('Watchlist not found', 404);
    if (row.isDefault) throw new AppError('Cannot delete the default watchlist', 400);
    await prisma.watchlist.delete({ where: { id: watchlistId } });
    return { deleted: true };
  }

  static async addSymbol(
    userId: string,
    watchlistId: string,
    symbol: string,
    exchange = 'NSE',
    notes?: string
  ) {
    await this.get(userId, watchlistId);
    const sym = symbol.trim().toUpperCase();
    if (!sym) throw new AppError('Symbol is required', 400);
    const ex = (exchange || 'NSE').trim().toUpperCase();

    const maxOrder = await prisma.watchlistItem.aggregate({
      where: { watchlistId },
      _max: { sortOrder: true }
    });

    try {
      await prisma.watchlistItem.create({
        data: {
          watchlistId,
          symbol: sym,
          exchange: ex,
          notes: notes || null,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1
        }
      });
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') throw new AppError(`${sym} is already on this watchlist`, 409);
      throw err;
    }

    await prisma.watchlist.update({
      where: { id: watchlistId },
      data: { updatedAt: new Date() }
    });
    return this.get(userId, watchlistId);
  }

  static async removeSymbol(userId: string, watchlistId: string, itemId: string) {
    await this.get(userId, watchlistId);
    const item = await prisma.watchlistItem.findFirst({
      where: { id: itemId, watchlistId }
    });
    if (!item) throw new AppError('Watchlist item not found', 404);
    await prisma.watchlistItem.delete({ where: { id: itemId } });
    return this.get(userId, watchlistId);
  }

  /** Convenience: add symbol to default watchlist (creates default if needed). */
  static async addToDefault(userId: string, symbol: string, exchange = 'NSE') {
    const list = await this.ensureDefault(userId);
    return this.addSymbol(userId, list.id, symbol, exchange);
  }
}
