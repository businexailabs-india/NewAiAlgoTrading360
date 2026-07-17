import { motion } from 'motion/react';
import { TrendingUp, Activity, DollarSign, PiggyBank } from 'lucide-react';

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

interface PerformanceCardsProps {
  data?: PerformanceCard[];
}

const emptyPerformanceData: PerformanceCard[] = [
  {
    title: 'CAGR',
    metrics: [
      { label: '1Y', value: '—' },
      { label: '3Y', value: '—' },
      { label: '5Y', value: '—' }
    ],
    icon: TrendingUp,
    color: 'cyan'
  },
  {
    title: 'Sharpe Ratio',
    value: '—',
    subtitle: 'Risk-adjusted return',
    icon: Activity,
    color: 'blue'
  },
  {
    title: 'Alpha / Beta',
    metrics: [
      { label: 'Alpha', value: '—' },
      { label: 'Beta', value: '—' }
    ],
    icon: DollarSign,
    color: 'purple'
  },
  {
    title: 'Gains',
    metrics: [
      { label: 'Unrealized', value: '—' },
      { label: 'Realized', value: '—' }
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

export function PerformanceCards({ data }: PerformanceCardsProps) {
  const performanceData = data && data.length > 0 ? data : emptyPerformanceData;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {performanceData.map((card, index) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`bg-gradient-to-br ${colorClasses[card.color]} border rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-shadow`}
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
