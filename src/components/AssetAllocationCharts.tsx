import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';

interface AllocationItem {
  name: string;
  value: number;
  color: string;
}

interface AssetAllocationChartsProps {
  assetAllocation?: AllocationItem[];
  marketCap?: AllocationItem[];
  holdings?: Array<{
    symbol?: string;
    value?: number;
    marketCapCategory?: string;
    assetType?: string;
  }>;
}

const COLORS = ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function classifySymbol(symbol: string): string {
  if (/CE$|PE$/i.test(symbol)) return 'Options';
  if (/FUT$/i.test(symbol)) return 'Futures';
  if (/NIFTY|BANKNIFTY|SENSEX|FINNIFTY/i.test(symbol) && !/CE$|PE$/i.test(symbol)) return 'Index';
  return 'Equity';
}

function toPctMap(byKey: Map<string, number>): AllocationItem[] {
  const total = Array.from(byKey.values()).reduce((s, v) => s + v, 0);
  if (total <= 0) return [];
  return Array.from(byKey.entries())
    .map(([name, value], i) => ({
      name,
      value: Math.round((value / total) * 1000) / 10,
      color: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);
}

function deriveFromHoldings(
  holdings: Array<{
    symbol?: string;
    value?: number;
    marketCapCategory?: string;
    assetType?: string;
    broker?: string;
  }>
): { assetAllocation: AllocationItem[]; marketCap: AllocationItem[] } {
  const byType = new Map<string, number>();
  const byBook = new Map<string, number>();

  for (const h of holdings) {
    const v = Number(h.value ?? 0);
    if (v <= 0) continue;
    const type = h.assetType || classifySymbol(String(h.symbol || ''));
    byType.set(type, (byType.get(type) || 0) + v);
    const book = String(h.broker || 'other').toLowerCase() === 'paper' ? 'Paper' : 'Live / other';
    byBook.set(book, (byBook.get(book) || 0) + v);
  }

  return {
    assetAllocation: toPctMap(byType),
    marketCap: toPctMap(byBook),
  };
}

export function AssetAllocationCharts({
  assetAllocation: assetProp,
  marketCap: marketCapProp,
  holdings: holdingsProp = [],
}: AssetAllocationChartsProps) {
  const [loading, setLoading] = useState(!holdingsProp.length && !assetProp?.length);
  const [fetched, setFetched] = useState<
    Array<{ symbol?: string; value?: number; assetType?: string; broker?: string }>
  >(holdingsProp);

  useEffect(() => {
    if (holdingsProp.length || (assetProp && assetProp.length)) {
      setFetched(holdingsProp);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/portfolio/holdings`, { headers: authHeaders() });
        const json = await res.json().catch(() => ({}));
        const rows = Array.isArray(json?.data) ? json.data : [];
        const mapped = rows
          .map((h: Record<string, unknown>) => {
            const symbol = String(h.symbol || '');
            const broker = String(
              (h.brokerConnection as { broker?: string } | undefined)?.broker || h.broker || ''
            );
            const value = Number(h.currentValue || h.investedValue || 0);
            return {
              symbol,
              value,
              assetType: classifySymbol(symbol),
              broker,
            };
          })
          .filter((h: { value: number }) => h.value > 0);
        if (!cancelled) setFetched(mapped);
      } catch {
        if (!cancelled) setFetched([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [holdingsProp, assetProp]);

  const derived = deriveFromHoldings(fetched);
  const assetAllocationData =
    assetProp && assetProp.length > 0 ? assetProp : derived.assetAllocation;
  const marketCapData = marketCapProp && marketCapProp.length > 0 ? marketCapProp : derived.marketCap;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
      >
        <h3 className="text-xl text-white mb-2">Asset Allocation</h3>
        <p className="text-xs text-slate-500 mb-4">By instrument type from current holdings</p>
        {assetAllocationData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
            No holdings to allocate yet
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={assetAllocationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={96}
                  dataKey="value"
                >
                  {assetAllocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {assetAllocationData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-400">{item.name}</span>
                  <span className="text-sm text-white ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.05 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
      >
        <h3 className="text-xl text-white mb-2">Book mix</h3>
        <p className="text-xs text-slate-500 mb-4">Paper vs live / other by current value</p>
        {marketCapData.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
            No holdings to chart yet
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={marketCapData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {marketCapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-3 mt-2">
              {marketCapData.map((item) => (
                <div key={item.name} className="text-center">
                  <div className="text-sm text-gray-400">{item.name}</div>
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
