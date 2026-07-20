import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import * as api from '@/api/mcpProviders';
import { mcpKeys } from './keys';

export function useProviderHealth() {
  return useQuery({
    queryKey: mcpKeys.providerHealth(),
    queryFn: () => api.listProviderHealth(),
    refetchInterval: 20000,
  });
}

export function useProviderAuditLogs(filters?: Record<string, string>) {
  return useQuery({
    queryKey: mcpKeys.audit(filters),
    queryFn: () => api.listProviderAuditLogs(filters),
  });
}

export function useLiveTradingStatus() {
  return useQuery({
    queryKey: mcpKeys.liveTrading(),
    queryFn: () => api.getLiveTradingStatus(),
  });
}

/** Subscribe to Socket.IO channel mcp.connection.health.changed (BFF poll broadcast). */
export function useMcpHealthSocket() {
  const qc = useQueryClient();
  const [lastEvent, setLastEvent] = useState<unknown>(null);

  useEffect(() => {
    const base =
      import.meta.env.VITE_WS_URL ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    let socket: Socket | null = null;
    try {
      socket = io(base, { path: '/socket.io', transports: ['websocket', 'polling'] });
      socket.emit('subscribe', ['mcp.connection.health.changed']);
      socket.on('mcp.connection.health.changed', (payload: unknown) => {
        setLastEvent(payload);
        qc.invalidateQueries({ queryKey: mcpKeys.providerHealth() });
      });
    } catch {
      // WS optional — REST polling remains
    }
    return () => {
      socket?.emit('unsubscribe', ['mcp.connection.health.changed']);
      socket?.disconnect();
    };
  }, [qc]);

  return lastEvent;
}
