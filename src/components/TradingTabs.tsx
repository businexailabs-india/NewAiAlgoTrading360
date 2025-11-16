import { useState } from 'react';
import { motion } from 'motion/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BarChart3, FileText, Radio } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const backtestData = [
  { date: '2020', value: 100000 },
  { date: '2021', value: 145000 },
  { date: '2022', value: 132000 },
  { date: '2023', value: 178000 },
  { date: '2024', value: 224000 },
  { date: '2025', value: 284000 }
];

const performanceMetrics = [
  { label: 'Annualized Return', backtest: '22.4%', paper: '18.7%', live: '24.1%' },
  { label: 'Sharpe Ratio', backtest: '1.82', paper: '1.65', live: '1.84' },
  { label: 'Max Drawdown', backtest: '-18.2%', paper: '-12.5%', live: '-15.8%' },
  { label: 'Win Rate', backtest: '67%', paper: '62%', live: '69%' }
];

export function TradingTabs() {
  const [activeTab, setActiveTab] = useState('backtest');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-3 bg-gray-800 mb-6">
          <TabsTrigger value="backtest" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <BarChart3 className="w-4 h-4 mr-2" />
            Backtest
          </TabsTrigger>
          <TabsTrigger value="paper" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <FileText className="w-4 h-4 mr-2" />
            Paper Trade
          </TabsTrigger>
          <TabsTrigger value="live" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Radio className="w-4 h-4 mr-2" />
            Live
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backtest" className="mt-0">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl text-white mb-4">QuantConnect Backtest Results</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={backtestData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {performanceMetrics.map((metric) => (
                <div key={metric.label} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">{metric.label}</div>
                  <div className="text-2xl text-cyan-400">{metric.backtest}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="paper" className="mt-0">
          <div className="space-y-6">
            <div>
              <h3 className="text-xl text-white mb-4">Paper Trading Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={backtestData}>
                  <defs>
                    <linearGradient id="colorPaper" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorPaper)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {performanceMetrics.map((metric) => (
                <div key={metric.label} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">{metric.label}</div>
                  <div className="text-2xl text-blue-400">{metric.paper}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="live" className="mt-0">
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <h3 className="text-xl text-white">Live Trading (Active)</h3>
            </div>
            
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={backtestData}>
                <defs>
                  <linearGradient id="colorLive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorLive)" />
              </AreaChart>
            </ResponsiveContainer>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {performanceMetrics.map((metric) => (
                <div key={metric.label} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">{metric.label}</div>
                  <div className="text-2xl text-green-400">{metric.live}</div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Comparison Table */}
      <div className="mt-6 bg-gray-800/30 rounded-xl p-4 border border-gray-700">
        <h3 className="text-white mb-4">Performance Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-sm text-gray-400 pb-3">Metric</th>
                <th className="text-right text-sm text-cyan-400 pb-3">Backtest</th>
                <th className="text-right text-sm text-blue-400 pb-3">Paper Trade</th>
                <th className="text-right text-sm text-green-400 pb-3">Live</th>
              </tr>
            </thead>
            <tbody>
              {performanceMetrics.map((metric) => (
                <tr key={metric.label} className="border-b border-gray-800">
                  <td className="py-3 text-gray-300">{metric.label}</td>
                  <td className="py-3 text-right text-cyan-400">{metric.backtest}</td>
                  <td className="py-3 text-right text-blue-400">{metric.paper}</td>
                  <td className="py-3 text-right text-green-400">{metric.live}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
