import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { McpProvider } from '@/api/mcpProviders';
import { maskSecret, isSensitiveCredentialKey } from '@/api/mcpProviders';
import {
  ProviderCard,
  LiveTradingLockedBanner,
  CapabilityMatrix,
  CredentialInput,
  ConnectionTestResult,
  ProviderFilterBar,
  ProviderAuditTable,
} from '@web-admin/components/mcp';
import { ProviderConnectWizard } from '@web-admin/components/mcp/ProviderConnectWizard';
import { hasMcpPermission, MCP_PERMISSIONS } from '../permissions';
import { McpRouteGuard } from '../guards/McpRouteGuard';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'user', permissions: [] },
    isLoading: false,
  }),
}));

const sampleProvider: McpProvider = {
  provider_id: 'dhan',
  provider_name: 'Dhan',
  provider_type: 'broker',
  country: 'IN',
  supported_exchanges: ['NSE', 'BSE'],
  supported_asset_classes: ['equity'],
  capabilities: ['holdings', 'positions', 'orders', 'order_preview'],
  credentials_required: ['client_id', 'access_token'],
  live_trading_default: false,
  paper_trading_default: true,
  status: 'available',
  enabled: true,
};

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('MCP Admin Console units', () => {
  it('renders provider cards from API-shaped data', () => {
    wrap(
      <ProviderCard
        provider={sampleProvider}
        onConnect={() => undefined}
        onConfigure={() => undefined}
        onDetails={() => undefined}
      />
    );
    expect(screen.getByTestId('provider-card')).toBeInTheDocument();
    expect(screen.getByText('Dhan')).toBeInTheDocument();
    expect(screen.getByText(/Live locked/i)).toBeInTheDocument();
  });

  it('masks secrets and marks sensitive credential keys', () => {
    expect(isSensitiveCredentialKey('access_token')).toBe(true);
    expect(isSensitiveCredentialKey('client_id')).toBe(false);
    expect(maskSecret('supersecrettoken')).toMatch(/\*+/);
    expect(maskSecret('supersecrettoken')).not.toContain('supersecret');
  });

  it('shows live trading locked banner', () => {
    wrap(<LiveTradingLockedBanner />);
    expect(screen.getByTestId('live-trading-locked-banner')).toBeInTheDocument();
    expect(screen.getByText(/AI cannot directly execute/i)).toBeInTheDocument();
  });

  it('renders capability matrix statuses', () => {
    wrap(<CapabilityMatrix providers={[sampleProvider]} />);
    expect(screen.getByTestId('capability-matrix')).toBeInTheDocument();
    expect(screen.getByLabelText('Locked')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Supported').length).toBeGreaterThan(0);
  });

  it('dynamically renders credential fields', () => {
    wrap(
      <CredentialInput
        name="access_token"
        value=""
        onChange={() => undefined}
        required
        sensitive
      />
    );
    expect(screen.getByTestId('credential-input-access_token')).toBeInTheDocument();
    expect(screen.getByLabelText(/Access Token/i)).toHaveAttribute('type', 'password');
  });

  it('filters providers via filter bar', () => {
    const onChange = vi.fn();
    wrap(<ProviderFilterBar filters={{ country: 'IN' }} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Search providers/i), {
      target: { value: 'dhan' },
    });
    expect(onChange).toHaveBeenCalled();
  });

  it('route guard blocks unauthorized users', () => {
    wrap(
      <McpRouteGuard permission={MCP_PERMISSIONS.manage_mcp_providers}>
        <div>secret-admin</div>
      </McpRouteGuard>
    );
    expect(screen.getByTestId('mcp-route-guard-blocked')).toBeInTheDocument();
    expect(screen.queryByText('secret-admin')).not.toBeInTheDocument();
  });

  it('permission helper grants admin', () => {
    expect(hasMcpPermission({ role: 'admin' }, MCP_PERMISSIONS.view_mcp_audit_logs)).toBe(true);
    expect(hasMcpPermission({ role: 'user' }, MCP_PERMISSIONS.view_mcp_audit_logs)).toBe(false);
  });

  it('connect wizard validates required credentials', async () => {
    const onCreateAndTest = vi.fn();
    wrap(
      <ProviderConnectWizard
        provider={sampleProvider}
        credentialSchema={{
          provider_id: 'dhan',
          credentials_required: ['client_id', 'access_token'],
          required: ['client_id', 'access_token'],
        }}
        onCreateAndTest={onCreateAndTest}
        onSave={() => undefined}
        onCancel={() => undefined}
      />
    );
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(screen.getByText('Next'));
    expect(await screen.findByText(/Fill all required credential fields/i)).toBeInTheDocument();
    expect(onCreateAndTest).not.toHaveBeenCalled();
  });

  it('connection test result displays success and failure', () => {
    const { rerender } = wrap(
      <ConnectionTestResult result={{ ok: true, latency_ms: 12, masked_client_id: '****6215' }} />
    );
    expect(screen.getByTestId('connection-test-result')).toHaveAttribute('data-status', 'success');
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ConnectionTestResult error="timeout" />
      </QueryClientProvider>
    );
    expect(screen.getByTestId('connection-test-result')).toHaveAttribute('data-status', 'failure');
  });

  it('audit table filters work', () => {
    const onFiltersChange = vi.fn();
    wrap(
      <ProviderAuditTable
        rows={[
          { action: 'connect', provider_id: 'dhan', result: 'success' },
          { action: 'disconnect', provider_id: 'zerodha', result: 'error' },
        ]}
        filters={{}}
        onFiltersChange={onFiltersChange}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Filter provider/i), {
      target: { value: 'dhan' },
    });
    expect(onFiltersChange).toHaveBeenCalled();
  });
});
