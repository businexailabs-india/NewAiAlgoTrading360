import { useState } from 'react';
import { toast } from 'sonner';
import { executionGovernanceApi } from '@/api/executionGovernance';
import { useApprovals } from '@/hooks/tradeos/useTradeos';
import { API_BASE_URL } from '@/lib/api';
import {
  PageHero,
  PremiumCard,
  PremiumModal,
  SafetyBanner,
  StatusPill,
  TradeosButton
} from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';

export function LiveApprovalPremium() {
  const { items, reload } = useApprovals();
  const [modal, setModal] = useState<Record<string, unknown> | null>(null);
  const [ack, setAck] = useState(false);

  const approve = async () => {
    if (!modal || !ack) {
      toast.error('Please confirm you understand live risk');
      return;
    }
    const id = String(modal.id);
    await fetchApprove(id, true);
    setModal(null);
    setAck(false);
    await reload();
    toast.success('Approval recorded — RiskGuard and order desk still required');
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', color: tradeos.text }}>
      <PageHero
        title="Live Approval"
        subtitle="Nothing live moves without your clear yes. Profit is not guaranteed."
        right={<StatusPill label="Live trading is locked" tone="locked" />}
      />
      <SafetyBanner
        tone="warning"
        title="Approve carefully"
        body="Approve once, approve for today, or create a bounded preapproved rule. You can always keep paper only."
      />

      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {items.length === 0 ? (
          <PremiumCard>
            <div style={{ color: tradeos.muted, fontSize: 14 }}>
              No pending approvals. Run a paper test, then request approval from PaperTrade Lab.
            </div>
          </PremiumCard>
        ) : (
          items.map((a) => (
            <PremiumCard
              key={String(a.id)}
              title={`${String(a.approvalType || a.approval_type)} · ${String(a.mode)}`}
              subtitle={`Status ${String(a.status)}`}
              action={<StatusPill label={String(a.status)} tone={a.status === 'APPROVED' ? 'safe' : 'warning'} />}
            >
              <div style={{ fontSize: 13, color: tradeos.muted, lineHeight: 1.6 }}>
                Symbols: {JSON.stringify(a.approvedSymbols || a.approved_symbols || [])}
                <br />
                Max qty {String(a.maxQuantity || a.max_quantity || '—')} · Max risk/trade ₹
                {String(a.maxRiskPerTrade || a.max_risk_per_trade || 300)} · Max daily loss ₹
                {String(a.maxDailyLoss || a.max_daily_loss || 1000)}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <TradeosButton onClick={() => setModal(a)}>Approve once</TradeosButton>
                <TradeosButton variant="secondary" onClick={() => toast.message('Day approval — still needs RiskGuard')}>
                  Approve for today
                </TradeosButton>
                <TradeosButton
                  variant="secondary"
                  onClick={() => toast.message('Open Advanced → Control Room for preapproval')}
                >
                  Create preapproved rule
                </TradeosButton>
                <TradeosButton variant="ghost" onClick={() => void fetchApprove(String(a.id), false).then(reload)}>
                  Reject
                </TradeosButton>
                <TradeosButton variant="ghost" onClick={() => toast.message('Kept paper only')}>
                  Paper only
                </TradeosButton>
              </div>
            </PremiumCard>
          ))
        )}
      </div>

      <PremiumModal
        open={!!modal}
        title="Confirm live awareness"
        confirmLabel="I understand — approve"
        danger
        onClose={() => {
          setModal(null);
          setAck(false);
        }}
        onConfirm={() => void approve()}
      >
        <p>I understand this is a live trade path and profit is not guaranteed.</p>
        <label style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', color: tradeos.text }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          I confirm RiskGuard and the order desk still apply.
        </label>
      </PremiumModal>
    </div>
  );
}

async function fetchApprove(id: string, approve: boolean) {
  const token = localStorage.getItem('authToken');
  await fetch(`${API_BASE_URL}/strategy-approvals/${id}/${approve ? 'approve' : 'reject'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: '{}'
  });
  void executionGovernanceApi;
}
