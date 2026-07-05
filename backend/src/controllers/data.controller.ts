import { Request, Response } from 'express';
import { HistoricalDataService } from '../services/historical-data.service';
import { asyncHandler } from '../middleware/error.middleware';

export const getDatasetStatus = asyncHandler(async (_req: Request, res: Response) => {
  const datasets = HistoricalDataService.listLocalDatasets();
  const manifest = HistoricalDataService.getManifest();
  res.json({
    success: true,
    data: {
      dataDir: HistoricalDataService.getDataDir(),
      datasets,
      manifest,
      totalSymbols: datasets.length,
      totalBars: datasets.reduce((s, d) => s + d.bars, 0)
    }
  });
});

export const collectData = asyncHandler(async (req: Request, res: Response) => {
  const years = parseInt(req.body.years as string) || 10;
  const symbols = req.body.symbols as string[] | undefined;
  const result = await HistoricalDataService.collectUniverse(symbols, years);
  res.json({ success: true, message: 'Data collection complete', data: result });
});

export const getSymbolData = asyncHandler(async (req: Request, res: Response) => {
  const bars = HistoricalDataService.loadSymbolData(req.params.symbol);
  const split = bars.length > 50
    ? HistoricalDataService.trainTestSplit(bars)
    : null;
  res.json({
    success: true,
    data: {
      symbol: req.params.symbol,
      bars: bars.length,
      sample: bars.slice(-5),
      split: split ? { trainSize: split.trainSize, testSize: split.testSize } : null
    }
  });
});
