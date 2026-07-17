import { motion } from 'motion/react';
import { useState } from 'react';
import { Target, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from './ui/badge';

interface TradeAnalyticsPanelProps {
  timeRange: string;
  trades?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
}

function mapTrades(trades: Array<Record<string, unknown>>) {
  return trades.map((t, i) => ({
    id: String(t.id ?? i),
    symbol: String(t.symbol ?? '—'),
    type: String(t.tradeType ?? t.type ?? 'Long'),
    entry: Number(t.entryPrice ?? t.price ?? 0),
    exit: Number(t.exitPrice ?? t.price ?? 0),
    stopLoss: Number(t.stopLoss ?? 0),
    target: Number(t.target ?? 0),
    pnl: Number(t.pnl ?? t.realizedPnL ?? 0),
    result: String(t.result ?? t.status ?? 'manual'),
    duration: String(t.duration ?? '—'),
    slippage: Number(t.slippage ?? 0),
    date: String(t.executedAt ?? t.createdAt ?? '').split('T')[0] || '—'
  }));
}

export function TradeAnalyticsPanel({ timeRange, trades = [], orders = [] }: TradeAnalyticsPanelProps) {
  void timeRange;
  void orders;
  const tradeExecutions = mapTrades(trades);
  const [selectedTrade, setSelectedTrade] = useState<typeof tradeExecutions[0] | null>(null);

  const riskRewardData = tradeExecutions.map(trade => ({
    risk: Math.abs(trade.entry - trade.stopLoss) || 1,
    reward: trade.pnl,
    symbol: trade.symbol,
    result: trade.result
  }));

  const targetHits = tradeExecutions.filter(t => t.result === 'target').length;
  const targetHitRate = tradeExecutions.length > 0
    ? ((targetHits / tradeExecutions.length) * 100).toFixed(0)
    : '0';
  const avgSlippage = tradeExecutions.length > 0
    ? (tradeExecutions.reduce((s, t) => s + t.slippage, 0) / tradeExecutions.length).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      {/* Risk-Reward Scatter Plot */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Risk-Reward Distribution</h3>
        {riskRewardData.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No data available</div>
        ) : (
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
        )}
      </motion.div>

      {/* Trade Execution Details */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Recent Trade Executions</h3>
        
        {tradeExecutions.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data available</div>
        ) : (
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
              </motion.div>
            ))}
          </div>
        )}
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
          <div className="text-3xl text-green-400 mb-1">{targetHitRate}%</div>
          <div className="text-sm text-gray-400">
            {targetHits} out of {tradeExecutions.length} trades
          </div>
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <h4 className="text-white">Avg Trade Duration</h4>
          </div>
          <div className="text-3xl text-cyan-400 mb-1">—</div>
          <div className="text-sm text-gray-400">Across all trades</div>
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <h4 className="text-white">Avg Slippage</h4>
          </div>
          <div className="text-3xl text-yellow-400 mb-1">{avgSlippage}%</div>
          <div className="text-sm text-gray-400">
            {tradeExecutions.length === 0 ? 'No data available' : 'From executed trades'}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
