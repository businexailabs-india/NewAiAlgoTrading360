import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';

type Limits = {
  maxLotsPerOrder: number;
  maxDailyLoss: number;
  blockNakedShort: boolean;
  expiryDayWarn: boolean;
  maxOpenLots: number;
  maxAbsDelta: number;
  maxAbsVega: number;
  maxNetNotional: number;
};

type Exposure = {
  openLots: number;
  netNotional: number;
  netDelta: number;
  netVega: number;
  model?: string;
};

type RiskEvent = {
  id: string;
  kind: string;
  severity: string;
  reason: string;
  corrective?: string | null;
  createdAt: string;
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function RiskCenterPanel() {
  const [limits, setLimits] = useState<Limits | null>(null);
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [exposure, setExposure] = useState<Exposure | null>(null);

  const refresh = useCallback(async () => {
    const [lRes, eRes, pRes] = await Promise.all([
      fetch(`${API_BASE_URL}/risk/limits`, { headers: authHeaders() }),
      fetch(`${API_BASE_URL}/risk/events`, { headers: authHeaders() }),
      fetch(`${API_BASE_URL}/risk/portfolio`, { headers: authHeaders() }),
    ]);
    const lJson = await lRes.json().catch(() => ({}));
    const eJson = await eRes.json().catch(() => ({}));
    const pJson = await pRes.json().catch(() => ({}));
    if (lRes.ok) setLimits(lJson.data);
    if (eRes.ok) setEvents(eJson.data || []);
    if (pRes.ok) {
      setExposure({
        openLots: pJson.data.openLots,
        netNotional: pJson.data.netNotional,
        netDelta: pJson.data.netDelta,
        netVega: pJson.data.netVega,
        model: pJson.data.model,
      });
    }
  }, []);

  useEffect(() => {
    void refresh().catch((e) => toast.error(e.message));
  }, [refresh]);

  async function save() {
    if (!limits) return;
    const res = await fetch(`${API_BASE_URL}/risk/limits`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(limits),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.message || 'Save failed');
      return;
    }
    setLimits(json.data);
    toast.success('Risk limits updated');
    void refresh();
  }

  if (!limits) {
    return <div style={{ color: '#94a3b8', padding: 12 }}>Loading risk profile…</div>;
  }

  return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <Shield className="h-4 w-4 text-amber-300" />
        <span style={{ fontWeight: 650, color: '#ffedd5' }}>Risk Center</span>
      </div>

      {exposure ? (
        <div style={exposureBox}>
          <span>Open lots {exposure.openLots}</span>
          <span>Net notional ₹{exposure.netNotional.toLocaleString('en-IN')}</span>
          <span>Δ {exposure.netDelta.toFixed(2)}</span>
          <span>ν {exposure.netVega.toFixed(2)}</span>
          <span style={{ opacity: 0.7 }}>{exposure.model || 'estimate'}</span>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Field
          label="Max lots / order"
          value={limits.maxLotsPerOrder}
          onChange={(n) => setLimits({ ...limits, maxLotsPerOrder: n })}
        />
        <Field
          label="Max open lots"
          value={limits.maxOpenLots}
          onChange={(n) => setLimits({ ...limits, maxOpenLots: n })}
        />
        <Field
          label="Max daily loss (₹)"
          value={limits.maxDailyLoss}
          onChange={(n) => setLimits({ ...limits, maxDailyLoss: n })}
        />
        <Field
          label="Max |Δ| (0=off)"
          value={limits.maxAbsDelta}
          onChange={(n) => setLimits({ ...limits, maxAbsDelta: n })}
        />
        <Field
          label="Max |ν| (0=off)"
          value={limits.maxAbsVega}
          onChange={(n) => setLimits({ ...limits, maxAbsVega: n })}
        />
        <Field
          label="Max net notional (₹, 0=off)"
          value={limits.maxNetNotional}
          onChange={(n) => setLimits({ ...limits, maxNetNotional: n })}
        />
      </div>

      <label style={checkLabel}>
        <input
          type="checkbox"
          checked={limits.blockNakedShort}
          onChange={(e) => setLimits({ ...limits, blockNakedShort: e.target.checked })}
        />
        Block naked short options
      </label>
      <label style={checkLabel}>
        <input
          type="checkbox"
          checked={limits.expiryDayWarn}
          onChange={(e) => setLimits({ ...limits, expiryDayWarn: e.target.checked })}
        />
        Warn on expiry-day trades
      </label>

      <button type="button" onClick={() => void save()} style={btn}>
        Save limits
      </button>

      <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 13, color: '#cbd5e1' }}>Recent risk events</h3>
      <div style={{ display: 'grid', gap: 6 }}>
        {events.length === 0 ? (
          <div style={{ fontSize: 12, color: '#64748b' }}>No events yet</div>
        ) : (
          events.map((ev) => (
            <div key={ev.id} style={eventRow}>
              <span style={{ color: ev.severity === 'ERROR' ? '#fca5a5' : '#fcd34d' }}>{ev.kind}</span>
              <span style={{ color: '#e7e5e4' }}>{ev.reason}</span>
              <span style={{ color: '#78716c', fontSize: 11 }}>{new Date(ev.createdAt).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label style={labelStyle}>
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={input}
      />
    </label>
  );
}

const shell: CSSProperties = { padding: 12, color: '#e7e5e4' };
const labelStyle: CSSProperties = { display: 'grid', gap: 4, fontSize: 12, color: '#a8a29e' };
const input: CSSProperties = {
  background: 'rgba(28,25,23,0.8)',
  border: '1px solid rgba(120,113,108,0.45)',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#fafaf9',
};
const checkLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 12,
  fontSize: 13,
  color: '#d6d3d1',
};
const btn: CSSProperties = {
  marginTop: 14,
  background: 'rgba(245,158,11,0.2)',
  border: '1px solid rgba(245,158,11,0.45)',
  color: '#fde68a',
  borderRadius: 8,
  padding: '8px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};
const eventRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '70px 1fr auto',
  gap: 8,
  fontSize: 12,
  padding: '6px 8px',
  background: 'rgba(28,25,23,0.45)',
  borderRadius: 6,
};
const exposureBox: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginBottom: 14,
  fontSize: 12,
  color: '#fde68a',
  padding: '8px 10px',
  background: 'rgba(120,53,15,0.25)',
  borderRadius: 8,
  border: '1px solid rgba(245,158,11,0.25)',
};
