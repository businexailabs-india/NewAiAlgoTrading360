import { useCallback, useEffect, useState } from 'react';
import { executionGovernanceApi } from '@/api/executionGovernance';

export function useHomeStatus() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await executionGovernanceApi.getHomeStatus());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, loading, reload };
}

export function useRecommendedAlgos() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    void executionGovernanceApi.getRecommendedAlgos().then(setData).catch(() => setData(null));
  }, []);
  return { data };
}

export function useExecutionTimeline(intentId?: string) {
  const [events, setEvents] = useState<Array<{ status: string; detail: string }>>([]);
  const reload = useCallback(async () => {
    if (!intentId) return;
    const rows = await executionGovernanceApi.getExecutionTimeline(intentId);
    setEvents(
      (rows || []).map((r) => ({
        status: String(r.status),
        detail: String(r.detail),
        createdAt: String(r.createdAt || r.created_at || '')
      }))
    );
  }, [intentId]);
  useEffect(() => {
    void reload().catch(() => setEvents([]));
  }, [reload]);
  return { events, reload };
}

export function useRiskGuardStatus() {
  return useHomeStatus();
}

export function useApprovals() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const reload = useCallback(async () => {
    setItems((await executionGovernanceApi.listApprovals()) || []);
  }, []);
  useEffect(() => {
    void reload().catch(() => setItems([]));
  }, [reload]);
  return { items, reload };
}
