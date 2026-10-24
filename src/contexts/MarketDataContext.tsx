/**
 * Market Data Context — live updates via Socket.IO + REST fallback polling.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  marketDataService,
  IndexData,
  StockQuote,
  SectorPerformance,
  MarketBreadth
} from '../services/marketDataService';
import { liveMarketSocket } from '../services/liveMarketSocket';

interface MarketDataContextType {
  indices: IndexData[];
  topGainers: StockQuote[];
  topLosers: StockQuote[];
  smallCapStocks: StockQuote[];
  sectorPerformance: SectorPerformance[];
  marketBreadth: MarketBreadth | null;
  isLoading: boolean;
  isLive: boolean;
  lastUpdated: Date | null;
  error: string | null;
  refreshData: () => Promise<void>;
  getStockQuote: (symbol: string, exchange?: 'NSE' | 'BSE') => Promise<StockQuote | null>;
  searchStocks: (query: string) => Promise<Array<{ symbol: string; name: string; exchange: string }>>;
  subscribeToStock: (symbol: string, callback: (data: Record<string, unknown>) => void) => () => void;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

const POLL_MS = 15000;
const INDEX_CHANNELS = ['index:NIFTY 50', 'index:SENSEX', 'index:NIFTY BANK', 'index:NIFTY IT'];

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [topGainers, setTopGainers] = useState<StockQuote[]>([]);
  const [topLosers, setTopLosers] = useState<StockQuote[]>([]);
  const [smallCapStocks, setSmallCapStocks] = useState<StockQuote[]>([]);
  const [sectorPerformance, setSectorPerformance] = useState<SectorPerformance[]>([]);
  const [marketBreadth, setMarketBreadth] = useState<MarketBreadth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mapIndices = (data: Array<{
    name: string; value: number; change: number; changePercent: number;
    high?: number; low?: number; open?: number; previousClose?: number; timestamp?: string;
  }>): IndexData[] =>
    data.map(item => {
      let change = Number(item.change) || 0;
      let changePercent = Number(item.changePercent) || 0;
      const prev = Number(item.previousClose);
      const value = Number(item.value);
      if (Math.abs(changePercent) < 0.001 && prev > 0 && value > 0 && Math.abs(value - prev) > 0.05) {
        change = value - prev;
        changePercent = (change / prev) * 100;
      }
      return {
        name: item.name,
        value,
        change,
        changePercent,
        high: item.high ?? null,
        low: item.low ?? null,
        open: item.open ?? null,
        previousClose: item.previousClose ?? null,
        timestamp: item.timestamp ? new Date(item.timestamp) : new Date()
      };
    });

  const fetchIndices = useCallback(async () => {
    try {
      const nseIndices = await marketDataService.fetchNSEIndices();
      if (nseIndices.length) {
        setIndices(nseIndices);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching indices:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchMarketExtras = useCallback(async () => {
    try {
      const [gainers, losers, smallCaps, sectors, breadth] = await Promise.all([
        marketDataService.fetchTopGainers(10),
        marketDataService.fetchTopLosers(10),
        marketDataService.fetchSmallCapStocks(),
        marketDataService.fetchSectorPerformance(),
        marketDataService.fetchMarketBreadth()
      ]);
      setTopGainers(gainers);
      setTopLosers(losers);
      setSmallCapStocks(smallCaps);
      setSectorPerformance(sectors);
      setMarketBreadth(breadth);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching market extras:', err);
    }
  }, []);

  useEffect(() => {
    void fetchIndices();
    void fetchMarketExtras();
    const indexTimer = setInterval(() => void fetchIndices(), POLL_MS);
    const extraTimer = setInterval(() => void fetchMarketExtras(), POLL_MS * 2);
    return () => {
      clearInterval(indexTimer);
      clearInterval(extraTimer);
    };
  }, [fetchIndices, fetchMarketExtras]);

  useEffect(() => {
    liveMarketSocket.subscribe(INDEX_CHANNELS);

    const unsubs = [
      liveMarketSocket.onIndices((data) => {
        if (Array.isArray(data) && data.length) {
          setIndices(mapIndices(data as Array<{
            name: string; value: number; change: number; changePercent: number;
            high?: number; low?: number; open?: number; previousClose?: number; timestamp?: string;
          }>));
          setLastUpdated(new Date());
          setIsLive(true);
        }
      }),
      liveMarketSocket.onGainers((data) => {
        if (Array.isArray(data)) {
          setTopGainers(data as StockQuote[]);
          setLastUpdated(new Date());
          setIsLive(true);
        }
      }),
      liveMarketSocket.onLosers((data) => {
        if (Array.isArray(data)) {
          setTopLosers(data as StockQuote[]);
          setLastUpdated(new Date());
          setIsLive(true);
        }
      }),
      liveMarketSocket.onSectors((data) => {
        if (Array.isArray(data)) {
          setSectorPerformance(data as SectorPerformance[]);
          setLastUpdated(new Date());
          setIsLive(true);
        }
      }),
      liveMarketSocket.onBreadth((data) => {
        if (data && typeof data === 'object') {
          setMarketBreadth(data as MarketBreadth);
          setLastUpdated(new Date());
          setIsLive(true);
        }
      })
    ];

    const liveCheck = setInterval(() => {
      setIsLive(liveMarketSocket.isConnected());
    }, 3000);

    return () => {
      unsubs.forEach(u => u());
      clearInterval(liveCheck);
      liveMarketSocket.disconnect();
    };
  }, []);

  const getStockQuote = useCallback(async (symbol: string, exchange: 'NSE' | 'BSE' = 'NSE') => {
    try {
      return exchange === 'NSE'
        ? await marketDataService.fetchNSEStockQuote(symbol)
        : await marketDataService.fetchBSEStockQuote(symbol);
    } catch {
      return null;
    }
  }, []);

  const searchStocks = useCallback(async (query: string) => {
    try {
      return await marketDataService.searchStocks(query);
    } catch {
      return [];
    }
  }, []);

  const subscribeToStock = useCallback((symbol: string, callback: (data: Record<string, unknown>) => void) => {
    return liveMarketSocket.onTick(`stock:${symbol}`, callback);
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([fetchIndices(), fetchMarketExtras()]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchIndices, fetchMarketExtras]);

  return (
    <MarketDataContext.Provider
      value={{
        indices,
        topGainers,
        topLosers,
        smallCapStocks,
        sectorPerformance,
        marketBreadth,
        isLoading,
        isLive,
        lastUpdated,
        error,
        refreshData,
        getStockQuote,
        searchStocks,
        subscribeToStock
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (!context) throw new Error('useMarketData must be used within MarketDataProvider');
  return context;
}

export function useStockData(symbol: string, exchange: 'NSE' | 'BSE' = 'NSE') {
  const { getStockQuote, subscribeToStock } = useMarketData();
  const [stockData, setStockData] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getStockQuote(symbol, exchange).then(data => {
      if (mounted) {
        setStockData(data);
        setLoading(false);
      }
    });
    const unsubscribe = subscribeToStock(symbol, (data) => {
      if (mounted) {
        setStockData(prev => (prev ? { ...prev, ...data } as StockQuote : (data as StockQuote)));
      }
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [symbol, exchange, getStockQuote, subscribeToStock]);

  return { stockData, loading };
}
