import { useState } from 'react';
import { motion } from 'motion/react';
import { TrendingDown, Calendar, DollarSign, BarChart3, Activity, Target } from 'lucide-react';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';

interface AdvancedPerformanceMetricsProps {
  strategyId?: string;
}

// Heat map data for monthly returns
const generateHeatMapData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const years = ['2023', '2024'];
  
  return years.map(year => ({
    year,
    months: months.map(month => ({
      month,
      return: (Math.random() * 20 - 5).toFixed(2),
      trades: Math.floor(Math.random() * 50) + 10
    }))
  }));
};

// Multi-period performance data
const multiPeriodStats = {
  '6M': { winRate: 68.5, avgReturn: 12.4, sharpe: 1.85, maxDrawdown: -6.2, trades: 145 },
  '9M': { winRate: 71.2, avgReturn: 18.7, sharpe: 1.92, maxDrawdown: -8.1, trades: 218 },
  '1Y': { winRate: 69.8, avgReturn: 24.5, sharpe: 1.88, maxDrawdown: -9.5, trades: 289 },
  '2Y': { winRate: 72.1, avgReturn: 52.3, sharpe: 2.05, maxDrawdown: -12.3, trades: 612 }
};

// Drawdown analysis data
const drawdownData = [
  { period: 'Current', value: -2.3, duration: '5 days', recovery: 'In progress' },
  { period: 'Max (1Y)', value: -9.5, duration: '23 days', recovery: '45 days' },
  { period: 'Max (2Y)', value: -12.3, duration: '31 days', recovery: '67 days' },
  { period: 'Avg', value: -4.2, duration: '12 days', recovery: '28 days' }
];

// Tax impact analysis
const taxImpactData = {
  shortTermGains: 125000,
  longTermGains: 89000,
  shortTermTax: 18750, // 15% STCG
  longTermTax: 8900, // 10% LTCG above 1L
  totalTaxLiability: 27650,
  netReturns: 185350,
  effectiveTaxRate: 12.98
};

