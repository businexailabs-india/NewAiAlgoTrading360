import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';
import { portfolioService, PortfolioSummary, PortfolioView } from '../services/portfolioService';

export function PortfolioHeader() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioView | null>(null);

  useEffect(() => {
    Promise.allSettled([portfolioService.getSummary(), portfolioService.getPortfolios()])
      .then(([summaryResult, portfoliosResult]) => {
        if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
        if (portfoliosResult.status === 'fulfilled') setPortfolio(portfoliosResult.value[0] ?? null);
      });
  }, []);

  const dailyChange = portfolio?.dayPnL;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-2xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="text-gray-400 mb-2">{portfolio?.name || 'No portfolio selected'}</h1>
          <div className="flex items-baseline gap-4">
            <span className="text-4xl text-white">
              {summary ? `₹${summary.totalCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </span>
            {dailyChange == null ? (
              <span className="text-sm text-gray-500">Day change unavailable</span>
            ) : (
              <div className={`flex items-center gap-1 ${dailyChange >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                {dailyChange >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                <span className="text-xl">{dailyChange >= 0 ? '+' : ''}₹{Math.abs(dailyChange).toLocaleString('en-IN')}</span>
                <span className="text-sm text-gray-500 ml-2">Today</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-gray-800/50 border border-gray-700 rounded-xl px-6 py-3">
          <div>
            <div className="text-xs text-gray-400">Portfolio data</div>
            <div className="text-gray-300">{summary ? `${summary.holdingsCount} holdings` : 'Unavailable'}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
