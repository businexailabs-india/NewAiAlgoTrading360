/**
 * QuantConnect Controller
 * Handles API requests for QuantConnect integration
 */

import { Request, Response } from 'express';
import { getQuantConnectService } from '../services/quantconnect.service';

/**
 * Get all QuantConnect projects
 */
export const getProjects = async (req: Request, res: Response) => {
  try {
    const qcService = getQuantConnectService();
    const projects = await qcService.getProjects();

    res.json({
      success: true,
      data: projects
    });
  } catch (error: any) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch projects'
    });
  }
};

/**
 * Create a new project
 */
export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, language } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required'
      });
    }

    const qcService = getQuantConnectService();
    const project = await qcService.createProject(name, language || 'Py');

    res.json({
      success: true,
      data: project
    });
  } catch (error: any) {
    console.error('Error creating project:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create project'
    });
  }
};

/**
 * Run a backtest
 */
export const runBacktest = async (req: Request, res: Response) => {
  try {
    const { projectId, name } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and backtest name are required'
      });
    }

    const qcService = getQuantConnectService();
    const result = await qcService.createBacktest(parseInt(projectId), name);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error running backtest:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to run backtest'
    });
  }
};

/**
 * Get backtest results
 */
export const getBacktestResults = async (req: Request, res: Response) => {
  try {
    const { projectId, backtestId } = req.params;

    if (!projectId || !backtestId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and backtest ID are required'
      });
    }

    const qcService = getQuantConnectService();
    const results = await qcService.getBacktestResults(parseInt(projectId), backtestId);

    res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    console.error('Error fetching backtest results:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch backtest results'
    });
  }
};

/**
 * Get monthly returns for heat map
 */
export const getMonthlyReturns = async (req: Request, res: Response) => {
  try {
    const { projectId, backtestId } = req.params;

    if (!projectId || !backtestId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and backtest ID are required'
      });
    }

    const qcService = getQuantConnectService();
    const monthlyReturns = await qcService.getMonthlyReturns(parseInt(projectId), backtestId);

    res.json({
      success: true,
      data: monthlyReturns
    });
  } catch (error: any) {
    console.error('Error fetching monthly returns:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch monthly returns'
    });
  }
};

/**
 * Get strategy metrics for dashboard
 */
export const getStrategyMetrics = async (req: Request, res: Response) => {
  try {
    const { projectId, backtestId } = req.params;

    if (!projectId || !backtestId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and backtest ID are required'
      });
    }

    const qcService = getQuantConnectService();
    const metrics = await qcService.getStrategyMetrics(parseInt(projectId), backtestId);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error('Error fetching strategy metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch strategy metrics'
    });
  }
};

/**
 * Get live algorithm status
 */
export const getLiveAlgorithm = async (req: Request, res: Response) => {
  try {
    const { projectId, deployId } = req.params;

    if (!projectId || !deployId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and deploy ID are required'
      });
    }

    const qcService = getQuantConnectService();
    const liveAlgo = await qcService.getLiveAlgorithm(parseInt(projectId), deployId);

    res.json({
      success: true,
      data: liveAlgo
    });
  } catch (error: any) {
    console.error('Error fetching live algorithm:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch live algorithm'
    });
  }
};

/**
 * Deploy algorithm to live trading
 */
export const deployLive = async (req: Request, res: Response) => {
  try {
    const { projectId, compileId, brokerage, settings } = req.body;

    if (!projectId || !compileId || !brokerage) {
      return res.status(400).json({
        success: false,
        error: 'Project ID, compile ID, and brokerage are required'
      });
    }

    // Same RMS live gate as OMS — advisory and QC cannot bypass
    if (process.env.LIVE_TRADING_ENABLED !== 'true') {
      return res.status(403).json({
        success: false,
        error: 'Live trading disabled. LIVE_TRADING_ENABLED must be true and RMS approved.'
      });
    }
    const { RiskGateService } = await import('../services/risk-gate.service');
    await RiskGateService.ensureGlobalControl();
    const { prisma } = await import('../config/database');
    const globalCtrl = await prisma.tradingControl.findFirst({
      where: { scope: 'GLOBAL', userId: null }
    });
    if (globalCtrl?.killSwitch) {
      return res.status(403).json({ success: false, error: 'Kill switch is active' });
    }
    if (!globalCtrl?.liveTradingEnabled || globalCtrl.approvalState !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        error: 'Live deployment requires admin RMS approval'
      });
    }

    const qcService = getQuantConnectService();
    const result = await qcService.deployLive(
      parseInt(projectId),
      compileId,
      brokerage,
      settings || {}
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Error deploying live algorithm:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to deploy live algorithm'
    });
  }
};

/**
 * Stop live algorithm
 */
export const stopLiveAlgorithm = async (req: Request, res: Response) => {
  try {
    const { projectId, deployId } = req.params;

    if (!projectId || !deployId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and deploy ID are required'
      });
    }

    const qcService = getQuantConnectService();
    const success = await qcService.stopLiveAlgorithm(parseInt(projectId), deployId);

    res.json({
      success,
      message: success ? 'Live algorithm stopped successfully' : 'Failed to stop live algorithm'
    });
  } catch (error: any) {
    console.error('Error stopping live algorithm:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to stop live algorithm'
    });
  }
};

/**
 * Get live algorithm logs
 */
export const getLiveLogs = async (req: Request, res: Response) => {
  try {
    const { projectId, algorithmId } = req.params;
    const { start, end } = req.query;

    if (!projectId || !algorithmId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and algorithm ID are required'
      });
    }

    const qcService = getQuantConnectService();
    const logs = await qcService.getLiveLogs(
      parseInt(projectId),
      algorithmId,
      start ? parseInt(start as string) : undefined,
      end ? parseInt(end as string) : undefined
    );

    res.json({
      success: true,
      data: logs
    });
  } catch (error: any) {
    console.error('Error fetching live logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch live logs'
    });
  }
};
