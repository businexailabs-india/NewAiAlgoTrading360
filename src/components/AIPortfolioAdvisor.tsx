import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Newspaper, BarChart2, Target, Zap, Clock, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LiveMarketData } from './LiveMarketData';
import { MarketSentimentAnalysis } from './MarketSentimentAnalysis';
import { AIRecommendations } from './AIRecommendations';
import { TrendingStocks } from './TrendingStocks';
import { AIAdvisorChat } from './AIAdvisorChat';

export function AIPortfolioAdvisor() {
  const [marketStatus, setMarketStatus] = useState<'open' | 'closed' | 'pre-open'>('open');
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30 animate-pulse">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl text-white">AI Portfolio Advisor</h2>
              <p className="text-sm text-gray-400">Live market analysis powered by GPT-4 & Real-time data</p>
            </div>
          </div>
        </div>

        {/* Market Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              marketStatus === 'open' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`}></div>
            <span className="text-sm text-gray-400">
              Market {marketStatus === 'open' ? 'Open' : marketStatus === 'pre-open' ? 'Pre-Open' : 'Closed'}
            </span>
          </div>
          <div className="text-sm text-gray-500">
            Updated: {formatTime(lastUpdated)}
          </div>
        </div>
      </div>

      {/* AI Alerts Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-green-400 mb-1">Opportunity Detected</div>
              <div className="text-xs text-gray-300">
                Banking sector showing strong momentum. Consider increasing allocation by 5%.
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-yellow-400 mb-1">Risk Alert</div>
              <div className="text-xs text-gray-300">
                Market volatility increased 15%. Review stop-loss levels on tech holdings.
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <Newspaper className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm text-blue-400 mb-1">News Impact</div>
              <div className="text-xs text-gray-300">
                Positive RBI policy announcement. Bullish sentiment for financial stocks.
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-gray-800 mb-6 flex-wrap h-auto">
          <TabsTrigger value="overview" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <BarChart2 className="w-4 h-4 mr-2" />
            Market Overview
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <TrendingUp className="w-4 h-4 mr-2" />
            Sentiment Analysis
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Target className="w-4 h-4 mr-2" />
            AI Recommendations
          </TabsTrigger>
          <TabsTrigger value="trending" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Zap className="w-4 h-4 mr-2" />
            Trending Now
          </TabsTrigger>
          <TabsTrigger value="chat" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Brain className="w-4 h-4 mr-2" />
            Ask AI Advisor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <LiveMarketData />
        </TabsContent>

        <TabsContent value="sentiment">
          <MarketSentimentAnalysis />
        </TabsContent>

        <TabsContent value="recommendations">
          <AIRecommendations />
        </TabsContent>

        <TabsContent value="trending">
          <TrendingStocks />
        </TabsContent>

        <TabsContent value="chat">
          <AIAdvisorChat />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
