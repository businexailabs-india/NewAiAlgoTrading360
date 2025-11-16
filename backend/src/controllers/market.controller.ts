import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import axios from 'axios';

// Mock market data for development
const mockMarketData = {
  'RELIANCE': { price: 2678.90, change: 28.40, changePercent: 1.07 },
  'TCS': { price: 3845.50, change: -15.30, changePercent: -0.40 },
  'INFY': { price: 1567.80, change: 12.60, changePercent: 0.81 },
  'HDFCBANK': { price: 1645.20, change: 8.90, changePercent: 0.54 },
  'ICICIBANK': { price: 1089.45, change: -5.20, changePercent: -0.47 }
};

export const getQuote = asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params;

  // In production, fetch from actual market data API
  const quote = mockMarketData[symbol as keyof typeof mockMarketData] || {
    price: 1000,
    change: 0,
    changePercent: 0
  };

  res.status(200).json({
    success: true,
    data: {
      symbol,
      ...quote,
      timestamp: new Date().toISOString()
    }
  });
});

export const getQuotes = asyncHandler(async (req: Request, res: Response) => {
  const { symbols } = req.body;

  if (!Array.isArray(symbols)) {
    res.status(400).json({
      success: false,
      message: 'Symbols must be an array'
    });
    return;
  }

  const quotes = symbols.map(symbol => ({
    symbol,
    ...(mockMarketData[symbol as keyof typeof mockMarketData] || {
      price: 1000,
      change: 0,
      changePercent: 0
    }),
    timestamp: new Date().toISOString()
  }));

  res.status(200).json({
    success: true,
    data: quotes
  });
});

export const getHistoricalData = asyncHandler(async (req: Request, res: Response) => {
  const { symbol } = req.params;
  const { from, to, interval } = req.query;

  // Mock historical data
  const data = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    open: 2600 + Math.random() * 100,
    high: 2650 + Math.random() * 100,
    low: 2550 + Math.random() * 100,
    close: 2600 + Math.random() * 100,
    volume: Math.floor(1000000 + Math.random() * 500000)
  }));

  res.status(200).json({
    success: true,
    data: {
      symbol,
      interval: interval || 'day',
      data
    }
  });
});

export const getIndices = asyncHandler(async (req: Request, res: Response) => {
  const indices = [
    {
      name: 'NIFTY 50',
      value: 21456.75,
      change: 145.30,
      changePercent: 0.68
    },
    {
      name: 'SENSEX',
      value: 71234.56,
      change: 234.50,
      changePercent: 0.33
    },
    {
      name: 'NIFTY BANK',
      value: 45678.90,
      change: -123.45,
      changePercent: -0.27
    },
    {
      name: 'NIFTY IT',
      value: 34567.80,
      change: 89.20,
      changePercent: 0.26
    }
  ];

  res.status(200).json({
    success: true,
    data: indices
  });
});

export const searchSymbols = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query) {
    res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
    return;
  }

  // Mock search results
  const results = [
    { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'NSE' }
  ].filter(stock => 
    stock.symbol.toLowerCase().includes((query as string).toLowerCase()) ||
    stock.name.toLowerCase().includes((query as string).toLowerCase())
  );

  res.status(200).json({
    success: true,
    data: results
  });
});

export const getMarketStatus = asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay();
  const time = hours * 60 + minutes;

  const marketOpen = 9 * 60 + 15; // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM

  const isWeekend = day === 0 || day === 6;
  const isMarketHours = time >= marketOpen && time <= marketClose;
  const isOpen = !isWeekend && isMarketHours;

  res.status(200).json({
    success: true,
    data: {
      isOpen,
      status: isOpen ? 'OPEN' : 'CLOSED',
      nextOpen: isOpen ? null : 'Next trading day 9:15 AM',
      timestamp: now.toISOString()
    }
  });
});
