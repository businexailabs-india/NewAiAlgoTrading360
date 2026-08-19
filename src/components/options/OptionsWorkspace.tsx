import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { RefreshCw, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';
import { useTradingMode } from '@/contexts/TradingModeContext';

type Underlying = {
  id: string;
  symbol: string;
  exchange: string;
  segment: string;
  instrumentKind: string;
  syncedAt?: string | null;
};

type ChainRow = {
  strike: number;
  ce?: ContractQ;
  pe?: ContractQ;
};

type ContractQ = {
  id: string;
  tradingSymbol: string;
  lotSize: number;
  ltp: number;
  oi: number;
  iv: number;
  oiSignal: string;
  optionType: 'CE' | 'PE';
  bid?: number;
  ask?: number;
  quoteSource?: 'broker' | 'model';
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function OptionsWorkspace({
  segment,
  scanner,
  analytics,
}: {
  segment?: 'FUT' | 'OPT';
  scanner?: boolean;
  analytics?: boolean;
}) {
  const { mode } = useTradingMode();
  const [underlyings, setUnderlyings] = useState<Underlying[]>([]);
  const [underlying, setUnderlying] = useState('NIFTY');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiryCalendar, setExpiryCalendar] = useState<
    Array<{ date: string; kind: 'WEEKLY' | 'MONTHLY'; label: string }>
  >([]);
  const [expiryKind, setExpiryKind] = useState<'ALL' | 'WEEKLY' | 'MONTHLY'>('ALL');
  const [monthlyOnly, setMonthlyOnly] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [chain, setChain] = useState<{
    spotPrice?: number;
    atm?: number;
    pcr?: number | null;
    maxPain?: number | null;
    rows?: ChainRow[];
    providerStatus?: string;
    quoteFreshness?: string;
    quoteSource?: string;
    brokerQuoteCount?: number;
    analyzedAt?: string;
    message?: string;
    empty?: boolean;
  } | null>(null);
  const [futures, setFutures] = useState<
    Array<{ id: string; tradingSymbol: string; expiry: string; lotSize: number }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadUnderlyings = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/options/underlyings`, { headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Failed to load underlyings');
    const list = (json.data?.underlyings || []) as Underlying[];
    setUnderlyings(list);
    if (list.length && !list.some((u) => u.symbol === underlying)) {
      setUnderlying(list[0].symbol);
    }
  }, [underlying]);

  const loadExpiries = useCallback(async (u: string) => {
    const res = await fetch(
      `${API_BASE_URL}/options/expiries?underlying=${encodeURIComponent(u)}`,
      { headers: authHeaders() }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Failed to load expiries');
    const calendar = (json.data?.calendar || []) as Array<{
      date: string;
      kind: 'WEEKLY' | 'MONTHLY';
      label: string;
    }>;
    const list = (json.data?.expiries || calendar.map((c) => c.date) || []) as string[];
    const onlyMonthly = Boolean(json.data?.monthly_only);
    setMonthlyOnly(onlyMonthly);
    if (onlyMonthly) setExpiryKind('MONTHLY');
    setExpiryCalendar(calendar);
    setExpiries(list);
    const monthlyDates = calendar.filter((c) => c.kind === 'MONTHLY').map((c) => c.date);
    const preferred = onlyMonthly ? monthlyDates[0] || list[0] : list[0];
    setExpiry((prev) => (list.includes(prev) ? prev : preferred || ''));
  }, []);

  const filteredExpiries = useMemo(() => {
    if (expiryKind === 'ALL') {
      return expiryCalendar.length
        ? expiryCalendar
        : expiries.map((d) => ({ date: d, kind: 'WEEKLY' as const, label: d }));
    }
    const fromCal = expiryCalendar.filter((e) => e.kind === expiryKind);
    return fromCal.length
      ? fromCal
      : expiries.map((d) => ({ date: d, kind: expiryKind, label: d }));
  }, [expiryCalendar, expiries, expiryKind]);

  useEffect(() => {
    if (!filteredExpiries.length) return;
    if (!filteredExpiries.some((e) => e.date === expiry)) {
      setExpiry(filteredExpiries[0].date);
    }
  }, [filteredExpiries, expiry]);

  const loadFutures = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/options/futures?underlying=${encodeURIComponent(underlying)}`,
        { headers: authHeaders() }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Failed to load futures');
      setFutures(json.data?.futures || []);
      setChain(null);
      if (json.data?.message && !(json.data?.futures || []).length) {
        toast.message(json.data.message);
      }
    } catch (e) {
      if (!opts?.silent) toast.error(e instanceof Error ? e.message : 'Futures load failed');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [underlying]);

  const loadChain = useCallback(async (opts?: { silent?: boolean }) => {
    if (segment === 'FUT') {
      await loadFutures(opts);
      return;
    }
    if (!opts?.silent) setLoading(true);
    try {
      const qs = new URLSearchParams({ underlying, greeks: analytics ? '1' : '0' });
      if (expiry) qs.set('expiry', expiry);
      if (expiryKind !== 'ALL') qs.set('kind', expiryKind);
      const res = await fetch(`${API_BASE_URL}/options/chain?${qs}`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Failed to load chain');
      setChain(json.data);
      setFutures([]);
    } catch (e) {
      if (!opts?.silent) toast.error(e instanceof Error ? e.message : 'Chain load failed');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [underlying, expiry, expiryKind, analytics, segment, loadFutures]);

  useEffect(() => {
    void loadUnderlyings().catch((e) => toast.error(e.message));
  }, [loadUnderlyings]);

  useEffect(() => {
    if (!underlying) return;
    void loadExpiries(underlying).catch((e) => toast.error(e.message));
  }, [underlying, loadExpiries]);

  useEffect(() => {
    if (!underlying) return;
    void loadChain();
    const id = window.setInterval(() => {
      void loadChain({ silent: true });
    }, 12_000);
    return () => window.clearInterval(id);
  }, [underlying, expiry, loadChain]);
  // reload when kind changes via expiry reset in filteredExpiries effect
  useEffect(() => {
    void loadChain();
  }, [expiryKind]); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncMaster() {
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/options/sync`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ brokerSource: 'dhan' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Sync failed');
      toast.success(
        `Synced ${json.data?.instrumentsUpserted ?? 0} instruments / ${json.data?.uniqueStrikes ?? 0} strikes`
      );
      await loadUnderlyings();
      await loadExpiries(underlying);
      await loadChain();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  const freshness = chain?.quoteFreshness === 'live' ? 'Live' : 'Delayed';
  const modeBadge = mode === 'live' ? 'LIVE MODE' : 'PAPER MODE';
  const sourceLabel = chain?.quoteSource || '—';

  const atmRows = useMemo(() => {
    const rows = chain?.rows || [];
    if (!scanner) return rows;
    return rows.filter((r) => Math.abs(r.strike - (chain?.atm || 0)) <= (chain?.atm || 0) * 0.02);
  }, [chain, scanner]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        minHeight: 420,
        background:
          'linear-gradient(180deg, rgba(8,47,73,0.35) 0%, rgba(15,23,42,0.92) 55%, rgba(2,6,23,0.98) 100%)',
        borderRadius: 12,
        border: '1px solid rgba(34,211,238,0.25)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <Layers className="h-4 w-4 text-cyan-300" />
        <span style={{ fontWeight: 650, color: '#ecfeff' }}>
          {scanner ? 'F&O Scanner' : analytics ? 'Option Analytics' : segment === 'FUT' ? 'Futures' : 'Options Chain'}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '4px 8px',
            borderRadius: 999,
            border: mode === 'live' ? '1px solid rgba(251,146,60,0.6)' : '1px solid rgba(56,189,248,0.5)',
            color: mode === 'live' ? '#fdba74' : '#7dd3fc',
          }}
        >
          {modeBadge}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 999,
            border: '1px solid rgba(148,163,184,0.35)',
            color: freshness === 'Live' ? '#6ee7b7' : '#fbbf24',
          }}
        >
          {freshness}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>
          src {sourceLabel}
          {chain?.brokerQuoteCount != null ? ` · ${chain.brokerQuoteCount} broker legs` : ''}
        </span>
        {chain?.analyzedAt ? (
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            as of {new Date(chain.analyzedAt).toLocaleTimeString()}
          </span>
        ) : null}
        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => void syncMaster()} disabled={syncing} style={btnSecondary}>
          {syncing ? 'Syncing…' : 'Sync Instrument Master'}
        </button>
        <button type="button" onClick={() => void loadChain()} disabled={loading} style={btnSecondary}>
          <RefreshCw className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 6 }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <label style={labelStyle}>
          Underlying
          <select
            value={underlying}
            onChange={(e) => setUnderlying(e.target.value)}
            style={selectStyle}
          >
            {(underlyings.length ? underlyings : [{ symbol: 'NIFTY' } as Underlying]).map((u) => (
              <option key={u.symbol} value={u.symbol}>
                {u.symbol}
              </option>
            ))}
          </select>
        </label>
        <label style={labelStyle}>
          Expiry type
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {(monthlyOnly
              ? (['MONTHLY'] as const)
              : (['ALL', 'WEEKLY', 'MONTHLY'] as const)
            ).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setExpiryKind(k)}
                style={{
                  ...btnSecondary,
                  padding: '6px 10px',
                  opacity: expiryKind === k ? 1 : 0.7,
                  borderColor: expiryKind === k ? '#22d3ee' : undefined,
                }}
              >
                {k === 'ALL' ? 'All' : k === 'WEEKLY' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </label>
        <label style={labelStyle}>
          Expiry
          <select value={expiry} onChange={(e) => setExpiry(e.target.value)} style={selectStyle}>
            {filteredExpiries.length === 0 ? <option value="">—</option> : null}
            {filteredExpiries.map((ex) => (
              <option key={ex.date} value={ex.date}>
                {ex.label || ex.date}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', paddingBottom: 4 }}>
          <Metric label="Spot" value={chain?.spotPrice != null ? chain.spotPrice.toFixed(2) : '—'} />
          <Metric label="ATM" value={chain?.atm != null ? String(chain.atm) : '—'} />
          <Metric label="PCR" value={chain?.pcr != null ? chain.pcr.toFixed(2) : '—'} />
          <Metric label="Max pain" value={chain?.maxPain != null ? String(chain.maxPain) : '—'} />
          <Metric label="Status" value={chain?.providerStatus || '—'} />
        </div>
      </div>

      {chain?.message ? (
        <div style={{ fontSize: 12, color: '#fbbf24', lineHeight: 1.4 }}>{chain.message}</div>
      ) : null}

      {!underlyings.length ? (
        <div style={{ fontSize: 13, color: '#94a3b8' }}>
          Instrument master is empty. Click <strong>Sync Instrument Master</strong> to pull F&amp;O contracts from
          the broker feed (no hard-coded strikes).
        </div>
      ) : null}

      {segment === 'FUT' ? (
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(51,65,85,0.8)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.95)', color: '#94a3b8' }}>
                <th style={th}>Symbol</th>
                <th style={th}>Expiry</th>
                <th style={th}>Lot</th>
                <th style={th}>Token</th>
              </tr>
            </thead>
            <tbody>
              {loading && !futures.length ? (
                <tr>
                  <td colSpan={4} style={{ padding: 16, color: '#94a3b8', textAlign: 'center' }}>
                    Loading futures…
                  </td>
                </tr>
              ) : null}
              {!loading && !futures.length ? (
                <tr>
                  <td colSpan={4} style={{ padding: 16, color: '#94a3b8', textAlign: 'center' }}>
                    No futures — sync Dhan instrument master for this underlying.
                  </td>
                </tr>
              ) : null}
              {futures.map((f) => (
                <tr
                  key={f.id}
                  style={{ borderTop: '1px solid rgba(51,65,85,0.5)', color: '#e2e8f0' }}
                >
                  <td style={td}>{f.tradingSymbol}</td>
                  <td style={td}>{f.expiry}</td>
                  <td style={td}>{f.lotSize}</td>
                  <td style={td}>{f.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(51,65,85,0.8)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(15,23,42,0.95)', color: '#94a3b8' }}>
              <th style={th}>CE Bid</th>
              <th style={th}>CE LTP</th>
              <th style={th}>CE Ask</th>
              <th style={th}>CE IV</th>
              <th style={th}>CE OI</th>
              <th style={th}>Strike</th>
              <th style={th}>PE OI</th>
              <th style={th}>PE IV</th>
              <th style={th}>PE Bid</th>
              <th style={th}>PE LTP</th>
              <th style={th}>PE Ask</th>
            </tr>
          </thead>
          <tbody>
            {loading && !atmRows.length ? (
              <tr>
                <td colSpan={11} style={{ padding: 16, color: '#94a3b8', textAlign: 'center' }}>
                  Loading chain…
                </td>
              </tr>
            ) : null}
            {atmRows.map((row) => {
              const isAtm = row.strike === chain?.atm;
              return (
                <tr
                  key={row.strike}
                  style={{
                    background: isAtm ? 'rgba(34,211,238,0.12)' : 'transparent',
                    borderTop: '1px solid rgba(51,65,85,0.5)',
                    color: '#e2e8f0',
                  }}
                >
                  <td style={td}>{fmtPx(row.ce?.bid)}</td>
                  <td style={{ ...td, color: row.ce?.quoteSource === 'broker' ? '#67e8f9' : undefined }}>
                    {fmtPx(row.ce?.ltp)}
                  </td>
                  <td style={td}>{fmtPx(row.ce?.ask)}</td>
                  <td style={td}>{row.ce?.iv != null ? row.ce.iv.toFixed(1) : '—'}</td>
                  <td style={td}>
                    {fmtOi(row.ce?.oi)}
                    {row.ce?.oiSignal && row.ce.oiSignal !== 'NEUTRAL' ? (
                      <span style={{ marginLeft: 6, color: '#7dd3fc', fontSize: 10 }}>{row.ce.oiSignal}</span>
                    ) : null}
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: isAtm ? '#67e8f9' : '#f8fafc' }}>{row.strike}</td>
                  <td style={td}>
                    {fmtOi(row.pe?.oi)}
                    {row.pe?.oiSignal && row.pe.oiSignal !== 'NEUTRAL' ? (
                      <span style={{ marginLeft: 6, color: '#fdba74', fontSize: 10 }}>{row.pe.oiSignal}</span>
                    ) : null}
                  </td>
                  <td style={td}>{row.pe?.iv != null ? row.pe.iv.toFixed(1) : '—'}</td>
                  <td style={td}>{fmtPx(row.pe?.bid)}</td>
                  <td style={{ ...td, color: row.pe?.quoteSource === 'broker' ? '#67e8f9' : undefined }}>
                    {fmtPx(row.pe?.ltp)}
                  </td>
                  <td style={td}>{fmtPx(row.pe?.ask)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 650, color: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }}>
        {value}
      </div>
    </div>
  );
}

function fmtPx(n?: number) {
  return n != null && n > 0 ? n.toFixed(2) : '—';
}

function fmtOi(n?: number) {
  if (n == null || n <= 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 11,
  color: '#94a3b8',
};

const selectStyle: CSSProperties = {
  height: 34,
  minWidth: 140,
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(2,6,23,0.75)',
  color: '#f8fafc',
  padding: '0 8px',
};

const btnSecondary: CSSProperties = {
  height: 32,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid rgba(34,211,238,0.4)',
  background: 'rgba(8,47,73,0.6)',
  color: '#a5f3fc',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};

const th: CSSProperties = { padding: '8px 10px', textAlign: 'right', fontWeight: 600 };
const td: CSSProperties = { padding: '7px 10px', textAlign: 'right', fontFamily: 'ui-monospace, monospace' };
