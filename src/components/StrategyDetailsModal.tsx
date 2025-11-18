import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { X, TrendingUp, Target, BarChart3, Activity, Calendar, Clock, DollarSign, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Strategy {
  id: number;
  name: string;
  type: string;
  segment: string;
  pnl: number;
  trades: number;
  winRate: number;
  avgReturn: number;
  status: string;
}

interface StrategyDetailsModalProps {
  strategy: Strategy;
  onClose: () => void;
}

const performanceHistory = [
  { week: 'W1', pnl: 8500, trades: 28 },
  { week: 'W2', pnl: 12400, trades: 32 },
  { week: 'W3', pnl: -1200, trades: 25 },
  { week: 'W4', pnl: 15900, trades: 40 }
];

const tradingTimes = [
  { time: '9:30-10:30', trades: 45, winRate: 72 },
  { time: '10:30-11:30', trades: 38, winRate: 68 },
  { time: '11:30-12:30', trades: 32, winRate: 65 },
  { time: '12:30-13:30', trades: 28, winRate: 58 },
  { time: '13:30-14:30', trades: 35, winRate: 70 },
  { time: '14:30-15:30', trades: 24, winRate: 62 }
];

const allTrades = [
  {
    id: 1,
    symbol: 'RELIANCE',
    entryDate: '2025-01-10',
    entryTime: '10:15 AM',
    exitDate: '2025-01-10',
    exitTime: '02:45 PM',
    entryPrice: 2450.50,
    exitPrice: 2498.75,
    quantity: 100,
    pnl: 4825,
    pnlPercent: 1.97,
    stopLoss: 2420.00,
    target: 2510.00,
    status: 'target-hit',
    duration: '4h 30m'
  },
  {
    id: 2,
    symbol: 'TCS',
    entryDate: '2025-01-10',
    entryTime: '09:45 AM',
    exitDate: '2025-01-10',
    exitTime: '12:00 PM',
    entryPrice: 3680.20,
    exitPrice: 3725.80,
    quantity: 100,
    pnl: 4560,
    pnlPercent: 1.24,
    stopLoss: 3650.00,
    target: 3750.00,
    status: 'target-hit',
    duration: '2h 15m'
  },
  {
    id: 3,
    symbol: 'HDFCBANK',
    entryDate: '2025-01-09',
    entryTime: '11:30 AM',
    exitDate: '2025-01-09',
    exitTime: '01:15 PM',
    entryPrice: 1648.50,
    exitPrice: 1625.30,
    quantity: 100,
    pnl: -2320,
    pnlPercent: -1.41,
    stopLoss: 1620.00,
    target: 1690.00,
    status: 'stop-loss',
    duration: '1h 45m'
  },
  {
    id: 4,
    symbol: 'INFY',
    entryDate: '2025-01-09',
    entryTime: '10:00 AM',
    exitDate: '2025-01-09',
    exitTime: '01:10 PM',
    entryPrice: 1456.75,
    exitPrice: 1438.20,
    quantity: 100,
    pnl: 1855,
    pnlPercent: 1.27,
    stopLoss: 1470.00,
    target: 1430.00,
    status: 'target-hit',
    duration: '3h 10m'
  },
  {
    id: 5,
    symbol: 'ICICIBANK',
    entryDate: '2025-01-08',
    entryTime: '09:30 AM',
    exitDate: '2025-01-08',
    exitTime: '03:00 PM',
    entryPrice: 985.40,
    exitPrice: 992.15,
    quantity: 100,
    pnl: 675,
    pnlPercent: 0.68,
    stopLoss: 975.00,
    target: 1005.00,
    status: 'manual-exit',
    duration: '5h 30m'
  },
  {
    id: 6,
    symbol: 'WIPRO',
    entryDate: '2025-01-08',
    entryTime: '11:15 AM',
    exitDate: '2025-01-08',
    exitTime: '02:30 PM',
    entryPrice: 445.60,
    exitPrice: 452.30,
    quantity: 200,
    pnl: 1340,
    pnlPercent: 1.50,
    stopLoss: 438.00,
    target: 455.00,
    status: 'target-hit',
    duration: '3h 15m'
  },
  {
    id: 7,
    symbol: 'SBIN',
    entryDate: '2025-01-07',
    entryTime: '10:30 AM',
    exitDate: '2025-01-07',
    exitTime: '03:15 PM',
    entryPrice: 625.80,
    exitPrice: 618.45,
    quantity: 150,
    pnl: -1102.50,
    pnlPercent: -1.17,
    stopLoss: 615.00,
    target: 638.00,
    status: 'stop-loss',
    duration: '4h 45m'
  },
  {
    id: 8,
    symbol: 'TATAMOTORS',
    entryDate: '2025-01-07',
    entryTime: '09:45 AM',
    exitDate: '2025-01-07',
    exitTime: '01:00 PM',
    entryPrice: 775.20,
    exitPrice: 792.45,
    quantity: 120,
    pnl: 2070,
    pnlPercent: 2.22,
    stopLoss: 762.00,
    target: 795.00,
    status: 'target-hit',
    duration: '3h 15m'
  },
  {
    id: 9,
    symbol: 'AXISBANK',
    entryDate: '2025-01-06',
    entryTime: '10:15 AM',
    exitDate: '2025-01-06',
    exitTime: '02:45 PM',
    entryPrice: 1045.30,
    exitPrice: 1062.80,
    quantity: 100,
    pnl: 1750,
    pnlPercent: 1.67,
    stopLoss: 1028.00,
    target: 1068.00,
    status: 'target-hit',
    duration: '4h 30m'
  },
  {
    id: 10,
    symbol: 'BHARTIARTL',
    entryDate: '2025-01-06',
    entryTime: '11:00 AM',
    exitDate: '2025-01-06',
    exitTime: '12:30 PM',
    entryPrice: 1285.60,
    exitPrice: 1278.30,
    quantity: 80,
    pnl: -584,
    pnlPercent: -0.57,
    stopLoss: 1265.00,
    target: 1310.00,
    status: 'manual-exit',
    duration: '1h 30m'
  }
];

const metrics = [
  { label: 'Total Trades', value: '125', icon: BarChart3 },
  { label: 'Win Rate', value: '72.4%', icon: Target },
  { label: 'Avg Return', value: '+2.8%', icon: TrendingUp },
  { label: 'Max Drawdown', value: '-4.2%', icon: Activity }
];

export function StrategyDetailsModal({ strategy, onClose }: StrategyDetailsModalProps) {
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');

  // Filter trades based on selected time period
  const filteredTrades = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return allTrades.filter(trade => {
      const tradeDate = new Date(trade.entryDate);
      
      switch (timeFilter) {
        case 'today':
          return tradeDate >= today;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return tradeDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return tradeDate >= monthAgo;
        case 'all':
        default:
          return true;
      }
    });
  }, [timeFilter]);

  // Calculate filtered metrics
  const filteredMetrics = useMemo(() => {
    const totalTrades = filteredTrades.length;
    const winningTrades = filteredTrades.filter(t => t.pnl > 0).length;
    const totalPnl = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
    const avgReturn = totalTrades > 0 
      ? (filteredTrades.reduce((sum, t) => sum + t.pnlPercent, 0) / totalTrades).toFixed(2)
      : '0.00';
    const winRate = totalTrades > 0 ? ((winningTrades / totalTrades) * 100).toFixed(1) : '0.0';
    
    return {
      totalTrades,
      winRate,
      avgReturn,
      totalPnl
    };
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
      case 'target-hit':
        return 'Target Hit';
      case 'stop-loss':
        return 'Stop Loss';
      case 'manual-exit':
        return 'Manual Exit';
      default:
        return status;
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
        {/* Header */}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Time Filter */}
          <div className="mb-6 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Filter by:</span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setTimeFilter('today')}
                variant={timeFilter === 'today' ? 'default' : 'outline'}
                className={timeFilter === 'today' 
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                  : 'border-gray-700 hover:bg-gray-800'
                }
              >
                Today
              </Button>
              <Button
                size="sm"
                onClick={() => setTimeFilter('week')}
                variant={timeFilter === 'week' ? 'default' : 'outline'}
                className={timeFilter === 'week' 
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                  : 'border-gray-700 hover:bg-gray-800'
                }
              >
                Week
              </Button>
              <Button
                size="sm"
                onClick={() => setTimeFilter('month')}
                variant={timeFilter === 'month' ? 'default' : 'outline'}
                className={timeFilter === 'month' 
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                  : 'border-gray-700 hover:bg-gray-800'
                }
              >
                Month
              </Button>
              <Button
                size="sm"
                onClick={() => setTimeFilter('all')}
                variant={timeFilter === 'all' ? 'default' : 'outline'}
                className={timeFilter === 'all' 
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                  : 'border-gray-700 hover:bg-gray-800'
                }
              >
                All Time
              </Button>
            </div>
            <Badge className="bg-gray-700/50 text-gray-300 border-gray-600">
              {filteredTrades.length} {filteredTrades.length === 1 ? 'trade' : 'trades'}
            </Badge>
          </div>

          {/* Key Metrics - Dynamic based on filter */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Total Trades</span>
              </div>
              <div className="text-2xl text-white">{filteredMetrics.totalTrades}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Win Rate</span>
              </div>
              <div className="text-2xl text-white">{filteredMetrics.winRate}%</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Avg Return</span>
              </div>
              <div className="text-2xl text-white">+{filteredMetrics.avgReturn}%</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Total P&L</span>
              </div>
              <div className={`text-2xl ${filteredMetrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {filteredMetrics.totalPnl >= 0 ? '+' : ''}₹{Math.abs(filteredMetrics.totalPnl).toLocaleString()}
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white">
                    {timeFilter === 'today' && 'Today\'s Trades'}
                    {timeFilter === 'week' && 'This Week\'s Trades'}
                    {timeFilter === 'month' && 'This Month\'s Trades'}
                    {timeFilter === 'all' && 'Complete Trade History'}
                  </h3>
                  <Button size="sm" variant="outline" className="border-gray-700">
                    Export to CSV
                  </Button>
                </div>
                
                {filteredTrades.length === 0 ? (
                  <div className="text-center py-12">
                    <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No trades found for the selected period</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTrades.map((trade, i) => (
                    <motion.div
                      key={trade.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-cyan-500/50 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-white text-lg">{trade.symbol}</h4>
                            <Badge className={getStatusBadge(trade.status)}>
                              {getStatusLabel(trade.status)}
                            </Badge>
                            <span className="text-xs text-gray-500">#{trade.id}</span>
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
                            <span>Qty: {trade.quantity}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-2xl ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl).toLocaleString()}
                          </div>
                          <div className={`text-sm ${trade.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent}%
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
                        <div className="bg-gray-800/50 rounded p-2">
                          <div className="text-xs text-gray-500">Entry</div>
                          <div className="text-sm text-white">₹{trade.entryPrice}</div>
                          <div className="text-xs text-gray-500">{trade.entryTime}</div>
                        </div>
                        <div className="bg-gray-800/50 rounded p-2">
                          <div className="text-xs text-gray-500">Exit</div>
                          <div className="text-sm text-white">₹{trade.exitPrice}</div>
                          <div className="text-xs text-gray-500">{trade.exitTime}</div>
                        </div>
                        <div className="bg-gray-800/50 rounded p-2">
                          <div className="text-xs text-gray-500">Stop Loss</div>
                          <div className="text-sm text-red-400">₹{trade.stopLoss}</div>
                        </div>
                        <div className="bg-gray-800/50 rounded p-2">
                          <div className="text-xs text-gray-500">Target</div>
                          <div className="text-sm text-green-400">₹{trade.target}</div>
                        </div>
                        <div className="bg-gray-800/50 rounded p-2">
                          <div className="text-xs text-gray-500">Quantity</div>
                          <div className="text-sm text-white">{trade.quantity}</div>
                        </div>
                        <div className="bg-gray-800/50 rounded p-2">
                          <div className="text-xs text-gray-500">Total P&L</div>
                          <div className={`text-sm ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.pnl >= 0 ? '+' : ''}₹{Math.abs(trade.pnl)}
                          </div>
                        </div>
                      </div>

                      {/* Trade Progress Bar */}
                      <div className="relative">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>SL</span>
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
                            className={`absolute h-full rounded-full ${
                              trade.pnl >= 0 ? 'bg-green-500' : 'bg-red-500'
                            }`}
                            style={{ 
                              left: `${((trade.entryPrice - trade.stopLoss) / (trade.target - trade.stopLoss)) * 100}%`,
                              width: `${Math.abs((trade.exitPrice - trade.entryPrice) / (trade.target - trade.stopLoss)) * 100}%`
                            }}
                          ></div>
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
              </div>
            </TabsContent>

            <TabsContent value="analysis">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Best Trading Times</h3>
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
                <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <p className="text-sm text-gray-300">
                    💡 <span className="text-cyan-400">Optimal trading window:</span> 9:30-10:30 AM with 72% win rate and 45 trades
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-4">
                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-white mb-4">Strategy Parameters</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Position Size</label>
                      <div className="text-white">₹50,000 per trade</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Stop Loss</label>
                      <div className="text-red-400">-3.5%</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Take Profit</label>
                      <div className="text-green-400">+5.0%</div>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Max Daily Trades</label>
                      <div className="text-white">15</div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  );
}