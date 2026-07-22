import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownToLine, ArrowUpFromLine, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatInr } from './algosCatalog';
import { portfolioService, type FundLedgerEntry } from '../../services/portfolioService';

type Mode = 'add' | 'withdraw';

const PRESETS = [10000, 25000, 50000, 100000, 250000];

export function FundTransferModal({
  open,
  initialMode = 'add',
  onClose,
  onDone,
}: {
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
  onDone?: (availableCash: number) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [availableCash, setAvailableCash] = useState(0);
  const [ledger, setLedger] = useState<FundLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setAmount('');
    setNote('');
    setLoading(true);
    portfolioService
      .getFunds()
      .then((f) => {
        setAvailableCash(f.availableCash);
        setLedger(Array.isArray(f.ledger) ? f.ledger : []);
      })
      .catch(() => {
        setAvailableCash(0);
        setLedger([]);
      })
      .finally(() => setLoading(false));
  }, [open, initialMode]);

  if (!open) return null;

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) {
      toast.error('Enter a valid amount');
      return;
    }
    if (mode === 'withdraw' && parsed > availableCash) {
      toast.error('Insufficient available cash');
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === 'add'
          ? await portfolioService.addFunds(parsed, note || undefined)
          : await portfolioService.withdrawFunds(parsed, note || undefined);
      setAvailableCash(result.availableCash);
      setLedger(Array.isArray(result.ledger) ? result.ledger : []);
      setAmount('');
      setNote('');
      toast.success(mode === 'add' ? `Added ${formatInr(parsed)}` : `Withdrew ${formatInr(parsed)}`);
      onDone?.(result.availableCash);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add or withdraw funds"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.72)',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 12,
          border: '1px solid rgba(34,211,238,0.28)',
          background: 'rgba(15,23,42,0.97)',
          color: '#e2e8f0',
          padding: 16,
          boxShadow: '0 20px 50px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#f1f5f9' }}>Funds</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Available cash · paper / algo desk
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(148,163,184,0.25)',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
            }}
          >
            <X className="h-4 w-4 mx-auto" />
          </button>
        </div>

        <div
          style={{
            borderRadius: 10,
            border: '1px solid rgba(34,211,238,0.22)',
            background: 'rgba(2,6,23,0.45)',
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Available cash</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#6ee7b7', marginTop: 4 }}>
            {loading ? '…' : formatInr(availableCash)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(
            [
              ['add', 'Add Fund', ArrowDownToLine],
              ['withdraw', 'Withdraw Fund', ArrowUpFromLine],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                border:
                  mode === id
                    ? '1px solid rgba(52,211,153,0.55)'
                    : '1px solid rgba(148,163,184,0.2)',
                background: mode === id ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: mode === id ? '#6ee7b7' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12, color: '#cbd5e1' }}>
            Amount (₹)
            <input
              type="number"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50000"
              disabled={busy}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                height: 38,
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.25)',
                background: 'rgba(2,6,23,0.45)',
                color: '#e2e8f0',
                padding: '0 12px',
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </label>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                {formatInr(p)}
              </button>
            ))}
            {mode === 'withdraw' && availableCash > 0 ? (
              <button
                type="button"
                onClick={() => setAmount(String(Math.floor(availableCash)))}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  fontSize: 11,
                  border: '1px solid rgba(52,211,153,0.4)',
                  background: 'rgba(16,185,129,0.1)',
                  color: '#6ee7b7',
                  cursor: 'pointer',
                }}
              >
                Max
              </button>
            ) : null}
          </div>

          <label style={{ fontSize: 12, color: '#cbd5e1' }}>
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'add' ? 'Bank top-up' : 'Bank transfer out'}
              disabled={busy}
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                height: 36,
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.25)',
                background: 'rgba(2,6,23,0.45)',
                color: '#e2e8f0',
                padding: '0 12px',
                fontSize: 13,
                boxSizing: 'border-box',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={busy || !valid}
            style={{
              marginTop: 4,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 40,
              borderRadius: 8,
              border: 'none',
              background: mode === 'add' ? '#059669' : '#be123c',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: busy || !valid ? 'not-allowed' : 'pointer',
              opacity: busy || !valid ? 0.5 : 1,
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === 'add' ? 'Add Fund' : 'Withdraw Fund'}
          </button>
        </form>

        {ledger.length > 0 ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>Recent transfers</div>
            <div style={{ maxHeight: 140, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ledger.slice(0, 8).map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(148,163,184,0.15)',
                    background: 'rgba(2,6,23,0.35)',
                    fontSize: 11,
                  }}
                >
                  <div>
                    <div style={{ color: row.type === 'add' ? '#6ee7b7' : '#f87171', fontWeight: 600 }}>
                      {row.type === 'add' ? '+' : '−'}
                      {formatInr(row.amount)}
                    </div>
                    <div style={{ color: '#64748b' }}>{row.note || row.type}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: '#94a3b8' }}>
                    <div>{new Date(row.createdAt).toLocaleString()}</div>
                    <div>Bal {formatInr(row.balanceAfter)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
