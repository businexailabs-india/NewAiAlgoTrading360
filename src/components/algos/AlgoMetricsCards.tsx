import type { CSSProperties } from 'react';
import type { AlgoCatalogItem } from './algosCatalog';
import { formatInr, pctColor } from './algosCatalog';
import { useTheme } from '../../contexts/ThemeContext';

function n(v: unknown, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function Metric({ label, value, color, muted, ink }: { label: string; value: string; color?: string; muted: string; ink: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: color || ink }}>{value}</div>
    </div>
  );
}

export function AlgoMetricsCards({ algo }: { algo: AlgoCatalogItem }) {
  const { theme } = useTheme();
  const light = theme === 'light';
  const ink = light ? '#0f172a' : '#e2e8f0';
  const muted = light ? '#64748b' : '#94a3b8';
  const title = light ? '#0f172a' : '#f1f5f9';
  const returns = [
    { label: '1 month', pct: n(algo.returns1m), amt: (n(algo.minCapital) * n(algo.returns1m)) / 100 },
    { label: '3 months', pct: n(algo.returns3m), amt: (n(algo.minCapital) * n(algo.returns3m)) / 100 },
    { label: '6 months', pct: n(algo.returns6m), amt: (n(algo.minCapital) * n(algo.returns6m)) / 100 },
    { label: '1 year', pct: n(algo.returns1y), amt: (n(algo.minCapital) * n(algo.returns1y)) / 100 },
    { label: '3 years', pct: null as number | null, amt: null as number | null },
    { label: 'All time', pct: n(algo.cumulativeReturn), amt: (n(algo.minCapital) * n(algo.cumulativeReturn)) / 100 }
  ];

  const card: CSSProperties = {
    background: light ? '#ffffff' : 'rgba(15,23,42,0.75)',
    border: light ? '1px solid #e2e8f0' : '1px solid rgba(34,211,238,0.2)',
    borderRadius: 12,
    padding: 16
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: title }}>Performance in Returns</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {returns.map((r) => (
              <Metric
                key={r.label}
                muted={muted}
                ink={ink}
                label={r.label}
                value={r.pct == null ? '— —' : `${formatInr(r.amt || 0)} (${r.pct.toFixed(2)}%)`}
                color={r.pct == null ? '#64748b' : pctColor(r.pct)}
              />
            ))}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: title }}>Performance in %</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Metric muted={muted} ink={ink} label="Cumulative Return" value={`${n(algo.cumulativeReturn).toFixed(2)}%`} color={pctColor(n(algo.cumulativeReturn))} />
            <Metric muted={muted} ink={ink} label="CAGR %" value={`${n(algo.cagr).toFixed(2)}%`} color={pctColor(n(algo.cagr))} />
            <Metric muted={muted} ink={ink} label="Avg. Up Month" value={`${n(algo.avgUpMonth).toFixed(2)}%`} color={pctColor(n(algo.avgUpMonth))} />
            <Metric muted={muted} ink={ink} label="Avg. Down Month" value={`${n(algo.avgDownMonth).toFixed(2)}%`} color={pctColor(n(algo.avgDownMonth))} />
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: title }}>Characteristics of this Algo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            ['Built on', algo.builtOn],
            ['Operates on', algo.underlying],
            ['Segment', algo.segment],
            ['Works in', algo.worksIn],
            ['Trade Type', algo.tradeType]
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: muted }}>{label}</div>
              <div style={{ fontWeight: 600, color: ink, marginTop: 4 }}>{value || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12, color: title }}>Algo Trade Metrics</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <Metric muted={muted} ink={ink} label="Avg Frequency" value={`${n(algo.avgTradesPerWeek)} trades/week`} />
          <Metric muted={muted} ink={ink} label="Success Ratio" value={`${n(algo.successRatio).toFixed(2)}%`} color={pctColor(n(algo.successRatio))} />
          <Metric muted={muted} ink={ink} label="Avg Profit" value={`${n(algo.avgProfit).toFixed(2)}%`} color={pctColor(n(algo.avgProfit))} />
          <Metric muted={muted} ink={ink} label="Avg Loss" value={`${n(algo.avgLoss).toFixed(2)}%`} color={pctColor(n(algo.avgLoss))} />
          <Metric muted={muted} ink={ink} label="Risk" value={algo.risk || 'Low'} color={algo.risk === 'High' ? '#f87171' : algo.risk === 'Medium' ? '#fbbf24' : '#34d399'} />
          <Metric muted={muted} ink={ink} label="Avg Recovery" value={`${n(algo.recoveryDays)} days`} />
          <Metric muted={muted} ink={ink} label="Max Recovery" value={`${n(algo.maxRecoveryDays)} days`} />
          <Metric muted={muted} ink={ink} label="Volatility" value={`${n(algo.volatility).toFixed(2)}%`} />
          <Metric muted={muted} ink={ink} label="Max DD" value={`${n(algo.maxDd).toFixed(2)}%`} color={pctColor(n(algo.maxDd))} />
          <Metric muted={muted} ink={ink} label="Risk:Reward" value={algo.riskReward || '—'} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: title }}>Consistency Metrics</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            <Metric muted={muted} ink={ink} label="Win Days" value={`${n(algo.winDays).toFixed(2)}%`} color={pctColor(1)} />
            <Metric muted={muted} ink={ink} label="Win Months" value={`${n(algo.winMonths).toFixed(2)}%`} color={pctColor(1)} />
            <Metric muted={muted} ink={ink} label="Win Quarters" value={`${n(algo.winQuarters).toFixed(2)}%`} color={pctColor(1)} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: muted, marginBottom: 6 }}>
            <span>Max Consecutive Wins · {n(algo.maxWinStreak)} times</span>
            <span>Max Consecutive Losses · {n(algo.maxLossStreak)} times</span>
          </div>
          <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ flex: algo.maxWinStreak, background: '#34d399' }} />
            <div style={{ flex: algo.maxLossStreak, background: '#f87171' }} />
          </div>
        </div>
        <div style={card}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: title }}>Efficiency Ratios</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Metric muted={muted} ink={ink} label="Sharpe" value={n(algo.sharpe).toFixed(2)} />
            <Metric muted={muted} ink={ink} label="Sortino" value={n(algo.sortino).toFixed(2)} />
            <Metric muted={muted} ink={ink} label="Calmar" value={n(algo.calmar).toFixed(2)} />
            <Metric muted={muted} ink={ink} label="Alpha" value={n(algo.alpha).toFixed(2)} />
          </div>
        </div>
      </div>
    </div>
  );
}