export function AdvancedPerformanceMetrics({ strategyId }: AdvancedPerformanceMetricsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'6M' | '9M' | '1Y' | '2Y'>('1Y');
  const heatMapData = generateHeatMapData();

  const getReturnColor = (returnValue: number) => {
    if (returnValue >= 5) return 'bg-green-500';
    if (returnValue >= 2) return 'bg-green-400';
    if (returnValue >= 0) return 'bg-green-300';
    if (returnValue >= -2) return 'bg-red-300';
    if (returnValue >= -5) return 'bg-red-400';
    return 'bg-red-500';
  };

  const getReturnOpacity = (returnValue: number) => {
    const absValue = Math.abs(returnValue);
    if (absValue >= 8) return 'opacity-100';
    if (absValue >= 5) return 'opacity-80';
    if (absValue >= 3) return 'opacity-60';
    return 'opacity-40';
  };

  return (
    <div className="space-y-6">
      {/* Multi-Period Performance Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white text-lg mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-400" />
          Multi-Period Win Statistics
        </h3>

        <div className="flex gap-2 mb-6 flex-wrap">
          {(['6M', '9M', '1Y', '2Y'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-lg transition-all ${
                selectedPeriod === period
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {period}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="text-xs text-gray-400 mb-1">Win Rate</div>
            <div className="text-2xl text-cyan-400 font-semibold">
              {multiPeriodStats[selectedPeriod].winRate}%
            </div>
          </Card>
          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="text-xs text-gray-400 mb-1">Avg Return</div>
            <div className="text-2xl text-green-400 font-semibold">
              +{multiPeriodStats[selectedPeriod].avgReturn}%
            </div>
          </Card>
          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="text-xs text-gray-400 mb-1">Sharpe Ratio</div>
            <div className="text-2xl text-purple-400 font-semibold">
              {multiPeriodStats[selectedPeriod].sharpe}
            </div>
          </Card>
          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="text-xs text-gray-400 mb-1">Max Drawdown</div>
            <div className="text-2xl text-red-400 font-semibold">
              {multiPeriodStats[selectedPeriod].maxDrawdown}%
            </div>
          </Card>
          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="text-xs text-gray-400 mb-1">Total Trades</div>
            <div className="text-2xl text-white font-semibold">
              {multiPeriodStats[selectedPeriod].trades}
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Heat Map */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white text-lg mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-400" />
          Monthly Returns Heat Map
        </h3>

        <div className="space-y-4">
          {heatMapData.map((yearData, yearIndex) => (
            <div key={yearData.year}>
              <div className="text-sm text-gray-400 mb-2 font-semibold">{yearData.year}</div>
              <div className="grid grid-cols-12 gap-2">
                {yearData.months.map((monthData, monthIndex) => {
                  const returnValue = parseFloat(monthData.return);
                  return (
                    <div
                      key={`${yearIndex}-${monthIndex}`}
                      className="group relative"
                    >
                      <div
                        className={`
                          aspect-square rounded-lg flex items-center justify-center
                          ${getReturnColor(returnValue)} ${getReturnOpacity(returnValue)}
                          hover:ring-2 hover:ring-white/50 transition-all cursor-pointer
                        `}
                      >
                        <span className="text-xs font-semibold text-white">
                          {monthData.month.slice(0, 1)}
                        </span>
                      </div>
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl whitespace-nowrap">
                          <div className="text-sm text-white font-semibold">{monthData.month} {yearData.year}</div>
                          <div className={`text-sm ${returnValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {returnValue >= 0 ? '+' : ''}{monthData.return}%
                          </div>
                          <div className="text-xs text-gray-400">{monthData.trades} trades</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-4 text-xs text-gray-400">
          <span>Returns:</span>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>&lt; -5%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-300 rounded"></div>
            <span>-2% to 0%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-300 rounded"></div>
            <span>0% to 2%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>&gt; 5%</span>
          </div>
        </div>
      </motion.div>

      {/* Drawdown Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white text-lg mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-red-400" />
          Drawdown Analysis
        </h3>

        <div className="space-y-3">
          {drawdownData.map((dd, index) => (
            <Card key={index} className="bg-gray-900/50 border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-400 mb-1">{dd.period}</div>
                  <div className="text-2xl text-red-400 font-semibold">{dd.value}%</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">Duration: {dd.duration}</div>
                  <div className="text-xs text-gray-500">Recovery: {dd.recovery}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Tax Impact Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white text-lg mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-yellow-400" />
          Tax Impact Analysis
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-400">Short-Term Gains</div>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                STCG (15%)
              </Badge>
            </div>
            <div className="text-2xl text-white font-semibold mb-1">
              ₹{taxImpactData.shortTermGains.toLocaleString()}
            </div>
            <div className="text-sm text-red-400">
              Tax: ₹{taxImpactData.shortTermTax.toLocaleString()}
            </div>
          </Card>

          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-400">Long-Term Gains</div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                LTCG (10%)
              </Badge>
            </div>
            <div className="text-2xl text-white font-semibold mb-1">
              ₹{taxImpactData.longTermGains.toLocaleString()}
            </div>
            <div className="text-sm text-red-400">
              Tax: ₹{taxImpactData.longTermTax.toLocaleString()}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-red-500/10 to-red-600/10 border-red-500/30 p-4">
            <div className="text-xs text-gray-400 mb-1">Total Tax Liability</div>
            <div className="text-2xl text-red-400 font-semibold">
              ₹{taxImpactData.totalTaxLiability.toLocaleString()}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/10 border-green-500/30 p-4">
            <div className="text-xs text-gray-400 mb-1">Net Returns (Post-Tax)</div>
            <div className="text-2xl text-green-400 font-semibold">
              ₹{taxImpactData.netReturns.toLocaleString()}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border-yellow-500/30 p-4">
            <div className="text-xs text-gray-400 mb-1">Effective Tax Rate</div>
            <div className="text-2xl text-yellow-400 font-semibold">
              {taxImpactData.effectiveTaxRate}%
            </div>
          </Card>
        </div>

        <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <div className="text-sm text-blue-400 font-semibold mb-1">Tax Optimization Tip</div>
              <div className="text-xs text-gray-400">
                Consider holding positions for more than 1 year to benefit from lower LTCG rates. 
                Current portfolio has {((taxImpactData.longTermGains / (taxImpactData.shortTermGains + taxImpactData.longTermGains)) * 100).toFixed(1)}% long-term holdings.
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Strategy Details Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white text-lg mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          Strategy & Trade Details
        </h3>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-gray-700/50 mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trades">Recent Trades</TabsTrigger>
            <TabsTrigger value="metrics">Key Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Strategy Type</div>
                <div className="text-sm text-white font-semibold">Momentum + Mean Reversion</div>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Market Segment</div>
                <div className="text-sm text-white font-semibold">Equity + F&O</div>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Risk Level</div>
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  Moderate
                </Badge>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Active
                </Badge>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="trades">
            <div className="text-sm text-gray-400 text-center py-8">
              Recent trades data will be displayed here
            </div>
          </TabsContent>

          <TabsContent value="metrics">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Profit Factor</div>
                <div className="text-lg text-green-400 font-semibold">2.34</div>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Recovery Factor</div>
                <div className="text-lg text-cyan-400 font-semibold">3.12</div>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Calmar Ratio</div>
                <div className="text-lg text-purple-400 font-semibold">1.98</div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
