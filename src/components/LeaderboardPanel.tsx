import { motion } from 'motion/react';
import { X, Trophy, Medal, Award, TrendingUp, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface LeaderboardPanelProps {
  onClose: () => void;
}

const topStrategies = [
  { rank: 1, name: 'Sector Rotation Alpha', author: 'QuantConnect', returns: '42.7%', sharpe: '2.35', trades: 89, icon: Trophy, color: 'text-yellow-400' },
  { rank: 2, name: 'AI-Powered Sentiment Trader', author: 'raj_quantitative', returns: '38.9%', sharpe: '2.21', trades: 178, icon: Medal, color: 'text-gray-300' },
  { rank: 3, name: 'Nifty Momentum Breakout', author: 'QuantConnect', returns: '34.2%', sharpe: '2.14', trades: 156, icon: Award, color: 'text-orange-400' },
  { rank: 4, name: 'BSE Mean Reversion Strategy', author: 'QuantConnect', returns: '28.5%', sharpe: '1.92', trades: 287, icon: null, color: 'text-gray-400' },
  { rank: 5, name: 'Dividend Capture Plus', author: 'deepak_invest', returns: '24.8%', sharpe: '2.12', trades: 92, icon: null, color: 'text-gray-400' },
];

const topAuthors = [
  { rank: 1, name: 'QuantConnect', strategies: 45, totalReturns: '1,245%', followers: 5420, avgRating: 4.8 },
  { rank: 2, name: 'raj_quantitative', strategies: 23, totalReturns: '892%', followers: 3210, avgRating: 4.6 },
  { rank: 3, name: 'priya_trader', strategies: 18, totalReturns: '745%', followers: 2890, avgRating: 4.5 },
  { rank: 4, name: 'amit_algo', strategies: 31, totalReturns: '1,034%', followers: 2650, avgRating: 4.4 },
  { rank: 5, name: 'deepak_invest', strategies: 15, totalReturns: '623%', followers: 2340, avgRating: 4.7 },
];

export function LeaderboardPanel({ onClose }: LeaderboardPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-red-500/10 border border-yellow-500/30 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h3 className="text-xl text-white">Leaderboard</h3>
            <p className="text-sm text-gray-400">Top performing strategies and authors</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="hover:bg-gray-800"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <Tabs defaultValue="strategies" className="w-full">
        <TabsList className="bg-gray-800 mb-6">
          <TabsTrigger value="strategies" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
            Top Strategies
          </TabsTrigger>
          <TabsTrigger value="authors" className="data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-400">
            Top Authors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strategies">
          <div className="space-y-3">
            {topStrategies.map((strategy, index) => {
              const Icon = strategy.icon;
              return (
                <motion.div
                  key={strategy.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-yellow-500/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10">
                      {Icon ? (
                        <Icon className={`w-6 h-6 ${strategy.color}`} />
                      ) : (
                        <div className={`text-xl ${strategy.color}`}>#{strategy.rank}</div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="text-white mb-1">{strategy.name}</h4>
                      <p className="text-sm text-gray-400">by {strategy.author}</p>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="text-sm text-gray-400">Returns</div>
                          <div className="text-green-400">{strategy.returns}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Sharpe</div>
                          <div className="text-cyan-400">{strategy.sharpe}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-400">Trades</div>
                          <div className="text-white">{strategy.trades}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="authors">
          <div className="space-y-3">
            {topAuthors.map((author, index) => (
              <motion.div
                key={author.rank}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-yellow-500/50 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-10 h-10">
                    {index < 3 ? (
                      <div className={`text-2xl ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : 'text-orange-400'}`}>
                        #{author.rank}
                      </div>
                    ) : (
                      <div className="text-xl text-gray-400">#{author.rank}</div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="text-white mb-1 flex items-center gap-2">
                      {author.name}
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm text-gray-400">{author.avgRating}</span>
                      </div>
                    </h4>
                    <p className="text-sm text-gray-400">{author.strategies} strategies • {author.followers.toLocaleString()} followers</p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-gray-400">Total Returns</div>
                    <div className="text-xl text-green-400">{author.totalReturns}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
