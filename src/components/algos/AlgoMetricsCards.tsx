import type { CSSProperties } from 'react';
import type { AlgoCatalogItem } from './algosCatalog';
import { formatInr, pctColor } from './algosCatalog';

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: color || '#e2e8f0' }}>{value}</div>
    </div>
  );
}

export function AlgoMetricsCards({ algo }: { algo: AlgoCatalogItem }) {
  const returns = [
    { label: '1 month', pct: algo.returns1m, amt: (algo.minCapital * algo.returns1m) / 100 },
    { label: '3 months', pct: algo.returns3m, amt: (algo.minCapital * algo.returns3m) / 100 },
    { label: '6 months', pct: algo.returns6m, amt: (algo.minCapital * algo.returns6m) / 100 },
    { label: '1 year', pct: algo.returns1y, amt: (algo.minCapital * algo.returns1y) / 100 },
    { label: '3 years', pct: null as number | null, amt: null as number | null },
    { label: 'All time', pct: algo.cumulativeReturn, amt: (algo.minCapital * algo.cumulativeReturn) / 100 }
  ];

  const card: CSSProperties = {
    background: 'rgba(15,23,42,0.75)',
    border: '1px solid rgba(34,211,238,0.2)',
    borderRadius: 12,
    padding: 16
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Performance in Returns</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {returns.map((r) => (
              <Metric
                key={r.label}
                label={r.label}
                value={r.pct == null ? '— —' : `${formatInr(r.amt || 0)} (${r.pct.toFixed(2)}%)`}
                color={r.pct == null ? '#64748b' : pctColor(r.pct)}
              />
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Performance in %</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Metric label="Cumulative Return" value={`${algo.cumulativeReturn.toFixed(2)}%`} color={pctColor(algo.cumulativeReturn)} />
            <Metric label="CAGR %" value={`${algo.cagr.toFixed(2)}%`} color={pctColor(algo.cagr)} />
            <Metric label="Avg. Up Month" value={`${algo.avgUpMonth.toFixed(2)}%`} color={pctColor(algo.avgUpMonth)} />
            <Metric label="Avg. Down Month" value={`${algo.avgDownMonth.toFixed(2)}%`} color={pctColor(algo.avgDownMonth)} />
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Characteristics of this Algo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            ['Built on', algo.builtOn],
            ['Operates on', algo.underlying],
            ['Segment', algo.segment],
            ['Works in', algo.worksIn],
            ['Trade Type', algo.tradeType]
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
              <div style={{ fontWeight: 600, color: '#e2e8f0', marginTop: 4 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Algo Trade Metrics</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <Metric label="Avg Frequency" value={`${algo.avgTradesPerWeek} trades/week`} />
          <Metric label="Success Ratio" value={`${algo.successRatio.toFixed(2)}%`} color={pctColor(algo.successRatio)} />
          <Metric label="Avg Profit" value={`${algo.avgProfit.toFixed(2)}%`} color={pctColor(algo.avgProfit)} />
          <Metric label="Avg Loss" value={`${algo.avgLoss.toFixed(2)}%`} color={pctColor(algo.avgLoss)} />
          <Metric label="Risk" value={algo.risk} color={algo.risk === 'High' ? '#f87171' : algo.risk === 'Medium' ? '#fbbf24' : '#34d399'} />
          <Metric label="Avg Recovery" value={`${algo.recoveryDays} days`} />
          <Metric label="Max Recovery" value={`${algo.maxRecoveryDays} days`} />
          <Metric label="Volatility" value={`${algo.volatility.toFixed(2)}%`} />
          <Metric label="Max DD" value={`${algo.maxDd.toFixed(2)}%`} color={pctColor(algo.maxDd)} />
          <Metric label="Risk:Reward" value={algo.riskReward} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Consistency Metrics</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            <Metric label="Win Days" value={`${algo.winDays.toFixed(2)}%`} color={pctColor(1)} />
            <Metric label="Win Months" value={`${algo.winMonths.toFixed(2)}%`} color={pctColor(1)} />
            <Metric label="Win Quarters" value={`${algo.winQuarters.toFixed(2)}%`} color={pctColor(1)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
            <span>Max Consecutive Wins · {algo.maxWinStreak} times</span>
            <span>Max Consecutive Losses · {algo.maxLossStreak} times</span>
          </div>
          <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ flex: algo.maxWinStreak, background: '#34d399' }} />
            <div style={{ flex: algo.maxLossStreak, background: '#f87171' }} />
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#f1f5f9' }}>Efficiency Ratios</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Metric label="Sharpe" value={algo.sharpe.toFixed(2)} />
            <Metric label="Sortino" value={algo.sortino.toFixed(2)} />
            <Metric label="Calmar" value={algo.calmar.toFixed(2)} />
            <Metric label="Alpha" value={algo.alpha.toFixed(2)} />
          </div>
        </div>
      </div>
    </div>
  );
}
