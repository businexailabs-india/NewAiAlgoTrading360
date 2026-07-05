/**
 * QuantConnect Frontend Service
 * Handles API calls to QuantConnect backend endpoints
 */

import { API_BASE_URL } from '../lib/api';

export interface QCProject {
  projectId: number;
  name: string;
  created: string;
  modified: string;
  language: 'Py' | 'C#';
}

export interface QCBacktestResult {
  backtestId: string;
  projectId: string;
  statistics: {
    totalTrades: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
    annualReturn: number;
    totalReturn: number;
    profitLoss: number;
    alpha: number;
    beta: number;
  };
  trades: QCTrade[];
  equity: { time: string; value: number }[];
}

export interface QCTrade {
  symbol: string;
  entryTime: string;
  exitTime: string;
  direction: 'Long' | 'Short';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  duration: string;
  exitReason: string;
}

export interface QCStrategyMetrics {
  totalPnL: number;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  alpha: number;
  beta: number;
}

export interface QCMonthlyReturn {
  month: string;
  return: string;
  trades: number;
  totalPnL: number;
}

export interface QCLiveAlgorithm {
  projectId: number;
  deployId: string;
  status: string;
  launched: string;
  stopped?: string;
  brokerage: string;
  subscription: string;
  error?: string;
}

export const quantconnectService = {
  /**
   * Get all projects
   */
  async getProjects(): Promise<QCProject[]> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/quantconnect/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching QuantConnect projects:', error);
      throw error;
    }
  },

  /**
   * Create a new project
   */
  async createProject(name: string, language: 'Py' | 'C#' = 'Py'): Promise<QCProject> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/quantconnect/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, language }),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error creating QuantConnect project:', error);
      throw error;
    }
  },

  /**
   * Run a backtest
   */
  async runBacktest(projectId: number, name: string): Promise<{ backtestId: string; success: boolean }> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/quantconnect/backtest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId, name }),
      });

      if (!response.ok) {
        throw new Error('Failed to run backtest');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error running backtest:', error);
      throw error;
    }
  },

  /**
   * Get backtest results
   */
  async getBacktestResults(projectId: number, backtestId: string): Promise<QCBacktestResult> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_BASE_URL}/quantconnect/backtest/${projectId}/${backtestId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch backtest results');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching backtest results:', error);
      throw error;
    }
  },

  /**
   * Get monthly returns for heat map
   */
  async getMonthlyReturns(projectId: number, backtestId: string): Promise<QCMonthlyReturn[]> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_BASE_URL}/quantconnect/backtest/${projectId}/${backtestId}/monthly-returns`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch monthly returns');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching monthly returns:', error);
      throw error;
    }
  },

  /**
   * Get strategy metrics
   */
  async getStrategyMetrics(projectId: number, backtestId: string): Promise<QCStrategyMetrics> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_BASE_URL}/quantconnect/backtest/${projectId}/${backtestId}/metrics`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch strategy metrics');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching strategy metrics:', error);
      throw error;
    }
  },

  /**
   * Get live algorithm status
   */
  async getLiveAlgorithm(projectId: number, deployId: string): Promise<QCLiveAlgorithm> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_BASE_URL}/quantconnect/live/${projectId}/${deployId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch live algorithm');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error fetching live algorithm:', error);
      throw error;
    }
  },

  /**
   * Deploy algorithm to live trading
   */
  async deployLive(
    projectId: number,
    compileId: string,
    brokerage: string,
    settings: any = {}
  ): Promise<{ deployId: string; success: boolean }> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/quantconnect/live/deploy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId, compileId, brokerage, settings }),
      });

      if (!response.ok) {
        throw new Error('Failed to deploy live algorithm');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Error deploying live algorithm:', error);
      throw error;
    }
  },

  /**
   * Stop live algorithm
   */
  async stopLiveAlgorithm(projectId: number, deployId: string): Promise<boolean> {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_BASE_URL}/quantconnect/live/${projectId}/${deployId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to stop live algorithm');
      }

      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error stopping live algorithm:', error);
      throw error;
    }
  },

  /**
   * Get live algorithm logs
   */
  async getLiveLogs(
    projectId: number,
    algorithmId: string,
    start?: number,
    end?: number
  ): Promise<string[]> {
    try {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (start) params.append('start', start.toString());
      if (end) params.append('end', end.toString());

      const response = await fetch(
        `${API_BASE_URL}/quantconnect/live/${projectId}/${algorithmId}/logs?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch live logs');
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching live logs:', error);
      throw error;
    }
  },
};

export default quantconnectService;
