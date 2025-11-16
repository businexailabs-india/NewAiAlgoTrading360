import { motion } from 'motion/react';
import { useState } from 'react';
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  BarChart3, 
  Activity,
  ThermometerSun,
  Target,
  AlertCircle,
  Info
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

// Mock data - Strategy performance across different dimensions
const timePerformanceData = [
  { day: 'Mon', '9:15-10:00': 2.3, '10:00-11:00': 1.8, '11:00-12:00': -0.5, '12:00-13:00': 0.8, '13:00-14:00': 1.2, '14:00-15:00': 2.1, '15:00-15:30': 1.5 },
  { day: 'Tue', '9:15-10:00': 1.9, '10:00-11:00': 2.4, '11:00-12:00': 1.1, '12:00-13:00': -0.3, '13:00-14:00': 1.8, '14:00-15:00': 2.3, '15:00-15:30': 1.9 },
  { day: 'Wed', '9:15-10:00': 3.1, '10:00-11:00': 1.5, '11:00-12:00': 0.9, '12:00-13:00': 1.4, '13:00-14:00': 2.2, '14:00-15:00': 1.7, '15:00-15:30': 2.8 },
  { day: 'Thu', '9:15-10:00': 1.2, '10:00-11:00': 2.8, '11:00-12:00': 1.6, '12:00-13:00': 0.5, '13:00-14:00': -0.7, '14:00-15:00': 1.9, '15:00-15:30': 2.1 },
  { day: 'Fri', '9:15-10:00': 2.7, '10:00-11:00': 1.9, '11:00-12:00': 2.4, '12:00-13:00': 1.1, '13:00-14:00': 1.5, '14:00-15:00': 0.8, '15:00-15:30': -0.4 }
];

const stockPerformanceData = [
  { stock: 'RELIANCE', Jan: 3.2, Feb: 2.8, Mar: -1.1, Apr: 4.5, May: 2.1, Jun: 1.9, Jul: 3.8, Aug: 2.4, Sep: 1.7, Oct: 2.9, Nov: 4.2, Dec: 3.5 },
  { stock: 'TCS', Jan: 2.1, Feb: 3.4, Mar: 2.9, Apr: 1.8, May: -0.8, Jun: 2.7, Jul: 3.1, Aug: 2.2, Sep: 3.6, Oct: 1.9, Nov: 2.8, Dec: 3.9 },
  { stock: 'INFY', Jan: 1.8, Feb: 2.5, Mar: 3.2, Apr: 2.1, May: 1.5, Jun: -1.2, Jul: 2.8, Aug: 3.4, Sep: 2.6, Oct: 3.1, Nov: 1.8, Dec: 2.4 },
  { stock: 'HDFC', Jan: 4.1, Feb: 1.9, Mar: 2.4, Apr: 3.3, May: 2.8, Jun: 3.5, Jul: 1.7, Aug: 2.9, Sep: 4.2, Oct: 2.1, Nov: 3.4, Dec: 2.7 },
  { stock: 'ICICI', Jan: 2.6, Feb: 3.1, Mar: 1.4, Apr: 2.9, May: 3.7, Jun: 2.3, Jul: 4.1, Aug: 1.6, Sep: 2.8, Oct: 3.9, Nov: 2.5, Dec: 3.2 },
  { stock: 'SBIN', Jan: 1.5, Feb: 2.9, Mar: 3.8, Apr: 1.2, May: 2.4, Jun: 3.1, Jul: 2.7, Aug: 3.5, Sep: 1.9, Oct: 2.6, Nov: 4.3, Dec: 1.8 },
  { stock: 'BHARTI', Jan: 3.4, Feb: 2.2, Mar: 1.9, Apr: 3.6, May: 1.7, Jun: 2.8, Jul: 3.9, Aug: 2.1, Sep: 3.3, Oct: 1.5, Nov: 2.9, Dec: 4.1 },
  { stock: 'ITC', Jan: 2.3, Feb: 1.6, Mar: 2.7, Apr: 2.4, May: 3.2, Jun: 1.8, Jul: 2.5, Aug: 3.8, Sep: 2.1, Oct: 3.4, Nov: 1.9, Dec: 2.8 }
];

