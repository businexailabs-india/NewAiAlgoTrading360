import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';

export function PortfolioHeader() {
  const portfolioValue = 2847325.50;
  const dailyChange = 2.34;
  const aiSentiment = 'Bullish';

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-gray-400 mb-2">Smart Portfolio Alpha</h1>
          <div className="flex items-baseline gap-4">
            <span className="text-4xl text-white">₹{portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <div className={`flex items-center gap-1 ${dailyChange >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
              {dailyChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              <span className="text-xl">{dailyChange >= 0 ? '+' : ''}{dailyChange}%</span>
              <span className="text-sm text-gray-500 ml-2">Today</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl px-6 py-3">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></div>
          <div>
            <div className="text-xs text-gray-400">AI Sentiment</div>
            <div className="text-cyan-400">{aiSentiment}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
