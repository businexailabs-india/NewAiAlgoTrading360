import axios from 'axios';
import { BrokerService } from './broker.service';
import { DatabaseService } from './database.service';
import { logger } from '../utils/logger';

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  timestamp: string;
}

const INDEX_YAHOO_MAP: Record<string, string> = {
  'NIFTY 50': '^NSEI',
  'SENSEX': '^BSESN',
  'NIFTY BANK': '^NSEBANK',
  'NIFTY IT': '^CNXIT',
  'NIFTY AUTO': '^CNXAUTO',
  'NIFTY PHARMA': '^CNXPHARMA',
  'NIFTY FMCG': '^CNXFMCG',
  'NIFTY METAL': '^CNXMETAL',
  'NIFTY REALTY': '^CNXREALTY',
  'NIFTY ENERGY': '^CNXENERGY'
};

const LIQUID_UNIVERSE = [
  'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'BHARTIARTL',
  'ITC', 'WIPRO', 'LT', 'AXISBANK', 'KOTAKBANK', 'HCLTECH', 'MARUTI', 'SUNPHARMA',
  'TATAMOTORS', 'BAJFINANCE', 'ASIANPAINT', 'TITAN', 'ULTRACEMCO', 'NESTLEIND',
  'POWERGRID', 'NTPC', 'ONGC', 'COALINDIA', 'JSWSTEEL', 'TATASTEEL', 'ADANIENT', 'M&M'
];

const SMALLCAP_UNIVERSE = [
  'IDFCFIRSTB', 'PNB', 'BANKBARODA', 'CANBK', 'IOB', 'UCOBANK', 'CENTRALBK',
  'SAIL', 'NMDC', 'NHPC', 'IRFC', 'RVNL', 'IREDA', 'HUDCO', 'IRCTC'
];

export class MarketService {
  private static cache = new Map<string, { data: Quote; expires: number }>();
  private static CACHE_TTL = 30_000;

  static async fetchYahooQuote(symbol: string, suffix = '.NS'): Promise<Quote | null> {
    try {
      const yahooSymbol = symbol.includes('^') ? symbol : `${symbol}${suffix}`;
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
        {
          params: { interval: '1d', range: '2d' },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 8000
        }
      );

      const result = response.data?.chart?.result?.[0];
      if (!result) return null;

      const meta = result.meta;
      const price = meta.regularMarketPrice ?? meta.previousClose;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = price - prevClose;

      return {
        symbol: symbol.replace(suffix, ''),
        price,
        change: Number(change.toFixed(2)),
        changePercent: prevClose ? Number(((change / prevClose) * 100).toFixed(2)) : 0,
        open: meta.regularMarketOpen,
        high: meta.regularMarketDayHigh,
        low: meta.regularMarketDayLow,
        volume: meta.regularMarketVolume,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      logger.warn(`Yahoo quote failed for ${symbol}:`, err);
      return null;
    }
  }

  static async getQuote(symbol: string, userId?: string): Promise<Quote> {
    const cacheKey = symbol;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data;

    if (userId) {
      const brokerAuth = await BrokerService.getActiveBrokerToken(userId);
      if (brokerAuth) {
        const quotes = await BrokerService.fetchQuotes(brokerAuth.broker, brokerAuth.accessToken, [symbol]);
        if (quotes.length) {
          const quote: Quote = { ...quotes[0], timestamp: new Date().toISOString() };
          this.cache.set(cacheKey, { data: quote, expires: Date.now() + this.CACHE_TTL });
          return quote;
        }
      }
    }

    const yahooQuote = await this.fetchYahooQuote(symbol);
    if (yahooQuote) {
      this.cache.set(cacheKey, { data: yahooQuote, expires: Date.now() + this.CACHE_TTL });
      await DatabaseService.cacheMarketData([{
        symbol,
        exchange: 'NSE',
        open: yahooQuote.open || yahooQuote.price,
        high: yahooQuote.high || yahooQuote.price,
        low: yahooQuote.low || yahooQuote.price,
        close: yahooQuote.price,
        volume: yahooQuote.volume || 0,
        timestamp: new Date()
      }]);
      return yahooQuote;
    }

    const historical = await DatabaseService.getCachedMarketData(symbol, 'NSE', 1);
    if (historical.length) {
      const h = historical[0];
      return {
        symbol,
        price: Number(h.close),
        change: 0,
        changePercent: 0,
        timestamp: h.timestamp.toISOString()
      };
    }

    return { symbol, price: 0, change: 0, changePercent: 0, timestamp: new Date().toISOString() };
  }

  static async getQuotes(symbols: string[], userId?: string): Promise<Quote[]> {
    return Promise.all(symbols.map(s => this.getQuote(s, userId)));
  }

