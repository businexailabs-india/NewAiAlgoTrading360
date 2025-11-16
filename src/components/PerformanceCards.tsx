import { motion } from 'motion/react';
import { TrendingUp, Activity, DollarSign, PiggyBank } from 'lucide-react';

const performanceData = [
  {
    title: 'CAGR',
    metrics: [
      { label: '1Y', value: '24.5%' },
      { label: '3Y', value: '18.2%' },
      { label: '5Y', value: '15.8%' }
    ],
    icon: TrendingUp,
    color: 'cyan'
  },
  {
    title: 'Sharpe Ratio',
    value: '1.84',
    subtitle: 'Risk-adjusted return',
    icon: Activity,
    color: 'blue'
  },
  {
    title: 'Alpha / Beta',
    metrics: [
      { label: 'Alpha', value: '2.4%' },
      { label: 'Beta', value: '0.92' }
    ],
    icon: DollarSign,
    color: 'purple'
  },
  {
    title: 'Gains',
    metrics: [
      { label: 'Unrealized', value: '₹4.2L', positive: true },
      { label: 'Realized', value: '₹8.7L', positive: true }
    ],
    icon: PiggyBank,
    color: 'green'
  }
];

const colorClasses = {
  cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
  blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/30',
  green: 'from-green-500/20 to-green-600/5 border-green-500/30'
};

const iconColorClasses = {
  cyan: 'text-cyan-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  green: 'text-green-400'
};

export function PerformanceCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {performanceData.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`bg-gradient-to-br ${colorClasses[card.color as keyof typeof colorClasses]} border rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-shadow`}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-300">{card.title}</h3>
            <card.icon className={`w-5 h-5 ${iconColorClasses[card.color as keyof typeof iconColorClasses]}`} />
          </div>
          
          {card.value && (
            <div>
              <div className={`text-3xl ${iconColorClasses[card.color as keyof typeof iconColorClasses]}`}>{card.value}</div>
              {card.subtitle && <div className="text-sm text-gray-500 mt-1">{card.subtitle}</div>}
            </div>
          )}
          
          {card.metrics && (
            <div className="space-y-2">
              {card.metrics.map((metric) => (
                <div key={metric.label} className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">{metric.label}</span>
                  <span className={`${metric.positive ? 'text-green-400' : 'text-white'}`}>{metric.value}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
