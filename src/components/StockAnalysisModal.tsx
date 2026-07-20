import { useState } from 'react';
import { motion } from 'motion/react';
import { X, TrendingUp, TrendingDown, BarChart3, Activity, Target, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { addToDefaultWatchlist } from '@/api/watchlist';
import { toast } from 'sonner';

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
  technicalIndicators?: Record<string, string | number>;
  priceHistory?: Array<{ date: string; price: number; volume?: number }>;
  aiScores?: Array<{ metric: string; score: number }>;
  keyMetrics?: Record<string, string | number>;
  recommendations?: Array<{ type: string; price: number; reason: string }>;
}

export function StockAnalysisModal({
  stock,
  onClose,
  technicalIndicators = {},
  priceHistory = [],
  aiScores = [],
  keyMetrics = {},
  recommendations = []
}: StockAnalysisModalProps) {
  const [adding, setAdding] = useState(false);

  async function handleAddToWatchlist() {
    setAdding(true);
    try {
      await addToDefaultWatchlist(stock.symbol, 'NSE');
      toast.success(`${stock.symbol} added to watchlist`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add to watchlist');
    } finally {
      setAdding(false);
    }
  }

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
                <h2 className="text-2xl text-white">{stock.symbol}</h2>
                <Badge className={`${
                  stock.sentiment === 'bullish' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  {stock.sentiment}
                </Badge>
                {stock.strength > 0 && (
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                    Strength: {stock.strength}
                  </Badge>
                )}
              </div>
              <div className="flex gap-4 text-sm text-gray-400">
                <span>{stock.name}</span>
                {stock.reason && (
                  <>
                    <span>•</span>
                    <span>{stock.reason}</span>
                  </>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-gray-800">
              <X className="w-5 h-5" />
            </Button>
          </div>

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
              <Button
                className="bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                disabled={adding}
                onClick={() => void handleAddToWatchlist()}
              >
                {adding ? 'Adding…' : 'Add to Watchlist'}
              </Button>
              <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
                Trade Now
              </Button>
            </div>
          </div>
        </div>

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

            <TabsContent value="analysis">
              <div className="space-y-6">
                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-white mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    AI Analysis Breakdown
                  </h3>
                  {aiScores.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">No data available</div>
                  ) : (
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
                  )}
                </div>

                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                  <h3 className="text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-400" />
                    Price History
                  </h3>
                  {priceHistory.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">No data available</div>
                  ) : (
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
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="technical">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Technical Indicators</h3>
                {Object.keys(technicalIndicators).length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No data available</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(technicalIndicators).map(([key, value]) => (
                      <div key={key} className="bg-gray-900/50 rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-1">{key}</div>
                        <div className="text-xl text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="fundamentals">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
                <h3 className="text-white mb-4">Key Fundamentals</h3>
                {Object.keys(keyMetrics).length === 0 ? (
                  <div className="text-center py-12 text-gray-400">No data available</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(keyMetrics).map(([key, value]) => (
                      <div key={key} className="bg-gray-900/50 rounded-lg p-4">
                        <div className="text-sm text-gray-400 mb-1">{key}</div>
                        <div className="text-xl text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="recommendations">
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <Target className="w-6 h-6 text-cyan-400" />
                    <div>
                      <h3 className="text-white text-lg mb-1">AI Trading Recommendations</h3>
                      <p className="text-sm text-gray-400">Based on available analysis data</p>
                    </div>
                  </div>

                  {recommendations.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No data available</div>
                  ) : (
                    <div className="space-y-3">
                      {recommendations.map((rec, i) => (
                        <div key={i} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white capitalize">{rec.type}</span>
                            <div className="text-xl text-cyan-400">₹{rec.price}</div>
                          </div>
                          <div className="text-sm text-gray-400">{rec.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                      <div className="text-sm text-yellow-400 font-semibold mb-1">Risk Disclaimer</div>
                      <div className="text-xs text-gray-400">
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
