/**
 * Integration-style flow for MCP Admin Console (mocked BFF).
 * Covers marketplace → Dhan detail → connect → test → snapshot flags → live locked.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { McpProvidersModule } from '../index';
import { useMcpNavStore } from '../navStore';

const dhan = {
  provider_id: 'dhan',
  provider_name: 'Dhan',
  provider_type: 'broker',
  country: 'IN',
  supported_exchanges: ['NSE', 'BSE'],
  capabilities: ['holdings', 'positions', 'orders', 'margins'],
  credentials_required: ['client_id', 'access_token'],
  live_trading_default: false,
  paper_trading_default: true,
  status: 'available',
  enabled: true,
  auth_type: 'access_token',
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'admin', email: 'admin@test.com', name: 'Admin' },
    isLoading: false,
  }),
}));

vi.mock('@/api/mcpProviders', async () => {
  const actual = await vi.importActual<typeof import('@/api/mcpProviders')>('@/api/mcpProviders');
  return {
    ...actual,
    listProviders: vi.fn(async () => [dhan]),
    getProvider: vi.fn(async () => dhan),
    getProviderCapabilities: vi.fn(async () => ({
      provider_id: 'dhan',
      capabilities: dhan.capabilities,
      live_trading_default: false,
    })),
    getProviderRequiredCredentials: vi.fn(async () => ({
      provider_id: 'dhan',
      credentials_required: ['client_id', 'access_token'],
      required: ['client_id', 'access_token'],
      optional: [],
      auth_type: 'access_token',
    })),
    validateProviderConfig: vi.fn(async () => ({ ok: true })),
    createConnection: vi.fn(async () => ({
      connection: {
        id: 'conn-1',
        provider_id: 'dhan',
        account_alias: 'Dhan Mock',
        status: 'connected',
        health_status: 'healthy',
      },
      connect_result: { ok: true, mode: 'mock' },
    })),
    testConnection: vi.fn(async () => ({
      ok: true,
      latency_ms: 8,
      masked_client_id: '****6215',
      mode: 'mock',
    })),
    listConnections: vi.fn(async () => [
      {
        id: 'conn-1',
        provider_id: 'dhan',
        account_alias: 'Dhan Mock',
        status: 'connected',
        health_status: 'healthy',
      },
    ]),
    getAccountSnapshot: vi.fn(async () => ({
      provider_id: 'dhan',
      secrets_included: false,
      live_order_execution: false,
      profile: { masked_client_id: '****6215' },
      margins: { available: 125000 },
      holdings: [{ symbol: 'RELIANCE' }, { symbol: 'TCS' }],
      positions: [],
      orders: [],
      trades: [],
    })),
    listProviderHealth: vi.fn(async () => [
      { provider_id: 'dhan', connection_id: 'conn-1', ok: true, latency_ms: 8 },
    ]),
    listProviderAuditLogs: vi.fn(async () => [
      { action: 'connect', provider_id: 'dhan', result: 'success', timestamp: '2026-07-19T00:00:00Z' },
    ]),
    getLiveTradingStatus: vi.fn(async () => ({
      live_trading_enabled: false,
      paper_trading_enabled: true,
      providers_loaded: 1,
    })),
    getDhanLaxmiContext: vi.fn(async () => ({
      preferred_broker: 'dhan',
      secrets_included: false,
    })),
    getAdvisoryProviderContext: vi.fn(async () => ({
      dhan_connected: true,
      live_trading_enabled: false,
    })),
    reloadProviders: vi.fn(async () => ({ count: 1, providers: ['dhan'] })),
  };
});

function renderModule() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <McpProvidersModule />
    </QueryClientProvider>
  );
}

describe('MCP Admin integration flow', () => {
  beforeEach(() => {
    useMcpNavStore.setState({ route: 'marketplace', providerId: undefined, connectionId: undefined });
  });

  it('loads marketplace and walks Dhan connect → snapshot with live locked', async () => {
    const user = userEvent.setup();
    renderModule();

    expect(await screen.findByTestId('mcp-marketplace-page')).toBeInTheDocument();
    expect(await screen.findByText('Dhan')).toBeInTheDocument();
    expect(screen.getAllByTestId('live-trading-locked-banner').length).toBeGreaterThan(0);

    await user.click(screen.getByText('View Details'));
    expect(await screen.findByTestId('mcp-provider-detail')).toBeInTheDocument();
    expect(screen.getByText(/Visible to DhanLaxmi/i)).toBeInTheDocument();
    expect(screen.getByText(/Use as advisory context source/i)).toBeInTheDocument();

    const connectButtons = screen.getAllByRole('button', { name: 'Connect' });
    await user.click(connectButtons[connectButtons.length - 1]);
    expect(await screen.findByTestId('mcp-connect-page')).toBeInTheDocument();

    // Step 0 → 1
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.type(screen.getByLabelText(/Client Id/i), '1112656215');
    await user.type(screen.getByLabelText(/Access Token/i), 'mock-token');
    // Step 1 → 2 (permissions)
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // Step 2 → 3 (test prompt)
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // Step 3 → 4 (create + test + confirm)
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(screen.getByTestId('connection-test-result')).toHaveAttribute('data-status', 'success');
      expect(screen.getByText(/conn-1/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Save connection' }));
    expect(await screen.findByTestId('mcp-connections-page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Snapshot' }));
    expect(await screen.findByTestId('mcp-snapshot-page')).toBeInTheDocument();
    expect(screen.getByText(/Disabled \(locked\)/i)).toBeInTheDocument();
    expect(screen.queryByText('mock-token')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Provider Health' }));
    expect(await screen.findByTestId('mcp-health-page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Capability Matrix' }));
    expect(await screen.findByTestId('mcp-capability-matrix-page')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'MCP Audit Logs' }));
    expect(await screen.findByTestId('mcp-audit-page')).toBeInTheDocument();
  });
});
