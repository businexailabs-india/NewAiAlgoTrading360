import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { WatchlistService } from '../services/watchlist.service';

export const listWatchlists = asyncHandler(async (req: Request, res: Response) => {
  const data = await WatchlistService.list(req.user!.id);
  res.status(200).json({ success: true, data });
});

export const getWatchlist = asyncHandler(async (req: Request, res: Response) => {
  const data = await WatchlistService.get(req.user!.id, req.params.id);
  res.status(200).json({ success: true, data });
});

export const createWatchlist = asyncHandler(async (req: Request, res: Response) => {
  const { name, symbols } = req.body || {};
  const data = await WatchlistService.create(req.user!.id, name, symbols);
  res.status(201).json({ success: true, message: 'Watchlist created', data });
});

export const renameWatchlist = asyncHandler(async (req: Request, res: Response) => {
  const data = await WatchlistService.rename(req.user!.id, req.params.id, req.body?.name);
  res.status(200).json({ success: true, message: 'Watchlist updated', data });
});

export const deleteWatchlist = asyncHandler(async (req: Request, res: Response) => {
  const data = await WatchlistService.remove(req.user!.id, req.params.id);
  res.status(200).json({ success: true, message: 'Watchlist deleted', data });
});

export const addWatchlistSymbol = asyncHandler(async (req: Request, res: Response) => {
  const { symbol, exchange, notes } = req.body || {};
  const data = await WatchlistService.addSymbol(
    req.user!.id,
    req.params.id,
    symbol,
    exchange,
    notes
  );
  res.status(200).json({ success: true, message: 'Symbol added', data });
});

export const removeWatchlistSymbol = asyncHandler(async (req: Request, res: Response) => {
  const data = await WatchlistService.removeSymbol(
    req.user!.id,
    req.params.id,
    req.params.itemId
  );
  res.status(200).json({ success: true, message: 'Symbol removed', data });
});

export const addToDefaultWatchlist = asyncHandler(async (req: Request, res: Response) => {
  const { symbol, exchange } = req.body || {};
  const data = await WatchlistService.addToDefault(req.user!.id, symbol, exchange);
  res.status(200).json({ success: true, message: 'Added to default watchlist', data });
});
