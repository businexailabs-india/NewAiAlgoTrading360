import { useEffect, useState } from 'react';
import { executionGovernanceApi } from '@/api/executionGovernance';
import {
  ConfidenceScore,
  PageHero,
  PremiumCard,
  RiskHealthRing,
  SafetyBanner,
  StatusPill,
  TradeosButton
} from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';

export function AlgoSuitabilityPremium({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const [reco, setReco] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    void executionGovernanceApi.getRecommendedAlgos().then(setReco);
  }, []);
  const score = Number(reco?.score) || 0;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', color: tradeos.text }}>
      <PageHero
        title={String(reco?.algo || 'Algo suitability')}
        subtitle="A clear fit score — not a promise of profit."
        right={<ConfidenceScore score={score} />}
      />
      <SafetyBanner tone="info" title="Recommendation only" body="You still choose Paper Test or Request Approval. Nothing executes by itself." />

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18, marginTop: 16, alignItems: 'center' }}>
        <RiskHealthRing score={score} size={110} />
        <PremiumCard title="Fit breakdown" subtitle={String(reco?.allowed_mode || 'PAPER_ONLY')}>
          <Row label="Risk profile match" value="Good" />
          <Row label="Market condition match" value="Sideways · calm" />
          <Row label="Capital fit" value="₹1L ready" />
          <Row label="Broker fit" value="Paper broker OK" />
          <Row label="Paper-test result" value={reco?.paper_test_required ? 'Required' : 'Ready'} />
          <Row label="Complexity / drawdown" value="Managed" />
          <div style={{ marginTop: 10 }}>
            <StatusPill
              label={score >= 75 ? 'Recommended' : score >= 55 ? 'Watchlist' : 'Paper only'}
              tone={score >= 75 ? 'safe' : 'warning'}
            />
          </div>
        </PremiumCard>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        <TradeosButton onClick={() => onNavigate?.('papertrade-lab')}>Paper Test</TradeosButton>
        <TradeosButton variant="secondary" onClick={() => onNavigate?.('live-approval')}>
          Request Approval
        </TradeosButton>
        <TradeosButton variant="ghost" onClick={() => onNavigate?.('dhanlaxmi')}>
          Ask DhanLaxmi
        </TradeosButton>
      </div>
      <p style={{ marginTop: 14, fontSize: 13, color: tradeos.muted, lineHeight: 1.55 }}>{String(reco?.reason || '')}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid rgba(148,163,184,0.1)', fontSize: 13 }}>
      <span style={{ color: tradeos.muted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
