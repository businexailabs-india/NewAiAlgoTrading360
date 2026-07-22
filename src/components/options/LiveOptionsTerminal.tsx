import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { API_BASE_URL } from '@/lib/api';

type PaperStrategy = { id: string; name: string; legs: unknown };
type LiveOrder = {
  id: string;
  symbol: string;
  tradeType: string;
  quantity: number;
  price: number | null;
  status: string;
  isPaper: boolean;
  brokerOrderId?: string | null;
  orderType?: string;
};
type FnoPos = {
  id: string;
  tradingSymbol: string;
  side: string;
  quantity: number;
  avgPrice: number;
  lastPrice: number;
  mtm: number;
  realizedPnl: number;
  isPaper: boolean;
  optionType?: string | null;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Live Options Terminal — preview/clone + OMS (orders / positions / modify / cancel / square-off).
 */
export function LiveOptionsTerminal() {
  const { mode, liveLocked, brokers, liveEnabled, hasTradingPin } = useTradingMode();
  const [ack, setAck] = useState(false);
  const [pin, setPin] = useState('');
  const [strategies, setStrategies] = useState<PaperStrategy[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [legs, setLegs] = useState<unknown[]>([]);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [positions, setPositions] = useState<FnoPos[]>([]);
  const [modifyQty, setModifyQty] = useState<Record<string, number>>({});
  const [modifyPrice, setModifyPrice] = useState<Record<string, number>>({});
  const featureOn = !!brokers?.featureLiveOptions;

  const refreshStrategies = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/paper/strategies`, { headers: authHeaders() });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const list = json.data || [];
      setStrategies(list);
      if (!selectedId && list[0]) setSelectedId(list[0].id);
    }
  }, [selectedId]);

  const refreshOms = useCallback(async () => {
    const [oRes, pRes] = await Promise.all([
      fetch(`${API_BASE_URL}/live/orders?isPaper=false`, { headers: authHeaders() }),
      fetch(`${API_BASE_URL}/live/positions?isPaper=false`, { headers: authHeaders() }),
    ]);
    const oJson = await oRes.json().catch(() => ({}));
    const pJson = await pRes.json().catch(() => ({}));
    if (oRes.ok) setOrders(oJson.data || []);
    if (pRes.ok) setPositions(pJson.data || []);
  }, []);

  useEffect(() => {
    void refreshStrategies();
    void refreshOms();
  }, [refreshStrategies, refreshOms]);

  async function clonePreview() {
    if (mode !== 'live') {
      toast.error('Switch to LIVE MODE first');
      return;
    }
    if (!ack) {
      toast.error('Confirm REAL MONEY acknowledgment');
      return;
    }
    if (!selectedId) {
      toast.error('Select a paper strategy to clone');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/live/orders/clone-from-paper`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ strategyId: selectedId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.correctiveAction || 'Clone preview failed');
      setPreview(json.data?.preview || json.data);
      setLegs(json.data?.clonedLegs || json.data?.preview?.legs || []);
      toast.success('Live preview ready — no broker order sent');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitLive() {
    if (!featureOn) {
      toast.error('FEATURE_LIVE_OPTIONS is off — submit blocked');
      return;
    }
    if (!ack || !pin || pin.length < 4) {
      toast.error('PIN + acknowledgment required for live submit');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/live/orders`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ legs, pin, confirmLive: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.correctiveAction || 'Submit failed');
      toast.success('Live order submitted to broker');
      setPreview(json.data);
      await refreshOms();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder(id: string) {
    if (!featureOn) {
      toast.error('FEATURE_LIVE_OPTIONS off');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/live/orders/${id}/cancel`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Cancel failed');
      toast.success('Cancel sent');
      await refreshOms();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  }

  async function modifyOrder(id: string) {
    if (!featureOn) {
      toast.error('FEATURE_LIVE_OPTIONS off');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/live/orders/${id}/modify`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          quantity: modifyQty[id],
          price: modifyPrice[id],
          orderType: 'LIMIT',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Modify failed');
      toast.success('Modify sent');
      await refreshOms();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Modify failed');
    } finally {
      setBusy(false);
    }
  }

  async function squareOff(id: string) {
    if (!featureOn) {
      toast.error('FEATURE_LIVE_OPTIONS off');
      return;
    }
    if (!ack || pin.length < 4) {
      toast.error('PIN + ack required for square-off');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/live/orders/${id}/square-off`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Square-off failed');
      toast.success('Square-off submitted');
      await refreshOms();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Square-off failed');
    } finally {
      setBusy(false);
    }
  }

  async function refreshMtm() {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/live/positions/mtm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ isPaper: false, underlying: 'NIFTY' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'MTM failed');
      setPositions(json.data?.positions || []);
      toast.success(`MTM updated (${json.data?.updated ?? 0})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'MTM failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <AlertTriangle className="h-4 w-4 text-orange-300" />
        <span style={{ fontWeight: 700, color: '#ffedd5' }}>Live Options Terminal</span>
        <span style={badge}>REAL MONEY</span>
        <div style={{ flex: 1 }} />
        <button type="button" style={btnGhost} onClick={() => void refreshOms()} disabled={busy}>
          <RefreshCw className="h-3.5 w-3.5" style={{ display: 'inline', marginRight: 6 }} />
          Refresh OMS
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#fdba74', lineHeight: 1.5, marginBottom: 14 }}>
        Clone paper → preview. Submit / modify / cancel / square-off require{' '}
        <code style={{ color: '#fed7aa' }}>FEATURE_LIVE_OPTIONS=true</code> + LIVE mode + PIN.
        Live legs must carry <strong>instrumentToken</strong> and <strong>NSE_FNO</strong>.
      </p>

      <ul style={{ fontSize: 12, color: '#e7e5e4', lineHeight: 1.7, marginBottom: 14, paddingLeft: 18 }}>
        <li>Mode: {mode.toUpperCase()}</li>
        <li>Broker connected: {liveLocked ? 'No (locked)' : 'Yes'}</li>
        <li>Live trading enabled: {liveEnabled ? 'Yes' : 'No'}</li>
        <li>FEATURE_LIVE_OPTIONS: {featureOn ? 'ON' : 'OFF'}</li>
        <li>Trading PIN set: {hasTradingPin ? 'Yes' : 'No'}</li>
      </ul>

      <label style={{ display: 'grid', gap: 4, fontSize: 11, color: '#fdba74', marginBottom: 10 }}>
        Paper strategy to clone
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={select}>
          {!strategies.length ? <option value="">No saved strategies</option> : null}
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, marginBottom: 12, color: '#fed7aa' }}>
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 2 }} />
        <span>I understand this involves REAL MONEY when submit is enabled.</span>
      </label>

      <label style={{ display: 'grid', gap: 4, fontSize: 11, color: '#fdba74', marginBottom: 12 }}>
        Trading PIN
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          style={select}
        />
      </label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <button type="button" disabled={busy} onClick={() => void clonePreview()} style={btn}>
          {busy ? 'Working…' : 'Clone → Live Preview'}
        </button>
        <button
          type="button"
          disabled={busy || !featureOn || !legs.length}
          onClick={() => void submitLive()}
          style={{ ...btn, background: featureOn ? '#9a3412' : '#44403c', opacity: featureOn ? 1 : 0.5 }}
        >
          Confirm Live Submit
        </button>
      </div>

      {preview ? <pre style={pre}>{JSON.stringify(preview, null, 2)}</pre> : null}

      <h3 style={h3}>Open F&amp;O positions</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button type="button" style={btnGhost} disabled={busy} onClick={() => void refreshMtm()}>
          Refresh MTM
        </button>
      </div>
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Symbol</th>
              <th style={th}>Side</th>
              <th style={th}>Qty</th>
              <th style={th}>Avg</th>
              <th style={th}>LTP</th>
              <th style={th}>MTM</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.tradingSymbol}</td>
                <td style={td}>{p.side}</td>
                <td style={td}>{p.quantity}</td>
                <td style={td}>{p.avgPrice.toFixed(2)}</td>
                <td style={td}>{p.lastPrice.toFixed(2)}</td>
                <td style={{ ...td, color: p.mtm >= 0 ? '#86efac' : '#fca5a5' }}>{p.mtm.toFixed(2)}</td>
              </tr>
            ))}
            {!positions.length ? (
              <tr>
                <td colSpan={6} style={{ ...td, color: '#a8a29e' }}>
                  No live F&amp;O positions yet
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <h3 style={h3}>Working orders</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Symbol</th>
              <th style={th}>Side</th>
              <th style={th}>Qty</th>
              <th style={th}>Price</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={td}>{o.symbol}</td>
                <td style={td}>{o.tradeType}</td>
                <td style={td}>
                  <input
                    type="number"
                    value={modifyQty[o.id] ?? o.quantity}
                    onChange={(e) =>
                      setModifyQty((m) => ({ ...m, [o.id]: Math.max(1, Number(e.target.value) || 1) }))
                    }
                    style={inputTiny}
                  />
                </td>
                <td style={td}>
                  <input
                    type="number"
                    step="0.05"
                    value={modifyPrice[o.id] ?? Number(o.price || 0)}
                    onChange={(e) =>
                      setModifyPrice((m) => ({ ...m, [o.id]: Number(e.target.value) || 0 }))
                    }
                    style={inputTiny}
                  />
                </td>
                <td style={td}>{o.status}</td>
                <td style={td}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <button type="button" style={btnMini} disabled={busy || !featureOn} onClick={() => void modifyOrder(o.id)}>
                      Modify
                    </button>
                    <button type="button" style={btnMini} disabled={busy || !featureOn} onClick={() => void cancelOrder(o.id)}>
                      Cancel
                    </button>
                    <button type="button" style={btnMini} disabled={busy || !featureOn} onClick={() => void squareOff(o.id)}>
                      Square-off
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!orders.length ? (
              <tr>
                <td colSpan={6} style={{ ...td, color: '#a8a29e' }}>
                  No live option orders
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const shell: CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: '1px solid rgba(251,146,60,0.55)',
  background:
    'linear-gradient(180deg, rgba(154,52,18,0.45) 0%, rgba(67,20,7,0.9) 50%, rgba(23,23,23,0.98) 100%)',
};
const badge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.08em',
  padding: '3px 8px',
  borderRadius: 999,
  background: 'rgba(234,88,12,0.25)',
  border: '1px solid rgba(251,146,60,0.55)',
  color: '#fdba74',
};
const btn: CSSProperties = {
  height: 36,
  padding: '0 14px',
  borderRadius: 8,
  border: 'none',
  background: '#c2410c',
  color: '#fff',
  fontWeight: 650,
  fontSize: 12,
  cursor: 'pointer',
};
const btnGhost: CSSProperties = {
  ...btn,
  background: 'transparent',
  border: '1px solid rgba(251,146,60,0.45)',
  color: '#fed7aa',
};
const btnMini: CSSProperties = {
  height: 26,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid rgba(251,146,60,0.45)',
  background: 'rgba(0,0,0,0.35)',
  color: '#ffedd5',
  fontSize: 10,
  cursor: 'pointer',
};
const select: CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: '1px solid rgba(251,146,60,0.45)',
  background: 'rgba(23,23,23,0.85)',
  color: '#ffedd5',
  padding: '0 8px',
};
const pre: CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  padding: 12,
  borderRadius: 8,
  background: 'rgba(0,0,0,0.45)',
  border: '1px solid rgba(251,146,60,0.25)',
  color: '#ffedd5',
  fontSize: 11,
  overflow: 'auto',
  maxHeight: 200,
};
const h3: CSSProperties = { margin: '0 0 8px', fontSize: 13, color: '#fed7aa' };
const table: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#e7e5e4' };
const th: CSSProperties = { textAlign: 'left', padding: '6px 8px', color: '#a8a29e', borderBottom: '1px solid rgba(68,64,60,0.6)' };
const td: CSSProperties = { padding: '6px 8px', borderBottom: '1px solid rgba(68,64,60,0.35)', fontFamily: 'ui-monospace, monospace' };
const inputTiny: CSSProperties = {
  width: 72,
  height: 26,
  borderRadius: 6,
  border: '1px solid rgba(120,113,108,0.5)',
  background: 'rgba(0,0,0,0.4)',
  color: '#ffedd5',
  padding: '0 6px',
};
