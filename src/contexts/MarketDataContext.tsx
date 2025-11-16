/**
 * Market Data Context
 * Provides real-time market data throughout the application
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  marketDataService, 
  IndexData, 
  StockQuote, 
  SectorPerformance, 
  MarketBreadth 
} from '../services/marketDataService';
import { simulatedWebSocketService } from '../services/websocketService';

interface MarketDataContextType {
  indices: IndexData[];
  topGainers: StockQuote[];
  topLosers: StockQuote[];
  smallCapStocks: StockQuote[];
  sectorPerformance: SectorPerformance[];
  marketBreadth: MarketBreadth | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  getStockQuote: (symbol: string, exchange?: 'NSE' | 'BSE') => Promise<StockQuote | null>;
  searchStocks: (query: string) => Promise<Array<{ symbol: string; name: string; exchange: string }>>;
  subscribeToStock: (symbol: string, callback: (data: any) => void) => () => void;
}

const MarketDataContext = createContext<MarketDataContextType | undefined>(undefined);

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [topGainers, setTopGainers] = useState<StockQuote[]>([]);
  const [topLosers, setTopLosers] = useState<StockQuote[]>([]);
  const [smallCapStocks, setSmallCapStocks] = useState<StockQuote[]>([]);
  const [sectorPerformance, setSectorPerformance] = useState<SectorPerformance[]>([]);
  const [marketBreadth, setMarketBreadth] = useState<MarketBreadth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all market data
  const fetchMarketData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch data in parallel
      const [
        nseIndices,
        bseIndices,
        gainers,
        losers,
        smallCaps,
        sectors,
        breadth
      ] = await Promise.all([
        marketDataService.fetchNSEIndices(),
        marketDataService.fetchBSEIndices(),
        marketDataService.fetchTopGainers(10),
        marketDataService.fetchTopLosers(10),
        marketDataService.fetchSmallCapStocks(),
        marketDataService.fetchSectorPerformance(),
        marketDataService.fetchMarketBreadth()
      ]);

      // Combine NSE and BSE indices
      setIndices([...nseIndices, ...bseIndices]);
      setTopGainers(gainers);
      setTopLosers(losers);
      setSmallCapStocks(smallCaps);
      setSectorPerformance(sectors);
      setMarketBreadth(breadth);
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Failed to fetch market data. Using cached/fallback data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchMarketData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchMarketData, 30000);

    return () => clearInterval(interval);
  }, [fetchMarketData]);

  // Set up real-time updates for indices
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    // Subscribe to major indices
    const indexNames = ['NIFTY 50', 'SENSEX', 'NIFTY BANK', 'NIFTY IT'];
    
    indexNames.forEach(indexName => {
      const unsubscribe = simulatedWebSocketService.subscribe(
        `index:${indexName}`,
        (data) => {
          setIndices(prevIndices => {
            const index = prevIndices.findIndex(idx => idx.name === data.name);
            if (index !== -1) {
              const updated = [...prevIndices];
              updated[index] = { ...updated[index], ...data };
              return updated;
            }
            return prevIndices;
          });
        }
      );
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Get stock quote
  const getStockQuote = useCallback(async (
    symbol: string, 
    exchange: 'NSE' | 'BSE' = 'NSE'
  ): Promise<StockQuote | null> => {
    try {
      if (exchange === 'NSE') {
        return await marketDataService.fetchNSEStockQuote(symbol);
      } else {
        return await marketDataService.fetchBSEStockQuote(symbol);
      }
    } catch (err) {
      console.error(`Error fetching quote for ${symbol}:`, err);
      return null;
    }
  }, []);

  // Search stocks
  const searchStocks = useCallback(async (query: string) => {
    try {
      return await marketDataService.searchStocks(query);
    } catch (err) {
      console.error('Error searching stocks:', err);
      return [];
    }
  }, []);

  // Subscribe to stock updates
  const subscribeToStock = useCallback((
    symbol: string, 
    callback: (data: any) => void
  ): (() => void) => {
    return simulatedWebSocketService.subscribe(`stock:${symbol}`, callback);
  }, []);

  // Refresh data manually
  const refreshData = useCallback(async () => {
    await fetchMarketData();
  }, [fetchMarketData]);

  const value: MarketDataContextType = {
    indices,
    topGainers,
    topLosers,
    smallCapStocks,
    sectorPerformance,
    marketBreadth,
    isLoading,
    error,
    refreshData,
    getStockQuote,
    searchStocks,
    subscribeToStock
  };

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

// Custom hook to use market data
export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (context === undefined) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
}

// Hook for subscribing to specific stock
export function useStockData(symbol: string, exchange: 'NSE' | 'BSE' = 'NSE') {
  const { getStockQuote, subscribeToStock } = useMarketData();
  const [stockData, setStockData] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initial fetch
    getStockQuote(symbol, exchange).then(data => {
      if (mounted) {
        setStockData(data);
        setLoading(false);
      }
    });

    // Subscribe to real-time updates
    const unsubscribe = subscribeToStock(symbol, (data) => {
      if (mounted) {
        setStockData(prevData => prevData ? { ...prevData, ...data } : data);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [symbol, exchange, getStockQuote, subscribeToStock]);

  return { stockData, loading };
}

// Hook for watching multiple stocks
export function useWatchlist(symbols: string[]) {
  const { getStockQuote, subscribeToStock } = useMarketData();
  const [watchlistData, setWatchlistData] = useState<Map<string, StockQuote>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const unsubscribers: Array<() => void> = [];

    // Fetch initial data for all symbols
    Promise.all(
      symbols.map(symbol => getStockQuote(symbol))
    ).then(quotes => {
      if (mounted) {
        const dataMap = new Map<string, StockQuote>();
        quotes.forEach(quote => {
          if (quote) {
            dataMap.set(quote.symbol, quote);
          }
        });
        setWatchlistData(dataMap);
        setLoading(false);
      }
    });

    // Subscribe to updates for all symbols
    symbols.forEach(symbol => {
      const unsubscribe = subscribeToStock(symbol, (data) => {
        if (mounted) {
          setWatchlistData(prev => {
            const updated = new Map(prev);
            const existing = updated.get(symbol);
            updated.set(symbol, existing ? { ...existing, ...data } : data);
            return updated;
          });
        }
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      mounted = false;
      unsubscribers.forEach(unsub => unsub());
    };
  }, [symbols.join(','), getStockQuote, subscribeToStock]);

  return { watchlistData: Array.from(watchlistData.values()), loading };
}
