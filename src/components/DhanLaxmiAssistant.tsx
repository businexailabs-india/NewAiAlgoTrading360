import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DhanLaxmiCard,
  DhanLaxmiChatResponse,
  LANGUAGES,
  dhanlaxmiService
} from '../services/dhanlaxmiService';
import { useWindowStack } from '../contexts/WindowStackContext';

type Turn = {
  role: 'user' | 'assistant';
  text: string;
  cards?: DhanLaxmiCard[];
};

type WindowMode = 'normal' | 'maximized';

interface DhanLaxmiAssistantProps {
  placement?: 'floating' | 'top';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MIN_W = 340;
const MIN_H = 380;
const DEFAULT_W = 420;
const DEFAULT_H = 560;
/** Clear top menu + ticker/profile. */
const TOP_OFFSET = 112;
const EDGE_GAP = 20;

export function DhanLaxmiAssistant({
  placement = 'floating',
  open: openProp,
  onOpenChange
}: DhanLaxmiAssistantProps) {
  const {
    claimZIndex,
    registerWindow,
    updateWindowStatus,
    unregisterWindow,
    getRestoreToken
  } = useWindowStack();
  const isControlled = openProp !== undefined;
  const [openState, setOpenState] = useState(false);
  const open = isControlled ? openProp : openState;
  const [zIndex, setZIndex] = useState(() => claimZIndex());
  const bringToFront = useCallback(() => setZIndex(claimZIndex()), [claimZIndex]);
  const lastRestoreToken = useRef(0);

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setOpenState(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  const [language, setLanguage] = useState('hinglish');
  const [voiceOn, setVoiceOn] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [approval, setApproval] = useState<Record<string, unknown> | null>(null);
  const [paperResult, setPaperResult] = useState<Record<string, unknown> | null>(null);
  const [mounted, setMounted] = useState(false);

  const [mode, setMode] = useState<WindowMode>('normal');
  const [minimized, setMinimized] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    registerWindow({
      id: 'dhanlaxmi',
      title: 'DhanLaxmi',
      subtitle: 'Local-language AI assistant',
      status: open ? 'open' : 'closed'
    });
    return () => unregisterWindow('dhanlaxmi');
  }, [registerWindow, unregisterWindow, open]);

  useEffect(() => {
    updateWindowStatus('dhanlaxmi', !open ? 'closed' : minimized ? 'minimized' : 'open');
  }, [open, minimized, updateWindowStatus]);

