/**
 * ExecutionGovernance360 acceptance tests
 * Run: npm run test:execution-governance
 */
import { prisma } from '../src/config/database';
import { ExecutionGovernanceService } from '../src/services/execution-governance/execution-governance.service';
import { sourceCanExecuteDirectly } from '../src/libs/execution-governance/source-authority';
import { validatePreapprovalRule } from '../src/libs/execution-governance/preapproval-rules';
import {
  evaluateBrokerGuardrail,
  evaluateOmsGatekeeper
} from '../src/libs/execution-governance/order-gatekeeper';
import { BEGINNER_BLOCKED_ALGOS } from '../src/libs/execution-governance/algo-selection';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  assert(!sourceCanExecuteDirectly('AI_ADVISORY'), 'AI cannot execute');
  assert(!sourceCanExecuteDirectly('TRADINGVIEW_ALERT'), 'TV cannot execute');
  assert(!sourceCanExecuteDirectly('DHANLAXMI_PROMPT'), 'DhanLaxmi cannot execute');
  assert(!sourceCanExecuteDirectly('STRATEGY_ENGINE'), 'Strategy cannot execute directly');
  assert(sourceCanExecuteDirectly('OMS'), 'OMS can execute');

  const brokerBlock = evaluateBrokerGuardrail({
    callerService: 'AI',
    mode: 'LIVE',
    liveTradingEnabled: true,
    rmsDecisionId: 'x',
    approvalId: 'y',
    idempotencyKey: 'z'
  });
  assert(!brokerBlock.passed, 'broker rejects non-OMS');

  const omsOk = evaluateOmsGatekeeper({
    callerService: 'OMS',
    mode: 'PAPER',
    liveTradingEnabled: false,
    killSwitch: false,
    rmsStatus: 'PAPER_ONLY',
    rmsDecisionId: 'rms1',
    idempotencyKey: 'id1',
    marketDataFresh: true,
    brokerConnected: true
  });
  assert(omsOk.passed, 'OMS paper gate passes');

  assert(BEGINNER_BLOCKED_ALGOS.includes('martingale'), 'martingale blocked');

  const email = `eg-${Date.now()}@test.local`;
  const user = await prisma.user.create({
    data: { email, passwordHash: 'x', name: 'EG Test', role: 'user' }
  });

  try {
    // AI recommend path
    const aiIntent = await ExecutionGovernanceService.createIntent(user.id, {
      source: 'AI_ADVISORY',
      mode: 'PAPER',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 1,
      price: 1400,
      stop_loss: 1350
    });
    const aiEval = await ExecutionGovernanceService.evaluate(user.id, aiIntent.id);
    assert(aiEval.decision === 'RECOMMENDATION_ONLY', 'AI recommendation only');
    assert(aiEval.can_execute_directly === false, 'AI no direct exec');
    console.log('OK AI recommend');

    // TradingView signal
    const tv = await ExecutionGovernanceService.createIntent(user.id, {
      source: 'TRADINGVIEW_ALERT',
      mode: 'PAPER',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 1,
      price: 1400,
      stop_loss: 1350,
      signal_id: 'sig1'
    });
    const tvEval = await ExecutionGovernanceService.evaluate(user.id, tv.id);
    assert(tvEval.decision === 'SIGNAL_ACCEPTED', 'TV signal accepted');
    assert(tvEval.can_execute_directly === false, 'TV no direct');
    console.log('OK TradingView signal');

    // DhanLaxmi draft + reject
    const dl = await ExecutionGovernanceService.createIntent(user.id, {
      source: 'DHANLAXMI_PROMPT',
      mode: 'PAPER',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 10,
      price: 1400
    });
    await ExecutionGovernanceService.evaluate(user.id, dl.id);
    await ExecutionGovernanceService.requestApproval(user.id, dl.id);
    await ExecutionGovernanceService.approveIntent(user.id, dl.id, false);
    const rejected = await ExecutionGovernanceService.getIntent(user.id, dl.id);
    assert(rejected.status === 'USER_REJECTED', 'user rejected');
    console.log('OK DhanLaxmi reject');

    // Full paper path USER_MANUAL
    const manual = await ExecutionGovernanceService.createIntent(user.id, {
      source: 'USER_MANUAL',
      mode: 'PAPER',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 1,
      price: 1400,
      stop_loss: 1350
    });
    await ExecutionGovernanceService.evaluate(user.id, manual.id);
    await ExecutionGovernanceService.approveIntent(user.id, manual.id, true);
    const rms = await ExecutionGovernanceService.submitToRms(user.id, manual.id);
    assert(rms.rms.status === 'PAPER_ONLY' || rms.rms.status === 'APPROVED', 'RMS paper');
    const oms = await ExecutionGovernanceService.submitToOms(user.id, manual.id);
    assert(!!oms.order?.id, 'OMS paper order');
    console.log('OK paper OMS');

    // Live blocked without approval
    const live = await ExecutionGovernanceService.createIntent(user.id, {
      source: 'USER_MANUAL',
      mode: 'LIVE',
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 1,
      price: 1400
    });
    await ExecutionGovernanceService.evaluate(user.id, live.id);
    const liveIntent = await ExecutionGovernanceService.getIntent(user.id, live.id);
    assert(
      liveIntent.status === 'PAPER_TEST_REQUIRED' || liveIntent.status === 'USER_APPROVAL_REQUIRED',
      'live gated'
    );
    console.log('OK live gated');

    // Preapproval validation
    const rule = await ExecutionGovernanceService.createPreapprovalRule(user.id, {
      mode: 'PAPER',
      allowed_symbols: ['RELIANCE'],
      max_quantity_per_order: 2,
      max_risk_per_trade: 300,
      requires_stop_loss: true
    });
    const badQty = validatePreapprovalRule(rule, {
      symbol: 'RELIANCE',
      side: 'BUY',
      quantity: 10,
      mode: 'PAPER',
      stopLoss: 1350,
      price: 1400
    });
    assert(!badQty.ok, 'qty above preapproval rejected');
    const expired = validatePreapprovalRule(
      { ...rule, validUntil: new Date(Date.now() - 1000) },
      { symbol: 'RELIANCE', side: 'BUY', quantity: 1, mode: 'PAPER', stopLoss: 1350, price: 1400 }
    );
    assert(!expired.ok, 'expired preapproval');
    console.log('OK preapproval bounds');

    // Kill switch blocks add
    await prisma.tradingControl.create({
      data: { scope: 'USER', userId: user.id, killSwitch: true, liveTradingEnabled: false }
    });
    const killIntent = await ExecutionGovernanceService.createIntent(user.id, {
      source: 'CHART_ACTION',
      mode: 'PAPER',
      symbol: 'TCS',
      side: 'BUY',
      quantity: 1,
      price: 3500,
      stop_loss: 3400
    });
    await ExecutionGovernanceService.evaluate(user.id, killIntent.id);
    await ExecutionGovernanceService.approveIntent(user.id, killIntent.id, true);
    const killRms = await ExecutionGovernanceService.submitToRms(user.id, killIntent.id);
    assert(killRms.rms.status === 'REJECTED', 'kill switch blocks new entry');
    console.log('OK kill switch');

    // Exit allowed under kill switch policy at gatekeeper level
    const exitGate = evaluateOmsGatekeeper({
      callerService: 'OMS',
      mode: 'PAPER',
      liveTradingEnabled: false,
      killSwitch: true,
      rmsStatus: 'PAPER_ONLY',
      rmsDecisionId: 'r',
      idempotencyKey: 'e',
      isExit: true,
      allowExitDuringKillSwitch: true
    });
    assert(exitGate.passed, 'exit allowed under kill switch');

    const explain = ExecutionGovernanceService.dhanlaxmiExplain('Why was this trade blocked?');
    assert(/cannot execute|blocked/i.test(explain), 'dhanlaxmi explain');

    const audits = await ExecutionGovernanceService.getAudit(user.id, manual.id);
    assert(audits.length >= 3, 'audits exist');
    const timeline = await ExecutionGovernanceService.getTimeline(user.id, manual.id);
    assert(timeline.length >= 3, 'timeline exists');
    console.log('OK audits/timeline');

    console.log('\nunit-execution-governance: PASS');
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
