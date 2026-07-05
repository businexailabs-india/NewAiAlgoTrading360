import { useMarketData } from '../contexts/MarketDataContext';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function LiveIndicesBar() {
  const { indices, isLive, lastUpdated } = useMarketData();

  if (!indices.length) return null;

  return (
    <div className="flex flex-wrap gap-3 p-3 bg-gray-900/60 border border-gray-800 rounded-xl overflow-x-auto">
      {indices.slice(0, 6).map(idx => (
        <div key={idx.name} className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700 min-w-[140px]">
          <span className="text-xs text-gray-400 truncate">{idx.name}</span>
          <span className="text-sm text-white font-medium">{idx.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
          <span className={`text-xs flex items-center ${idx.changePercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {idx.changePercent >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
            {idx.changePercent >= 0 ? '+' : ''}{idx.changePercent.toFixed(2)}%
          </span>
        </div>
      ))}
      <div className="flex items-center text-[10px] text-gray-500 ml-auto">
        {isLive ? '● Live' : '○ Polling'} {lastUpdated?.toLocaleTimeString()}
      </div>
    </div>
  );
}