  useEffect(() => {
    const token = getRestoreToken('dhanlaxmi');
    if (token === lastRestoreToken.current) return;
    lastRestoreToken.current = token;
    if (!token) return;
    setOpen(true);
    setMinimized(false);
    setZIndex(claimZIndex());
  }, [getRestoreToken, setOpen, claimZIndex]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const drawerInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    edge: 'e' | 's' | 'se';
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open && pos === null && typeof window !== 'undefined') {
      setPos({ x: Math.max(EDGE_GAP, window.innerWidth - DEFAULT_W - EDGE_GAP), y: TOP_OFFSET });
    }
  }, [open, pos]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, open, minimized]);

  useEffect(() => {
    if (!open || minimized) return;
    const t = setTimeout(() => drawerInputRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [open, minimized]);

  const onDragMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const maxX = window.innerWidth - 120;
    const maxY = window.innerHeight - 60;
    setPos({
      x: Math.min(Math.max(-40, dragRef.current.origX + dx), maxX),
      y: Math.min(Math.max(56, dragRef.current.origY + dy), maxY)
    });
  }, []);

  const stopDrag = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', stopDrag);
  }, [onDragMove]);

  const startDrag = (e: React.PointerEvent) => {
    if (mode === 'maximized' || (e.target as HTMLElement).closest('button')) return;
    bringToFront();
    const origin = pos ?? { x: window.innerWidth - size.w - EDGE_GAP, y: TOP_OFFSET };
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: origin.x, origY: origin.y };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', stopDrag);
  };

  const onResizeMove = useCallback((e: PointerEvent) => {
    if (!resizeRef.current) return;
    const { edge, startX, startY, origW, origH } = resizeRef.current;
    const dw = e.clientX - startX;
    const dh = e.clientY - startY;
    let w = origW;
    let h = origH;
    if (edge.includes('e')) w = Math.min(Math.max(MIN_W, origW + dw), window.innerWidth - 40);
    if (edge.includes('s')) h = Math.min(Math.max(MIN_H, origH + dh), window.innerHeight - 80);
    setSize({ w, h });
  }, []);

  const stopResize = useCallback(() => {
    resizeRef.current = null;
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', stopResize);
  }, [onResizeMove]);

  const startResize = (edge: 'e' | 's' | 'se') => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    bringToFront();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: size.w,
      origH: size.h,
      edge
    };
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', stopResize);
  };

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
    setOpen(true);
    setMinimized(false);
    setTurns((t) => [...t, { role: 'user', text: message.trim() }]);
    setInput('');
    try {
      const data: DhanLaxmiChatResponse = voiceOn
        ? ((await dhanlaxmiService.voiceCommand(message.trim(), {
            conversation_id: conversationId,
            language_hint: language
          })) as DhanLaxmiChatResponse)
        : await dhanlaxmiService.chat(message.trim(), {
            conversation_id: conversationId,
            language_hint: language
          });
      setConversationId(data.conversation_id);
      setTurns((t) => [
        ...t,
        { role: 'assistant', text: data.response_text, cards: data.cards || [] }
      ]);
      const approvalCard = (data.cards || []).find((c) => c.type === 'approval');
      if (approvalCard) setApproval(approvalCard.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'DhanLaxmi unavailable');
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await send(input);
  }

  async function runPaper(draftId: string) {
    setBusy(true);
    try {
      const result = (await dhanlaxmiService.paperTest(draftId, conversationId)) as Record<
        string,
        unknown
      >;
      setPaperResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Paper test failed');
    } finally {
      setBusy(false);
    }
  }

  async function decide(approve: boolean) {
    if (!approval?.id) return;
    setBusy(true);
    try {
      if (approve) {
        const result = (await dhanlaxmiService.approve(String(approval.id), {
          explicit_confirmation: true,
          otp_or_biometric_ok: true,
          rms_approved: false,
          live_env_enabled: false
        })) as Record<string, unknown>;
        setApproval(result);
        setTurns((t) => [
          ...t,
          {
            role: 'assistant',
            text:
              result.status === 'blocked'
                ? `Approval recorded but blocked: ${JSON.stringify(result.block_reasons || [])}. OMS was not called without RMS.`
                : 'Approval submitted to RMS/OMS gates.'
          }
        ]);
      } else {
        await dhanlaxmiService.reject(String(approval.id));
        setApproval(null);
        setTurns((t) => [
          ...t,
          { role: 'assistant', text: 'Trade approval rejected. No order was sent.' }
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval action failed');
    } finally {
      setBusy(false);
    }
  }

  const launcher = (
    <button
      type="button"
      onClick={() => {
        setOpen(true);
        setMinimized(false);
      }}
      aria-label="Open DhanLaxmi assistant"
      style={
        placement === 'top'
          ? {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 16px',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.28)',
              background:
                'linear-gradient(180deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.98) 100%)',
              color: '#f8fafc',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)'
            }
          : {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              height: 36,
              padding: '0 14px',
              borderRadius: 999,
              border: '1px solid rgba(252,211,77,0.4)',
              background: 'linear-gradient(90deg, #064e3b 0%, #065f46 100%)',
              color: '#fef3c7',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: '0 0 18px rgba(16,185,129,0.35)'
            }
      }
    >
      <span
        style={
          placement === 'top'
            ? { color: '#e2e8f0', fontSize: 14, lineHeight: 1 }
            : {
                display: 'flex',
                height: 22,
                width: 22,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 999,
                background: '#fcd34d',
                color: '#064e3b',
                fontSize: 12
              }
        }
      >
        ✦
      </span>
      Ask DhanLaxmi
    </button>
  );

  const windowStyle: React.CSSProperties =
    mode === 'maximized'
      ? {
          left: 96,
          top: 72,
          width: 'auto',
          height: 'auto',
          right: 16,
          bottom: 16,
          zIndex
        }
      : {
          left: pos?.x ?? undefined,
          top: pos?.y ?? TOP_OFFSET,
          width: size.w,
          height: minimized ? 52 : size.h,
          zIndex
        };

  const chatWindow =
    mounted &&
    open &&
    !minimized &&
    createPortal(
      <div
        className="fixed flex flex-col overflow-hidden rounded-2xl neon-card neon-card-amber text-slate-100"
        style={windowStyle}
        onPointerDownCapture={bringToFront}
        role="dialog"
        aria-modal="false"
        aria-label="DhanLaxmi assistant"
      >
        {/* Title bar */}
        <header
          onPointerDown={startDrag}
          className={mode === 'maximized' ? '' : 'cursor-move'}
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            borderBottom: '1px solid rgba(251,191,36,0.3)',
            cursor: mode === 'maximized' ? 'default' : 'move',
            background:
              'linear-gradient(90deg, rgba(69,26,3,0.95) 0%, rgba(6,78,59,0.9) 50%, rgba(15,23,42,0.96) 100%)',
            boxShadow: 'inset 0 -1px 0 rgba(251,191,36,0.22), 0 8px 18px rgba(0,0,0,0.25)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto' }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-300 text-emerald-950 shadow-[0_0_12px_rgba(252,211,77,0.6)]">
              ✦
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                DhanLaxmi
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              </div>
              <div className="truncate text-[10px] text-emerald-100/60">
                Local-language AI · never auto-trades
              </div>
            </div>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' }}
            aria-label="Window controls"
          >
            <button
              type="button"
              title={minimized ? 'Restore' : 'Minimize'}
              aria-label={minimized ? 'Restore' : 'Minimize'}
              onClick={(e) => {
                e.stopPropagation();
                setMinimized((m) => !m);
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-[#febc2e] font-bold leading-none text-amber-950 ring-1 ring-black/20 shadow-[0_0_8px_rgba(254,188,46,0.55)] transition hover:brightness-110"
            >
              <span className="mt-[-1px] text-[11px] leading-none">{minimized ? '+' : '−'}</span>
            </button>
            <button
              type="button"
              title={mode === 'maximized' ? 'Restore' : 'Maximize'}
              aria-label={mode === 'maximized' ? 'Restore' : 'Maximize'}
              onClick={(e) => {
                e.stopPropagation();
                setMinimized(false);
                setMode((m) => (m === 'maximized' ? 'normal' : 'maximized'));
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-[#28c840] font-bold leading-none text-green-950 ring-1 ring-black/20 shadow-[0_0_8px_rgba(40,200,64,0.55)] transition hover:brightness-110"
            >
              <span className="text-[9px] leading-none">{mode === 'maximized' ? '❐' : '＋'}</span>
            </button>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5f57] font-bold leading-none text-red-950 ring-1 ring-black/20 shadow-[0_0_8px_rgba(255,95,87,0.6)] transition hover:brightness-110"
            >
              <span className="text-[10px] leading-none">×</span>
            </button>
          </div>
        </header>

        {!minimized && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-3 py-2 text-xs text-slate-300">
              <label className="flex items-center gap-1.5">
                Language
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="rounded-md border border-white/15 bg-slate-900/80 px-2 py-1 text-slate-100"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={voiceOn}
                  onChange={(e) => setVoiceOn(e.target.checked)}
                  className="accent-emerald-400"
                />
                Voice path
              </label>
            </div>

            <div className="border-b border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] text-amber-100">
              Trading involves risk. Not financial advice. Paper trading is default. Live needs your
              approval, RMS, and OMS.
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
              {turns.length === 0 && (
                <div className="neon-card-inner rounded-xl p-3 text-emerald-100/85">
                  <p className="mb-2 font-medium text-amber-200">Try asking:</p>
                  <ul className="space-y-1 text-xs">
                    <li>“आज market कैसा है?”</li>
                    <li>“Reliance ka intraday setup batao”</li>
                    <li>“ମୋ portfolio risk କହ”</li>
                  </ul>
                </div>
              )}
              {turns.map((t, i) => (
                <div key={i} className={t.role === 'user' ? 'text-right' : 'text-left'}>
                  <div
                    className={`inline-block max-w-[92%] rounded-2xl px-3 py-2 ${
                      t.role === 'user'
                        ? 'bg-emerald-700 text-amber-50 shadow-[0_0_14px_rgba(16,185,129,0.3)]'
                        : 'neon-card-inner text-slate-100'
                    }`}
                  >
                    {t.text}
                  </div>
                  {t.cards?.map((card, idx) => (
                    <div key={idx} className="neon-card-inner mt-2 rounded-xl p-3 text-left text-xs">
                      <div className="mb-1 font-semibold uppercase tracking-wide text-emerald-300/80">
                        {card.type}
                      </div>
                      {card.type === 'strategy_draft' && (
                        <>
                          <div>{String(card.data.title || card.data.strategy_type)}</div>
                          <div>
                            {String(card.data.symbol)} · {String(card.data.timeframe)} · paper only
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            className="mt-2 rounded bg-emerald-600 px-2 py-1 text-amber-50 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                            onClick={() => runPaper(String(card.data.id))}
                          >
                            Paper test
                          </button>
                        </>
                      )}
                      {card.type === 'approval' && (
                        <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] text-slate-300">
                          {JSON.stringify(card.data.order_preview_json || card.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {paperResult && (
              <div className="border-t border-white/10 px-3 py-2 text-xs text-slate-300">
                Paper result: {String(paperResult.status)} — live still blocked until qualification.
              </div>
            )}

            {approval && (
              <div className="border-t border-white/10 px-3 py-3 text-xs">
                <div className="mb-2 font-semibold text-amber-200">Trade approval</div>
                <p className="mb-2 text-slate-400">
                  Review symbol, side, qty, margin, stop-loss, and risk. DhanLaxmi will not place the
                  order without RMS/OMS.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-amber-50"
                    onClick={() => decide(true)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded border border-white/20 px-3 py-1.5"
                    onClick={() => decide(false)}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {error && <div className="px-3 py-1 text-xs text-red-300">{error}</div>}

            <form
              onSubmit={onSubmit}
              className="flex gap-2 border-t border-white/10 bg-slate-900/70 p-2.5"
            >
              <input
                ref={drawerInputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type in Hindi, Odia, English…"
                className="flex-1 rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-emerald-950 disabled:opacity-50"
              >
                Send
              </button>
            </form>

            {mode !== 'maximized' && (
              <>
                <div
                  onPointerDown={startResize('e')}
                  style={{ position: 'absolute', top: 40, right: 0, bottom: 12, width: 8, cursor: 'ew-resize', zIndex: 20 }}
                  aria-label="Resize horizontally"
                />
                <div
                  onPointerDown={startResize('s')}
                  style={{ position: 'absolute', left: 12, right: 12, bottom: 0, height: 8, cursor: 'ns-resize', zIndex: 20 }}
                  aria-label="Resize vertically"
                />
                <div
                  onPointerDown={startResize('se')}
                  style={{ position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, cursor: 'nwse-resize', zIndex: 21 }}
                  aria-label="Resize corner"
                >
                  <span className="pointer-events-none absolute bottom-1 right-1 h-3 w-3 rounded-sm border-b-2 border-r-2 border-amber-300/90" />
                </div>
              </>
            )}
          </>
        )}
      </div>,
      document.body
    );

  if (placement === 'top') {
    return (
      <>
        {!open && launcher}
        {chatWindow}
      </>
    );
  }

  return (
    <>
      {!open && (
        <div className="fixed bottom-6 right-6 z-[90]">{launcher}</div>
      )}
      {chatWindow}
    </>
  );
}
