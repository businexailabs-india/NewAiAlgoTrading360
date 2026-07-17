/**
 * Lightweight verification for Dhan MCP execution plumbing.
 * Run: npx ts-node scripts/verify-dhan-mcp.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { EncryptionService } from '../src/services/encryption.service';
import { capabilityMatrixFromTools, DHAN_CAPABILITY_REGISTRY } from '../src/services/dhan-capability.registry';
import { RiskGateService } from '../src/services/risk-gate.service';
import { OrderReconcilerService } from '../src/services/order-reconciler.service';
import { prisma } from '../src/config/database';

async function main() {
  console.log('== Encryption roundtrip ==');
  const secret = 'dhan-token-test-123';
  const enc = EncryptionService.encrypt(secret);
  const dec = EncryptionService.decrypt(enc);
  if (dec !== secret) throw new Error('Encryption roundtrip failed');
  console.log('OK', enc.slice(0, 24) + '...');

  console.log('== Capability registry ==');
  const tools = ['trading_agent_tool', 'portfolio_agent_tool', 'market_data_agent_tool', 'search_agent_tool'];
  const matrix = capabilityMatrixFromTools(tools);
  const trading = matrix['trading.place'];
  const funds = matrix['portfolio.funds'];
  if (!trading || !funds) throw new Error('Capability mapping incomplete');
  console.log('OK catalog size', DHAN_CAPABILITY_REGISTRY.length, 'trading.place=', trading);

  console.log('== Status normalize ==');
  if (OrderReconcilerService.normalizeStatus('TRADED') !== 'COMPLETE') throw new Error('TRADED map failed');
  if (OrderReconcilerService.normalizeStatus('TRANSIT') !== 'PENDING') throw new Error('TRANSIT map failed');
  console.log('OK');

  console.log('== Global trading control seed ==');
  const ctrl = await RiskGateService.ensureGlobalControl();
  console.log('OK live=', ctrl.liveTradingEnabled, 'kill=', ctrl.killSwitch, 'approval=', ctrl.approvalState);

  console.log('== LIVE_TRADING_ENABLED env ==');
  console.log('OK env=', process.env.LIVE_TRADING_ENABLED === 'true');

  console.log('== Tables present ==');
  const mcpCount = await prisma.mcpServerConfig.count();
  const ctxCount = await prisma.userExecutionContext.count();
  const attemptCount = await prisma.executionAttempt.count();
  console.log('OK mcp=', mcpCount, 'contexts=', ctxCount, 'attempts=', attemptCount);

  console.log('\nAll verification checks passed (paper-first).');
}

main()
  .catch(err => {
    console.error('VERIFY FAILED', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
