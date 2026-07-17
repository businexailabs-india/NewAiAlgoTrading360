import { useState } from 'react';
import { motion } from 'motion/react';
import { Rocket, Filter, Users, Code, Search, Trophy, Zap, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { StrategyCard } from './StrategyCard';
import { StrategyDetailModal } from './StrategyDetailModal';
import { LeaderboardPanel } from './LeaderboardPanel';

export type ExplorerStrategy = {
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
};

interface StrategyExplorerProps {
  classicStrategies?: ExplorerStrategy[];
  communityStrategies?: ExplorerStrategy[];
}

export function StrategyExplorer({
  classicStrategies = [],
  communityStrategies = []
}: StrategyExplorerProps) {
  const [filterExchange, setFilterExchange] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<ExplorerStrategy | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const filterStrategies = (strategies: ExplorerStrategy[]) => {
    let filtered = strategies;
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    if (filterExchange !== 'all') {
      filtered = filtered.filter(s => s.exchange === filterExchange);
    }
    
    if (filterCategory !== 'all') {
      filtered = filtered.filter(s => s.category === filterCategory);
    }
    
    if (sortBy === 'popular') {
      filtered = [...filtered].sort((a, b) => b.deployed - a.deployed);
    } else if (sortBy === 'returns') {
      filtered = [...filtered].sort((a, b) => parseFloat(b.returns) - parseFloat(a.returns));
    } else if (sortBy === 'sharpe') {
      filtered = [...filtered].sort((a, b) => parseFloat(b.sharpe) - parseFloat(a.sharpe));
    } else if (sortBy === 'rating') {
      filtered = [...filtered].sort((a, b) => b.rating - a.rating);
    }
    
    return filtered;
  };

  const totalStrategies = classicStrategies.length + communityStrategies.length;
  const totalDeployments = [...classicStrategies, ...communityStrategies].reduce((s, x) => s + x.deployed, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
    >
      <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg border border-orange-500/30">
              <Rocket className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-2xl text-white">Strategy Explorer</h2>
              <p className="text-sm text-gray-400">Curated strategies for NSE & BSE markets powered by QuantConnect</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="text-center bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl text-cyan-400">{totalStrategies || '—'}</div>
            <div className="text-xs text-gray-400">Strategies</div>
          </div>
          <div className="text-center bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl text-orange-400">{totalDeployments || '—'}</div>
            <div className="text-xs text-gray-400">Deployments</div>
          </div>
          <Button 
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 hover:bg-yellow-500/30"
          >
            <Trophy className="w-4 h-4 mr-2 text-yellow-400" />
            <span className="text-yellow-400">Leaderboard</span>
          </Button>
        </div>
      </div>

      {showLeaderboard && (
        <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />
      )}

      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search strategies by name, tags, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white h-12"
          />
        </div>

        <div className="flex flex-wrap gap-4 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filters:</span>
          </div>
          
          <Select value={filterExchange} onValueChange={setFilterExchange}>
            <SelectTrigger className="w-[140px] bg-gray-900 border-gray-700">
              <SelectValue placeholder="Exchange" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exchanges</SelectItem>
              <SelectItem value="NSE">NSE</SelectItem>
              <SelectItem value="BSE">BSE</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Momentum">Momentum</SelectItem>
              <SelectItem value="Mean Reversion">Mean Reversion</SelectItem>
              <SelectItem value="Rotation">Rotation</SelectItem>
              <SelectItem value="Pairs Trading">Pairs Trading</SelectItem>
              <SelectItem value="Machine Learning">Machine Learning</SelectItem>
              <SelectItem value="Options">Options</SelectItem>
              <SelectItem value="Day Trading">Day Trading</SelectItem>
              <SelectItem value="Dividend">Dividend</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] bg-gray-900 border-gray-700">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="returns">Highest Returns</SelectItem>
              <SelectItem value="sharpe">Best Sharpe</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 cursor-pointer hover:bg-green-500/30">
              <Zap className="w-3 h-3 mr-1" />
              Live Now
            </Badge>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 cursor-pointer hover:bg-purple-500/30">
              <Clock className="w-3 h-3 mr-1" />
              Recently Added
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="classic" className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-2 bg-gray-800 mb-6">
          <TabsTrigger value="classic" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Code className="w-4 h-4 mr-2" />
            Classic Strategies
          </TabsTrigger>
          <TabsTrigger value="community" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400">
            <Users className="w-4 h-4 mr-2" />
            Community Highlights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="classic" className="mt-0">
          {filterStrategies(classicStrategies).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filterStrategies(classicStrategies).map((strategy, index) => (
                <StrategyCard 
                  key={strategy.id} 
                  strategy={strategy} 
                  index={index}
                  onViewDetails={() => setSelectedStrategy(strategy)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="community" className="mt-0">
          {filterStrategies(communityStrategies).length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>No data available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filterStrategies(communityStrategies).map((strategy, index) => (
                <StrategyCard 
                  key={strategy.id} 
                  strategy={strategy} 
                  index={index}
                  onViewDetails={() => setSelectedStrategy(strategy)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedStrategy && (
        <StrategyDetailModal
          strategy={selectedStrategy}
          onClose={() => setSelectedStrategy(null)}
        />
      )}
    </motion.div>
  );
}
