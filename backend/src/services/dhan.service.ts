import axios from 'axios';
import { logger } from '../utils/logger';

const DHAN_BASE = 'https://api.dhan.co/v2';

/** Common NSE equity symbol → Dhan securityId */
export const DHAN_NSE_EQ_IDS: Record<string, number> = {
  RELIANCE: 2885,
  TCS: 11536,
  INFY: 1594,
  HDFCBANK: 1333,
  ICICIBANK: 4963,
  SBIN: 3045,
  BHARTIARTL: 10604,
  ITC: 1660,
  WIPRO: 3787,
  LT: 11483,
  AXISBANK: 5900,
  KOTAKBANK: 1922,
  HCLTECH: 7229,
  MARUTI: 10999,
  SUNPHARMA: 3351,
  TATAMOTORS: 3456,
  BAJFINANCE: 317,
  ASIANPAINT: 236,
  TITAN: 3506,
  NTPC: 11630,
  ONGC: 2475,
  POWERGRID: 14977,
  COALINDIA: 2031
};

/** Index securityIds (IDX_I) — Dhan optionchain / spot */
export const DHAN_IDX_IDS: Record<string, number> = {
  'NIFTY 50': 13,
  NIFTY: 13,
  'NIFTY BANK': 25,
  BANKNIFTY: 25,
  FINNIFTY: 27,
  MIDCPNIFTY: 442,
  NIFTYNXT50: 38,
  NIFTYFPI: 864,
  'NIFTY IT': 35,
  NIFTYIT: 35,
  'NIFTY AUTO': 14,
  NIFTYAUTO: 14,
  SENSEX: 51,
  BANKEX: 12
};

export class DhanService {
  private static feedGate: Promise<void> = Promise.resolve();
  private static lastFeedAt = 0;
  private static readonly MIN_FEED_MS = 1200;

  static isConfigured(): boolean {
    return !!(process.env.DHAN_CLIENT_ID && process.env.DHAN_ACCESS_TOKEN);
  }

