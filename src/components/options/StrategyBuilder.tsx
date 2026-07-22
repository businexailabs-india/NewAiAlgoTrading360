import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Layers, Plus, Trash2, Send, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';

type Leg = {
  side: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE' | 'FUT';
  strike: number;
  premium: number;
  lots: number;
  lotSize: number;
  instrumentId?: string;
  tradingSymbol?: string;
  instrumentToken?: string;
  bound?: boolean;
  bindNote?: string;
  freezeQty?: number | null;
};

type Analytics = {
  netPremium: number;
  maxProfit: number | null;
  maxLoss: number | null;
  breakEvens: number[];
  marginEstimate: number;
  liquidityScore: number;
  payoff: Array<{ spot: number; pnl: number }>;
};

type Template = { id: string; name: string; description: string };

type MarginInfo = {
  estimate: number;
  method: string;
  availableFunds: number | null;
  fundsSource: string | null;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function StrategyBuilder() {
  const [name, setName] = useState('Long straddle');
  const [underlying, setUnderlying] = useState('NIFTY');
  const [underlyings, setUnderlyings] = useState<string[]>(['NIFTY']);
  const [expiry, setExpiry] = useState('');
  const [expiries, setExpiries] = useState<string[]>([]);
  const [atm, setAtm] = useState(24000);
  const [step, setStep] = useState(50);
  const [lotSize, setLotSize] = useState(25);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [margin, setMargin] = useState<MarginInfo | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Array<{ id: string; name: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [livePreview, setLivePreview] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void (async () => {
      const [tRes, sRes, uRes] = await Promise.all([
        fetch(`${API_BASE_URL}/live/strategies/templates`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/paper/strategies`, { headers: authHeaders() }),
        fetch(`${API_BASE_URL}/options/underlyings`, { headers: authHeaders() }),
      ]);
      const tJson = await tRes.json().catch(() => ({}));
      const sJson = await sRes.json().catch(() => ({}));
      const uJson = await uRes.json().catch(() => ({}));
      if (tRes.ok) setTemplates(tJson.data || []);
      if (sRes.ok) setSaved((sJson.data || []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      const list = (uJson.data?.underlyings || []).map((u: { symbol: string }) => u.symbol);
      if (list.length) {
        setUnderlyings(list);
        setUnderlying(list[0]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!underlying) return;
    void (async () => {
      const res = await fetch(
        `${API_BASE_URL}/options/expiries?underlying=${encodeURIComponent(underlying)}`,
        { headers: authHeaders() }
      );
      const json = await res.json().catch(() => ({}));
      const list = json.data?.expiries || [];
      setExpiries(list);
      setExpiry(list[0] || '');
      // Spot/ATM hint from chain
      if (list[0]) {
        const cRes = await fetch(
          `${API_BASE_URL}/options/chain?underlying=${encodeURIComponent(underlying)}&expiry=${encodeURIComponent(list[0])}`,
          { headers: authHeaders() }
        );
        const cJson = await cRes.json().catch(() => ({}));
        if (cRes.ok && cJson.data?.atm) setAtm(Number(cJson.data.atm));
        if (cRes.ok && cJson.data?.spotPrice) {
          /* keep atm from chain */
        }
        const sampleLot = cJson.data?.rows?.[0]?.ce?.lotSize || cJson.data?.rows?.[0]?.pe?.lotSize;
        if (sampleLot) setLotSize(sampleLot);
      }
    })();
  }, [underlying]);

  const analyze = useCallback(
    async (nextLegs: Leg[]) => {
      if (!nextLegs.length) {
        setAnalytics(null);
        return;
      }
      const res = await fetch(`${API_BASE_URL}/paper/strategies/analyze`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ legs: nextLegs, spot: atm }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Analyze failed');
      setAnalytics(json.data);
    },
    [atm]
  );

  useEffect(() => {
    void analyze(legs).catch(() => undefined);
  }, [legs, analyze]);

  async function applyTemplate(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/live/strategies/template/${id}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ atm, step, premium: Math.max(20, atm * 0.004), lotSize }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Template failed');
      setLegs(json.data.legs);
      setAnalytics(json.data.analytics);
      setMargin(null);
      setSavedId(null);
      setName(templates.find((t) => t.id === id)?.name || name);
      toast.success('Template applied — bind to master next');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Template failed');
    } finally {
      setBusy(false);
    }
  }

  async function bindToMaster() {
    if (!legs.length) {
      toast.error('Add legs first');
      return;
    }
    if (!expiry) {
      toast.error('Select expiry (sync instrument master if empty)');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/live/strategies/bind`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ underlying, expiry, legs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Bind failed');
      setLegs(json.data.legs);
      setAnalytics(json.data.analytics);
      setMargin(json.data.margin);
      if (json.data.spot > 0) setAtm(Math.round(json.data.spot / step) * step || json.data.spot);
      const unbound = json.data.unboundCount || 0;
      toast.success(
        unbound
          ? `Bound with ${unbound} unbound leg(s)`
          : `Bound ${json.data.legs.length} legs to instrument master`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bind failed');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!legs.length) {
      toast.error('Add legs first');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/paper/strategies`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name,
          legs,
          meta: { builder: 'phase2.5', analytics, margin, underlying, expiry },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Save failed');
      setSavedId(json.data.id);
      setSaved((prev) => [{ id: json.data.id, name: json.data.name }, ...prev]);
      toast.success('Strategy saved');
      return json.data.id as string;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function sendToPaper() {
    const unbound = legs.filter((l) => !l.instrumentId);
    if (unbound.length) {
      toast.error('Bind legs to instrument master before sending to paper');
      return;
    }
    setBusy(true);
    try {
      const strategyId = savedId || (await save()) || undefined;
      const strategyTag = name.trim() || 'untitled';
      const paperLegs = legs.map((l) => ({
        instrumentId: l.instrumentId!,
        tradingSymbol: l.tradingSymbol!,
        side: l.side,
        lots: l.lots,
        optionType: l.optionType,
        premium: l.premium,
        strategyId,
        strategyTag,
      }));
      const prev = await fetch(`${API_BASE_URL}/paper/orders/preview`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ legs: paperLegs }),
      });
      const prevJson = await prev.json().catch(() => ({}));
      if (!prev.ok) throw new Error(prevJson.message || prevJson.correctiveAction || 'Paper preview failed');

      const place = await fetch(`${API_BASE_URL}/paper/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ legs: paperLegs, strategyId, strategyTag }),
      });
      const placeJson = await place.json().catch(() => ({}));
      if (!place.ok) throw new Error(placeJson.message || placeJson.correctiveAction || 'Paper place failed');
      if (placeJson.data?.liveBrokerSubmit) throw new Error('Safety: live submit flag on paper path');

      toast.success(`Sent to Paper — tagged “${strategyTag}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send to Paper failed');
    } finally {
      setBusy(false);
    }
  }

  async function cloneToLivePreview() {
    setBusy(true);
    try {
      let id = savedId;
      if (!id) id = (await save()) || null;
      if (!id) throw new Error('Save strategy before live clone');

      const res = await fetch(`${API_BASE_URL}/live/orders/clone-from-paper`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ strategyId: id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.correctiveAction || 'Live clone failed');
      setLivePreview(json.data?.preview || json.data);
      toast.success('Cloned to Live Preview (no broker submit)');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Clone failed');
    } finally {
      setBusy(false);
    }
  }

  const payoffPath = useMemo(() => {
    if (!analytics?.payoff?.length) return '';
    const w = 320;
    const h = 120;
    const xs = analytics.payoff.map((p) => p.spot);
    const ys = analytics.payoff.map((p) => p.pnl);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, 0);
    const sx = (x: number) => ((x - minX) / Math.max(maxX - minX, 1)) * (w - 8) + 4;
    const sy = (y: number) => h - (((y - minY) / Math.max(maxY - minY, 1)) * (h - 8) + 4);
    return analytics.payoff.map((p, i) => `${i ? 'L' : 'M'}${sx(p.spot)},${sy(p.pnl)}`).join(' ');
  }, [analytics]);

  const allBound = legs.length > 0 && legs.every((l) => !!l.instrumentId);

  return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Layers className="h-4 w-4 text-emerald-300" />
        <span style={{ fontWeight: 650, color: '#ecfdf5' }}>Strategy Builder</span>
        {allBound ? <span style={boundBadge}>MASTER-BOUND</span> : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {templates.map((t) => (
          <button key={t.id} type="button" disabled={busy} style={chip} onClick={() => void applyTemplate(t.id)} title={t.description}>
            {t.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <label style={label}>
          Underlying
          <select value={underlying} onChange={(e) => setUnderlying(e.target.value)} style={input}>
            {underlyings.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          Expiry
          <select value={expiry} onChange={(e) => setExpiry(e.target.value)} style={input}>
            {!expiries.length ? <option value="">— sync master —</option> : null}
            {expiries.map((ex) => (
              <option key={ex} value={ex}>
                {ex}
              </option>
            ))}
          </select>
        </label>
        <label style={label}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} />
        </label>
        <label style={label}>
          ATM
          <input type="number" value={atm} onChange={(e) => setAtm(Number(e.target.value) || 0)} style={inputSm} />
        </label>
        <label style={label}>
          Step
          <input type="number" value={step} onChange={(e) => setStep(Number(e.target.value) || 50)} style={inputSm} />
        </label>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {legs.map((leg, i) => (
          <div key={i} style={legRow}>
            <select
              value={leg.side}
              onChange={(e) =>
                setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, side: e.target.value as 'BUY' | 'SELL' } : l)))
              }
              style={select}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <select
              value={leg.optionType}
              onChange={(e) =>
                setLegs((prev) =>
                  prev.map((l, idx) => (idx === i ? { ...l, optionType: e.target.value as Leg['optionType'] } : l))
                )
              }
              style={select}
            >
              <option value="CE">CE</option>
              <option value="PE">PE</option>
              <option value="FUT">FUT</option>
            </select>
            <input
              type="number"
              value={leg.strike}
              onChange={(e) =>
                setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, strike: Number(e.target.value) || 0, instrumentId: undefined } : l)))
              }
              style={inputSm}
              title="Strike"
            />
            <input
              type="number"
              value={leg.premium}
              step="0.05"
              onChange={(e) =>
                setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, premium: Number(e.target.value) || 0 } : l)))
              }
              style={inputSm}
              title="Premium"
            />
            <input
              type="number"
              value={leg.lots}
              min={1}
              onChange={(e) =>
                setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, lots: Math.max(1, Number(e.target.value) || 1) } : l)))
              }
              style={inputSm}
              title="Lots"
            />
            <span style={{ fontSize: 10, color: leg.instrumentId ? '#6ee7b7' : '#fbbf24', maxWidth: 160 }} title={leg.tradingSymbol}>
              {leg.instrumentId ? leg.tradingSymbol || 'bound' : 'unbound'}
              {leg.bindNote ? ` · ${leg.bindNote}` : ''}
            </span>
            <button type="button" style={ghost} onClick={() => setLegs((prev) => prev.filter((_, idx) => idx !== i))}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          style={btn}
          onClick={() =>
            setLegs((prev) => [
              ...prev,
              { side: 'BUY', optionType: 'CE', strike: atm, premium: Math.max(20, atm * 0.004), lots: 1, lotSize },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5" style={{ display: 'inline' }} /> Add leg
        </button>
        <button type="button" disabled={busy || !legs.length} style={btnPrimary} onClick={() => void bindToMaster()}>
          Bind to Master
        </button>
        <button type="button" disabled={busy || !legs.length} style={btn} onClick={() => void save()}>
          Save Strategy
        </button>
        <button type="button" disabled={busy || !allBound} style={btnPrimary} onClick={() => void sendToPaper()}>
          <Send className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 4 }} />
          Send to Paper
        </button>
        <button type="button" disabled={busy || !legs.length} style={btnLive} onClick={() => void cloneToLivePreview()}>
          <Copy className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 4 }} />
          Clone to Live Preview
        </button>
      </div>

      {analytics ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
          <Metric label="Net premium" value={fmt(analytics.netPremium)} />
          <Metric label="Max profit" value={analytics.maxProfit == null ? 'Unlimited' : fmt(analytics.maxProfit)} />
          <Metric label="Max loss" value={analytics.maxLoss == null ? 'Unlimited' : fmt(analytics.maxLoss)} />
          <Metric label="Break-evens" value={analytics.breakEvens.map((b) => b.toFixed(0)).join(', ') || '—'} />
          <Metric label="Margin est." value={fmt(margin?.estimate ?? analytics.marginEstimate)} />
          <Metric label="Liquidity" value={`${analytics.liquidityScore}/100`} />
          {margin?.availableFunds != null ? (
            <Metric label="Avail funds" value={fmt(margin.availableFunds)} />
          ) : null}
        </div>
      ) : null}

      {margin ? (
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10 }}>
          Margin method: {margin.method}
          {margin.fundsSource ? ` · funds via ${margin.fundsSource}` : ' · funds probe unavailable'}
        </div>
      ) : null}

      {payoffPath ? (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>Expiry payoff (model)</div>
          <svg width="100%" height="120" viewBox="0 0 320 120" style={{ background: 'rgba(2,6,23,0.55)', borderRadius: 8 }}>
            <path d={payoffPath} fill="none" stroke="#34d399" strokeWidth="2" />
            <line x1="4" y1="60" x2="316" y2="60" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
          </svg>
        </div>
      ) : null}

      {livePreview ? (
        <pre style={pre}>{JSON.stringify(livePreview, null, 2)}</pre>
      ) : null}

      {saved.length ? (
        <div style={{ fontSize: 12, color: '#94a3b8' }}>
          Saved: {saved.slice(0, 8).map((s) => s.name).join(' · ')}
          {saved.length > 8 ? '…' : ''}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 8, borderRadius: 8, background: 'rgba(2,6,23,0.45)', border: '1px solid rgba(52,211,153,0.2)' }}>
      <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 650, color: '#ecfdf5', fontFamily: 'ui-monospace, monospace' }}>{value}</div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

const shell: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: '1px solid rgba(52,211,153,0.35)',
  background: 'rgba(6,78,59,0.2)',
};
const boundBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.06em',
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid rgba(52,211,153,0.45)',
  color: '#6ee7b7',
};
const label: CSSProperties = { display: 'grid', gap: 4, fontSize: 11, color: '#94a3b8' };
const input: CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(2,6,23,0.7)',
  color: '#f8fafc',
  padding: '0 8px',
  minWidth: 140,
};
const inputSm: CSSProperties = { ...input, minWidth: 88, width: 88 };
const select: CSSProperties = { ...inputSm, width: 78, minWidth: 78 };
const chip: CSSProperties = {
  height: 30,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(52,211,153,0.35)',
  background: 'rgba(6,95,70,0.35)',
  color: '#a7f3d0',
  fontSize: 11,
  cursor: 'pointer',
};
const btn: CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid rgba(52,211,153,0.4)',
  background: 'rgba(6,78,59,0.45)',
  color: '#ecfdf5',
  fontSize: 12,
  cursor: 'pointer',
};
const btnPrimary: CSSProperties = { ...btn, background: '#059669', border: 'none', fontWeight: 650 };
const btnLive: CSSProperties = {
  ...btn,
  background: 'rgba(194,65,12,0.85)',
  border: '1px solid rgba(251,146,60,0.5)',
  fontWeight: 650,
};
const ghost: CSSProperties = { ...btn, background: 'transparent', color: '#94a3b8', padding: '0 8px' };
const legRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
  padding: 8,
  borderRadius: 8,
  background: 'rgba(2,6,23,0.4)',
};
const pre: CSSProperties = {
  margin: '0 0 12px',
  padding: 12,
  borderRadius: 8,
  background: 'rgba(2,6,23,0.65)',
  border: '1px solid rgba(251,146,60,0.35)',
  color: '#fdba74',
  fontSize: 11,
  overflow: 'auto',
  maxHeight: 220,
};
