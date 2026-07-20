/** MCP Admin Console permission keys (frontend gate; backend still enforces admin). */

export const MCP_PERMISSIONS = {
  manage_mcp_providers: 'manage_mcp_providers',
  manage_broker_connections: 'manage_broker_connections',
  view_provider_health: 'view_provider_health',
  manage_market_data_providers: 'manage_market_data_providers',
  view_mcp_audit_logs: 'view_mcp_audit_logs',
  manage_live_trading_controls: 'manage_live_trading_controls',
} as const;

export type McpPermission = (typeof MCP_PERMISSIONS)[keyof typeof MCP_PERMISSIONS];

export type McpAuthUser = {
  role?: string;
  permissions?: string[];
} | null;

/** Admin role grants all MCP permissions. Dev flag opens console for local demo. */
export function hasMcpPermission(user: McpAuthUser, permission: McpPermission): boolean {
  if (import.meta.env.VITE_MCP_ADMIN_ALLOW_ALL === 'true') return true;
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'admin' || role === 'super_admin' || role === 'platform_admin') return true;
  const perms = user.permissions || [];
  return perms.includes(permission);
}

export function canAccessMcpConsole(user: McpAuthUser): boolean {
  return Object.values(MCP_PERMISSIONS).some((p) => hasMcpPermission(user, p));
}
