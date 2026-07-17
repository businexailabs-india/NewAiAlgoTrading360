import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, TrendingUp, Target, BarChart3, Activity, Calendar, Clock, DollarSign, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Strategy {
  id: number | string;
  name: string;
  type: string;
  segment: string;
  pnl: number;
  trades: number;
  winRate: number;
  avgReturn: number;
  status: string;
}

interface TradeRow {
  id: number | string;
  symbol: string;
  entryDate: string;
  entryTime: string;
  exitDate: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  target: number;
  status: string;
  duration: string;
}

interface StrategyDetailsModalProps {
  strategy: Strategy;
  onClose: () => void;
  trades?: TradeRow[];
  performanceHistory?: Array<{ week: string; pnl: number; trades: number }>;
  tradingTimes?: Array<{ time: string; trades: number; winRate: number }>;
}

export function StrategyDetailsModal({
  strategy,
  onClose,
  trades = [],
  performanceHistory = [],
  tradingTimes = []
}: StrategyDetailsModalProps) {
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  const filteredTrades = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return trades.filter(trade => {
      const tradeDate = new Date(trade.entryDate);
      if (Number.isNaN(tradeDate.getTime())) return timeFilter === 'all';
      
      switch (timeFilter) {
        case 'today':
          return tradeDate >= today;
        case 'week': {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return tradeDate >= weekAgo;
        }
        case 'month': {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return tradeDate >= monthAgo;
        }
        case 'all':
        default:
          return true;
      }
    });
  }, [timeFilter, trades]);

  const filteredMetrics = useMemo(() => {
    const totalTrades = filteredTrades.length;
    const winningTrades = filteredTrades.filter(t => t.pnl > 0).length;
    const totalPnl = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
    const avgReturn = totalTrades > 0 
      ? (filteredTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / totalTrades).toFixed(2)
      : '0.00';
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
    
    return { totalTrades, winRate, avgReturn, totalPnl };
  }, [filteredTrades]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'target-hit':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'stop-loss':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'manual-exit':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'target-hit': return 'Target Hit';
      case 'stop-loss': return 'Stop Loss';
      case 'manual-exit': return 'Manual Exit';
      default: return status;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 border border-gray-800 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl text-white">{strategy.name}</h2>
                <Badge className={`${
                  strategy.status === 'active' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                }`}>
                  {strategy.status}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm text-gray-400">
                <span>Type: {strategy.type}</span>
                <span>•</span>
                <span>Segment: {strategy.segment}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-gray-800">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Filter by:</span>
            </div>
            <div className="flex gap-2">
              {(['today', 'week', 'month', 'all'] as const).map((f) => (
                <Button
                  key={f}
                  size="sm"
                  onClick={() => setTimeFilter(f)}
                  variant={timeFilter === f ? 'default' : 'outline'}
                  className={timeFilter === f 
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                    : 'border-gray-700 hover:bg-gray-800'
                  }
                >
                  {f === 'all' ? 'All Time' : f.charAt(0).toUpperCase() + f.slice(1)}
                </Button>
              ))}
            </div>
            <Badge className="bg-gray-700/50 text-gray-300 border-gray-600">
              {filteredTrades.length} {filteredTrades.length === 1 ? 'trade' : 'trades'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Total Trades</span>
              </div>
              <div className="text-2xl text-white">{filteredMetrics.totalTrades}</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Win Rate</span>
              </div>
              <div className="text-2xl text-white">{filteredMetrics.winRate}%</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Avg Return</span>
              </div>
              <div className="text-2xl text-white">{filteredMetrics.avgReturn}%</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Total P&L</span>
              </div>
              <div className={`text-2xl ${filteredMetrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {filteredMetrics.totalPnl >= 0 ? '+' : ''}₹{Math.abs(filteredMetrics.totalPnl).toLocaleString()}
              </div>
            </div>
          </div>

          <Tabs defaultValue="trades" className="w-full">
            <TabsList className="bg-gray-800 mb-6">
              <TabsTrigger value="trades" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                All Trades
              </TabsTrigger>
              <TabsTrigger value="performance" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                Performance History
              </TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                Time Analysis
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trades">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Trade History</h3>
                {filteredTrades.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No data available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTrades.map((trade, i) => (
                      <motion.div
                        key={trade.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="bg-gray-900/50 border border-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="text-white text-lg">{trade.symbol}</h4>
                              <Badge className={getStatusBadge(trade.status)}>
                                {getStatusLabel(trade.status)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{trade.entryDate}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{trade.duration}</span>
                              </div>
                            </div>
                          </div>
                          <div className={`text-2xl ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="performance">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Weekly Performance</h3>
                {performanceHistory.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">No data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={performanceHistory}>
                      <defs>
                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="week" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="pnl" stroke="#10b981" fillOpacity={1} fill="url(#colorPnl)" />
                      <Line type="monotone" dataKey="trades" stroke="#06b6d4" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </TabsContent>

            <TabsContent value="analysis">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Best Trading Times</h3>
                {tradingTimes.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">No data available</div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tradingTimes}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="time" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="trades" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="winRate" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Strategy Parameters</h3>
                <p className="text-gray-400">No parameters available</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  );
}
