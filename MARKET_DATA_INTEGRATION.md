# Market Data Integration Guide

## Overview

This document describes the real-time market data integration for NSE, BSE, and smallcap stocks in the SmartTrade Portfolio Optimizer.

## Features

### 1. Real-time Data Sources
- **NSE (National Stock Exchange)**: Live indices, stock quotes, and market data
- **BSE (Bombay Stock Exchange)**: SENSEX and BSE stock quotes
- **Smallcap Stocks**: NIFTY SMALLCAP 100 constituents
- **Top Gainers/Losers**: Real-time tracking of best and worst performers

### 2. Data Services

#### Market Data Service (`src/services/marketDataService.ts`)
Provides REST API integration with NSE and BSE:

```typescript
import { marketDataService } from './services/marketDataService';

// Fetch NSE indices (NIFTY 50, NIFTY BANK, etc.)
const indices = await marketDataService.fetchNSEIndices();

// Fetch BSE indices (SENSEX)
const bseIndices = await marketDataService.fetchBSEIndices();

// Get stock quote
const quote = await marketDataService.fetchNSEStockQuote('RELIANCE');

// Top gainers and losers
const gainers = await marketDataService.fetchTopGainers(10);
const losers = await marketDataService.fetchTopLosers(10);

// Smallcap stocks
const smallcaps = await marketDataService.fetchSmallCapStocks();

// Sector performance
const sectors = await marketDataService.fetchSectorPerformance();

// Market breadth
const breadth = await marketDataService.fetchMarketBreadth();

// Search stocks
const results = await marketDataService.searchStocks('TATA');
```

#### WebSocket Service (`src/services/websocketService.ts`)
Provides real-time updates via WebSocket:

```typescript
import { websocketService } from './services/websocketService';

// Connect to WebSocket server
websocketService.connect({ url: 'wss://your-websocket-server.com' });

// Subscribe to stock updates
const unsubscribe = websocketService.subscribeToStock('RELIANCE', (data) => {
  console.log('Stock update:', data);
});

// Subscribe to index updates
websocketService.subscribeToIndex('NIFTY 50', (data) => {
  console.log('Index update:', data);
});

// Unsubscribe when done
unsubscribe();
```

### 3. React Context Provider

#### MarketDataContext (`src/contexts/MarketDataContext.tsx`)
Global state management for market data:

```typescript
import { useMarketData } from './contexts/MarketDataContext';

function MyComponent() {
  const {
    indices,           // All major indices
    topGainers,        // Top gaining stocks
    topLosers,         // Top losing stocks
    smallCapStocks,    // Smallcap stocks
    sectorPerformance, // Sector-wise performance
    marketBreadth,     // Market breadth data
    isLoading,         // Loading state
    error,             // Error message
    refreshData,       // Manual refresh function
    getStockQuote,     // Fetch individual stock
    searchStocks,      // Search stocks
    subscribeToStock   // Subscribe to real-time updates
  } = useMarketData();

  return (
    <div>
      {indices.map(index => (
        <div key={index.name}>
          {index.name}: {index.value} ({index.changePercent}%)
        </div>
      ))}
    </div>
  );
}
```

#### Custom Hooks

**useStockData** - Track a single stock:
```typescript
import { useStockData } from './contexts/MarketDataContext';

function StockWidget({ symbol }) {
  const { stockData, loading } = useStockData(symbol, 'NSE');
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {stockData?.symbol}: ₹{stockData?.price}
    </div>
  );
}
```

**useWatchlist** - Track multiple stocks:
```typescript
import { useWatchlist } from './contexts/MarketDataContext';

function Watchlist() {
  const symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFC'];
  const { watchlistData, loading } = useWatchlist(symbols);
  
  return (
    <div>
      {watchlistData.map(stock => (
        <div key={stock.symbol}>
          {stock.symbol}: ₹{stock.price}
        </div>
      ))}
    </div>
  );
}
```

### 4. Components

