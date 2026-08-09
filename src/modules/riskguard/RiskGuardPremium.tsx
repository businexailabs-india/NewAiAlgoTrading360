import { toast } from 'sonner';
import { executionGovernanceApi } from '@/api/executionGovernance';
import { useRiskGuardStatus } from '@/hooks/tradeos/useTradeos';
import {
  KillSwitchButton,
  PageHero,
  PremiumCard,
  RiskBudgetMeter,
  RiskHealthRing,
  SafetyBanner,
  StatusPill,
  TradeosButton
} from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';

export function RiskGuardPremium() {
  const { data, reload } = useRiskGuardStatus();
  const health = data?.kill_switch ? 22 : data?.live_locked ? 84 : 60;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', color: tradeos.text }}>
      <PageHero
        title="RiskGuard"
        subtitle="Battery health for trading — calm, visible, always on."
        right={<StatusPill label="Risk always visible" tone="info" />}
      />
      <SafetyBanner tone="safe" title="Protected by default" body="Paper on. Live locked. Kill switch ready. No guaranteed profit language." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, marginTop: 16 }}>
        <PremiumCard title="Risk health">
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <RiskHealthRing score={Number(health)} />
            <div style={{ fontSize: 13, color: tradeos.muted }}>Aim to stay above 70 with paper discipline.</div>
          </div>
        </PremiumCard>
        <PremiumCard title="Daily budget">
          <RiskBudgetMeter used={120} max={1000} />
          <div style={{ marginTop: 10, fontSize: 12, color: tradeos.muted }}>Target ₹300–700 · Max loss ₹1000 · Max risk/trade ₹300</div>
        </PremiumCard>
        <PremiumCard title="Controls">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusPill label={data?.kill_switch ? 'Kill switch ON' : 'Kill switch off'} tone={data?.kill_switch ? 'blocked' : 'safe'} />
            <StatusPill label="No-trade available" tone="info" />
            <StatusPill label="Live locked" tone="locked" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <KillSwitchButton
              active={!!data?.kill_switch}
              onClick={() =>
                void executionGovernanceApi
                  .triggerKillSwitch(!data?.kill_switch)
                  .then(reload)
                  .then(() => toast.message('Kill switch updated'))
              }
            />
            <TradeosButton
              variant="secondary"
              onClick={() =>
                void executionGovernanceApi.enableNoTradeMode(true).then(() => toast.message('No-trade mode requested'))
              }
            >
              Enable no-trade mode
            </TradeosButton>
            <TradeosButton variant="ghost" onClick={() => toast.message('Reduce size · widen stop · fewer trades')}>
              Reduce risk
            </TradeosButton>
          </div>
        </PremiumCard>
        <PremiumCard title="Blocked risky algos">
          <div style={{ fontSize: 13, color: tradeos.muted, lineHeight: 1.6 }}>
            {(data?.blocked_algos as string[])?.join(', ') ||
              'martingale, naked_options, short_straddle, hft_scalping, double_after_loss'}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
