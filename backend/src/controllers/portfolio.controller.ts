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
