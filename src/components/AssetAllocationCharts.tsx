import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface AllocationItem {
  name: string;
  value: number;
  color: string;
}

interface AssetAllocationChartsProps {
  assetAllocation?: AllocationItem[];
  marketCap?: AllocationItem[];
  holdings?: Array<{ symbol?: string; value?: number; marketCapCategory?: string; assetType?: string }>;
}

const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

function deriveFromHoldings(
  holdings: Array<{ symbol?: string; value?: number; marketCapCategory?: string; assetType?: string }>
): { assetAllocation: AllocationItem[]; marketCap: AllocationItem[] } {
  const byType = new Map<string, number>();
  const byCap = new Map<string, number>();
  let total = 0;

  for (const h of holdings) {
    const v = Number(h.value ?? 0);
    if (v <= 0) continue;
    total += v;
    const type = h.assetType || 'Stocks';
    byType.set(type, (byType.get(type) || 0) + v);
    const cap = h.marketCapCategory || 'Other';
    byCap.set(cap, (byCap.get(cap) || 0) + v);
  }

  if (total === 0) {
    return { assetAllocation: [], marketCap: [] };
  }

  const assetAllocation = Array.from(byType.entries()).map(([name, value], i) => ({
    name,
    value: Math.round((value / total) * 1000) / 10,
    color: COLORS[i % COLORS.length]
  }));

  const marketCap = Array.from(byCap.entries()).map(([name, value], i) => ({
    name,
    value: Math.round((value / total) * 1000) / 10,
    color: COLORS[i % COLORS.length]
  }));

  return { assetAllocation, marketCap };
}

export function AssetAllocationCharts({
  assetAllocation: assetProp,
  marketCap: marketCapProp,
  holdings = []
}: AssetAllocationChartsProps) {
  const derived = holdings.length > 0 ? deriveFromHoldings(holdings) : { assetAllocation: [], marketCap: [] };
  const assetAllocationData = assetProp && assetProp.length > 0 ? assetProp : derived.assetAllocation;
  const marketCapData = marketCapProp && marketCapProp.length > 0 ? marketCapProp : derived.marketCap;

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
        {assetAllocationData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-400">No data available</div>
        ) : (
          <>
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
          </>
        )}
      </motion.div>

      {/* Market Cap Allocation Bar Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
      >
        <h3 className="text-xl text-white mb-6">Market Cap Distribution</h3>
        {marketCapData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-gray-400">No data available</div>
        ) : (
          <>
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
          </>
        )}
      </motion.div>
    </div>
  );
}
