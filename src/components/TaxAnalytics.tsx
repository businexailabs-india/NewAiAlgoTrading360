import { motion } from 'motion/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Button } from './ui/button';
import { Calculator } from 'lucide-react';

const cagrData = [
  { month: 'Jan', cagr: 12.4 },
  { month: 'Feb', cagr: 13.8 },
  { month: 'Mar', cagr: 15.2 },
  { month: 'Apr', cagr: 14.5 },
  { month: 'May', cagr: 16.8 },
  { month: 'Jun', cagr: 18.2 },
  { month: 'Jul', cagr: 17.5 },
  { month: 'Aug', cagr: 19.1 },
  { month: 'Sep', cagr: 20.4 },
  { month: 'Oct', cagr: 21.8 },
  { month: 'Nov', cagr: 23.2 },
  { month: 'Dec', cagr: 24.5 }
];

const taxData = [
  { type: 'STCG', amount: 45000, color: '#ef4444' },
  { type: 'LTCG', amount: 28000, color: '#06b6d4' }
];

export function TaxAnalytics() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
    >
      <h2 className="text-2xl text-white mb-6">CAGR & Tax Analytics</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CAGR Trend */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-cyan-400 mb-4">CAGR Trend Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={cagrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Line 
                type="monotone" 
                dataKey="cagr" 
                stroke="#06b6d4" 
                strokeWidth={3}
                dot={{ fill: '#06b6d4', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tax Impact */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-cyan-400 mb-4">Tax Impact Analysis</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={taxData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="type" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="amount" fill="#06b6d4" radius={[8, 8, 0, 0]}>
                {taxData.map((entry, index) => (
                  <motion.rect
                    key={`bar-${index}`}
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    transition={{ delay: index * 0.1 }}
                    fill={entry.color}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-sm text-gray-400">Short Term</div>
              <div className="text-xl text-red-400">₹45,000</div>
            </div>
            <div className="text-center p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
              <div className="text-sm text-gray-400">Long Term</div>
              <div className="text-xl text-cyan-400">₹28,000</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario Simulation */}
      <div className="mt-6 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-6 border border-purple-500/30">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div>
            <h3 className="text-purple-400 mb-2 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Scenario Simulation
            </h3>
            <p className="text-gray-300 text-sm mb-4">Preview the impact of rebalancing today</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Expected Return</div>
                <div className="text-lg text-green-400">+3.2%</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Tax Impact</div>
                <div className="text-lg text-red-400">₹21,400</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">Risk Reduction</div>
                <div className="text-lg text-cyan-400">-15%</div>
              </div>
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="text-xs text-gray-400">New Sharpe</div>
                <div className="text-lg text-purple-400">2.08</div>
              </div>
            </div>
          </div>
          
          <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white">
            Run Simulation
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
