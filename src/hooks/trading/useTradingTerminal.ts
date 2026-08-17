import { useCallback, useEffect, useRef, useState } from 'react';
import { tradingApi, type ChartPosition, type Instrument } from '@/api/trading';

export function useInstrumentSearch(initial = '') {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const text = (q || '').trim();
    setQuery(q);
    setLoading(true);
    setError(null);
    const reqId = ++reqRef.current;
    try {
      const rows = await tradingApi.searchInstruments(text || initial || 'RELIANCE');
      if (reqId !== reqRef.current) return;
      setResults(Array.isArray(rows) ? rows : []);
      if (Array.isArray(rows) && rows.length === 0) {
        setError(`No instruments matched “${text || 'empty'}”. Try RELIANCE, TCS, SBIN, NIFTY…`);
      }
    } catch (e) {
      if (reqId !== reqRef.current) return;
      setResults([]);
      setError(e instanceof Error ? e.message : 'Instrument search failed');
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, [initial]);

  const onQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void search(value);
      }, 280);
    },
    [search]
  );

  useEffect(() => {
    void search(initial || 'NIFTY');
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [initial, search]);

  return { query, setQuery: onQueryChange, results, loading, error, search };
}

export function useInstrumentTradability(instrumentId?: string) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!instrumentId) {
      setData(null);
      return;
    }
    setLoading(true);
    void tradingApi
      .getInstrumentTradability(instrumentId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [instrumentId]);

  return { data, loading };
}

export function useChartPositions(symbol?: string) {
  const [positions, setPositions] = useState<ChartPosition[]>([]);
  const reload = useCallback(async () => {
    if (!symbol) return;
    const data = await tradingApi.getChartPositions({ symbol });
    setPositions(data.positions || []);
  }, [symbol]);

  useEffect(() => {
    void reload().catch(() => setPositions([]));
  }, [reload]);

  return { positions, reload };
}

export function useBasketOrders() {
  const [baskets, setBaskets] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      const rows = await tradingApi.listBaskets();
      setBaskets(Array.isArray(rows) ? rows : []);
      setError(null);
    } catch (e) {
      setBaskets([]);
      setError(e instanceof Error ? e.message : 'Failed to load baskets');
      throw e;
    }
  }, []);
  useEffect(() => {
    void reload().catch(() => undefined);
  }, [reload]);
  useEffect(() => {
    const onFocus = () => {
      void reload().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reload]);
  return { baskets, reload, error };
}
