import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Plus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';

type Leg = {
  instrumentId: string;
  tradingSymbol: string;
  side: 'BUY' | 'SELL';
  lots: number;
  optionType: 'CE' | 'PE' | 'FUT';
  premium: number;
  lotSize?: number;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function PaperOptionsTerminal() {
  const [account, setAccount] = useState<{ cashBalance: number; realizedPnl: number } | null>(null);
  const [underlying, setUnderlying] = useState('NIFTY');
  const [underlyings, setUnderlyings] = useState<string[]>(['NIFTY']);
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiry, setExpiry] = useState('');
  const [chainRows, setChainRows] = useState<
    Array<{ strike: number; ce?: { id: string; tradingSymbol: string; ltp: number; lotSize: number }; pe?: { id: string; tradingSymbol: string; ltp: number; lotSize: number } }>
  >([]);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [strategyName, setStrategyName] = useState('Paper multi-leg');

  const refreshAccount = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/paper/account`, { headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setAccount(json.data);
  }, []);

  useEffect(() => {
    void refreshAccount();
    void (async () => {
      const res = await fetch(`${API_BASE_URL}/options/underlyings`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      const list = (json.data?.underlyings || []).map((u: { symbol: string }) => u.symbol);
      if (list.length) {
        setUnderlyings(list);
        setUnderlying(list[0]);
      }
    })();
  }, [refreshAccount]);

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
    if (!expiry) return;
    void (async () => {
      const qs = new URLSearchParams({ underlying, expiry });
      const res = await fetch(`${API_BASE_URL}/options/chain?${qs}`, { headers: authHeaders() });
      const json = await res.json().catch(() => ({}));
      setChainRows(json.data?.rows || []);
    })();
  }, [underlying, expiry]);

  function addLeg(side: 'BUY' | 'SELL', optionType: 'CE' | 'PE', strikeRow: (typeof chainRows)[0]) {
    const c = optionType === 'CE' ? strikeRow.ce : strikeRow.pe;
    if (!c) {
      toast.error('Contract missing on master chain');
      return;
    }
    setLegs((prev) => [
      ...prev,
      {
        instrumentId: c.id,
        tradingSymbol: c.tradingSymbol,
        side,
        lots: 1,
        optionType,
        premium: c.ltp,
        lotSize: c.lotSize,
      },
    ]);
  }

  async function runPreview() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/paper/orders/preview`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ legs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.correctiveAction || 'Preview failed');
      setPreview(json.data);
      toast.success('Paper preview ready');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function placePaper() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/paper/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ legs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.correctiveAction || 'Place failed');
      if (json.data?.liveBrokerSubmit) {
        toast.error('Safety violation: live broker submit flag set on paper path');
        return;
      }
      toast.success('Paper order placed (simulation only)');
      setPreview(json.data?.preview || null);
      await refreshAccount();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Place failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveStrategy() {
    const res = await fetch(`${API_BASE_URL}/paper/strategies`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: strategyName, legs }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.message || 'Save failed');
      return;
    }
    toast.success('Strategy saved');
  }

  async function topUp() {
    const res = await fetch(`${API_BASE_URL}/paper/account/topup`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ amount: 100000 }),
    });
    if (res.ok) {
      toast.success('Topped up ₹1,00,000');
      await refreshAccount();
    }
  }

  const atm = chainRows.find((r) => Math.abs(r.strike - (chainRows[Math.floor(chainRows.length / 2)]?.strike || 0)) < 1) || chainRows[Math.floor(chainRows.length / 2)];

  return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <Shield className="h-4 w-4 text-sky-300" />
        <span style={{ fontWeight: 700, color: '#e0f2fe' }}>Paper Options Terminal</span>
        <span style={simBadge}>SIMULATION</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#7dd3fc' }}>
          Virtual cash ₹{account ? account.cashBalance.toLocaleString('en-IN') : '—'}
        </span>
        <button type="button" onClick={() => void topUp()} style={btn}>
          Top-up ₹1L
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
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
        {atm ? (
          <>
            <button type="button" style={btn} onClick={() => addLeg('BUY', 'CE', atm)}>
              <Plus className="h-3 w-3" style={{ display: 'inline' }} /> Buy CE
            </button>
            <button type="button" style={btn} onClick={() => addLeg('BUY', 'PE', atm)}>
              Buy PE
            </button>
            <button type="button" style={btn} onClick={() => addLeg('SELL', 'CE', atm)}>
              Sell CE
            </button>
            <button type="button" style={btn} onClick={() => addLeg('SELL', 'PE', atm)}>
              Sell PE
            </button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>Sync instrument master to add legs</span>
        )}
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {legs.map((leg, i) => (
          <div key={`${leg.instrumentId}-${i}`} style={legRow}>
            <span>
              {leg.side} {leg.optionType} · {leg.tradingSymbol}
            </span>
            <label>
              Lots
              <input
                type="number"
                min={1}
                value={leg.lots}
                onChange={(e) => {
                  const lots = Math.max(1, Number(e.target.value) || 1);
                  setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, lots } : l)));
                }}
                style={input}
              />
            </label>
            <label>
              Premium
              <input
                type="number"
                step="0.05"
                value={leg.premium}
                onChange={(e) => {
                  const premium = Number(e.target.value) || 0;
                  setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, premium } : l)));
                }}
                style={input}
              />
            </label>
            <button type="button" style={ghost} onClick={() => setLegs((prev) => prev.filter((_, idx) => idx !== i))}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button type="button" disabled={!legs.length || busy} onClick={() => void runPreview()} style={btnPrimary}>
          Preview
        </button>
        <button type="button" disabled={!legs.length || busy} onClick={() => void placePaper()} style={btnPrimary}>
          Place Paper Order
        </button>
        <input
          value={strategyName}
          onChange={(e) => setStrategyName(e.target.value)}
          style={{ ...input, width: 160 }}
          placeholder="Strategy name"
        />
        <button type="button" disabled={!legs.length} onClick={() => void saveStrategy()} style={btn}>
          Save Strategy
        </button>
        <button
          type="button"
          style={btn}
          onClick={() => toast.message('Paper algo start hooks into existing agents (stub)')}
        >
          Start Paper Algo
        </button>
      </div>

      {preview ? (
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(2,6,23,0.7)',
            border: '1px solid rgba(56,189,248,0.25)',
            color: '#bae6fd',
            fontSize: 11,
            overflow: 'auto',
            maxHeight: 240,
          }}
        >
          {JSON.stringify(preview, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

const shell: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: '1px solid rgba(56,189,248,0.45)',
  background:
    'linear-gradient(180deg, rgba(7,89,133,0.35) 0%, rgba(15,23,42,0.95) 45%, rgba(2,6,23,0.98) 100%)',
};

const simBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(14,165,233,0.2)',
  border: '1px solid rgba(56,189,248,0.5)',
  color: '#7dd3fc',
};

const select: CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: '1px solid rgba(125,211,252,0.35)',
  background: 'rgba(2,6,23,0.7)',
  color: '#e0f2fe',
  padding: '0 8px',
};

const btn: CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid rgba(56,189,248,0.4)',
  background: 'rgba(8,47,73,0.7)',
  color: '#e0f2fe',
  fontSize: 12,
  cursor: 'pointer',
};

const btnPrimary: CSSProperties = {
  ...btn,
  background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
  border: 'none',
  fontWeight: 650,
};

const ghost: CSSProperties = {
  ...btn,
  background: 'transparent',
  color: '#94a3b8',
};

const input: CSSProperties = {
  height: 30,
  width: 80,
  marginLeft: 6,
  borderRadius: 6,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(2,6,23,0.65)',
  color: '#f8fafc',
  padding: '0 6px',
};

const legRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
  padding: '8px 10px',
  borderRadius: 8,
  background: 'rgba(14,165,233,0.08)',
  border: '1px solid rgba(56,189,248,0.2)',
  color: '#e0f2fe',
  fontSize: 12,
};
