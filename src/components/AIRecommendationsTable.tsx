import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from './ui/badge';

interface Recommendation {
  symbol: string;
  sector: string;
  current: number;
  target: number;
  action: string;
  quantity: number;
  taxImpact: number;
  confidence: number;
}

interface AIRecommendationsTableProps {
  recommendations?: Recommendation[];
}

export function AIRecommendationsTable({ recommendations = [] }: AIRecommendationsTableProps) {
  return (
    <div>
      <h3 className="text-xl text-white mb-4">AI Recommendations</h3>
      {recommendations.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-gray-700 rounded-xl bg-gray-800/30">
          No data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-sm text-gray-400 pb-3">Symbol</th>
                <th className="text-left text-sm text-gray-400 pb-3">Sector</th>
                <th className="text-right text-sm text-gray-400 pb-3">Current %</th>
                <th className="text-right text-sm text-gray-400 pb-3">Target %</th>
                <th className="text-center text-sm text-gray-400 pb-3">Action</th>
                <th className="text-right text-sm text-gray-400 pb-3">Quantity</th>
                <th className="text-right text-sm text-gray-400 pb-3">Tax Impact</th>
                <th className="text-right text-sm text-gray-400 pb-3">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec, index) => (
                <motion.tr
                  key={rec.symbol}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-4">
                    <span className="text-white">{rec.symbol}</span>
                  </td>
                  <td className="py-4">
                    <span className="text-gray-400 text-sm">{rec.sector}</span>
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-white">{rec.current}%</span>
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-cyan-400">{rec.target}%</span>
                  </td>
                  <td className="py-4 text-center">
                    {rec.action === 'Buy' && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Buy
                      </Badge>
                    )}
                    {rec.action === 'Sell' && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <TrendingDown className="w-3 h-3 mr-1" />
                        Sell
                      </Badge>
                    )}
                    {rec.action === 'Hold' && (
                      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        <Minus className="w-3 h-3 mr-1" />
                        Hold
                      </Badge>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    <span className="text-white">{rec.quantity > 0 ? rec.quantity : '-'}</span>
                  </td>
                  <td className="py-4 text-right">
                    <span className={rec.taxImpact > 0 ? 'text-red-400' : 'text-gray-500'}>
                      {rec.taxImpact > 0 ? `₹${rec.taxImpact.toLocaleString()}` : '-'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                          style={{ width: `${rec.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-cyan-400 text-sm w-8">{rec.confidence}%</span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
