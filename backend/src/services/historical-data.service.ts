import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { logger } from '../utils/logger';

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface DatasetMeta {
  symbol: string;
  bars: number;
  startDate: string;
  endDate: string;
  filePath: string;
}

export interface TrainTestSplit {
  train: OHLCVBar[];
  test: OHLCVBar[];
  trainSize: number;
  testSize: number;
  splitRatio: number;
}

const NIFTY50_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
  'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA',
  'TITAN', 'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'POWERGRID', 'NTPC',
  'TATAMOTORS', 'M&M', 'HCLTECH', 'ADANIENT', 'JSWSTEEL', 'TATASTEEL', 'INDUSINDBK',
  'BAJAJFINSV', 'TECHM', 'ONGC', 'COALINDIA', 'GRASIM', 'CIPLA', 'DRREDDY', 'EICHERMOT',
  'APOLLOHOSP', 'BRITANNIA', 'DIVISLAB', 'HEROMOTOCO', 'HINDALCO', 'SBILIFE', 'TATACONSUM',
  'UPL', 'BPCL', 'ADANIPORTS', 'LTIM', 'HDFCLIFE', 'BAJAJ-AUTO'
];

export class HistoricalDataService {
  private static dataDir = process.env.HISTORICAL_DATA_DIR
    || path.join(process.cwd(), 'data', 'historical');

  static getDataDir(): string {
    return this.dataDir;
  }

  static ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  static getSymbolPath(symbol: string): string {
    return path.join(this.dataDir, `${symbol}.json`);
  }

  static async fetchFromYahoo(symbol: string, years = 10): Promise<OHLCVBar[]> {
    const yahooSymbol = `${symbol}.NS`;
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
      {
        params: { interval: '1d', range: `${years}y` },
        headers: { 'User-Agent': 'Mozilla/5.0 SmartTrade/1.0' },
        timeout: 30000
      }
    );

    const result = response.data?.chart?.result?.[0];
    if (!result?.timestamp) return [];

    const quote = result.indicators.quote[0];
    return result.timestamp
      .map((ts: number, i: number) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: quote.open[i] ?? 0,
        high: quote.high[i] ?? 0,
        low: quote.low[i] ?? 0,
        close: quote.close[i] ?? 0,
        volume: quote.volume[i] ?? 0
      }))
      .filter((b: OHLCVBar) => b.close > 0);
  }

  static saveSymbolData(symbol: string, bars: OHLCVBar[]): DatasetMeta {
    this.ensureDataDir();
    const filePath = this.getSymbolPath(symbol);
    const payload = {
      symbol,
      collectedAt: new Date().toISOString(),
      bars
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    return {
      symbol,
      bars: bars.length,
      startDate: bars[0]?.date || '',
      endDate: bars[bars.length - 1]?.date || '',
      filePath
    };
  }

  static loadSymbolData(symbol: string): OHLCVBar[] {
    const filePath = this.getSymbolPath(symbol);
    if (!fs.existsSync(filePath)) return [];
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return raw.bars || raw;
  }

  static hasLocalData(symbol: string): boolean {
    return fs.existsSync(this.getSymbolPath(symbol));
  }

  static async collectSymbol(symbol: string, years = 10): Promise<DatasetMeta> {
    logger.info(`Collecting ${years}y data for ${symbol}...`);
    const bars = await this.fetchFromYahoo(symbol, years);
    if (!bars.length) throw new Error(`No data returned for ${symbol}`);
    return this.saveSymbolData(symbol, bars);
  }

  static async collectUniverse(symbols = NIFTY50_SYMBOLS, years = 10): Promise<{
    success: DatasetMeta[];
    failed: Array<{ symbol: string; error: string }>;
    summary: { totalSymbols: number; totalBars: number; years: number };
  }> {
    this.ensureDataDir();
    const success: DatasetMeta[] = [];
    const failed: Array<{ symbol: string; error: string }> = [];

    for (const symbol of symbols) {
      try {
        const meta = await this.collectSymbol(symbol, years);
        success.push(meta);
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        failed.push({
          symbol,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const manifest = {
      collectedAt: new Date().toISOString(),
      years,
      symbols: success,
      failed
    };
    fs.writeFileSync(
      path.join(this.dataDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    return {
      success,
      failed,
      summary: {
        totalSymbols: success.length,
        totalBars: success.reduce((s, m) => s + m.bars, 0),
        years
      }
    };
  }

  static getManifest(): Record<string, unknown> | null {
    const manifestPath = path.join(this.dataDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;
    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  }

  static listLocalDatasets(): DatasetMeta[] {
    this.ensureDataDir();
    return fs.readdirSync(this.dataDir)
      .filter(f => f.endsWith('.json') && f !== 'manifest.json')
      .map(f => {
        const symbol = f.replace('.json', '');
        const bars = this.loadSymbolData(symbol);
        return {
          symbol,
          bars: bars.length,
          startDate: bars[0]?.date || '',
          endDate: bars[bars.length - 1]?.date || '',
          filePath: path.join(this.dataDir, f)
        };
      });
  }

  static trainTestSplit(bars: OHLCVBar[], testRatio = 0.2): TrainTestSplit {
    const splitIdx = Math.floor(bars.length * (1 - testRatio));
    return {
      train: bars.slice(0, splitIdx),
      test: bars.slice(splitIdx),
      trainSize: splitIdx,
      testSize: bars.length - splitIdx,
      splitRatio: 1 - testRatio
    };
  }

  static getBarsForSymbol(symbol: string, minBars = 100): OHLCVBar[] {
    const local = this.loadSymbolData(symbol);
    if (local.length >= minBars) return local;
    return [];
  }
}
