import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ChevronLeft } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { portfolioService, PerformanceComparisonData } from '../services/portfolioService';
import { AdvancedPerformanceMetrics } from './AdvancedPerformanceMetrics';

interface PerformanceComparisonProps {
  timeRange?: string;
}

export function PerformanceComparison({ timeRange: initialTimeRange = '1Y' }: PerformanceComparisonProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState(initialTimeRange);
  const [performanceData, setPerformanceData] = useState<PerformanceComparisonData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await portfolioService.getPerformanceComparison(selectedTimeRange);
        setPerformanceData(response.data.performanceData);
      } catch (error) {
        console.error('Error fetching performance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedTimeRange]);

  const timeRanges = [
    { label: '1M', value: '1M' },
    { label: '6M', value: '6M' },
    { label: '1Y', value: '1Y' },
    { label: '3Y', value: '3Y' },
    { label: 'MAX', value: 'MAX' }
  ];

  // Calculate current values
  const currentSmallcap = performanceData[performanceData.length - 1]?.smallcap || 100;
  const currentLargecap = performanceData[performanceData.length - 1]?.largecap || 100;
  
  const smallcapReturn = ((currentSmallcap - 100) / 100 * 100).toFixed(2);
  const largecapReturn = ((currentLargecap - 100) / 100 * 100).toFixed(2);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-300">
                  {entry.name}: ₹{entry.value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-12 text-center"
      >
        <div className="text-gray-400">Loading performance data...</div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="comparison" className="w-full">
        <TabsList className="bg-gray-800 mb-6">
          <TabsTrigger value="comparison" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            Performance Chart
          </TabsTrigger>
          <TabsTrigger value="metrics" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            Advanced Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div>
                    <h3 className="text-xl text-white font-semibold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-cyan-400" />
                      Performance Comparison
                    </h3>
                  </div>
                </div>

                {/* Time Range Filters */}
                <div className="flex gap-2">
                  {timeRanges.map((range) => (
                    <Button
                      key={range.value}
                      onClick={() => setSelectedTimeRange(range.value)}
                      variant={selectedTimeRange === range.value ? 'default' : 'outline'}
                      size="sm"
                      className={
                        selectedTimeRange === range.value
                          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30'
                          : 'border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white'
                      }
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Current Values */}
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-gray-400">
                    Current value of ₹ 100 invested once 1 year ago would be
                  </span>
                </div>
              </div>
            </div>

      {/* Chart */}
      <div className="p-6">
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis 
              dataKey="index" 
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#374151' }}
            />
            <YAxis 
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              axisLine={{ stroke: '#374151' }}
              domain={[90, 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
              formatter={(value, entry: any) => {
                const isSmallcap = value === 'smallcap';
                const currentValue = isSmallcap ? currentSmallcap : currentLargecap;
                const returnValue = isSmallcap ? smallcapReturn : largecapReturn;
                const label = isSmallcap ? 'smallcase' : 'Equity Large Cap';
                
                return (
                  <span className="text-gray-300">
                    <span className={isSmallcap ? 'text-cyan-400' : 'text-orange-400'}>
                      {label}
                    </span>
                    {' '}
                    <span className="text-white font-semibold">
                      ₹ {currentValue.toFixed(2)}
                    </span>
                    {' '}
                    <span className={Number(returnValue) >= 0 ? 'text-green-400' : 'text-red-400'}>
                      ({returnValue}%)
                    </span>
                  </span>
                );
              }}
            />
            <Line 
              type="monotone" 
              dataKey="smallcap" 
              stroke="#06b6d4" 
              strokeWidth={3}
              dot={false}
              name="smallcap"
              activeDot={{ r: 6, fill: '#06b6d4' }}
            />
            <Line 
              type="monotone" 
              dataKey="largecap" 
              stroke="#fb923c" 
              strokeWidth={3}
              dot={false}
              name="largecap"
              activeDot={{ r: 6, fill: '#fb923c' }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-cyan-400" />
                  <span className="text-sm text-gray-400">smallcase</span>
                </div>
                <div className="text-2xl text-white font-semibold">
                  ₹ {currentSmallcap.toFixed(2)}
                </div>
                <div className={`text-sm ${Number(smallcapReturn) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(smallcapReturn) >= 0 ? '+' : ''}{smallcapReturn}% return
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-cyan-400/30" />
            </div>
          </Card>

          <Card className="bg-gray-900/50 border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                  <span className="text-sm text-gray-400">Equity Large Cap</span>
                </div>
                <div className="text-2xl text-white font-semibold">
                  ₹ {currentLargecap.toFixed(2)}
                </div>
                <div className={`text-sm ${Number(largecapReturn) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Number(largecapReturn) >= 0 ? '+' : ''}{largecapReturn}% return
                </div>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-400/30" />
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
        </TabsContent>

        <TabsContent value="metrics">
          <AdvancedPerformanceMetrics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
