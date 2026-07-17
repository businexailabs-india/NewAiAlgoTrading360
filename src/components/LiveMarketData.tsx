import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { useMarketData } from '../contexts/MarketDataContext';
import { useState } from 'react';

// Color mapping for sectors
const sectorColors: Record<string, string> = {
  'IT': '#10b981',
  'BANK': '#06b6d4',
  'Banking': '#06b6d4',
  'AUTO': '#3b82f6',
  'Auto': '#3b82f6',
  'PHARMA': '#8b5cf6',
  'Pharma': '#8b5cf6',
  'FMCG': '#ef4444',
  'ENERGY': '#f97316',
  'Energy': '#f97316',
  'METAL': '#dc2626',
  'Metals': '#dc2626',
  'REALTY': '#b91c1c',
  'Realty': '#b91c1c'
};

export function LiveMarketData() {
  const { 
    indices, 
    sectorPerformance, 
    marketBreadth, 
    isLoading, 
    error,
    refreshData 
  } = useMarketData();
  
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setTimeout(() => setIsRefreshing(false), 1000);
  };
  if (isLoading && indices.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          Live Market Data
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-400 text-sm font-medium">Data Fetch Warning</p>
            <p className="text-yellow-300/70 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Major Indices */}
      <div>
        <h3 className="text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          Major Indices
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {indices.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-400">No data available</div>
          ) : (
            indices.slice(0, 4).map((index, i) => {
            const isPositive = index.change >= 0;
            return (
              <motion.div
                key={index.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-4"
              >
                <div className="mb-3">
                  <div className="text-sm text-gray-400 mb-1">{index.name}</div>
                  <div className="text-2xl text-white">{index.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                  <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    <span>{isPositive ? '+' : ''}{index.change.toFixed(2)}</span>
                    <span>({isPositive ? '+' : ''}{index.changePercent.toFixed(2)}%)</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-3">
                  High {index.high == null ? '—' : index.high.toLocaleString('en-IN')} · Low {index.low == null ? '—' : index.low.toLocaleString('en-IN')}
                </div>
              </motion.div>
            );
          })
          )}
        </div>
      </div>

      {/* Intraday Chart */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <h3 className="text-white mb-4">Intraday Performance</h3>
        <div className="flex items-center justify-center h-[180px] text-center text-gray-400">
          Historical intraday series is not available from the current market API.
        </div>
      </div>

      {/* Sector Performance Heatmap */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <h3 className="text-white mb-4">Sector Performance Heatmap</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {sectorPerformance.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-400">No data available</div>
          ) : (
            sectorPerformance.map((sector, i) => {
            const color = sectorColors[sector.sector] || '#6b7280';
            return (
              <motion.div
                key={sector.sector}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative overflow-hidden rounded-lg p-4 border border-gray-700"
                style={{
                  backgroundColor: `${color}15`
                }}
              >
                <div className="text-sm text-gray-300 mb-1">{sector.sector}</div>
                <div className={`text-xl ${sector.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {sector.advancers}↑ {sector.decliners}↓
                </div>
                <div 
                  className="absolute bottom-0 left-0 h-1 transition-all"
                  style={{
                    width: `${Math.min(Math.abs(sector.change) * 30, 100)}%`,
                    backgroundColor: color
                  }}
                ></div>
              </motion.div>
            );
          })
          )}
        </div>
      </div>

      {/* Market Breadth */}
      {marketBreadth && (marketBreadth.advances + marketBreadth.declines + marketBreadth.unchanged > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-2">Advances / Declines</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-green-400">{marketBreadth.advances.toLocaleString()}</span>
              <span className="text-gray-500">/</span>
              <span className="text-2xl text-red-400">{marketBreadth.declines.toLocaleString()}</span>
            </div>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-400" 
                style={{ 
                  width: `${marketBreadth.advances + marketBreadth.declines > 0 ? (marketBreadth.advances / (marketBreadth.advances + marketBreadth.declines)) * 100 : 0}%`
                }}
              ></div>
            </div>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-2">52-Week Highs / Lows</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl text-green-400">{marketBreadth.fiftyTwoWeekHighs}</span>
              <span className="text-gray-500">/</span>
              <span className="text-2xl text-red-400">{marketBreadth.fiftyTwoWeekLows}</span>
            </div>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-2">FII Activity (Cr)</div>
            <div className={`text-2xl ${marketBreadth.fiiActivity >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {marketBreadth.fiiActivity >= 0 ? '+' : ''}₹{Math.abs(marketBreadth.fiiActivity).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {marketBreadth.fiiActivity >= 0 ? 'Net Buying' : 'Net Selling'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
