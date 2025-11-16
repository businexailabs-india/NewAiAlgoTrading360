import { motion } from 'motion/react';
import { X, Play, Copy, Code, Download, TrendingUp, Calendar, DollarSign, Activity, Target } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Strategy {
  id: number;
  name: string;
  author: string;
  category: string;
  exchange: string;
  description: string;
  returns: string;
  sharpe: string;
  drawdown: string;
  winRate: string;
  trades: number;
  tags: string[];
  code: string;
  rating: number;
  reviews: number;
  deployed: number;
  chartData: number[];
}

interface StrategyDetailModalProps {
  strategy: Strategy;
  onClose: () => void;
}

// Extended performance data
const performanceData = [
  { date: 'Jan', equity: 100000, benchmark: 100000, drawdown: 0 },
  { date: 'Feb', equity: 108000, benchmark: 102000, drawdown: -2 },
  { date: 'Mar', equity: 112000, benchmark: 105000, drawdown: -1 },
  { date: 'Apr', equity: 118000, benchmark: 107000, drawdown: -3 },
  { date: 'May', equity: 115000, benchmark: 108000, drawdown: -5 },
  { date: 'Jun', equity: 125000, benchmark: 112000, drawdown: -2 },
  { date: 'Jul', equity: 130000, benchmark: 115000, drawdown: -1 },
  { date: 'Aug', equity: 128000, benchmark: 116000, drawdown: -3 },
  { date: 'Sep', equity: 136000, benchmark: 120000, drawdown: -2 },
  { date: 'Oct', equity: 142000, benchmark: 123000, drawdown: -1 },
  { date: 'Nov', equity: 145000, benchmark: 125000, drawdown: 0 },
  { date: 'Dec', equity: 151000, benchmark: 128000, drawdown: 0 }
];

const monthlyReturns = [
  { month: 'Jan', returns: 8.0 },
  { month: 'Feb', returns: 3.7 },
  { month: 'Mar', returns: 5.4 },
  { month: 'Apr', returns: 5.4 },
  { month: 'May', returns: -2.5 },
  { month: 'Jun', returns: 8.7 },
  { month: 'Jul', returns: 4.0 },
  { month: 'Aug', returns: -1.5 },
  { month: 'Sep', returns: 6.2 },
  { month: 'Oct', returns: 4.4 },
  { month: 'Nov', returns: 2.1 },
  { month: 'Dec', returns: 4.1 }
];

const codeSnippet = `class NiftyMomentumBreakout(QCAlgorithm):
    
    def Initialize(self):
        # Set start date, end date and cash
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2024, 12, 31)
        self.SetCash(1000000)
        
        # Add NSE equity data
        self.symbols = [
            self.AddEquity("RELIANCE", Resolution.Daily).Symbol,
            self.AddEquity("TCS", Resolution.Daily).Symbol,
            self.AddEquity("HDFCBANK", Resolution.Daily).Symbol,
            # Add more Nifty 50 stocks...
        ]
        
        # Set indicators
        self.rsi = {}
        self.sma_fast = {}
        self.sma_slow = {}
        
        for symbol in self.symbols:
            self.rsi[symbol] = self.RSI(symbol, 14)
            self.sma_fast[symbol] = self.SMA(symbol, 50)
            self.sma_slow[symbol] = self.SMA(symbol, 200)
    
    def OnData(self, data):
        for symbol in self.symbols:
            # Check if indicators are ready
            if not (self.rsi[symbol].IsReady and 
                    self.sma_fast[symbol].IsReady):
                continue
            
            # Momentum breakout signal
            if (self.sma_fast[symbol].Current.Value > 
                self.sma_slow[symbol].Current.Value and
                self.rsi[symbol].Current.Value > 60):
                
                self.SetHoldings(symbol, 0.1)
            
            # Exit signal
            elif self.rsi[symbol].Current.Value < 40:
                self.Liquidate(symbol)`;

export function StrategyDetailModal({ strategy, onClose }: StrategyDetailModalProps) {
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
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl text-white">{strategy.name}</h2>
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                  {strategy.exchange}
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  {strategy.category}
                </Badge>
              </div>
              <p className="text-gray-400">by {strategy.author}</p>
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

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <Button className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white">
              <Play className="w-4 h-4 mr-2" />
              Deploy Strategy
            </Button>
            <Button variant="outline" className="border-gray-700">
              <Copy className="w-4 h-4 mr-2" />
              Clone to Workspace
            </Button>
            <Button variant="outline" className="border-gray-700">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Total Returns</span>
              </div>
              <div className="text-2xl text-green-400">{strategy.returns}</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Sharpe Ratio</span>
              </div>
              <div className="text-2xl text-cyan-400">{strategy.sharpe}</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Win Rate</span>
              </div>
              <div className="text-2xl text-blue-400">{strategy.winRate}</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-red-400" />
                <span className="text-sm text-gray-400">Max Drawdown</span>
              </div>
              <div className="text-2xl text-red-400">{strategy.drawdown}</div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 mb-6">
            <h3 className="text-white mb-2">Strategy Description</h3>
            <p className="text-gray-400">{strategy.description}</p>
            
            <div className="flex flex-wrap gap-2 mt-4">
              {strategy.tags.map((tag) => (
                <Badge key={tag} className="bg-gray-700/50 text-gray-300 border-gray-600">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="bg-gray-800 mb-6">
              <TabsTrigger value="performance" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                Performance
              </TabsTrigger>
              <TabsTrigger value="code" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                Code Preview
              </TabsTrigger>
              <TabsTrigger value="statistics" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
                Statistics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="space-y-6">
              {/* Equity Curve */}
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                <h3 className="text-white mb-4">Equity Curve vs Benchmark</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6b7280" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6b7280" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#10b981" fillOpacity={1} fill="url(#colorEquity)" name="Strategy" />
                    <Area type="monotone" dataKey="benchmark" stroke="#6b7280" fillOpacity={1} fill="url(#colorBenchmark)" name="Nifty 50" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Returns */}
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                <h3 className="text-white mb-4">Monthly Returns Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={monthlyReturns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="month" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Line type="monotone" dataKey="returns" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="code">
              <div className="bg-gray-950 border border-gray-700 rounded-xl p-6 overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white flex items-center gap-2">
                    <Code className="w-4 h-4 text-orange-400" />
                    Strategy Implementation
                  </h3>
                  <Button variant="outline" size="sm" className="border-gray-700">
                    <Copy className="w-3 h-3 mr-2" />
                    Copy Code
                  </Button>
                </div>
                <pre className="text-sm text-gray-300 font-mono">
                  <code>{codeSnippet}</code>
                </pre>
              </div>
            </TabsContent>

            <TabsContent value="statistics">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                  <h3 className="text-white mb-4">Risk Metrics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Volatility (Annual)</span>
                      <span className="text-white">18.4%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sortino Ratio</span>
                      <span className="text-white">2.91</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Calmar Ratio</span>
                      <span className="text-white">2.76</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Max Drawdown Duration</span>
                      <span className="text-white">45 days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Beta</span>
                      <span className="text-white">0.82</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Alpha</span>
                      <span className="text-white">3.2%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                  <h3 className="text-white mb-4">Trading Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Trades</span>
                      <span className="text-white">{strategy.trades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Trade Duration</span>
                      <span className="text-white">12.4 days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Profit Factor</span>
                      <span className="text-white">2.34</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Win</span>
                      <span className="text-green-400">+4.2%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Loss</span>
                      <span className="text-red-400">-1.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Expectancy</span>
                      <span className="text-white">2.1%</span>
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
