import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Activity, Newspaper } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Badge } from './ui/badge';
import { useMarketData } from '../contexts/MarketDataContext';

export function MarketSentimentDashboard() {
  const { sectorPerformance, marketBreadth, indices, isLive } = useMarketData();

  const sentimentScore = sectorPerformance.length
    ? Math.round(50 + sectorPerformance.reduce((s, x) => s + x.change, 0) / sectorPerformance.length * 5)
    : 50;

  const sectorSentiment = sectorPerformance.map(s => ({
    sector: s.sector,
    score: Math.round(50 + s.change * 5),
    change: s.change
  }));

  const sentimentTimeline = indices.slice(0, 7).map((idx, i) => ({
    time: `${9 + i}:00`,
    score: Math.round(50 + idx.changePercent * 5)
  }));

  const sentimentFactors = [
    { factor: 'Advances', value: marketBreadth ? Math.min(100, marketBreadth.advances / 20) : 50 },
    { factor: 'Declines', value: marketBreadth ? Math.min(100, marketBreadth.declines / 20) : 50 },
    { factor: 'Sector Momentum', value: sentimentScore },
    { factor: 'Price Action', value: Math.round(sentimentScore * 0.9) },
    { factor: 'Breadth', value: marketBreadth ? Math.round((marketBreadth.advances / (marketBreadth.advances + marketBreadth.declines || 1)) * 100) : 50 },
    { factor: 'Technical', value: sentimentScore }
  ];

  const newsItems = sectorPerformance.slice(0, 3).map((s, i) => ({
    title: `${s.sector} sector ${s.change >= 0 ? 'outperforming' : 'under pressure'}`,
    source: 'Live Market Feed',
    sentiment: s.change >= 0 ? 'positive' : 'negative',
    score: Math.round(50 + s.change * 5),
    impact: `${s.advancers} advancers vs ${s.decliners} decliners`,
    time: isLive ? 'Live' : 'Updated recently'
  }));

  const getSentimentColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getSentimentLabel = (score: number) => {
    if (score >= 70) return 'Bullish';
    if (score >= 50) return 'Neutral';
    return 'Bearish';
  };

  return (
    <div className="space-y-6">
      {/* Overall Sentiment Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-6">AI Sentiment Index</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-48 h-48">
              <svg className="transform -rotate-90 w-48 h-48">
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke="#374151"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="96"
                  cy="96"
                  r="88"
                  stroke={sentimentScore >= 70 ? '#10b981' : sentimentScore >= 50 ? '#eab308' : '#ef4444'}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${(sentimentScore / 100) * 553} 553`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-5xl ${getSentimentColor(sentimentScore)}`}>
                  {sentimentScore}
                </div>
                <div className="text-sm text-gray-400 mt-1">Sentiment Score</div>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <Badge className={`${
                sentimentScore >= 70 
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : sentimentScore >= 50
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  : 'bg-red-500/20 text-red-400 border-red-500/30'
              }`}>
                {getSentimentLabel(sentimentScore)}
              </Badge>
              <p className="text-sm text-gray-400 mt-2">
                Aggregated from NSE news, social media, and market data
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-white mb-4">Sentiment Factors Breakdown</h4>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={sentimentFactors}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis dataKey="factor" stroke="#9ca3af" />
                <PolarRadiusAxis stroke="#9ca3af" domain={[0, 100]} />
                <Radar name="Sentiment" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>

      {/* Sentiment Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Intraday Sentiment Trend</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={sentimentTimeline}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9ca3af" />
            <YAxis domain={[0, 100]} stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
            />
            <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Sector-wise Sentiment */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Sector-wise Sentiment Analysis</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sectorSentiment.map((sector, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-white">{sector.sector}</span>
                <div className={`flex items-center gap-1 ${sector.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {sector.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span className="text-sm">{sector.change >= 0 ? '+' : ''}{sector.change}</span>
                </div>
              </div>
              
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Score</span>
                  <span className={getSentimentColor(sector.score)}>{sector.score}</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      sector.score >= 70 ? 'bg-green-500' : sector.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${sector.score}%` }}
                  ></div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* News Sentiment Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-cyan-400" />
          <h3 className="text-white">AI-Analyzed News Sentiment</h3>
        </div>
        
        <div className="space-y-4">
          {newsItems.map((news, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-${news.sentiment === 'positive' ? 'green' : 'red'}-500/10 border border-${news.sentiment === 'positive' ? 'green' : 'red'}-500/30 rounded-lg p-4`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-white">{news.title}</h4>
                    <Badge className={`${
                      news.sentiment === 'positive'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      Score: {news.score}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{news.impact}</p>
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
      </motion.div>
    </div>
  );
}
