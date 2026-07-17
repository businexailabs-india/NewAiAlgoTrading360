import { motion } from 'motion/react';
import { useState } from 'react';
import { Target, DollarSign, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { StrategyDetailsModal } from './StrategyDetailsModal';
import { OptimizationModal } from './OptimizationModal';

interface StrategyPerformanceDashboardProps {
  timeRange: string;
  agents?: Array<Record<string, unknown>>;
  performanceData?: Array<{ date: string; pnl: number; expected: number; executed: number; trades: number }>;
  dailyPnL?: Array<{ day: string; pnl: number; target: number }>;
}

export function StrategyPerformanceDashboard({
  timeRange,
  agents = [],
  performanceData = [],
  dailyPnL = []
}: StrategyPerformanceDashboardProps) {
  void timeRange;

  const strategiesBreakdown = agents.map((a, i) => ({
    id: String(a.id ?? i),
    name: String(a.name ?? 'Trading Agent'),
    type: String(a.mode ?? 'paper'),
    segment: 'Equity',
    pnl: Number((a.config as { totalPnL?: number })?.totalPnL ?? 0),
    trades: Number((a.config as { trades?: number })?.trades ?? 0),
    winRate: Number((a.config as { winRate?: number })?.winRate ?? 0),
    avgReturn: 0,
    status: String(a.status ?? 'active')
  }));

  const [selectedStrategy, setSelectedStrategy] = useState<typeof strategiesBreakdown[0] | null>(null);
  const [optimizingStrategy, setOptimizingStrategy] = useState<typeof strategiesBreakdown[0] | null>(null);
  const [pausedStrategies, setPausedStrategies] = useState<string[]>([]);

  const handlePause = (strategyId: string) => {
    if (pausedStrategies.includes(strategyId)) {
      setPausedStrategies(pausedStrategies.filter(id => id !== strategyId));
    } else {
      setPausedStrategies([...pausedStrategies, strategyId]);
    }
  };

  const handleApplyOptimizations = (optimizations: string[]) => {
    console.log('Applying optimizations:', optimizations);
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-cyan-400" />
          Expected vs Executed Returns
        </h3>
        {performanceData.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="expected" fill="#6b7280" name="Expected Returns" radius={[8, 8, 0, 0]} />
              <Bar dataKey="executed" fill="#06b6d4" name="Executed Returns" radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="trades" stroke="#10b981" strokeWidth={2} name="Trades Count" />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Daily P&L Performance
        </h3>
        {dailyPnL.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dailyPnL}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="target" fill="#374151" name="Daily Target" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pnl" fill="#10b981" name="Actual P&L" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Active Strategies Performance
        </h3>

        {strategiesBreakdown.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data available</div>
        ) : (
          <div className="space-y-4">
            {strategiesBreakdown.map((strategy, i) => {
              const isPaused = pausedStrategies.includes(strategy.id);
              
              return (
                <motion.div
                  key={strategy.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-gray-900/50 border border-gray-700 rounded-lg p-5 hover:border-cyan-500/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white">{strategy.name}</h4>
                        <Badge className={`${
                          isPaused
                            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            : strategy.status === 'active' 
                            ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {isPaused ? 'paused' : strategy.status}
                        </Badge>
                      </div>
                      <div className="flex gap-4 text-sm text-gray-400">
                        <span>Type: {strategy.type}</span>
                        <span>•</span>
                        <span>Segment: {strategy.segment}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`text-2xl ${strategy.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {strategy.pnl >= 0 ? '+' : ''}₹{Math.abs(strategy.pnl).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-500">Total P&L</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Total Trades</div>
                      <div className="text-lg text-white">{strategy.trades}</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Win Rate</div>
                      <div className="text-lg text-cyan-400">{strategy.winRate}%</div>
                    </div>
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Avg Return</div>
                      <div className={`text-lg ${strategy.avgReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {strategy.avgReturn >= 0 ? '+' : ''}{strategy.avgReturn}%
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => setSelectedStrategy(strategy)}
                      className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30"
                    >
                      View Details
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => setOptimizingStrategy(strategy)}
                      variant="outline" 
                      className="border-gray-700"
                    >
                      Optimize
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handlePause(strategy.id)}
                      variant="outline" 
                      className={isPaused ? "border-green-700 text-green-400 hover:bg-green-900/20" : "border-red-700 text-red-400 hover:bg-red-900/20"}
                    >
                      {isPaused ? 'Resume' : 'Pause'}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {selectedStrategy && (
        <StrategyDetailsModal 
          strategy={selectedStrategy}
          onClose={() => setSelectedStrategy(null)}
        />
      )}

      {optimizingStrategy && (
        <OptimizationModal
          strategy={optimizingStrategy}
          onClose={() => setOptimizingStrategy(null)}
          onApply={handleApplyOptimizations}
        />
      )}
    </div>
  );
}
