import { motion } from 'motion/react';
import { Brain, BarChart3 } from 'lucide-react';
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from './ui/badge';

interface PredictionPoint {
  period: string;
  predicted: number;
  confidence_low: number;
  confidence_high: number;
  historical: number | null;
}

interface AIInsight {
  type: string;
  priority: string;
  title: string;
  description: string;
  impact: string;
  color: string;
}

interface PerfOpt {
  metric: string;
  current: number;
  optimized: number;
  improvement: number;
}

interface AIAdvisorPanelProps {
  predictionData?: PredictionPoint[];
  aiInsights?: AIInsight[];
  performanceOptimization?: PerfOpt[];
}

export function AIAdvisorPanel({
  predictionData = [],
  aiInsights = [],
  performanceOptimization = []
}: AIAdvisorPanelProps) {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <Brain className="w-8 h-8 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl text-white mb-2">AI Performance Advisor</h3>
            <p className="text-gray-300 mb-4">
              Connect trading data to generate forecasts and optimization suggestions.
            </p>
            <div className="flex gap-3">
              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                Awaiting data
              </Badge>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-purple-400" />
          Expected Return Forecast (Next 30 Days)
        </h3>
        
        {predictionData.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={predictionData}>
              <defs>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="period" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Area type="monotone" dataKey="confidence_high" stroke="none" fill="url(#colorConfidence)" />
              <Area type="monotone" dataKey="confidence_low" stroke="none" fill="url(#colorConfidence)" />
              <Line type="monotone" dataKey="predicted" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', r: 5 }} name="AI Prediction" />
              <Line type="monotone" dataKey="historical" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} name="Historical Data" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Performance Optimization Opportunities</h3>
        {aiInsights.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data available</div>
        ) : (
          <div className="space-y-4">
            {aiInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-4"
              >
                <h4 className="text-white mb-1">{insight.title}</h4>
                <p className="text-sm text-gray-300 mb-2">{insight.description}</p>
                <div className="text-sm text-cyan-400">{insight.impact}</div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Projected Performance Impact</h3>
        {performanceOptimization.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data available</div>
        ) : (
          <div className="space-y-4">
            {performanceOptimization.map((item, i) => (
              <div key={i} className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-300">{item.metric}</span>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    +{Math.abs(item.improvement).toFixed(2)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">Current: <span className="text-white">{item.current}%</span></span>
                  <span className="text-gray-500">Optimized: <span className="text-green-400">{item.optimized}%</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
