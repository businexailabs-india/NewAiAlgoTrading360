import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Play, Copy, Code, Download, TrendingUp, DollarSign, Activity, Target, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Strategy {
  id: number;
  name: string;
  author: string;
  category: string;
  exchange: string;
  description: string;
  returns: string;
  sharpe: string;
  drawdown: string;
  winRate: string;
  trades: number;
  tags: string[];
  code: string;
  rating: number;
  reviews: number;
  deployed: number;
  chartData: number[];
  performanceData?: Array<{ date: string; equity: number; benchmark: number; drawdown: number }>;
  monthlyReturns?: Array<{ month: string; returns: number }>;
  codeSnippet?: string;
  riskMetrics?: Record<string, string>;
  tradingStats?: Record<string, string>;
}

interface StrategyDetailModalProps {
  strategy: Strategy;
  onClose: () => void;
  onDeploy?: () => void | Promise<void>;
  onClone?: () => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  busy?: boolean;
  statusHint?: string | null;
  defaultTab?: string;
}

export function StrategyDetailModal({
  strategy,
  onClose,
  onDeploy,
  onClone,
  onExport,
  busy,
  statusHint,
  defaultTab = 'performance'
}: StrategyDetailModalProps) {
  const [tab, setTab] = useState(defaultTab);
  const performanceData = strategy.performanceData ?? [];
  const monthlyReturns = strategy.monthlyReturns ?? [];
  const codeSnippet = strategy.codeSnippet || strategy.code || '';
  const riskMetrics = strategy.riskMetrics ?? {};
  const tradingStats = strategy.tradingStats ?? {};

  const copyCode = async () => {
    if (!codeSnippet) return;
    try {
      await navigator.clipboard.writeText(codeSnippet);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 border border-gray-800 rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl text-white">{strategy.name}</h2>
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                  {strategy.exchange}
                </Badge>
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  {strategy.category}
                </Badge>
              </div>
              <p className="text-gray-400">by {strategy.author}</p>
              {statusHint ? <p className="text-sm text-cyan-300 mt-2">{statusHint}</p> : null}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-gray-800">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <Button
              type="button"
              disabled={busy || !onDeploy}
              onClick={() => void onDeploy?.()}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
            >
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Deploy Strategy
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !onClone}
              onClick={() => void onClone?.()}
              className="border-gray-700"
            >
              <Copy className="w-4 h-4 mr-2" />
              Clone to Workspace
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !onExport}
              onClick={() => void onExport?.()}
              className="border-gray-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-gray-700"
              onClick={() => setTab('code')}
            >
              <Code className="w-4 h-4 mr-2" />
              View Code
            </Button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm text-gray-400">Total Returns</span>
              </div>
              <div className="text-2xl text-green-400">{strategy.returns || '—'}</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-sm text-gray-400">Sharpe Ratio</span>
              </div>
              <div className="text-2xl text-cyan-400">{strategy.sharpe || '—'}</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-gray-400">Win Rate</span>
              </div>
              <div className="text-2xl text-blue-400">{strategy.winRate || '—'}</div>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-red-400" />
                <span className="text-sm text-gray-400">Max Drawdown</span>
              </div>
              <div className="text-2xl text-red-400">{strategy.drawdown || '—'}</div>
            </div>
          </div>

          <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 mb-6">
            <h3 className="text-white mb-2">Strategy Description</h3>
            <p className="text-gray-400">{strategy.description || 'No description available.'}</p>

            <div className="flex flex-wrap gap-2 mt-4">
              {strategy.tags.map((tag) => (
                <Badge key={tag} className="bg-gray-700/50 text-gray-300 border-gray-600">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="bg-gray-800 mb-6">
              <TabsTrigger
                value="performance"
                className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
              >
                Performance
              </TabsTrigger>
              <TabsTrigger
                value="code"
                className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
              >
                Code
              </TabsTrigger>
              <TabsTrigger
                value="statistics"
                className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
              >
                Statistics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="performance">
              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4 mb-4">
                <h3 className="text-white mb-4">Equity Curve</h3>
                {performanceData.length === 0 && strategy.chartData?.length ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart
                      data={strategy.chartData.map((equity, i) => ({
                        date: `T${i + 1}`,
                        equity,
                        benchmark: strategy.chartData[0] * (1 + i * 0.002)
                      }))}
                    >
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorEquity)"
                        name="Strategy"
                      />
                      <Area
                        type="monotone"
                        dataKey="benchmark"
                        stroke="#6b7280"
                        fillOpacity={0}
                        fill="transparent"
                        name="Benchmark"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : performanceData.length === 0 ? (
                  <div className="flex items-center justify-center h-[250px] text-gray-400">
                    Sample sparkline only — run Deploy for live paper fills
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={performanceData}>
                      <defs>
                        <linearGradient id="colorEquity2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke="#10b981"
                        fillOpacity={1}
                        fill="url(#colorEquity2)"
                        name="Strategy"
                      />
                      <Area
                        type="monotone"
                        dataKey="benchmark"
                        stroke="#6b7280"
                        fillOpacity={0}
                        fill="transparent"
                        name="Benchmark"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                <h3 className="text-white mb-4">Monthly Returns Distribution</h3>
                {monthlyReturns.length === 0 ? (
                  <div className="flex items-center justify-center h-[250px] text-gray-400">
                    No monthly series yet — use My Rule Strategies → Backtest
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={monthlyReturns}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="month" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1f2937',
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                        itemStyle={{ color: '#fff' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="returns"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={{ fill: '#06b6d4', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </TabsContent>

            <TabsContent value="code">
              <div className="bg-gray-950 border border-gray-700 rounded-xl p-6 overflow-x-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white flex items-center gap-2">
                    <Code className="w-4 h-4 text-orange-400" />
                    Strategy Implementation
                  </h3>
                  {codeSnippet && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-gray-700"
                      onClick={() => void copyCode()}
                    >
                      <Copy className="w-3 h-3 mr-2" />
                      Copy Code
                    </Button>
                  )}
                </div>
                {codeSnippet ? (
                  <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
                    <code>{codeSnippet}</code>
                  </pre>
                ) : (
                  <div className="text-center py-12 text-gray-400">No code available</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="statistics">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                  <h3 className="text-white mb-4">Risk Metrics</h3>
                  {Object.keys(riskMetrics).length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      Sample metrics — live risk in Risk Center after deploy
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(riskMetrics).map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-gray-400">{label}</span>
                          <span className="text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-4">
                  <h3 className="text-white mb-4">Trading Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Trades</span>
                      <span className="text-white">{strategy.trades || 0}</span>
                    </div>
                    {Object.keys(tradingStats).length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">
                        Deploy to generate paper fills in Trading Desk
                      </div>
                    ) : (
                      Object.entries(tradingStats).map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-gray-400">{label}</span>
                          <span className="text-white">{value}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  );
}
