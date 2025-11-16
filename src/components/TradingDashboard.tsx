import { useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Brain, Activity, BarChart3, Download, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { StrategyPerformanceDashboard } from './trading/StrategyPerformanceDashboard';
import { AIStrategyAnalyzer } from './trading/AIStrategyAnalyzer';
import { LiveTradeMonitor } from './trading/LiveTradeMonitor';
import { PerformanceMetrics } from './trading/PerformanceMetrics';
import { AIInsightsEngine } from './trading/AIInsightsEngine';
import { Badge } from './ui/badge';

export function TradingDashboard() {
  const [dateRange, setDateRange] = useState('1M');
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  const handleExportCSV = () => {
    console.log('Exporting to CSV...');
    // Implementation for CSV export
  };

  const handleShareReport = () => {
    console.log('Sharing report...');
    // Implementation for report sharing
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-lg border border-blue-500/30">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl text-white">Smart AI Trading Analytics</h1>
                <p className="text-sm text-gray-400">EdgeXAi Labs - Real-time Strategy Performance & AI Insights</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleExportCSV}
              variant="outline" 
              className="border-gray-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              onClick={handleShareReport}
              variant="outline" 
              className="border-gray-700"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share Report
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Total P&L (MTD)</div>
            <div className="text-2xl text-green-400">+₹2,45,680</div>
            <div className="text-xs text-green-400 mt-1">+18.4%</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Active Strategies</div>
            <div className="text-2xl text-cyan-400">12</div>
            <div className="text-xs text-gray-400 mt-1">8 profitable</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Win Rate</div>
            <div className="text-2xl text-blue-400">73.5%</div>
            <div className="text-xs text-gray-400 mt-1">156/212 trades</div>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">AI Confidence</div>
            <div className="text-2xl text-purple-400">89%</div>
            <div className="text-xs text-gray-400 mt-1">High accuracy</div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="bg-gray-800 flex-wrap h-auto">
          <TabsTrigger value="performance" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
            <BarChart3 className="w-4 h-4 mr-2" />
            Performance Analytics
          </TabsTrigger>
          <TabsTrigger value="ai-analyzer" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Brain className="w-4 h-4 mr-2" />
            AI Strategy Analyzer
          </TabsTrigger>
          <TabsTrigger value="live-monitor" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <Activity className="w-4 h-4 mr-2" />
            Live Monitor
            <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>
          </TabsTrigger>
          <TabsTrigger value="ai-insights" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <TrendingUp className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <StrategyPerformanceDashboard 
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            onStrategySelect={setSelectedStrategy}
          />
        </TabsContent>

        <TabsContent value="ai-analyzer">
          <AIStrategyAnalyzer 
            selectedStrategy={selectedStrategy}
          />
        </TabsContent>

        <TabsContent value="live-monitor">
          <LiveTradeMonitor />
        </TabsContent>

        <TabsContent value="ai-insights">
          <AIInsightsEngine />
        </TabsContent>
      </Tabs>

      {/* Performance Metrics Overview */}
      <PerformanceMetrics dateRange={dateRange} />
    </motion.div>
  );
}
