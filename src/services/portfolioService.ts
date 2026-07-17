/**
 * Portfolio Service — real API only (no mock fallbacks)
 */

import { API_BASE_URL } from '../lib/api';

export interface PerformanceComparisonData {
  index: number;
  date: string;
  smallcap: number;
  largecap: number;
}

export interface PerformanceComparisonResponse {
  success: boolean;
  data: {
    timeRange: string;
    performanceData: PerformanceComparisonData[];
    summary: {
      smallcap: {
        currentValue: number;
        returnPercent: string;
      };
      largecap: {
        currentValue: number;
        returnPercent: string;
      };
    };
  };
}

export interface MonthlyReturn {
  month: string;
  return: string;
  trades: number;
  totalPnL: number;
}

export interface HeatMapYear {
  year: string;
  months: MonthlyReturn[];
}

export interface MultiPeriodStats {
  winRate: number;
  avgReturn: number;
  sharpe: number;
  maxDrawdown: number;
  trades: number;
}

export interface DrawdownPeriod {
  period: string;
  value: number;
  duration: string;
  recovery: string;
}

export interface TaxImpact {
  shortTermGains: number;
  longTermGains: number;
  shortTermTax: number;
  longTermTax: number;
  totalTaxLiability: number;
  netReturns: number;
  effectiveTaxRate: number;
}

export interface AdvancedMetricsResponse {
  success: boolean;
  data: {
    multiPeriodStats: {
      '6M': MultiPeriodStats;
      '9M': MultiPeriodStats;
      '1Y': MultiPeriodStats;
      '2Y': MultiPeriodStats;
    };
    heatMap: HeatMapYear[];
    drawdown: DrawdownPeriod[];
    taxImpact: TaxImpact;
  };
}

export interface PortfolioView {
  id: string;
  name: string;
  description?: string | null;
  totalValue?: number | null;
  investedValue?: number | null;
  currentValue?: number | null;
  totalPnL?: number | null;
  totalPnLPercent?: number | null;
  dayPnL?: number | null;
  isActive?: boolean;
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrent: number;
  totalPnL: number;
  totalPnLPercent: number;
  holdingsCount: number;
  activeBrokers: number;
  liveStrategies: number;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function getData<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Request failed (${response.status})`);
  return body.data as T;
}

const emptyStats = (): MultiPeriodStats => ({
  winRate: 0, avgReturn: 0, sharpe: 0, maxDrawdown: 0, trades: 0
});

export const portfolioService = {
  getPortfolios(): Promise<PortfolioView[]> {
    return getData('/portfolio/portfolios');
  },

  getSummary(): Promise<PortfolioSummary> {
    return getData('/portfolio/summary');
  },

  getTrades(): Promise<Array<Record<string, unknown>>> {
    return getData('/portfolio/trades');
  },

  async getAdvancedMetrics(period: string = '1Y', strategyId?: string): Promise<AdvancedMetricsResponse> {
    const token = localStorage.getItem('authToken');
    const url = strategyId
      ? `${API_BASE_URL}/portfolio/advanced-metrics?period=${period}&strategyId=${strategyId}`
      : `${API_BASE_URL}/portfolio/advanced-metrics?period=${period}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        data: {
          multiPeriodStats: { '6M': emptyStats(), '9M': emptyStats(), '1Y': emptyStats(), '2Y': emptyStats() },
          heatMap: [],
          drawdown: [],
          taxImpact: {
            shortTermGains: 0, longTermGains: 0, shortTermTax: 0, longTermTax: 0,
            totalTaxLiability: 0, netReturns: 0, effectiveTaxRate: 0
          }
        }
      };
    }

    return await response.json();
  },

  async getPerformanceComparison(timeRange: string = '1Y'): Promise<PerformanceComparisonResponse> {
    const token = localStorage.getItem('authToken');
    const response = await fetch(
      `${API_BASE_URL}/portfolio/performance-comparison?timeRange=${timeRange}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return {
        success: false,
        data: {
          timeRange,
          performanceData: [],
          summary: {
            smallcap: { currentValue: 0, returnPercent: '0' },
            largecap: { currentValue: 0, returnPercent: '0' }
          }
        }
      };
    }

    return await response.json();
  },
};
