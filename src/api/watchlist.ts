import { API_BASE_URL } from '@/lib/api';

export type WatchlistItem = {
  id: string;
  symbol: string;
  exchange: string;
  notes?: string | null;
  sortOrder: number;
  createdAt?: string;
  name?: string;
  price?: number;
  change?: number;
  changePercent?: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  bid?: number;
  ask?: number;
  buyers?: number;
  sellers?: number;
  quoteAsOf?: string;
  quoteSource?: string;
};

export type Watchlist = {
  id: string;
  name: string;
  isDefault: boolean;
  items: WatchlistItem[];
  createdAt?: string;
  updatedAt?: string;
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
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

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error('Backend unreachable — start the API on port 3001 and refresh');
  }
  const json = await res.json().catch(() => ({}));
  if ((res.status === 401 || res.status === 403) && !retried) {
    await ensureGuestToken();
    return request<T>(path, init, true);
  }
  if (!res.ok) {
    const detail = json.message || json.detail || json.error;
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(detail || 'Backend unavailable — restart the API and refresh');
    }
    if (res.status === 500 && !detail) {
      throw new Error('Watchlist API 500 — backend error or proxy could not reach port 3001');
    }
    throw new Error(detail || `Watchlist API ${res.status}`);
  }
  return (json.data ?? json) as T;
}

export function listWatchlists() {
  return request<Watchlist[]>('/watchlists');
}

export function createWatchlist(name: string, symbols?: string[]) {
  return request<Watchlist>('/watchlists', {
    method: 'POST',
    body: JSON.stringify({ name, symbols }),
  });
}

export function addWatchlistSymbol(watchlistId: string, symbol: string, exchange = 'NSE') {
  return request<Watchlist>(`/watchlists/${encodeURIComponent(watchlistId)}/symbols`, {
    method: 'POST',
    body: JSON.stringify({ symbol, exchange }),
  });
}

export function removeWatchlistSymbol(watchlistId: string, itemId: string) {
  return request<Watchlist>(
    `/watchlists/${encodeURIComponent(watchlistId)}/symbols/${encodeURIComponent(itemId)}`,
    { method: 'DELETE' }
  );
}

export function addToDefaultWatchlist(symbol: string, exchange = 'NSE') {
  return request<Watchlist>('/watchlists/default/symbols', {
    method: 'POST',
    body: JSON.stringify({ symbol, exchange }),
  });
}

export function deleteWatchlist(watchlistId: string) {
  return request<{ deleted: boolean }>(`/watchlists/${encodeURIComponent(watchlistId)}`, {
    method: 'DELETE',
  });
}
