/**
 * QuantConnect API Service
 * Handles integration with QuantConnect Cloud for backtesting and live trading
 */

import axios, { AxiosInstance } from 'axios';

interface QuantConnectConfig {
  userId: string;
  apiToken: string;
  baseUrl?: string;
}

interface BacktestResult {
  success: boolean;
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
    treynorRatio: number;
    informationRatio: number;
  };
  trades: Trade[];
  equity: EquityPoint[];
  charts: any;
}

interface Trade {
  symbol: string;
  entryTime: string;
  exitTime: string;
  direction: 'Long' | 'Short';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  mae: number; // Maximum Adverse Excursion
  mfe: number; // Maximum Favorable Excursion
  duration: string;
  exitReason: string;
}

interface EquityPoint {
  time: string;
  value: number;
}

interface Project {
  projectId: number;
  name: string;
  created: string;
  modified: string;
  language: 'Py' | 'C#';
}

interface LiveAlgorithm {
  projectId: number;
  deployId: string;
  status: string;
  launched: string;
  stopped?: string;
  brokerage: string;
  subscription: string;
  error?: string;
}

export class QuantConnectService {
  private api: AxiosInstance;
  private userId: string;
  private apiToken: string;

  constructor(config: QuantConnectConfig) {
    this.userId = config.userId;
    this.apiToken = config.apiToken;

    this.api = axios.create({
      baseURL: config.baseUrl || 'https://api.quantconnect.com',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${config.userId}:${config.apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get list of projects
   */
  async getProjects(): Promise<Project[]> {
    try {
      const response = await this.api.get('/api/v2/projects/read');
      return response.data.projects || [];
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw new Error('Failed to fetch QuantConnect projects');
    }
  }

  /**
   * Create a new project
   */
  async createProject(name: string, language: 'Py' | 'C#' = 'Py'): Promise<Project> {
    try {
      const response = await this.api.post('/api/v2/projects/create', {
        name,
        language
      });
      return response.data.projects[0];
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error('Failed to create QuantConnect project');
    }
  }

  /**
   * Run a backtest
   */
  async createBacktest(projectId: number, name: string): Promise<{ backtestId: string; success: boolean }> {
    try {
      const response = await this.api.post('/api/v2/backtests/create', {
        projectId,
        compileId: '', // Latest compile
        backtestName: name
      });
      
      return {
        backtestId: response.data.backtestId,
        success: response.data.success
      };
    } catch (error) {
      console.error('Error creating backtest:', error);
      throw new Error('Failed to create backtest');
    }
  }

  /**
   * Get backtest results
   */
  async getBacktestResults(projectId: number, backtestId: string): Promise<BacktestResult> {
    try {
      const response = await this.api.get(`/api/v2/backtests/${projectId}/read`, {
        params: { backtestId }
      });

      const data = response.data;
      const stats = data.result?.Statistics || {};
      const trades = data.result?.Orders || [];

      return {
        success: data.success,
        backtestId,
        projectId: projectId.toString(),
        statistics: {
          totalTrades: parseInt(stats['Total Orders']) || 0,
          winRate: parseFloat(stats['Win Rate']) || 0,
          sharpeRatio: parseFloat(stats['Sharpe Ratio']) || 0,
          maxDrawdown: parseFloat(stats['Drawdown']) || 0,
          annualReturn: parseFloat(stats['Compounding Annual Return']) || 0,
          totalReturn: parseFloat(stats['Total Net Profit']) || 0,
          profitLoss: parseFloat(stats['Net Profit']) || 0,
          alpha: parseFloat(stats['Alpha']) || 0,
          beta: parseFloat(stats['Beta']) || 0,
          treynorRatio: parseFloat(stats['Treynor Ratio']) || 0,
          informationRatio: parseFloat(stats['Information Ratio']) || 0
        },
        trades: this.parseTrades(trades),
        equity: this.parseEquityCurve(data.result?.Charts),
        charts: data.result?.Charts
      };
    } catch (error) {
      console.error('Error fetching backtest results:', error);
      throw new Error('Failed to fetch backtest results');
    }
  }

  /**
   * Get live algorithm status
   */
  async getLiveAlgorithm(projectId: number, deployId: string): Promise<LiveAlgorithm> {
    try {
      const response = await this.api.get(`/api/v2/live/${projectId}/read`, {
        params: { deployId }
      });

      return response.data.live;
    } catch (error) {
      console.error('Error fetching live algorithm:', error);
      throw new Error('Failed to fetch live algorithm status');
    }
  }

  /**
   * Deploy algorithm to live trading
   */
  async deployLive(
    projectId: number,
    compileId: string,
    brokerage: string,
    baseLiveAlgorithmSettings: any
  ): Promise<{ deployId: string; success: boolean }> {
    try {
      const response = await this.api.post('/api/v2/live/create', {
        projectId,
        compileId,
        serverType: brokerage,
        baseLiveAlgorithmSettings
      });

      return {
        deployId: response.data.deployId,
        success: response.data.success
      };
    } catch (error) {
      console.error('Error deploying live algorithm:', error);
      throw new Error('Failed to deploy live algorithm');
    }
  }

  /**
   * Stop live algorithm
   */
  async stopLiveAlgorithm(projectId: number, deployId: string): Promise<boolean> {
    try {
      const response = await this.api.post('/api/v2/live/delete', {
        projectId,
        deployId
      });

      return response.data.success;
    } catch (error) {
      console.error('Error stopping live algorithm:', error);
      throw new Error('Failed to stop live algorithm');
    }
  }

  /**
   * Get live algorithm logs
   */
  async getLiveLogs(projectId: number, algorithmId: string, start?: number, end?: number): Promise<string[]> {
    try {
      const response = await this.api.get(`/api/v2/live/${projectId}/read/log`, {
        params: {
          algorithmId,
          start: start || 0,
          end: end || Date.now()
        }
      });

      return response.data.logs || [];
    } catch (error) {
      console.error('Error fetching live logs:', error);
      throw new Error('Failed to fetch live logs');
    }
  }

  /**
   * Parse trades from QuantConnect format
   */
  private parseTrades(orders: any[]): Trade[] {
    return orders.map(order => ({
      symbol: order.Symbol?.Value || '',
      entryTime: order.Time || '',
      exitTime: order.LastFillTime || order.Time,
      direction: order.Direction === 0 ? 'Long' : 'Short',
      quantity: Math.abs(order.Quantity || 0),
      entryPrice: order.Price || 0,
      exitPrice: order.Price || 0,
      pnl: order.Value || 0,
      pnlPercent: 0, // Calculate separately
      mae: 0,
      mfe: 0,
      duration: '',
      exitReason: order.Status || 'Filled'
    }));
  }

  /**
   * Parse equity curve from charts
   */
  private parseEquityCurve(charts: any): EquityPoint[] {
    if (!charts || !charts['Strategy Equity']) {
      return [];
    }

    const equityData = charts['Strategy Equity'].Series['Equity'].Values;
    return equityData.map((point: any) => ({
      time: new Date(point.x * 1000).toISOString(),
      value: point.y
    }));
  }

  /**
   * Calculate monthly returns for heat map
   */
  async getMonthlyReturns(projectId: number, backtestId: string): Promise<any[]> {
    const results = await this.getBacktestResults(projectId, backtestId);
    const equity = results.equity;

    // Group by month
    const monthlyData: { [key: string]: { start: number; end: number; trades: number } } = {};

    equity.forEach(point => {
      const date = new Date(point.time);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { start: point.value, end: point.value, trades: 0 };
      }
      monthlyData[monthKey].end = point.value;
    });

    // Count trades per month
    results.trades.forEach(trade => {
      const date = new Date(trade.entryTime);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].trades++;
      }
    });

    // Calculate returns
    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      return: ((data.end - data.start) / data.start * 100).toFixed(2),
      trades: data.trades,
      totalPnL: data.end - data.start
    }));
  }

  /**
   * Get strategy performance metrics for dashboard
   */
  async getStrategyMetrics(projectId: number, backtestId: string) {
    const results = await this.getBacktestResults(projectId, backtestId);

    return {
      totalPnL: results.statistics.profitLoss,
      totalTrades: results.statistics.totalTrades,
      winRate: results.statistics.winRate,
      avgReturn: results.statistics.annualReturn / 12, // Monthly average
      sharpeRatio: results.statistics.sharpeRatio,
      maxDrawdown: results.statistics.maxDrawdown,
      alpha: results.statistics.alpha,
      beta: results.statistics.beta
    };
  }
}

// Singleton instance
let quantConnectService: QuantConnectService | null = null;

export function initializeQuantConnect(config: QuantConnectConfig): QuantConnectService {
  quantConnectService = new QuantConnectService(config);
  return quantConnectService;
}

export function getQuantConnectService(): QuantConnectService {
  if (!quantConnectService) {
    throw new Error('QuantConnect service not initialized. Call initializeQuantConnect first.');
  }
  return quantConnectService;
}

export default QuantConnectService;