const marketConditionData = [
  { condition: 'Strong Bullish', vix: '10-15', nifty: '+2%', result: 4.8 },
  { condition: 'Strong Bullish', vix: '15-20', nifty: '+2%', result: 3.9 },
  { condition: 'Strong Bullish', vix: '20-25', nifty: '+2%', result: 2.7 },
  { condition: 'Mild Bullish', vix: '10-15', nifty: '+0.5%', result: 2.4 },
  { condition: 'Mild Bullish', vix: '15-20', nifty: '+0.5%', result: 2.1 },
  { condition: 'Mild Bullish', vix: '20-25', nifty: '+0.5%', result: 1.3 },
  { condition: 'Sideways', vix: '10-15', nifty: '0%', result: 0.8 },
  { condition: 'Sideways', vix: '15-20', nifty: '0%', result: 0.5 },
  { condition: 'Sideways', vix: '20-25', nifty: '0%', result: -0.3 },
  { condition: 'Mild Bearish', vix: '10-15', nifty: '-0.5%', result: -1.2 },
  { condition: 'Mild Bearish', vix: '15-20', nifty: '-0.5%', result: -0.8 },
  { condition: 'Mild Bearish', vix: '20-25', nifty: '-0.5%', result: 0.4 },
  { condition: 'Strong Bearish', vix: '10-15', nifty: '-2%', result: -2.1 },
  { condition: 'Strong Bearish', vix: '15-20', nifty: '-2%', result: -1.5 },
  { condition: 'Strong Bearish', vix: '20-25', nifty: '-2%', result: 0.9 }
];

const weeklyPerformanceData = [
  { week: 'Week 1', Mon: 2.3, Tue: 1.8, Wed: 3.1, Thu: 1.2, Fri: 2.7 },
  { week: 'Week 2', Mon: 1.9, Tue: 2.4, Wed: 1.5, Thu: 2.8, Fri: 1.9 },
  { week: 'Week 3', Mon: 3.4, Tue: 2.1, Wed: 1.8, Thu: 2.3, Fri: 3.2 },
  { week: 'Week 4', Mon: 2.8, Tue: 3.5, Wed: 2.2, Thu: 1.7, Fri: 2.4 }
];

// Helper function to get color based on value
const getHeatMapColor = (value: number): string => {
  if (value >= 3.5) return 'bg-green-500';
  if (value >= 2.5) return 'bg-green-600';
  if (value >= 1.5) return 'bg-green-700';
  if (value >= 0.5) return 'bg-green-800';
  if (value >= -0.5) return 'bg-gray-700';
  if (value >= -1.5) return 'bg-red-800';
  if (value >= -2.5) return 'bg-red-700';
  return 'bg-red-600';
};

const getTextColor = (value: number): string => {
  if (value >= -0.5 && value <= 0.5) return 'text-gray-300';
  return 'text-white';
};

interface StrategyHeatMapAnalysisProps {
  strategyName: string;
}

