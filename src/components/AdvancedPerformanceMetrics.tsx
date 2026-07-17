import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingDown, Calendar, DollarSign, BarChart3, Target, Loader2 } from 'lucide-react';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { portfolioService, AdvancedMetricsResponse } from '../services/portfolioService';

interface AdvancedPerformanceMetricsProps {
  strategyId?: string;
  portfolioId?: string;
}

export function AdvancedPerformanceMetrics({ strategyId, portfolioId }: AdvancedPerformanceMetricsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'6M' | '9M' | '1Y' | '2Y'>('1Y');
  const [metricsData, setMetricsData] = useState<AdvancedMetricsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const response = await portfolioService.getAdvancedMetrics(selectedPeriod, strategyId);
        setMetricsData(response.success ? response.data : null);
      } catch (error) {
        console.error('Error loading advanced metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [selectedPeriod, strategyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!metricsData) {
    return (
      <div className="text-center py-12 text-gray-400">
        Failed to load metrics data
      </div>
    );
  }

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
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Win Rate</div>
            <div className="text-2xl text-cyan-400">{metricsData.multiPeriodStats[selectedPeriod].winRate}%</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Avg Return</div>
            <div className="text-2xl text-green-400">+{metricsData.multiPeriodStats[selectedPeriod].avgReturn}%</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Sharpe Ratio</div>
            <div className="text-2xl text-purple-400">{metricsData.multiPeriodStats[selectedPeriod].sharpe}</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Max Drawdown</div>
            <div className="text-2xl text-red-400">{metricsData.multiPeriodStats[selectedPeriod].maxDrawdown}%</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Trades</div>
            <div className="text-2xl text-white">{metricsData.multiPeriodStats[selectedPeriod].trades}</div>
          </div>
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
          {metricsData.heatMap.map((yearData, yearIndex) => (
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
                          <div className="text-xs text-gray-500 mb-1">{monthData.month}</div>
                          <div className={`text-sm font-semibold ${
                            parseFloat(monthData.return) >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {parseFloat(monthData.return) >= 0 ? '+' : ''}{monthData.return}%
                          </div>
                          <div className="text-xs text-gray-600">{monthData.trades} trades</div>
                          <div className="text-xs text-gray-500">₹{monthData.totalPnL.toLocaleString()}</div>
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metricsData.drawdown.map((item, i) => (
            <div key={i} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-2">{item.period}</div>
              <div className="text-2xl text-red-400 font-semibold mb-2">{item.value}%</div>
              <div className="text-xs text-gray-500">Duration: {item.duration}</div>
              <div className="text-xs text-gray-500">Recovery: {item.recovery}</div>
            </div>
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Short-Term Gains</div>
            <div className="text-xl text-white">₹{metricsData.taxImpact.shortTermGains.toLocaleString()}</div>
            <div className="text-xs text-orange-400">Tax: ₹{metricsData.taxImpact.shortTermTax.toLocaleString()}</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Long-Term Gains</div>
            <div className="text-xl text-white">₹{metricsData.taxImpact.longTermGains.toLocaleString()}</div>
            <div className="text-xs text-green-400">Tax: ₹{metricsData.taxImpact.longTermTax.toLocaleString()}</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total Tax Liability</div>
            <div className="text-xl text-yellow-400">₹{metricsData.taxImpact.totalTaxLiability.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Effective: {metricsData.taxImpact.effectiveTaxRate}%</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Net Returns (Post-Tax)</div>
            <div className="text-xl text-green-400">₹{metricsData.taxImpact.netReturns.toLocaleString()}</div>
            <div className="text-xs text-gray-500">After all deductions</div>
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
                <div className="text-sm text-white font-semibold">—</div>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Market Segment</div>
                <div className="text-sm text-white font-semibold">—</div>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Risk Level</div>
                <span className="text-white">—</span>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <span className="text-white">—</span>
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
                <div className="text-lg text-white font-semibold">—</div>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Recovery Factor</div>
                <div className="text-lg text-white font-semibold">—</div>
              </Card>
              <Card className="bg-gray-900/50 border-gray-700 p-4">
                <div className="text-xs text-gray-400 mb-1">Calmar Ratio</div>
                <div className="text-lg text-white font-semibold">—</div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
