import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { executionGovernanceApi } from '@/api/executionGovernance';
import { AlgoCard, PageHero, SafetyBanner, StatusPill } from '@/components/tradeos';
import { tradeos } from '@/components/tradeos/tokens';

const CATALOG = [
  { id: 'tradingview_alert_to_paper', name: 'TradingView Alert-to-Algo', bestFor: 'Alert-driven paper workflows', risk: 'Low' },
  { id: 'vwap_intraday', name: 'VWAP Intraday', bestFor: 'Intraday mean levels', risk: 'Medium' },
  { id: 'rsi_mean_reversion', name: 'RSI Mean Reversion', bestFor: 'Sideways markets', risk: 'Medium' },
  { id: 'moving_average_crossover', name: 'Moving Average Crossover', bestFor: 'Trend confirmation', risk: 'Low' },
  { id: 'supertrend', name: 'Supertrend', bestFor: 'Directional swings', risk: 'Medium' },
  { id: 'opening_range_breakout', name: 'Opening Range Breakout', bestFor: 'First-hour momentum', risk: 'Medium' },
  { id: 'long_call_limited_premium', name: 'Long Call / Long Put', bestFor: 'Defined premium risk', risk: 'Medium' },
  { id: 'covered_call', name: 'Covered Call', bestFor: 'Income on holdings', risk: 'Medium' },
  { id: 'basket_order_algo', name: 'Basket Order Algo', bestFor: 'Multi-leg portfolios', risk: 'Medium' },
  { id: 'portfolio_rebalancing', name: 'Portfolio Rebalancing', bestFor: 'Allocation drift', risk: 'Low' },
  { id: 'martingale', name: 'Martingale', bestFor: 'Blocked', risk: 'High', locked: true },
  { id: 'naked_options', name: 'Naked Options', bestFor: 'Blocked', risk: 'High', locked: true }
];

export function AlgoLibraryPremium({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    void executionGovernanceApi.getRecommendedAlgos().then((r) => {
      const map: Record<string, number> = {};
      for (const a of (r.recommended as { algo_id?: string; total_score?: number }[]) || []) {
        if (a.algo_id) map[a.algo_id] = Number(a.total_score) || 0;
      }
      if (r.algo && r.score) {
        const hit = CATALOG.find((c) => c.name === r.algo);
        if (hit) map[hit.id] = Number(r.score);
      }
      setScores(map);
    });
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', color: tradeos.text }}>
      <PageHero
        title="Algo Library"
        subtitle="Pick a calm strategy. Paper test before live. No guaranteed profit — ever."
        right={<StatusPill label="Paper first" tone="safe" />}
      />
      <SafetyBanner tone="warning" title="Locked algos stay locked" body="Martingale, naked options, and heavy leverage stay blocked for safety." />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 14,
          marginTop: 16
        }}
      >
        {CATALOG.map((a) => (
          <AlgoCard
            key={a.id}
            name={a.name}
            bestFor={a.bestFor}
            risk={a.risk}
            mode={a.locked ? 'Blocked' : 'Paper or approved live'}
            score={scores[a.id]}
            locked={a.locked}
            lockReason="Blocked for beginner/moderate risk policy."
            onUse={() => {
              onNavigate?.('algo-suitability');
              sessionStorage.setItem('tradeos.algo', a.id);
            }}
            onPaper={() => onNavigate?.('papertrade-lab')}
            onWhy={() => toast.message(a.locked ? 'Ask DhanLaxmi why this is locked' : 'Open suitability for a plain-language score')}
          />
        ))}
      </div>
    </div>
  );
}
