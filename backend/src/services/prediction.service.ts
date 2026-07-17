import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { MarketService } from './market.service';
import { HistoricalDataService, OHLCVBar } from './historical-data.service';
import { PredictionSignals, SignalWeights } from './prediction-signals';
import { MlClientService, MlModelType } from './ml-client.service';
import { RagService } from './rag.service';

export type EngineType = 'momentum' | 'mean_reversion' | 'ml_regression' | 'ensemble' | 'sklearn' | 'advanced_ml';
export type DeployTarget = 'vercel' | 'aws' | 'local';

interface EngineParameters {
  lookbackDays?: number;
  threshold?: number;
  horizonDays?: number;
  minAccuracy?: number;
  weights?: SignalWeights;
  symbolWeights?: Record<string, SignalWeights>;
  symbolAccuracy?: Record<string, number>;
  symbolModels?: Record<string, string>;
  mlBackend?: 'python' | 'node';
  modelType?: MlModelType;
  validationMode?: 'holdout' | 'walk_forward';
  tuneHyperparams?: boolean;
  useRag?: boolean;
  [key: string]: unknown;
}

interface PredictionOutput {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  /** Present when model or an explicitly labeled heuristic produced it */
  targetPrice?: number;
  targetPriceSource?: 'model' | 'heuristic' | 'omitted';
  currentPrice: number;
  horizonDays: number;
  signals: Record<string, number>;
  testAccuracy?: number;
  signalAgreement?: number;
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
        parameters: (data.parameters || {
          lookbackDays: 60,
          threshold: 0.015,
          horizonDays: 7,
          minAccuracy: 50
        }) as object,
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
    const engineType = engine.engineType as EngineType;

    if (this.shouldUsePythonMl(engineType)) {
      const healthy = await MlClientService.checkHealth();
      if (healthy) {
        return this.trainEngineWithPython(userId, engineId, engine);
      }
      if (engineType === 'sklearn' || engineType === 'advanced_ml') {
        throw new AppError('Python ML service required for sklearn/advanced_ml engines. Start ml-service.', 503);
      }
    }

    if (engineType === 'ensemble') {
      return this.trainEngineEnsemble(userId, engineId, engine);
    }

