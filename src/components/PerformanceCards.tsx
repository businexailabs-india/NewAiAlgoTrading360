import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Activity, DollarSign, PiggyBank, Loader2 } from 'lucide-react';
import { portfolioService } from '../services/portfolioService';
import { API_BASE_URL } from '@/lib/api';

interface PerformanceMetric {
  label: string;
  value: string;
  positive?: boolean;
}

interface PerformanceCard {
  title: string;
  value?: string;
  subtitle?: string;
  metrics?: PerformanceMetric[];
  icon: typeof TrendingUp;
  color: 'cyan' | 'blue' | 'purple' | 'green';
}

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

const colorClasses = {
  cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
  green: 'from-green-500/20 to-green-600/5 border-green-500/30',
};

const iconColorClasses = {
  cyan: 'text-cyan-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  green: 'text-green-400',
};

export function PerformanceCards({ data }: { data?: PerformanceCard[] }) {
  const [cards, setCards] = useState<PerformanceCard[] | null>(data?.length ? data : null);
  const [loading, setLoading] = useState(!data?.length);

  useEffect(() => {
    if (data?.length) {
      setCards(data);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [summary, advanced, paperRes] = await Promise.all([
          portfolioService.getSummary().catch(() => null),
          portfolioService.getAdvancedMetrics('1Y').catch(() => null),
          fetch(`${API_BASE_URL}/paper/account`, { headers: authHeaders() })
            .then((r) => r.json())
            .catch(() => null),
        ]);

        const stats = advanced?.data?.multiPeriodStats;
        const y1 = stats?.['1Y'];
        const y2 = stats?.['2Y'];
        const m6 = stats?.['6M'];
        const paperRealized = Number(paperRes?.data?.realizedPnl ?? 0);
        const unrealized = Number(summary?.totalPnL ?? 0);

        const next: PerformanceCard[] = [
          {
            title: 'Return periods',
            metrics: [
              {
                label: '6M',
                value: m6?.avgReturn != null ? `${m6.avgReturn.toFixed(1)}%` : '—',
                positive: (m6?.avgReturn ?? 0) >= 0,
              },
              {
                label: '1Y',
                value: y1?.avgReturn != null ? `${y1.avgReturn.toFixed(1)}%` : summary
                  ? `${Number(summary.totalPnLPercent || 0).toFixed(1)}%`
                  : '—',
                positive: (y1?.avgReturn ?? summary?.totalPnLPercent ?? 0) >= 0,
              },
              {
                label: '2Y',
                value: y2?.avgReturn != null ? `${y2.avgReturn.toFixed(1)}%` : '—',
                positive: (y2?.avgReturn ?? 0) >= 0,
              },
            ],
            icon: TrendingUp,
            color: 'cyan',
          },
          {
            title: 'Sharpe / Win rate',
            metrics: [
              {
                label: 'Sharpe (1Y)',
                value: y1?.sharpe != null ? y1.sharpe.toFixed(2) : '—',
              },
              {
                label: 'Win rate',
                value: y1?.winRate != null ? `${y1.winRate.toFixed(0)}%` : '—',
              },
              {
                label: 'Trades',
                value: y1?.trades != null ? String(y1.trades) : '—',
              },
            ],
            icon: Activity,
            color: 'blue',
          },
          {
            title: 'Risk',
            metrics: [
              {
                label: 'Max DD (1Y)',
                value: y1?.maxDrawdown != null ? `${y1.maxDrawdown.toFixed(1)}%` : '—',
              },
              {
                label: 'Holdings',
                value: summary ? String(summary.holdingsCount) : '—',
              },
              {
                label: 'Brokers',
                value: summary ? String(summary.activeBrokers) : '—',
              },
            ],
            icon: DollarSign,
            color: 'purple',
          },
          {
            title: 'Gains',
            metrics: [
              {
                label: 'Unrealized',
                value: inr(unrealized),
                positive: unrealized >= 0,
              },
              {
                label: 'Paper realized',
                value: inr(paperRealized),
                positive: paperRealized >= 0,
              },
              {
                label: 'Invested',
                value: summary ? inr(summary.totalInvested) : '—',
              },
            ],
            icon: PiggyBank,
            color: 'green',
          },
        ];

        if (!cancelled) setCards(next);
      } catch {
        if (!cancelled) setCards(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  const performanceData = cards?.length
    ? cards
    : [
        {
          title: 'Return periods',
          metrics: [
            { label: '6M', value: '—' },
            { label: '1Y', value: '—' },
            { label: '2Y', value: '—' },
          ],
          icon: TrendingUp,
          color: 'cyan' as const,
        },
      ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {performanceData.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08 }}
          className={`bg-gradient-to-br ${colorClasses[card.color]} border rounded-2xl p-5 shadow-xl`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-300">{card.title}</h3>
            <card.icon className={`w-5 h-5 ${iconColorClasses[card.color]}`} />
          </div>

          {card.value && (
            <div>
              <div className={`text-3xl ${iconColorClasses[card.color]}`}>{card.value}</div>
              {card.subtitle && <div className="text-sm text-gray-500 mt-1">{card.subtitle}</div>}
            </div>
          )}

          {card.metrics && (
            <div className="space-y-2">
              {card.metrics.map((metric) => (
                <div key={metric.label} className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{metric.label}</span>
                  <span className={metric.positive ? 'text-green-400' : 'text-white'}>{metric.value}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
