/**
 * Market Data Service — all requests go through backend API (no direct NSE/BSE browser calls).
 */
import { API_BASE_URL } from '../lib/api';

export interface StockQuote {
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE';
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  marketCap?: number;
  timestamp: Date | string;
}

export interface IndexData {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: Date;
  data?: number[];
}

export interface SectorPerformance {
  sector: string;
  change: number;
  stocks: number;
  advancers: number;
  decliners: number;
}

export interface MarketBreadth {
  advances: number;
  declines: number;
  unchanged: number;
  fiftyTwoWeekHighs: number;
  fiftyTwoWeekLows: number;
  fiiActivity: number;
  diiActivity: number;
}

class MarketDataService {
  private apiBaseUrl = API_BASE_URL;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTimeout = 5000;

  private async fetchJson<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.apiBaseUrl}${path}`);
      if (!res.ok) return null;
      const json = await res.json();
      return json.data as T;
    } catch (err) {
      console.error(`Market API error (${path}):`, err);
      return null;
    }
  }

  async fetchNSEIndices(): Promise<IndexData[]> {
    const cacheKey = 'nse_indices';
    const cached = this.getFromCache<IndexData[]>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchJson<Array<{ name: string; value: number; change: number; changePercent: number }>>('/market/indices');
    if (data?.length) {
      const indices = data.map(item => ({
        name: item.name,
        value: item.value,
        change: item.change,
        changePercent: item.changePercent,
        high: item.value,
        low: item.value,
        open: item.value,
        previousClose: item.value - item.change,
        timestamp: new Date()
      }));
      this.setCache(cacheKey, indices);
      return indices;
    }
    return this.getFallbackIndices();
  }

  async fetchBSEIndices(): Promise<IndexData[]> {
    const all = await this.fetchNSEIndices();
    return all.filter(i => i.name === 'SENSEX');
  }

  async fetchNSEStockQuote(symbol: string): Promise<StockQuote | null> {
    const cacheKey = `nse_stock_${symbol}`;
    const cached = this.getFromCache<StockQuote>(cacheKey);
    if (cached) return cached;

    const token = localStorage.getItem('authToken');
    try {
      const res = await fetch(`${this.apiBaseUrl}/market/quote/${symbol}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) return null;
      const { data } = await res.json();
      const quote: StockQuote = {
        symbol,
        name: symbol,
        exchange: 'NSE',
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        volume: data.volume || 0,
        high: data.high || data.price,
        low: data.low || data.price,
        open: data.open || data.price,
        previousClose: data.price - data.change,
        timestamp: new Date(data.timestamp)
      };
      this.setCache(cacheKey, quote);
      return quote;
    } catch {
      return null;
    }
  }

  async fetchBSEStockQuote(scripCode: string): Promise<StockQuote | null> {
    return this.fetchNSEStockQuote(scripCode);
  }

  async fetchTopGainers(count = 10): Promise<StockQuote[]> {
    const data = await this.fetchJson<StockQuote[]>(`/market/gainers?count=${count}`);
    return data?.map(q => ({ ...q, timestamp: new Date(q.timestamp) })) || [];
  }

  async fetchTopLosers(count = 10): Promise<StockQuote[]> {
    const data = await this.fetchJson<StockQuote[]>(`/market/losers?count=${count}`);
    return data?.map(q => ({ ...q, timestamp: new Date(q.timestamp) })) || [];
  }

  async fetchSmallCapStocks(): Promise<StockQuote[]> {
    const data = await this.fetchJson<StockQuote[]>('/market/smallcap?count=20');
    return data?.map(q => ({ ...q, timestamp: new Date(q.timestamp) })) || [];
  }

  async fetchSectorPerformance(): Promise<SectorPerformance[]> {
    const data = await this.fetchJson<SectorPerformance[]>('/market/sectors');
    return data?.length ? data : this.getFallbackSectorPerformance();
  }

  async fetchMarketBreadth(): Promise<MarketBreadth> {
    const data = await this.fetchJson<MarketBreadth>('/market/breadth');
    return data || {
      advances: 1234,
      declines: 867,
      unchanged: 145,
      fiftyTwoWeekHighs: 89,
      fiftyTwoWeekLows: 23,
      fiiActivity: 0,
      diiActivity: 0
    };
  }

  async searchStocks(query: string): Promise<Array<{ symbol: string; name: string; exchange: string }>> {
    const data = await this.fetchJson<Array<{ symbol: string; name: string; exchange: string }>>(
      `/market/search?query=${encodeURIComponent(query)}`
    );
    return data || [];
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getFallbackIndices(): IndexData[] {
    return [
      { name: 'NIFTY 50', value: 21845.75, change: 245.3, changePercent: 1.13, high: 21900, low: 21600, open: 21650, previousClose: 21600.45, timestamp: new Date() },
      { name: 'SENSEX', value: 72456.45, change: 412.8, changePercent: 0.57, high: 72500, low: 72000, open: 72100, previousClose: 72043.65, timestamp: new Date() },
      { name: 'NIFTY BANK', value: 46234.2, change: -123.45, changePercent: -0.27, high: 46400, low: 46200, open: 46350, previousClose: 46357.65, timestamp: new Date() },
      { name: 'NIFTY IT', value: 34567.9, change: 567.8, changePercent: 1.67, high: 34600, low: 34000, open: 34100, previousClose: 34000.1, timestamp: new Date() }
    ];
  }

  private getFallbackSectorPerformance(): SectorPerformance[] {
    return [
      { sector: 'IT', change: 2.3, stocks: 50, advancers: 35, decliners: 15 },
      { sector: 'Banking', change: 1.8, stocks: 40, advancers: 28, decliners: 12 },
      { sector: 'Auto', change: 1.2, stocks: 30, advancers: 20, decliners: 10 },
      { sector: 'Pharma', change: 0.5, stocks: 35, advancers: 18, decliners: 17 },
      { sector: 'FMCG', change: -0.3, stocks: 25, advancers: 10, decliners: 15 },
      { sector: 'Energy', change: -0.8, stocks: 20, advancers: 8, decliners: 12 },
      { sector: 'Metals', change: -1.2, stocks: 28, advancers: 10, decliners: 18 },
      { sector: 'Realty', change: -1.5, stocks: 22, advancers: 7, decliners: 15 }
    ];
  }
}

export const marketDataService = new MarketDataService();
