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

export const governanceApi = {
  createIntent(body: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/execution/intents`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },
  evaluate(intentId: string) {
    return fetch(`${API_BASE_URL}/execution/intents/${intentId}/evaluate`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json<Record<string, unknown>>(r));
  },
  approve(intentId: string) {
    return fetch(`${API_BASE_URL}/execution/intents/${intentId}/approve`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json<Record<string, unknown>>(r));
  },
  reject(intentId: string) {
    return fetch(`${API_BASE_URL}/execution/intents/${intentId}/reject`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json<Record<string, unknown>>(r));
  },
  submitRms(intentId: string) {
    return fetch(`${API_BASE_URL}/execution/intents/${intentId}/submit-to-rms`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json<Record<string, unknown>>(r));
  },
  submitOms(intentId: string) {
    return fetch(`${API_BASE_URL}/execution/intents/${intentId}/submit-to-oms`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json<Record<string, unknown>>(r));
  },
  timeline(intentId: string) {
    return fetch(`${API_BASE_URL}/execution/intents/${intentId}/timeline`, { headers: headers() }).then(
      (r) => json<Record<string, unknown>[]>(r)
    );
  },
  explainBlock(intentId: string) {
    return fetch(`${API_BASE_URL}/execution/intents/${intentId}/explain-block`, {
      headers: headers()
    }).then((r) => json<Record<string, unknown>>(r));
  },
  recommend() {
    return fetch(`${API_BASE_URL}/algo-selection/recommend`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ capital_amount: 100000, market_condition: 'sideways' })
    }).then((r) => json<Record<string, unknown>>(r));
  },
  controlStatus() {
    return fetch(`${API_BASE_URL}/execution-control-room/status`, { headers: headers() }).then((r) =>
      json<Record<string, unknown>>(r)
    );
  },
  blockedActions() {
    return fetch(`${API_BASE_URL}/execution-control-room/blocked-actions`, { headers: headers() }).then(
      (r) => json<Record<string, unknown>[]>(r)
    );
  },
  killSwitch(active: boolean) {
    return fetch(`${API_BASE_URL}/execution-control-room/kill-switch`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ active })
    }).then((r) => json<Record<string, unknown>>(r));
  },
  listPreapprovals() {
    return fetch(`${API_BASE_URL}/preapproval-rules`, { headers: headers() }).then((r) =>
      json<Record<string, unknown>[]>(r)
    );
  },
  createPreapproval(body: Record<string, unknown>) {
    return fetch(`${API_BASE_URL}/preapproval-rules`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    }).then((r) => json<Record<string, unknown>>(r));
  },
  listApprovals() {
    return fetch(`${API_BASE_URL}/strategy-approvals`, { headers: headers() }).then((r) =>
      json<Record<string, unknown>[]>(r)
    );
  }
};
