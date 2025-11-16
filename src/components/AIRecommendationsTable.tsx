import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from './ui/badge';

const recommendations = [
  {
    symbol: 'RELIANCE',
    sector: 'Energy',
    current: 18.5,
    target: 15.0,
    action: 'Sell',
    quantity: 45,
    taxImpact: 12500,
    confidence: 92
  },
  {
    symbol: 'TCS',
    sector: 'Technology',
    current: 22.3,
    target: 25.0,
    action: 'Buy',
    quantity: 35,
    taxImpact: 0,
    confidence: 88
  },
  {
    symbol: 'HDFCBANK',
    sector: 'Finance',
    current: 24.8,
    target: 25.0,
    action: 'Hold',
    quantity: 0,
    taxImpact: 0,
    confidence: 76
  },
  {
    symbol: 'INFY',
    sector: 'Technology',
    current: 7.2,
    target: 10.0,
    action: 'Buy',
    quantity: 80,
    taxImpact: 0,
    confidence: 85
  },
  {
    symbol: 'ITC',
    sector: 'Consumer',
    current: 12.1,
    target: 10.0,
    action: 'Sell',
    quantity: 60,
    taxImpact: 8900,
    confidence: 79
  },
  {
    symbol: 'SUNPHARMA',
    sector: 'Healthcare',
    current: 15.1,
    target: 18.0,
    action: 'Buy',
    quantity: 50,
    taxImpact: 0,
    confidence: 91
  }
];

export function AIRecommendationsTable() {
  return (
    <div>
      <h3 className="text-xl text-white mb-4">AI Recommendations</h3>
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
    </div>
  );
}
