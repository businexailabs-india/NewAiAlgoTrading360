import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const assetAllocationData = [
  { name: 'Stocks', value: 45, color: '#06b6d4' },
  { name: 'ETFs', value: 25, color: '#3b82f6' },
  { name: 'Crypto', value: 15, color: '#8b5cf6' },
  { name: 'Mutual Funds', value: 15, color: '#10b981' }
];

const marketCapData = [
  { name: 'Large Cap', value: 60, color: '#06b6d4' },
  { name: 'Mid Cap', value: 30, color: '#3b82f6' },
  { name: 'Small Cap', value: 10, color: '#8b5cf6' }
];

export function AssetAllocationCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Asset Allocation Pie Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
      >
        <h3 className="text-xl text-white mb-6">Asset Allocation</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={assetAllocationData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {assetAllocationData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {assetAllocationData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-sm text-gray-400">{item.name}</span>
              <span className="text-sm text-white ml-auto">{item.value}%</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Market Cap Allocation Bar Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
      >
        <h3 className="text-xl text-white mb-6">Market Cap Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={marketCapData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
              itemStyle={{ color: '#fff' }}
            />
            <Bar dataKey="value" fill="#06b6d4" radius={[8, 8, 0, 0]}>
              {marketCapData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {marketCapData.map((item) => (
            <div key={item.name} className="text-center">
              <div className="w-full h-2 rounded-full bg-gray-800">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.value}%`, backgroundColor: item.color }}
                ></div>
              </div>
              <div className="text-sm text-gray-400 mt-2">{item.name}</div>
              <div className="text-white">{item.value}%</div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
