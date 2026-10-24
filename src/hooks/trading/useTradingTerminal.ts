import { useCallback, useEffect, useRef, useState } from 'react';
import { tradingApi, type ChartPosition, type Instrument } from '@/api/trading';
import { marketDataService } from '@/services/marketDataService';

const LOCAL_NAMES: Array<{ symbol: string; name: string; exchange?: string }> = [
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd' },
  { symbol: 'INFY', name: 'Infosys Ltd' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd' },
  { symbol: 'SBIN', name: 'State Bank of India' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd' },
  { symbol: 'ITC', name: 'ITC Ltd' },
  { symbol: 'WIPRO', name: 'Wipro Ltd' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd' },
  { symbol: 'TITAN', name: 'Titan Company Ltd' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd' },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd' },
  { symbol: 'NTPC', name: 'NTPC Ltd' },
  { symbol: 'ONGC', name: 'Oil and Natural Gas Corporation Ltd' },
  { symbol: 'COALINDIA', name: 'Coal India Ltd' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd' },
  { symbol: 'PNB', name: 'Punjab National Bank' },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda' },
  { symbol: 'IRCTC', name: 'IRCTC Ltd' },
  { symbol: 'NIFTY', name: 'Nifty 50 Index', exchange: 'INDEX' },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', exchange: 'INDEX' },
  { symbol: 'FINNIFTY', name: 'Nifty Financial Services Index', exchange: 'INDEX' },
  { symbol: 'MIDCPNIFTY', name: 'Nifty Midcap Select Index', exchange: 'INDEX' },
  { symbol: 'SENSEX', name: 'BSE Sensex Index', exchange: 'INDEX' },
  { symbol: 'GOLD', name: 'Gold 1 kg', exchange: 'MCX' },
  { symbol: 'GOLDM', name: 'Gold Mini 100 g', exchange: 'MCX' },
  { symbol: 'SILVER', name: 'Silver 30 kg', exchange: 'MCX' },
  { symbol: 'SILVERM', name: 'Silver Mini 5 kg', exchange: 'MCX' },
  { symbol: 'CRUDEOIL', name: 'Crude Oil', exchange: 'MCX' },
  { symbol: 'NATURALGAS', name: 'Natural Gas', exchange: 'MCX' },
  { symbol: 'COPPER', name: 'Copper', exchange: 'MCX' },
  { symbol: 'ZINC', name: 'Zinc', exchange: 'MCX' },
  { symbol: 'ALUMINIUM', name: 'Aluminium', exchange: 'MCX' },
  { symbol: 'LEAD', name: 'Lead', exchange: 'MCX' },
  { symbol: 'COTTON', name: 'Cotton', exchange: 'MCX' },
  { symbol: 'MENTHAOIL', name: 'Mentha Oil', exchange: 'MCX' }
];

function hitToInstrument(hit: { symbol: string; name: string; exchange?: string }): Instrument {
  const symbol = String(hit.symbol || '').trim().toUpperCase();
  const exch = String(hit.exchange || '').toUpperCase();
  const isIndex =
    exch === 'INDEX' ||
    ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'SENSEX', 'BANKEX'].includes(symbol);
  const isMcx = exch === 'MCX';
  return {
    instrument_id: `local-${symbol}`,
    symbol,
    display_name: hit.name || symbol,
    exchange: isMcx ? 'MCX' : isIndex ? 'NSE' : hit.exchange || 'NSE',
    segment: isMcx ? 'MCX' : isIndex ? 'IDX' : 'EQ',
    asset_class: isMcx ? 'COMMODITY' : isIndex ? 'INDEX' : 'EQUITY',
    instrument_type: isMcx ? 'COMMODITY' : isIndex ? 'INDEX' : 'STOCK',
    tradable: !isIndex && !isMcx,
    direct_trading_allowed: !isIndex && !isMcx,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  };
}

function localSearch(query: string): Instrument[] {
  const q = (query || '').trim().toLowerCase();
  const rows = !q
    ? LOCAL_NAMES.slice(0, 12)
    : LOCAL_NAMES.filter(
        (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      ).slice(0, 16);
  return rows.map(hitToInstrument);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Instrument search timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function useInstrumentSearch(initial = '') {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<Instrument[]>(() => localSearch(initial));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqRef = useRef(0);

  const search = useCallback(async (q: string) => {
    const text = (q || '').trim();
    setQuery(q);
    const local = localSearch(text);
    setResults(local);
    setError(null);
    const reqId = ++reqRef.current;
    if (!text) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let rows: Instrument[] = [];
      try {
        rows = await withTimeout(tradingApi.searchInstruments(text), 2500);
      } catch {
        const market = await withTimeout(marketDataService.searchStocks(text), 2000).catch(() => []);
        rows = (market || []).map(hitToInstrument);
      }
      if (reqId !== reqRef.current) return;
      const seen = new Set<string>();
      const merged: Instrument[] = [];
      for (const row of [...local, ...(Array.isArray(rows) ? rows : [])]) {
        const key = (row.symbol || '').toUpperCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
      setResults(merged);
      if (merged.length === 0) {
        setError(`No instruments matched “${text || 'empty'}”. Try RELIANCE, NIFTY, GOLD, CRUDEOIL…`);
      }
    } catch (e) {
      if (reqId !== reqRef.current) return;
      if (local.length === 0) {
        const msg = e instanceof Error ? e.message : 'Instrument search failed';
        if (!/token/i.test(msg)) setError(msg);
      }
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }, []);

  const onQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      setResults(localSearch(value));
      setError(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void search(value);
      }, 180);
    },
    [search]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
    const { listPaperBaskets } = await import('@/modules/trading-terminal/paperBaskets');
    setBaskets(listPaperBaskets() as unknown as Record<string, unknown>[]);
    setError(null);
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
