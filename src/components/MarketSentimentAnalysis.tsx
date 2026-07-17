import { motion } from 'motion/react';
import { Newspaper, ThumbsUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { Badge } from './ui/badge';
import { useMarketData } from '../contexts/MarketDataContext';

interface MarketSentimentAnalysisProps {
  sentimentData?: Array<{ name: string; value: number; color: string }>;
  technicalIndicators?: Array<{ indicator: string; value: number; signal: string; color: string }>;
  newsAnalysis?: Array<{
    title: string;
    source: string;
    sentiment: string;
    impact: string;
    time: string;
    summary: string;
  }>;
  marketRegime?: Array<{ subject: string; A: number; fullMark: number }>;
}

export function MarketSentimentAnalysis({
  sentimentData = [],
  technicalIndicators = [],
  newsAnalysis = [],
  marketRegime = []
}: MarketSentimentAnalysisProps) {
  const { marketBreadth } = useMarketData();

  // Derive simple sentiment from real breadth when no props provided
  const breadthSentiment = (() => {
    if (!marketBreadth || (marketBreadth.advances + marketBreadth.declines) === 0) {
      return [];
    }
    const total = marketBreadth.advances + marketBreadth.declines + (marketBreadth.unchanged || 0);
    const bullish = Math.round((marketBreadth.advances / total) * 100);
    const bearish = Math.round((marketBreadth.declines / total) * 100);
    const neutral = Math.max(0, 100 - bullish - bearish);
    return [
      { name: 'Bullish', value: bullish, color: '#10b981' },
      { name: 'Neutral', value: neutral, color: '#6b7280' },
      { name: 'Bearish', value: bearish, color: '#ef4444' }
    ];
  })();

  const chartSentiment = sentimentData.length > 0 ? sentimentData : breadthSentiment;
  const regimeFromBreadth = marketBreadth && marketRegime.length === 0
    ? [
        { subject: 'Advances', A: Math.min(100, marketBreadth.advances / 20), fullMark: 100 },
        { subject: 'Declines', A: Math.min(100, marketBreadth.declines / 20), fullMark: 100 },
        { subject: '52W Highs', A: Math.min(100, marketBreadth.fiftyTwoWeekHighs * 2), fullMark: 100 },
        { subject: '52W Lows', A: Math.min(100, marketBreadth.fiftyTwoWeekLows * 2), fullMark: 100 },
        { subject: 'Unchanged', A: Math.min(100, (marketBreadth.unchanged || 0) / 10), fullMark: 100 }
      ]
    : marketRegime;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <h3 className="text-white mb-4">Overall Market Sentiment</h3>
          {chartSentiment.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-gray-400">No data available</div>
          ) : (
            <>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={chartSentiment}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartSentiment.map((entry, index) => (
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
                  {chartSentiment.map((item) => (
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
              
              {marketBreadth && (
                <div className="mt-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <ThumbsUp className="w-5 h-5" />
                    <span>
                      Advances {marketBreadth.advances.toLocaleString()} / Declines {marketBreadth.declines.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <h3 className="text-white mb-4">Market Regime Analysis</h3>
          {regimeFromBreadth.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-gray-400">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={regimeFromBreadth}>
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
          )}
        </div>
      </div>

      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <h3 className="text-white mb-4">Technical Indicator Consensus</h3>
        {technicalIndicators.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data available</div>
        ) : (
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
                <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                  {item.signal}
                </Badge>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Newspaper className="w-5 h-5 text-cyan-400" />
          <h3 className="text-white">AI-Powered News Sentiment</h3>
        </div>
        
        {newsAnalysis.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data available</div>
        ) : (
          <div className="space-y-4">
            {newsAnalysis.map((news, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-4"
              >
                <h4 className="text-white mb-2">{news.title}</h4>
                <p className="text-sm text-gray-400 mb-2">{news.summary}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{news.source}</span>
                  <span>•</span>
                  <span>{news.time}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
