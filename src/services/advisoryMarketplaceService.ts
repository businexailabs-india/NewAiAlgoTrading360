import { API_BASE_URL } from '../lib/api';

function headers(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || body.detail || `Request failed (${res.status})`);
  return body.data as T;
}

export type AdvisoryStatus = 'preparing' | 'ready' | 'failed' | 'expired' | 'dismissed';

export interface AdvisoryRecommendation {
  id: string;
  title: string;
  type: string;
  symbols: string[];
  confidence_score: number;
  risk_score: number;
  required_capital: number;
  timeframe: string;
  rationale: string;
  warnings: string[];
  actions: string[];
}

export interface LoginAdvisory {
  advisory_id: string | null;
  status: AdvisoryStatus;
  generated_at?: string;
  market_status?: string;
  broker_status?: string;
  risk_profile?: string;
  summary: string;
  recommendations: AdvisoryRecommendation[];
  warnings?: string[];
  disclaimer?: string;
}

export const advisoryMarketplaceService = {
  async latest(): Promise<LoginAdvisory> {
    const res = await fetch(`${API_BASE_URL}/advisory/latest`, { headers: headers() });
    return json(res);
  },

  async generate(): Promise<LoginAdvisory> {
    const res = await fetch(`${API_BASE_URL}/advisory/generate`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    return json(res);
  },

  async refresh(id: string): Promise<LoginAdvisory> {
    const res = await fetch(`${API_BASE_URL}/advisory/${id}/refresh`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    return json(res);
  },

  async convertToAlgo(advisoryId: string, recommendationId: string) {
    const res = await fetch(
      `${API_BASE_URL}/advisory/${advisoryId}/recommendations/${recommendationId}/convert-to-algo`,
      { method: 'POST', headers: headers(), body: '{}' }
    );
    return json(res);
  },

  async listStrategyOptions(): Promise<Array<Record<string, unknown>>> {
    const res = await fetch(`${API_BASE_URL}/strategy-options`, { headers: headers() });
    const data = await json<Array<Record<string, unknown>> | { items?: Array<Record<string, unknown>> }>(res);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as { items?: unknown[] }).items)) {
      return (data as { items: Array<Record<string, unknown>> }).items;
    }
    return [];
  },

  async paperTest(optionId: string) {
    const res = await fetch(`${API_BASE_URL}/strategy-options/${optionId}/paper-test`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    return json(res);
  },

  async save(optionId: string) {
    const res = await fetch(`${API_BASE_URL}/strategy-options/${optionId}/save`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    return json(res);
  },

  async deployPaper(optionId: string) {
    const res = await fetch(`${API_BASE_URL}/strategy-options/${optionId}/deploy-paper`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    return json(res);
  },

  async requestLive(optionId: string, body: {
    risk_disclosure_accepted: boolean;
    explicit_confirmation: boolean;
    paper_qualified?: boolean;
  }) {
    const res = await fetch(`${API_BASE_URL}/strategy-options/${optionId}/request-live-approval`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    return json(res);
  },

  async discoverExternal() {
    const res = await fetch(`${API_BASE_URL}/external-algos/discover`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    return json(res);
  },

  async listExternal() {
    const res = await fetch(`${API_BASE_URL}/external-algos/candidates`, { headers: headers() });
    return json(res);
  },

  async normalizeExternal(id: string) {
    const res = await fetch(`${API_BASE_URL}/external-algos/candidates/${id}/normalize`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    return json(res);
  },

  async riskScanExternal(id: string) {
    const res = await fetch(`${API_BASE_URL}/external-algos/candidates/${id}/risk-scan`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    });
    return json(res);
  }
};
