import { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, TrendingUp, Zap, Filter, Download, Share2, Mic, Loader2, Radio } from 'lucide-react';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { StrategyPerformanceDashboard } from './StrategyPerformanceDashboard';
import { TradeAnalyticsPanel } from './TradeAnalyticsPanel';
import { AIAdvisorChat } from './AIAdvisorChat';
import { MarketSentimentDashboard } from './MarketSentimentDashboard';
import { AnomalyDetectionPanel } from './AnomalyDetectionPanel';
import { VoiceAssistant } from './VoiceAssistant';
import { PerformanceComparison } from './PerformanceComparison';
import { QuantConnectDashboard } from './QuantConnectDashboard';
import { useTradingDashboard } from '../hooks/useTradingDashboard';
import { useMarketData } from '../contexts/MarketDataContext';
import { LiveIndicesBar } from './LiveIndicesBar';

export function SmartTradingDashboard() {
  const [timeRange, setTimeRange] = useState('1M');
  const [strategyType, setStrategyType] = useState('all');
  const [marketSegment, setMarketSegment] = useState('all');
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const { summary, agents, orders, trades, loading } = useTradingDashboard(timeRange);
  const { isLive, lastUpdated } = useMarketData();

  const handleExport = () => {
    console.log('Exporting data to CSV/Excel...');
    // Implementation for export functionality
  };

  const handleShare = () => {
    console.log('Sharing report...');
    // Implementation for share functionality
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-500/30">
                <Activity className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl text-white">Smart AI Trading Analytics</h2>
                <p className="text-sm text-gray-400">Real-time strategy monitoring & AI-powered insights</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => setShowVoiceAssistant(true)}
              className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 hover:bg-purple-500/30"
            >
              <Mic className="w-4 h-4 mr-2 text-purple-400" />
              <span className="text-purple-400">EdgeX Voice</span>
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              className="border-gray-700 hover:bg-gray-800"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              className="border-gray-700 hover:bg-gray-800"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
          {loading ? (
            <div className="col-span-full flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : (
            <>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Total P&L</div>
            <div className={`text-xl ${(summary?.totalPnL ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ₹{(summary?.totalPnL ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Total Trades</div>
            <div className="text-xl text-white">{summary?.totalTrades ?? 0}</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Win Rate</div>
            <div className="text-xl text-cyan-400">{(summary?.winRate ?? 0).toFixed(1)}%</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Avg Return</div>
            <div className="text-xl text-green-400">{(summary?.avgReturn ?? 0).toFixed(2)}%</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Sharpe Ratio</div>
            <div className="text-xl text-purple-400">{(summary?.sharpeRatio ?? 0).toFixed(2)}</div>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Active Agents</div>
            <div className="text-xl text-cyan-400">{summary?.activeAgents ?? 0}</div>
          </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Live market indices strip */}
      <LiveIndicesBar />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Filters:</span>
        </div>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px] bg-gray-800 border-gray-700">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1M">1 Month</SelectItem>
            <SelectItem value="3M">3 Months</SelectItem>
            <SelectItem value="6M">6 Months</SelectItem>
            <SelectItem value="YTD">YTD</SelectItem>
            <SelectItem value="1Y">1 Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>

        <Select value={strategyType} onValueChange={setStrategyType}>
          <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700">
            <SelectValue placeholder="Strategy Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Strategies</SelectItem>
            <SelectItem value="intraday">Intraday</SelectItem>
            <SelectItem value="swing">Swing Trading</SelectItem>
            <SelectItem value="positional">Positional</SelectItem>
          </SelectContent>
        </Select>

        <Select value={marketSegment} onValueChange={setMarketSegment}>
          <SelectTrigger className="w-[160px] bg-gray-800 border-gray-700">
            <SelectValue placeholder="Market Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="futures">Futures</SelectItem>
            <SelectItem value="options">Options</SelectItem>
          </SelectContent>
        </Select>

        <Badge className={isLive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}>
          <Radio className={`w-3 h-3 mr-1 ${isLive ? 'animate-pulse' : ''}`} />
          {isLive ? 'Live' : 'Polling'}
          {lastUpdated && (
            <span className="ml-1 text-[10px] opacity-70">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </Badge>
      </motion.div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="bg-gray-800 mb-6 flex-wrap h-auto">
          <TabsTrigger value="performance" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <TrendingUp className="w-4 h-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="comparison" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <TrendingUp className="w-4 h-4 mr-2" />
            Comparison
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <Activity className="w-4 h-4 mr-2" />
            Trade Analytics
          </TabsTrigger>
          <TabsTrigger value="ai-advisor" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            <Zap className="w-4 h-4 mr-2" />
            AI Advisor
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            Market Sentiment
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">
            Anomaly Detection
          </TabsTrigger>
          <TabsTrigger value="quantconnect" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Zap className="w-4 h-4 mr-2" />
            QuantConnect
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <StrategyPerformanceDashboard timeRange={timeRange} agents={agents} />
        </TabsContent>

        <TabsContent value="comparison">
          <PerformanceComparison timeRange={timeRange} />
        </TabsContent>

        <TabsContent value="analytics">
          <TradeAnalyticsPanel timeRange={timeRange} trades={trades} orders={orders} />
        </TabsContent>

        <TabsContent value="ai-advisor">
          <AIAdvisorChat />
        </TabsContent>

        <TabsContent value="sentiment">
          <MarketSentimentDashboard />
        </TabsContent>

        <TabsContent value="anomalies">
          <AnomalyDetectionPanel />
        </TabsContent>

        <TabsContent value="quantconnect">
          <QuantConnectDashboard />
        </TabsContent>
      </Tabs>

      {/* Voice Assistant Modal */}
      {showVoiceAssistant && (
        <VoiceAssistant onClose={() => setShowVoiceAssistant(false)} />
      )}
    </div>
  );
}
