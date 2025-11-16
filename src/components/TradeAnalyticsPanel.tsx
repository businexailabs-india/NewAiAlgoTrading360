import { motion } from 'motion/react';
import { useState } from 'react';
import { Target, TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from './ui/badge';

interface TradeAnalyticsPanelProps {
  timeRange: string;
}

const tradeExecutions = [
  {
    id: 1,
    symbol: 'RELIANCE',
    type: 'Long',
    entry: 2450.50,
    exit: 2498.75,
    stopLoss: 2420.00,
    target: 2510.00,
    pnl: 4825,
    result: 'target',
    duration: '4h 25m',
    slippage: 0.12,
    date: '2025-01-10'
  },
  {
    id: 2,
    symbol: 'TCS',
    type: 'Long',
    entry: 3680.20,
    exit: 3725.80,
    stopLoss: 3650.00,
    target: 3750.00,
    pnl: 4560,
    result: 'target',
    duration: '2h 15m',
    slippage: 0.08,
    date: '2025-01-10'
  },
  {
    id: 3,
    symbol: 'HDFCBANK',
    type: 'Long',
    entry: 1648.50,
    exit: 1625.30,
    stopLoss: 1620.00,
    target: 1690.00,
    pnl: -2320,
    result: 'stop-loss',
    duration: '1h 45m',
    slippage: 0.25,
    date: '2025-01-09'
  },
  {
    id: 4,
    symbol: 'INFY',
    type: 'Short',
    entry: 1456.75,
    exit: 1438.20,
    stopLoss: 1470.00,
    target: 1430.00,
    pnl: 1855,
    result: 'target',
    duration: '3h 10m',
    slippage: 0.15,
    date: '2025-01-09'
  },
  {
    id: 5,
    symbol: 'ICICIBANK',
    type: 'Long',
    entry: 985.40,
    exit: 992.15,
    stopLoss: 975.00,
    target: 1005.00,
    pnl: 675,
    result: 'manual',
    duration: '5h 30m',
    slippage: 0.10,
    date: '2025-01-08'
  }
];

// Scatter plot data for risk-reward analysis
const riskRewardData = tradeExecutions.map(trade => ({
  risk: Math.abs(trade.entry - trade.stopLoss),
  reward: trade.pnl,
  symbol: trade.symbol,
  result: trade.result
}));

export function TradeAnalyticsPanel({ timeRange }: TradeAnalyticsPanelProps) {
  const [selectedTrade, setSelectedTrade] = useState<typeof tradeExecutions[0] | null>(null);

  return (
    <div className="space-y-6">
      {/* Risk-Reward Scatter Plot */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Risk-Reward Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" dataKey="risk" name="Risk" stroke="#9ca3af" label={{ value: 'Risk (₹)', position: 'insideBottom', offset: -5 }} />
            <YAxis type="number" dataKey="reward" name="Reward" stroke="#9ca3af" label={{ value: 'Reward (₹)', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
            />
            <Scatter data={riskRewardData} fill="#06b6d4">
              {riskRewardData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.reward >= 0 ? '#10b981' : '#ef4444'} 
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Trade Execution Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Recent Trade Executions</h3>
        
        <div className="space-y-3">
          {tradeExecutions.map((trade, i) => (
            <motion.div
              key={trade.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-cyan-500/50 transition-all cursor-pointer"
              onClick={() => setSelectedTrade(trade)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-white">{trade.symbol}</h4>
                    <Badge className={`${
                      trade.type === 'Long' 
                        ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {trade.type}
                    </Badge>
                    <Badge className={`${
                      trade.result === 'target' 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : trade.result === 'stop-loss'
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    }`}>
                      {trade.result === 'target' ? 'Target Hit' : trade.result === 'stop-loss' ? 'Stop Loss' : 'Manual Exit'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Entry</div>
                      <div className="text-sm text-white">₹{trade.entry.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Exit</div>
                      <div className="text-sm text-white">₹{trade.exit.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Stop Loss</div>
                      <div className="text-sm text-red-400">₹{trade.stopLoss.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Target</div>
                      <div className="text-sm text-green-400">₹{trade.target.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Duration</div>
                      <div className="text-sm text-cyan-400">{trade.duration}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-400">{trade.date}</span>
                    </div>
                    {trade.slippage > 0.2 && (
                      <div className="flex items-center gap-1 text-yellow-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>High slippage: {trade.slippage}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-2xl ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">P&L</div>
                </div>
              </div>

              {/* Trade Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Stop Loss</span>
                  <span>Entry</span>
                  <span>Exit</span>
                  <span>Target</span>
                </div>
                <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="absolute h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-20"
                    style={{ width: '100%' }}
                  ></div>
                  <div 
                    className="absolute h-full bg-cyan-500 rounded-full"
                    style={{ 
                      left: `${((trade.entry - trade.stopLoss) / (trade.target - trade.stopLoss)) * 100}%`,
                      width: `${((trade.exit - trade.entry) / (trade.target - trade.stopLoss)) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Trade Statistics Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-green-400" />
            <h4 className="text-white">Target Hit Rate</h4>
          </div>
          <div className="text-3xl text-green-400 mb-1">60%</div>
          <div className="text-sm text-gray-400">3 out of 5 trades</div>
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h4 className="text-white">Avg Trade Duration</h4>
          </div>
          <div className="text-3xl text-cyan-400 mb-1">3.4h</div>
          <div className="text-sm text-gray-400">Across all trades</div>
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <h4 className="text-white">Avg Slippage</h4>
          </div>
          <div className="text-3xl text-yellow-400 mb-1">0.14%</div>
          <div className="text-sm text-gray-400">Within acceptable range</div>
        </div>
      </motion.div>
    </div>
  );
}
