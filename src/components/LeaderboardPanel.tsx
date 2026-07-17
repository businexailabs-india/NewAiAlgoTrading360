import { motion } from 'motion/react';
import { X, Trophy } from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface LeaderboardPanelProps {
  onClose: () => void;
  strategies?: Array<{
    rank: number;
    name: string;
    author: string;
    returns: string;
    sharpe: string;
    trades: number;
  }>;
  authors?: Array<{
    rank: number;
    name: string;
    strategies: number;
    totalReturns: string;
    followers: number;
    avgRating: number;
  }>;
}

export function LeaderboardPanel({ onClose, strategies = [], authors = [] }: LeaderboardPanelProps) {
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
          {strategies.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No data available</div>
          ) : (
            <div className="space-y-3">
              {strategies.map((strategy, index) => (
                <motion.div
                  key={strategy.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-yellow-500/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10">
                      <div className="text-xl text-gray-400">#{strategy.rank}</div>
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
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="authors">
          {authors.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No data available</div>
          ) : (
            <div className="space-y-3">
              {authors.map((author, index) => (
                <motion.div
                  key={author.rank}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-yellow-500/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-10 h-10">
                      <div className="text-xl text-gray-400">#{author.rank}</div>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white mb-1">{author.name}</h4>
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
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