export function StrategyHeatMapAnalysis({ strategyName }: StrategyHeatMapAnalysisProps) {
  const [selectedMetric, setSelectedMetric] = useState('return');

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Info Banner */}
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
              Darker shades represent stronger performance (positive or negative).
            </p>
          </div>
        </div>
      </motion.div>

      {/* Heat Map Tabs */}
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

        {/* Intraday Performance Heat Map */}
        <TabsContent value="intraday">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white text-xl mb-1">Intraday Time-slot Performance</h3>
                <p className="text-sm text-gray-400">Average return (%) by day and time slot</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-gray-400">High Return</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-700 rounded"></div>
                  <span className="text-gray-400">Neutral</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-600 rounded"></div>
                  <span className="text-gray-400">Loss</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Day</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">9:15-10:00</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">10:00-11:00</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">11:00-12:00</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">12:00-13:00</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">13:00-14:00</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">14:00-15:00</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">15:00-15:30</th>
                  </tr>
                </thead>
                <tbody>
                  {timePerformanceData.map((row) => (
                    <tr key={row.day}>
                      <td className="text-white p-3 border border-gray-700 bg-gray-900/30">{row.day}</td>
                      {Object.entries(row).slice(1).map(([key, value]) => (
                        <TooltipProvider key={key}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <td 
                                className={`text-center p-3 border border-gray-700 ${getHeatMapColor(value as number)} ${getTextColor(value as number)} cursor-pointer hover:opacity-80 transition-opacity`}
                              >
                                {(value as number).toFixed(1)}%
                              </td>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {row.day} {key}: {value > 0 ? '+' : ''}{(value as number).toFixed(2)}%
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Best Time Slot</div>
                <div className="text-xl text-green-400">Wed 9:15-10:00</div>
                <div className="text-sm text-gray-500">+3.1% avg return</div>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Worst Time Slot</div>
                <div className="text-xl text-red-400">Thu 13:00-14:00</div>
                <div className="text-sm text-gray-500">-0.7% avg return</div>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Most Consistent</div>
                <div className="text-xl text-cyan-400">14:00-15:00</div>
                <div className="text-sm text-gray-500">Low variance</div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Stock-wise Performance Heat Map */}
        <TabsContent value="stocks">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <div className="mb-6">
              <h3 className="text-white text-xl mb-1">Stock-wise Monthly Performance</h3>
              <p className="text-sm text-gray-400">Average return (%) by stock across months</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50 sticky left-0">Stock</th>
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                      <th key={month} className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">{month}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockPerformanceData.map((row) => (
                    <tr key={row.stock}>
                      <td className="text-white p-3 border border-gray-700 bg-gray-900/30 sticky left-0 font-mono">{row.stock}</td>
                      {Object.entries(row).slice(1).map(([key, value]) => (
                        <TooltipProvider key={key}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <td 
                                className={`text-center p-3 border border-gray-700 ${getHeatMapColor(value as number)} ${getTextColor(value as number)} cursor-pointer hover:opacity-80 transition-opacity`}
                              >
                                {(value as number).toFixed(1)}%
                              </td>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {row.stock} - {key}: {value > 0 ? '+' : ''}{(value as number).toFixed(2)}%
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Top Performer</div>
                <div className="text-xl text-green-400">HDFC</div>
                <div className="text-sm text-gray-500">Apr: +4.5%</div>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Most Consistent</div>
                <div className="text-xl text-cyan-400">TCS</div>
                <div className="text-sm text-gray-500">Avg: +2.6%</div>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Best Month</div>
                <div className="text-xl text-purple-400">November</div>
                <div className="text-sm text-gray-500">Avg: +3.1%</div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Weakest Month</div>
                <div className="text-xl text-yellow-400">March</div>
                <div className="text-sm text-gray-500">Mixed results</div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Market Conditions Heat Map */}
        <TabsContent value="market">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <div className="mb-6">
              <h3 className="text-white text-xl mb-1">Performance by Market Conditions</h3>
              <p className="text-sm text-gray-400">Strategy performance across different market scenarios and VIX levels</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Market Trend</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Nifty Move</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">VIX: 10-15</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">VIX: 15-20</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">VIX: 20-25</th>
                  </tr>
                </thead>
                <tbody>
                  {['Strong Bullish', 'Mild Bullish', 'Sideways', 'Mild Bearish', 'Strong Bearish'].map((condition, idx) => {
                    const conditionData = marketConditionData.filter(d => d.condition === condition);
                    return (
                      <tr key={condition}>
                        <td className="text-white p-3 border border-gray-700 bg-gray-900/30">{condition}</td>
                        <td className="text-gray-300 text-center p-3 border border-gray-700 bg-gray-900/30">
                          {conditionData[0].nifty}
                        </td>
                        {conditionData.map((item, i) => (
                          <TooltipProvider key={i}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <td 
                                  className={`text-center p-3 border border-gray-700 ${getHeatMapColor(item.result)} ${getTextColor(item.result)} cursor-pointer hover:opacity-80 transition-opacity`}
                                >
                                  {item.result > 0 ? '+' : ''}{item.result.toFixed(1)}%
                                </td>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {item.condition}<br/>
                                  VIX: {item.vix}, Nifty: {item.nifty}<br/>
                                  Return: {item.result > 0 ? '+' : ''}{item.result.toFixed(2)}%
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-4">
              <div className="bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Target className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-green-400 mb-1">Key Insights</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• <strong>Best Performance:</strong> Strong bullish markets with low VIX (10-15) - avg +4.8%</li>
                      <li>• <strong>Risk Management:</strong> Strategy shows resilience in strong bearish + high VIX scenarios</li>
                      <li>• <strong>Volatility Edge:</strong> Higher VIX improves performance during bearish trends</li>
                      <li>• <strong>Avoid:</strong> Sideways markets with high VIX (20-25) show negative returns</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Ideal Conditions</div>
                  <div className="text-lg text-green-400">Strong Bull + Low VIX</div>
                  <div className="text-sm text-gray-500">+4.8% average</div>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Neutral Conditions</div>
                  <div className="text-lg text-yellow-400">Mild Trends</div>
                  <div className="text-sm text-gray-500">+1.0% to +2.5%</div>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="text-sm text-gray-400 mb-1">Avoid Trading</div>
                  <div className="text-lg text-red-400">Sideways + High VIX</div>
                  <div className="text-sm text-gray-500">-0.3% average</div>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Weekly Pattern Heat Map */}
        <TabsContent value="weekly">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <div className="mb-6">
              <h3 className="text-white text-xl mb-1">Weekly Performance Pattern</h3>
              <p className="text-sm text-gray-400">Average daily returns by week of the month</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Week</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Monday</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Tuesday</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Wednesday</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Thursday</th>
                    <th className="text-center text-gray-400 text-sm p-3 border border-gray-700 bg-gray-900/50">Friday</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyPerformanceData.map((row) => (
                    <tr key={row.week}>
                      <td className="text-white p-3 border border-gray-700 bg-gray-900/30">{row.week}</td>
                      {Object.entries(row).slice(1).map(([key, value]) => (
                        <TooltipProvider key={key}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <td 
                                className={`text-center p-3 border border-gray-700 ${getHeatMapColor(value as number)} ${getTextColor(value as number)} cursor-pointer hover:opacity-80 transition-opacity`}
                              >
                                {(value as number).toFixed(1)}%
                              </td>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">
                                {row.week} - {key}: {value > 0 ? '+' : ''}{(value as number).toFixed(2)}%
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">Best Trading Days</div>
                <div className="space-y-1">
                  <div className="text-white text-sm">• Week 3 - Monday: +3.4%</div>
                  <div className="text-white text-sm">• Week 2 - Thursday: +2.8%</div>
                  <div className="text-white text-sm">• Week 4 - Tuesday: +3.5%</div>
                </div>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">Pattern Observations</div>
                <div className="space-y-1">
                  <div className="text-white text-sm">• Mondays: Generally strong (avg +2.6%)</div>
                  <div className="text-white text-sm">• Mid-week: Consistent performance</div>
                  <div className="text-white text-sm">• Fridays: Variable (profit-booking)</div>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Summary Statistics */}
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
            <div className="text-2xl text-green-400 mb-1">72.5%</div>
            <div className="text-xs text-gray-500">348/480 trades</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Avg Win</div>
            <div className="text-2xl text-green-400 mb-1">+2.8%</div>
            <div className="text-xs text-gray-500">Per winning trade</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Avg Loss</div>
            <div className="text-2xl text-red-400 mb-1">-1.2%</div>
            <div className="text-xs text-gray-500">Per losing trade</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Sharpe Ratio</div>
            <div className="text-2xl text-cyan-400 mb-1">2.35</div>
            <div className="text-xs text-gray-500">Risk-adjusted return</div>
          </div>
        </div>
      </motion.div>

      {/* Copyright Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center"
      >
        <p className="text-sm text-gray-400">
          © 2025 BusineXAi Solutions Lab. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
