/**
 * MCP Provider Admin API client.
 * All calls go through Node BFF (/api) — HMAC is signed server-side.
 * Never persist raw secrets beyond the connect wizard submit payload.
 */

import { API_BASE_URL } from '@/lib/api';

export type McpProvider = {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  country: string;
  supported_exchanges: string[];
  supported_segments?: string[];
  supported_asset_classes?: string[];
  capabilities: string[];
  auth_type?: string;
  credentials_required: string[];
  live_trading_default: boolean;
  paper_trading_default: boolean;
  status: string;
  enabled: boolean;
  documentation_url?: string | null;
};

export type McpConnection = {
  id: string;
  provider_id: string;
  account_alias?: string;
  status: string;
  auth_status?: string;
  health_status?: string;
  tenant_id?: string;
  user_id?: string;
  last_connected_at?: string | null;
  last_health_check_at?: string | null;
  capabilities_json?: string[] | Record<string, unknown>;
  credentials_masked?: Array<{ credential_type: string; masked_value: string }>;
  config_json?: Record<string, unknown>;
  /** Connection-level live flag (admin-gated; never implies AI can execute). */
  live_trading_enabled?: boolean;
};

export type CredentialSchema = {
  provider_id: string;
  credentials_required: string[];
  auth_type?: string;
  required?: string[];
  optional?: string[];
  fields?: Array<{
    name: string;
    label?: string;
    type?: string;
    sensitive?: boolean;
    required?: boolean;
  }>;
};

export type ProviderFilters = {
  country?: string;
  providerType?: string;
  exchange?: string;
  capability?: string;
  status?: string;
  search?: string;
};

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.detail || json.message || `MCP API ${res.status}`);
  }
  return (json.data ?? json) as T;
}

