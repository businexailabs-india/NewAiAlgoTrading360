import { useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Zap, Volume2, Eye } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { StockAnalysisModal } from './StockAnalysisModal';

const trendingStocks = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank', price: 1648.50, change: 3.42, volume: '12.5M', reason: 'Strong Q4 results', sentiment: 'bullish', strength: 92 },
  { symbol: 'INFY', name: 'Infosys', price: 1456.75, change: 2.87, volume: '8.9M', reason: 'Large deal wins', sentiment: 'bullish', strength: 88 },
  { symbol: 'RELIANCE', name: 'Reliance Ind.', price: 2456.30, change: -1.24, volume: '15.2M', reason: 'Profit booking', sentiment: 'bearish', strength: 65 },
  { symbol: 'TCS', name: 'TCS', price: 3678.90, change: 1.95, volume: '6.7M', reason: 'Dividend announcement', sentiment: 'bullish', strength: 85 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', price: 985.40, change: 2.34, volume: '18.3M', reason: 'NPA improvement', sentiment: 'bullish', strength: 90 }
];

const mostWatched = [
  { symbol: 'ADANIGREEN', watchers: '45.2K', change: 5.67, alert: 'Breakout Alert' },
  { symbol: 'TATASTEEL', watchers: '38.9K', change: -2.13, alert: 'Support Test' },
  { symbol: 'BAJFINANCE', watchers: '32.5K', change: 3.45, alert: 'New High' },
  { symbol: 'SUNPHARMA', watchers: '28.1K', change: 1.89, alert: 'Bullish Pattern' }
];

const volumeSurge = [
  { symbol: 'ZOMATO', volume: '250%', price: 145.60, change: 8.92 },
  { symbol: 'PAYTM', volume: '185%', price: 678.30, change: -4.56 },
  { symbol: 'NYKAA', volume: '142%', price: 234.75, change: 6.23 },
  { symbol: 'POLICYBZR', volume: '128%', price: 987.50, change: 3.45 }
];

export function TrendingStocks() {
  const [selectedStock, setSelectedStock] = useState<typeof trendingStocks[0] | null>(null);

  const handleAnalyze = (stock: typeof trendingStocks[0]) => {
    setSelectedStock(stock);
  };

  return (
    <div className="space-y-6">
      {/* AI Trending Stocks */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="text-white">AI-Detected Trending Stocks</h3>
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 ml-2">
            Live
          </Badge>
        </div>

        <div className="space-y-3">
          {trendingStocks.map((stock, i) => (
            <motion.div
              key={stock.symbol}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-cyan-500/50 transition-all"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div>
                      <h4 className="text-white">{stock.symbol}</h4>
                      <p className="text-sm text-gray-400">{stock.name}</p>
                    </div>
                    <Badge className={`${
                      stock.sentiment === 'bullish' 
                        ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {stock.sentiment}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-400">
                      <Volume2 className="w-4 h-4" />
                      <span>{stock.volume}</span>
                    </div>
                    <div className="text-gray-400">{stock.reason}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl text-white mb-1">₹{stock.price.toLocaleString()}</div>
                  <div className={`flex items-center gap-1 ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{stock.change >= 0 ? '+' : ''}{stock.change}%</span>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">Strength</div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        style={{ width: `${stock.strength}%` }}
                      ></div>
                    </div>
                    <span className="text-cyan-400 text-sm">{stock.strength}</span>
                  </div>
                </div>

                <Button 
                  size="sm" 
                  onClick={() => handleAnalyze(stock)}
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                >
                  Analyze
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Watched */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-purple-400" />
            <h3 className="text-white">Most Watched</h3>
          </div>
          
          <div className="space-y-3">
            {mostWatched.map((stock, i) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
              >
                <div>
                  <div className="text-white mb-1">{stock.symbol}</div>
                  <div className="text-xs text-gray-500">{stock.watchers} watchers</div>
                </div>
                <div className="text-right">
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 mb-1">
                    {stock.alert}
                  </Badge>
                  <div className={`text-sm ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Volume Surge */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Volume2 className="w-5 h-5 text-orange-400" />
            <h3 className="text-white">Unusual Volume Surge</h3>
          </div>
          
          <div className="space-y-3">
            {volumeSurge.map((stock, i) => (
              <motion.div
                key={stock.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
              >
                <div>
                  <div className="text-white mb-1">{stock.symbol}</div>
                  <div className="text-xs text-orange-400">Volume: +{stock.volume}</div>
                </div>
                <div className="text-right">
                  <div className="text-white mb-1">₹{stock.price.toLocaleString()}</div>
                  <div className={`text-sm ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Stock Analysis Modal */}
      {selectedStock && (
        <StockAnalysisModal 
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
