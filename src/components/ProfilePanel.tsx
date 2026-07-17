import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Mail, Target, TrendingUp, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { portfolioService, PortfolioSummary } from '../services/portfolioService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export function ProfilePanel() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [trades, setTrades] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    Promise.allSettled([portfolioService.getSummary(), portfolioService.getTrades()])
      .then(([summaryResult, tradesResult]) => {
        if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
        if (tradesResult.status === 'fulfilled') setTrades(tradesResult.value);
      });
  }, []);

  const completed = trades.filter(trade => String(trade.status || '').toUpperCase() === 'COMPLETE');
  const wins = completed.filter(trade => Number(trade.pnl ?? trade.realizedPnL) > 0);
  const winRate = completed.length ? (wins.length / completed.length) * 100 : null;
  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-blue-500/20" />
        <div className="px-6 pb-6">
          <div className="flex items-center gap-5 -mt-10 mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white text-2xl border-4 border-gray-900">
              {initials}
            </div>
            <div className="mt-8">
              <h2 className="text-2xl text-white">{user?.name || 'Profile'}</h2>
              <p className="text-gray-400">{user?.email || 'Email unavailable'}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Portfolio P&L', summary ? `₹${summary.totalPnL.toLocaleString('en-IN')}` : '—', TrendingUp],
              ['Total Trades', trades.length ? String(trades.length) : '—', Activity],
              ['Win Rate', winRate == null ? '—' : `${winRate.toFixed(1)}%`, Target],
              ['Holdings', summary ? String(summary.holdingsCount) : '—', Activity]
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                  <Icon className="w-4 h-4 text-cyan-400" />{String(label)}
                </div>
                <div className="text-xl text-white">{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="details">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="details"><User className="w-4 h-4 mr-2" />Details</TabsTrigger>
          <TabsTrigger value="performance"><TrendingUp className="w-4 h-4 mr-2" />Performance</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6 space-y-4">
            <h3 className="text-white">Account Information</h3>
            <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
              <User className="w-5 h-5 text-cyan-400" />
              <div><div className="text-xs text-gray-500">Name</div><div className="text-white">{user?.name || '—'}</div></div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-900/50 rounded-lg">
              <Mail className="w-5 h-5 text-cyan-400" />
              <div><div className="text-xs text-gray-500">Email</div><div className="text-white">{user?.email || '—'}</div></div>
            </div>
            <p className="text-sm text-gray-500">Additional profile fields are not available from the current profile API.</p>
          </div>
        </TabsContent>
        <TabsContent value="performance">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-8 text-center text-gray-400">
            {trades.length ? `${trades.length} trades loaded from your account.` : 'No trade history is available.'}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