#### LiveMarketData (`src/components/LiveMarketData.tsx`)
Displays real-time market overview:
- Major indices (NIFTY 50, SENSEX, NIFTY BANK, NIFTY IT)
- Intraday performance charts
- Sector performance heatmap
- Market breadth indicators

#### SmallCapStocksTracker (`src/components/SmallCapStocksTracker.tsx`)
Comprehensive stock tracking with:
- Smallcap stocks list
- Top gainers and losers
- Search functionality
- Real-time price updates
- Volume and price range data

## API Endpoints

### NSE India API
- **Base URL**: `https://www.nseindia.com/api`
- **Indices**: `/allIndices`
- **Stock Quote**: `/quote-equity?symbol={SYMBOL}`
- **Top Gainers**: `/live-analysis-variations?index=gainers`
- **Top Losers**: `/live-analysis-variations?index=loosers`
- **Smallcap**: `/equity-stockIndices?index=NIFTY%20SMALLCAP%20100`
- **Search**: `/search/autocomplete?q={QUERY}`

### BSE India API
- **Base URL**: `https://api.bseindia.com`
- **Indices**: `/BseIndiaAPI/api/DefaultData/w`
- **Stock Quote**: `/BseIndiaAPI/api/StockReachGraph/w?scripcode={CODE}`

## Data Refresh Strategy

1. **Initial Load**: All data fetched on component mount
2. **Auto-refresh**: Data refreshes every 30 seconds
3. **Manual Refresh**: User can trigger refresh via button
4. **Real-time Updates**: WebSocket provides live updates for subscribed stocks
5. **Caching**: 5-second cache to prevent excessive API calls

## Error Handling

- **Fallback Data**: Uses cached/mock data when API fails
- **Error Messages**: User-friendly error notifications
- **Retry Logic**: Automatic reconnection for WebSocket
- **CORS Handling**: Proxy configuration for development

## CORS Configuration

For development, you may need to configure a proxy. Add to `vite.config.ts`:

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api/nse': {
        target: 'https://www.nseindia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nse/, '/api')
      },
      '/api/bse': {
        target: 'https://api.bseindia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bse/, '')
      }
    }
  }
});
```

## Usage Example

```typescript
import { MarketDataProvider } from './contexts/MarketDataContext';
import { LiveMarketData } from './components/LiveMarketData';
import { SmallCapStocksTracker } from './components/SmallCapStocksTracker';

function App() {
  return (
    <MarketDataProvider>
      <div>
        <LiveMarketData />
        <SmallCapStocksTracker />
      </div>
    </MarketDataProvider>
  );
}
```

## Data Types

```typescript
interface StockQuote {
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

interface IndexData {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: Date;
}

interface SectorPerformance {
  sector: string;
  change: number;
  stocks: number;
  advancers: number;
  decliners: number;
}

interface MarketBreadth {
  advances: number;
  declines: number;
  unchanged: number;
  fiftyTwoWeekHighs: number;
  fiftyTwoWeekLows: number;
  fiiActivity: number;
  diiActivity: number;
}
```

## Performance Optimization

1. **Memoization**: React components use `useMemo` and `useCallback`
2. **Lazy Loading**: Components load data on demand
3. **Virtualization**: Large lists use virtual scrolling
4. **Debouncing**: Search queries are debounced
5. **Caching**: API responses cached for 5 seconds

## Future Enhancements

- [ ] Historical data charts
- [ ] Options chain data
- [ ] Futures and derivatives
- [ ] Corporate actions
- [ ] News integration
- [ ] Technical indicators
- [ ] Custom alerts
- [ ] Portfolio tracking with live P&L

## Troubleshooting

### API Rate Limiting
If you encounter rate limiting:
- Increase cache timeout
- Reduce refresh frequency
- Implement exponential backoff

### CORS Issues
- Use proxy server for development
- Configure proper CORS headers in production
- Consider using official broker APIs

### WebSocket Connection
- Check firewall settings
- Verify WebSocket server URL
- Implement reconnection logic

## License & Disclaimer

This integration is for educational purposes. Always comply with exchange terms of service and data usage policies. Real-time data may require paid subscriptions from official data providers.
