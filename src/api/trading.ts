import { API_BASE_URL } from '@/lib/api';

function headers(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body.message || 'Request failed');
  return body.data as T;
}

export type Instrument = {
  instrument_id: string;
  symbol: string;
  display_name: string;
  exchange: string;
  segment: string;
  asset_class: string;
  instrument_type: string;
  tradable: boolean;
  direct_trading_allowed: boolean;
  lot_size: number;
  tick_size: number;
  expiry?: string | null;
  strike?: number | null;
  option_type?: string | null;
  underlying_symbol?: string | null;
  trading_status: string;
};

export const tradingApi = {
  searchInstruments(query: string) {
    return fetch(`${API_BASE_URL}/instruments/search?query=${encodeURIComponent(query)}`, {
      headers: headers()
    }).then((r) => json<Instrument[]>(r));
  },

  getInstrument(id: string) {
    return fetch(`${API_BASE_URL}/instruments/${id}`, { headers: headers() }).then((r) =>
      json<Instrument>(r)
    );
  },

  getInstrumentTradability(id: string) {
    return fetch(`${API_BASE_URL}/instruments/${id}/tradability`, { headers: headers() }).then((r) =>
      json<Record<string, unknown>>(r)
    );
  },

  getDerivativeContracts(id: string) {
    return fetch(`${API_BASE_URL}/instruments/${id}/derivatives`, { headers: headers() }).then((r) =>
      json<{ underlying: Instrument; contracts: Instrument[]; selectors: { key: string; label: string }[] }>(r)
    );
  },

  previewOrder(body: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/orders/preview`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },

  submitOrder(preview_id: string) {
    return fetch(`${API_BASE_URL}/orders/submit`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ preview_id })
    }).then((r) => json<Record<string, unknown>>(r));
  },

  approveOrder(preview_id: string) {
    return fetch(`${API_BASE_URL}/orders/approve`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ preview_id })
    }).then((r) => json<Record<string, unknown>>(r));
  },

  rejectOrder(preview_id: string) {
    return fetch(`${API_BASE_URL}/orders/reject`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ preview_id })
    }).then((r) => json<Record<string, unknown>>(r));
  },

  createBasket(body?: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/baskets`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body || {})
    }).then((r) => json<Record<string, unknown>>(r));
  },

  listBaskets() {
    return fetch(`${API_BASE_URL}/baskets`, { headers: headers() }).then((r) =>
      json<Record<string, unknown>[]>(r)
    );
  },

  getBasket(id: string) {
    return fetch(`${API_BASE_URL}/baskets/${id}`, { headers: headers() }).then((r) =>
      json<Record<string, unknown>>(r)
    );
  },

  addBasketLeg(basketId: string, leg: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/baskets/${basketId}/legs`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(leg)
    }).then((r) => json<Record<string, unknown>>(r));
  },

  previewBasket(basketId: string) {
    return fetch(`${API_BASE_URL}/baskets/${basketId}/preview`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json<Record<string, unknown>>(r));
  },

  submitBasket(basketId: string) {
    return fetch(`${API_BASE_URL}/baskets/${basketId}/submit`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json<Record<string, unknown>>(r));
  },

  getChartPositions(params?: { instrument_id?: string; symbol?: string }) {
    const q = new URLSearchParams();
    if (params?.instrument_id) q.set('instrument_id', params.instrument_id);
    if (params?.symbol) q.set('symbol', params.symbol);
    const qs = q.toString();
    return fetch(`${API_BASE_URL}/chart/positions${qs ? `?${qs}` : ''}`, { headers: headers() }).then(
      (r) => json<{ positions: ChartPosition[]; recent_orders: unknown[] }>(r)
    );
  },

  chartAddQuantity(body: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/chart/orders/add-quantity`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },

  chartReduceQuantity(body: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/chart/orders/reduce-quantity`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },

  chartExitQuantity(body: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/chart/orders/exit-quantity`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },

  chartExitFull(body: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/chart/orders/exit-full`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },

  addChartInstrumentToBasket(body: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/chart/basket/add-leg`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },

  listAudits() {
    return fetch(`${API_BASE_URL}/trading-terminal/audits`, { headers: headers() }).then((r) =>
      json<Record<string, unknown>[]>(r)
    );
  }
};

export type ChartPosition = {
  position_id: string;
  symbol: string;
  exchange: string;
  side: string;
  quantity: number;
  average_price: number;
  last_price: number;
  unrealized_pnl: number;
  stop_loss: number | null;
  target: number | null;
};
