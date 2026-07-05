import { prisma } from '../config/database';
import { TradingAgentService } from './trading-agent.service';
import { isMarketOpen } from '../utils/helpers';
import { logger } from '../utils/logger';

let schedulerInterval: NodeJS.Timeout | null = null;

export function startAgentScheduler(intervalMs = 15 * 60 * 1000) {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    if (!isMarketOpen()) return;

    try {
      const activeAgents = await prisma.tradingAgent.findMany({
        where: { isActive: true }
      });

      for (const agent of activeAgents) {
        try {
          logger.info(`Scheduler running agent: ${agent.name} (${agent.id})`);
          await TradingAgentService.runAgent(agent.userId, agent.id);
        } catch (err) {
          logger.error(`Scheduler agent ${agent.id} failed:`, err);
        }
      }
    } catch (err) {
      logger.error('Agent scheduler error:', err);
    }
  }, intervalMs);

  logger.info(`Trading agent scheduler started (every ${intervalMs / 60000} min during market hours)`);
}

export function stopAgentScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
