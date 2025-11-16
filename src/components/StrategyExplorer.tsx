import { useState } from 'react';
import { motion } from 'motion/react';
import { Rocket, Filter, TrendingUp, Users, Code, Play, Copy, Star, BarChart3, Search, Trophy, Zap, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { StrategyCard } from './StrategyCard';
import { StrategyDetailModal } from './StrategyDetailModal';
import { LeaderboardPanel } from './LeaderboardPanel';

const classicStrategies = [
  {
    id: 1,
    name: 'Nifty Momentum Breakout',
    author: 'QuantConnect',
    category: 'Momentum',
    exchange: 'NSE',
    description: 'Captures momentum breakouts in Nifty 50 stocks using RSI and moving average crossovers with dynamic position sizing.',
    returns: '34.2%',
    sharpe: '2.14',
    drawdown: '-12.4%',
    winRate: '68%',
    trades: 156,
    tags: ['Momentum', 'Breakout', 'Nifty 50'],
    code: 'python',
    rating: 4.8,
    reviews: 124,
    deployed: 1240,
    chartData: [100, 108, 112, 118, 115, 125, 134]
  },
  {
    id: 2,
    name: 'BSE Mean Reversion Strategy',
    author: 'QuantConnect',
    category: 'Mean Reversion',
    exchange: 'BSE',
    description: 'Statistical arbitrage strategy exploiting mean reversion in BSE mid-cap stocks using Bollinger Bands and z-scores.',
    returns: '28.5%',
    sharpe: '1.92',
    drawdown: '-15.8%',
    winRate: '62%',
    trades: 287,
    tags: ['Mean Reversion', 'Statistical', 'Mid-Cap'],
    code: 'python',
    rating: 4.6,
    reviews: 98,
    deployed: 856,
    chartData: [100, 98, 105, 110, 107, 115, 128]
  },
  {
    id: 3,
    name: 'Sector Rotation Alpha',
    author: 'QuantConnect',
    category: 'Rotation',
    exchange: 'NSE',
    description: 'Dynamic sector rotation strategy that allocates capital to top-performing sectors based on relative strength and momentum indicators.',
    returns: '42.7%',
    sharpe: '2.35',
    drawdown: '-10.2%',
    winRate: '71%',
    trades: 89,
    tags: ['Rotation', 'Sector', 'Multi-Asset'],
    code: 'python',
    rating: 4.9,
    reviews: 156,
    deployed: 1890,
    chartData: [100, 112, 120, 128, 132, 138, 143]
  },
  {
    id: 4,
    name: 'Pairs Trading: Bank Stocks',
    author: 'QuantConnect',
    category: 'Pairs Trading',
    exchange: 'NSE',
    description: 'Market-neutral pairs trading strategy focusing on cointegrated banking stocks with statistical arbitrage opportunities.',
    returns: '22.1%',
    sharpe: '2.68',
    drawdown: '-6.5%',
    winRate: '74%',
    trades: 234,
    tags: ['Pairs Trading', 'Market Neutral', 'Banking'],
    code: 'python',
    rating: 4.7,
    reviews: 112,
    deployed: 1456,
    chartData: [100, 103, 108, 111, 114, 118, 122]
  }
];

const communityStrategies = [
  {
    id: 5,
    name: 'AI-Powered Sentiment Trader',
    author: 'raj_quantitative',
    category: 'Machine Learning',
    exchange: 'NSE',
    description: 'Uses NLP sentiment analysis from news and social media combined with technical indicators to predict stock movements.',
    returns: '38.9%',
    sharpe: '2.21',
    drawdown: '-13.7%',
    winRate: '65%',
    trades: 178,
    tags: ['AI/ML', 'Sentiment', 'News'],
    code: 'python',
    rating: 4.5,
    reviews: 87,
    deployed: 623,
    chartData: [100, 110, 115, 122, 119, 130, 139]
  },
  {
    id: 6,
    name: 'Options Income Strategy',
    author: 'priya_trader',
    category: 'Options',
    exchange: 'NSE',
    description: 'Conservative income strategy selling covered calls and cash-secured puts on liquid Nifty stocks with theta decay optimization.',
    returns: '19.4%',
    sharpe: '1.85',
    drawdown: '-8.9%',
    winRate: '81%',
    trades: 312,
    tags: ['Options', 'Income', 'Theta'],
    code: 'python',
    rating: 4.4,
    reviews: 76,
    deployed: 892,
    chartData: [100, 102, 105, 108, 110, 114, 119]
  },
  {
    id: 7,
    name: 'Intraday VWAP Strategy',
    author: 'amit_algo',
    category: 'Day Trading',
    exchange: 'NSE',
    description: 'High-frequency intraday strategy using VWAP, volume analysis, and order flow to capture short-term price movements.',
    returns: '51.2%',
    sharpe: '1.76',
    drawdown: '-18.3%',
    winRate: '59%',
    trades: 1456,
    tags: ['Intraday', 'VWAP', 'High Frequency'],
    code: 'python',
    rating: 4.3,
    reviews: 134,
    deployed: 445,
    chartData: [100, 115, 125, 130, 128, 142, 151]
  },
  {
    id: 8,
    name: 'Dividend Capture Plus',
    author: 'deepak_invest',
    category: 'Dividend',
    exchange: 'BSE',
    description: 'Systematic dividend capture strategy combined with momentum filters to maximize dividend income while avoiding value traps.',
    returns: '24.8%',
    sharpe: '2.12',
    drawdown: '-9.1%',
    winRate: '76%',
    trades: 92,
    tags: ['Dividend', 'Value', 'Income'],
    code: 'python',
    rating: 4.6,
    reviews: 68,
    deployed: 734,
    chartData: [100, 104, 108, 113, 116, 120, 125]
  }
];

export function StrategyExplorer() {
  const [filterExchange, setFilterExchange] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<typeof classicStrategies[0] | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const filterStrategies = (strategies: typeof classicStrategies) => {
    let filtered = strategies;
    
    // Search filter
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
    
    // Sort
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
    >
      {/* Header */}
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

        {/* Stats Overview */}
        <div className="flex gap-4">
          <div className="text-center bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl text-cyan-400">250+</div>
            <div className="text-xs text-gray-400">Strategies</div>
          </div>
          <div className="text-center bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl text-orange-400">12K+</div>
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

      {/* Leaderboard Panel */}
      {showLeaderboard && (
        <LeaderboardPanel onClose={() => setShowLeaderboard(false)} />
      )}

      {/* Search and Filters */}
      <div className="space-y-4 mb-6">
        {/* Search Bar */}
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

        {/* Filters Row */}
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

          {/* Quick Filter Badges */}
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

      {/* Tabs */}
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
          {filterStrategies(classicStrategies).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No strategies found matching your criteria.</p>
              <Button 
                onClick={() => { setSearchQuery(''); setFilterCategory('all'); setFilterExchange('all'); }}
                className="mt-4"
                variant="outline"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="community" className="mt-0">
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
          {filterStrategies(communityStrategies).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p>No strategies found matching your criteria.</p>
              <Button 
                onClick={() => { setSearchQuery(''); setFilterCategory('all'); setFilterExchange('all'); }}
                className="mt-4"
                variant="outline"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Strategy Detail Modal */}
      {selectedStrategy && (
        <StrategyDetailModal
          strategy={selectedStrategy}
          onClose={() => setSelectedStrategy(null)}
        />
      )}
    </motion.div>
  );
}