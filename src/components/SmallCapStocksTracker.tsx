import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Star, Search, Filter } from 'lucide-react';
import { useMarketData } from '../contexts/MarketDataContext';
import { useState } from 'react';

export function SmallCapStocksTracker() {
  const { smallCapStocks, topGainers, topLosers, isLoading } = useMarketData();
  const [activeTab, setActiveTab] = useState<'smallcap' | 'gainers' | 'losers'>('smallcap');
  const [searchQuery, setSearchQuery] = useState('');

  const getDisplayStocks = () => {
    switch (activeTab) {
      case 'gainers':
        return topGainers;
      case 'losers':
        return topLosers;
      default:
        return smallCapStocks;
    }
  };

  const displayStocks = getDisplayStocks().filter(stock =>
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading && displayStocks.length === 0) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <div className="text-center text-gray-400">Loading stocks...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white text-xl font-semibold flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" />
          Stock Tracker
        </h3>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search stocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-cyan-500 w-64"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('smallcap')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'smallcap'
              ? 'bg-cyan-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Small Cap ({smallCapStocks.length})
        </button>
        <button
          onClick={() => setActiveTab('gainers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'gainers'
              ? 'bg-green-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Top Gainers ({topGainers.length})
        </button>
        <button
          onClick={() => setActiveTab('losers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'losers'
              ? 'bg-red-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Top Losers ({topLosers.length})
        </button>
      </div>

      {/* Stocks Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Symbol</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Name</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Price</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Change</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Change %</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Volume</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">High/Low</th>
            </tr>
          </thead>
          <tbody>
            {displayStocks.map((stock, index) => {
              const isPositive = stock.change >= 0;
              return (
                <motion.tr
                  key={stock.symbol}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{stock.symbol}</span>
                      <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                        {stock.exchange}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm max-w-xs truncate">
                    {stock.name}
                  </td>
                  <td className="py-3 px-4 text-right text-white font-medium">
                    ₹{stock.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3 px-4 text-right font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : ''}{stock.change.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span className="font-medium">
                        {isPositive ? '+' : ''}{stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400 text-sm">
                    {(stock.volume / 1000).toFixed(1)}K
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400 text-sm">
                    <div className="flex flex-col">
                      <span className="text-green-400">H: {stock.high.toFixed(2)}</span>
                      <span className="text-red-400">L: {stock.low.toFixed(2)}</span>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        {displayStocks.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No stocks found matching your search' : 'No stocks available'}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Average Change</div>
          <div className={`text-xl font-semibold ${
            displayStocks.reduce((sum, s) => sum + s.changePercent, 0) / displayStocks.length >= 0
              ? 'text-green-400'
              : 'text-red-400'
          }`}>
            {displayStocks.length > 0
              ? `${(displayStocks.reduce((sum, s) => sum + s.changePercent, 0) / displayStocks.length).toFixed(2)}%`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Total Volume</div>
          <div className="text-xl font-semibold text-cyan-400">
            {displayStocks.length > 0
              ? `${(displayStocks.reduce((sum, s) => sum + s.volume, 0) / 1000000).toFixed(2)}M`
              : 'N/A'}
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Stocks Displayed</div>
          <div className="text-xl font-semibold text-white">
            {displayStocks.length}
          </div>
        </div>
      </div>
    </div>
  );
}
