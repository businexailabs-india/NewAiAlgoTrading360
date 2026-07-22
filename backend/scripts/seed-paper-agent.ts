/**
 * Seed + run a paper trading agent so Algos workspace has a live runnable row.
 * Usage: npx ts-node --transpile-only scripts/seed-paper-agent.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { TradingAgentService } from '../src/services/trading-agent.service';

const prisma = new PrismaClient();

async function main() {
  const user =
    (await prisma.user.findFirst({ where: { email: 'local@smarttrade.test' } })) ||
    (await prisma.user.findFirst());
  if (!user) throw new Error('No user found — start backend and open the app once');

  const engine = await prisma.predictionEngine.findFirst({ where: { userId: user.id } });
  const existing = await prisma.tradingAgent.findFirst({
    where: { userId: user.id, name: 'Paper Momentum Desk' }
  });

  const agent =
    existing ||
    (await TradingAgentService.createAgent(user.id, {
      name: 'Paper Momentum Desk',
      description: 'Paper-first screener + momentum agent (simulated MARKET orders only).',
      mode: 'paper',
      engineId: engine?.id,
      config: {
        minConfidence: 50,
        maxPositionValue: 50000,
        maxOrdersPerRun: 3,
        defaultQuantity: 1,
        useScreener: true,
        screenerTopN: 8,
        symbols: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'],
        product: 'CNC'
      }
    }));

  await TradingAgentService.updateAgent(user.id, agent.id, { isActive: true });
  const result = await TradingAgentService.runAgent(user.id, agent.id);

  console.log(
    JSON.stringify(
      {
        userId: user.id,
        agentId: agent.id,
        mode: 'paper',
        signals: result.signals.length,
        ordersPlaced: result.ordersPlaced.length,
        orders: result.ordersPlaced
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
