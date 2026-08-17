/**
 * HTTP client for `/api/trade/us-stocks/*`.
 * Auth token from localStorage (same pattern as other trading panels).
 */
import { API_BASE_URL } from '@/lib/api';
import type {
  AccountSummary,
  AuditEvent,
  BrokerAccount,
  Execution,
  IBKRConnectionProfile,
  ManualOrderIntent,
  MarketQuote,
  MarketSessionInfo,
  ModifyOrderRequest,
  Order,
  OrderCapability,
  OrderEvent,
  OrderPreview,
  Position,
  SessionStatus,
  SubmitOrderRequest,
  USStockInstrument,
} from './types';
import { UsStocksApiError } from './types';

const BASE = `${API_BASE_URL}/trade/us-stocks`;

function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem('authToken') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const o = body as Record<string, unknown>;
  if (typeof o.message === 'string' && o.message.trim()) return o.message;
  if (typeof o.error === 'string' && o.error.trim()) return o.error;
  if (o.data && typeof o.data === 'object') {
    const d = o.data as Record<string, unknown>;
    if (typeof d.message === 'string') return d.message;
  }
  return fallback;
}

function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in (body as object)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  opts?: { allowEmpty?: boolean }
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...authHeaders(),
        ...(init?.headers || {}),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    throw new UsStocksApiError(
      `US Stocks API unreachable (${msg}). Ensure backend is running and /api/trade/us-stocks is mounted.`,
      0
    );
  }

  const body = await parseJson(res);

  if (!res.ok) {
    throw new UsStocksApiError(
      extractErrorMessage(body, `Request failed (${res.status})`),
      res.status,
      body
    );
  }

  if (opts?.allowEmpty && (body == null || body === '')) {
    return undefined as T;
  }

  return unwrapData<T>(body);
}

export const usStocksApi = {
  getSession(): Promise<SessionStatus> {
    return request<SessionStatus>('/session');
  },

  establishSession(): Promise<SessionStatus> {
    return request<SessionStatus>('/session/establish', { method: 'POST', body: '{}' });
  },

  getProfiles(): Promise<IBKRConnectionProfile[]> {
    return request<IBKRConnectionProfile[]>('/profiles');
  },

  selectProfile(profileId: string): Promise<SessionStatus> {
    return request<SessionStatus>('/profiles/select', {
      method: 'POST',
      body: JSON.stringify({ profileId }),
    });
  },

  getAccounts(): Promise<BrokerAccount[]> {
    return request<BrokerAccount[]>('/accounts');
  },

  getAccountSummary(accountId: string): Promise<AccountSummary> {
    return request<AccountSummary>(`/accounts/${encodeURIComponent(accountId)}/summary`);
  },

  searchInstruments(q: string): Promise<USStockInstrument[]> {
    return request<USStockInstrument[]>(`/instruments/search?q=${encodeURIComponent(q)}`);
  },

  getInstrument(conId: number): Promise<USStockInstrument> {
    return request<USStockInstrument>(`/instruments/${conId}`);
  },

  getCapabilities(conId: number): Promise<OrderCapability> {
    return request<OrderCapability>(`/instruments/${conId}/capabilities`);
  },

  getQuote(conId: number): Promise<MarketQuote> {
    return request<MarketQuote>(`/quotes/${conId}`);
  },

  getMarketSession(): Promise<MarketSessionInfo> {
    return request<MarketSessionInfo>('/market-session');
  },

  getPositions(accountId: string): Promise<Position[]> {
    return request<Position[]>(`/accounts/${encodeURIComponent(accountId)}/positions`);
  },

  getOrders(accountId: string): Promise<Order[]> {
    return request<Order[]>(`/accounts/${encodeURIComponent(accountId)}/orders`);
  },

  getExecutions(accountId: string): Promise<Execution[]> {
    return request<Execution[]>(`/accounts/${encodeURIComponent(accountId)}/executions`);
  },

  previewOrder(intent: ManualOrderIntent): Promise<OrderPreview> {
    return request<OrderPreview>('/orders/preview', {
      method: 'POST',
      body: JSON.stringify(intent),
    });
  },

  submitOrder(payload: SubmitOrderRequest): Promise<Order> {
    return request<Order>('/orders/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  confirmBrokerReply(messageId: string): Promise<Order> {
    return request<Order>(`/orders/reply/${encodeURIComponent(messageId)}/confirm`, {
      method: 'POST',
      body: '{}',
    });
  },

  rejectBrokerReply(messageId: string): Promise<Order> {
    return request<Order>(`/orders/reply/${encodeURIComponent(messageId)}/reject`, {
      method: 'POST',
      body: '{}',
    });
  },

  modifyOrder(orderId: string, patch: ModifyOrderRequest): Promise<Order> {
    return request<Order>(`/orders/${encodeURIComponent(orderId)}/modify`, {
      method: 'POST',
      body: JSON.stringify(patch),
    });
  },

  cancelOrder(orderId: string): Promise<Order> {
    return request<Order>(`/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE' });
  },

  getOrder(orderId: string): Promise<Order> {
    return request<Order>(`/orders/${encodeURIComponent(orderId)}`);
  },

  getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    return request<OrderEvent[]>(`/orders/${encodeURIComponent(orderId)}/events`);
  },

  getAudit(): Promise<AuditEvent[]> {
    return request<AuditEvent[]>('/audit');
  },
};
