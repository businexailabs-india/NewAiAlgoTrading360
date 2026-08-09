import { useState } from 'react';
import { toast } from 'sonner';
import { executionGovernanceApi } from '@/api/executionGovernance';
import {
  CopyWebhookBox,
  PageHero,
  PremiumCard,
  SafetyBanner,
  StatusPill,
  TradeosButton
} from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';

const STEPS = [
  'Create connection',
  'Copy webhook URL',
  'Copy alert payload',
  'Paste into TradingView',
  'Send test alert'
];

export function TradingViewConnectPremium() {
  const [step, setStep] = useState(0);
  const [created, setCreated] = useState<Record<string, unknown> | null>(null);
  const [signals, setSignals] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const data = (await executionGovernanceApi.createTradingViewConnection()) as Record<string, unknown>;
      setCreated(data);
      setStep(1);
      toast.success('Connection ready — copy the secret now');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const loadSignals = async () => {
    try {
      const rows = (await executionGovernanceApi.getTradingViewSignals()) as Record<string, unknown>[];
      setSignals(Array.isArray(rows) ? rows : []);
      setStep(4);
    } catch {
      setSignals([]);
    }
  };

  const sample =
    created?.samplePayload ||
    {
      secret: 'USER_WEBHOOK_SECRET',
      symbol: '{{ticker}}',
      side: 'BUY',
      price: '{{close}}',
      timestamp: '{{time}}'
    };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', color: tradeos.text }}>
      <PageHero
        title="TradingView Connect"
        subtitle="Connect your TradingView alerts in 5 minutes. Alerts become safe signals first. They do not trade directly."
        right={<StatusPill label="Signal only" tone="info" />}
      />
      <SafetyBanner
        tone="info"
        title="Alerts become safe signals first"
        body="They do not trade directly. Paper test → approve → RiskGuard → order desk."
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              padding: '8px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: i <= step ? 'rgba(45,212,191,0.16)' : 'rgba(148,163,184,0.08)',
              color: i <= step ? tradeos.teal : tradeos.muted,
              border: `1px solid ${i <= step ? 'rgba(45,212,191,0.35)' : 'rgba(148,163,184,0.14)'}`
            }}
          >
            {i + 1}. {s}
          </div>
        ))}
      </div>

      <PremiumCard title="Setup wizard" subtitle="One calm step at a time">
        {step === 0 ? (
          <TradeosButton disabled={busy} onClick={() => void create()}>
            Create connection
          </TradeosButton>
        ) : null}

        {created ? (
          <div style={{ marginTop: 8 }}>
            <CopyWebhookBox label="Webhook URL" value={String(created.webhookUrl || '')} />
            <CopyWebhookBox
              label="Secret (shown once)"
              value={String(created.secret || created.secretHint || '••••••••')}
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: tradeos.muted }}>Sample alert payload</div>
              <pre
                style={{
                  marginTop: 6,
                  padding: 12,
                  borderRadius: 12,
                  background: '#020617',
                  fontSize: 12,
                  overflow: 'auto'
                }}
              >
                {JSON.stringify(sample, null, 2)}
              </pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <TradeosButton
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(JSON.stringify(sample, null, 2));
                    setStep(3);
                    toast.success('Payload copied');
                  }}
                >
                  Copy payload
                </TradeosButton>
                <TradeosButton onClick={() => void loadSignals()}>Refresh signals</TradeosButton>
              </div>
            </div>
          </div>
        ) : null}
      </PremiumCard>

      <PremiumCard title="Received signals" subtitle="Inbox — never auto-executes" style={{ marginTop: 14 }}>
        {signals.length === 0 ? (
          <div style={{ color: tradeos.muted, fontSize: 13 }}>No signals yet. Paste the webhook into TradingView and send a test alert.</div>
        ) : (
          signals.slice(0, 8).map((s) => (
            <div
              key={String(s.id)}
              style={{
                padding: '10px 0',
                borderTop: '1px solid rgba(148,163,184,0.12)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                fontSize: 13
              }}
            >
              <span>
                {String(s.side)} {String(s.symbol)} · {String(s.status)}
              </span>
              <TradeosButton variant="ghost" onClick={() => toast.message('Open PaperTrade Lab to test this signal')}>
                Paper Test
              </TradeosButton>
            </div>
          ))
        )}
      </PremiumCard>
    </div>
  );
}
