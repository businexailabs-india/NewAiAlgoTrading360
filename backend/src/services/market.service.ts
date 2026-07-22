import axios from 'axios';
import { BrokerService } from './broker.service';
import { DatabaseService } from './database.service';
import { DhanService } from './dhan.service';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export interface Quote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  /** Best bid / ask */
  bid?: number;
  ask?: number;
  /** Approximate buy-side / sell-side interest (bid/ask size when available) */
  buyers?: number;
  sellers?: number;
  timestamp: string;
  /** When the price observation was actually recorded */
  asOf?: string;
  /** True when serving cached/historical data rather than a live provider quote */
  stale?: boolean;
  source?: 'broker' | 'dhan' | 'yahoo' | 'cache';
  available?: boolean;
}

export interface HistoricalSeries {
  bars: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  source: 'yahoo' | 'cache' | 'empty';
  stale: boolean;
  asOf: string | null;
}

const INDEX_YAHOO_MAP: Record<string, string> = {
  'NIFTY 50': '^NSEI',
  NIFTY: '^NSEI',
  NIFTY50: '^NSEI',
  SENSEX: '^BSESN',
  'NIFTY BANK': '^NSEBANK',
  BANKNIFTY: '^NSEBANK',
  FINNIFTY: 'NIFTY_FIN_SERVICE.NS',
  MIDCPNIFTY: 'NIFTY_MID_SELECT.NS',
  BANKEX: 'BSE-BANK.BO',
  INDIAVIX: '^INDIAVIX',
  'NIFTY IT': '^CNXIT',
  NIFTYIT: '^CNXIT',
  'NIFTY AUTO': '^CNXAUTO',
  NIFTYAUTO: '^CNXAUTO',
  'NIFTY PHARMA': '^CNXPHARMA',
  NIFTYPHARMA: '^CNXPHARMA',
  'NIFTY FMCG': '^CNXFMCG',
  NIFTYFMCG: '^CNXFMCG',
  'NIFTY METAL': '^CNXMETAL',
  NIFTYMETAL: '^CNXMETAL',
  'NIFTY REALTY': '^CNXREALTY',
  NIFTYREALTY: '^CNXREALTY',
  'NIFTY ENERGY': '^CNXENERGY',
  NIFTYENERGY: '^CNXENERGY'
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

/** NSE symbols that Yahoo Finance renamed / remapped after corporate actions */
const YAHOO_SYMBOL_ALIASES: Record<string, string> = {
  TATAMOTORS: 'TMCV'
};

export class MarketService {
  private static cache = new Map<string, { data: Quote; expires: number }>();
  private static CACHE_TTL = 30_000;
  private static yahooWarnAt = new Map<string, number>();

  private static assertValidQuote(quote: Quote | null, symbol: string): Quote {
    if (!quote || !(quote.price > 0)) {
      throw new AppError(`Market quote unavailable for ${symbol}`, 503);
    }
    return quote;
  }

  static async fetchYahooQuote(symbol: string, suffix = '.NS'): Promise<Quote | null> {
    try {
      const raw = (symbol || '').trim().toUpperCase();
      const indexTicker = INDEX_YAHOO_MAP[raw] || INDEX_YAHOO_MAP[symbol];
      const lookup = indexTicker || YAHOO_SYMBOL_ALIASES[raw] || YAHOO_SYMBOL_ALIASES[symbol] || symbol;
      // Index tickers may already include .NS/.BO or ^ — do not append equity suffix
      const yahooSymbol =
        indexTicker || lookup.includes('^') || /\.(NS|BO)$/i.test(lookup)
          ? lookup
          : `${lookup}${suffix}`;
      const headers = { 'User-Agent': 'Mozilla/5.0' };
      const asOf = new Date().toISOString();

      // Prefer quote endpoint — includes bid/ask sizes for buyers/sellers columns
      try {
        const quoteResp = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', {
          params: { symbols: yahooSymbol },
          headers,
          timeout: 8000
        });
        const q = quoteResp.data?.quoteResponse?.result?.[0];
        if (q && (q.regularMarketPrice > 0 || q.regularMarketPreviousClose > 0)) {
          const price = Number(q.regularMarketPrice ?? q.regularMarketPreviousClose);
          const prevClose = Number(q.regularMarketPreviousClose ?? price);
          const change = price - prevClose;
          const bidSize = Number(q.bidSize ?? 0);
          const askSize = Number(q.askSize ?? 0);
          return {
            symbol: symbol.replace(suffix, ''),
            name: q.shortName || q.longName || symbol,
            price,
            change: Number(change.toFixed(2)),
            changePercent: prevClose ? Number(((change / prevClose) * 100).toFixed(2)) : 0,
            open: q.regularMarketOpen != null ? Number(q.regularMarketOpen) : undefined,
            high: q.regularMarketDayHigh != null ? Number(q.regularMarketDayHigh) : undefined,
            low: q.regularMarketDayLow != null ? Number(q.regularMarketDayLow) : undefined,
            previousClose: prevClose,
            volume: q.regularMarketVolume != null ? Number(q.regularMarketVolume) : undefined,
            bid: q.bid != null ? Number(q.bid) : undefined,
            ask: q.ask != null ? Number(q.ask) : undefined,
            buyers: bidSize > 0 ? bidSize : undefined,
            sellers: askSize > 0 ? askSize : undefined,
            timestamp: asOf,
            asOf,
            stale: false,
            source: 'yahoo',
            available: true
          };
        }
      } catch {
        /* fall through to chart endpoint */
      }

      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
        {
          params: { interval: '1d', range: '2d' },
          headers,
          timeout: 8000
        }
      );

      const result = response.data?.chart?.result?.[0];
      if (!result) return null;

      const meta = result.meta;
      const price = meta.regularMarketPrice ?? meta.previousClose;
      if (!(price > 0)) return null;

      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      const change = price - prevClose;
      const high = meta.regularMarketDayHigh ?? price;
      const low = meta.regularMarketDayLow ?? price;
      const volume = Number(meta.regularMarketVolume ?? 0);
      // When exchange depth isn't available, derive a display proxy from day's range position
      let buyers: number | undefined;
      let sellers: number | undefined;
      if (volume > 0 && high > low) {
        const pos = Math.min(1, Math.max(0, (price - low) / (high - low)));
        buyers = Math.round(volume * (1 - pos) * 0.15);
        sellers = Math.round(volume * pos * 0.15);
      }

      return {
        symbol: symbol.replace(suffix, ''),
        price,
        change: Number(change.toFixed(2)),
        changePercent: prevClose ? Number(((change / prevClose) * 100).toFixed(2)) : 0,
        open: meta.regularMarketOpen,
        high,
        low,
        previousClose: prevClose,
        volume,
        buyers,
        sellers,
        timestamp: asOf,
        asOf,
        stale: false,
        source: 'yahoo',
        available: true
      };
    } catch (err) {
      const now = Date.now();
      const last = this.yahooWarnAt.get(symbol) || 0;
      if (now - last > 5 * 60_000) {
        this.yahooWarnAt.set(symbol, now);
        logger.warn(`Yahoo quote failed for ${symbol}: ${err instanceof Error ? err.message : String(err)}`);
      }
      return null;
    }
  }

  static async getQuote(symbol: string, userId?: string): Promise<Quote> {
    const displaySymbol = symbol.toUpperCase();
    const lookupSymbol = this.resolveChartSymbol(displaySymbol);
    const cacheKey = displaySymbol;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return this.assertValidQuote(cached.data, displaySymbol);
    }

    if (userId) {
      const brokerAuth = await BrokerService.getActiveBrokerToken(userId);
      if (brokerAuth) {
        const quotes = await BrokerService.fetchQuotes(brokerAuth.broker, brokerAuth.accessToken, [displaySymbol]);
        if (quotes.length && quotes[0].price > 0) {
          const asOf = new Date().toISOString();
          const quote: Quote = {
            ...quotes[0],
            symbol: displaySymbol,
            timestamp: asOf,
            asOf,
            stale: false,
            source: 'broker',
            available: true
          };
          this.cache.set(cacheKey, { data: quote, expires: Date.now() + this.CACHE_TTL });
          return quote;
        }
      }
    }

    if (process.env.MARKET_DATA_PROVIDER === 'dhan' && DhanService.isConfigured()) {
      const dhanQuote = await DhanService.getEquityQuote(lookupSymbol);
      if (dhanQuote && dhanQuote.price > 0) {
        const quote: Quote = {
          ...dhanQuote,
          symbol: displaySymbol,
          name:
            displaySymbol !== lookupSymbol
              ? `${displaySymbol} (via ${lookupSymbol})`
              : displaySymbol,
          asOf: dhanQuote.timestamp,
          stale: false,
          source: 'dhan',
          available: true
        };
        this.cache.set(cacheKey, { data: quote, expires: Date.now() + this.CACHE_TTL });
        return quote;
      }
    }

    const yahooQuote = await this.fetchYahooQuote(lookupSymbol);
    if (yahooQuote && yahooQuote.price > 0) {
      const quote: Quote = {
        ...yahooQuote,
        symbol: displaySymbol,
        name:
          displaySymbol !== lookupSymbol
            ? `${displaySymbol} (underlying ${lookupSymbol})`
            : yahooQuote.name
      };
      this.cache.set(cacheKey, { data: quote, expires: Date.now() + this.CACHE_TTL });
      await DatabaseService.cacheMarketData([{
        symbol: lookupSymbol,
        exchange: 'NSE',
        open: yahooQuote.open || yahooQuote.price,
        high: yahooQuote.high || yahooQuote.price,
        low: yahooQuote.low || yahooQuote.price,
        close: yahooQuote.price,
        volume: yahooQuote.volume || 0,
        timestamp: new Date()
      }]);
      return quote;
    }

    const historical = await DatabaseService.getCachedMarketData(lookupSymbol, 'NSE', 1);
    if (historical.length && Number(historical[0].close) > 0) {
      const h = historical[0];
      const asOf = h.timestamp.toISOString();
      return {
        symbol: displaySymbol,
        price: Number(h.close),
        change: 0,
        changePercent: 0,
        open: Number(h.open),
        high: Number(h.high),
        low: Number(h.low),
        volume: Number(h.volume),
        timestamp: asOf,
        asOf,
        stale: true,
        source: 'cache',
        available: true
      };
    }

    throw new AppError(`Market quote unavailable for ${displaySymbol}`, 503);
  }

  static async getQuotes(symbols: string[], userId?: string): Promise<Quote[]> {
    return Promise.all(symbols.map(s => this.getQuote(s, userId)));
  }

  static async getHistoricalData(symbol: string, days = 30): Promise<HistoricalSeries['bars']> {
    const series = await this.getHistoricalSeries(symbol, days);
    return series.bars;
  }

  /**
   * Resolve Yahoo chart params.
   * - range: lookback window (1d, 5d, 1mo, …)
   * - interval: candle size (1m…4h, 1d, 1wk, 1mo). 2h/4h are fetched as 60m then resampled.
   */
  static resolveYahooHistoryParams(
    daysOrRange?: number | string,
    intervalHint?: string
  ): { range: string; interval: string; fetchInterval: string; resampleMinutes: number; cacheDays: number } {
    const rangeKey = String(daysOrRange ?? '5d').toLowerCase();
    const rangeMap: Record<string, { range: string; cacheDays: number }> = {
      '1d': { range: '1d', cacheDays: 1 },
      '5d': { range: '5d', cacheDays: 5 },
      '1w': { range: '5d', cacheDays: 7 },
      '1mo': { range: '1mo', cacheDays: 31 },
      '1m': { range: '1mo', cacheDays: 31 },
      '3mo': { range: '3mo', cacheDays: 93 },
      '3m': { range: '3mo', cacheDays: 93 },
      '6mo': { range: '6mo', cacheDays: 186 },
      '6m': { range: '6mo', cacheDays: 186 },
      '1y': { range: '1y', cacheDays: 370 },
      '2y': { range: '2y', cacheDays: 740 },
      '5y': { range: '5y', cacheDays: 1900 },
      ytd: { range: 'ytd', cacheDays: 370 },
      max: { range: 'max', cacheDays: 5000 },
      '7': { range: '5d', cacheDays: 7 },
      '30': { range: '1mo', cacheDays: 31 },
      '90': { range: '3mo', cacheDays: 93 },
      '180': { range: '6mo', cacheDays: 186 },
      '365': { range: '1y', cacheDays: 370 }
    };

    // Legacy: if only "1d"/"5d" passed as range without interval, keep prior defaults
    const legacyIntervalDefaults: Record<string, string> = {
      '1d': '5m',
      '5d': '15m',
      '1w': '30m',
      '1mo': '1d',
      '1m': '1d',
      '3mo': '1d',
      '3m': '1d',
      '6mo': '1d',
      '6m': '1d',
      '1y': '1d',
      '2y': '1d',
      '5y': '1wk',
      ytd: '1d',
      max: '1mo'
    };

    const rangeInfo = rangeMap[rangeKey] || {
      range: `${Math.max(1, Number(rangeKey) || 30)}d`,
      cacheDays: Math.max(1, Number(rangeKey) || 30)
    };

    let interval = (intervalHint || legacyIntervalDefaults[rangeKey] || '1d').toLowerCase();
    if (interval === '60m') interval = '1h';

    // Yahoo does not support 2h/4h natively — fetch 1h and resample
    let fetchInterval = interval;
    let resampleMinutes = 0;
    if (interval === '2h') {
      fetchInterval = '60m';
      resampleMinutes = 120;
    } else if (interval === '4h') {
      fetchInterval = '60m';
      resampleMinutes = 240;
    } else if (interval === '1h') {
      fetchInterval = '60m';
    }

    // Clamp lookback for fine intervals (Yahoo limits)
    let { range, cacheDays } = rangeInfo;
    if (['1m', '2m'].includes(fetchInterval) && !['1d', '5d'].includes(range)) {
      range = '5d';
      cacheDays = 5;
    } else if (['5m', '15m', '30m'].includes(fetchInterval) && ['1y', '2y', '5y', 'max'].includes(range)) {
      range = '1mo';
      cacheDays = 31;
    } else if (fetchInterval === '60m' && ['5y', 'max'].includes(range)) {
      range = '3mo';
      cacheDays = 93;
    }

    return { range, interval, fetchInterval, resampleMinutes, cacheDays };
  }

  private static resampleBars(
    bars: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>,
    bucketMinutes: number
  ) {
    if (!bars.length || bucketMinutes <= 0) return bars;
    const out: typeof bars = [];
    let bucket: (typeof bars)[0] | null = null;
    let bucketStart = -1;

    for (const b of bars) {
      const ts = Date.parse(b.date.includes(' ') ? b.date.replace(' ', 'T') + ':00Z' : b.date);
      if (!Number.isFinite(ts)) continue;
      const start = Math.floor(ts / (bucketMinutes * 60_000)) * (bucketMinutes * 60_000);
      if (!bucket || start !== bucketStart) {
        if (bucket) out.push(bucket);
        bucketStart = start;
        const label = new Date(start).toISOString().replace('T', ' ').slice(0, 16);
        bucket = { date: label, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume };
      } else {
        bucket.high = Math.max(bucket.high, b.high);
        bucket.low = Math.min(bucket.low, b.low);
        bucket.close = b.close;
        bucket.volume += b.volume;
      }
    }
    if (bucket) out.push(bucket);
    return out;
  }

  static async getHistoricalSeries(
    symbol: string,
    daysOrRange: number | string = 30,
    intervalHint?: string
  ): Promise<HistoricalSeries> {
    const { range, fetchInterval, resampleMinutes, cacheDays } = this.resolveYahooHistoryParams(
      daysOrRange,
      intervalHint
    );
    const chartSym = this.resolveChartSymbol(symbol);
    const indexTicker = INDEX_YAHOO_MAP[chartSym];
    const lookup = indexTicker || YAHOO_SYMBOL_ALIASES[chartSym] || chartSym;
    const yahooSymbol =
      indexTicker || lookup.includes('^') || /\.(NS|BO)$/i.test(lookup)
        ? lookup
        : `${lookup}.NS`;
    const intraday = ['1m', '2m', '5m', '15m', '30m', '60m', '90m', '1h'].includes(fetchInterval);

    const hosts = [
      'https://query1.finance.yahoo.com',
      'https://query2.finance.yahoo.com'
    ];

    for (const host of hosts) {
      try {
        const response = await axios.get(`${host}/v8/finance/chart/${yahooSymbol}`, {
          params: { interval: fetchInterval, range },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 15000
        });

        const result = response.data?.chart?.result?.[0];
        if (!result?.timestamp?.length) continue;

        const quote = result.indicators?.quote?.[0];
        if (!quote) continue;

        let bars = result.timestamp
          .map((ts: number, i: number) => {
            const dt = new Date(ts * 1000);
            const date = intraday
              ? dt.toISOString().replace('T', ' ').slice(0, 16)
              : dt.toISOString().split('T')[0];
            return {
              date,
              open: quote.open?.[i] ?? 0,
              high: quote.high?.[i] ?? 0,
              low: quote.low?.[i] ?? 0,
              close: quote.close?.[i] ?? 0,
              volume: quote.volume?.[i] ?? 0
            };
          })
          .filter((d: { close: number }) => d.close > 0);

        if (resampleMinutes > 0) {
          bars = this.resampleBars(bars, resampleMinutes);
        }

        if (!bars.length) continue;

        return {
          bars,
          source: 'yahoo',
          stale: false,
          asOf: bars[bars.length - 1]?.date ?? null
        };
      } catch {
        /* try next host / fall through to cache */
      }
    }

    return this.historicalFromCache(chartSym, cacheDays);
  }

  private static async historicalFromCache(symbol: string, days: number): Promise<HistoricalSeries> {
    try {
      const cached = await DatabaseService.getCachedMarketData(symbol, 'NSE', days);
      if (!cached.length) {
        return { bars: [], source: 'empty', stale: true, asOf: null };
      }
      const bars = cached
        .reverse()
        .map((h) => ({
          date: h.timestamp.toISOString().split('T')[0],
          open: Number(h.open),
          high: Number(h.high),
          low: Number(h.low),
          close: Number(h.close),
          volume: Number(h.volume)
        }))
        .filter((d) => d.close > 0);

      return {
        bars,
        source: 'cache',
        stale: true,
        asOf: bars.length ? bars[bars.length - 1].date : null
      };
    } catch {
      return { bars: [], source: 'empty', stale: true, asOf: null };
    }
  }

  static async getIndices(): Promise<Array<{ name: string; value: number; change: number; changePercent: number }>> {
    if (process.env.MARKET_DATA_PROVIDER === 'dhan' && DhanService.isConfigured()) {
      const dhanIndices = await DhanService.getIndices();
      if (dhanIndices.length) return dhanIndices;
    }

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

  /** Index underlyings used for F&O-related script expansion in search */
  private static readonly FO_UNDERLYINGS: Array<{
    symbol: string;
    aliases: string[];
    name: string;
    step: number;
  }> = [
    { symbol: 'NIFTY', aliases: ['NIFTY', 'NIFTY50', 'NIFTY 50'], name: 'Nifty 50 Index', step: 50 },
    { symbol: 'BANKNIFTY', aliases: ['BANKNIFTY', 'BANK NIFTY', 'NIFTY BANK'], name: 'Nifty Bank Index', step: 100 },
    { symbol: 'FINNIFTY', aliases: ['FINNIFTY', 'FIN NIFTY'], name: 'Nifty Financial Services Index', step: 50 },
    { symbol: 'MIDCPNIFTY', aliases: ['MIDCPNIFTY', 'MIDCAP NIFTY'], name: 'Nifty Midcap Select Index', step: 25 },
    { symbol: 'SENSEX', aliases: ['SENSEX'], name: 'BSE Sensex Index', step: 100 },
    { symbol: 'BANKEX', aliases: ['BANKEX'], name: 'BSE Bankex Index', step: 100 }
  ];

  /** Parse queries like "NIFTY 24000", "NIFTY24000CE", "BANKNIFTY 52000 PE". */
  private static parseIndexStrikeQuery(query: string): { underlying: string; name: string; step: number; strike?: number } | null {
    const raw = (query || '').toUpperCase().replace(/\s+/g, ' ').trim();
    if (!raw) return null;

    for (const u of this.FO_UNDERLYINGS) {
      const alias = [...u.aliases].sort((a, b) => b.length - a.length).find((a) => {
        const compact = a.replace(/\s+/g, '');
        // Exact, spaced prefix ("NIFTY 24000"), or compact strike ("NIFTY24000CE")
        return (
          raw === a ||
          raw === compact ||
          raw.startsWith(`${a} `) ||
          new RegExp(`^${compact}(\\d{3,6})(CE|PE|FUT)?$`).test(raw)
        );
      });
      if (!alias) continue;

      const compactAlias = alias.replace(/\s+/g, '');
      let rest = '';
      if (raw === alias || raw === compactAlias) {
        rest = '';
      } else if (raw.startsWith(`${alias} `)) {
        rest = raw.slice(alias.length).trim();
      } else {
        const embeddedFull = raw.match(new RegExp(`^${compactAlias}(\\d{3,6})(CE|PE|FUT)?$`));
        if (embeddedFull) rest = `${embeddedFull[1]}${embeddedFull[2] || ''}`;
      }
      rest = rest.replace(/^(CE|PE|FUT)\b/, '').replace(/(CE|PE|FUT)$/, '').trim();
      const strikeMatch = rest.match(/^(\d{3,6})$/);
      const strike = strikeMatch ? Number(strikeMatch[1]) : undefined;
      return { underlying: u.symbol, name: u.name, step: u.step, strike };
    }
    return null;
  }

  /** Map option/futures compact symbols (NIFTY23950CE, NIFTYFUT) to chartable underlyings. */
  static resolveChartSymbol(symbol: string): string {
    const raw = (symbol || '').toUpperCase().trim();
    const fo = this.parseIndexStrikeQuery(raw);
    if (fo?.underlying) return fo.underlying;
    const fut = raw.match(/^([A-Z]+)FUT$/);
    if (fut) {
      const u = this.FO_UNDERLYINGS.find((x) => x.symbol === fut[1]);
      if (u) return u.symbol;
    }
    return raw;
  }

  /** Spot index + nearby CE/PE + futures for an index/strike search. */
  private static relatedFoScripts(
    underlying: string,
    name: string,
    step: number,
    strike?: number
  ): Array<{ symbol: string; name: string; exchange: string }> {
    const out: Array<{ symbol: string; name: string; exchange: string }> = [
      { symbol: underlying, name, exchange: 'INDEX' },
      { symbol: `${underlying}FUT`, name: `${name} Futures`, exchange: 'NFO' }
    ];
    if (!strike || !Number.isFinite(strike) || strike <= 0) return out;

    const rounded = Math.round(strike / step) * step;
    const strikes = [rounded - step, rounded, rounded + step].filter((s) => s > 0);
    for (const s of strikes) {
      out.push({
        symbol: `${underlying}${s}CE`,
        name: `${underlying} ${s} CE`,
        exchange: 'NFO'
      });
      out.push({
        symbol: `${underlying}${s}PE`,
        name: `${underlying} ${s} PE`,
        exchange: 'NFO'
      });
    }
    return out;
  }

  static searchSymbols(query: string) {
    const names: Record<string, string> = {
      RELIANCE: 'Reliance Industries Ltd',
      TCS: 'Tata Consultancy Services Ltd',
      INFY: 'Infosys Ltd',
      HDFCBANK: 'HDFC Bank Ltd',
      ICICIBANK: 'ICICI Bank Ltd',
      SBIN: 'State Bank of India',
      BHARTIARTL: 'Bharti Airtel Ltd',
      ITC: 'ITC Ltd',
      WIPRO: 'Wipro Ltd',
      LT: 'Larsen & Toubro Ltd',
      AXISBANK: 'Axis Bank Ltd',
      KOTAKBANK: 'Kotak Mahindra Bank Ltd',
      HCLTECH: 'HCL Technologies Ltd',
      MARUTI: 'Maruti Suzuki India Ltd',
      SUNPHARMA: 'Sun Pharmaceutical Industries Ltd',
      TATAMOTORS: 'Tata Motors Ltd',
      BAJFINANCE: 'Bajaj Finance Ltd',
      ASIANPAINT: 'Asian Paints Ltd',
      TITAN: 'Titan Company Ltd',
      ULTRACEMCO: 'UltraTech Cement Ltd',
      NESTLEIND: 'Nestle India Ltd',
      POWERGRID: 'Power Grid Corporation of India Ltd',
      NTPC: 'NTPC Ltd',
      ONGC: 'Oil and Natural Gas Corporation Ltd',
      COALINDIA: 'Coal India Ltd',
      JSWSTEEL: 'JSW Steel Ltd',
      TATASTEEL: 'Tata Steel Ltd',
      ADANIENT: 'Adani Enterprises Ltd',
      'M&M': 'Mahindra & Mahindra Ltd',
      IDFCFIRSTB: 'IDFC First Bank Ltd',
      PNB: 'Punjab National Bank',
      BANKBARODA: 'Bank of Baroda',
      CANBK: 'Canara Bank',
      IOB: 'Indian Overseas Bank',
      UCOBANK: 'UCO Bank',
      CENTRALBK: 'Central Bank of India',
      SAIL: 'Steel Authority of India Ltd',
      NMDC: 'NMDC Ltd',
      NHPC: 'NHPC Ltd',
      IRFC: 'Indian Railway Finance Corporation Ltd',
      RVNL: 'Rail Vikas Nigam Ltd',
      IREDA: 'Indian Renewable Energy Development Agency Ltd',
      HUDCO: 'Housing & Urban Development Corporation Ltd',
      IRCTC: 'Indian Railway Catering and Tourism Corporation Ltd',
      HINDUNILWR: 'Hindustan Unilever Ltd',
      HINDUNILVR: 'Hindustan Unilever Ltd'
    };

    const indexUniverse: Array<{ symbol: string; name: string; exchange: 'INDEX' }> = [
      { symbol: 'NIFTY', name: 'Nifty 50 Index', exchange: 'INDEX' },
      { symbol: 'NIFTY50', name: 'Nifty 50 Index', exchange: 'INDEX' },
      { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', exchange: 'INDEX' },
      { symbol: 'FINNIFTY', name: 'Nifty Financial Services Index', exchange: 'INDEX' },
      { symbol: 'MIDCPNIFTY', name: 'Nifty Midcap Select Index', exchange: 'INDEX' },
      { symbol: 'SENSEX', name: 'BSE Sensex Index', exchange: 'INDEX' },
      { symbol: 'BANKEX', name: 'BSE Bankex Index', exchange: 'INDEX' },
      { symbol: 'INDIAVIX', name: 'India VIX', exchange: 'INDEX' },
      { symbol: 'NIFTYIT', name: 'Nifty IT Index', exchange: 'INDEX' },
      { symbol: 'NIFTYAUTO', name: 'Nifty Auto Index', exchange: 'INDEX' },
      { symbol: 'NIFTYPHARMA', name: 'Nifty Pharma Index', exchange: 'INDEX' },
      { symbol: 'NIFTYFMCG', name: 'Nifty FMCG Index', exchange: 'INDEX' },
      { symbol: 'NIFTYMETAL', name: 'Nifty Metal Index', exchange: 'INDEX' },
      { symbol: 'NIFTYENERGY', name: 'Nifty Energy Index', exchange: 'INDEX' },
      { symbol: 'NIFTYREALTY', name: 'Nifty Realty Index', exchange: 'INDEX' }
    ];

    const symbols = Array.from(new Set([...LIQUID_UNIVERSE, ...SMALLCAP_UNIVERSE, ...Object.keys(names)]));
    const equityUniverse = symbols.map((symbol) => ({
      symbol,
      name: names[symbol] || symbol,
      exchange: 'NSE' as const
    }));
    const universe = [...indexUniverse, ...equityUniverse];

    const qRaw = (query || '').trim();
    const q = qRaw.toLowerCase();
    const tokens = q.split(/[\s/_-]+/).filter(Boolean);
    const compactQ = q.replace(/[\s/_-]+/g, '');

    const matchesText = (s: { symbol: string; name: string; exchange: string }) => {
      const sym = s.symbol.toLowerCase();
      const name = s.name.toLowerCase();
      const hay = `${sym} ${name}`;
      if (!q) return true;
      if (sym.includes(q) || name.includes(q) || sym.includes(compactQ)) return true;
      if (tokens.length > 1 && tokens.every((t) => hay.includes(t) || sym.includes(t))) return true;
      if (s.exchange === 'INDEX' && (q === 'index' || q === 'indices' || 'index'.startsWith(q))) return true;
      return false;
    };

    const fo = this.parseIndexStrikeQuery(qRaw);
    const related = fo
      ? this.relatedFoScripts(fo.underlying, fo.name, fo.step, fo.strike)
      : [];

    const base = !q ? universe : universe.filter(matchesText);
    const seen = new Set<string>();
    const merged: Array<{ symbol: string; name: string; exchange: string }> = [];
    for (const s of [...related, ...base]) {
      const key = `${s.exchange}:${s.symbol.toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }

    // Prefer INDEX / NFO related scripts first for index-style queries
    merged.sort((a, b) => {
      const rank = (x: { exchange: string }) =>
        x.exchange === 'INDEX' ? 0 : x.exchange === 'NFO' ? 1 : 2;
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.symbol.localeCompare(b.symbol);
    });

    return merged.slice(0, 40);
  }

  static async getTopMovers(type: 'gainers' | 'losers', count = 10) {
    const quotes = (await Promise.all(LIQUID_UNIVERSE.map(s => this.fetchYahooQuote(s))))
      .filter((q): q is Quote => !!q && q.price > 0);

    quotes.sort((a, b) =>
      type === 'gainers' ? b.changePercent - a.changePercent : a.changePercent - b.changePercent
    );

    return {
      source: 'liquid_universe_sample',
      sampleSize: quotes.length,
      universeSize: LIQUID_UNIVERSE.length,
      data: quotes.slice(0, count).map(q => ({
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
      }))
    };
  }

  static async getSmallCapStocks(count = 20) {
    const quotes = (await Promise.all(SMALLCAP_UNIVERSE.map(s => this.fetchYahooQuote(s))))
      .filter((q): q is Quote => !!q && q.price > 0);

    return {
      source: 'smallcap_universe_sample',
      sampleSize: quotes.length,
      universeSize: SMALLCAP_UNIVERSE.length,
      data: quotes.slice(0, count).map(q => ({
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
      }))
    };
  }

  static async getSectorPerformance() {
    const sectorIndices = Object.entries(INDEX_YAHOO_MAP).filter(([name]) =>
      ['NIFTY IT', 'NIFTY BANK', 'NIFTY AUTO', 'NIFTY PHARMA', 'NIFTY FMCG', 'NIFTY ENERGY', 'NIFTY METAL', 'NIFTY REALTY'].includes(name)
    );

    const results = await Promise.all(
      sectorIndices.map(async ([name, yahooSymbol]) => {
        const quote = await this.fetchYahooQuote(yahooSymbol, '');
        if (!quote) return null;
        // Index-level direction only — not full-market stock advancers/decliners
        return {
          sector: name.replace('NIFTY ', ''),
          change: quote.changePercent,
          stocks: null as number | null,
          advancers: null as number | null,
          decliners: null as number | null,
          indexDirection: quote.changePercent >= 0 ? 'up' as const : 'down' as const,
          source: 'sector_index_sample',
          coverage: 'index_only_not_full_market'
        };
      })
    );

    return {
      source: 'sector_index_sample',
      coverage: 'index_only_not_full_market',
      data: results.filter(Boolean)
    };
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
      sampleSize: quotes.length,
      universeSize: LIQUID_UNIVERSE.length,
      source: 'liquid_universe_sample',
      coverage: 'sample_not_full_market',
      // Not computed from real 52-week series — leave explicit nulls
      fiftyTwoWeekHighs: null as number | null,
      fiftyTwoWeekLows: null as number | null,
      fiiActivity: null as number | null,
      diiActivity: null as number | null,
      fiiDiiAvailable: false,
      fiftyTwoWeekAvailable: false
    };
  }
}
