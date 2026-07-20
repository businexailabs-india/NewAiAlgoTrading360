import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessMcpConsole, hasMcpPermission, type McpPermission } from '../permissions';
import { ShieldOff } from 'lucide-react';

export function McpRouteGuard({
  permission,
  children,
}: {
  permission?: McpPermission;
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="text-zinc-400 p-6">Checking permissions…</p>;
  }

  const allowed = permission
    ? hasMcpPermission(user, permission)
    : canAccessMcpConsole(user);

  if (!allowed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-10 text-center"
        data-testid="mcp-route-guard-blocked"
      >
        <ShieldOff className="h-10 w-10 text-rose-300" />
        <h3 className="text-lg font-semibold text-white">Access denied</h3>
        <p className="max-w-md text-sm text-zinc-400">
          This MCP Admin Console page requires{' '}
          <code className="text-cyan-300">{permission || 'MCP admin permissions'}</code>. Contact a
          platform admin, or set <code className="text-cyan-300">VITE_MCP_ADMIN_ALLOW_ALL=true</code>{' '}
          for local demos.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
