import { API_BASE_URL } from '@/lib/api';
import { governanceApi } from './governance';
import { tradingApi } from './trading';

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
  return (body.data ?? body) as T;
}

/** Unified ExecutionGovernance UX client */
export const executionGovernanceApi = {
  getHomeStatus: () => governanceApi.controlStatus(),
  getRecommendedAlgos: () => governanceApi.recommend(),
  getAllowedAlgos: () =>
    fetch(`${API_BASE_URL}/algo-selection/user/me/allowed-algos`, { headers: headers() })
      .then((r) => json(r))
      .catch(() => governanceApi.recommend()),
  getBlockedAlgos: () => governanceApi.controlStatus().then((s) => s.blocked_algos),
  getExecutionIntent: (id: string) =>
    fetch(`${API_BASE_URL}/execution/intents/${id}`, { headers: headers() }).then((r) => json(r)),
  evaluateExecutionIntent: (id: string) => governanceApi.evaluate(id),
  getExecutionTimeline: (id: string) => governanceApi.timeline(id),
  requestApproval: (id: string) =>
    fetch(`${API_BASE_URL}/execution/intents/${id}/request-approval`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json(r)),
  approveExecution: (id: string) => governanceApi.approve(id),
  rejectExecution: (id: string) => governanceApi.reject(id),
  createPreapprovalRule: (body: Record<string, unknown>) => governanceApi.createPreapproval(body),
  getPreapprovalRules: () => governanceApi.listPreapprovals(),
  revokePreapprovalRule: (id: string) =>
    fetch(`${API_BASE_URL}/preapproval-rules/${id}/revoke`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json(r)),
  getRiskGuardStatus: () => governanceApi.controlStatus(),
  triggerKillSwitch: (active = true) => governanceApi.killSwitch(active),
  enableNoTradeMode: (enabled = true) =>
    fetch(`${API_BASE_URL}/execution-control-room/no-trade-mode`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ enabled })
    }).then((r) => json(r)),
  getTradingViewConnections: () =>
    fetch(`${API_BASE_URL}/tradingview/connections`, { headers: headers() }).then((r) => json(r)),
  createTradingViewConnection: () =>
    fetch(`${API_BASE_URL}/tradingview/connections`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: 'TradingView Connect' })
    }).then((r) => json(r)),
  rotateTradingViewSecret: (id: string) =>
    fetch(`${API_BASE_URL}/tradingview/connections/${id}/rotate-secret`, {
      method: 'POST',
      headers: headers(),
      body: '{}'
    }).then((r) => json(r)),
  getTradingViewSignals: () =>
    fetch(`${API_BASE_URL}/signals`, { headers: headers() }).then((r) => json(r)),
  getPaperTests: () => Promise.resolve([]),
  runPaperTest: async (symbol: string) => {
    const intent = await governanceApi.createIntent({
      source: 'USER_MANUAL',
      mode: 'PAPER',
      symbol,
      side: 'BUY',
      quantity: 1,
      price: 1000,
      stop_loss: 970,
      instrument_type: 'STOCK'
    });
    const id = String(intent.id);
    await governanceApi.evaluate(id);
    await governanceApi.approve(id);
    await governanceApi.submitRms(id);
    const oms = await governanceApi.submitOms(id);
    return { intentId: id, ...oms };
  },
  previewOrder: (body: Record<string, unknown>) => tradingApi.previewOrder(body),
  submitPaperOrder: (previewId: string) => tradingApi.submitOrder(previewId),
  requestLiveApproval: (intentId: string) =>
    fetch(`${API_BASE_URL}/execution/intents/${intentId}/request-approval`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ approval_type: 'MANUAL_SINGLE_TRADE' })
    }).then((r) => json(r)),
  createBasket: () => tradingApi.createBasket({ basket_name: 'Safe Basket', mode: 'PAPER' }),
  previewBasket: (id: string) => tradingApi.previewBasket(id),
  submitBasketPaper: (id: string) => tradingApi.submitBasket(id),
  listApprovals: () => governanceApi.listApprovals(),
  explainBlock: (id: string) => governanceApi.explainBlock(id),
  createIntent: (body: Record<string, unknown>) => governanceApi.createIntent(body),
  submitRms: (id: string) => governanceApi.submitRms(id),
  submitOms: (id: string) => governanceApi.submitOms(id)
};

export { governanceApi, tradingApi };
