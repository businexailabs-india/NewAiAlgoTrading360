import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { API_BASE_URL } from '@/lib/api';

type ControlRoom = {
  capital: number;
  today_pnl: number;
  daily_target: number;
  daily_target_range: { min: number; max: number };
  max_daily_loss: number;
  risk_used_percent: number;
  trades_taken: number;
  max_trades: number;
  consecutive_losses: number;
  mode: string;
  kill_switch_status: string;
  no_trade_mode: boolean;
  budget_status: string;
  live_unlock: string;
  recommendation: string;
};

const panel: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(248,113,113,0.35)',
  background: 'rgba(15,23,42,0.85)',
  padding: 16,
  color: '#e2e8f0'
};

const btn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(248,113,113,0.4)',
  background: 'rgba(248,113,113,0.15)',
  color: '#fecaca',
  cursor: 'pointer',
  fontSize: 12
};

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export function RiskControlRoomPanel() {
  const [room, setRoom] = useState<ControlRoom | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      // Ensure onboarding exists for 1L default
      await fetch(`${API_BASE_URL}/risk-onboarding/profile`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          capitalAmount: 100000,
          experienceLevel: 'beginner',
          riskTolerance: 'moderate',
          tradingType: 'intraday',
          language: 'hinglish'
        })
      });
      const res = await fetch(`${API_BASE_URL}/control-room/daily-status`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load control room');
      setRoom(json.data);
      setMsg('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kill = async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE_URL}/risk/kill-switch/trigger`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason: 'Control room kill switch' })
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const noTrade = async () => {
    setBusy(true);
    try {
      await fetch(`${API_BASE_URL}/risk/no-trade-mode/enable`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason: 'Control room no-trade' })
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fda4af' }}>Daily Trading Control Room</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Rs 1 Lakh Capital Risk Journey · RiskGuard360</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btn} disabled={busy} onClick={() => void load()}>
            Refresh
          </button>
          <button type="button" style={btn} disabled={busy} onClick={() => void noTrade()}>
            No-Trade Mode
          </button>
          <button type="button" style={{ ...btn, background: 'rgba(220,38,38,0.35)' }} disabled={busy} onClick={() => void kill()}>
            Kill Switch
          </button>
        </div>
      </div>

      {msg ? <div style={{ marginTop: 12, color: '#fca5a5', fontSize: 13 }}>{msg}</div> : null}

      {room ? (
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10 }}>
          <Stat label="Capital" value={`Rs ${room.capital.toLocaleString()}`} />
          <Stat label="Today P&L" value={`Rs ${room.today_pnl}`} hot={room.today_pnl < 0} />
          <Stat label="Daily target" value={`Rs ${room.daily_target_range.min}-${room.daily_target_range.max}`} />
          <Stat label="Max daily loss" value={`Rs ${room.max_daily_loss}`} />
          <Stat label="Risk used" value={`${room.risk_used_percent}%`} />
          <Stat label="Trades" value={`${room.trades_taken}/${room.max_trades}`} />
          <Stat label="Consec. losses" value={String(room.consecutive_losses)} />
          <Stat label="Mode" value={room.mode} />
          <Stat label="Kill switch" value={room.kill_switch_status} hot={room.kill_switch_status === 'ACTIVE'} />
          <Stat label="Live unlock" value={room.live_unlock} />
          <Stat label="Budget" value={room.budget_status} />
        </div>
      ) : (
        <div style={{ marginTop: 16, color: '#94a3b8' }}>{busy ? 'Loading…' : 'No data'}</div>
      )}

      {room?.recommendation ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(148,163,184,0.25)',
            fontSize: 13
          }}
        >
          {room.recommendation}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <div style={{ padding: 10, borderRadius: 8, background: 'rgba(2,6,23,0.55)', border: '1px solid rgba(51,65,85,0.8)' }}>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: hot ? '#f87171' : '#f8fafc' }}>{value}</div>
    </div>
  );
}
