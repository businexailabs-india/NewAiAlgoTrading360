import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  DhanLaxmiCard,
  DhanLaxmiChatResponse,
  LANGUAGES,
  dhanlaxmiService
} from '../services/dhanlaxmiService';

type Turn = {
  role: 'user' | 'assistant';
  text: string;
  cards?: DhanLaxmiCard[];
};

export function DhanLaxmiAssistant() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('hinglish');
  const [voiceOn, setVoiceOn] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [approval, setApproval] = useState<Record<string, unknown> | null>(null);
  const [paperResult, setPaperResult] = useState<Record<string, unknown> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, open]);

  async function send(message: string) {
    if (!message.trim() || busy) return;
    setBusy(true);
    setError(null);
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
        setTurns((t) => [...t, { role: 'assistant', text: 'Trade approval rejected. No order was sent.' }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[90] rounded-full bg-emerald-800 px-5 py-3 text-sm font-semibold text-amber-50 shadow-lg hover:bg-emerald-700"
      >
        Ask DhanLaxmi
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-[90] flex h-[min(70vh,640px)] w-[min(94vw,420px)] flex-col overflow-hidden rounded-2xl border border-emerald-900/20 bg-[#f7f3ea] shadow-2xl">
          <header className="flex items-center justify-between gap-2 border-b border-emerald-900/10 bg-emerald-950 px-4 py-3 text-amber-50">
            <div>
              <div className="text-sm font-semibold tracking-wide">DhanLaxmi</div>
              <div className="text-[11px] text-emerald-100/80">Assistant · never auto-trades</div>
            </div>
            <button type="button" className="text-xs opacity-80 hover:opacity-100" onClick={() => setOpen(false)}>
              Close
            </button>
          </header>

          <div className="flex flex-wrap items-center gap-2 border-b border-emerald-900/10 px-3 py-2 text-xs">
            <label className="flex items-center gap-1">
              Language
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded border border-emerald-900/20 bg-white px-1 py-0.5"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={voiceOn} onChange={(e) => setVoiceOn(e.target.checked)} />
              Voice path
            </label>
          </div>

          <div className="bg-amber-100/80 px-3 py-2 text-[11px] text-amber-950">
            Risk warning: Trading involves risk. Not financial advice. Profit is not guaranteed. Paper trading is
            default. Live needs your approval, RMS, and OMS.
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm text-emerald-950">
            {turns.length === 0 && (
              <p className="text-emerald-900/70">
                Try: “Reliance ka intraday setup batao” or “ମୋ portfolio risk କହ”
              </p>
            )}
            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'text-right' : 'text-left'}>
                <div
                  className={`inline-block max-w-[92%] rounded-2xl px-3 py-2 ${
                    t.role === 'user' ? 'bg-emerald-800 text-amber-50' : 'bg-white border border-emerald-900/10'
                  }`}
                >
                  {t.text}
                </div>
                {t.cards?.map((card, idx) => (
                  <div key={idx} className="mt-2 rounded-xl border border-emerald-900/15 bg-white p-3 text-left text-xs">
                    <div className="mb-1 font-semibold uppercase tracking-wide text-emerald-900/60">{card.type}</div>
                    {card.type === 'strategy_draft' && (
                      <>
                        <div>{String(card.data.title || card.data.strategy_type)}</div>
                        <div>
                          {String(card.data.symbol)} · {String(card.data.timeframe)} · paper only
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          className="mt-2 rounded bg-emerald-800 px-2 py-1 text-amber-50"
                          onClick={() => runPaper(String(card.data.id))}
                        >
                          Paper test
                        </button>
                      </>
                    )}
                    {card.type === 'approval' && (
                      <div className="space-y-1">
                        <pre className="overflow-x-auto whitespace-pre-wrap text-[10px]">
                          {JSON.stringify(card.data.order_preview_json || card.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {paperResult && (
            <div className="border-t border-emerald-900/10 bg-white px-3 py-2 text-xs">
              Paper result: {String(paperResult.status)} — live still blocked until qualification.
            </div>
          )}

          {approval && (
            <div className="border-t border-emerald-900/10 bg-white px-3 py-3 text-xs">
              <div className="mb-2 font-semibold">Trade approval</div>
              <p className="mb-2 text-emerald-900/70">
                Review symbol, side, qty, margin, stop-loss, and risk. DhanLaxmi will not place the order without
                RMS/OMS.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="rounded bg-emerald-800 px-3 py-1.5 text-amber-50"
                  onClick={() => decide(true)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="rounded border border-emerald-900/30 px-3 py-1.5"
                  onClick={() => decide(false)}
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {error && <div className="px-3 py-1 text-xs text-red-700">{error}</div>}

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-emerald-900/10 bg-white p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type or use voice path…"
              className="flex-1 rounded-xl border border-emerald-900/15 px-3 py-2 text-sm outline-none focus:border-emerald-700"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-emerald-800 px-3 py-2 text-sm font-medium text-amber-50 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
