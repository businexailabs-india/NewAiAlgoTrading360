import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  Activity,
  ThermometerSun,
  Info
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';

interface StrategyHeatMapAnalysisProps {
  strategyName: string;
  timePerformanceData?: Array<Record<string, string | number>>;
  stockPerformanceData?: Array<Record<string, string | number>>;
  marketConditionData?: Array<{ condition: string; vix: string; nifty: string; result: number }>;
  weeklyPerformanceData?: Array<Record<string, string | number>>;
  summary?: { winRate: string; avgWin: string; avgLoss: string; sharpe: string };
}

export function StrategyHeatMapAnalysis({
  strategyName,
  timePerformanceData = [],
  stockPerformanceData = [],
  marketConditionData = [],
  weeklyPerformanceData = [],
  summary
}: StrategyHeatMapAnalysisProps) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-6"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <ThermometerSun className="w-8 h-8 text-purple-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl text-white mb-2">Heat Map Analysis</h2>
              <p className="text-gray-300">
                Visual performance analysis of <span className="text-purple-400 font-semibold">{strategyName}</span> across 
                different time periods, market conditions, and stocks
              </p>
            </div>
          </div>
          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
            Advanced Analytics
          </Badge>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4"
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-cyan-400 mb-1">How to Read Heat Maps</h4>
            <p className="text-sm text-gray-300">
              <span className="text-green-400">Green cells</span> indicate positive performance, 
              <span className="text-red-400"> red cells</span> indicate losses, and 
              <span className="text-gray-400"> gray cells</span> indicate neutral performance.
            </p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="intraday" className="w-full">
        <TabsList className="bg-gray-800 mb-6 flex-wrap h-auto">
          <TabsTrigger value="intraday" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Clock className="w-4 h-4 mr-2" />
            Intraday Performance
          </TabsTrigger>
          <TabsTrigger value="stocks" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <TrendingUp className="w-4 h-4 mr-2" />
            Stock-wise Performance
          </TabsTrigger>
          <TabsTrigger value="market" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Activity className="w-4 h-4 mr-2" />
            Market Conditions
          </TabsTrigger>
          <TabsTrigger value="weekly" className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
            <Calendar className="w-4 h-4 mr-2" />
            Weekly Pattern
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intraday">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <h3 className="text-white text-xl mb-1">Intraday Time-slot Performance</h3>
            <p className="text-sm text-gray-400 mb-6">Average return (%) by day and time slot</p>
            {timePerformanceData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No data available</div>
            ) : (
              <div className="text-center py-8 text-gray-400">Heatmap data loaded ({timePerformanceData.length} rows)</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="stocks">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <h3 className="text-white text-xl mb-1">Stock-wise Monthly Performance</h3>
            <p className="text-sm text-gray-400 mb-6">Average return (%) by stock across months</p>
            {stockPerformanceData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No data available</div>
            ) : (
              <div className="text-center py-8 text-gray-400">Heatmap data loaded ({stockPerformanceData.length} rows)</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="market">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <h3 className="text-white text-xl mb-1">Performance by Market Conditions</h3>
            <p className="text-sm text-gray-400 mb-6">Strategy performance across different market scenarios</p>
            {marketConditionData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No data available</div>
            ) : (
              <div className="text-center py-8 text-gray-400">Condition data loaded ({marketConditionData.length} rows)</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="weekly">
          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
            <h3 className="text-white text-xl mb-1">Weekly Performance Pattern</h3>
            <p className="text-sm text-gray-400 mb-6">Average daily returns by week of the month</p>
            {weeklyPerformanceData.length === 0 ? (
              <div className="text-center py-16 text-gray-400">No data available</div>
            ) : (
              <div className="text-center py-8 text-gray-400">Weekly data loaded ({weeklyPerformanceData.length} rows)</div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white text-xl mb-4">Strategy Performance Summary</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Win Rate</div>
            <div className="text-2xl text-green-400 mb-1">{summary?.winRate ?? '—'}</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Avg Win</div>
            <div className="text-2xl text-green-400 mb-1">{summary?.avgWin ?? '—'}</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Avg Loss</div>
            <div className="text-2xl text-red-400 mb-1">{summary?.avgLoss ?? '—'}</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Sharpe Ratio</div>
            <div className="text-2xl text-cyan-400 mb-1">{summary?.sharpe ?? '—'}</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
