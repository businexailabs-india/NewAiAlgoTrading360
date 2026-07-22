import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';
import { useTradingMode } from '@/contexts/TradingModeContext';

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function OptionsAnalyticsPanel({ focus = 'analytics' }: { focus?: 'analytics' | 'greeks' }) {
  const { mode } = useTradingMode();
  const [underlying, setUnderlying] = useState('NIFTY');
  const [underlyings, setUnderlyings] = useState<string[]>(['NIFTY']);
  const [expiry, setExpiry] = useState('');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [greeksSample, setGreeksSample] = useState<Record<string, unknown> | null>(null);
  const [freshness, setFreshness] = useState<'Live' | 'Delayed'>('Delayed');
  const [asOf, setAsOf] = useState<string>('');

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ underlying });
    if (expiry) qs.set('expiry', expiry);
    const res = await fetch(`${API_BASE_URL}/options/analytics?${qs}`, { headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Analytics failed');
    setData(json.data);
    setFreshness(json.data?.quoteFreshness === 'live' ? 'Live' : 'Delayed');
    setAsOf(json.data?.analyzedAt || new Date().toISOString());

    if (focus === 'greeks' && json.data?.atm) {
      const gQs = new URLSearchParams({
        underlying,
        strike: String(json.data.atm),
        optionType: 'CE',
      });
      if (expiry) gQs.set('expiry', expiry);
      const gRes = await fetch(`${API_BASE_URL}/options/greeks?${gQs}`, { headers: authHeaders() });
      const gJson = await gRes.json().catch(() => ({}));
      if (gRes.ok) setGreeksSample(gJson.data);
    }
  }, [underlying, expiry, focus]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`${API_BASE_URL}/options/underlyings`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      const list = (json.data?.underlyings || []).map((u: { symbol: string }) => u.symbol);
      if (list.length) {
        setUnderlyings(list);
        setUnderlying(list[0]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        `${API_BASE_URL}/options/expiries?underlying=${encodeURIComponent(underlying)}`,
        { headers: authHeaders() }
      );
      const json = await res.json().catch(() => ({}));
      const list = json.data?.expiries || [];
      setExpiries(list);
      setExpiry(list[0] || '');
    })();
  }, [underlying]);

  useEffect(() => {
    void load().catch((e) => toast.error(e.message));
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div style={shell}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <BarChart3 className="h-4 w-4 text-cyan-300" />
        <span style={{ fontWeight: 650, color: '#ecfeff' }}>
          {focus === 'greeks' ? 'Greeks & IV' : 'Option Analytics'}
        </span>
        <span style={pill(mode === 'live' ? 'live' : 'paper')}>{mode === 'live' ? 'LIVE MODE' : 'PAPER MODE'}</span>
        <span style={pill(freshness === 'Live' ? 'ok' : 'warn')}>{freshness}</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {asOf ? `as of ${new Date(asOf).toLocaleTimeString()}` : ''} · polls 15s
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" style={btn} onClick={() => void load().catch((e) => toast.error(e.message))}>
          <RefreshCw className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 6 }} />
          Refresh
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select value={underlying} onChange={(e) => setUnderlying(e.target.value)} style={select}>
          {underlyings.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select value={expiry} onChange={(e) => setExpiry(e.target.value)} style={select}>
          {expiries.map((ex) => (
            <option key={ex} value={ex}>
              {ex}
            </option>
          ))}
        </select>
      </div>

      {data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <Metric label="Spot" value={num(data.spotPrice)} />
          <Metric label="ATM" value={String(data.atm ?? '—')} />
          <Metric label="PCR" value={data.pcr != null ? Number(data.pcr).toFixed(2) : '—'} />
          <Metric label="Max pain" value={String(data.maxPain ?? '—')} />
          <Metric label="Provider" value={String(data.providerStatus ?? '—')} />
        </div>
      ) : (
        <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading analytics…</div>
      )}

      {focus === 'greeks' && greeksSample ? (
        <pre style={pre}>{JSON.stringify(greeksSample, null, 2)}</pre>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 8, background: 'rgba(2,6,23,0.5)', border: '1px solid rgba(34,211,238,0.2)' }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 650, color: '#e2e8f0', fontFamily: 'ui-monospace, monospace' }}>{value}</div>
    </div>
  );
}

function num(v: unknown) {
  return typeof v === 'number' ? v.toFixed(2) : '—';
}

function pill(kind: string): CSSProperties {
  const map: Record<string, CSSProperties> = {
    paper: { border: '1px solid rgba(56,189,248,0.5)', color: '#7dd3fc' },
    live: { border: '1px solid rgba(251,146,60,0.6)', color: '#fdba74' },
    ok: { border: '1px solid rgba(52,211,153,0.5)', color: '#6ee7b7' },
    warn: { border: '1px solid rgba(251,191,36,0.5)', color: '#fbbf24' },
  };
  return {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    padding: '3px 8px',
    borderRadius: 999,
    ...(map[kind] || map.warn),
  };
}

const shell: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: '1px solid rgba(34,211,238,0.3)',
  background: 'rgba(8,47,73,0.25)',
};
const select: CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(2,6,23,0.7)',
  color: '#f8fafc',
  padding: '0 8px',
};
const btn: CSSProperties = {
  height: 32,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid rgba(34,211,238,0.4)',
  background: 'rgba(8,47,73,0.6)',
  color: '#a5f3fc',
  fontSize: 12,
  cursor: 'pointer',
};
const pre: CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 8,
  background: 'rgba(2,6,23,0.65)',
  border: '1px solid rgba(34,211,238,0.2)',
  color: '#a5f3fc',
  fontSize: 11,
  overflow: 'auto',
  maxHeight: 260,
};
