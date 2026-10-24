import { useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { executionGovernanceApi } from '@/api/executionGovernance';
import {
  ExecutionTimelineView,
  PageHero,
  PremiumCard,
  SafetyBanner,
  StatusPill,
  TradeosButton
} from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';
import { useExecutionTimeline } from '@/hooks/tradeos/useTradeos';

export function PaperTradeLabPremium({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [algo, setAlgo] = useState('RSI Mean Reversion');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [intentId, setIntentId] = useState<string | undefined>();
  const { events, reload } = useExecutionTimeline(intentId);

  const run = async () => {
    setBusy(true);
    try {
      const res = (await executionGovernanceApi.runPaperTest(symbol)) as Record<string, unknown>;
      const id = String(res.intentId || '');
      setIntentId(id);
      setResult(res);
      await reload();
      toast.success('Paper test completed — no real money used');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Paper test failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', color: tradeos.text }}>
      <PageHero
        title="PaperTrade Lab"
        subtitle="No real money will be used. Practice until RiskGuard and you both feel ready."
        right={<StatusPill label="Safe to test" tone="safe" />}
      />
      <SafetyBanner
        tone="safe"
        title="Sandbox"
        body="Paper fills go through the same safety path: check → approve → RiskGuard → order desk."
      />

      <PremiumCard title="Run a calm paper test" style={{ marginTop: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          <label style={{ fontSize: 12, color: tradeos.muted }}>
            Algo
            <select value={algo} onChange={(e) => setAlgo(e.target.value)} style={field}>
              {['RSI Mean Reversion', 'VWAP Intraday', 'MA Crossover', 'TradingView Alert-to-Algo'].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: tradeos.muted }}>
            Symbol
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} style={field} />
          </label>
          <label style={{ fontSize: 12, color: tradeos.muted }}>
            Capital
            <input defaultValue="100000" style={field} />
          </label>
          <label style={{ fontSize: 12, color: tradeos.muted }}>
            Timeframe
            <select defaultValue="15m" style={field}>
              <option>5m</option>
              <option>15m</option>
              <option>1h</option>
            </select>
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <TradeosButton disabled={busy} onClick={() => void run()}>
            {busy ? 'Running…' : 'Run paper test'}
          </TradeosButton>
        </div>
      </PremiumCard>

      {result ? (
        <PremiumCard title="Paper result" subtitle="Live readiness is guidance — not a guarantee" style={{ marginTop: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
            <Metric label="Trades" value="1+" />
            <Metric label="Mode" value="Paper" />
            <Metric label="Order" value={String((result.order as { id?: string })?.id || 'filled').slice(0, 8)} />
            <Metric label="Live readiness" value="Paper only" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            <TradeosButton onClick={() => onNavigate?.('live-approval')}>Request Approval</TradeosButton>
            <TradeosButton variant="secondary" onClick={() => toast.message('Kept paper only — wise')}>
              Keep Paper Only
            </TradeosButton>
            <TradeosButton variant="ghost" onClick={() => onNavigate?.('algos')}>
              Improve Rules
            </TradeosButton>
          </div>
        </PremiumCard>
      ) : null}

      {intentId ? (
        <PremiumCard title="What happened" subtitle="Human timeline" style={{ marginTop: 14 }}>
          <ExecutionTimelineView events={events} />
        </PremiumCard>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 12, background: 'rgba(2,6,23,0.55)' }}>
      <div style={{ fontSize: 11, color: tradeos.muted }}>{label}</div>
      <div style={{ fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const field: CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 4,
  padding: 10,
  borderRadius: 10,
  border: '1px solid rgba(148,163,184,0.25)',
  background: '#020617',
  color: '#F8FAFC'
};
