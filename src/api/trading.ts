import { API_BASE_URL } from '@/lib/api';

function headers(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function ensureGuestToken(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/local-guest`, { method: 'POST' });
    const json = await res.json().catch(() => ({}));
    const token = json?.data?.accessToken;
    if (res.ok && token) {
      localStorage.setItem('authToken', token);
      if (json.data.refreshToken) localStorage.setItem('refreshToken', json.data.refreshToken);
      if (json.data.user) localStorage.setItem('user', JSON.stringify(json.data.user));
    }
  } catch {
    /* ignore */
  }
}

async function json<T>(res: Response, retry?: () => Promise<Response>): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if ((res.status === 401 || res.status === 403) && retry && /token/i.test(String(body.message || ''))) {
    await ensureGuestToken();
    const again = await retry();
    return json<T>(again);
  }
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

function getJson<T>(path: string) {
  const run = () => fetch(`${API_BASE_URL}${path}`, { headers: headers() });
  return run().then((r) => json<T>(r, run));
}

export const tradingApi = {
  searchInstruments(query: string) {
    return getJson<Instrument[]>(`/instruments/search?query=${encodeURIComponent(query)}`);
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

  updateBasket(id: string, body: { basket_name?: string; partial_allowed?: boolean; all_or_none?: boolean }) {
    return fetch(`${API_BASE_URL}/baskets/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },

  deleteBasket(id: string) {
    return fetch(`${API_BASE_URL}/baskets/${id}`, {
      method: 'DELETE',
      headers: headers()
    }).then((r) => json<Record<string, unknown>>(r));
  },

  duplicateBasket(id: string) {
    return fetch(`${API_BASE_URL}/baskets/${id}/duplicate`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json<Record<string, unknown>>(r));
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
  },

  getQuote(symbol: string) {
    return fetch(`${API_BASE_URL}/market/quote/${encodeURIComponent(symbol)}`, {
      headers: headers()
    }).then((r) => json<MarketQuote>(r));
  },

  getContractQuote(instrumentId: string, opts?: { expiry?: string; kind?: 'WEEKLY' | 'MONTHLY' | 'ALL' }) {
    const q = new URLSearchParams();
    if (opts?.expiry) q.set('expiry', opts.expiry);
    if (opts?.kind) q.set('kind', opts.kind);
    const qs = q.toString();
    return fetch(
      `${API_BASE_URL}/instruments/${encodeURIComponent(instrumentId)}/contract-quote${qs ? `?${qs}` : ''}`,
      { headers: headers() }
    ).then((r) => json<ContractQuote>(r));
  },

  getOptionExpiries(underlying: string) {
    return getJson<OptionExpiryCalendar>(
      `/options/expiries?underlying=${encodeURIComponent(underlying)}`
    );
  },

  getOptionsChain(params: { underlying: string; expiry?: string; kind?: 'WEEKLY' | 'MONTHLY' | 'ALL' }) {
    const q = new URLSearchParams({ underlying: params.underlying });
    if (params.expiry) q.set('expiry', params.expiry);
    if (params.kind) q.set('kind', params.kind);
    return getJson<OptionsChainPayload>(`/options/chain?${q}`);
  }
};

export type MarketQuote = {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  timestamp?: string;
  asOf?: string;
  stale?: boolean;
  source?: string;
  available?: boolean;
};

export type FoExpiryEntry = {
  date: string;
  kind: 'WEEKLY' | 'MONTHLY';
  label: string;
  weekday: string;
  scheduled?: string;
  holiday_adjusted?: boolean;
  holiday_name?: string;
};

export type OptionExpiryCalendar = {
  underlying: string;
  expiries: string[];
  calendar: FoExpiryEntry[];
  weekly: FoExpiryEntry[];
  monthly: FoExpiryEntry[];
  source: string;
  has_weekly?: boolean;
  monthly_only?: boolean;
  expiry_mode?: 'WEEKLY_AND_MONTHLY' | 'MONTHLY_ONLY';
};

export type OptionsChainPayload = {
  underlying?: string;
  expiry?: string;
  expiry_kind?: 'WEEKLY' | 'MONTHLY' | null;
  expiry_label?: string | null;
  spotPrice?: number;
  atm?: number;
  rows?: Array<{
    strike: number;
    ce?: { ltp: number; iv?: number; oi?: number; tradingSymbol?: string; quoteSource?: string };
    pe?: { ltp: number; iv?: number; oi?: number; tradingSymbol?: string; quoteSource?: string };
  }>;
  providerStatus?: string;
  quoteSource?: string;
  quoteFreshness?: 'live' | 'delayed';
  brokerQuoteCount?: number;
  message?: string;
  expiry_calendar?: OptionExpiryCalendar;
};

export type ContractQuote = {
  instrument: Instrument;
  underlying: string | null;
  strike: number | null;
  option_type: 'CE' | 'PE' | null;
  expiry: string | null;
  expiry_kind?: 'WEEKLY' | 'MONTHLY' | null;
  expiry_label?: string | null;
  expiry_calendar?: OptionExpiryCalendar | null;
  lot_size: number;
  spot: number | null;
  spot_change: number;
  spot_change_percent: number;
  spot_source: string | null;
  premium: number | null;
  intrinsic: number | null;
  time_value: number | null;
  premium_source: string | null;
  order_price: number | null;
  message: string | null;
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
