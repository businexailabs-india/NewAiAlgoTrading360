import { motion } from 'motion/react';
import { Brain, TrendingUp, AlertTriangle, Lightbulb, Target, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

// AI Prediction data for next 30/90 days
const predictionData = [
  { period: 'Week 1', predicted: 18500, confidence_low: 15000, confidence_high: 22000, historical: 17200 },
  { period: 'Week 2', predicted: 22000, confidence_low: 18000, confidence_high: 26000, historical: null },
  { period: 'Week 3', predicted: 25500, confidence_low: 20000, confidence_high: 31000, historical: null },
  { period: 'Week 4', predicted: 29000, confidence_low: 22000, confidence_high: 36000, historical: null }
];

const aiInsights = [
  {
    type: 'optimization',
    priority: 'high',
    title: 'Reduce Friday Volatility Exposure',
    description: 'Analysis of last 90 days shows 23% higher slippage on Friday afternoon trades. Consider avoiding high-volatility assets after 2 PM on Fridays.',
    impact: 'Expected reduction in slippage: ~15%',
    icon: AlertTriangle,
    color: 'yellow'
  },
  {
    type: 'opportunity',
    priority: 'high',
    title: 'Banking Sector Momentum Window',
    description: 'ML model detects strong momentum in banking stocks during 10:30-11:30 AM window. Win rate increases by 18% during this period.',
    impact: 'Potential profit boost: ₹12,000/month',
    icon: TrendingUp,
    color: 'green'
  },
  {
    type: 'risk',
    priority: 'medium',
    title: 'Overconcentration in Tech Sector',
    description: '42% of active strategies are concentrated in tech stocks. Diversification recommended to reduce correlation risk.',
    impact: 'Risk reduction: ~20%',
    icon: AlertTriangle,
    color: 'orange'
  },
  {
    type: 'strategy',
    priority: 'medium',
    title: 'Stop-Loss Optimization Needed',
    description: 'AI analysis suggests current stop-loss levels are too tight for swing strategies. Recommended adjustment: 8-12% instead of current 5-7%.',
    impact: 'Win rate improvement: +8%',
    icon: Target,
    color: 'cyan'
  }
];

const performanceOptimization = [
  { metric: 'Win Rate', current: 67.5, optimized: 75.2, improvement: 7.7 },
  { metric: 'Avg Return', current: 2.34, optimized: 2.89, improvement: 0.55 },
  { metric: 'Sharpe Ratio', current: 1.89, optimized: 2.24, improvement: 0.35 },
  { metric: 'Max Drawdown', current: -8.2, optimized: -6.1, improvement: 2.1 }
];

export function AIAdvisorPanel() {
  return (
    <div className="space-y-6">
      {/* AI Header */}
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
              Advanced machine learning models (XGBoost + LSTM) analyzing 90 days of trading data with 82% prediction accuracy.
            </p>
            <div className="flex gap-3">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                Model Confidence: 82%
              </Badge>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                Last Updated: 2 mins ago
              </Badge>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Return Prediction Chart */}
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

        <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Lightbulb className="w-5 h-5" />
            <span className="font-semibold">AI Forecast Summary</span>
          </div>
          <p className="text-sm text-gray-300">
            Expected return range for next 30 days: <span className="text-green-400">₹22,000 - ₹36,000</span> with 82% confidence.
            Most likely outcome: <span className="text-purple-400">₹29,000</span> based on current market conditions and strategy performance.
          </p>
        </div>
      </motion.div>

      {/* AI Optimization Insights */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Performance Optimization Opportunities</h3>
        
        <div className="space-y-4">
          {aiInsights.map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-${insight.color}-500/10 border border-${insight.color}-500/30 rounded-lg p-4`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2 bg-${insight.color}-500/20 rounded-lg`}>
                  <insight.icon className={`w-5 h-5 text-${insight.color}-400`} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-white">{insight.title}</h4>
                    <Badge className={`bg-${insight.color}-500/20 text-${insight.color}-400 border-${insight.color}-500/30`}>
                      {insight.priority} priority
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-300 mb-2">{insight.description}</p>
                  
                  <div className={`text-sm text-${insight.color}-400`}>
                    💡 {insight.impact}
                  </div>
                </div>

                <Button size="sm" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                  Apply
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Performance Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Projected Performance Impact</h3>
        
        <div className="space-y-4">
          {performanceOptimization.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-300">{item.metric}</span>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  +{item.improvement > 0 ? item.improvement.toFixed(2) : Math.abs(item.improvement).toFixed(2)}
                  {item.metric.includes('Rate') || item.metric.includes('Drawdown') ? '' : ''}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Current</span>
                    <span className="text-white">{item.current}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${Math.abs(item.current) * 10}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-500">Optimized</span>
                    <span className="text-green-400">{item.optimized}%</span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${Math.abs(item.optimized) * 10}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