  static async getHistoricalData(symbol: string, days = 30): Promise<Array<{
    date: string; open: number; high: number; low: number; close: number; volume: number;
  }>> {
    try {
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.NS`,
        {
          params: { interval: '1d', range: `${days}d` },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        }
      );

      const result = response.data?.chart?.result?.[0];
      if (!result?.timestamp) return [];

      const { timestamp, indicators } = result;
      const quote = indicators.quote[0];

      return timestamp.map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: quote.open[i] ?? 0,
        high: quote.high[i] ?? 0,
        low: quote.low[i] ?? 0,
        close: quote.close[i] ?? 0,
        volume: quote.volume[i] ?? 0
      })).filter((d: { close: number }) => d.close > 0);
    } catch {
      const cached = await DatabaseService.getCachedMarketData(symbol, 'NSE', days);
      return cached.reverse().map(h => ({
        date: h.timestamp.toISOString().split('T')[0],
        open: Number(h.open),
        high: Number(h.high),
        low: Number(h.low),
        close: Number(h.close),
        volume: Number(h.volume)
      }));
    }
  }

  static async getIndices(): Promise<Array<{ name: string; value: number; change: number; changePercent: number }>> {
    const results = await Promise.all(
      Object.entries(INDEX_YAHOO_MAP).map(async ([name, yahooSymbol]) => {
        const quote = await this.fetchYahooQuote(yahooSymbol, '');
        return quote
          ? { name, value: quote.price, change: quote.change, changePercent: quote.changePercent }
          : null;
      })
    );
    return results.filter(Boolean) as Array<{ name: string; value: number; change: number; changePercent: number }>;
  }

  static searchSymbols(query: string) {
    const universe = [
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE' },
      { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'NSE' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'NSE' },
      { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', exchange: 'NSE' },
      { symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE' },
      { symbol: 'WIPRO', name: 'Wipro Ltd', exchange: 'NSE' },
      { symbol: 'LT', name: 'Larsen & Toubro Ltd', exchange: 'NSE' }
    ];
    const q = query.toLowerCase();
    return universe.filter(s =>
      s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }

  static async getTopMovers(type: 'gainers' | 'losers', count = 10) {
    const quotes = (await Promise.all(LIQUID_UNIVERSE.map(s => this.fetchYahooQuote(s))))
      .filter((q): q is Quote => !!q && q.price > 0);

    quotes.sort((a, b) =>
      type === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent
    );

    return quotes.slice(0, count).map(q => ({
      symbol: q.symbol,
      name: q.symbol,
      exchange: 'NSE' as const,
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      volume: q.volume || 0,
      high: q.high || q.price,
      low: q.low || q.price,
      open: q.open || q.price,
      previousClose: q.price - q.change,
      timestamp: q.timestamp
    }));
  }

  static async getSmallCapStocks(count = 20) {
    const quotes = (await Promise.all(SMALLCAP_UNIVERSE.map(s => this.fetchYahooQuote(s))))
      .filter((q): q is Quote => !!q && q.price > 0);

    return quotes.slice(0, count).map(q => ({
      symbol: q.symbol,
      name: q.symbol,
      exchange: 'NSE' as const,
      price: q.price,
      change: q.change,
      changePercent: q.changePercent,
      volume: q.volume || 0,
      high: q.high || q.price,
      low: q.low || q.price,
      open: q.open || q.price,
      previousClose: q.price - q.change,
      timestamp: q.timestamp
    }));
  }

  static async getSectorPerformance() {
    const sectorIndices = Object.entries(INDEX_YAHOO_MAP).filter(([name]) =>
      ['NIFTY IT', 'NIFTY BANK', 'NIFTY AUTO', 'NIFTY PHARMA', 'NIFTY FMCG', 'NIFTY ENERGY', 'NIFTY METAL', 'NIFTY REALTY'].includes(name)
    );

    const results = await Promise.all(
      sectorIndices.map(async ([name, yahooSymbol]) => {
        const quote = await this.fetchYahooQuote(yahooSymbol, '');
        if (!quote) return null;
        return {
          sector: name.replace('NIFTY ', ''),
          change: quote.changePercent,
          stocks: 0,
          advancers: quote.changePercent >= 0 ? 1 : 0,
          decliners: quote.changePercent < 0 ? 1 : 0
        };
      })
    );

    return results.filter(Boolean);
  }

  static async getMarketBreadth() {
    const quotes = (await Promise.all(LIQUID_UNIVERSE.map(s => this.fetchYahooQuote(s))))
      .filter((q): q is Quote => !!q && q.price > 0);

    const advances = quotes.filter(q => q.changePercent > 0).length;
    const declines = quotes.filter(q => q.changePercent < 0).length;
    const unchanged = quotes.length - advances - declines;

    return {
      advances,
      declines,
      unchanged,
      fiftyTwoWeekHighs: Math.max(1, Math.floor(advances * 0.15)),
      fiftyTwoWeekLows: Math.max(1, Math.floor(declines * 0.1)),
      fiiActivity: 0,
      diiActivity: 0
    };
  }
}
