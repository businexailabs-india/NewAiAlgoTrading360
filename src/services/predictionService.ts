const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export interface PredictionEngine {
  id: string;
  name: string;
  description?: string;
  engineType: 'momentum' | 'mean_reversion' | 'ml_regression' | 'ensemble';
  symbols: string[];
  parameters: Record<string, unknown>;
  status: 'draft' | 'training' | 'ready' | 'deployed' | 'failed';
  deployTarget?: string;
  deployUrl?: string;
  accuracy?: number;
  lastTrainedAt?: string;
  _count?: { predictions: number };
}

export interface PredictionResult {
  symbol: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  targetPrice: number;
  currentPrice: number;
  horizonDays: number;
  signals: Record<string, number>;
}

export const predictionService = {
  async listEngines(): Promise<PredictionEngine[]> {
    const res = await fetch(`${API_BASE_URL}/predictions/engines`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async createEngine(payload: {
    name: string;
    description?: string;
    engineType: PredictionEngine['engineType'];
    symbols: string[];
    parameters?: Record<string, unknown>;
  }): Promise<PredictionEngine> {
    const res = await fetch(`${API_BASE_URL}/predictions/engines`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async trainEngine(id: string): Promise<PredictionEngine> {
    const res = await fetch(`${API_BASE_URL}/predictions/engines/${id}/train`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async runPredictions(id: string): Promise<PredictionResult[]> {
    const res = await fetch(`${API_BASE_URL}/predictions/engines/${id}/predict`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async deployEngine(id: string, target: 'vercel' | 'aws' | 'local'): Promise<PredictionEngine> {
    const res = await fetch(`${API_BASE_URL}/predictions/engines/${id}/deploy`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ target })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async deleteEngine(id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/predictions/engines/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message);
    }
  }
};
