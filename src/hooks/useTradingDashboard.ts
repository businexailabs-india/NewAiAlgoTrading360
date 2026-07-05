import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../lib/api';
import { portfolioService } from '../services/portfolioService';
import { tradingService } from '../services/tradingService';
import { useAuth } from '../contexts/AuthContext';

export interface TradingSummary {
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  activeAgents: number;
  openOrders: number;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export function useTradingDashboard(timeRange = '1M') {
  const { isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<TradingSummary | null>(null);
  const [agents, setAgents] = useState<Array<Record<string, unknown>>>([]);
  const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
  const [trades, setTrades] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const period = timeRange === '1Y' ? '1Y' : timeRange === '6M' ? '6M' : '6M';

      const [portfolioSummary, metrics, agentList, orderList, tradeRes] = await Promise.all([
        fetch(`${API_BASE_URL}/portfolio/summary`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null),
        portfolioService.getAdvancedMetrics(period).catch(() => null),
        tradingService.listAgents().catch(() => []),
        tradingService.getOrders().catch(() => []),
        fetch(`${API_BASE_URL}/portfolio/trades?limit=50`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null)
      ]);

      const ps = portfolioSummary?.data;
      const stats = metrics?.data?.multiPeriodStats?.['6M'];
      const tradeList = tradeRes?.data?.trades || tradeRes?.data || [];

      setAgents(agentList);
      setOrders(orderList);
      setTrades(Array.isArray(tradeList) ? tradeList : []);

      setSummary({
        totalPnL: Number(ps?.totalPnL ?? ps?.total_pnl ?? 0),
        totalTrades: Number(stats?.trades ?? tradeList?.length ?? 0),
        winRate: Number(stats?.winRate ?? 0),
        avgReturn: Number(stats?.avgReturn ?? 0),
        sharpeRatio: Number(stats?.sharpe ?? 0),
        maxDrawdown: Number(stats?.maxDrawdown ?? 0),
        activeAgents: agentList.filter((a: { status?: string }) => a.status === 'active' || a.isActive).length,
        openOrders: orderList.filter((o: { status?: string }) => ['PENDING', 'OPEN', 'PLACED'].includes(String(o.status).toUpperCase())).length
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trading data');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, timeRange]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return { summary, agents, orders, trades, loading, error, refresh: load };
}
