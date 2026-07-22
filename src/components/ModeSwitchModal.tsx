import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useTradingMode, type TradingMode } from '@/contexts/TradingModeContext';

export function ModeSwitchModal({
  open,
  target,
  onClose,
  onNeedBrokers,
}: {
  open: boolean;
  target: TradingMode | null;
  onClose: () => void;
  onNeedBrokers?: () => void;
}) {
  const { switchMode, setTradingPin, hasTradingPin, liveLocked } = useTradingMode();
  const [pin, setPin] = useState('');
  const [confirmLive, setConfirmLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [setupPin, setSetupPin] = useState('');

  if (!open || !target) return null;

  const goingLive = target === 'live';

  async function submit() {
    setBusy(true);
    try {
      if (!hasTradingPin) {
        await setTradingPin(setupPin);
        toast.success('Trading PIN saved');
      }
      if (goingLive && liveLocked) {
        toast.error('Connect a broker first');
        onNeedBrokers?.();
        onClose();
        return;
      }
      await switchMode({
        mode: target,
        pin: hasTradingPin ? pin : setupPin,
        confirmLive: goingLive ? confirmLive : false,
      });
      toast.success(goingLive ? 'LIVE MODE enabled' : 'PAPER MODE enabled');
      onClose();
      setPin('');
      setConfirmLive(false);
      setSetupPin('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Mode switch failed');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm trading mode switch"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 12,
          border: goingLive ? '1px solid rgba(251,146,60,0.55)' : '1px solid rgba(56,189,248,0.45)',
          background: goingLive ? 'rgba(67,20,7,0.96)' : 'rgba(15,23,42,0.98)',
          padding: 20,
          color: '#e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {goingLive ? (
            <AlertTriangle className="h-5 w-5 text-orange-300" />
          ) : (
            <Shield className="h-5 w-5 text-sky-300" />
          )}
          <div style={{ fontWeight: 700, fontSize: 16 }}>
            {goingLive ? 'Enter LIVE MODE' : 'Switch to PAPER MODE'}
          </div>
        </div>

        {goingLive ? (
          <p style={{ fontSize: 13, color: '#fdba74', lineHeight: 1.5, marginBottom: 14 }}>
            You are about to enable <strong>REAL MONEY</strong> trading. Orders may be sent to your
            connected broker. Accidental switches are blocked without PIN confirmation.
          </p>
        ) : (
          <p style={{ fontSize: 13, color: '#7dd3fc', lineHeight: 1.5, marginBottom: 14 }}>
            PAPER MODE uses simulated capital only. Live broker order endpoints will not be called.
          </p>
        )}

        {!hasTradingPin ? (
          <label style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            Create Trading PIN (4–8 digits)
            <input
              type="password"
              inputMode="numeric"
              value={setupPin}
              onChange={(e) => setSetupPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              style={inputStyle}
            />
          </label>
        ) : (
          <label style={{ display: 'block', fontSize: 12, marginBottom: 12 }}>
            Trading PIN
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
              style={inputStyle}
            />
          </label>
        )}

        {goingLive ? (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={confirmLive}
              onChange={(e) => setConfirmLive(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>I understand this enables live trading with real funds.</span>
          </label>
        ) : null}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={ghostBtn} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            disabled={
              busy ||
              (hasTradingPin ? pin.length < 4 : setupPin.length < 4) ||
              (goingLive && !confirmLive)
            }
            onClick={() => void submit()}
            style={{
              ...solidBtn,
              background: goingLive ? '#c2410c' : '#0284c7',
              opacity:
                busy ||
                (hasTradingPin ? pin.length < 4 : setupPin.length < 4) ||
                (goingLive && !confirmLive)
                  ? 0.5
                  : 1,
            }}
          >
            {busy ? 'Working…' : goingLive ? 'Confirm LIVE' : 'Confirm PAPER'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const inputStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 6,
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'rgba(2,6,23,0.65)',
  color: '#f8fafc',
  padding: '0 10px',
  fontFamily: 'ui-monospace, monospace',
};

const ghostBtn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.35)',
  background: 'transparent',
  color: '#cbd5e1',
  cursor: 'pointer',
  fontSize: 12,
};

const solidBtn: CSSProperties = {
  padding: '8px 14px',
  borderRadius: 8,
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};
