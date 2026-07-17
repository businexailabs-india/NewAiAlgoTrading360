import { motion } from 'motion/react';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { useMarketData } from '../contexts/MarketDataContext';

export function MarketSentimentDashboard() {
  const { sectorPerformance, marketBreadth } = useMarketData();
  const observed = marketBreadth
    ? marketBreadth.advances + marketBreadth.declines + marketBreadth.unchanged
    : 0;
  const advanceShare = observed && marketBreadth
    ? (marketBreadth.advances / observed) * 100
    : null;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          <h3 className="text-white">Market Breadth Sample</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          This is a direct breadth snapshot from the connected market API, not an AI sentiment score.
        </p>
        {!marketBreadth || observed === 0 ? (
          <div className="text-center py-10 text-gray-400">Market breadth data is unavailable.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Advances" value={marketBreadth.advances} className="text-green-400" />
            <Metric label="Declines" value={marketBreadth.declines} className="text-red-400" />
            <Metric label="Unchanged" value={marketBreadth.unchanged} className="text-gray-300" />
            <Metric label="Advance share" value={`${advanceShare!.toFixed(1)}%`} className="text-cyan-400" />
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <h3 className="text-white mb-4">Sector Performance</h3>
        {sectorPerformance.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Sector data is unavailable.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectorPerformance.map(sector => (
              <div key={sector.sector} className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-white">{sector.sector}</span>
                  <span className={`flex items-center gap-1 ${sector.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {sector.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">{sector.advancers} advances · {sector.decliners} declines</div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Metric({ label, value, className }: { label: string; value: number | string; className: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl ${className}`}>{value}</div>
    </div>
  );
}
