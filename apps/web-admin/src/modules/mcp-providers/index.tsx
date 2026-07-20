import { Network } from 'lucide-react';
import { MCP_NAV_ITEMS, useMcpNavStore } from './navStore';
import { McpRouteGuard } from './guards/McpRouteGuard';
import { MCP_PERMISSIONS } from './permissions';
import { ProviderMarketplacePage } from './pages/ProviderMarketplacePage';
import { ProviderDetailPage } from './pages/ProviderDetailPage';
import { ConnectProviderWizardPage } from './pages/ConnectProviderWizardPage';
import { ConnectionsPage } from './pages/ConnectionsPage';
import { AccountSnapshotPage } from './pages/AccountSnapshotPage';
import { ProviderHealthPage } from './pages/ProviderHealthPage';
import { CapabilityMatrixPage } from './pages/CapabilityMatrixPage';
import { MarketDataProvidersPage } from './pages/MarketDataProvidersPage';
import { LiveTradingControlsPage } from './pages/LiveTradingControlsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { LiveTradingLockedBanner } from '@web-admin/components/mcp';

const ROUTE_PERMISSION: Record<string, (typeof MCP_PERMISSIONS)[keyof typeof MCP_PERMISSIONS]> = {
  marketplace: MCP_PERMISSIONS.manage_mcp_providers,
  detail: MCP_PERMISSIONS.manage_mcp_providers,
  connect: MCP_PERMISSIONS.manage_broker_connections,
  connections: MCP_PERMISSIONS.manage_broker_connections,
  snapshot: MCP_PERMISSIONS.manage_broker_connections,
  health: MCP_PERMISSIONS.view_provider_health,
  capabilities: MCP_PERMISSIONS.manage_mcp_providers,
  'market-data': MCP_PERMISSIONS.manage_market_data_providers,
  'live-controls': MCP_PERMISSIONS.manage_live_trading_controls,
  audit: MCP_PERMISSIONS.view_mcp_audit_logs,
};

/**
 * Indian MCP Provider Configuration Framework — Admin Console module.
 * Logical routes: /admin/mcp/providers, /connections, /health, …
 */
export function McpProvidersModule() {
  const route = useMcpNavStore((s) => s.route);
  const go = useMcpNavStore((s) => s.go);
  const permission = ROUTE_PERMISSION[route] || MCP_PERMISSIONS.manage_mcp_providers;

  return (
    <div className="space-y-4" data-testid="mcp-providers-module">
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-zinc-950 via-slate-900 to-cyan-950/40 p-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-2">
            <Network className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">MCP Providers</h1>
            <p className="text-xs text-zinc-400">
              Admin Console · Indian broker & market-data configuration framework
            </p>
          </div>
        </div>
        <div className="mt-4">
          <LiveTradingLockedBanner compact />
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="MCP admin submenu">
        {MCP_NAV_ITEMS.map((item) => (
          <button
            key={item.route}
            type="button"
            onClick={() => go(item.route)}
            className={`rounded-lg px-3 py-1.5 text-xs transition ${
              route === item.route ||
              (item.route === 'marketplace' && (route === 'detail' || route === 'connect')) ||
              (item.route === 'connections' && route === 'snapshot')
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
            }`}
            title={item.path}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <McpRouteGuard permission={permission}>
        {route === 'marketplace' && <ProviderMarketplacePage />}
        {route === 'detail' && <ProviderDetailPage />}
        {route === 'connect' && <ConnectProviderWizardPage />}
        {route === 'connections' && <ConnectionsPage />}
        {route === 'snapshot' && <AccountSnapshotPage />}
        {route === 'health' && <ProviderHealthPage />}
        {route === 'capabilities' && <CapabilityMatrixPage />}
        {route === 'market-data' && <MarketDataProvidersPage />}
        {route === 'live-controls' && <LiveTradingControlsPage />}
        {route === 'audit' && <AuditLogsPage />}
      </McpRouteGuard>
    </div>
  );
}

export default McpProvidersModule;
