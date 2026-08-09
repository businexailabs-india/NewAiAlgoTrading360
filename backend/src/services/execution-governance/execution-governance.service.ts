import { randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { OrderExecutionService } from '../order-execution.service';
import { RiskGateService } from '../risk-gate.service';
import {
  getSourceAuthority,
  sourceCanExecuteDirectly,
  type ExecutionMode,
  type ExecutionSource
} from '../../libs/execution-governance/source-authority';
import { recommendAlgos, BEGINNER_BLOCKED_ALGOS } from '../../libs/execution-governance/algo-selection';
import { validatePreapprovalRule } from '../../libs/execution-governance/preapproval-rules';
import {
  evaluateBrokerGuardrail,
  evaluateOmsGatekeeper
} from '../../libs/execution-governance/order-gatekeeper';

function liveEnvEnabled() {
  return process.env.LIVE_TRADING_ENABLED === 'true';
}

export interface CreateIntentInput {
  source: ExecutionSource;
  mode?: ExecutionMode;
  strategy_id?: string;
  signal_id?: string;
  advisory_id?: string;
  dhanlaxmi_conversation_id?: string;
  account_id?: string;
  broker_provider_id?: string;
  instrument_id?: string;
  symbol: string;
  exchange?: string;
  asset_class?: string;
  instrument_type?: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  order_type?: string;
  product_type?: string;
  price?: number;
  trigger_price?: number;
  stop_loss?: number;
  target?: number;
  selected_algo_id?: string;
  source_payload?: Record<string, unknown>;
  idempotency_key?: string;
  is_exit?: boolean;
}

async function ensureAuthoritySeeded() {
  const count = await prisma.sourceAuthorityRule.count();
  if (count > 0) return;
  const sources: ExecutionSource[] = [
    'AI_ADVISORY',
    'TRADINGVIEW_ALERT',
    'DHANLAXMI_PROMPT',
    'USER_MANUAL',
    'ALGO_SCHEDULER',
    'STRATEGY_ENGINE',
    'BASKET_ORDER',
    'CHART_ACTION',
    'API_EXTERNAL',
    'OMS'
  ];
  for (const s of sources) {
    const a = getSourceAuthority(s);
    await prisma.sourceAuthorityRule.create({
      data: {
        source: s,
        authority: a.authority,
        canExecute: a.can_execute,
        description: a.description
      }
    });
  }
}

export class ExecutionGovernanceService {
  static async audit(
    userId: string,
    eventType: string,
    details: string,
    opts?: {
      intentId?: string;
      source?: string;
      eventStatus?: string;
      actorType?: string;
      actorId?: string;
      meta?: object;
    }
  ) {
    await prisma.executionAuditEvent.create({
      data: {
        userId,
        intentId: opts?.intentId,
        source: opts?.source,
        eventType,
        eventStatus: opts?.eventStatus,
        actorType: opts?.actorType || 'SYSTEM',
        actorId: opts?.actorId,
        detailsRedacted: details
      }
    });
  }

  static async timeline(intentId: string, status: string, detail: string, meta?: object) {
    await prisma.executionTimelineEvent.create({
      data: { intentId, status, detail, meta: meta || undefined }
    });
  }

  static async createIntent(userId: string, body: CreateIntentInput) {
    await ensureAuthoritySeeded();
    const source = body.source;
    const authority = getSourceAuthority(source);
    const mode: ExecutionMode = body.mode === 'LIVE' ? 'LIVE' : 'PAPER';
    const idempotencyKey = body.idempotency_key || `eg-${source}-${randomUUID()}`;

    const existing = await prisma.executionIntent.findUnique({ where: { idempotencyKey } });
    if (existing) {
      await this.audit(userId, 'execution.intent.duplicate', 'Duplicate idempotency', {
        intentId: existing.id,
        source,
        eventStatus: 'BLOCKED'
      });
      throw new AppError('Duplicate execution intent (idempotency)', 409);
    }

    const redacted = { ...(body.source_payload || {}) };
    delete (redacted as { secret?: string }).secret;
    delete (redacted as { access_token?: string }).access_token;
    delete (redacted as { password?: string }).password;

    const intent = await prisma.executionIntent.create({
      data: {
        userId,
        source,
        mode,
        authority: authority.authority,
        status: 'RECEIVED',
        strategyId: body.strategy_id,
        signalId: body.signal_id,
        advisoryId: body.advisory_id,
        dhanlaxmiConversationId: body.dhanlaxmi_conversation_id,
        accountId: body.account_id,
        brokerProviderId: body.broker_provider_id,
        instrumentId: body.instrument_id,
        symbol: body.symbol.toUpperCase(),
        exchange: body.exchange || 'NSE',
        assetClass: body.asset_class,
        instrumentType: body.instrument_type || 'STOCK',
        side: body.side,
        quantity: Math.floor(Number(body.quantity) || 0),
        orderType: body.order_type || 'MARKET',
        productType: body.product_type || 'CNC',
        price: body.price,
        triggerPrice: body.trigger_price,
        stopLoss: body.stop_loss,
        target: body.target,
        selectedAlgoId: body.selected_algo_id,
        sourcePayloadRedacted: redacted,
        idempotencyKey,
        nextAction: 'EVALUATE'
      }
    });

    await this.timeline(intent.id, 'RECEIVED', `Intent from ${source}`);
    await this.audit(userId, 'execution.intent.received', `${source} ${intent.side} ${intent.symbol}`, {
      intentId: intent.id,
      source,
      actorType: source.startsWith('DHAN') ? 'DHANLAXMI' : source.startsWith('AI') ? 'AI' : 'SYSTEM'
    });

    // Direct execution never allowed from non-OMS sources
    if (!sourceCanExecuteDirectly(source) && (body as { execute_now?: boolean }).execute_now) {
      await prisma.blockedExecutionAttempt.create({
        data: {
          userId,
          source,
          reason: 'direct_execution_blocked',
          intentId: intent.id,
          payload: { symbol: intent.symbol }
        }
      });
      await prisma.executionIntent.update({
        where: { id: intent.id },
        data: {
          status: 'BLOCKED',
          blockReason: 'Direct execution blocked — source cannot execute',
          nextAction: 'Run evaluate → approval → RMS → OMS'
        }
      });
      await this.timeline(intent.id, 'BLOCKED', 'direct_execution_blocked');
      await this.audit(userId, 'execution.source.blocked', 'direct_execution_blocked', {
        intentId: intent.id,
        source,
        eventStatus: 'BLOCKED'
      });
    }

    return this.normalizeIntent(userId, intent.id);
  }

  static async getIntent(userId: string, intentId: string) {
    const intent = await prisma.executionIntent.findFirst({ where: { id: intentId, userId } });
    if (!intent) throw new AppError('Execution intent not found', 404);
    return intent;
  }

  static async normalizeIntent(userId: string, intentId: string) {
    const intent = await this.getIntent(userId, intentId);
    if (intent.quantity <= 0) throw new AppError('Invalid quantity', 400);
    if (!['BUY', 'SELL'].includes(intent.side)) throw new AppError('Invalid side', 400);

    const updated = await prisma.executionIntent.update({
      where: { id: intentId },
      data: { status: 'NORMALIZED', nextAction: 'MATCH_STRATEGY' }
    });
    await this.timeline(intentId, 'NORMALIZED', 'Intent normalized');
    await this.audit(userId, 'execution.intent.normalized', intent.symbol, { intentId, source: intent.source });
    return updated;
  }

  static async evaluate(userId: string, intentId: string, opts?: { market_condition?: string }) {
    let intent = await this.getIntent(userId, intentId);
    if (['EXECUTED', 'OMS_ACCEPTED', 'BROKER_SENT', 'FAILED', 'CANCELLED'].includes(intent.status)) {
      return this.buildDecisionResponse(userId, intentId);
    }
    if (intent.status === 'RECEIVED') intent = await this.normalizeIntent(userId, intentId);

    // Source authority — never execute from AI/TV/DhanLaxmi
    const auth = getSourceAuthority(intent.source as ExecutionSource);
    if (auth.can_execute) {
      // only OMS
    } else {
      await this.timeline(intentId, 'SOURCE_AUTHORITY', `${intent.source}=${auth.authority}; can_execute=false`);
    }

    // Strategy match (draft if missing)
    let strategyId = intent.strategyId;
    if (!strategyId) {
      const draft = await prisma.strategy.create({
        data: {
          userId,
          name: `Draft ${intent.source} ${intent.symbol}`,
          description: 'Auto-draft from ExecutionGovernance360 — not approved for live',
          category: 'GOVERNANCE_DRAFT',
          code: '// draft — no guaranteed profit',
          parameters: { source: intent.source, intentId },
          isActive: false
        }
      });
      strategyId = draft.id;
      await prisma.executionIntent.update({
        where: { id: intentId },
        data: { strategyId, status: 'STRATEGY_MATCHED' }
      });
      await this.timeline(intentId, 'STRATEGY_MATCHED', `Draft strategy ${strategyId}`);
      await this.audit(userId, 'execution.strategy.matched', `draft ${strategyId}`, { intentId });
    } else {
      await prisma.executionIntent.update({
        where: { id: intentId },
        data: { status: 'STRATEGY_MATCHED' }
      });
      await this.timeline(intentId, 'STRATEGY_MATCHED', `Strategy ${strategyId}`);
    }

    // Algo selection
    const paperOrders = await prisma.order.count({
      where: { userId, isPaper: true, status: { in: ['FILLED', 'EXECUTED', 'COMPLETE', 'COMPLETED'] } }
    });
    const selection = recommendAlgos({
      riskProfile: 'moderate',
      capitalAmount: 100000,
      marketCondition: opts?.market_condition || 'sideways',
      instrumentType: intent.instrumentType,
      paperTradesCount: paperOrders,
      paperDays: Math.min(5, Math.ceil(paperOrders / 2)),
      hasStopLoss: intent.stopLoss != null && intent.stopLoss > 0,
      preferredAlgoId: intent.selectedAlgoId || undefined
    });

    const decision = await prisma.algoSelectionDecision.create({
      data: {
        intentId,
        userId,
        strategyId,
        selectedAlgoId: selection.top?.algo_id,
        recommendedAlgos: selection.recommended,
        rejectedAlgos: selection.blocked,
        marketCondition: opts?.market_condition || 'sideways',
        userRiskProfile: 'moderate',
        capitalFit: selection.top?.capital_fit,
        marketFit: selection.top?.market_condition_fit,
        riskFit: selection.top?.user_risk_fit,
        brokerFit: selection.top?.broker_capability_fit,
        paperTestFit: selection.top?.paper_test_score,
        liquidityFit: selection.top?.liquidity_fit,
        complexityRisk: selection.top?.complexity_penalty,
        drawdownRisk: selection.top?.drawdown_penalty,
        volatilityRisk: selection.top?.volatility_penalty,
        finalScore: selection.top?.total_score || 0,
        recommendationReason: selection.reason || '',
        decisionStatus: selection.top?.recommendation_status || 'RECOMMENDED'
      }
    });

    if (selection.top) {
      await prisma.strategySuitabilityScore.create({
        data: {
          intentId,
          userId,
          strategyId,
          algoId: selection.top.algo_id,
          totalScore: selection.top.total_score,
          userRiskFit: selection.top.user_risk_fit,
          capitalFit: selection.top.capital_fit,
          marketConditionFit: selection.top.market_condition_fit,
          assetFit: selection.top.asset_fit,
          brokerCapabilityFit: selection.top.broker_capability_fit,
          paperTestScore: selection.top.paper_test_score,
          liquidityFit: selection.top.liquidity_fit,
          volatilityPenalty: selection.top.volatility_penalty,
          drawdownPenalty: selection.top.drawdown_penalty,
          complexityPenalty: selection.top.complexity_penalty,
          allowedMode: selection.top.allowed_mode,
          recommendationStatus: selection.top.recommendation_status,
          explanation: selection.top.explanation
        }
      });
    }

    await prisma.executionIntent.update({
      where: { id: intentId },
      data: {
        status: 'SUITABILITY_SCORED',
        selectedAlgoId: selection.top?.algo_id,
        strategyId
      }
    });
    await this.timeline(intentId, 'SUITABILITY_SCORED', `score=${selection.score}`);
    await this.audit(userId, 'execution.algo.scored', JSON.stringify({ score: selection.score }), {
      intentId
    });

    // Paper-test gate for live
    const paperRequired = selection.paper_test_required || paperOrders < 5;
    if (intent.mode === 'LIVE' && paperRequired) {
      await prisma.executionIntent.update({
        where: { id: intentId },
        data: {
          status: 'PAPER_TEST_REQUIRED',
          blockReason: 'Paper test required before live',
          nextAction: 'Complete paper test (≥5 trades, 3 days, stop-loss)'
        }
      });
      await this.timeline(intentId, 'PAPER_TEST_REQUIRED', 'Live blocked until paper qualify');
      await this.audit(userId, 'execution.paper_test.required', 'paper qualify', { intentId });
      return this.buildDecisionResponse(userId, intentId, decision.id);
    }

    if (paperOrders >= 5) {
      await this.timeline(intentId, 'PAPER_TEST_PASSED', `paper trades=${paperOrders}`);
    }

    // Approval check
    if (intent.mode === 'LIVE') {
      const pre = await this.findMatchingPreapproval(userId, intentId);
      if (pre) {
        await prisma.executionIntent.update({
          where: { id: intentId },
          data: {
            status: 'PREAPPROVAL_MATCHED',
            preapprovalRuleId: pre.id,
            nextAction: 'SUBMIT_TO_RMS'
          }
        });
        await this.timeline(intentId, 'PREAPPROVAL_MATCHED', pre.id);
        await this.audit(userId, 'execution.preapproval.matched', pre.id, { intentId });
      } else {
        await prisma.executionIntent.update({
          where: { id: intentId },
          data: {
            status: 'USER_APPROVAL_REQUIRED',
            nextAction: 'REQUEST_APPROVAL'
          }
        });
        await this.timeline(intentId, 'USER_APPROVAL_REQUIRED', 'Live requires approval or preapproval');
        await this.audit(userId, 'execution.user_approval.required', intent.symbol, { intentId });
      }
    } else {
      // Paper: approval optional; proceed toward RMS
      await prisma.executionIntent.update({
        where: { id: intentId },
        data: { status: 'USER_APPROVED', nextAction: 'SUBMIT_TO_RMS' }
      });
      await this.timeline(intentId, 'USER_APPROVED', 'Paper mode — proceed to RMS');
    }

    return this.buildDecisionResponse(userId, intentId, decision.id);
  }

  static async findMatchingPreapproval(userId: string, intentId: string) {
    const intent = await this.getIntent(userId, intentId);
    const rules = await prisma.preApprovedExecutionRule.findMany({
      where: { userId, enabled: true, revokedAt: null }
    });
    const estimatedMaxLoss =
      intent.stopLoss != null && intent.price
        ? Math.abs(intent.price - intent.stopLoss) * intent.quantity
        : (intent.price || 1000) * intent.quantity * 0.02;

    for (const rule of rules) {
      const v = validatePreapprovalRule(rule, intent, { estimatedMaxLoss });
      if (v.ok) return rule;
    }
    return null;
  }

  static async requestApproval(
    userId: string,
    intentId: string,
    body?: { approval_type?: string; valid_hours?: number }
  ) {
    const intent = await this.getIntent(userId, intentId);
    const hours = body?.valid_hours || 8;
    const approval = await prisma.strategyApproval.create({
      data: {
        userId,
        strategyId: intent.strategyId,
        accountId: intent.accountId,
        mode: intent.mode,
        approvalType: body?.approval_type || 'MANUAL_SINGLE_TRADE',
        status: 'PENDING',
        approvedSymbols: [intent.symbol],
        maxQuantity: intent.quantity,
        maxOrderValue: (intent.price || 0) * intent.quantity,
        maxRiskPerTrade: 300,
        maxDailyLoss: 1000,
        maxTradesPerDay: 5,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + hours * 3600 * 1000),
        requiresStopLoss: true,
        intentId
      }
    });
    await prisma.executionIntent.update({
      where: { id: intentId },
      data: { status: 'USER_APPROVAL_REQUIRED', approvalId: approval.id, nextAction: 'USER_APPROVE' }
    });
    await this.timeline(intentId, 'USER_APPROVAL_REQUIRED', approval.id);
    return approval;
  }

  static async approveIntent(userId: string, intentId: string, approve: boolean) {
    const intent = await this.getIntent(userId, intentId);
    if (approve) {
      let approvalId = intent.approvalId;
      if (approvalId) {
        await prisma.strategyApproval.update({
          where: { id: approvalId },
          data: { status: 'APPROVED', approvedAt: new Date() }
        });
      } else {
        const a = await this.requestApproval(userId, intentId);
        approvalId = a.id;
        await prisma.strategyApproval.update({
          where: { id: approvalId },
          data: { status: 'APPROVED', approvedAt: new Date() }
        });
      }
      await prisma.executionIntent.update({
        where: { id: intentId },
        data: { status: 'USER_APPROVED', approvalId, nextAction: 'SUBMIT_TO_RMS' }
      });
      await this.timeline(intentId, 'USER_APPROVED', 'User approved');
      await this.audit(userId, 'execution.user_approved', intent.symbol, {
        intentId,
        actorType: 'USER',
        actorId: userId
      });
    } else {
      if (intent.approvalId) {
        await prisma.strategyApproval.update({
          where: { id: intent.approvalId },
          data: { status: 'REJECTED' }
        });
      }
      await prisma.executionIntent.update({
        where: { id: intentId },
        data: { status: 'USER_REJECTED', blockReason: 'User rejected', nextAction: 'NONE' }
      });
      await this.timeline(intentId, 'USER_REJECTED', 'User rejected');
      await this.audit(userId, 'execution.user_rejected', intent.symbol, { intentId, actorType: 'USER' });
    }
    return this.getIntent(userId, intentId);
  }

  static async submitToRms(userId: string, intentId: string, opts?: { is_exit?: boolean }) {
    const intent = await this.getIntent(userId, intentId);
    const controls = await RiskGateService.getLiveControlsSnapshot(userId);
    const rejectionReasons: string[] = [];
    const warnings: string[] = [];

    await this.timeline(intentId, 'RMS_PENDING', 'RMS evaluating');
    await this.audit(userId, 'execution.rms.requested', intent.symbol, { intentId });

    if (controls.killSwitch && !opts?.is_exit) {
      rejectionReasons.push('Kill switch active');
    }
    if (intent.mode === 'LIVE') {
      if (!liveEnvEnabled()) rejectionReasons.push('LIVE_TRADING_ENABLED is not true');
      if (!controls.liveTradingEnabled) rejectionReasons.push('TradingControl liveTradingEnabled=false');
      if (!intent.approvalId && !intent.preapprovalRuleId) {
        rejectionReasons.push('Live approval/preapproval missing');
      }
      if (intent.stopLoss == null) rejectionReasons.push('Stop-loss required for live');
      if (intent.preapprovalRuleId) {
        const rule = await prisma.preApprovedExecutionRule.findFirst({
          where: { id: intent.preapprovalRuleId, userId }
        });
        if (!rule) rejectionReasons.push('Preapproval rule not found');
        else {
          const v = validatePreapprovalRule(rule, intent);
          if (!v.ok) {
            rejectionReasons.push(...v.reasons);
            await this.audit(userId, 'execution.preapproval.failed', v.reasons.join('; '), {
              intentId
            });
          }
        }
      }
    }

    if (intent.instrumentType === 'INDEX') {
      rejectionReasons.push('Index spot cannot be directly traded');
    }

    // Options selling lock for beginners
    if (
      intent.instrumentType?.includes('OPTION') &&
      intent.side === 'SELL' &&
      intent.source !== 'USER_MANUAL'
    ) {
      warnings.push('Options selling restricted — verify capital/risk approval');
      try {
        const policy = await prisma.capitalRiskPolicy.findUnique({ where: { userId } });
        if (policy && (!policy.optionsSellingEnabled || policy.nakedOptionsBlocked)) {
          rejectionReasons.push('Options selling blocked by capital policy');
        }
      } catch {
        /* optional */
      }
    }

    // Guaranteed profit language blocked at strategy level (audit only)
    warnings.push('No strategy promises guaranteed profit');

    let status: 'APPROVED' | 'REJECTED' | 'PAPER_ONLY' | 'WARNING' = 'APPROVED';
    if (rejectionReasons.length) status = 'REJECTED';
    else if (intent.mode === 'PAPER') status = 'PAPER_ONLY';
    else if (warnings.length) status = 'WARNING';

    // PAPER_ONLY still means approved for paper OMS
    const rmsStatus = status === 'REJECTED' ? 'REJECTED' : status === 'PAPER_ONLY' ? 'PAPER_ONLY' : 'APPROVED';

    const estimatedMaxLoss =
      intent.stopLoss != null && intent.price
        ? Math.abs(Number(intent.price) - Number(intent.stopLoss)) * intent.quantity
        : (intent.price || 1000) * intent.quantity * 0.02;

    const rms = await prisma.rmsDecisionRecord.create({
      data: {
        intentId,
        userId,
        strategyId: intent.strategyId,
        accountId: intent.accountId,
        status: rmsStatus,
        rejectionReasons,
        warnings,
        estimatedMaxLoss,
        marginRequired: (intent.price || 1000) * intent.quantity,
        brokerCapabilityStatus: intent.mode === 'LIVE' ? 'LIVE_GATED' : 'PAPER_OK',
        marketDataStatus: 'FRESH',
        killSwitchStatus: controls.killSwitch ? 'ACTIVE' : 'OFF'
      }
    });

    await prisma.executionIntent.update({
      where: { id: intentId },
      data: {
        rmsDecisionId: rms.id,
        status: rmsStatus === 'REJECTED' ? 'RMS_REJECTED' : 'RMS_APPROVED',
        blockReason: rejectionReasons.join('; ') || null,
        nextAction: rmsStatus === 'REJECTED' ? 'FIX_OR_CANCEL' : 'SUBMIT_TO_OMS'
      }
    });

    if (rmsStatus === 'REJECTED') {
      await this.timeline(intentId, 'RMS_REJECTED', rejectionReasons.join('; '));
      await this.audit(userId, 'execution.rms.rejected', rejectionReasons.join('; '), { intentId });
    } else {
      await this.timeline(intentId, 'RMS_APPROVED', rmsStatus);
      await this.audit(userId, 'execution.rms.approved', rmsStatus, { intentId });
    }

    return { rms, intent: await this.getIntent(userId, intentId) };
  }

  static async submitToOms(userId: string, intentId: string, opts?: { is_exit?: boolean }) {
    const intent = await this.getIntent(userId, intentId);
    if (!intent.rmsDecisionId) throw new AppError('Submit to RMS first', 400);
    const rms = await prisma.rmsDecisionRecord.findUnique({ where: { id: intent.rmsDecisionId } });
    if (!rms || (rms.status !== 'APPROVED' && rms.status !== 'PAPER_ONLY' && rms.status !== 'WARNING')) {
      throw new AppError('RMS not approved', 403);
    }

    // Live still hard-blocked by default at OMS
    if (intent.mode === 'LIVE') {
      throw new AppError(
        'Live OMS submit locked by default — use paper or unlock via admin + preapproval + LIVE_TRADING_ENABLED',
        403
      );
    }

    const controls = await RiskGateService.getLiveControlsSnapshot(userId);
    const gate = evaluateOmsGatekeeper({
      callerService: 'OMS',
      mode: intent.mode,
      liveTradingEnabled: liveEnvEnabled() && controls.liveTradingEnabled,
      killSwitch: controls.killSwitch,
      rmsStatus: rms.status,
      rmsDecisionId: rms.id,
      approvalId: intent.approvalId,
      preapprovalRuleId: intent.preapprovalRuleId,
      idempotencyKey: intent.idempotencyKey,
      isExit: opts?.is_exit,
      allowExitDuringKillSwitch: true,
      marketDataFresh: true,
      brokerConnected: true,
      dailyLossBreached: false
    });

    await prisma.omsGatekeeperCheck.create({
      data: { intentId, passed: gate.passed, checks: { ...gate.checks, reasons: gate.reasons } }
    });

    if (!gate.passed) {
      await prisma.executionIntent.update({
        where: { id: intentId },
        data: { status: 'OMS_REJECTED', blockReason: gate.reasons.join('; ') }
      });
      await this.timeline(intentId, 'OMS_REJECTED', gate.reasons.join('; '));
      await this.audit(userId, 'execution.oms.rejected', gate.reasons.join('; '), { intentId });
      throw new AppError(`OMS gatekeeper rejected: ${gate.reasons.join('; ')}`, 403);
    }

    // Broker guardrail (paper OMS path)
    const brokerGate = evaluateBrokerGuardrail({
      callerService: 'OMS',
      mode: intent.mode,
      liveTradingEnabled: false,
      rmsDecisionId: rms.id,
      approvalId: intent.approvalId,
      preapprovalRuleId: intent.preapprovalRuleId,
      idempotencyKey: intent.idempotencyKey
    });
    await prisma.brokerGuardrailCheck.create({
      data: {
        intentId,
        callerService: 'OMS',
        passed: brokerGate.passed,
        reason: brokerGate.reason,
        checks: brokerGate.checks
      }
    });
    if (!brokerGate.passed) {
      await this.audit(userId, 'execution.broker.rejected', brokerGate.reason || 'blocked', { intentId });
      throw new AppError(brokerGate.reason || 'Broker guardrail blocked', 403);
    }

    await prisma.executionIntent.update({
      where: { id: intentId },
      data: { status: 'OMS_ACCEPTED' }
    });
    await this.timeline(intentId, 'OMS_ACCEPTED', 'OMS accepted');
    await this.audit(userId, 'execution.oms.accepted', intent.symbol, { intentId, actorType: 'OMS' });

    const order = await OrderExecutionService.placeOrder({
      userId,
      symbol: intent.symbol,
      exchange: intent.exchange,
      tradeType: intent.side as 'BUY' | 'SELL',
      quantity: intent.quantity,
      orderType: intent.orderType as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
      product: intent.productType as 'CNC' | 'MIS' | 'NRML',
      price: intent.price ?? undefined,
      triggerPrice: intent.triggerPrice ?? undefined,
      isPaper: true,
      source: 'MANUAL',
      idempotencyKey: `oms-${intent.idempotencyKey}`,
      callerService: 'OMS',
      governanceIntentId: intent.id,
      rmsDecisionId: rms.id,
      approvalId: intent.approvalId || undefined,
      preapprovalRuleId: intent.preapprovalRuleId || undefined,
      meta: { executionGovernance: true, intentId: intent.id }
    });

    await prisma.executionIntent.update({
      where: { id: intentId },
      data: {
        status: 'EXECUTED',
        omsOrderId: order.id,
        nextAction: 'NONE'
      }
    });
    await this.timeline(intentId, 'BROKER_SENT', 'Paper broker via OMS');
    await this.timeline(intentId, 'EXECUTED', `order=${order.id}`);
    await this.audit(userId, 'execution.broker.sent', order.id, { intentId, actorType: 'OMS' });
    await this.audit(userId, 'execution.completed', order.id, { intentId });

    return { order, intent: await this.getIntent(userId, intentId) };
  }

  /** Reject non-OMS broker calls (used by adapters / placeOrder live path) */
  static async assertBrokerCaller(input: {
    userId: string;
    callerService: string;
    mode: string;
    rmsDecisionId?: string;
    approvalId?: string;
    preapprovalRuleId?: string;
    idempotencyKey?: string;
    intentId?: string;
  }) {
    const gate = evaluateBrokerGuardrail({
      callerService: input.callerService,
      mode: input.mode,
      liveTradingEnabled: liveEnvEnabled(),
      rmsDecisionId: input.rmsDecisionId,
      approvalId: input.approvalId,
      preapprovalRuleId: input.preapprovalRuleId,
      idempotencyKey: input.idempotencyKey
    });
    await prisma.brokerGuardrailCheck.create({
      data: {
        intentId: input.intentId,
        callerService: input.callerService,
        passed: gate.passed,
        reason: gate.reason,
        checks: gate.checks
      }
    });
    if (!gate.passed) {
      await prisma.blockedExecutionAttempt.create({
        data: {
          userId: input.userId,
          source: input.callerService,
          reason: gate.reason || 'broker_direct_order_blocked',
          intentId: input.intentId
        }
      });
      await this.audit(input.userId, 'execution.broker.rejected', gate.reason || 'blocked', {
        intentId: input.intentId,
        eventStatus: 'BLOCKED'
      });
      throw new AppError(gate.reason || 'Broker adapter rejected non-OMS call', 403);
    }
  }

  static async buildDecisionResponse(userId: string, intentId: string, decisionId?: string) {
    const intent = await this.getIntent(userId, intentId);
    const auth = getSourceAuthority(intent.source as ExecutionSource);
    const decision = decisionId
      ? await prisma.algoSelectionDecision.findUnique({ where: { id: decisionId } })
      : await prisma.algoSelectionDecision.findFirst({
          where: { intentId },
          orderBy: { createdAt: 'desc' }
        });

    const base = {
      intent,
      source_authority: auth,
      can_execute_directly: false,
      decision_id: decision?.id,
      algo_selection: decision
        ? {
            decision: decision.decisionStatus,
            algo: (decision.recommendedAlgos as unknown[])?.[0],
            score: decision.finalScore,
            reason: decision.recommendationReason
          }
        : null
    };

    if (intent.source === 'AI_ADVISORY') {
      return {
        ...base,
        decision: 'RECOMMENDATION_ONLY',
        source: intent.source,
        next_action: 'User must select strategy and approve execution.'
      };
    }
    if (intent.source === 'TRADINGVIEW_ALERT') {
      return {
        ...base,
        decision: 'SIGNAL_ACCEPTED',
        source: intent.source,
        next_action: 'Validate strategy mapping and run RMS before OMS.'
      };
    }
    if (intent.source === 'DHANLAXMI_PROMPT') {
      return {
        ...base,
        decision: 'DRAFT_ONLY',
        source: intent.source,
        next_action: 'Create approval request — DhanLaxmi cannot execute.'
      };
    }
    if (intent.status === 'USER_APPROVAL_REQUIRED' || intent.status === 'BLOCKED') {
      return {
        ...base,
        decision: 'BLOCKED',
        reason:
          intent.blockReason ||
          'Live execution blocked because user approval is missing and live trading is disabled by default.',
        next_action: intent.nextAction || 'Run paper test or request user approval.'
      };
    }
    return {
      ...base,
      decision: 'RECOMMENDED',
      allowed_mode: intent.mode === 'LIVE' ? 'PAPER_OR_APPROVED_LIVE' : 'PAPER',
      approval_required: intent.mode === 'LIVE',
      paper_test_required: true,
      next_action: intent.nextAction
    };
  }

  static async getTimeline(userId: string, intentId: string) {
    await this.getIntent(userId, intentId);
    return prisma.executionTimelineEvent.findMany({
      where: { intentId },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async getAudit(userId: string, intentId: string) {
    await this.getIntent(userId, intentId);
    return prisma.executionAuditEvent.findMany({
      where: { intentId, userId },
      orderBy: { createdAt: 'asc' }
    });
  }

  // ─── Algo selection APIs ───
  static async recommend(userId: string, body: Record<string, unknown>) {
    const result = recommendAlgos({
      riskProfile: String(body.risk_profile || 'moderate'),
      capitalAmount: Number(body.capital_amount) || 100000,
      marketCondition: String(body.market_condition || 'sideways'),
      instrumentType: body.instrument_type ? String(body.instrument_type) : 'STOCK',
      paperTradesCount: Number(body.paper_trades) || 0,
      paperDays: Number(body.paper_days) || 0,
      hasStopLoss: body.has_stop_loss !== false,
      preferredAlgoId: body.preferred_algo_id ? String(body.preferred_algo_id) : undefined
    });
    await this.audit(userId, 'algo_recommendations_total', result.algo || '', {
      actorType: 'SYSTEM'
    });
    return {
      decision: 'RECOMMENDED',
      algo: result.algo,
      score: result.score,
      allowed_mode: result.allowed_mode,
      approval_required: true,
      paper_test_required: result.paper_test_required,
      reason: result.reason,
      recommended: result.recommended,
      watchlist: result.watchlist,
      locked: result.locked,
      blocked: result.blocked
    };
  }

  static async allowedAlgos(userId: string) {
    const r = await this.recommend(userId, {});
    return { allowed: r.recommended, watchlist: r.watchlist };
  }

  static async blockedAlgos(_userId: string) {
    return { blocked: [...BEGINNER_BLOCKED_ALGOS] };
  }

  // ─── Strategy approvals ───
  static async createStrategyApproval(userId: string, body: Record<string, unknown>) {
    return prisma.strategyApproval.create({
      data: {
        userId,
        strategyId: body.strategy_id ? String(body.strategy_id) : undefined,
        accountId: body.account_id ? String(body.account_id) : undefined,
        mode: body.mode === 'LIVE' ? 'LIVE' : 'PAPER',
        approvalType: String(body.approval_type || 'MANUAL_SINGLE_TRADE'),
        status: 'PENDING',
        approvedSymbols: body.approved_symbols || [],
        maxQuantity: body.max_quantity != null ? Number(body.max_quantity) : undefined,
        maxOrderValue: body.max_order_value != null ? Number(body.max_order_value) : undefined,
        maxRiskPerTrade: body.max_risk_per_trade != null ? Number(body.max_risk_per_trade) : 300,
        maxDailyLoss: body.max_daily_loss != null ? Number(body.max_daily_loss) : 1000,
        maxTradesPerDay: body.max_trades_per_day != null ? Number(body.max_trades_per_day) : 5,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 24 * 3600 * 1000),
        requiresStopLoss: body.requires_stop_loss !== false
      }
    });
  }

  static async listStrategyApprovals(userId: string) {
    return prisma.strategyApproval.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  static async decideStrategyApproval(userId: string, approvalId: string, approve: boolean) {
    const a = await prisma.strategyApproval.findFirst({ where: { id: approvalId, userId } });
    if (!a) throw new AppError('Approval not found', 404);
    return prisma.strategyApproval.update({
      where: { id: approvalId },
      data: {
        status: approve ? 'APPROVED' : 'REJECTED',
        approvedAt: approve ? new Date() : undefined
      }
    });
  }

  static async revokeStrategyApproval(userId: string, approvalId: string) {
    const a = await prisma.strategyApproval.findFirst({ where: { id: approvalId, userId } });
    if (!a) throw new AppError('Approval not found', 404);
    return prisma.strategyApproval.update({
      where: { id: approvalId },
      data: { status: 'REVOKED', revokedAt: new Date() }
    });
  }

  // ─── Preapproval rules ───
  static async createPreapprovalRule(userId: string, body: Record<string, unknown>) {
    const mode = body.mode === 'LIVE' ? 'LIVE' : 'PAPER';
    if (mode === 'LIVE') {
      // Allow creating live rules but they still need RMS + env gates at runtime
    }
    const validUntil = body.valid_until
      ? new Date(String(body.valid_until))
      : new Date(Date.now() + 7 * 24 * 3600 * 1000);
    return prisma.preApprovedExecutionRule.create({
      data: {
        userId,
        accountId: body.account_id ? String(body.account_id) : undefined,
        strategyId: body.strategy_id ? String(body.strategy_id) : undefined,
        algoId: body.algo_id ? String(body.algo_id) : undefined,
        brokerProviderId: body.broker_provider_id ? String(body.broker_provider_id) : undefined,
        allowedSymbols: body.allowed_symbols || [],
        allowedExchanges: body.allowed_exchanges || ['NSE'],
        allowedInstrumentTypes: body.allowed_instrument_types || ['STOCK'],
        allowedSides: body.allowed_sides || ['BUY', 'SELL'],
        maxQuantityPerOrder: Number(body.max_quantity_per_order) || 1,
        maxPositionValue: body.max_position_value != null ? Number(body.max_position_value) : undefined,
        maxOrderValue: body.max_order_value != null ? Number(body.max_order_value) : 50000,
        maxRiskPerTrade: body.max_risk_per_trade != null ? Number(body.max_risk_per_trade) : 300,
        maxDailyLoss: body.max_daily_loss != null ? Number(body.max_daily_loss) : 1000,
        maxTradesPerDay: body.max_trades_per_day != null ? Number(body.max_trades_per_day) : 5,
        allowedTimeWindowStart: body.allowed_time_window_start
          ? String(body.allowed_time_window_start)
          : '09:15',
        allowedTimeWindowEnd: body.allowed_time_window_end
          ? String(body.allowed_time_window_end)
          : '15:20',
        validFrom: body.valid_from ? new Date(String(body.valid_from)) : new Date(),
        validUntil,
        mode,
        enabled: body.enabled !== false,
        requiresStopLoss: body.requires_stop_loss !== false,
        allowAddQuantity: body.allow_add_quantity !== false,
        allowReduceQuantity: body.allow_reduce_quantity !== false,
        allowExit: body.allow_exit !== false,
        allowBasketOrders: !!body.allow_basket_orders,
        allowMultiAccount: !!body.allow_multi_account,
        createdBy: userId,
        approvedBy: userId
      }
    });
  }

  static async listPreapprovalRules(userId: string) {
    return prisma.preApprovedExecutionRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async updatePreapprovalRule(userId: string, ruleId: string, body: Record<string, unknown>) {
    const rule = await prisma.preApprovedExecutionRule.findFirst({ where: { id: ruleId, userId } });
    if (!rule) throw new AppError('Rule not found', 404);
    return prisma.preApprovedExecutionRule.update({
      where: { id: ruleId },
      data: {
        allowedSymbols: body.allowed_symbols as object | undefined,
        maxQuantityPerOrder:
          body.max_quantity_per_order != null ? Number(body.max_quantity_per_order) : undefined,
        maxRiskPerTrade: body.max_risk_per_trade != null ? Number(body.max_risk_per_trade) : undefined,
        enabled: body.enabled as boolean | undefined,
        requiresStopLoss: body.requires_stop_loss as boolean | undefined
      }
    });
  }

  static async setPreapprovalEnabled(userId: string, ruleId: string, enabled: boolean) {
    const rule = await prisma.preApprovedExecutionRule.findFirst({ where: { id: ruleId, userId } });
    if (!rule) throw new AppError('Rule not found', 404);
    return prisma.preApprovedExecutionRule.update({ where: { id: ruleId }, data: { enabled } });
  }

  static async revokePreapproval(userId: string, ruleId: string) {
    const rule = await prisma.preApprovedExecutionRule.findFirst({ where: { id: ruleId, userId } });
    if (!rule) throw new AppError('Rule not found', 404);
    return prisma.preApprovedExecutionRule.update({
      where: { id: ruleId },
      data: { enabled: false, revokedBy: userId, revokedAt: new Date() }
    });
  }

  static async validatePreapprovalForIntent(userId: string, ruleId: string, intentId: string) {
    const rule = await prisma.preApprovedExecutionRule.findFirst({ where: { id: ruleId, userId } });
    if (!rule) throw new AppError('Rule not found', 404);
    const intent = await this.getIntent(userId, intentId);
    return validatePreapprovalRule(rule, intent);
  }

  // ─── Control room ───
  static async controlRoomStatus(userId: string) {
    const controls = await RiskGateService.getLiveControlsSnapshot(userId);
    const [approvals, rules, blocked, intentsToday] = await Promise.all([
      prisma.strategyApproval.count({ where: { userId, status: 'APPROVED' } }),
      prisma.preApprovedExecutionRule.count({ where: { userId, enabled: true, revokedAt: null } }),
      prisma.blockedExecutionAttempt.count({
        where: { userId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      }),
      prisma.executionIntent.findMany({
        where: { userId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ]);
    const allowed = await this.allowedAlgos(userId);
    const blockedAlgos = await this.blockedAlgos(userId);
    return {
      mode: liveEnvEnabled() && controls.liveTradingEnabled ? 'LIVE_UNLOCKED' : 'PAPER',
      live_locked: !(liveEnvEnabled() && controls.liveTradingEnabled),
      kill_switch: controls.killSwitch,
      no_trade_mode: false,
      approval_state: controls.approvalState,
      active_approvals: approvals,
      active_preapproval_rules: rules,
      blocked_actions_today: blocked,
      allowed_algos: allowed.allowed,
      blocked_algos: blockedAlgos.blocked,
      intents_today: intentsToday,
      capital_defaults: {
        daily_target_min: 300,
        daily_target_max: 700,
        max_daily_loss: 1000,
        max_risk_per_trade: 300,
        max_trades_per_day: 5,
        paper_trading_enabled: true,
        live_trading_enabled: false
      }
    };
  }

  static async controlRoomToday(userId: string) {
    return prisma.executionIntent.findMany({
      where: { userId, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  static async blockedActions(userId: string) {
    return prisma.blockedExecutionAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  static async explainBlock(userId: string, intentId: string) {
    const intent = await this.getIntent(userId, intentId);
    const timeline = await this.getTimeline(userId, intentId);
    return {
      status: intent.status,
      reason: intent.blockReason || 'See timeline',
      next_action: intent.nextAction,
      source_cannot_execute: !sourceCanExecuteDirectly(intent.source as ExecutionSource),
      timeline
    };
  }

  static dhanlaxmiExplain(query: string, lang = 'en'): string {
    const q = query.toLowerCase();
    if (q.includes('blocked') || q.includes('kyun') || q.includes('why')) {
      return lang.startsWith('hi')
        ? 'Trade block hua kyunki AI/TradingView/DhanLaxmi execute nahi kar sakte. Approval + RMS + OMS chahiye. Live default off hai.'
        : 'Trade was blocked because AI/TradingView/DhanLaxmi cannot execute. Need approval → RMS → OMS. Live is off by default.';
    }
    if (q.includes('suitable') || q.includes('algo')) {
      return 'Recommended paper algos: RSI Mean Reversion, VWAP Intraday, MA Crossover. No guaranteed profit. Run paper test first.';
    }
    if (q.includes('paper')) {
      return 'Yes — paper mode is default. Create an execution intent with mode=PAPER, evaluate, submit to RMS, then OMS.';
    }
    if (q.includes('kill') || q.includes('stop all')) {
      return 'Use Execution Control Room kill switch / Risk Center. Kill switch blocks new entries.';
    }
    if (q.includes('preapproved') || q.includes('pre-approval')) {
      return 'Open Preapproved Rules in Execution Control Room. Rules are bounded by symbol, qty, risk, time, and expiry.';
    }
    if (q.includes('double') || q.includes('martingale')) {
      return 'Emotional doubling after loss is blocked (martingale). DhanLaxmi will not execute that command.';
    }
    return 'I can explain, draft, and request approval — I never execute. Only OMS executes after RMS.';
  }
}
