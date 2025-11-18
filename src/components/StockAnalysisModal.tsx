import { motion } from 'motion/react';
import { X, TrendingUp, TrendingDown, BarChart3, Activity, Target, DollarSign, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  reason: string;
  sentiment: 'bullish' | 'bearish';
  strength: number;
}

interface StockAnalysisModalProps {
  stock: Stock;
  onClose: () => void;
}

// Technical indicators data
const technicalIndicators = {
  rsi: 68.5,
  macd: 'Bullish',
  movingAvg50: 1580.30,
  movingAvg200: 1520.75,
  support: 1620.00,
  resistance: 1680.00,
  volatility: 'Medium'
};

// Price history data
const priceHistory = [
  { date: 'Jan 1', price: 1520, volume: 8.2 },
  { date: 'Jan 8', price: 1545, volume: 9.1 },
  { date: 'Jan 15', price: 1580, volume: 10.5 },
  { date: 'Jan 22', price: 1560, volume: 8.8 },
  { date: 'Jan 29', price: 1595, volume: 11.2 },
  { date: 'Feb 5', price: 1620, volume: 12.5 },
  { date: 'Feb 12', price: 1648, volume: 13.8 }
];

// AI Analysis scores
const aiScores = [
  { metric: 'Technical', score: 85 },
  { metric: 'Fundamental', score: 78 },
  { metric: 'Sentiment', score: 92 },
  { metric: 'Volume', score: 88 },
  { metric: 'Momentum', score: 82 }
];

// Key metrics
const keyMetrics = {
  marketCap: '₹8.5L Cr',
  pe: 18.5,
  eps: 89.2,
  dividendYield: 1.2,
  bookValue: 1250.30,
  debtToEquity: 0.45
};

// AI Recommendations
const recommendations = [
  { type: 'entry', price: 1640, reason: 'Strong support level' },
  { type: 'target', price: 1720, reason: 'Resistance breakout potential' },
  { type: 'stopLoss', price: 1610, reason: 'Below key moving average' }
];

export function StockAnalysisModal({ stock, onClose }: StockAnalysisModalProps) {
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
                <h2 className="text-2xl text-white">{stock.symbol}</h2>
                <Badge className={`${
                  stock.sentiment === 'bullish' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  {stock.sentiment}
                </Badge>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                  AI Score: {stock.strength}
                </Badge>
              </div>
              <div className="flex gap-4 text-sm text-gray-400">
                <span>{stock.name}</span>
                <span>•</span>
                <span>{stock.reason}</span>
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

          {/* Current Price */}
          <div className="mt-4 flex items-center gap-6">
            <div>
              <div className="text-3xl text-white font-semibold">₹{stock.price.toLocaleString()}</div>
              <div className={`flex items-center gap-2 ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stock.change >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                <span className="text-lg">{stock.change >= 0 ? '+' : ''}{stock.change}%</span>
                <span className="text-sm text-gray-500">Today</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button className="bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30">
                Add to Watchlist
              </Button>
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
                Trade Now
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <Tabs defaultValue="analysis" className="w-full">
            <TabsList className="bg-gray-800 mb-6">
              <TabsTrigger value="analysis" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="technical" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                Technical
              </TabsTrigger>
              <TabsTrigger value="fundamentals" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                Fundamentals
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                Recommendations
              </TabsTrigger>
            </TabsList>

            {/* AI Analysis Tab */}
            <TabsContent value="analysis">
              <div className="space-y-6">
                {/* AI Scores Radar Chart */}
                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    AI Analysis Breakdown
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={aiScores}>
                      <PolarGrid stroke="#374151" />
                      <PolarAngleAxis dataKey="metric" stroke="#9ca3af" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#9ca3af" />
                      <Radar name="Score" dataKey="score" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Price Chart */}
                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-400" />
                    Price Movement (Last 7 Weeks)
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={priceHistory}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area type="monotone" dataKey="price" stroke="#10b981" fillOpacity={1} fill="url(#colorPrice)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </TabsContent>

            {/* Technical Tab */}
            <TabsContent value="technical">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Technical Indicators</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">RSI (14)</div>
                    <div className="text-xl text-white">{technicalIndicators.rsi}</div>
                    <div className="text-xs text-orange-400">Overbought Zone</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">MACD</div>
                    <div className="text-xl text-green-400">{technicalIndicators.macd}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">50-Day MA</div>
                    <div className="text-xl text-white">₹{technicalIndicators.movingAvg50}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">200-Day MA</div>
                    <div className="text-xl text-white">₹{technicalIndicators.movingAvg200}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Support</div>
                    <div className="text-xl text-green-400">₹{technicalIndicators.support}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Resistance</div>
                    <div className="text-xl text-red-400">₹{technicalIndicators.resistance}</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Fundamentals Tab */}
            <TabsContent value="fundamentals">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Key Fundamentals</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Market Cap</div>
                    <div className="text-xl text-white">{keyMetrics.marketCap}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">P/E Ratio</div>
                    <div className="text-xl text-white">{keyMetrics.pe}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">EPS</div>
                    <div className="text-xl text-white">₹{keyMetrics.eps}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Dividend Yield</div>
                    <div className="text-xl text-white">{keyMetrics.dividendYield}%</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Book Value</div>
                    <div className="text-xl text-white">₹{keyMetrics.bookValue}</div>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <div className="text-sm text-gray-400 mb-1">Debt/Equity</div>
                    <div className="text-xl text-white">{keyMetrics.debtToEquity}</div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations">
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Target className="w-6 h-6 text-cyan-400" />
                    <div>
                      <h3 className="text-white text-lg mb-1">AI Trading Recommendations</h3>
                      <p className="text-sm text-gray-400">Based on technical analysis, market sentiment, and historical patterns</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {recommendations.map((rec, i) => (
                      <div key={i} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {rec.type === 'entry' && <DollarSign className="w-5 h-5 text-green-400" />}
                            {rec.type === 'target' && <Target className="w-5 h-5 text-cyan-400" />}
                            {rec.type === 'stopLoss' && <AlertTriangle className="w-5 h-5 text-red-400" />}
                            <span className="text-white capitalize">{rec.type.replace(/([A-Z])/g, ' $1').trim()}</span>
                          </div>
                          <div className={`text-xl ${
                            rec.type === 'entry' ? 'text-green-400' : 
                            rec.type === 'target' ? 'text-cyan-400' : 
                            'text-red-400'
                          }`}>
                            ₹{rec.price}
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">{rec.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-yellow-400 font-semibold mb-1">Risk Disclaimer</div>
                      <div className="text-xs text-gray-400">
                        These are AI-generated recommendations based on historical data and technical analysis. 
                        Please conduct your own research and consult with a financial advisor before making investment decisions.
                      </div>
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
