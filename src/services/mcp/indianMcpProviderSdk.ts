/**
 * Frontend API contracts for BusineXAi TradeOS360 Indian MCP providers.
 * UI screens: Broker Marketplace, Connect Dhan/Zerodha/..., Paper Trading,
 * Market Data Setup, Provider Health, Capability Matrix, Credential Masking,
 * Connection Test Result, Account Snapshot.
 *
 * Secrets must never be persisted in frontend state beyond masked values.
 */

export type IndianProvider = {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  country: string;
  supported_exchanges: string[];
  capabilities: string[];
  credentials_required: string[];
  live_trading_default: boolean;
  paper_trading_default: boolean;
  status: string;
  enabled: boolean;
};

export type MCPConnection = {
  id: string;
  provider_id: string;
  account_alias: string;
  status: string;
  health_status: string;
  credentials_masked?: Array<{ credential_type: string; masked_value: string }>;
};

export type OrderPreviewRequest = {
  exchange: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  order_type?: string;
  product_type?: string;
  price?: number;
  trigger_price?: number;
  validity?: string;
  idempotency_key?: string;
};

type RequestFn = <T>(path: string, init?: RequestInit) => Promise<T>;

function createDefaultRequest(baseUrl: string, getHeaders: () => Record<string, string>): RequestFn {
  return async <T>(path: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...getHeaders(),
        ...(init?.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MCP API ${res.status}: ${text}`);
    }
    const json = await res.json();
    return (json.data ?? json) as T;
  };
}

export class IndianMcpProviderSdk {
  private request: RequestFn;

  constructor(options?: {
    baseUrl?: string;
    getHeaders?: () => Record<string, string>;
    request?: RequestFn;
  }) {
    // Prefer Node BFF (/api) so HMAC stays server-side. Direct connector URL is opt-in.
    const baseUrl =
      options?.baseUrl ||
      import.meta.env.VITE_MCP_CONNECTOR_URL ||
      import.meta.env.VITE_API_URL ||
      '/api';
    this.request =
      options?.request ||
      createDefaultRequest(baseUrl, options?.getHeaders || (() => {
        const token = localStorage.getItem('authToken');
        return token ? { Authorization: `Bearer ${token}` } : {};
      }));
  }

  listIndianProviders(country = 'IN'): Promise<IndianProvider[]> {
    return this.request(`/mcp/providers?country=${encodeURIComponent(country)}`);
  }

  getProviderCapabilities(providerId: string): Promise<{
    provider_id: string;
    capabilities: string[];
    live_trading_default: boolean;
  }> {
    return this.request(`/mcp/providers/${encodeURIComponent(providerId)}/capabilities`);
  }

  connectProvider(
    providerId: string,
    credentials: Record<string, string>,
    accountAlias = '',
    config: Record<string, unknown> = { use_mock: true }
  ): Promise<{ connection: MCPConnection; connect_result: Record<string, unknown> }> {
    return this.request('/mcp/connections', {
      method: 'POST',
      body: JSON.stringify({
        provider_id: providerId,
        credentials,
        account_alias: accountAlias,
        config,
      }),
    });
  }

  testConnection(connectionId: string): Promise<{ health: Record<string, unknown> }> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}/test`, {
      method: 'POST',
    });
  }

  getConnectionHealth(connectionId: string): Promise<{ health: Record<string, unknown> }> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}/health`);
  }

  getAccountSnapshot(connectionId: string): Promise<Record<string, unknown>> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}/snapshot`);
  }

  getMargins(connectionId: string): Promise<Record<string, unknown>> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}/margins`);
  }

  getHoldings(connectionId: string): Promise<unknown[]> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}/holdings`);
  }

  getPositions(connectionId: string): Promise<unknown[]> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}/positions`);
  }

  getOrders(connectionId: string): Promise<unknown[]> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}/orders`);
  }

  getQuote(connectionId: string, symbol: string): Promise<Record<string, unknown>> {
    return this.request(
      `/mcp/connections/${encodeURIComponent(connectionId)}/quote/${encodeURIComponent(symbol)}`
    );
  }

  previewOrder(connectionId: string, orderRequest: OrderPreviewRequest): Promise<Record<string, unknown>> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}/orders/preview`, {
      method: 'POST',
      body: JSON.stringify({ order: orderRequest }),
    });
  }

  disconnectProvider(connectionId: string): Promise<{ deleted: boolean }> {
    return this.request(`/mcp/connections/${encodeURIComponent(connectionId)}`, {
      method: 'DELETE',
    });
  }

  /** DhanLaxmi-safe context — never includes raw secrets */
  getDhanLaxmiContext(): Promise<{
    connected_providers: Array<Record<string, unknown>>;
    preferred_broker: string;
    secrets_included: boolean;
  }> {
    return this.request('/mcp/dhanlaxmi/context');
  }
}

export const indianMcpProviderSdk = new IndianMcpProviderSdk();