    return this.trainEngineWithNode(userId, engineId, engine);
  }

  private static shouldUsePythonMl(engineType: EngineType): boolean {
    if (!MlClientService.isEnabled()) return false;
    return engineType === 'sklearn' || engineType === 'ml_regression' || engineType === 'advanced_ml';
  }

  private static getMlTrainOptions(params: EngineParameters, engineType: EngineType) {
    if (engineType === 'advanced_ml') {
      return {
        modelType: (params.modelType || 'stacking') as MlModelType,
        validationMode: params.validationMode || 'walk_forward',
        tuneHyperparams: params.tuneHyperparams ?? true
      };
    }
    return {
      modelType: (params.modelType || 'gradient_boosting') as MlModelType,
      validationMode: params.validationMode || 'walk_forward',
      tuneHyperparams: params.tuneHyperparams ?? false
    };
  }

  private static async trainEngineWithPython(
    userId: string,
    engineId: string,
    engine: { symbols: unknown; parameters: unknown; engineType: string }
  ) {
    await MlClientService.ensureAvailable();
    await prisma.predictionEngine.update({
      where: { id: engineId },
      data: { status: 'training' }
    });

    const symbols = engine.symbols as string[];
    const params = engine.parameters as EngineParameters;
    const horizonDays = params.horizonDays || 7;
    const minAccuracy = params.minAccuracy || 50;
    const mlOptions = this.getMlTrainOptions(params, engine.engineType as EngineType);

    let totalTrain = 0;
    let totalTest = 0;
    let count = 0;
    const symbolMetrics: Record<string, object> = {};
    const symbolAccuracy: Record<string, number> = {};
    const symbolModels: Record<string, string> = {};

    for (const symbol of symbols) {
      const historical = await this.getHistoricalBars(symbol, params.lookbackDays || 252);
      if (historical.length < 80) continue;

      const result = await MlClientService.trainSymbol(engineId, symbol, historical, horizonDays, mlOptions);
      totalTrain += result.train_accuracy;
      totalTest += result.effective_accuracy ?? result.test_accuracy;
      count++;
      symbolAccuracy[symbol] = result.effective_accuracy ?? result.test_accuracy;
      symbolModels[symbol] = result.model_key;
      symbolMetrics[symbol] = {
        trainAccuracy: result.train_accuracy,
        testAccuracy: result.test_accuracy,
        effectiveAccuracy: result.effective_accuracy,
        testF1: result.test_f1,
        bars: historical.length,
        samples: result.samples,
        modelType: result.model_type,
        walkForward: result.walk_forward,
        featureImportance: result.feature_importance
      };

      let ragContext: string | undefined;
      if (params.useRag !== false) {
        const rag = await RagService.query(userId, `${symbol} stock outlook prediction`, symbol, 3);
        ragContext = rag.context || undefined;
      }

      const pred = await MlClientService.predictSymbol(
        engineId,
        symbol,
        historical,
        historical[historical.length - 1].close,
        horizonDays,
        minAccuracy,
        ragContext
      );

      await prisma.predictionResult.create({
        data: {
          engineId,
          symbol,
          prediction: {
            ...pred,
            trainAccuracy: result.train_accuracy,
            testAccuracy: result.test_accuracy,
            dataBars: historical.length,
            mlBackend: 'python'
          }
        }
      });
    }

    const avgTrain = count ? totalTrain / count : 0;
    const avgTest = count ? totalTest / count : 0;

    return prisma.predictionEngine.update({
      where: { id: engineId },
      data: {
        status: 'ready',
        accuracy: avgTest,
        lastTrainedAt: new Date(),
        parameters: {
          ...(params as object),
          symbolAccuracy,
          symbolModels,
          mlBackend: 'python',
          minAccuracy,
          lastTraining: {
            trainAccuracy: Number(avgTrain.toFixed(2)),
            testAccuracy: Number(avgTest.toFixed(2)),
            symbolMetrics,
            trainedAt: new Date().toISOString(),
            dataSource: process.env.AWS_S3_DATA_BUCKET ? 'aws_s3' : 'local_historical',
            engine: mlOptions.modelType,
            validationMode: mlOptions.validationMode,
            tuneHyperparams: mlOptions.tuneHyperparams
          }
        } as object
      }
    });
  }

  private static async trainEngineWithNode(
    userId: string,
    engineId: string,
    engine: { symbols: unknown; parameters: unknown }
  ) {
    await prisma.predictionEngine.update({
      where: { id: engineId },
      data: { status: 'training' }
    });

    const symbols = engine.symbols as string[];
    const params = engine.parameters as EngineParameters;
    const horizonDays = params.horizonDays || 7;
    const threshold = params.threshold || 0.015;
    const minAccuracy = params.minAccuracy || 50;

    let totalAccuracy = 0;
    let totalTestAccuracy = 0;
    let count = 0;
    const symbolMetrics: Record<string, {
      trainAccuracy: number;
      testAccuracy: number;
      bars: number;
      weights?: SignalWeights;
    }> = {};
    const symbolWeights: Record<string, SignalWeights> = {};
    const symbolAccuracy: Record<string, number> = {};

    for (const symbol of symbols) {
      const historical = await this.getHistoricalBars(symbol, params.lookbackDays || 252);
      if (historical.length < 50) continue;

      const { train, test } = HistoricalDataService.trainTestSplit(historical, 0.2);
      const tuneBars = train.length > 400 ? train.slice(-400) : train;
      const tunedWeights = PredictionSignals.tuneWeights(tuneBars, horizonDays, threshold);
      symbolWeights[symbol] = tunedWeights;

      const trainAccuracy = PredictionSignals.backtestAccuracy(train, tunedWeights, horizonDays, threshold);
      const testAccuracy = PredictionSignals.backtestAccuracy(test, tunedWeights, horizonDays, threshold);

      totalAccuracy += trainAccuracy;
      totalTestAccuracy += testAccuracy;
      count++;
      symbolAccuracy[symbol] = testAccuracy;

      symbolMetrics[symbol] = {
        trainAccuracy: Number(trainAccuracy.toFixed(2)),
        testAccuracy: Number(testAccuracy.toFixed(2)),
        bars: historical.length,
        weights: tunedWeights
      };

      const latestPred = this.predictFromBars(
        historical,
        historical[historical.length - 1].close,
        params,
        tunedWeights,
        testAccuracy
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
          symbolWeights,
          symbolAccuracy,
          minAccuracy,
          lastTraining: {
            trainAccuracy: Number(avgTrainAccuracy.toFixed(2)),
            testAccuracy: Number(avgTestAccuracy.toFixed(2)),
            symbolMetrics,
            trainedAt: new Date().toISOString(),
            dataSource: process.env.AWS_S3_DATA_BUCKET ? 'aws_s3' : 'local_historical',
            indicators: ['momentum', 'meanReversion', 'regression', 'rsi', 'macd', 'bollinger', 'volume']
          }
        } as object
      }
    });
  }

  private static async trainEngineEnsemble(
    userId: string,
    engineId: string,
    engine: { symbols: unknown; parameters: unknown; engineType: string }
  ) {
    const nodeResult = await this.trainEngineWithNode(userId, engineId, engine);
    const params = (nodeResult.parameters || {}) as EngineParameters;

    if (await MlClientService.checkHealth()) {
      const pyResult = await this.trainEngineWithPython(userId, engineId, engine);
      const pyParams = (pyResult.parameters || {}) as EngineParameters;
      const nodeAcc = params.symbolAccuracy || {};
      const pyAcc = pyParams.symbolAccuracy || {};
      const merged: Record<string, number> = {};
      for (const sym of Object.keys({ ...nodeAcc, ...pyAcc })) {
        const n = nodeAcc[sym] ?? 50;
        const p = pyAcc[sym] ?? 50;
        merged[sym] = Number(((n + p) / 2).toFixed(2));
      }
      const avg = Object.values(merged).reduce((a, b) => a + b, 0) / (Object.keys(merged).length || 1);
      return prisma.predictionEngine.update({
        where: { id: engineId },
        data: {
          status: 'ready',
          accuracy: avg,
          parameters: {
            ...params,
            symbolAccuracy: merged,
            mlBackend: 'ensemble',
            lastTraining: {
              ...(params.lastTraining as object),
              ensemble: { node: nodeAcc, python: pyAcc, merged }
            }
          } as object
        }
      });
    }

    return nodeResult;
  }

  private static async getHistoricalBars(symbol: string, minBars: number): Promise<OHLCVBar[]> {
    const local = await HistoricalDataService.getBarsForSymbol(symbol, minBars);
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
    const engineType = engine.engineType as EngineType;

    if (this.shouldUsePythonMl(engineType) && await MlClientService.checkHealth()) {
      return this.runPredictionsWithPython(userId, engineId, engine);
    }
    if (engineType === 'sklearn' && !(await MlClientService.checkHealth())) {
      throw new AppError('Python ML service unavailable', 503);
    }

    const symbols = engine.symbols as string[];
    const params = engine.parameters as EngineParameters;
    const results: PredictionOutput[] = [];

    for (const symbol of symbols) {
      const historical = await this.getHistoricalBars(symbol, params.lookbackDays || 60);
      const quote = await MarketService.getQuote(symbol, userId);
      const weights = params.symbolWeights?.[symbol];
      const testAcc = params.symbolAccuracy?.[symbol] ?? Number(engine.accuracy) ?? 50;

      const prediction = this.predictFromBars(
        historical,
        quote.price,
        params,
        weights,
        testAcc
      );

      await prisma.predictionResult.create({
        data: { engineId, symbol, prediction }
      });

      results.push({ symbol, ...prediction });
    }

    return results;
  }

  private static async runPredictionsWithPython(
    userId: string,
    engineId: string,
    engine: { symbols: unknown; parameters: unknown; accuracy: unknown }
  ): Promise<PredictionOutput[]> {
    await MlClientService.ensureAvailable();
    const symbols = engine.symbols as string[];
    const params = engine.parameters as EngineParameters;
    const results: PredictionOutput[] = [];

    for (const symbol of symbols) {
      const historical = await this.getHistoricalBars(symbol, params.lookbackDays || 252);
      const quote = await MarketService.getQuote(symbol, userId);

      const pred = await MlClientService.predictSymbol(
        engineId,
        symbol,
        historical,
        quote.price,
        params.horizonDays || 7,
        params.minAccuracy || 50
      );

      const output: PredictionOutput = {
        symbol,
        direction: pred.direction,
        confidence: pred.confidence,
        targetPrice: pred.target_price,
        targetPriceSource: 'model',
        currentPrice: pred.current_price,
        horizonDays: pred.horizon_days,
        signals: pred.signals,
        testAccuracy: pred.test_accuracy,
        signalAgreement: pred.probabilities
          ? Math.abs(pred.probabilities.buy - pred.probabilities.sell) / 100
          : undefined
      };

      await prisma.predictionResult.create({
        data: { engineId, symbol, prediction: { ...output, mlBackend: 'python' } }
      });
      results.push(output);
    }
    return results;
  }

  static async getMlStatus() {
    const enabled = MlClientService.isEnabled();
    const healthy = enabled ? await MlClientService.checkHealth() : false;
    return {
      enabled,
      healthy,
      url: process.env.ML_SERVICE_URL || null,
      engine: 'sklearn-gradient-boosting'
    };
  }

  static async deployEngine(userId: string, engineId: string, target: DeployTarget) {
    const engine = await this.getEngine(userId, engineId);
    if (engine.status !== 'ready' && engine.status !== 'deployed') {
      throw new AppError('Engine must be trained before deployment', 400);
    }

    const baseUrl = target === 'vercel'
      ? process.env.VERCEL_PREDICTION_URL || `https://${process.env.VERCEL_PROJECT || 'smarttrade'}.vercel.app/api/predict`
      : target === 'aws'
      ? process.env.AWS_BACKEND_URL
        ? `${process.env.AWS_BACKEND_URL}/api/predictions/engines/${engineId}/predict`
        : process.env.AWS_PREDICTION_URL
          ? `${process.env.AWS_PREDICTION_URL}/${engineId}/predict`
          : `https://${process.env.AWS_API_GATEWAY_ID || 'api'}.execute-api.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/prod/predict`
      : `${process.env.API_URL || 'http://localhost:3001'}/api/predictions/engines/${engineId}/predict`;

    const deployUrl = target === 'aws' && process.env.AWS_BACKEND_URL
      ? baseUrl
      : `${baseUrl}?engineId=${engineId}`;

    return prisma.predictionEngine.update({
      where: { id: engineId },
      data: {
        status: 'deployed',
        deployTarget: target,
        deployUrl
      }
    });
  }

  private static predictFromBars(
    bars: OHLCVBar[],
    currentPrice: number,
    params: EngineParameters,
    weights?: SignalWeights,
    testAccuracy = 50
  ): Omit<PredictionOutput, 'symbol'> {
    const threshold = params.threshold || 0.015;
    const horizonDays = params.horizonDays || 7;
    const minAccuracy = params.minAccuracy || 50;

    if (bars.length < 30) {
      return {
        direction: 'HOLD',
        confidence: 0,
        targetPrice: undefined,
        targetPriceSource: 'omitted',
        currentPrice,
        horizonDays,
        signals: {},
        testAccuracy,
        signalAgreement: 0
      };
    }

    const ind = PredictionSignals.computeIndicators(bars);
    const { score, signals } = PredictionSignals.scoreFromIndicators(ind, weights ?? params.weights);
    const agreement = PredictionSignals.signalAgreement(signals, score);

    let direction: 'BUY' | 'SELL' | 'HOLD' =
      score > threshold ? 'BUY' : score < -threshold ? 'SELL' : 'HOLD';

    const confidence = PredictionSignals.calibratedConfidence(score, testAccuracy, agreement, minAccuracy);

    if (testAccuracy < minAccuracy || agreement < 0.4) {
      direction = 'HOLD';
    }

    // Heuristic projection — not a trained model output; labeled explicitly
    const heuristicTarget = Number((currentPrice * (1 + score * horizonDays * 0.01)).toFixed(2));

    return {
      direction,
      confidence,
      targetPrice: heuristicTarget,
      targetPriceSource: 'heuristic',
      currentPrice,
      horizonDays,
      signals,
      testAccuracy: Number(testAccuracy.toFixed(1)),
      signalAgreement: Number(agreement.toFixed(2))
    };
  }
}
