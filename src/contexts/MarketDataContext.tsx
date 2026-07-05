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

  const mapIndices = (data: Array<{ name: string; value: number; change: number; changePercent: number }>): IndexData[] =>
    data.map(item => ({
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

  const fetchMarketData = useCallback(async () => {
    try {
      setError(null);
      const [nseIndices, bseIndices, gainers, losers, smallCaps, sectors, breadth] = await Promise.all([
        marketDataService.fetchNSEIndices(),
        marketDataService.fetchBSEIndices(),
        marketDataService.fetchTopGainers(10),
        marketDataService.fetchTopLosers(10),
        marketDataService.fetchSmallCapStocks(),
        marketDataService.fetchSectorPerformance(),
        marketDataService.fetchMarketBreadth()
      ]);

      setIndices([...nseIndices, ...bseIndices]);
      setTopGainers(gainers);
      setTopLosers(losers);
      setSmallCapStocks(smallCaps);
      setSectorPerformance(sectors);
      setMarketBreadth(breadth);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Failed to fetch market data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, POLL_MS);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  useEffect(() => {
    liveMarketSocket.subscribe(INDEX_CHANNELS);

    const unsubs = [
      liveMarketSocket.onIndices((data) => {
        if (Array.isArray(data)) {
          setIndices(mapIndices(data as Array<{ name: string; value: number; change: number; changePercent: number }>));
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
    await fetchMarketData();
  }, [fetchMarketData]);

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
