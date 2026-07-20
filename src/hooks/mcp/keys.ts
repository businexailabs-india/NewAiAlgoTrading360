export const mcpKeys = {
  all: ['mcp'] as const,
  providers: (filters?: unknown) => [...mcpKeys.all, 'providers', filters] as const,
  provider: (id: string) => [...mcpKeys.all, 'provider', id] as const,
  capabilities: (id: string) => [...mcpKeys.all, 'capabilities', id] as const,
  credentials: (id: string) => [...mcpKeys.all, 'credentials', id] as const,
  connections: () => [...mcpKeys.all, 'connections'] as const,
  connection: (id: string) => [...mcpKeys.all, 'connection', id] as const,
  health: (id: string) => [...mcpKeys.all, 'health', id] as const,
  snapshot: (id: string) => [...mcpKeys.all, 'snapshot', id] as const,
  providerHealth: () => [...mcpKeys.all, 'provider-health'] as const,
  audit: (filters?: unknown) => [...mcpKeys.all, 'audit', filters] as const,
  liveTrading: () => [...mcpKeys.all, 'live-trading'] as const,
};
