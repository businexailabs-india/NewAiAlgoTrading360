import { motion } from 'motion/react';
import { Brain, TrendingUp, BarChart2, Target, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LiveMarketData } from './LiveMarketData';
import { MarketSentimentDashboard } from './MarketSentimentDashboard';
import { AIRecommendations } from './AIRecommendations';
import { TrendingStocks } from './TrendingStocks';
import { AIAdvisorChat } from './AIAdvisorChat';

export function AIPortfolioAdvisor() {
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
              <p className="text-sm text-gray-400">Portfolio advisor using connected market and advisor services</p>
            </div>
          </div>
        </div>

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
          <MarketSentimentDashboard />
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
