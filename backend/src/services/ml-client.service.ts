import axios from 'axios';
import { OHLCVBar } from './historical-data.service';
import { logger } from '../utils/logger';

export type MlModelType =
  | 'gradient_boosting'
  | 'random_forest'
  | 'hist_gradient_boosting'
  | 'stacking'
  | 'ensemble_vote';

export interface MlTrainOptions {
  modelType?: MlModelType;
  validationMode?: 'holdout' | 'walk_forward';
  tuneHyperparams?: boolean;
  testRatio?: number;
}

export interface MlTrainResult {
  symbol: string;
  train_accuracy: number;
  test_accuracy: number;
  test_f1?: number;
  effective_accuracy?: number;
  samples: number;
  feature_importance: Record<string, number>;
  model_key: string;
  model_type?: string;
  validation_mode?: string;
  walk_forward?: Record<string, number>;
  best_params?: Record<string, unknown>;
}

export interface MlPredictResult {
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  target_price: number;
  current_price: number;
  horizon_days: number;
  test_accuracy: number;
  signals: Record<string, number>;
  probabilities?: { buy: number; sell: number };
  model_type?: string;
  rag_adjusted?: boolean;
}

export interface RagHit {
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export class MlClientService {
  private static baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:8081';

  static isEnabled(): boolean {
    return process.env.USE_PYTHON_ML !== 'false';
  }

  static async checkHealth(): Promise<boolean> {
    if (!this.isEnabled()) return false;
    try {
      const res = await axios.get(`${this.baseUrl}/health`, { timeout: 3000 });
      return res.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  static async getHealthDetails(): Promise<Record<string, unknown>> {
    try {
      const res = await axios.get(`${this.baseUrl}/health`, { timeout: 3000 });
      return res.data;
    } catch {
      return { status: 'unavailable' };
    }
  }

  static async trainSymbol(
    engineId: string,
    symbol: string,
    bars: OHLCVBar[],
    horizonDays = 7,
    options: MlTrainOptions = {}
  ): Promise<MlTrainResult> {
    const res = await axios.post(
      `${this.baseUrl}/train`,
      {
        engine_id: engineId,
        symbol,
        bars,
        horizon_days: horizonDays,
        test_ratio: options.testRatio ?? 0.2,
        model_type: options.modelType ?? 'gradient_boosting',
        validation_mode: options.validationMode ?? 'walk_forward',
        tune_hyperparams: options.tuneHyperparams ?? false
      },
      { timeout: 180000 }
    );
    return res.data.data;
  }

  static async predictSymbol(
    engineId: string,
    symbol: string,
    bars: OHLCVBar[],
    currentPrice: number,
    horizonDays = 7,
    minAccuracy = 50,
    ragContext?: string
  ): Promise<MlPredictResult> {
    const res = await axios.post(
      `${this.baseUrl}/predict`,
      {
        engine_id: engineId,
        symbol,
        bars,
        current_price: currentPrice,
        horizon_days: horizonDays,
        min_accuracy: minAccuracy,
        rag_context: ragContext
      },
      { timeout: 30000 }
    );
    return res.data.data;
  }

  static async ragIngest(
    userId: string,
    documents: Array<{ text: string; metadata?: Record<string, unknown> }>,
    mode: 'tfidf' | 'hybrid' = 'hybrid'
  ): Promise<number> {
    const res = await axios.post(
      `${this.baseUrl}/rag/ingest`,
      { user_id: userId, documents, mode },
      { timeout: 120000 }
    );
    return res.data.data.chunks_indexed;
  }

  static async embedTexts(texts: string[]): Promise<number[][]> {
    const res = await axios.post(
      `${this.baseUrl}/embed`,
      { texts },
      { timeout: 60000 }
    );
    return res.data.data.embeddings;
  }

  static async ragQuery(
    userId: string,
    query: string,
    topK = 5,
    symbol?: string,
    mode: 'tfidf' | 'hybrid' = 'hybrid'
  ): Promise<RagHit[]> {
    const res = await axios.post(
      `${this.baseUrl}/rag/query`,
      { user_id: userId, query, top_k: topK, symbol, mode },
      { timeout: 15000 }
    );
    return res.data.data.hits;
  }

  static async ensureAvailable(): Promise<void> {
    const ok = await this.checkHealth();
    if (!ok) {
      logger.warn(`Python ML service not reachable at ${this.baseUrl}`);
      throw new Error('Python ML service unavailable. Start ml-service or set ML_SERVICE_URL.');
    }
  }
}
