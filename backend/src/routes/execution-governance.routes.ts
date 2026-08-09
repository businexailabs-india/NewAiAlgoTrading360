import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { ExecutionGovernanceService } from '../services/execution-governance/execution-governance.service';
import type { CreateIntentInput } from '../services/execution-governance/execution-governance.service';
import { RiskGateService } from '../services/risk-gate.service';
import { prisma } from '../config/database';

const router = Router();

router.post(
  '/execution/intents',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.createIntent(
      req.user!.id,
      (req.body || {}) as CreateIntentInput
    );
    res.json({ success: true, data });
  })
);

router.get(
  '/execution/intents/:intent_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.getIntent(req.user!.id, req.params.intent_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/execution/intents/:intent_id/evaluate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.evaluate(req.user!.id, req.params.intent_id, req.body || {});
    res.json({ success: true, data });
  })
);

router.post(
  '/execution/intents/:intent_id/request-approval',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.requestApproval(
      req.user!.id,
      req.params.intent_id,
      req.body || {}
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/execution/intents/:intent_id/approve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.approveIntent(req.user!.id, req.params.intent_id, true);
    res.json({ success: true, data });
  })
);

router.post(
  '/execution/intents/:intent_id/reject',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.approveIntent(req.user!.id, req.params.intent_id, false);
    res.json({ success: true, data });
  })
);

router.post(
  '/execution/intents/:intent_id/submit-to-rms',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.submitToRms(req.user!.id, req.params.intent_id, req.body || {});
    res.json({ success: true, data });
  })
);

router.post(
  '/execution/intents/:intent_id/submit-to-oms',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.submitToOms(req.user!.id, req.params.intent_id, req.body || {});
    res.json({ success: true, data });
  })
);

router.get(
  '/execution/intents/:intent_id/timeline',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.getTimeline(req.user!.id, req.params.intent_id);
    res.json({ success: true, data });
  })
);

router.get(
  '/execution/intents/:intent_id/audit',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.getAudit(req.user!.id, req.params.intent_id);
    res.json({ success: true, data });
  })
);

router.get(
  '/execution/intents/:intent_id/explain-block',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.explainBlock(req.user!.id, req.params.intent_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/algo-selection/recommend',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.recommend(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.post(
  '/algo-selection/score',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.recommend(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.get(
  '/algo-selection/decisions/:decision_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await prisma.algoSelectionDecision.findFirst({
      where: { id: req.params.decision_id, userId: req.user!.id }
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/algo-selection/user/:user_id/allowed-algos',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const uid = req.user!.role === 'admin' ? req.params.user_id : req.user!.id;
    const data = await ExecutionGovernanceService.allowedAlgos(uid);
    res.json({ success: true, data });
  })
);

router.get(
  '/algo-selection/user/:user_id/blocked-algos',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const uid = req.user!.role === 'admin' ? req.params.user_id : req.user!.id;
    const data = await ExecutionGovernanceService.blockedAlgos(uid);
    res.json({ success: true, data });
  })
);

router.post(
  '/strategy-approvals',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.createStrategyApproval(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.get(
  '/strategy-approvals',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.listStrategyApprovals(req.user!.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/strategy-approvals/:approval_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await prisma.strategyApproval.findFirst({
      where: { id: req.params.approval_id, userId: req.user!.id }
    });
    res.json({ success: true, data });
  })
);

router.post(
  '/strategy-approvals/:approval_id/approve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.decideStrategyApproval(
      req.user!.id,
      req.params.approval_id,
      true
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/strategy-approvals/:approval_id/reject',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.decideStrategyApproval(
      req.user!.id,
      req.params.approval_id,
      false
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/strategy-approvals/:approval_id/revoke',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.revokeStrategyApproval(
      req.user!.id,
      req.params.approval_id
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/preapproval-rules',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.createPreapprovalRule(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.get(
  '/preapproval-rules',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.listPreapprovalRules(req.user!.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/preapproval-rules/:rule_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await prisma.preApprovedExecutionRule.findFirst({
      where: { id: req.params.rule_id, userId: req.user!.id }
    });
    res.json({ success: true, data });
  })
);

router.put(
  '/preapproval-rules/:rule_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.updatePreapprovalRule(
      req.user!.id,
      req.params.rule_id,
      req.body || {}
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/preapproval-rules/:rule_id/enable',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.setPreapprovalEnabled(
      req.user!.id,
      req.params.rule_id,
      true
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/preapproval-rules/:rule_id/disable',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.setPreapprovalEnabled(
      req.user!.id,
      req.params.rule_id,
      false
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/preapproval-rules/:rule_id/revoke',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.revokePreapproval(req.user!.id, req.params.rule_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/preapproval-rules/:rule_id/validate-intent',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const intentId = String(req.body?.intent_id || '');
    const data = await ExecutionGovernanceService.validatePreapprovalForIntent(
      req.user!.id,
      req.params.rule_id,
      intentId
    );
    res.json({ success: true, data });
  })
);

router.get(
  '/execution-control-room/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.controlRoomStatus(req.user!.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/execution-control-room/today',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.controlRoomToday(req.user!.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/execution-control-room/blocked-actions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await ExecutionGovernanceService.blockedActions(req.user!.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/execution-control-room/kill-switch',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await RiskGateService.ensureGlobalControl();
    const active = req.body?.active !== false;
    const existing = await prisma.tradingControl.findFirst({
      where: { scope: 'USER', userId: req.user!.id }
    });
    if (existing) {
      await prisma.tradingControl.update({ where: { id: existing.id }, data: { killSwitch: active } });
    } else {
      await prisma.tradingControl.create({
        data: { scope: 'USER', userId: req.user!.id, killSwitch: active, liveTradingEnabled: false }
      });
    }
    await ExecutionGovernanceService.audit(
      req.user!.id,
      active ? 'kill_switch_blocks_total' : 'kill_switch_cleared',
      `kill_switch=${active}`,
      { actorType: 'USER', actorId: req.user!.id }
    );
    res.json({ success: true, data: { kill_switch: active } });
  })
);

router.post(
  '/execution-control-room/no-trade-mode',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await prisma.capitalRiskPolicy.update({
        where: { userId: req.user!.id },
        data: { noTradeMode: req.body?.enabled !== false }
      });
    } catch {
      /* policy may not exist */
    }
    res.json({ success: true, data: { no_trade_mode: req.body?.enabled !== false } });
  })
);

export default router;
