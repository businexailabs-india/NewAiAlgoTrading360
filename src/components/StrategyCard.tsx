import { motion } from 'motion/react';
import { TrendingUp, Copy, Play, Star, BarChart3, Code, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

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

interface StrategyCardProps {
  strategy: Strategy;
  index: number;
  onViewDetails?: () => void;
  onDeploy?: () => void | Promise<void>;
  onClone?: () => void | Promise<void>;
  busy?: boolean;
  statusHint?: string | null;
}

export function StrategyCard({
  strategy,
  index,
  onViewDetails,
  onDeploy,
  onClone,
  busy,
  statusHint
}: StrategyCardProps) {
  const chartData = strategy.chartData.map((value, idx) => ({ value, index: idx }));
  const isPositive = parseFloat(strategy.returns) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-orange-500/50 transition-all group cursor-pointer"
      onClick={onViewDetails}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white group-hover:text-orange-400 transition-colors">{strategy.name}</h3>
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
              {strategy.exchange}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>by {strategy.author}</span>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span>{strategy.rating}</span>
              <span className="text-gray-500">({strategy.reviews})</span>
            </div>
          </div>
        </div>

        <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">{strategy.category}</Badge>
      </div>

      <p className="text-sm text-gray-400 mb-4 line-clamp-2">{strategy.description}</p>

      <div className="mb-4 bg-gray-900/50 rounded-lg p-3 border border-gray-700">
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center">
          <div className={`text-lg ${isPositive ? 'text-green-400' : 'text-red-400'}`}>{strategy.returns}</div>
          <div className="text-xs text-gray-500">Returns</div>
        </div>
        <div className="text-center">
          <div className="text-lg text-cyan-400">{strategy.sharpe}</div>
          <div className="text-xs text-gray-500">Sharpe</div>
        </div>
        <div className="text-center">
          <div className="text-lg text-red-400">{strategy.drawdown}</div>
          <div className="text-xs text-gray-500">Drawdown</div>
        </div>
        <div className="text-center">
          <div className="text-lg text-blue-400">{strategy.winRate}</div>
          <div className="text-xs text-gray-500">Win Rate</div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <BarChart3 className="w-3 h-3" />
          <span>{strategy.trades} trades</span>
        </div>
        <div className="flex items-center gap-1">
          <Code className="w-3 h-3" />
          <span>Script</span>
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span>{strategy.deployed.toLocaleString()} deployed</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {strategy.tags.map((tag) => (
          <span key={tag} className="text-xs bg-gray-700/50 text-gray-300 px-2 py-1 rounded-md">
            {tag}
          </span>
        ))}
      </div>

      {statusHint ? <p className="text-xs text-cyan-300 mb-3 line-clamp-2">{statusHint}</p> : null}

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          disabled={busy || !onDeploy}
          onClick={() => void onDeploy?.()}
          className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
        >
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Deploy
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || !onClone}
          onClick={() => void onClone?.()}
          className="border-gray-700 hover:bg-gray-700/50"
        >
          <Copy className="w-4 h-4 mr-2" />
          Clone
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!onViewDetails}
          onClick={() => onViewDetails?.()}
          className="border-gray-700 hover:bg-gray-700/50"
          title="View code & details"
        >
          <Code className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}
