import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Layers,
  LineChart,
  Shield,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react';
import type { AlgoCatalogItem } from './algosCatalog';
import { formatInr, pctColor } from './algosCatalog';
import { useTradingDashboard } from '../../hooks/useTradingDashboard';
import { portfolioService } from '../../services/portfolioService';
import { FundTransferModal } from './FundTransferModal';

const DISCOVER = [
  { id: 'equity_swing', label: 'Equity Swing', icon: TrendingUp, tab: 'investing' as const },
  { id: 'equity_long', label: 'Equity Long Term', icon: BarChart3, tab: 'investing' as const },
  { id: 'option_buy', label: 'Options Buying', icon: Activity, tab: 'trading' as const },
  { id: 'option_sell', label: 'Options Selling', icon: LineChart, tab: 'trading' as const },
  { id: 'hedged', label: 'Hedged Options', icon: Shield, tab: 'trading' as const },
  { id: 'all', label: 'All Algos', icon: Layers, tab: 'trading' as const }
];

export function AlgosHome({
  items,
  usedDemo,
  onNavigate,
  onSelectAlgo
}: {
  items: AlgoCatalogItem[];
  usedDemo: boolean;
  onNavigate: (tab: string) => void;
  onSelectAlgo: (algo: AlgoCatalogItem) => void;
}) {
  const { summary, loading } = useTradingDashboard();
  const [allocated, setAllocated] = useState<number | null>(null);
  const [availableCash, setAvailableCash] = useState<number | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundMode, setFundMode] = useState<'add' | 'withdraw'>('add');
  const featured = items.filter((a) => a.lane === 'trading').slice(0, 4);
  const gainers = [...items].sort((a, b) => b.returns1m - a.returns1m).slice(0, 5);
  const losers = [...items].sort((a, b) => a.returns1m - b.returns1m).slice(0, 5);
  const [moversTab, setMoversTab] = useState<'gainers' | 'losers'>('gainers');
  const movers = moversTab === 'gainers' ? gainers : losers;

  const refreshCapital = useCallback(() => {
    Promise.allSettled([portfolioService.getSummary(), portfolioService.getFunds()]).then(
      ([summaryResult, fundsResult]) => {
        if (summaryResult.status === 'fulfilled') {
          const s = summaryResult.value;
          const cash = Number(s.availableCash ?? 0);
          const holdings = Number(s.totalCurrent ?? 0);
          setAllocated(Number(s.capitalAllocated ?? cash + holdings));
        } else {
          setAllocated(null);
        }
        if (fundsResult.status === 'fulfilled') {
          setAvailableCash(fundsResult.value.availableCash);
        } else {
          setAvailableCash(null);
        }
      }
    );
  }, []);

  useEffect(() => {
    refreshCapital();
  }, [refreshCapital]);

  const metrics = [
    ['Capital Allocated', allocated != null ? formatInr(allocated) : '—'],
    ['Available Cash', availableCash != null ? formatInr(availableCash) : '—'],
    ["Today's P&L", summary ? `₹${Number(summary.totalPnL).toLocaleString('en-IN')}` : '—'],
    ['Trading Now', String(summary?.activeAgents ?? 0)],
    ['Subscribed to', String(items.filter((i) => !i.isDemo).length || items.length)]
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(34,211,238,0.22)',
            background: 'rgba(15,23,42,0.7)',
            padding: 14,
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {(
              [
                ['home', 'All', items.length],
                ['trading', 'Trading Algos', items.filter((i) => i.lane === 'trading').length],
                ['investing', 'Investing Algos', items.filter((i) => i.lane === 'investing').length]
              ] as const
            ).map(([tab, label, count]) => (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(tab === 'home' ? 'home' : tab)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'rgba(2,6,23,0.35)',
                  color: '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                {label} <span style={{ color: '#67e8f9' }}>{count}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {metrics.map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginTop: 4 }}>{loading ? '…' : value}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(2,6,23,0.45)',
              fontSize: 12,
              color: '#94a3b8'
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Wallet className="h-3.5 w-3.5 text-cyan-300" />
              Open Positions · Available cash · Paper-first by default
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setFundMode('add');
                  setFundOpen(true);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#059669',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                + Add Fund
              </button>
              <button
                type="button"
                onClick={() => {
                  setFundMode('withdraw');
                  setFundOpen(true);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(248,113,113,0.4)',
                  background: 'rgba(127,29,29,0.25)',
                  color: '#fecaca',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Withdraw Fund
              </button>
              <button
                type="button"
                onClick={() => onNavigate('my')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(34,211,238,0.35)',
                  background: 'rgba(34,211,238,0.1)',
                  color: '#67e8f9',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                My Algos
              </button>
            </div>
          </div>

          <FundTransferModal
            open={fundOpen}
            initialMode={fundMode}
            onClose={() => setFundOpen(false)}
            onDone={() => refreshCapital()}
          />
          {usedDemo && (
            <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24' }}>
              Showing demo catalog until advisory/strategy APIs return live algos.
            </div>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles className="h-4 w-4 text-cyan-300" /> Discover Algos
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 10,
              width: '100%'
            }}
          >
            {DISCOVER.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onNavigate(d.tab)}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid rgba(34,211,238,0.2)',
                    background: 'rgba(15,23,42,0.65)',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%'
                  }}
                >
                  <Icon className="h-5 w-5 text-cyan-300 mb-2" />
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{d.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ width: '100%' }}>
          <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 10 }}>Featured Algos for Trading</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {featured.map((algo) => (
              <button
                key={algo.id}
                type="button"
                onClick={() => onSelectAlgo(algo)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: 'rgba(2,6,23,0.4)',
                  cursor: 'pointer',
                  color: '#e2e8f0',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{algo.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{algo.subtitle}</div>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>from {formatInr(algo.minCapital)}</div>
              </button>
            ))}
          </div>
        </div>

      <aside
        style={{
          borderRadius: 12,
          border: '1px solid rgba(34,211,238,0.2)',
          background: 'rgba(15,23,42,0.7)',
          padding: 12,
          width: '100%',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, maxWidth: 280 }}>
          {(
            [
              ['gainers', 'Gainers'],
              ['losers', 'Losers']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMoversTab(id)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 8,
                fontSize: 12,
                border: moversTab === id ? '1px solid rgba(52,211,153,0.5)' : '1px solid rgba(148,163,184,0.2)',
                background: moversTab === id ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: moversTab === id ? '#6ee7b7' : '#94a3b8',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 8,
            width: '100%'
          }}
        >
          {movers.map((algo) => (
            <button
              key={algo.id}
              type="button"
              onClick={() => onSelectAlgo(algo)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                padding: 10,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.15)',
                background: 'rgba(2,6,23,0.4)',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#e2e8f0',
                width: '100%'
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{algo.name}</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>{algo.tradeType}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: pctColor(algo.returns1m), display: 'flex', alignItems: 'center', gap: 2 }}>
                  {algo.returns1m >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {algo.returns1m >= 0 ? '+' : ''}
                  {algo.returns1m.toFixed(2)}%
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>last trading day</div>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
