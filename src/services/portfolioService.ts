/**
 * Portfolio Service
 * Handles portfolio-related API calls
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

export const portfolioService = {
  /**
   * Get advanced metrics including heat map from actual trade data
   */
  async getAdvancedMetrics(period: string = '1Y', strategyId?: string): Promise<AdvancedMetricsResponse> {
    try {
      const token = localStorage.getItem('authToken');
      const url = strategyId 
        ? `${API_BASE_URL}/portfolio/advanced-metrics?period=${period}&strategyId=${strategyId}`
        : `${API_BASE_URL}/portfolio/advanced-metrics?period=${period}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch advanced metrics');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching advanced metrics:', error);
      return this.getMockAdvancedMetrics(period);
    }
  },

  /**
   * Get performance comparison data
   */
  async getPerformanceComparison(timeRange: string = '1Y'): Promise<PerformanceComparisonResponse> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_BASE_URL}/portfolio/performance-comparison?timeRange=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch performance comparison data');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching performance comparison:', error);
      // Return mock data as fallback
      return this.getMockPerformanceComparison(timeRange);
    }
  },

  /**
   * Mock data for development/fallback
   */
  getMockPerformanceComparison(timeRange: string): PerformanceComparisonResponse {
    let points = 52;
    switch(timeRange) {
      case '1M': points = 30; break;
      case '6M': points = 26; break;
      case '1Y': points = 52; break;
      case '3Y': points = 36; break;
      case 'MAX': points = 60; break;
    }

    const data: PerformanceComparisonData[] = [];
    for (let i = 0; i < points; i++) {
      const smallcap = 100 + (Math.random() * 20 - 5) + (i * 0.3);
      const largecap = 100 + (Math.random() * 15 - 3) + (i * 0.15);
      
      data.push({
        index: i,
        date: new Date(Date.now() - (points - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        smallcap: Number(smallcap.toFixed(2)),
        largecap: Number(largecap.toFixed(2))
      });
    }

    const currentSmallcap = data[data.length - 1].smallcap;
    const currentLargecap = data[data.length - 1].largecap;

    return {
      success: true,
      data: {
        timeRange,
        performanceData: data,
        summary: {
          smallcap: {
            currentValue: currentSmallcap,
            returnPercent: ((currentSmallcap - 100) / 100 * 100).toFixed(2)
          },
          largecap: {
            currentValue: currentLargecap,
            returnPercent: ((currentLargecap - 100) / 100 * 100).toFixed(2)
          }
        }
      }
    };
  },

  /**
   * Mock advanced metrics data
   */
  getMockAdvancedMetrics(period: string): AdvancedMetricsResponse {
    // Generate heat map data from mock trades
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const years = ['2023', '2024'];
    
    const heatMap: HeatMapYear[] = years.map(year => ({
      year,
      months: months.map(month => {
        const trades = Math.floor(Math.random() * 50) + 10;
        const avgPnL = (Math.random() * 5000 - 1000);
        const totalPnL = avgPnL * trades;
        const returnPercent = (Math.random() * 20 - 5);
        
        return {
          month,
          return: returnPercent.toFixed(2),
          trades,
          totalPnL: Number(totalPnL.toFixed(2))
        };
      })
    }));

    return {
      success: true,
      data: {
        multiPeriodStats: {
          '6M': { winRate: 68.5, avgReturn: 12.4, sharpe: 1.85, maxDrawdown: -6.2, trades: 145 },
          '9M': { winRate: 71.2, avgReturn: 18.7, sharpe: 1.92, maxDrawdown: -8.1, trades: 218 },
          '1Y': { winRate: 69.8, avgReturn: 24.5, sharpe: 1.88, maxDrawdown: -9.5, trades: 289 },
          '2Y': { winRate: 72.1, avgReturn: 52.3, sharpe: 2.05, maxDrawdown: -12.3, trades: 612 }
        },
        heatMap,
        drawdown: [
          { period: 'Current', value: -2.3, duration: '5 days', recovery: 'In progress' },
          { period: 'Max (1Y)', value: -9.5, duration: '23 days', recovery: '45 days' },
          { period: 'Max (2Y)', value: -12.3, duration: '31 days', recovery: '67 days' },
          { period: 'Avg', value: -4.2, duration: '12 days', recovery: '28 days' }
        ],
        taxImpact: {
          shortTermGains: 125000,
          longTermGains: 89000,
          shortTermTax: 18750,
          longTermTax: 8900,
          totalTaxLiability: 27650,
          netReturns: 185350,
          effectiveTaxRate: 12.98
        }
      }
    };
  }
};
