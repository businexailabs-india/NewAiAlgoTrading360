import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Plus, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';
import { tradingService } from '@/services/tradingService';

type ChainCell = {
  id: string;
  tradingSymbol: string;
  ltp: number;
  lotSize: number;
};

type ChainRow = {
  strike: number;
  ce?: ChainCell;
  pe?: ChainCell;
};

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
  const [expiryLabels, setExpiryLabels] = useState<Record<string, string>>({});
  const [expiryKind, setExpiryKind] = useState<'ALL' | 'WEEKLY' | 'MONTHLY'>('ALL');
  const [expiry, setExpiry] = useState('');
  const [chainRows, setChainRows] = useState<ChainRow[]>([]);
  const [spotPrice, setSpotPrice] = useState<number | null>(null);
  const [chainMsg, setChainMsg] = useState<string | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
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
      const calendar = (json.data?.calendar || []) as Array<{
        date: string;
        kind: 'WEEKLY' | 'MONTHLY';
        label: string;
      }>;
      const filtered =
        expiryKind === 'ALL' ? calendar : calendar.filter((c) => c.kind === expiryKind);
      const list = (filtered.length ? filtered : calendar).map((c) => c.date);
      const labels: Record<string, string> = {};
      for (const c of calendar) labels[c.date] = c.label;
      const fallback = (json.data?.expiries || []) as string[];
      const finalList = list.length ? list : fallback;
      setExpiries(finalList);
      setExpiryLabels(labels);
      setExpiry(finalList[0] || '');
      if (!finalList.length) {
        setChainRows([]);
        setChainMsg('No expiries — sync instrument master from Options workspace.');
      }
    })();
  }, [underlying, expiryKind]);

  useEffect(() => {
    if (!expiry) return;
    void (async () => {
      setChainLoading(true);
      try {
        const qs = new URLSearchParams({ underlying, expiry });
        const res = await fetch(`${API_BASE_URL}/options/chain?${qs}`, { headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        const rows = (json.data?.rows || []) as ChainRow[];
        setChainRows(rows);
        setSpotPrice(typeof json.data?.spotPrice === 'number' ? json.data.spotPrice : null);
        setChainMsg(json.data?.message || (rows.length ? null : 'Chain empty for this expiry'));
      } finally {
        setChainLoading(false);
      }
    })();
  }, [underlying, expiry]);

  const atm = useMemo(() => {
    if (!chainRows.length) return undefined;
    if (spotPrice != null) {
      return chainRows.reduce((best, row) =>
        Math.abs(row.strike - spotPrice!) < Math.abs(best.strike - spotPrice!) ? row : best
      );
    }
    return chainRows[Math.floor(chainRows.length / 2)];
  }, [chainRows, spotPrice]);

  function addLeg(side: 'BUY' | 'SELL', optionType: 'CE' | 'PE', strikeRow: ChainRow) {
    const c = optionType === 'CE' ? strikeRow.ce : strikeRow.pe;
    if (!c) {
      toast.error('Contract missing on this strike');
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
    toast.success(`Added ${side} ${optionType} @ ${strikeRow.strike}`);
  }

  function seedAtmStraddle() {
    if (!atm) {
      toast.error('No ATM row — wait for chain or sync instruments');
      return;
    }
    const next: Leg[] = [];
    if (atm.ce) {
      next.push({
        instrumentId: atm.ce.id,
        tradingSymbol: atm.ce.tradingSymbol,
        side: 'BUY',
        lots: 1,
        optionType: 'CE',
        premium: atm.ce.ltp,
        lotSize: atm.ce.lotSize,
      });
    }
    if (atm.pe) {
      next.push({
        instrumentId: atm.pe.id,
        tradingSymbol: atm.pe.tradingSymbol,
        side: 'BUY',
        lots: 1,
        optionType: 'PE',
        premium: atm.pe.ltp,
        lotSize: atm.pe.lotSize,
      });
    }
    if (!next.length) {
      toast.error('ATM CE/PE contracts missing');
      return;
    }
    setLegs(next);
    setStrategyName(`ATM straddle ${underlying} ${expiry}`);
    toast.success(`Seeded ATM long straddle (${next.length} legs)`);
  }

  async function runPreview(legsOverride?: Leg[]) {
    const useLegs = legsOverride || legs;
    if (!useLegs.length) {
      toast.error('Add at least one leg from the chain');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/paper/orders/preview`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ legs: useLegs }),
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

  async function placePaper(legsOverride?: Leg[]) {
    const useLegs = legsOverride || legs;
    if (!useLegs.length) {
      toast.error('Add at least one leg from the chain');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/paper/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ legs: useLegs, strategyTag: strategyName }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.correctiveAction || 'Place failed');
      if (json.data?.liveBrokerSubmit) {
        toast.error('Safety violation: live broker submit flag set on paper path');
        return;
      }
      toast.success('Paper order placed (simulation only)');
      setPreview(json.data?.preview || json.data || null);
      await refreshAccount();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Place failed');
    } finally {
      setBusy(false);
    }
  }

  async function saveStrategy(legsOverride?: Leg[]) {
    const useLegs = legsOverride || legs;
    if (!useLegs.length) {
      toast.error('Add legs before saving');
      return;
    }
    const res = await fetch(`${API_BASE_URL}/paper/strategies`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: strategyName, legs: useLegs }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.message || 'Save failed');
      return null;
    }
    toast.success('Strategy saved');
    return json.data;
  }

  async function startPaperAlgo() {
    setBusy(true);
    try {
      let working = legs;
      if (!working.length) {
        if (!atm?.ce || !atm?.pe) {
          toast.error('Chain not ready — sync instrument master, then retry');
          return;
        }
        working = [
          {
            instrumentId: atm.ce.id,
            tradingSymbol: atm.ce.tradingSymbol,
            side: 'BUY',
            lots: 1,
            optionType: 'CE',
            premium: atm.ce.ltp,
            lotSize: atm.ce.lotSize,
          },
          {
            instrumentId: atm.pe.id,
            tradingSymbol: atm.pe.tradingSymbol,
            side: 'BUY',
            lots: 1,
            optionType: 'PE',
            premium: atm.pe.ltp,
            lotSize: atm.pe.lotSize,
          },
        ];
        setLegs(working);
        setStrategyName(`Paper algo ATM straddle ${underlying}`);
      }

      await saveStrategy(working);
      await runPreview(working);
      await placePaper(working);

      // Also kick equity paper agent if present (optional companion run)
      try {
        const agents = await tradingService.listAgents();
        const paperAgent = (Array.isArray(agents) ? agents : []).find(
          (a: { mode?: string; name?: string; isActive?: boolean }) =>
            a.mode === 'paper' && (a.isActive || String(a.name || '').includes('Paper Momentum'))
        ) as { id?: string } | undefined;
        if (paperAgent?.id) {
          const result = (await tradingService.runAgent(paperAgent.id)) as {
            ordersPlaced?: unknown[];
          };
          const n = Array.isArray(result?.ordersPlaced) ? result.ordersPlaced.length : 0;
          toast.message(`Companion paper agent also ran (${n} equity order(s))`);
        }
      } catch {
        /* optional */
      }

      toast.success('Paper algo started — strategy saved + paper F&O order filled');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Paper algo start failed');
    } finally {
      setBusy(false);
    }
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
        <select value={expiryKind} onChange={(e) => setExpiryKind(e.target.value as typeof expiryKind)} style={select}>
          <option value="ALL">All expiries</option>
          <option value="WEEKLY">Weekly</option>
          <option value="MONTHLY">Monthly</option>
        </select>
        <select value={expiry} onChange={(e) => setExpiry(e.target.value)} style={select}>
          {expiries.map((ex) => (
            <option key={ex} value={ex}>
              {expiryLabels[ex] || ex}
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
            <button type="button" style={btn} onClick={seedAtmStraddle}>
              Seed ATM straddle
            </button>
          </>
        ) : (
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {chainLoading ? 'Loading chain…' : 'Sync instrument master to add legs'}
          </span>
        )}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 650, color: '#e0f2fe' }}>
            Option chain {spotPrice != null ? `· spot ₹${spotPrice.toLocaleString('en-IN')}` : ''}
            {atm ? ` · ATM ${atm.strike}` : ''}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {chainLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Loader2 className="h-3 w-3 animate-spin" /> Loading
              </span>
            ) : (
              `${chainRows.length} strikes · click CE/PE to add legs`
            )}
          </div>
        </div>

        {chainMsg ? (
          <div
            style={{
              fontSize: 11,
              color: '#fbbf24',
              marginBottom: 8,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid rgba(251,191,36,0.35)',
              background: 'rgba(120,53,15,0.25)',
            }}
          >
            {chainMsg} (model premiums — paper still works)
          </div>
        ) : null}

        <div
          style={{
            maxHeight: 280,
            overflow: 'auto',
            borderRadius: 8,
            border: '1px solid rgba(56,189,248,0.25)',
            background: 'rgba(2,6,23,0.85)',
          }}
        >
          {!chainRows.length && !chainLoading ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
              No chain rows. Open Options workspace → Sync Instrument Master, then return here.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                  <th style={th}>CE LTP</th>
                  <th style={th}>Strike</th>
                  <th style={th}>PE LTP</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {chainRows.map((row) => {
                  const isAtm = atm?.strike === row.strike;
                  return (
                    <tr
                      key={row.strike}
                      style={{
                        borderTop: '1px solid rgba(148,163,184,0.12)',
                        background: isAtm ? 'rgba(14,165,233,0.12)' : 'transparent',
                        color: '#e2e8f0',
                      }}
                    >
                      <td style={td}>{row.ce ? row.ce.ltp.toFixed(2) : '—'}</td>
                      <td style={{ ...td, fontWeight: 700, color: isAtm ? '#7dd3fc' : '#f8fafc' }}>
                        {row.strike}
                      </td>
                      <td style={td}>{row.pe ? row.pe.ltp.toFixed(2) : '—'}</td>
                      <td style={td}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {row.ce ? (
                            <>
                              <button type="button" style={miniBtn} onClick={() => addLeg('BUY', 'CE', row)}>
                                +CE
                              </button>
                              <button type="button" style={miniBtn} onClick={() => addLeg('SELL', 'CE', row)}>
                                −CE
                              </button>
                            </>
                          ) : null}
                          {row.pe ? (
                            <>
                              <button type="button" style={miniBtn} onClick={() => addLeg('BUY', 'PE', row)}>
                                +PE
                              </button>
                              <button type="button" style={miniBtn} onClick={() => addLeg('SELL', 'PE', row)}>
                                −PE
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
        {!legs.length ? (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              border: '1px dashed rgba(56,189,248,0.35)',
              color: '#64748b',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            No legs yet — click +CE/+PE on the chain, use ATM buttons, or{' '}
            <button type="button" onClick={seedAtmStraddle} style={{ ...linkish }}>
              Seed ATM straddle
            </button>
            .
          </div>
        ) : (
          legs.map((leg, i) => (
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
              <button
                type="button"
                style={ghost}
                onClick={() => setLegs((prev) => prev.filter((_, idx) => idx !== i))}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          disabled={!legs.length || busy}
          onClick={() => void runPreview()}
          style={btnPrimary}
        >
          Preview
        </button>
        <button
          type="button"
          disabled={!legs.length || busy}
          onClick={() => void placePaper()}
          style={btnPrimary}
        >
          Place Paper Order
        </button>
        <input
          value={strategyName}
          onChange={(e) => setStrategyName(e.target.value)}
          style={{ ...input, width: 160 }}
          placeholder="Strategy name"
        />
        <button type="button" disabled={!legs.length || busy} onClick={() => void saveStrategy()} style={btn}>
          Save Strategy
        </button>
        <button type="button" disabled={busy} onClick={() => void startPaperAlgo()} style={btnPrimary}>
          {busy ? 'Working…' : 'Start Paper Algo'}
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
      ) : (
        <div style={{ fontSize: 11, color: '#64748b' }}>
          Preview / fill details appear here after Preview, Place, or Start Paper Algo.
        </div>
      )}
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

const th: CSSProperties = { padding: '8px 10px', position: 'sticky', top: 0, background: '#0f172a' };
const td: CSSProperties = { padding: '8px 10px' };

const miniBtn: CSSProperties = {
  height: 24,
  padding: '0 6px',
  borderRadius: 6,
  border: '1px solid rgba(56,189,248,0.35)',
  background: 'rgba(8,47,73,0.8)',
  color: '#7dd3fc',
  fontSize: 10,
  cursor: 'pointer',
};

const linkish: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#67e8f9',
  textDecoration: 'underline',
  cursor: 'pointer',
  fontSize: 12,
  padding: 0,
};