function filterProviders(list: McpProvider[], filters?: ProviderFilters): McpProvider[] {
  if (!filters) return list;
  return list.filter((p) => {
    if (filters.country && p.country?.toUpperCase() !== filters.country.toUpperCase()) return false;
    if (filters.providerType) {
      const t = p.provider_type?.toLowerCase() || '';
      if (!t.includes(filters.providerType.toLowerCase().replace(/\s+/g, '_')) &&
          !t.includes(filters.providerType.toLowerCase())) {
        return false;
      }
    }
    if (filters.exchange && !(p.supported_exchanges || []).some((e) => e.toUpperCase() === filters.exchange!.toUpperCase())) {
      return false;
    }
    if (filters.capability) {
      const cap = filters.capability.toLowerCase().replace(/\s+/g, '_');
      if (!(p.capabilities || []).some((c) => c.toLowerCase().includes(cap) || cap.includes(c.toLowerCase()))) {
        return false;
      }
    }
    if (filters.status) {
      const s = filters.status.toLowerCase();
      if (s === 'enabled' && !p.enabled) return false;
      if (s === 'disabled' && p.enabled) return false;
      if (s === 'placeholder' && !String(p.status).toLowerCase().includes('placeholder')) return false;
      if (s === 'connected' && !String(p.status).toLowerCase().includes('connected')) return false;
      if (s === 'error' && !String(p.status).toLowerCase().includes('error')) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${p.provider_id} ${p.provider_name} ${p.provider_type}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export async function listProviders(filters?: ProviderFilters): Promise<McpProvider[]> {
  const country = filters?.country || 'IN';
  const data = await request<McpProvider[]>(`/mcp/providers?country=${encodeURIComponent(country)}`);
  const list = Array.isArray(data) ? data : [];
  return filterProviders(list, filters);
}

export function getProvider(providerId: string) {
  return request<McpProvider>(`/mcp/providers/${encodeURIComponent(providerId)}`);
}

export function getProviderCapabilities(providerId: string) {
  return request<{
    provider_id: string;
    capabilities: string[];
    raw_capabilities?: string[];
    exchanges?: string[];
    live_trading_default?: boolean;
  }>(`/mcp/providers/${encodeURIComponent(providerId)}/capabilities`);
}

export function getProviderRequiredCredentials(providerId: string) {
  return request<CredentialSchema>(
    `/mcp/providers/${encodeURIComponent(providerId)}/required-credentials`
  );
}

export function validateProviderConfig(providerId: string, payload: { credentials: Record<string, string> }) {
  return request(`/mcp/providers/${encodeURIComponent(providerId)}/validate-config`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function reloadProviders() {
  return request<{ count: number; providers: string[] }>('/mcp/providers/reload', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function createConnection(
  providerId: string,
  credentials: Record<string, string>,
  permissions?: Record<string, boolean>,
  accountAlias?: string,
  config: Record<string, unknown> = { use_mock: true }
) {
  return request<{ connection: McpConnection; connect_result: Record<string, unknown> }>(
    '/mcp/connections',
    {
      method: 'POST',
      body: JSON.stringify({
        provider_id: providerId,
        credentials,
        account_alias: accountAlias || '',
        config: { ...config, permissions },
      }),
    }
  );
}

export function listConnections(_filters?: Record<string, string>) {
  return request<McpConnection[]>('/mcp/connections');
}

export function getConnection(connectionId: string) {
  return request<McpConnection>(`/mcp/connections/${encodeURIComponent(connectionId)}`);
}

export function testConnection(connectionId: string) {
  return request<Record<string, unknown>>(
    `/mcp/connections/${encodeURIComponent(connectionId)}/test`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export function refreshConnectionSession(connectionId: string) {
  return request(
    `/mcp/connections/${encodeURIComponent(connectionId)}/refresh-session`,
    { method: 'POST', body: JSON.stringify({}) }
  );
}

export function getConnectionHealth(connectionId: string) {
  return request<Record<string, unknown>>(
    `/mcp/connections/${encodeURIComponent(connectionId)}/health`
  );
}

export function getAccountSnapshot(connectionId: string) {
  return request<Record<string, unknown>>(
    `/mcp/connections/${encodeURIComponent(connectionId)}/snapshot`
  );
}

export function getMargins(connectionId: string) {
  return request(`/mcp/connections/${encodeURIComponent(connectionId)}/margins`);
}

export function getHoldings(connectionId: string) {
  return request(`/mcp/connections/${encodeURIComponent(connectionId)}/holdings`);
}

export function getPositions(connectionId: string) {
  return request(`/mcp/connections/${encodeURIComponent(connectionId)}/positions`);
}

export function getOrders(connectionId: string) {
  return request(`/mcp/connections/${encodeURIComponent(connectionId)}/orders`);
}

export function getTrades(connectionId: string) {
  return request(`/mcp/connections/${encodeURIComponent(connectionId)}/trades`);
}

export function getQuote(connectionId: string, symbol: string) {
  return request(
    `/mcp/connections/${encodeURIComponent(connectionId)}/quote/${encodeURIComponent(symbol)}`
  );
}

export function previewOrder(connectionId: string, orderRequest: Record<string, unknown>) {
  return request(`/mcp/connections/${encodeURIComponent(connectionId)}/orders/preview`, {
    method: 'POST',
    body: JSON.stringify({ order: orderRequest }),
  });
}

export function disconnectConnection(connectionId: string) {
  return request<{ deleted: boolean }>(
    `/mcp/connections/${encodeURIComponent(connectionId)}`,
    { method: 'DELETE' }
  );
}

export function listProviderHealth() {
  return request<unknown[]>('/admin/mcp/provider-health');
}

export function listProviderAuditLogs(_filters?: Record<string, string>) {
  return request<unknown[]>('/admin/mcp/audit');
}

export function enableProvider(providerId: string) {
  return request(`/admin/mcp/providers/${encodeURIComponent(providerId)}/enable`, {
    method: 'PUT',
    body: JSON.stringify({}),
  });
}

export function disableProvider(providerId: string) {
  return request(`/admin/mcp/providers/${encodeURIComponent(providerId)}/disable`, {
    method: 'PUT',
    body: JSON.stringify({}),
  });
}

export function updateProviderCapabilities(providerId: string, capabilities: string[]) {
  return request(`/admin/mcp/providers/${encodeURIComponent(providerId)}/capabilities`, {
    method: 'PUT',
    body: JSON.stringify({ capabilities }),
  });
}

export function adminListProviders() {
  return request<McpProvider[]>('/admin/mcp/providers');
}

export function adminListConnections() {
  return request<McpConnection[]>('/admin/mcp/connections');
}

export function getLiveTradingStatus() {
  return request<{
    live_trading_enabled?: boolean;
    paper_trading_enabled?: boolean;
    providers_loaded?: number;
  }>('/mcp/live-trading/status');
}

/** Admin: enable/disable live trading on a connection (requires LIVE_TRADING_ENABLED). */
export function setConnectionLiveTrading(connectionId: string, enabled: boolean) {
  return request<McpConnection>(
    `/admin/mcp/connections/${encodeURIComponent(connectionId)}/live-trading`,
    {
      method: 'PUT',
      body: JSON.stringify({ enabled }),
    }
  );
}

export function getDhanLaxmiContext() {
  return request('/mcp/dhanlaxmi/context');
}

export function getAdvisoryProviderContext() {
  return request('/mcp/advisory/provider-context');
}

/** Mask a secret for display — never reverseable. */
export function maskSecret(value: string, visible = 4): string {
  if (!value) return '';
  if (value.length <= visible) return '*'.repeat(value.length);
  return '*'.repeat(Math.max(4, value.length - visible)) + value.slice(-visible);
}

export const SENSITIVE_CREDENTIAL_KEYS = [
  'access_token',
  'api_secret',
  'api_key',
  'password',
  'totp_secret',
  'session_token',
  'refresh_token',
  'broker_token',
  'secret',
];

export function isSensitiveCredentialKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_CREDENTIAL_KEYS.some((s) => k.includes(s));
}
