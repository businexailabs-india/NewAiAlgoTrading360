import fs from 'fs';

import path from 'path';

import axios from 'axios';

import { logger } from '../utils/logger';

import { S3StorageService } from './s3-storage.service';



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

  storage?: 'local' | 's3';

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



  static usesS3(): boolean {

    return S3StorageService.isEnabled();

  }



  static getDataDir(): string {

    if (this.usesS3()) {

      return `s3://${S3StorageService.getBucket()}/historical/`;

    }

    return this.dataDir;

  }



  static ensureDataDir(): void {

    if (this.usesS3()) return;

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



  static async saveSymbolData(symbol: string, bars: OHLCVBar[]): Promise<DatasetMeta> {

    const payload = {

      symbol,

      collectedAt: new Date().toISOString(),

      bars

    };

    const json = JSON.stringify(payload, null, 2);



    if (this.usesS3()) {

      await S3StorageService.putObject(S3StorageService.keyForSymbol(symbol), json);

      return {

        symbol,

        bars: bars.length,

        startDate: bars[0]?.date || '',

        endDate: bars[bars.length - 1]?.date || '',

        filePath: `s3://${S3StorageService.getBucket()}/${S3StorageService.keyForSymbol(symbol)}`,

        storage: 's3'

      };

    }



    this.ensureDataDir();

    const filePath = this.getSymbolPath(symbol);

    fs.writeFileSync(filePath, json);

    return {

      symbol,

      bars: bars.length,

      startDate: bars[0]?.date || '',

      endDate: bars[bars.length - 1]?.date || '',

      filePath,

      storage: 'local'

    };

  }



  static async loadSymbolData(symbol: string): Promise<OHLCVBar[]> {

    if (this.usesS3()) {

      const raw = await S3StorageService.getObject(S3StorageService.keyForSymbol(symbol));

      if (!raw) return [];

      const parsed = JSON.parse(raw);

      return parsed.bars || parsed;

    }



    const filePath = this.getSymbolPath(symbol);

    if (!fs.existsSync(filePath)) return [];

    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    return raw.bars || raw;

  }



  static async hasLocalData(symbol: string): Promise<boolean> {

    if (this.usesS3()) {

      const data = await S3StorageService.getObject(S3StorageService.keyForSymbol(symbol));

      return Boolean(data);

    }

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

      storage: this.usesS3() ? 's3' : 'local',

      symbols: success,

      failed

    };



    const manifestJson = JSON.stringify(manifest, null, 2);

    if (this.usesS3()) {

      await S3StorageService.putObject(S3StorageService.manifestKey(), manifestJson);

    } else {

      fs.writeFileSync(path.join(this.dataDir, 'manifest.json'), manifestJson);

    }



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



  static async getManifest(): Promise<Record<string, unknown> | null> {

    if (this.usesS3()) {

      const raw = await S3StorageService.getObject(S3StorageService.manifestKey());

      return raw ? JSON.parse(raw) : null;

    }

    const manifestPath = path.join(this.dataDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) return null;

    return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  }



  static async listLocalDatasets(): Promise<DatasetMeta[]> {

    if (this.usesS3()) {

      const keys = await S3StorageService.listSymbolKeys();

      const datasets: DatasetMeta[] = [];

      for (const key of keys) {

        const symbol = path.basename(key, '.json');

        const bars = await this.loadSymbolData(symbol);

        datasets.push({

          symbol,

          bars: bars.length,

          startDate: bars[0]?.date || '',

          endDate: bars[bars.length - 1]?.date || '',

          filePath: `s3://${S3StorageService.getBucket()}/${key}`,

          storage: 's3'

        });

      }

      return datasets;

    }



    this.ensureDataDir();

    return fs.readdirSync(this.dataDir)

      .filter(f => f.endsWith('.json') && f !== 'manifest.json')

      .map(f => {

        const symbol = f.replace('.json', '');

        const filePath = path.join(this.dataDir, f);

        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const bars: OHLCVBar[] = raw.bars || raw;

        return {

          symbol,

          bars: bars.length,

          startDate: bars[0]?.date || '',

          endDate: bars[bars.length - 1]?.date || '',

          filePath,

          storage: 'local' as const

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



  static async getBarsForSymbol(symbol: string, minBars = 100): Promise<OHLCVBar[]> {

    const local = await this.loadSymbolData(symbol);

    if (local.length >= minBars) return local;

    return [];

  }



  static async getStorageStatus(): Promise<{

    storage: 's3' | 'local';

    location: string;

    connected: boolean;

  }> {

    if (this.usesS3()) {

      return {

        storage: 's3',

        location: this.getDataDir(),

        connected: await S3StorageService.checkConnection()

      };

    }

    return {

      storage: 'local',

      location: this.getDataDir(),

      connected: fs.existsSync(this.dataDir)

    };

  }

}


