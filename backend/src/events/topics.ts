export const KafkaTopics = {
  USER_LOGIN_SUCCESS: 'user.login.success',
  ADVISORY_GENERATION_REQUESTED: 'advisory.generation.requested',
  ADVISORY_GENERATED: 'advisory.generated',
  ADVISORY_FAILED: 'advisory.failed',
  STRATEGY_OPTION_SELECTED: 'strategy.option.selected',
  STRATEGY_GENERATED_FROM_ADVISORY: 'strategy.generated.from.advisory',
  STRATEGY_PAPER_TEST_REQUESTED: 'strategy.paper_test.requested',
  STRATEGY_PAPER_TEST_COMPLETED: 'strategy.paper_test.completed',
  STRATEGY_SAVED: 'strategy.saved',
  STRATEGY_LIVE_DEPLOYMENT_REQUESTED: 'strategy.live_deployment.requested',
  USER_APPROVAL_CREATED: 'user.approval.created',
  COMPLIANCE_AUDIT_CREATED: 'compliance.audit.created'
} as const;
