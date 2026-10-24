import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  CreditCard,
  Landmark,
  Loader2,
  Smartphone,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatInr } from './algosCatalog';
import { portfolioService, type FundLedgerEntry } from '../../services/portfolioService';

type Mode = 'add' | 'withdraw';
type DeskMode = 'PAPER' | 'LIVE';
type PayMode = 'PAPER_CREDIT' | 'UPI' | 'NETBANKING' | 'IMPS' | 'NEFT' | 'RTGS' | 'DEBIT';

const PRESETS = [10000, 25000, 50000, 100000, 250000];

const ADD_PAY: Array<{ id: PayMode; label: string; hint: string; Icon: typeof Wallet }> = [
  { id: 'PAPER_CREDIT', label: 'Paper credit', hint: 'Instant virtual cash', Icon: Wallet },
  { id: 'UPI', label: 'UPI', hint: 'GPay · PhonePe · BHIM', Icon: Smartphone },
  { id: 'NETBANKING', label: 'Net Banking', hint: 'All major banks', Icon: Landmark },
  { id: 'IMPS', label: 'IMPS', hint: '24×7 instant', Icon: Zap },
  { id: 'NEFT', label: 'NEFT', hint: 'Same-day bank transfer', Icon: Building2 },
  { id: 'RTGS', label: 'RTGS', hint: '₹2 lakh and above', Icon: Building2 },
  { id: 'DEBIT', label: 'Debit card', hint: 'Visa · Mastercard · RuPay', Icon: CreditCard },
];

