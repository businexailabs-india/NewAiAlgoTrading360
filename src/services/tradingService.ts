import { API_BASE_URL } from '../lib/api';

function headers(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export const tradingService = {
  // Orders
  async placeOrder(order: {
    symbol: string;
    tradeType: 'BUY' | 'SELL';
    quantity: number;
    orderType?: string;
    product?: string;
    price?: number;
    isPaper?: boolean;
    instrumentType?: 'EQUITY' | 'OPTION';
    optionDetails?: { strike: number; expiry: string; optionType: 'CE' | 'PE' };
  }) {
    const res = await fetch(`${API_BASE_URL}/orders/place`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(order)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Order failed');
    return data.data;
  },

  async getOrders(isPaper?: boolean) {
    const q = isPaper !== undefined ? `?isPaper=${isPaper}` : '';
    const res = await fetch(`${API_BASE_URL}/orders${q}`, { headers: headers() });
    const data = await res.json();
    return data.data;
  },

  // Agents
  async listAgents() {
    const res = await fetch(`${API_BASE_URL}/agents`, { headers: headers() });
    const data = await res.json();
    return data.data;
  },

  async createAgent(payload: {
    name: string;
    description?: string;
    mode?: 'paper' | 'live';
    engineId?: string;
    config?: Record<string, unknown>;
  }) {
    const res = await fetch(`${API_BASE_URL}/agents`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async runAgent(id: string) {
    const res = await fetch(`${API_BASE_URL}/agents/${id}/run`, {
      method: 'POST',
      headers: headers()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async updateAgent(id: string, updates: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/agents/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(updates)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async deleteAgent(id: string) {
    await fetch(`${API_BASE_URL}/agents/${id}`, { method: 'DELETE', headers: headers() });
  },

  // Screener
  async runScreener(criteria?: { topN?: number; minMomentum?: number }) {
    const res = await fetch(`${API_BASE_URL}/screener/run`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(criteria || { topN: 10 })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  // Options
  async getOptionsChain(symbol: string) {
    const res = await fetch(`${API_BASE_URL}/options/chain/${symbol}`, { headers: headers() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async getOptionsSignals(underlyings: string[]) {
    const res = await fetch(`${API_BASE_URL}/options/signals`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ underlyings })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  // JSON rule strategies
  async listStrategies() {
    const res = await fetch(`${API_BASE_URL}/strategy`, { headers: headers() });
    const data = await res.json();
    return data.data;
  },

  async getStrategyPresets() {
    const res = await fetch(`${API_BASE_URL}/strategy/presets`, { headers: headers() });
    const data = await res.json();
    return data.data;
  },

  async createStrategy(payload: {
    name: string;
    description?: string;
    category?: string;
    symbols: string[];
    rules: Array<Record<string, unknown>>;
  }) {
    const res = await fetch(`${API_BASE_URL}/strategy`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async evaluateStrategy(id: string) {
    const res = await fetch(`${API_BASE_URL}/strategy/${id}/evaluate`, {
      method: 'POST',
      headers: headers()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  },

  async backtestStrategy(id: string, horizonDays = 7) {
    const res = await fetch(`${API_BASE_URL}/strategy/${id}/backtest`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ horizonDays })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    return data.data;
  }
};
