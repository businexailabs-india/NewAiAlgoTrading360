import { useCallback, useEffect, useState } from 'react';
import { tradingApi, type ChartPosition, type Instrument } from '@/api/trading';

export function useInstrumentSearch(initial = '') {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setQuery(q);
    setLoading(true);
    try {
      setResults(await tradingApi.searchInstruments(q || 'RELIANCE'));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void search(initial || 'NIFTY');
  }, [initial, search]);

  return { query, setQuery, results, loading, search };
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
  const reload = useCallback(async () => {
    setBaskets(await tradingApi.listBaskets());
  }, []);
  useEffect(() => {
    void reload().catch(() => setBaskets([]));
  }, [reload]);
  return { baskets, reload };
}
