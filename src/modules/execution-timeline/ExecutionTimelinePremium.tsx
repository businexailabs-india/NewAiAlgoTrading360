import { useState } from 'react';
import { executionGovernanceApi } from '@/api/executionGovernance';
import { useExecutionTimeline } from '@/hooks/tradeos/useTradeos';
import {
  BlockedReasonCard,
  ExecutionTimelineView,
  PageHero,
  PremiumCard,
  SafetyBanner,
  TradeosButton
} from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';

export function ExecutionTimelinePremium() {
  const [intentId, setIntentId] = useState('');
  const [block, setBlock] = useState<Record<string, unknown> | null>(null);
  const { events, reload } = useExecutionTimeline(intentId || undefined);

  const loadExplain = async () => {
    if (!intentId) return;
    const ex = await executionGovernanceApi.explainBlock(intentId);
    setBlock(ex);
    await reload();
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', color: tradeos.text }}>
      <PageHero
        title="Execution timeline"
        subtitle="Plain language for every safety step — from idea to portfolio."
      />
      <SafetyBanner tone="info" title="Advanced view" body="Beginners can stay on Home. This screen is for curious detail." />
      <PremiumCard title="Intent" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            aria-label="Intent id"
            value={intentId}
            onChange={(e) => setIntentId(e.target.value)}
            placeholder="Paste intent id"
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(148,163,184,0.25)',
              background: '#020617',
              color: tradeos.text
            }}
          />
          <TradeosButton onClick={() => void loadExplain()}>Load</TradeosButton>
        </div>
      </PremiumCard>
      <PremiumCard title="Timeline" style={{ marginTop: 14 }}>
        <ExecutionTimelineView events={events} />
      </PremiumCard>
      {block && (block.status === 'BLOCKED' || block.status === 'RMS_REJECTED' || block.status === 'USER_REJECTED') ? (
        <div style={{ marginTop: 14 }}>
          <BlockedReasonCard
            title={String(block.reason || 'Trade blocked for your safety')}
            why="A safety rule stopped automatic execution."
            next={String(block.next_action || 'Run paper test or request approval.')}
          />
        </div>
      ) : null}
    </div>
  );
}
