import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Volume2, Eye, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { StockAnalysisModal } from './StockAnalysisModal';
import { marketDataService, StockQuote } from '../services/marketDataService';

type TrendingStock = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: string;
  reason: string;
  sentiment: 'bullish' | 'bearish';
  strength: number;
};

function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`;
  return String(volume || 0);
}

function mapQuote(q: StockQuote): TrendingStock {
  return {
    symbol: q.symbol,
    name: q.name || q.symbol,
    price: q.price,
    change: q.changePercent,
    volume: formatVolume(q.volume),
    reason: '',
    sentiment: q.changePercent >= 0 ? 'bullish' : 'bearish',
    strength: 0
  };
}

export function TrendingStocks() {
  const [trendingStocks, setTrendingStocks] = useState<TrendingStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStock, setSelectedStock] = useState<TrendingStock | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const gainers = await marketDataService.fetchTopGainers(10);
        if (!cancelled) {
          setTrendingStocks((gainers ?? []).map(mapQuote));
        }
      } catch {
        if (!cancelled) setTrendingStocks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleAnalyze = (stock: TrendingStock) => {
    setSelectedStock(stock);
  };

  return (
    <div className="space-y-6">
      {/* Top Gainers */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-green-400" />
          <h3 className="text-white">Top Gainers</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading market data...
          </div>
        ) : trendingStocks.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data available</div>
        ) : (
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
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl text-white mb-1">₹{stock.price.toLocaleString()}</div>
                    <div className={`flex items-center gap-1 ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {stock.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%</span>
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
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Watched */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-purple-400" />
            <h3 className="text-white">Most Watched</h3>
          </div>
          <div className="text-center py-8 text-gray-400">No data available</div>
        </div>

        {/* Volume Surge */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Volume2 className="w-5 h-5 text-orange-400" />
            <h3 className="text-white">Unusual Volume Surge</h3>
          </div>
          <div className="text-center py-8 text-gray-400">No data available</div>
        </div>
      </div>

      {selectedStock && (
        <StockAnalysisModal 
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}
