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
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
  marketCap?: number;
  timestamp: Date | string;
}

export interface IndexData {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  high: number | null;
  low: number | null;
  open: number | null;
  previousClose: number | null;
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
      const text = await res.text();
      if (!text.trim()) return null;
      const json = JSON.parse(text);
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

    const data = await this.fetchJson<Array<{ name: string; value: number; change: number; changePercent: number; high?: number; low?: number; open?: number; previousClose?: number; timestamp?: string }>>('/market/indices');
    if (data?.length) {
      const indices = data.map(item => ({
        name: item.name,
        value: item.value,
        change: item.change,
        changePercent: item.changePercent,
        high: item.high ?? null,
        low: item.low ?? null,
        open: item.open ?? null,
        previousClose: item.previousClose ?? null,
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
      }));
      this.setCache(cacheKey, indices);
      return indices;
    }
    return [];
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
        high: data.high ?? null,
        low: data.low ?? null,
        open: data.open ?? null,
        previousClose: data.previousClose ?? null,
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
    return data?.length ? data : [];
  }

  async fetchMarketBreadth(): Promise<MarketBreadth | null> {
    const data = await this.fetchJson<MarketBreadth>('/market/breadth');
    return data || null;
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
}

export const marketDataService = new MarketDataService();