const WITHDRAW_PAY: Array<{ id: PayMode; label: string; hint: string; Icon: typeof Wallet }> = [
  { id: 'PAPER_CREDIT', label: 'Paper debit', hint: 'Instant virtual cash out', Icon: Wallet },
  { id: 'UPI', label: 'UPI', hint: 'To UPI ID / VPA', Icon: Smartphone },
  { id: 'IMPS', label: 'IMPS', hint: 'Instant to bank', Icon: Zap },
  { id: 'NEFT', label: 'NEFT', hint: 'To linked bank', Icon: Building2 },
  { id: 'RTGS', label: 'RTGS', hint: '₹2 lakh and above', Icon: Building2 },
  { id: 'NETBANKING', label: 'Bank transfer', hint: 'IMPS / NEFT / RTGS', Icon: Landmark },
];

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

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
  const { mode: tradingMode, liveLocked } = useTradingMode();
  const { theme } = useTheme();
  const light = theme === 'light';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [desk, setDesk] = useState<DeskMode>(tradingMode === 'live' && !liveLocked ? 'LIVE' : 'PAPER');
  const [payMode, setPayMode] = useState<PayMode>('PAPER_CREDIT');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [availableCash, setAvailableCash] = useState(0);
  const [ledger, setLedger] = useState<FundLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setDesk(tradingMode === 'live' && !liveLocked ? 'LIVE' : 'PAPER');
    setPayMode('PAPER_CREDIT');
    setAmount('');
    setNote('');
    setLoading(true);
    Promise.all([
      portfolioService.getFunds().catch(() => null),
      fetch(`${API_BASE_URL}/paper/account`, { headers: authHeaders() })
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([f, paper]) => {
        const paperCash = Number(paper?.data?.cashBalance ?? 0);
        const folio = f ? Number(f.availableCash ?? 0) : 0;
        setAvailableCash(Math.max(folio, paperCash));
        setLedger(f && Array.isArray(f.ledger) ? f.ledger : []);
      })
      .catch(() => {
        setAvailableCash(0);
        setLedger([]);
      })
      .finally(() => setLoading(false));
  }, [open, initialMode, tradingMode, liveLocked]);

  if (!open) return null;

  const ui = light
    ? {
        overlay: 'rgba(15,23,42,0.45)',
        panelBg: '#ffffff',
        panelBd: '#cbd5e1',
        title: '#0f172a',
        muted: '#64748b',
        faint: '#94a3b8',
        cashBg: '#f8fafc',
        cashBd: '#e2e8f0',
        cash: '#047857',
        onBd: '#059669',
        onBg: '#ecfdf5',
        onFg: '#047857',
        offBd: '#e2e8f0',
        offBg: '#ffffff',
        offFg: '#334155',
        deskOnBd: '#0284c7',
        deskOnBg: '#e0f2fe',
        deskOnFg: '#0369a1',
        inputBg: '#ffffff',
        inputBd: '#cbd5e1',
        inputFg: '#0f172a',
        chipBg: '#ffffff',
        ledgerBg: '#f8fafc',
      }
    : {
        overlay: 'rgba(0,0,0,0.72)',
        panelBg: 'rgba(15,23,42,0.97)',
        panelBd: 'rgba(34,211,238,0.28)',
        title: '#f1f5f9',
        muted: '#94a3b8',
        faint: '#64748b',
        cashBg: 'rgba(2,6,23,0.45)',
        cashBd: 'rgba(34,211,238,0.22)',
        cash: '#6ee7b7',
        onBd: 'rgba(52,211,153,0.55)',
        onBg: 'rgba(16,185,129,0.15)',
        onFg: '#6ee7b7',
        offBd: 'rgba(148,163,184,0.2)',
        offBg: 'transparent',
        offFg: '#94a3b8',
        deskOnBd: 'rgba(14,165,233,0.65)',
        deskOnBg: 'rgba(14,165,233,0.15)',
        deskOnFg: '#7dd3fc',
        inputBg: 'rgba(2,6,23,0.45)',
        inputBd: 'rgba(148,163,184,0.25)',
        inputFg: '#e2e8f0',
        chipBg: 'transparent',
        ledgerBg: 'rgba(2,6,23,0.35)',
      };

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
    const payLabel = (mode === 'add' ? ADD_PAY : WITHDRAW_PAY).find((p) => p.id === payMode)?.label || payMode;
    const tagged = [desk === 'LIVE' ? 'Live' : 'Paper', payLabel, note.trim()].filter(Boolean).join(' · ');
    setBusy(true);
    try {
      if (desk === 'LIVE') {
        toast.message(
          liveLocked
            ? 'Live is locked. Use Paper + a payment mode, or unlock live with a connected broker.'
            : `Add or withdraw via ${payLabel} in your broker app (Dhan / Fyers). This desk does not take live payments.`
        );
        return;
      }
      const result =
        mode === 'add'
          ? await portfolioService.addFunds(parsed, tagged).catch(() => null)
          : await portfolioService.withdrawFunds(parsed, tagged).catch(() => null);
      const paperRes = await fetch(
        `${API_BASE_URL}/paper/account/${mode === 'add' ? 'topup' : 'withdraw'}`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ amount: parsed }),
        }
      ).catch(() => null);
      if (!result && !(paperRes && paperRes.ok)) {
        const errBody = paperRes ? await paperRes.json().catch(() => null) : null;
        throw new Error(errBody?.message || 'Transfer failed');
      }
      if (paperRes && !paperRes.ok && result) {
        const errBody = await paperRes.json().catch(() => null);
        if (mode === 'withdraw') {
          throw new Error(errBody?.message || 'Insufficient paper cash to withdraw');
        }
      }
      const paperJson = paperRes && paperRes.ok ? await paperRes.json().catch(() => null) : null;
      const nextCash = Number(
        result?.availableCash ?? paperJson?.data?.cashBalance ?? (mode === 'add' ? availableCash + parsed : availableCash - parsed)
      );
      setAvailableCash(nextCash);
      setLedger(result && Array.isArray(result.ledger) ? result.ledger : ledger);
      setAmount('');
      setNote('');
      toast.success(
        mode === 'add'
          ? `Added ${formatInr(parsed)} · ${payLabel}${desk === 'PAPER' ? ' (paper)' : ''}`
          : `Withdrew ${formatInr(parsed)} · ${payLabel}`
      );
      onDone?.(nextCash);
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
        background: ui.overlay,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          borderRadius: 12,
          border: `1px solid ${ui.panelBd}`,
          background: ui.panelBg,
          color: ui.title,
          padding: 16,
          boxShadow: light ? '0 20px 50px rgba(15,23,42,0.18)' : '0 20px 50px rgba(0,0,0,0.55)',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: ui.title }}>Funds</div>
            <div style={{ fontSize: 12, color: ui.muted, marginTop: 2 }}>
              Add funds · all modes · paper default
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
              border: `1px solid ${ui.offBd}`,
              background: 'transparent',
              color: ui.muted,
              cursor: 'pointer',
            }}
          >
            <X className="h-4 w-4 mx-auto" />
          </button>
        </div>

        <div
          style={{
            borderRadius: 10,
            border: `1px solid ${ui.cashBd}`,
            background: ui.cashBg,
            padding: 12,
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 11, color: ui.muted }}>Available cash</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: ui.cash, marginTop: 4 }}>
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
              onClick={() => {
                setMode(id);
                setPayMode('PAPER_CREDIT');
              }}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                border: `1px solid ${mode === id ? ui.onBd : ui.offBd}`,
                background: mode === id ? ui.onBg : ui.offBg,
                color: mode === id ? ui.onFg : ui.offFg,
                cursor: 'pointer',
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: ui.muted, marginBottom: 6 }}>Desk</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(
            [
              ['PAPER', 'Paper'],
              ['LIVE', liveLocked ? 'Live (locked)' : 'Live'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === 'LIVE' && liveLocked) {
                  toast.message('Live add funds stays in your broker app until live is unlocked');
                }
                setDesk(id);
                if (id === 'LIVE' && payMode === 'PAPER_CREDIT') setPayMode('UPI');
                if (id === 'PAPER') setPayMode('PAPER_CREDIT');
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: `1px solid ${desk === id ? ui.deskOnBd : ui.offBd}`,
                background: desk === id ? ui.deskOnBg : ui.offBg,
                color: desk === id ? ui.deskOnFg : ui.offFg,
                cursor: 'pointer',
                opacity: id === 'LIVE' && liveLocked ? 0.75 : 1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: ui.muted, marginBottom: 6 }}>
          {mode === 'add' ? 'Add via' : 'Withdraw via'}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 6,
            marginBottom: 12,
          }}
        >
          {(mode === 'add' ? ADD_PAY : WITHDRAW_PAY)
            .filter((p) => desk === 'PAPER' || p.id !== 'PAPER_CREDIT')
            .map((p) => {
              const on = payMode === p.id;
              const Icon = p.Icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPayMode(p.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    padding: '8px 10px',
                    borderRadius: 8,
                    textAlign: 'left',
                    border: `1px solid ${on ? ui.onBd : ui.offBd}`,
                    background: on ? ui.onBg : ui.offBg,
                    color: on ? ui.onFg : ui.offFg,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 12 }}>
                    <Icon className="h-3.5 w-3.5" />
                    {p.label}
                  </span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>{p.hint}</span>
                </button>
              );
            })}
        </div>

        <form onSubmit={(e) => void onSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ fontSize: 12, color: ui.offFg }}>
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
                border: `1px solid ${ui.inputBd}`,
                background: ui.inputBg,
                color: ui.inputFg,
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
                  border: `1px solid ${ui.offBd}`,
                  background: ui.chipBg,
                  color: ui.offFg,
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
                  border: `1px solid ${ui.onBd}`,
                  background: ui.onBg,
                  color: ui.onFg,
                  cursor: 'pointer',
                }}
              >
                Max
              </button>
            ) : null}
          </div>

          <label style={{ fontSize: 12, color: ui.offFg }}>
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
                border: `1px solid ${ui.inputBd}`,
                background: ui.inputBg,
                color: ui.inputFg,
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
            <div style={{ fontSize: 12, fontWeight: 600, color: ui.title, marginBottom: 8 }}>Recent transfers</div>
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
                    border: `1px solid ${ui.offBd}`,
                    background: ui.ledgerBg,
                    fontSize: 11,
                  }}
                >
                  <div>
                    <div style={{ color: row.type === 'add' ? ui.cash : '#be123c', fontWeight: 600 }}>
                      {row.type === 'add' ? '+' : '−'}
                      {formatInr(row.amount)}
                    </div>
                    <div style={{ color: '#64748b' }}>{row.note || row.type}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: ui.muted }}>
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
