import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@/api/mcpProviders';
import { mcpKeys } from './keys';

export function useConnections() {
  return useQuery({
    queryKey: mcpKeys.connections(),
    queryFn: () => api.listConnections(),
  });
}

export function useConnection(connectionId: string | undefined) {
  return useQuery({
    queryKey: mcpKeys.connection(connectionId || ''),
    queryFn: () => api.getConnection(connectionId!),
    enabled: !!connectionId,
  });
}

export function useConnectionHealth(connectionId: string | undefined) {
  return useQuery({
    queryKey: mcpKeys.health(connectionId || ''),
    queryFn: () => api.getConnectionHealth(connectionId!),
    enabled: !!connectionId,
    refetchInterval: 15000,
  });
}

export function useAccountSnapshot(connectionId: string | undefined) {
  return useQuery({
    queryKey: mcpKeys.snapshot(connectionId || ''),
    queryFn: () => api.getAccountSnapshot(connectionId!),
    enabled: !!connectionId,
  });
}

export function useCreateConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      providerId: string;
      credentials: Record<string, string>;
      permissions?: Record<string, boolean>;
      accountAlias?: string;
      config?: Record<string, unknown>;
    }) =>
      api.createConnection(
        args.providerId,
        args.credentials,
        args.permissions,
        args.accountAlias,
        args.config
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpKeys.connections() }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (connectionId: string) => api.testConnection(connectionId),
  });
}

export function useDisconnectConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => api.disconnectConnection(connectionId),
    onSuccess: () => qc.invalidateQueries({ queryKey: mcpKeys.connections() }),
  });
}
