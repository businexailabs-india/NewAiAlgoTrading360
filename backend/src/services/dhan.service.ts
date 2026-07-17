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

/** Index securityIds (IDX_I) */
export const DHAN_IDX_IDS: Record<string, number> = {
  'NIFTY 50': 13,
  'NIFTY BANK': 25,
  'NIFTY IT': 35,
  SENSEX: 51
};

export class DhanService {
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

  static resolveEquityId(symbol: string): number | null {
    const key = symbol.toUpperCase().replace(/\.NS$/i, '');
    return DHAN_NSE_EQ_IDS[key] ?? null;
  }

  static async ltp(securities: Record<string, number[]>) {
    const res = await axios.post(`${DHAN_BASE}/marketfeed/ltp`, securities, {
      headers: this.headers(),
      timeout: 10000
    });
    return res.data;
  }

  static async ohlc(securities: Record<string, number[]>) {
    const res = await axios.post(`${DHAN_BASE}/marketfeed/ohlc`, securities, {
      headers: this.headers(),
      timeout: 10000
    });
    return res.data;
  }

  static async quote(securities: Record<string, number[]>) {
    const res = await axios.post(`${DHAN_BASE}/marketfeed/quote`, securities, {
      headers: this.headers(),
      timeout: 10000
    });
    return res.data;
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
    const securityId = this.resolveEquityId(symbol);
    if (!securityId) {
      logger.warn(`Dhan: no securityId mapped for ${symbol}`);
      return null;
    }

    try {
      const res = await this.ohlc({ NSE_EQ: [securityId] });
      const row = res?.data?.NSE_EQ?.[String(securityId)];
      if (!row) return null;

      const price = Number(row.last_price ?? row.ltp ?? 0);
      if (!(price > 0)) return null;

      const open = Number(row.open ?? row.ohlc?.open ?? price);
      const high = Number(row.high ?? row.ohlc?.high ?? price);
      const low = Number(row.low ?? row.ohlc?.low ?? price);
      const close = Number(row.close ?? row.ohlc?.close ?? price);
      const change = price - close;
      const changePercent = close ? (change / close) * 100 : 0;

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
      logger.warn(`Dhan OHLC failed for ${symbol}:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  static async getIndices(): Promise<Array<{ name: string; value: number; change: number; changePercent: number }>> {
    try {
      const ids = Object.values(DHAN_IDX_IDS);
      const res = await this.ohlc({ IDX_I: ids });
      const data = res?.data?.IDX_I || {};

      return Object.entries(DHAN_IDX_IDS)
        .map(([name, id]) => {
          const row = data[String(id)];
          if (!row) return null;
          const value = Number(row.last_price ?? 0);
          const close = Number(row.close ?? row.ohlc?.close ?? value);
          const change = value - close;
          const changePercent = close ? (change / close) * 100 : 0;
          return {
            name,
            value,
            change: Number(change.toFixed(2)),
            changePercent: Number(changePercent.toFixed(2))
          };
        })
        .filter(Boolean) as Array<{ name: string; value: number; change: number; changePercent: number }>;
    } catch (err) {
      logger.warn('Dhan indices failed:', err instanceof Error ? err.message : err);
      return [];
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