  private static headers() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'access-token': process.env.DHAN_ACCESS_TOKEN || '',
      'client-id': process.env.DHAN_CLIENT_ID || ''
    };
  }

  private static async throttleFeed<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.feedGate.then(async () => {
      const wait = this.MIN_FEED_MS - (Date.now() - this.lastFeedAt);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastFeedAt = Date.now();
      return fn();
    });
    this.feedGate = run.then(() => undefined).catch(() => undefined);
    return run;
  }

  private static feedErrorMessage(err: unknown): string {
    const ax = err as { message?: string; response?: { status?: number; data?: { errorMessage?: string; errorCode?: string } } };
    const status = ax.response?.status;
    const code = ax.response?.data?.errorCode;
    const msg = ax.response?.data?.errorMessage || ax.message || String(err);
    return [status && `HTTP ${status}`, code, msg].filter(Boolean).join(' · ');
  }

  static resolveEquityId(symbol: string): number | null {
    const key = symbol.toUpperCase().replace(/\.NS$/i, '');
    return DHAN_NSE_EQ_IDS[key] ?? null;
  }

  /** After the close, Dhan `close` is often today's LTP — skip it and use previous_close. */
  private static sessionPrevClose(row: Record<string, unknown>, price: number): number {
    const ohlc = (row.ohlc || {}) as Record<string, unknown>;
    const candidates = [
      row.previous_close,
      row.prev_close,
      row.previousClose,
      ohlc.previous_close,
      ohlc.prev_close,
      row.close,
      ohlc.close
    ]
      .map((v) => Number(v))
      .filter((n) => n > 0);
    const distinct = candidates.find((n) => Math.abs(n - price) > Math.max(0.05, price * 0.0002));
    return distinct || price;
  }

  static resolveIndexId(symbol: string): number | null {
    const key = symbol.toUpperCase().replace(/\.NS$/i, '').replace(/\s+/g, ' ').trim();
    return DHAN_IDX_IDS[key] ?? DHAN_IDX_IDS[key.replace(/\s+/g, '')] ?? null;
  }

  static async getIndexQuote(symbol: string): Promise<{
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    timestamp: string;
  } | null> {
    const securityId = this.resolveIndexId(symbol);
    if (!securityId) return null;
    try {
      const res = await this.ltp({ IDX_I: [securityId] });
      const row = res?.data?.IDX_I?.[String(securityId)];
      if (!row) return null;
      const price = Number(row.last_price ?? row.ltp ?? 0);
      if (!(price > 0)) return null;
      const prev = this.sessionPrevClose(row, price);
      const change = price - prev;
      const changePercent = prev ? (change / prev) * 100 : 0;
      return {
        symbol: symbol.toUpperCase(),
        price,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        open: Number(row.open ?? row.ohlc?.open ?? price),
        high: Number(row.high ?? row.ohlc?.high ?? price),
        low: Number(row.low ?? row.ohlc?.low ?? price),
        volume: row.volume,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      logger.warn(`Dhan index LTP failed for ${symbol}: ${this.feedErrorMessage(err)}`);
      return null;
    }
  }

  static async ltp(securities: Record<string, number[]>) {
    return this.throttleFeed(async () => {
      const res = await axios.post(`${DHAN_BASE}/marketfeed/ltp`, securities, {
        headers: this.headers(),
        timeout: 10000
      });
      return res.data;
    });
  }

  static async ohlc(securities: Record<string, number[]>) {
    return this.throttleFeed(async () => {
      const res = await axios.post(`${DHAN_BASE}/marketfeed/ohlc`, securities, {
        headers: this.headers(),
        timeout: 10000
      });
      return res.data;
    });
  }

  static async quote(securities: Record<string, number[]>) {
    return this.throttleFeed(async () => {
      const res = await axios.post(`${DHAN_BASE}/marketfeed/quote`, securities, {
        headers: this.headers(),
        timeout: 10000
      });
      return res.data;
    });
  }

  static async getEquityQuote(symbol: string): Promise<{
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    open?: number;
    high?: number;
    low?: number;
    volume?: number;
    timestamp: string;
  } | null> {
    const indexQuote = await this.getIndexQuote(symbol);
    if (indexQuote) return indexQuote;

    const securityId = this.resolveEquityId(symbol);
    if (!securityId) {
      logger.warn(`Dhan: no securityId mapped for ${symbol}`);
      return null;
    }

    try {
      const res = await this.ltp({ NSE_EQ: [securityId] });
      const row = res?.data?.NSE_EQ?.[String(securityId)];
      if (!row) return null;

      const price = Number(row.last_price ?? row.ltp ?? 0);
      if (!(price > 0)) return null;

      const open = Number(row.open ?? row.ohlc?.open ?? price);
      const high = Number(row.high ?? row.ohlc?.high ?? price);
      const low = Number(row.low ?? row.ohlc?.low ?? price);
      const prev = this.sessionPrevClose(row, price);
      const change = price - prev;
      const changePercent = prev ? (change / prev) * 100 : 0;

      return {
        symbol: symbol.toUpperCase().replace(/\.NS$/i, ''),
        price,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        open,
        high,
        low,
        volume: row.volume,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      logger.warn(`Dhan LTP failed for ${symbol}: ${this.feedErrorMessage(err)}`);
      return null;
    }
  }

  private static indicesCache: { at: number; rows: Array<{ name: string; value: number; change: number; changePercent: number }> } | null = null;

  static async getIndices(): Promise<Array<{ name: string; value: number; change: number; changePercent: number }>> {
    if (this.indicesCache && Date.now() - this.indicesCache.at < 4000) {
      return this.indicesCache.rows;
    }
    try {
      const ids = [...new Set(Object.values(DHAN_IDX_IDS))];
      let res: { data?: { IDX_I?: Record<string, Record<string, unknown>> } };
      try {
        res = await this.ohlc({ IDX_I: ids });
      } catch {
        res = await this.ltp({ IDX_I: ids });
      }
      const data = res?.data?.IDX_I || {};

      const rows = Object.entries(DHAN_IDX_IDS)
        .map(([name, id]) => {
          const row = data[String(id)];
          if (!row) return null;
          const value = Number(row.last_price ?? 0);
          const prev = this.sessionPrevClose(row, value);
          const change = value - prev;
          const changePercent = prev ? (change / prev) * 100 : 0;
          return {
            name,
            value,
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2))
          };
        })
        .filter(Boolean) as Array<{ name: string; value: number; change: number; changePercent: number }>;
      this.indicesCache = { at: Date.now(), rows };
      return rows;
    } catch (err) {
      logger.warn(`Dhan indices failed: ${this.feedErrorMessage(err)}`);
      return this.indicesCache?.rows || [];
    }
  }

  /**
   * Env credentials are for public market data only.
   * Account holdings/funds/orders must use the selected per-user adapter
   * (DhanDirectAdapter / DhanMcpAdapter via ExecutionTargetResolver).
   */
  static async getHoldings(): Promise<never> {
    throw new Error(
      'DhanService.getHoldings is disabled for env-global credentials. Use the selected per-user broker adapter.'
    );
  }

  static async getFunds(): Promise<never> {
    throw new Error(
      'DhanService.getFunds is disabled for env-global credentials. Use the selected per-user broker adapter.'
    );
  }

  static async placeOrder(_params: {
    symbol: string;
    tradeType: 'BUY' | 'SELL';
    quantity: number;
    orderType?: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
    product?: 'CNC' | 'MIS' | 'NRML';
    price?: number;
    triggerPrice?: number;
    correlationId?: string;
  }): Promise<never> {
    throw new Error(
      'DhanService.placeOrder is disabled for env-global credentials. Use the selected per-user broker adapter.'
    );
  }

  static async status() {
    if (!this.isConfigured()) {
      return { configured: false, healthy: false, message: 'DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN not set' };
    }
    try {
      // Lightweight public market-data probe — LTP for RELIANCE
      const res = await this.ltp({ NSE_EQ: [2885] });
      const price = res?.data?.NSE_EQ?.['2885']?.last_price;
      return {
        configured: true,
        healthy: price != null,
        provider: 'dhan',
        scope: 'public_market_data',
        sample: price != null ? { RELIANCE: price } : null
      };
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err)
          ? err.response?.data?.message || err.response?.data?.errorMessage || err.message
          : err instanceof Error
            ? err.message
            : 'Unknown error';
      return {
        configured: true,
        healthy: false,
        provider: 'dhan',
        scope: 'public_market_data',
        message: String(msg),
        hint: 'Subscribe to Data APIs in Dhan Developer Portal if you see DH-902 / Unauthorized'
      };
    }
  }
}
