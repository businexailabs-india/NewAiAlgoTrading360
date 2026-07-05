/**
 * Market Data Service
 * Integrates with NSE, BSE, and other Indian stock market data providers
 * 
 * Data Sources:
 * - NSE India Official API
 * - BSE India Official API
 * - Yahoo Finance (for backup/historical data)
 * - Alpha Vantage (optional)
 */

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
  timestamp: Date;
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
  private apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  private baseUrlNSE = 'https://www.nseindia.com/api';
  private baseUrlBSE = 'https://api.bseindia.com';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5000; // 5 seconds cache

  // Headers required for NSE API
  private nseHeaders = {
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };

  /**
   * Fetch NSE Index Data (NIFTY 50, NIFTY BANK, etc.)
   */
  async fetchNSEIndices(): Promise<IndexData[]> {
    try {
      const cacheKey = 'nse_indices';
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Try backend live indices (Yahoo Finance)
      const backendRes = await fetch(`${this.apiBaseUrl}/market/indices`);
      if (backendRes.ok) {
        const { data } = await backendRes.json();
        const indices: IndexData[] = data.map((item: { name: string; value: number; change: number; changePercent: number }) => ({
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

      // NSE API endpoint for indices
      const response = await fetch(`${this.baseUrlNSE}/allIndices`, {
        headers: this.nseHeaders
      });

      if (!response.ok) {
        throw new Error('Failed to fetch NSE indices');
      }

      const data = await response.json();
      
      const indices: IndexData[] = data.data
        .filter((item: any) => ['NIFTY 50', 'NIFTY BANK', 'NIFTY IT', 'NIFTY MIDCAP 50', 'NIFTY SMALLCAP 50'].includes(item.indexName))
        .map((item: any) => ({
          name: item.indexName,
          value: parseFloat(item.last),
          change: parseFloat(item.change),
          changePercent: parseFloat(item.percentChange),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          open: parseFloat(item.open),
          previousClose: parseFloat(item.previousClose),
          timestamp: new Date(item.timeVal)
        }));

      this.setCache(cacheKey, indices);
      return indices;
    } catch (error) {
      console.error('Error fetching NSE indices:', error);
      return this.getFallbackIndices();
    }
  }

  /**
   * Fetch BSE Index Data (SENSEX, BSE 500, etc.)
   */
  async fetchBSEIndices(): Promise<IndexData[]> {
    try {
      const cacheKey = 'bse_indices';
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // BSE API endpoint
      const response = await fetch(`${this.baseUrlBSE}/BseIndiaAPI/api/DefaultData/w`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch BSE indices');
      }

      const data = await response.json();
      
      const indices: IndexData[] = [{
        name: 'SENSEX',
        value: parseFloat(data.Table[0].CurrIndexValue),
        change: parseFloat(data.Table[0].Change),
        changePercent: parseFloat(data.Table[0].PChange),
        high: parseFloat(data.Table[0].High),
        low: parseFloat(data.Table[0].Low),
        open: parseFloat(data.Table[0].Open),
        previousClose: parseFloat(data.Table[0].PrevClose),
        timestamp: new Date()
      }];

      this.setCache(cacheKey, indices);
      return indices;
    } catch (error) {
      console.error('Error fetching BSE indices:', error);
      return [];
    }
  }

  /**
   * Fetch stock quote from NSE
   */
  async fetchNSEStockQuote(symbol: string): Promise<StockQuote | null> {
    try {
      const cacheKey = `nse_stock_${symbol}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Try backend live market API first (Yahoo/broker feed)
      const token = localStorage.getItem('authToken');
      const backendRes = await fetch(`${this.apiBaseUrl}/market/quote/${symbol}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (backendRes.ok) {
        const { data } = await backendRes.json();
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
      }

      const response = await fetch(`${this.baseUrlNSE}/quote-equity?symbol=${symbol}`, {
        headers: this.nseHeaders
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch quote for ${symbol}`);
      }

      const data = await response.json();
      const priceInfo = data.priceInfo;

      const quote: StockQuote = {
        symbol: symbol,
        name: data.info.companyName,
        exchange: 'NSE',
        price: parseFloat(priceInfo.lastPrice),
        change: parseFloat(priceInfo.change),
        changePercent: parseFloat(priceInfo.pChange),
        volume: parseInt(priceInfo.totalTradedVolume),
        high: parseFloat(priceInfo.intraDayHighLow.max),
        low: parseFloat(priceInfo.intraDayHighLow.min),
        open: parseFloat(priceInfo.open),
        previousClose: parseFloat(priceInfo.previousClose),
        marketCap: data.metadata?.marketCap,
        timestamp: new Date()
      };

      this.setCache(cacheKey, quote);
      return quote;
    } catch (error) {
      console.error(`Error fetching NSE quote for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Fetch stock quote from BSE
   */
  async fetchBSEStockQuote(scripCode: string): Promise<StockQuote | null> {
    try {
      const cacheKey = `bse_stock_${scripCode}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      const response = await fetch(`${this.baseUrlBSE}/BseIndiaAPI/api/StockReachGraph/w?scripcode=${scripCode}&flag=0`, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch BSE quote for ${scripCode}`);
      }

      const data = await response.json();

      const quote: StockQuote = {
        symbol: scripCode,
        name: data.Company_Name || scripCode,
        exchange: 'BSE',
        price: parseFloat(data.CurrRate?.LTP || 0),
        change: parseFloat(data.CurrRate?.Chg || 0),
        changePercent: parseFloat(data.CurrRate?.ChgPer || 0),
        volume: parseInt(data.Volume || 0),
        high: parseFloat(data.High || 0),
        low: parseFloat(data.Low || 0),
        open: parseFloat(data.Open || 0),
        previousClose: parseFloat(data.PrevClose || 0),
        timestamp: new Date()
      };

      this.setCache(cacheKey, quote);
      return quote;
    } catch (error) {
      console.error(`Error fetching BSE quote for ${scripCode}:`, error);
      return null;
    }
  }

  /**
   * Fetch top gainers from NSE
   */
  async fetchTopGainers(count: number = 10): Promise<StockQuote[]> {
    try {
      const response = await fetch(`${this.baseUrlNSE}/live-analysis-variations?index=gainers`, {
        headers: this.nseHeaders
      });

      if (!response.ok) {
        throw new Error('Failed to fetch top gainers');
      }

      const data = await response.json();
      
      return data.NIFTY.data.slice(0, count).map((item: any) => ({
        symbol: item.symbol,
        name: item.meta?.companyName || item.symbol,
        exchange: 'NSE' as const,
        price: parseFloat(item.lastPrice),
        change: parseFloat(item.change),
        changePercent: parseFloat(item.pChange),
        volume: parseInt(item.totalTradedVolume),
        high: parseFloat(item.dayHigh),
        low: parseFloat(item.dayLow),
        open: parseFloat(item.open),
        previousClose: parseFloat(item.previousClose),
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('Error fetching top gainers:', error);
      return [];
    }
  }

  /**
   * Fetch top losers from NSE
   */
  async fetchTopLosers(count: number = 10): Promise<StockQuote[]> {
    try {
      const response = await fetch(`${this.baseUrlNSE}/live-analysis-variations?index=loosers`, {
        headers: this.nseHeaders
      });

      if (!response.ok) {
        throw new Error('Failed to fetch top losers');
      }

      const data = await response.json();
      
      return data.NIFTY.data.slice(0, count).map((item: any) => ({
        symbol: item.symbol,
        name: item.meta?.companyName || item.symbol,
        exchange: 'NSE' as const,
        price: parseFloat(item.lastPrice),
        change: parseFloat(item.change),
        changePercent: parseFloat(item.pChange),
        volume: parseInt(item.totalTradedVolume),
        high: parseFloat(item.dayHigh),
        low: parseFloat(item.dayLow),
        open: parseFloat(item.open),
        previousClose: parseFloat(item.previousClose),
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('Error fetching top losers:', error);
      return [];
    }
  }

  /**
   * Fetch smallcap stocks
   */
  async fetchSmallCapStocks(): Promise<StockQuote[]> {
    try {
      const response = await fetch(`${this.baseUrlNSE}/equity-stockIndices?index=NIFTY%20SMALLCAP%20100`, {
        headers: this.nseHeaders
      });

      if (!response.ok) {
        throw new Error('Failed to fetch smallcap stocks');
      }

      const data = await response.json();
      
      return data.data.slice(0, 20).map((item: any) => ({
        symbol: item.symbol,
        name: item.meta?.companyName || item.symbol,
        exchange: 'NSE' as const,
        price: parseFloat(item.lastPrice),
        change: parseFloat(item.change),
        changePercent: parseFloat(item.pChange),
        volume: parseInt(item.totalTradedVolume),
        high: parseFloat(item.dayHigh),
        low: parseFloat(item.dayLow),
        open: parseFloat(item.open),
        previousClose: parseFloat(item.previousClose),
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('Error fetching smallcap stocks:', error);
      return [];
    }
  }

  /**
   * Fetch sector performance
   */
  async fetchSectorPerformance(): Promise<SectorPerformance[]> {
    try {
      const sectors = [
        'NIFTY IT',
        'NIFTY BANK',
        'NIFTY AUTO',
        'NIFTY PHARMA',
        'NIFTY FMCG',
        'NIFTY ENERGY',
        'NIFTY METAL',
        'NIFTY REALTY'
      ];

      const response = await fetch(`${this.baseUrlNSE}/allIndices`, {
        headers: this.nseHeaders
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sector performance');
      }

      const data = await response.json();
      
      return data.data
        .filter((item: any) => sectors.includes(item.indexName))
        .map((item: any) => ({
          sector: item.indexName.replace('NIFTY ', ''),
          change: parseFloat(item.percentChange),
          stocks: item.advances + item.declines,
          advancers: item.advances || 0,
          decliners: item.declines || 0
        }));
    } catch (error) {
      console.error('Error fetching sector performance:', error);
      return this.getFallbackSectorPerformance();
    }
  }

  /**
   * Fetch market breadth data
   */
  async fetchMarketBreadth(): Promise<MarketBreadth> {
    try {
      const response = await fetch(`${this.baseUrlNSE}/market-data-pre-open?key=ALL`, {
        headers: this.nseHeaders
      });

      if (!response.ok) {
        throw new Error('Failed to fetch market breadth');
      }

      const data = await response.json();
      
      return {
        advances: data.advances || 0,
        declines: data.declines || 0,
        unchanged: data.unchanged || 0,
        fiftyTwoWeekHighs: data.fiftyTwoWeekHighs || 0,
        fiftyTwoWeekLows: data.fiftyTwoWeekLows || 0,
        fiiActivity: 0, // Requires separate API call
        diiActivity: 0  // Requires separate API call
      };
    } catch (error) {
      console.error('Error fetching market breadth:', error);
      return {
        advances: 1234,
        declines: 867,
        unchanged: 145,
        fiftyTwoWeekHighs: 89,
        fiftyTwoWeekLows: 23,
        fiiActivity: 2345,
        diiActivity: 1567
      };
    }
  }

  /**
   * Search stocks by symbol or name
   */
  async searchStocks(query: string): Promise<Array<{ symbol: string; name: string; exchange: string }>> {
    try {
      const response = await fetch(`${this.baseUrlNSE}/search/autocomplete?q=${encodeURIComponent(query)}`, {
        headers: this.nseHeaders
      });

      if (!response.ok) {
        throw new Error('Failed to search stocks');
      }

      const data = await response.json();
      
      return data.symbols.map((item: any) => ({
        symbol: item.symbol,
        name: item.symbol_info,
        exchange: 'NSE'
      }));
    } catch (error) {
      console.error('Error searching stocks:', error);
      return [];
    }
  }

  // Cache management
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Fallback data for when API fails
  private getFallbackIndices(): IndexData[] {
    return [
      {
        name: 'NIFTY 50',
        value: 21845.75,
        change: 245.30,
        changePercent: 1.13,
        high: 21900,
        low: 21600,
        open: 21650,
        previousClose: 21600.45,
        timestamp: new Date()
      },
      {
        name: 'SENSEX',
        value: 72456.45,
        change: 412.80,
        changePercent: 0.57,
        high: 72500,
        low: 72000,
        open: 72100,
        previousClose: 72043.65,
        timestamp: new Date()
      },
      {
        name: 'NIFTY BANK',
        value: 46234.20,
        change: -123.45,
        changePercent: -0.27,
        high: 46400,
        low: 46200,
        open: 46350,
        previousClose: 46357.65,
        timestamp: new Date()
      },
      {
        name: 'NIFTY IT',
        value: 34567.90,
        change: 567.80,
        changePercent: 1.67,
        high: 34600,
        low: 34000,
        open: 34100,
        previousClose: 34000.10,
        timestamp: new Date()
      }
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
