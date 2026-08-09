import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { executionGovernanceApi } from '@/api/executionGovernance';
import { useHomeStatus, useRecommendedAlgos } from '@/hooks/tradeos/useTradeos';
import {
  FlowSteps,
  KillSwitchButton,
  ModeToggle,
  PageHero,
  PremiumCard,
  RiskBudgetMeter,
  RiskHealthRing,
  SafetyBanner,
  StatusPill,
  TradeosButton
} from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';

type NavFn = (section: string) => void;

export function TradeosHome({ onNavigate }: { onNavigate?: NavFn }) {
  const { data, reload } = useHomeStatus();
  const { data: reco } = useRecommendedAlgos();
  const [busy, setBusy] = useState(false);

  const health = useMemo(() => {
    if (data?.kill_switch) return 28;
    if (data?.live_locked) return 82;
    return 64;
  }, [data]);

  const go = (id: string) => onNavigate?.(id);

  return (
    <div style={{ color: tradeos.text, maxWidth: 1200, margin: '0 auto', padding: '4px 4px 24px' }}>
      <PageHero
        title="Your trading is protected."
        subtitle="Paper mode is active. Live orders require approval. Idea → Check → Paper Test → Approve → Execute → Monitor."
        right={<ModeToggle paper />}
      />
      <FlowSteps />
      <SafetyBanner
        tone="safe"
        title="Paper mode is active"
        body="Live trading is locked until you approve. AI, TradingView, and DhanLaxmi can guide — only the order desk executes after RiskGuard."
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 14,
          marginTop: 16
        }}
      >
        <PremiumCard title="Today’s Market Mode" subtitle="Calm workspace">
          <StatusPill label="Markets open · paper first" tone="info" />
          <div style={{ marginTop: 12, fontSize: 13, color: tradeos.muted }}>Focus on quality over speed.</div>
        </PremiumCard>

        <PremiumCard title="Your Risk Mode" subtitle="Battery health for trading">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <RiskHealthRing score={health} />
            <div style={{ flex: 1 }}>
              <RiskBudgetMeter used={Number((data as { blocked_actions_today?: number })?.blocked_actions_today || 0) * 50} max={1000} />
              <div style={{ marginTop: 10 }}>
                <TradeosButton variant="secondary" onClick={() => go('riskguard')}>
                  Open RiskGuard
                </TradeosButton>
              </div>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard
          title="Recommended Algo"
          subtitle={String(reco?.algo || 'Loading…')}
          action={reco?.score != null ? <StatusPill label={`Score ${reco.score}`} tone="safe" /> : null}
        >
          <div style={{ fontSize: 13, color: tradeos.muted, lineHeight: 1.5, minHeight: 40 }}>
            {String(reco?.reason || 'Finding a calm fit for your capital and risk…')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <TradeosButton onClick={() => go('algo-library')}>Use Algo</TradeosButton>
            <TradeosButton variant="secondary" onClick={() => go('papertrade-lab')}>
              Paper Test
            </TradeosButton>
          </div>
        </PremiumCard>

        <PremiumCard title="TradingView Signals" subtitle="Alerts become safe signals first">
          <div style={{ fontSize: 13, color: tradeos.muted }}>They do not trade directly.</div>
          <div style={{ marginTop: 12 }}>
            <TradeosButton onClick={() => go('tradingview-connect')}>Open Connect</TradeosButton>
          </div>
        </PremiumCard>

        <PremiumCard title="Pending Approvals" subtitle="Nothing executes until you say yes">
          <div style={{ fontSize: 22, fontWeight: 700 }}>{String(data?.active_approvals ?? 0)}</div>
          <div style={{ marginTop: 12 }}>
            <TradeosButton onClick={() => go('live-approval')}>Review approvals</TradeosButton>
          </div>
        </PremiumCard>

        <PremiumCard title="Paper Test Results" subtitle="Safe to test">
          <div style={{ fontSize: 13, color: tradeos.muted }}>Practice before live. No real money.</div>
          <div style={{ marginTop: 12 }}>
            <TradeosButton variant="secondary" onClick={() => go('papertrade-lab')}>
              Open PaperTrade Lab
            </TradeosButton>
          </div>
        </PremiumCard>

        <PremiumCard title="RiskGuard Status" subtitle="Always visible">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill label={data?.kill_switch ? 'Kill switch ON' : 'Kill switch off'} tone={data?.kill_switch ? 'blocked' : 'safe'} />
            <StatusPill label={data?.live_locked ? 'Live locked' : 'Live open'} tone={data?.live_locked ? 'locked' : 'warning'} />
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <KillSwitchButton
              active={!!data?.kill_switch}
              onClick={() => {
                setBusy(true);
                void executionGovernanceApi
                  .triggerKillSwitch(!data?.kill_switch)
                  .then(reload)
                  .then(() => toast.message('Safety control updated'))
                  .finally(() => setBusy(false));
              }}
            />
            <TradeosButton disabled={busy} variant="ghost" onClick={() => go('execution-governance')}>
              Advanced timeline
            </TradeosButton>
          </div>
        </PremiumCard>

        <PremiumCard title="Ask DhanLaxmi" subtitle="Explain · draft · request approval">
          <div style={{ fontSize: 13, color: tradeos.muted }}>Never executes for you.</div>
          <div style={{ marginTop: 12 }}>
            <TradeosButton onClick={() => go('dhanlaxmi')}>Open assistant</TradeosButton>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
