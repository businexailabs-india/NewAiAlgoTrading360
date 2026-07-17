import { API_BASE_URL } from '../lib/api';

function headers() {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Request failed (${res.status})`);
  return body.data as T;
}

export interface McpServerView {
  id: string;
  name: string;
  provider: string;
  transport: string;
  endpoint: string;
  isEnabled: boolean;
  lastHealthStatus: string | null;
  lastHealthCheckedAt: string | null;
  lastError: string | null;
  discoveredTools: Array<{ name: string }> | null;
  capabilities: Record<string, boolean> | null;
  latencyMs: number | null;
  hasHeaders: boolean;
  hasAuth: boolean;
}

export interface BrokerAccountView {
  id: string;
  broker: string;
  displayName: string | null;
  externalAccountId: string | null;
  providerType: string;
  mcpServerConfigId: string | null;
  status: string;
  isEnabled: boolean;
  capabilities: Record<string, boolean> | null;
  lastValidatedAt: string | null;
  lastError: string | null;
  maskedClientId: string;
}

export interface ExecutionContextView {
  context: {
    id: string;
    userId: string;
    executionMode: 'PAPER' | 'LIVE';
    version: number;
    activeBrokerConnectionId: string | null;
    activeMcpServerConfigId: string | null;
    activeAccount: BrokerAccountView | null;
    activeMcp: McpServerView | null;
  };
  controls: Array<{
    id: string;
    scope: string;
    liveTradingEnabled: boolean;
    killSwitch: boolean;
    approvalState: string;
    maxOrderValue: number | null;
    maxDailyOrderValue: number | null;
    maxDailyLoss: number | null;
    requirePaperQualify: boolean;
  }>;
  liveTradingEnvEnabled: boolean;
}

export interface FeatureStatus {
  backend: string;
  liveTradingEnvEnabled: boolean;
  globalLiveEnabled: boolean;
  killSwitch: boolean;
  mcpServers: Array<{ id: string; name: string; health: string | null; latencyMs: number | null; tools: number }>;
  accounts: Array<{ id: string; broker: string; status: string; providerType: string; selected: boolean }>;
  executionMode: string;
  selectedAccount: BrokerAccountView | null;
  capabilities: Record<string, boolean>;
  capabilityCatalog: Array<{ capability: string; tool: string; action: string; category: string; description: string; liveRequired?: boolean }>;
}

export const integrationService = {
  async getStatus(): Promise<FeatureStatus> {
    const res = await fetch(`${API_BASE_URL}/integrations/status`, { headers: headers() });
    return json(res);
  },

  async listMcpServers(): Promise<McpServerView[]> {
    const res = await fetch(`${API_BASE_URL}/integrations/mcp-servers`, { headers: headers() });
    return json(res);
  },

  async createMcpServer(body: {
    name: string;
    endpoint: string;
    transport?: string;
    headers?: Record<string, string>;
    authConfig?: Record<string, string>;
  }): Promise<McpServerView> {
    const res = await fetch(`${API_BASE_URL}/integrations/mcp-servers`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    return json(res);
  },

  async testMcpServer(id: string) {
    const res = await fetch(`${API_BASE_URL}/integrations/mcp-servers/${id}/test`, {
      method: 'POST',
      headers: headers()
    });
    return json(res);
  },

  async deleteMcpServer(id: string) {
    const res = await fetch(`${API_BASE_URL}/integrations/mcp-servers/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    return json(res);
  },

  async listAccounts(): Promise<BrokerAccountView[]> {
    const res = await fetch(`${API_BASE_URL}/integrations/accounts`, { headers: headers() });
    return json(res);
  },

  async upsertDhanAccount(body: {
    displayName?: string;
    clientId: string;
    accessToken: string;
    providerType?: 'DIRECT' | 'MCP';
    mcpServerConfigId?: string;
  }): Promise<BrokerAccountView> {
    const res = await fetch(`${API_BASE_URL}/integrations/accounts/dhan`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body)
    });
    return json(res);
  },

  async validateAccount(id: string) {
    const res = await fetch(`${API_BASE_URL}/integrations/accounts/${id}/validate`, {
      method: 'POST',
      headers: headers()
    });
    return json(res);
  },

  async setAccountEnabled(id: string, enabled: boolean) {
    const res = await fetch(`${API_BASE_URL}/integrations/accounts/${id}/enable`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ enabled })
    });
    return json(res);
  },

  async syncAccountPortfolio(id: string): Promise<{
    accountId: string;
    holdingsCount: number;
    totalInvested: number;
    totalCurrent: number;
    totalPnL: number;
  }> {
    const res = await fetch(`${API_BASE_URL}/integrations/accounts/${id}/sync`, {
      method: 'POST',
      headers: headers()
    });
    return json(res);
  },

  async bootstrapEnvDhan(): Promise<{ account: BrokerAccountView; sync: { holdingsCount: number; totalCurrent: number } }> {
    const res = await fetch(`${API_BASE_URL}/integrations/accounts/dhan/bootstrap-env`, {
      method: 'POST',
      headers: headers()
    });
    return json(res);
  },

  async getExecutionContext(): Promise<ExecutionContextView> {
    const res = await fetch(`${API_BASE_URL}/integrations/execution-context`, { headers: headers() });
    return json(res);
  },

  async updateExecutionContext(body: {
    activeBrokerConnectionId?: string | null;
    activeMcpServerConfigId?: string | null;
    executionMode?: 'PAPER' | 'LIVE';
    expectedVersion?: number;
  }): Promise<ExecutionContextView> {
    const res = await fetch(`${API_BASE_URL}/integrations/execution-context`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    });
    return json(res);
  },

  async updateTradingControl(body: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/integrations/trading-controls`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    });
    return json(res);
  },

  async adminUpdateTradingControl(body: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/admin/trading-controls`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body)
    });
    return json(res);
  },

  async adminAuditLogs(limit = 50) {
    const res = await fetch(`${API_BASE_URL}/admin/audit-logs?limit=${limit}`, { headers: headers() });
    return json(res);
  }
};
