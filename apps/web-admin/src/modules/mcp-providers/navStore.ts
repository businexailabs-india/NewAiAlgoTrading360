import { create } from 'zustand';

export type McpAdminRoute =
  | 'marketplace'
  | 'detail'
  | 'connect'
  | 'connections'
  | 'snapshot'
  | 'health'
  | 'capabilities'
  | 'market-data'
  | 'live-controls'
  | 'audit';

type McpNavState = {
  route: McpAdminRoute;
  providerId?: string;
  connectionId?: string;
  section: string;
  go: (route: McpAdminRoute, params?: { providerId?: string; connectionId?: string }) => void;
  setSection: (section: string) => void;
};

/** In-SPA routes mirroring /admin/mcp/* paths. */
export const useMcpNavStore = create<McpNavState>((set) => ({
  route: 'marketplace',
  providerId: undefined,
  connectionId: undefined,
  section: 'all',
  go: (route, params) =>
    set({
      route,
      providerId: params?.providerId,
      connectionId: params?.connectionId,
    }),
  setSection: (section) => set({ section }),
}));

export const MCP_NAV_ITEMS: Array<{
  route: McpAdminRoute;
  label: string;
  path: string;
  permission?: string;
}> = [
  { route: 'marketplace', label: 'Provider Marketplace', path: '/admin/mcp/providers' },
  { route: 'connections', label: 'Connections', path: '/admin/mcp/connections' },
  { route: 'health', label: 'Provider Health', path: '/admin/mcp/health' },
  { route: 'capabilities', label: 'Capability Matrix', path: '/admin/mcp/capabilities' },
  { route: 'market-data', label: 'Market Data Providers', path: '/admin/mcp/market-data' },
  { route: 'live-controls', label: 'Live Trading Controls', path: '/admin/mcp/live-trading-controls' },
  { route: 'audit', label: 'MCP Audit Logs', path: '/admin/mcp/audit' },
];
