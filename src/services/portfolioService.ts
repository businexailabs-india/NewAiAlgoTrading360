/**
 * Portfolio Service
 * Handles portfolio-related API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

export const portfolioService = {
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
  }
};
