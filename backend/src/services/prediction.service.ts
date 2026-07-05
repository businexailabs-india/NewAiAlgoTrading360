import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { MarketService } from './market.service';
import { HistoricalDataService, OHLCVBar } from './historical-data.service';
import { logger } from '../utils/logger';

export type EngineType = 'momentum' | 'mean_reversion' | 'ml_regression' | 'ensemble';
export type DeployTarget = 'vercel' | 'aws' | 'local';

interface EngineParameters {
  lookbackDays?: number;
  threshold?: number;
  horizonDays?: number;
  weights?: Record<string, number>;
  [key: string]: unknown;
}

interface PredictionOutput {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  targetPrice: number;
  currentPrice: number;
  horizonDays: number;
  signals: Record<string, number>;
}

export class PredictionService {
  static async listEngines(userId: string) {
    return prisma.predictionEngine.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { predictions: true } } }
    });
  }

  static async getEngine(userId: string, engineId: string) {
    const engine = await prisma.predictionEngine.findFirst({
      where: { id: engineId, userId },
      include: {
        predictions: { orderBy: { createdAt: 'desc' }, take: 50 }
      }
    });
    if (!engine) throw new AppError('Prediction engine not found', 404);
    return engine;
  }

  static async createEngine(userId: string, data: {
    name: string;
    description?: string;
    engineType: EngineType;
    symbols: string[];
    parameters?: EngineParameters;
  }) {
    return prisma.predictionEngine.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        engineType: data.engineType,
        symbols: data.symbols,
        parameters: (data.parameters || { lookbackDays: 30, threshold: 0.02, horizonDays: 5 }) as object,
        status: 'draft'
      }
    });
  }

  static async updateEngine(userId: string, engineId: string, updates: {
    name?: string;
    description?: string;
    parameters?: EngineParameters;
    symbols?: string[];
  }) {
    await this.getEngine(userId, engineId);
    return prisma.predictionEngine.update({
      where: { id: engineId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.parameters && { parameters: updates.parameters as object }),
        ...(updates.symbols && { symbols: updates.symbols })
      }
    });
  }

  static async deleteEngine(userId: string, engineId: string) {
    await this.getEngine(userId, engineId);
    await prisma.predictionEngine.delete({ where: { id: engineId } });
    return { message: 'Engine deleted' };
  }

  static async trainEngine(userId: string, engineId: string) {
    const engine = await this.getEngine(userId, engineId);
    await prisma.predictionEngine.update({
      where: { id: engineId },
      data: { status: 'training' }
    });

    const symbols = engine.symbols as string[];
    const params = engine.parameters as EngineParameters;
    let totalAccuracy = 0;
    let totalTestAccuracy = 0;
    let count = 0;
    const symbolMetrics: Record<string, { trainAccuracy: number; testAccuracy: number; bars: number }> = {};

    for (const symbol of symbols) {
      const historical = await this.getHistoricalBars(symbol, params.lookbackDays || 252);
      if (historical.length < 50) continue;

      const { train, test } = HistoricalDataService.trainTestSplit(historical, 0.2);

      const trainPredictions = this.runBacktestOnBars(engine.engineType as EngineType, train, params);
      const testPredictions = this.runBacktestOnBars(engine.engineType as EngineType, test, params);

      const trainAccuracy = this.evaluateAccuracyOnBars(trainPredictions, train);
      const testAccuracy = this.evaluateAccuracyOnBars(testPredictions, test);

      totalAccuracy += trainAccuracy;
      totalTestAccuracy += testAccuracy;
      count++;

      symbolMetrics[symbol] = {
        trainAccuracy: Number(trainAccuracy.toFixed(2)),
        testAccuracy: Number(testAccuracy.toFixed(2)),
        bars: historical.length
      };

      const latestPred = this.predict(
        engine.engineType as EngineType,
        historical.map(b => ({ close: b.close })),
        historical[historical.length - 1].close,
        params
      );

      await prisma.predictionResult.create({
        data: {
          engineId,
          symbol,
          prediction: { ...latestPred, trainAccuracy, testAccuracy, dataBars: historical.length }
        }
      });
    }

    const avgTrainAccuracy = count ? totalAccuracy / count : 0;
    const avgTestAccuracy = count ? totalTestAccuracy / count : 0;

    return prisma.predictionEngine.update({
      where: { id: engineId },
      data: {
        status: 'ready',
        accuracy: avgTestAccuracy,
        lastTrainedAt: new Date(),
        parameters: {
          ...(params as object),
          lastTraining: {
            trainAccuracy: Number(avgTrainAccuracy.toFixed(2)),
            testAccuracy: Number(avgTestAccuracy.toFixed(2)),
            symbolMetrics,
            trainedAt: new Date().toISOString(),
            dataSource: 'local_historical'
          }
        } as object
      }
    });
  }

  private static async getHistoricalBars(symbol: string, minBars: number): Promise<OHLCVBar[]> {
    const local = HistoricalDataService.getBarsForSymbol(symbol, minBars);
    if (local.length >= minBars) return local;

    const remote = await MarketService.getHistoricalData(symbol, Math.min(minBars, 365 * 2));
    return remote.map(r => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume
    }));
  }

  static async runPredictions(userId: string, engineId: string): Promise<PredictionOutput[]> {
    const engine = await this.getEngine(userId, engineId);
    const symbols = engine.symbols as string[];
    const params = engine.parameters as EngineParameters;
    const results: PredictionOutput[] = [];

    for (const symbol of symbols) {
      const historical = await this.getHistoricalBars(symbol, params.lookbackDays || 60);
      const bars = historical.map(b => ({ close: b.close }));
      const quote = await MarketService.getQuote(symbol, userId);
      const prediction = this.predict(engine.engineType as EngineType, bars, quote.price, params);

      await prisma.predictionResult.create({
        data: { engineId, symbol, prediction }
      });

      results.push({ symbol, ...prediction });
    }

    return results;
  }

  static async deployEngine(userId: string, engineId: string, target: DeployTarget) {
    const engine = await this.getEngine(userId, engineId);
    if (engine.status !== 'ready' && engine.status !== 'deployed') {
      throw new AppError('Engine must be trained before deployment', 400);
    }

    const baseUrl = target === 'vercel'
      ? process.env.VERCEL_PREDICTION_URL || `https://${process.env.VERCEL_PROJECT || 'smarttrade'}.vercel.app/api/predict`
      : target === 'aws'
      ? process.env.AWS_PREDICTION_URL || `https://${process.env.AWS_API_GATEWAY_ID || 'api'}.execute-api.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/prod/predict`
      : `${process.env.API_URL || 'http://localhost:3001'}/api/predictions/engines/${engineId}/predict`;

    const deployUrl = `${baseUrl}?engineId=${engineId}`;

    return prisma.predictionEngine.update({
      where: { id: engineId },
      data: {
        status: 'deployed',
        deployTarget: target,
        deployUrl
      }
    });
  }

  private static predict(
    type: EngineType,
    historical: Array<{ close: number }>,
    currentPrice: number,
    params: EngineParameters
  ): Omit<PredictionOutput, 'symbol'> {
    const closes = historical.map(h => h.close);
    const signals: Record<string, number> = {};

    let score = 0;

    if (type === 'momentum' || type === 'ensemble') {
      const momentum = this.momentumSignal(closes, params.lookbackDays || 14);
      signals.momentum = momentum;
      score += momentum * (params.weights?.momentum ?? (type === 'ensemble' ? 0.4 : 1));
    }

    if (type === 'mean_reversion' || type === 'ensemble') {
      const reversion = this.meanReversionSignal(closes, params.lookbackDays || 20);
      signals.meanReversion = reversion;
      score += reversion * (params.weights?.meanReversion ?? (type === 'ensemble' ? 0.3 : 1));
    }

    if (type === 'ml_regression' || type === 'ensemble') {
      const regression = this.regressionSignal(closes);
      signals.regression = regression;
      score += regression * (params.weights?.regression ?? (type === 'ensemble' ? 0.3 : 1));
    }

    const threshold = params.threshold || 0.02;
    const direction: 'BUY' | 'SELL' | 'HOLD' =
      score > threshold ? 'BUY' : score < -threshold ? 'SELL' : 'HOLD';

    const confidence = Math.min(95, Math.abs(score) * 100 + 50);
    const horizonDays = params.horizonDays || 5;
    const targetPrice = Number((currentPrice * (1 + score * horizonDays * 0.01)).toFixed(2));

    return { direction, confidence: Number(confidence.toFixed(1)), targetPrice, currentPrice, horizonDays, signals };
  }

  private static momentumSignal(closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;
    const recent = closes[closes.length - 1];
    const past = closes[closes.length - period - 1];
    return past ? (recent - past) / past : 0;
  }

  private static meanReversionSignal(closes: number[], period: number): number {
    if (closes.length < period) return 0;
    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const current = closes[closes.length - 1];
    return mean ? -(current - mean) / mean : 0;
  }

  private static regressionSignal(closes: number[]): number {
    if (closes.length < 5) return 0;
    const n = closes.length;
    const xMean = (n - 1) / 2;
    const yMean = closes.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (closes[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den ? num / den : 0;
    return slope / yMean;
  }

  private static runBacktestOnBars(
    type: EngineType,
    bars: OHLCVBar[],
    params: EngineParameters
  ) {
    const predictions = [];
    const closes = bars.map(b => b.close);
    for (let i = 20; i < closes.length; i++) {
      const slice = closes.slice(0, i + 1).map(c => ({ close: c }));
      const pred = this.predict(type, slice, closes[i], params);
      predictions.push(pred);
    }
    return predictions;
  }

  private static runBacktest(
    type: EngineType,
    historical: Array<{ close: number }>,
    params: EngineParameters
  ) {
    const predictions = [];
    for (let i = 20; i < historical.length; i++) {
      const slice = historical.slice(0, i + 1);
      const pred = this.predict(type, slice, slice[slice.length - 1].close, params);
      predictions.push(pred);
    }
    return predictions;
  }

  private static evaluateAccuracyOnBars(
    predictions: Array<{ direction: string }>,
    bars: OHLCVBar[]
  ): number {
    let correct = 0;
    let total = 0;
    for (let i = 0; i < predictions.length - 5; i++) {
      const futureIdx = i + 21;
      if (futureIdx >= bars.length) break;
      const actual = bars[futureIdx].close > bars[i + 20].close ? 'BUY' : 'SELL';
      if (predictions[i].direction === actual) correct++;
      total++;
    }
    return total ? (correct / total) * 100 : 0;
  }

  private static evaluateAccuracy(
    predictions: Array<{ direction: string }>,
    historical: Array<{ close: number }>
  ): number {
    let correct = 0;
    let total = 0;
    for (let i = 0; i < predictions.length - 1; i++) {
      const actual = historical[i + 21]?.close > historical[i + 20]?.close ? 'BUY' : 'SELL';
      if (predictions[i].direction === actual || predictions[i].direction === 'HOLD') {
        correct++;
      }
      total++;
    }
    return total ? (correct / total) * 100 : 0;
  }
}
