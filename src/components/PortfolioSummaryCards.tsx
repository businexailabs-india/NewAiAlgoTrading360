import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Wallet, TrendingUp, Users, Zap, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';
import { API_BASE_URL } from '../lib/api';

interface SummaryData {
  totalInvested: number;
  totalCurrent: number;
  totalPnL: number;
  totalPnLPercent: number;
  holdingsCount: number;
  activeBrokers: number;
  liveStrategies: number;
}

const colorClasses = {
  cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
  green: 'from-green-500/20 to-green-600/5 border-green-500/30',
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  orange: 'from-orange-500/20 to-orange-600/5 border-orange-500/30'
};

const iconColorClasses = {
  cyan: 'text-cyan-400',
  green: 'text-green-400',
  blue: 'text-blue-400',
  orange: 'text-orange-400'
};

function formatINR(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

export function PortfolioSummaryCards() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE_URL}/portfolio/summary`, {
      headers: { Authorization: `Bearer ${authService.getToken()}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setSummary(data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const portfolioSummary = summary ? [
    {
      title: 'Total AUM',
      value: formatINR(summary.totalCurrent),
      subtitle: `Invested ${formatINR(summary.totalInvested)}`,
      icon: Wallet,
      color: 'cyan' as const
    },
    {
      title: 'Combined Returns',
      value: `${summary.totalPnLPercent >= 0 ? '+' : ''}${summary.totalPnLPercent.toFixed(1)}%`,
      subtitle: `P&L ${formatINR(summary.totalPnL)}`,
      icon: TrendingUp,
      color: 'green' as const
    },
    {
      title: 'Active Accounts',
      value: String(summary.activeBrokers),
      subtitle: `${summary.holdingsCount} holdings`,
      icon: Users,
      color: 'blue' as const
    },
    {
      title: 'Live Engines',
      value: String(summary.liveStrategies),
      subtitle: 'Deployed predictions',
      icon: Zap,
      color: 'orange' as const
    }
  ] : [
    { title: 'Total AUM', value: '—', subtitle: 'Connect broker to sync', icon: Wallet, color: 'cyan' as const },
    { title: 'Combined Returns', value: '—', subtitle: 'No data yet', icon: TrendingUp, color: 'green' as const },
    { title: 'Active Accounts', value: '—', subtitle: 'Connect a broker', icon: Users, color: 'blue' as const },
    { title: 'Live Engines', value: '—', subtitle: 'No data yet', icon: Zap, color: 'orange' as const }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {loading ? (
        <div className="col-span-4 flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      ) : (
        portfolioSummary.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`bg-gradient-to-br ${colorClasses[item.color]} border rounded-xl p-4 shadow-lg`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{item.title}</span>
              <item.icon className={`w-5 h-5 ${iconColorClasses[item.color]}`} />
            </div>
            <div className="text-2xl text-white mb-1">{item.value}</div>
            <div className="text-xs text-gray-500">{item.subtitle}</div>
          </motion.div>
        ))
      )}
    </div>
  );
}
