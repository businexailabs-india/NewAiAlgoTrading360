import { useState, type CSSProperties } from 'react';
import { BarChart3, FileText, Radio } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CurvePoint {
  date: string;
  value: number;
}

interface MetricRow {
  label: string;
  backtest: string;
  paper: string;
  live: string;
}

interface TradingTabsProps {
  backtestData?: CurvePoint[];
  performanceMetrics?: MetricRow[];
}

const emptyMetrics: MetricRow[] = [
  { label: 'Annualized Return', backtest: '—', paper: '—', live: '—' },
  { label: 'Sharpe Ratio', backtest: '—', paper: '—', live: '—' },
  { label: 'Max Drawdown', backtest: '—', paper: '—', live: '—' },
  { label: 'Win Rate', backtest: '—', paper: '—', live: '—' }
];

const tabBtn = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12,
  border: active ? '1px solid rgba(52,211,153,0.55)' : '1px solid rgba(148,163,184,0.2)',
  background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
  color: active ? '#6ee7b7' : '#94a3b8',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
});

function EmptyChart({ title }: { title: string }) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 12 }}>{title}</h3>
      <div
        style={{
          height: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#64748b',
          fontSize: 13,
          borderRadius: 12,
          border: '1px dashed rgba(148,163,184,0.25)',
          background: 'rgba(2,6,23,0.35)',
        }}
      >
        No data available
      </div>
    </div>
  );
}

function CurveChart({ data, gradientId, stroke }: { data: CurvePoint[]; gradientId: string; stroke: string }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={stroke} stopOpacity={0.3} />
            <stop offset="95%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="date" stroke="#94a3b8" />
        <YAxis stroke="#94a3b8" />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(34,211,238,0.28)',
            borderRadius: 8,
          }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Area type="monotone" dataKey="value" stroke={stroke} strokeWidth={2} fillOpacity={1} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MetricCards({ metrics, valueKey }: { metrics: MetricRow[]; valueKey: 'backtest' | 'paper' | 'live' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
      {metrics.map((metric) => (
        <div
          key={metric.label}
          style={{
            borderRadius: 10,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(2,6,23,0.4)',
            padding: 12,
          }}
        >
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{metric.label}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#e2e8f0', marginTop: 4 }}>{metric[valueKey]}</div>
        </div>
      ))}
    </div>
  );
}

export function TradingTabs({ backtestData = [], performanceMetrics = emptyMetrics }: TradingTabsProps) {
  const [activeTab, setActiveTab] = useState<'backtest' | 'paper' | 'live'>('backtest');
  const metrics = performanceMetrics.length > 0 ? performanceMetrics : emptyMetrics;
  const hasCurve = backtestData.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 420 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 16, color: '#f1f5f9' }}>Trading Desk</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          Same format as Trading / Investing Algos · backtest · paper · live
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => setActiveTab('backtest')} style={tabBtn(activeTab === 'backtest')}>
          <BarChart3 className="h-3.5 w-3.5" /> Backtest
        </button>
        <button type="button" onClick={() => setActiveTab('paper')} style={tabBtn(activeTab === 'paper')}>
          <FileText className="h-3.5 w-3.5" /> Paper Trade
        </button>
        <button type="button" onClick={() => setActiveTab('live')} style={tabBtn(activeTab === 'live')}>
          <Radio className="h-3.5 w-3.5" /> Live
        </button>
      </div>

      {activeTab === 'backtest' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasCurve ? (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 12 }}>
                QuantConnect Backtest Results
              </h3>
              <CurveChart data={backtestData} gradientId="colorValue" stroke="#67e8f9" />
            </div>
          ) : (
            <EmptyChart title="QuantConnect Backtest Results" />
          )}
          <MetricCards metrics={metrics} valueKey="backtest" />
        </div>
      )}

      {activeTab === 'paper' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {hasCurve ? (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 12 }}>
                Paper Trading Performance
              </h3>
              <CurveChart data={backtestData} gradientId="colorPaper" stroke="#38bdf8" />
            </div>
          ) : (
            <EmptyChart title="Paper Trading Performance" />
          )}
          <MetricCards metrics={metrics} valueKey="paper" />
        </div>
      )}

      {activeTab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: '#34d399' }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Live Trading (Active)</h3>
          </div>
          {hasCurve ? (
            <CurveChart data={backtestData} gradientId="colorLive" stroke="#34d399" />
          ) : (
            <div
              style={{
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: 13,
                borderRadius: 12,
                border: '1px dashed rgba(148,163,184,0.25)',
                background: 'rgba(2,6,23,0.35)',
              }}
            >
              No data available
            </div>
          )}
          <MetricCards metrics={metrics} valueKey="live" />
        </div>
      )}

      <div
        style={{
          borderRadius: 12,
          border: '1px solid rgba(34,211,238,0.22)',
          background: 'rgba(15,23,42,0.7)',
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 12 }}>Performance Comparison</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: 8,
            padding: '8px 10px',
            fontSize: 11,
            color: '#64748b',
            borderBottom: '1px solid rgba(148,163,184,0.2)',
          }}
        >
          <span>Metric</span>
          <span style={{ textAlign: 'right' }}>Backtest</span>
          <span style={{ textAlign: 'right' }}>Paper</span>
          <span style={{ textAlign: 'right' }}>Live</span>
        </div>
        {metrics.map((metric) => (
          <div
            key={metric.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              gap: 8,
              padding: '12px 10px',
              borderBottom: '1px solid rgba(148,163,184,0.12)',
              color: '#e2e8f0',
              fontSize: 13,
            }}
          >
            <span style={{ color: '#cbd5e1' }}>{metric.label}</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>{metric.backtest}</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>{metric.paper}</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>{metric.live}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
