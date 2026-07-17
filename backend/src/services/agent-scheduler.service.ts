import { prisma } from '../config/database';
import { TradingAgentService } from './trading-agent.service';
import { isMarketOpen } from '../utils/helpers';
import { logger } from '../utils/logger';

let schedulerInterval: NodeJS.Timeout | null = null;
let running = false;
const agentLocks = new Set<string>();

export function startAgentScheduler(intervalMs = 15 * 60 * 1000) {
  if (schedulerInterval) return;

  schedulerInterval = setInterval(async () => {
    if (running) {
      logger.warn('Agent scheduler skipped — previous cycle still running');
      return;
    }
    if (!isMarketOpen()) return;

    running = true;
    try {
      const activeAgents = await prisma.tradingAgent.findMany({
        where: { isActive: true }
      });

      for (const agent of activeAgents) {
        if (agentLocks.has(agent.id)) {
          logger.warn(`Agent ${agent.id} skipped — already running`);
          continue;
        }
        agentLocks.add(agent.id);
        try {
          logger.info(`Scheduler running agent: ${agent.name} (${agent.id}) mode=${agent.mode}`);
          await TradingAgentService.runAgent(agent.userId, agent.id);
        } catch (err) {
          logger.error(`Scheduler agent ${agent.id} failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          agentLocks.delete(agent.id);
        }
      }
    } catch (err) {
      logger.error(`Agent scheduler error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running = false;
    }
  }, intervalMs);

  logger.info(`Trading agent scheduler started (every ${intervalMs / 60000} min during market hours)`);
}

export function stopAgentScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  agentLocks.clear();
  running = false;
}
