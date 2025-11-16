import { motion } from 'motion/react';
import { ThumbsUp, ThumbsDown, Minus, Newspaper, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { Badge } from './ui/badge';

const sentimentData = [
  { name: 'Bullish', value: 58, color: '#10b981' },
  { name: 'Neutral', value: 25, color: '#6b7280' },
  { name: 'Bearish', value: 17, color: '#ef4444' }
];

const technicalIndicators = [
  { indicator: 'RSI', value: 65, signal: 'Neutral', color: 'yellow' },
  { indicator: 'MACD', value: 72, signal: 'Bullish', color: 'green' },
  { indicator: 'Moving Avg', value: 68, signal: 'Bullish', color: 'green' },
  { indicator: 'Bollinger', value: 45, signal: 'Neutral', color: 'yellow' },
  { indicator: 'Stochastic', value: 58, signal: 'Neutral', color: 'yellow' }
];

const newsAnalysis = [
  {
    title: 'RBI Maintains Repo Rate at 6.5%',
    source: 'Economic Times',
    sentiment: 'positive',
    impact: 'high',
    time: '2 hours ago',
    summary: 'Central bank keeps policy rate unchanged, signaling stable inflation outlook.'
  },
  {
    title: 'Tech Sector Shows Strong Q4 Growth',
    source: 'Business Standard',
    sentiment: 'positive',
    impact: 'medium',
    time: '4 hours ago',
    summary: 'Major IT companies report 15% YoY revenue growth amid digital transformation.'
  },
  {
    title: 'Global Market Volatility Concerns',
    source: 'Moneycontrol',
    sentiment: 'negative',
    impact: 'medium',
    time: '6 hours ago',
    summary: 'International market uncertainty may impact FII flows in emerging markets.'
  },
  {
    title: 'Banking Stocks Rally on Credit Growth',
    source: 'Mint',
    sentiment: 'positive',
    impact: 'high',
    time: '8 hours ago',
    summary: 'Strong loan demand and improved asset quality boost banking sector outlook.'
  }
];

const marketRegime = [
  { subject: 'Volatility', A: 65, fullMark: 100 },
  { subject: 'Momentum', A: 78, fullMark: 100 },
  { subject: 'Trend Strength', A: 72, fullMark: 100 },
  { subject: 'Volume', A: 68, fullMark: 100 },
  { subject: 'Breadth', A: 75, fullMark: 100 }
];

export function MarketSentimentAnalysis() {
  return (
    <div className="space-y-6">
      {/* Overall Sentiment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <h3 className="text-white mb-4">Overall Market Sentiment</h3>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={sentimentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            
            <div className="flex-1 space-y-3">
              {sentimentData.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-gray-300">{item.name}</span>
                  </div>
                  <span className="text-white">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 text-green-400">
              <ThumbsUp className="w-5 h-5" />
              <span>Market sentiment is moderately bullish</span>
            </div>
          </div>
        </div>

        {/* Market Regime Analysis */}
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <h3 className="text-white mb-4">Market Regime Analysis</h3>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={marketRegime}>
              <PolarGrid stroke="#374151" />
              <PolarAngleAxis dataKey="subject" stroke="#9ca3af" />
              <PolarRadiusAxis stroke="#9ca3af" />
              <Radar name="Current" dataKey="A" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.3} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Technical Indicators */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <h3 className="text-white mb-4">Technical Indicator Consensus (NIFTY 50)</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {technicalIndicators.map((item, i) => (
            <motion.div
              key={item.indicator}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="text-sm text-gray-400 mb-2">{item.indicator}</div>
              <div className="text-2xl text-cyan-400 mb-2">{item.value}</div>
              <Badge className={`
                ${item.color === 'green' ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}
                ${item.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : ''}
                ${item.color === 'red' ? 'bg-red-500/20 text-red-400 border-red-500/30' : ''}
              `}>
                {item.signal}
              </Badge>
            </motion.div>
          ))}
        </div>
      </div>

      {/* News Sentiment Analysis */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-cyan-400" />
          <h3 className="text-white">AI-Powered News Sentiment</h3>
        </div>
        
        <div className="space-y-4">
          {newsAnalysis.map((news, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-cyan-500/50 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-white">{news.title}</h4>
                    {news.sentiment === 'positive' ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        Positive
                      </Badge>
                    ) : news.sentiment === 'negative' ? (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                        <ThumbsDown className="w-3 h-3 mr-1" />
                        Negative
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                        <Minus className="w-3 h-3 mr-1" />
                        Neutral
                      </Badge>
                    )}
                    <Badge className={`
                      ${news.impact === 'high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : ''}
                      ${news.impact === 'medium' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : ''}
                      ${news.impact === 'low' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : ''}
                    `}>
                      {news.impact} impact
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{news.summary}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{news.source}</span>
                    <span>•</span>
                    <span>{news.time}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
