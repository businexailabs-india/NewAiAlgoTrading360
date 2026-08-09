export interface OmsGateInput {
  callerService: string;
  mode: string;
  liveTradingEnabled: boolean;
  killSwitch: boolean;
  rmsStatus?: string | null;
  rmsDecisionId?: string | null;
  approvalId?: string | null;
  preapprovalRuleId?: string | null;
  idempotencyKey?: string | null;
  isExit?: boolean;
  allowExitDuringKillSwitch?: boolean;
  marketDataFresh?: boolean;
  brokerConnected?: boolean;
  dailyLossBreached?: boolean;
}

export function evaluateOmsGatekeeper(input: OmsGateInput): {
  passed: boolean;
  checks: Record<string, boolean | string>;
  reasons: string[];
} {
  const checks: Record<string, boolean | string> = {};
  const reasons: string[] = [];

  checks.caller_is_oms = input.callerService === 'OMS';
  if (!checks.caller_is_oms) reasons.push('Broker/OMS path requires caller_service=OMS');

  checks.idempotency_present = !!input.idempotencyKey;
  if (!checks.idempotency_present) reasons.push('idempotency_key required');

  checks.rms_approved = input.rmsStatus === 'APPROVED' || input.rmsStatus === 'PAPER_ONLY';
  if (!checks.rms_approved) reasons.push('RMS approval missing');

  checks.rms_decision_id = !!input.rmsDecisionId;
  if (!checks.rms_decision_id) reasons.push('rms_decision_id required');

  if (input.mode === 'LIVE') {
    checks.live_enabled = input.liveTradingEnabled;
    if (!checks.live_enabled) reasons.push('Live trading disabled');
    checks.live_approval =
      !!input.approvalId || !!input.preapprovalRuleId;
    if (!checks.live_approval) reasons.push('Live requires approval_id or preapproval_rule_id');
  } else {
    checks.live_enabled = true;
    checks.live_approval = true;
  }

  checks.kill_switch_off = !input.killSwitch;
  if (input.killSwitch) {
    if (input.isExit && input.allowExitDuringKillSwitch) {
      checks.kill_switch_off = true;
      checks.exit_allowed_under_kill_switch = true;
    } else {
      reasons.push('Kill switch active');
    }
  }

  checks.daily_loss_ok = !input.dailyLossBreached;
  if (input.dailyLossBreached) reasons.push('Daily loss limit breached');

  if (input.isExit) {
    checks.market_data_fresh = true;
  } else {
    checks.market_data_fresh = input.marketDataFresh !== false;
    if (!checks.market_data_fresh) reasons.push('Stale market data blocks new entries');
  }

  checks.broker_connected = input.brokerConnected !== false || input.mode === 'PAPER';
  if (!checks.broker_connected) reasons.push('Broker disconnected');

  return { passed: reasons.length === 0, checks, reasons };
}

export function evaluateBrokerGuardrail(input: {
  callerService: string;
  mode: string;
  liveTradingEnabled: boolean;
  rmsDecisionId?: string | null;
  approvalId?: string | null;
  preapprovalRuleId?: string | null;
  idempotencyKey?: string | null;
}): { passed: boolean; reason?: string; checks: Record<string, boolean> } {
  const checks = {
    caller_is_oms: input.callerService === 'OMS',
    rms_present: !!input.rmsDecisionId,
    idempotency_present: !!input.idempotencyKey,
    live_ok:
      input.mode !== 'LIVE' ||
      (input.liveTradingEnabled && (!!input.approvalId || !!input.preapprovalRuleId))
  };
  if (!checks.caller_is_oms) {
    return { passed: false, reason: 'broker_direct_order_blocked: non-OMS caller', checks };
  }
  if (!checks.rms_present) {
    return { passed: false, reason: 'broker_direct_order_blocked: missing RMS decision', checks };
  }
  if (!checks.idempotency_present) {
    return { passed: false, reason: 'broker_direct_order_blocked: missing idempotency', checks };
  }
  if (!checks.live_ok) {
    return { passed: false, reason: 'broker_direct_order_blocked: live policy', checks };
  }
  return { passed: true, checks };
}
