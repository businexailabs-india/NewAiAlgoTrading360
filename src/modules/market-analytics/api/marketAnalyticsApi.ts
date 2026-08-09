const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function maFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    credentials: 'include',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || res.statusText);
  return json;
}

export const marketAnalyticsApi = {
  summary: () => maFetch('/dashboard/summary'),
  signals: (q = '') => maFetch(`/signals${q}`),
  signal: (id: string) => maFetch(`/signals/${id}`),
  accounts: () => maFetch('/accounts'),
  connectAccount: (body: Record<string, unknown>) =>
    maFetch('/accounts/connect', { method: 'POST', body: JSON.stringify(body) }),
  reconcile: (id: string) => maFetch(`/accounts/${id}/reconcile`, { method: 'POST', body: '{}' }),
  strategies: () => maFetch('/strategies'),
  strategy: (id: string) => maFetch(`/strategies/${id}`),
  patchStrategy: (id: string, body: Record<string, unknown>) =>
    maFetch(`/strategies/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  performance: () => maFetch('/performance'),
  risk: () => maFetch('/risk/status'),
  audit: () => maFetch('/audit'),
  killOn: (reason: string) =>
    maFetch('/kill-switch/activate', { method: 'POST', body: JSON.stringify({ reason }) }),
  killOff: () => maFetch('/kill-switch/deactivate', { method: 'POST', body: '{}' }),
  webhookHealth: () => maFetch('/webhooks/health'),
  createWebhook: (secret?: string) =>
    maFetch('/webhooks/endpoints', { method: 'POST', body: JSON.stringify({ secret }) }),
  testWebhook: () => maFetch('/webhooks/tradingview/test', { method: 'POST', body: '{}' }),
  safety: () => maFetch('/meta/safety'),
  exportUrl: (kind: string) => `${API_BASE}/api/v1/exports/${kind}.csv`,
  eventsUrl: () => `${API_BASE}/api/v1/events/stream`,
};
