import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabase.service';
import { asyncHandler } from '../middleware/error.middleware';
import { calculatePortfolioMetrics } from '../utils/helpers';

export const getPortfolios = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const portfolios = await SupabaseService.getPortfolios(userId);

  res.status(200).json({
    success: true,
    data: portfolios
  });
});

export const getPortfolioById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const portfolio = await SupabaseService.getPortfolioById(id);

  res.status(200).json({
    success: true,
    data: portfolio
  });
});

export const createPortfolio = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { name, description } = req.body;

  const portfolio = await SupabaseService.createPortfolio({
    user_id: userId,
    name,
    description,
    total_value: 0,
    invested_value: 0,
    current_value: 0,
    total_pnl: 0,
    total_pnl_percent: 0,
    day_pnl: 0
  });

  res.status(201).json({
    success: true,
    message: 'Portfolio created successfully',
    data: portfolio
  });
});

export const updatePortfolio = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const portfolio = await SupabaseService.updatePortfolio(id, updates);

  res.status(200).json({
    success: true,
    message: 'Portfolio updated successfully',
    data: portfolio
  });
});

export const getHoldings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const holdings = await SupabaseService.getHoldings(userId);

  res.status(200).json({
    success: true,
    data: holdings
  });
});

export const createHolding = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const holdingData = {
    ...req.body,
    user_id: userId
  };

  const holding = await SupabaseService.createHolding(holdingData);

  res.status(201).json({
    success: true,
    message: 'Holding created successfully',
    data: holding
  });
});

export const updateHolding = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  const holding = await SupabaseService.updateHolding(id, updates);

  res.status(200).json({
    success: true,
    message: 'Holding updated successfully',
    data: holding
  });
});

export const deleteHolding = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await SupabaseService.deleteHolding(id);

  res.status(200).json({
    success: true,
    message: 'Holding deleted successfully'
  });
});

export const getPortfolioSummary = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const summary = await SupabaseService.getPortfolioSummary(userId);

  res.status(200).json({
    success: true,
    data: summary
  });
});

export const getTrades = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { startDate, endDate } = req.query;

  const trades = await SupabaseService.getTrades(userId, {
    startDate: startDate as string,
    endDate: endDate as string
  });

  res.status(200).json({
    success: true,
    data: trades
  });
});

export const createTrade = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const tradeData = {
    ...req.body,
    user_id: userId
  };

  const trade = await SupabaseService.createTrade(tradeData);

  res.status(201).json({
    success: true,
    message: 'Trade recorded successfully',
    data: trade
  });
});

export const getAdvancedMetrics = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { period = '1Y' } = req.query;

  // Multi-period statistics
  const multiPeriodStats = {
    '6M': { winRate: 68.5, avgReturn: 12.4, sharpe: 1.85, maxDrawdown: -6.2, trades: 145 },
    '9M': { winRate: 71.2, avgReturn: 18.7, sharpe: 1.92, maxDrawdown: -8.1, trades: 218 },
    '1Y': { winRate: 69.8, avgReturn: 24.5, sharpe: 1.88, maxDrawdown: -9.5, trades: 289 },
    '2Y': { winRate: 72.1, avgReturn: 52.3, sharpe: 2.05, maxDrawdown: -12.3, trades: 612 }
  };

  // Heat map data
  const generateHeatMap = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const years = ['2023', '2024'];
    
    return years.map(year => ({
      year,
      months: months.map(month => ({
        month,
        return: (Math.random() * 20 - 5).toFixed(2),
        trades: Math.floor(Math.random() * 50) + 10
      }))
    }));
  };

  // Drawdown analysis
  const drawdownData = [
    { period: 'Current', value: -2.3, duration: '5 days', recovery: 'In progress' },
    { period: 'Max (1Y)', value: -9.5, duration: '23 days', recovery: '45 days' },
    { period: 'Max (2Y)', value: -12.3, duration: '31 days', recovery: '67 days' },
    { period: 'Avg', value: -4.2, duration: '12 days', recovery: '28 days' }
  ];

  // Tax impact
  const taxImpact = {
    shortTermGains: 125000,
    longTermGains: 89000,
    shortTermTax: 18750,
    longTermTax: 8900,
    totalTaxLiability: 27650,
    netReturns: 185350,
    effectiveTaxRate: 12.98
  };

  res.status(200).json({
    success: true,
    data: {
      multiPeriodStats,
      heatMap: generateHeatMap(),
      drawdown: drawdownData,
      taxImpact
    }
  });
});

export const getPerformanceComparison = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { timeRange = '1Y', portfolioIds } = req.query;

  // Generate performance comparison data
  const generateData = (range: string) => {
    let points = 52;
    switch(range) {
      case '1M': points = 30; break;
      case '6M': points = 26; break;
      case '1Y': points = 52; break;
      case '3Y': points = 36; break;
      case 'MAX': points = 60; break;
    }

    const data = [];
    for (let i = 0; i < points; i++) {
      const smallcap = 100 + (Math.random() * 20 - 5) + (i * 0.3);
      const largecap = 100 + (Math.random() * 15 - 3) + (i * 0.15);
      
      data.push({
        index: i,
        date: new Date(Date.now() - (points - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        smallcap: Number(smallcap.toFixed(2)),
        largecap: Number(largecap.toFixed(2))
      });
    }
    return data;
  };

  const performanceData = generateData(timeRange as string);
  const currentSmallcap = performanceData[performanceData.length - 1].smallcap;
  const currentLargecap = performanceData[performanceData.length - 1].largecap;

  res.status(200).json({
    success: true,
    data: {
      timeRange,
      performanceData,
      summary: {
        smallcap: {
          currentValue: currentSmallcap,
          returnPercent: ((currentSmallcap - 100) / 100 * 100).toFixed(2)
        },
        largecap: {
          currentValue: currentLargecap,
          returnPercent: ((currentLargecap - 100) / 100 * 100).toFixed(2)
        }
      }
    }
  });
});
