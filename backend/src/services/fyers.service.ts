import axios from 'axios';
import { logger } from '../utils/logger';

const FYERS_API = (process.env.FYERS_BASE_URL || 'https://api-t1.fyers.in').replace(/\/$/, '');

/** Display name / ticker → Fyers market-data symbol */
export const INDEX_FYERS_MAP: Record<string, string> = {
  'NIFTY 50': 'NSE:NIFTY50-INDEX',
  NIFTY: 'NSE:NIFTY50-INDEX',
  NIFTY50: 'NSE:NIFTY50-INDEX',
  SENSEX: 'BSE:SENSEX-INDEX',
  'NIFTY BANK': 'NSE:NIFTYBANK-INDEX',
  BANKNIFTY: 'NSE:NIFTYBANK-INDEX',
  FINNIFTY: 'NSE:FINNIFTY-INDEX',
  MIDCPNIFTY: 'NSE:MIDCPNIFTY-INDEX',
  BANKEX: 'BSE:BANKEX-INDEX',
  INDIAVIX: 'NSE:INDIAVIX-INDEX',
  'NIFTY IT': 'NSE:NIFTYIT-INDEX',
  NIFTYIT: 'NSE:NIFTYIT-INDEX',
  'NIFTY AUTO': 'NSE:NIFTYAUTO-INDEX',
  NIFTYAUTO: 'NSE:NIFTYAUTO-INDEX',
  'NIFTY PHARMA': 'NSE:NIFTYPHARMA-INDEX',
  NIFTYPHARMA: 'NSE:NIFTYPHARMA-INDEX',
  'NIFTY FMCG': 'NSE:NIFTYFMCG-INDEX',
  NIFTYFMCG: 'NSE:NIFTYFMCG-INDEX',
  'NIFTY METAL': 'NSE:NIFTYMETAL-INDEX',
  NIFTYMETAL: 'NSE:NIFTYMETAL-INDEX',
  'NIFTY REALTY': 'NSE:NIFTYREALTY-INDEX',
  NIFTYREALTY: 'NSE:NIFTYREALTY-INDEX',
  'NIFTY ENERGY': 'NSE:NIFTYENERGY-INDEX',
  NIFTYENERGY: 'NSE:NIFTYENERGY-INDEX'
};

export type FyersQuote = {
  symbol: string;
  fyersSymbol: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  timestamp: string;
};

function parseQuoteRow(row: Record<string, unknown>): FyersQuote | null {
  const fyersSymbol = String(row.n || row.symbol || '');
  const v = (row.v || row) as Record<string, unknown>;
  const price = Number(v.lp ?? v.ltp ?? v.last_price ?? 0);
  if (!(price > 0) || !fyersSymbol) return null;
  const prev = Number(v.prev_close_price ?? v.previous_close ?? v.pc ?? price);
  const change = Number(v.ch ?? price - prev);
  const changePercent = Number(v.chp ?? (prev ? (change / prev) * 100 : 0));
  const display = fyersSymbol.includes(':')
    ? fyersSymbol.split(':')[1].replace(/-EQ$/i, '').replace(/-INDEX$/i, '')
    : fyersSymbol;
  return {
    symbol: display,
    fyersSymbol,
    price,
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    open: v.open_price != null ? Number(v.open_price) : undefined,
    high: v.high_price != null ? Number(v.high_price) : undefined,
    low: v.low_price != null ? Number(v.low_price) : undefined,
    previousClose: prev,
    volume: v.volume != null ? Number(v.volume) : undefined,
    bid: v.bid != null ? Number(v.bid) : undefined,
    ask: v.ask != null ? Number(v.ask) : undefined,
    timestamp: new Date().toISOString()
  };
}

export class FyersService {
  static isConfigured(): boolean {
    return !!(process.env.FYERS_APP_ID && process.env.FYERS_ACCESS_TOKEN);
  }

  static authHeader(appId?: string, accessToken?: string): string {
    return `${appId || process.env.FYERS_APP_ID || ''}:${accessToken || process.env.FYERS_ACCESS_TOKEN || ''}`;
  }

  static toFyersSymbol(raw: string): string {
    const s = (raw || '').trim().toUpperCase();
    if (!s) return s;
    if (s.includes(':')) return s;
    const index = INDEX_FYERS_MAP[s];
    if (index) return index;
    if (/(CE|PE|FUT)$/.test(s)) return `NSE:${s}`;
    return `NSE:${s.replace(/\.NS$/i, '')}-EQ`;
  }

  static async getQuotes(
    symbols: string[],
    creds?: { appId: string; accessToken: string }
  ): Promise<Map<string, FyersQuote>> {
    const map = new Map<string, FyersQuote>();
    const fyersSymbols = [...new Set(symbols.map((s) => this.toFyersSymbol(s)).filter(Boolean))];
    if (!fyersSymbols.length) return map;

    const header = this.authHeader(creds?.appId, creds?.accessToken);
    if (!header || header.startsWith(':') || header.endsWith(':')) return map;

    try {
      const res = await axios.get(`${FYERS_API}/data/quotes`, {
        params: { symbols: fyersSymbols.join(',') },
        headers: { Authorization: header },
        timeout: 10000
      });
      const rows: unknown[] = Array.isArray(res.data?.d)
        ? res.data.d
        : Array.isArray(res.data?.data)
          ? res.data.data
          : [];
      for (const row of rows) {
        const parsed = parseQuoteRow(row as Record<string, unknown>);
        if (parsed) map.set(parsed.fyersSymbol, parsed);
      }
    } catch (err) {
      logger.warn(`Fyers quotes failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return map;
  }

  static async getEquityQuote(
    symbol: string,
    creds?: { appId: string; accessToken: string }
  ): Promise<FyersQuote | null> {
    const fy = this.toFyersSymbol(symbol);
    const map = await this.getQuotes([fy], creds);
    return map.get(fy) || [...map.values()][0] || null;
  }

  static async getIndices(creds?: { appId: string; accessToken: string }) {
    const entries = Object.entries(INDEX_FYERS_MAP);
    const quotes = await this.getQuotes(
      [...new Set(entries.map(([, fy]) => fy))],
      creds
    );
    return entries
      .map(([name, fy]) => {
        const q = quotes.get(fy);
        if (!q) return null;
        return {
          name,
          value: q.price,
          change: q.change,
          changePercent: q.changePercent
        };
      })
      .filter(Boolean) as Array<{ name: string; value: number; change: number; changePercent: number }>;
  }
}
