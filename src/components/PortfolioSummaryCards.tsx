import { motion } from 'motion/react';
import { Wallet, TrendingUp, Users, Zap } from 'lucide-react';
import { Badge } from './ui/badge';

const portfolioSummary = [
  {
    title: 'Total AUM',
    value: '₹76.2L',
    subtitle: 'Across 3 portfolios',
    icon: Wallet,
    color: 'cyan'
  },
  {
    title: 'Combined Returns',
    value: '+28.4%',
    subtitle: 'YTD Performance',
    icon: TrendingUp,
    color: 'green'
  },
  {
    title: 'Active Accounts',
    value: '3',
    subtitle: 'Connected brokers',
    icon: Users,
    color: 'blue'
  },
  {
    title: 'Live Strategies',
    value: '8',
    subtitle: 'Auto-executing',
    icon: Zap,
    color: 'orange'
  }
];

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

export function PortfolioSummaryCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {portfolioSummary.map((item, index) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={`bg-gradient-to-br ${colorClasses[item.color as keyof typeof colorClasses]} border rounded-xl p-4 shadow-lg`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300 text-sm">{item.title}</span>
            <item.icon className={`w-5 h-5 ${iconColorClasses[item.color as keyof typeof iconColorClasses]}`} />
          </div>
          <div className={`text-2xl ${iconColorClasses[item.color as keyof typeof iconColorClasses]} mb-1`}>
            {item.value}
          </div>
          <div className="text-xs text-gray-500">{item.subtitle}</div>
        </motion.div>
      ))}
    </div>
  );
}
