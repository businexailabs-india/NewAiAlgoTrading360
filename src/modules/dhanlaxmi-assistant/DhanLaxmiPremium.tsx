import { FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { dhanlaxmiService } from '@/services/dhanlaxmiService';
import {
  BlockedReasonCard,
  PageHero,
  PremiumCard,
  SafetyBanner,
  StatusPill,
  TradeosButton
} from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';

type Turn = { role: 'user' | 'assistant'; text: string };

const SUGGESTIONS = [
  'Which algo is safe today?',
  'Explain this TradingView signal.',
  'Can I trade Bank Nifty?',
  'Why was this trade blocked?',
  'Create a safe Reliance intraday algo.',
  'Stop all bots.'
];

/** Premium DhanLaxmi — never shows Execute */
export function DhanLaxmiPremium() {
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: 'assistant',
      text: 'I can explain, draft, and request approval. I never execute trades. Paper first.'
    }
  ]);
  const [showBlocked, setShowBlocked] = useState(false);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setTurns((t) => [...t, { role: 'user', text: message }]);
    setInput('');
    if (/blocked/i.test(message)) setShowBlocked(true);
    try {
      const res = await dhanlaxmiService.chat({ message, language_hint: 'en' });
      setTurns((t) => [
        ...t,
        {
          role: 'assistant',
          text: String(res.response_text || res.message || 'I can help with paper test and approval only.')
        }
      ]);
    } catch {
      setTurns((t) => [
        ...t,
        {
          role: 'assistant',
          text: 'I am here in safe mode. Try: “Which algo is safe today?” or “Why was this trade blocked?”'
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', color: tradeos.text }}>
      <PageHero
        title="DhanLaxmi"
        subtitle="Your calm trading guide. Explains risk, drafts strategies, requests approval — never presses Execute."
        right={<StatusPill label="Never auto-executes" tone="safe" />}
      />
      <SafetyBanner tone="info" title="No direct Execute button" body="Allowed actions: Paper Test, Create Strategy Draft, Request Approval, Explain Risk, Cancel." />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
        {SUGGESTIONS.map((s) => (
          <TradeosButton key={s} variant="ghost" onClick={() => void send(s)}>
            {s}
          </TradeosButton>
        ))}
      </div>

      <PremiumCard>
        <div style={{ display: 'grid', gap: 12, maxHeight: 420, overflow: 'auto', paddingRight: 4 }}>
          {turns.map((t, i) => (
            <div
              key={i}
              style={{
                justifySelf: t.role === 'user' ? 'end' : 'start',
                maxWidth: '85%',
                padding: '12px 14px',
                borderRadius: 14,
                background: t.role === 'user' ? 'rgba(56,189,248,0.14)' : 'rgba(148,163,184,0.08)',
                fontSize: 14,
                lineHeight: 1.55
              }}
            >
              {t.text}
            </div>
          ))}
        </div>

        {showBlocked ? (
          <div style={{ marginTop: 14 }}>
            <BlockedReasonCard
              title="Live trading is locked."
              why="DhanLaxmi can prepare this order, but you must approve it. TradingView alerts cannot trade directly."
              next="Run paper test first, or open Live Approval."
            />
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <TradeosButton onClick={() => toast.message('Open PaperTrade Lab from the sidebar')}>Paper Test</TradeosButton>
          <TradeosButton variant="secondary" onClick={() => toast.message('Strategy draft — request approval next')}>
            Create Strategy Draft
          </TradeosButton>
          <TradeosButton variant="secondary" onClick={() => toast.message('Approval request prepared')}>
            Request Approval
          </TradeosButton>
          <TradeosButton variant="ghost" onClick={() => void send('Explain risk')}>
            Explain Risk
          </TradeosButton>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            aria-label="Message DhanLaxmi"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask calmly…"
            style={{
              flex: 1,
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(148,163,184,0.25)',
              background: '#020617',
              color: tradeos.text
            }}
          />
          <TradeosButton disabled={busy}>{busy ? '…' : 'Send'}</TradeosButton>
        </form>
      </PremiumCard>
    </div>
  );
}
