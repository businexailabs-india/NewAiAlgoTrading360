export type ExecutionSource =
  | 'AI_ADVISORY'
  | 'TRADINGVIEW_ALERT'
  | 'DHANLAXMI_PROMPT'
  | 'USER_MANUAL'
  | 'ALGO_SCHEDULER'
  | 'STRATEGY_ENGINE'
  | 'BASKET_ORDER'
  | 'CHART_ACTION'
  | 'API_EXTERNAL'
  | 'OMS';

export type ExecutionMode = 'PAPER' | 'LIVE' | 'BACKTEST' | 'SIMULATION';

export type ExecutionAuthority =
  | 'RECOMMEND_ONLY'
  | 'SIGNAL_ONLY'
  | 'DRAFT_ONLY'
  | 'APPROVAL_REQUIRED'
  | 'PREAPPROVED_ALLOWED'
  | 'OMS_EXECUTE_ONLY';

export const SOURCE_AUTHORITY: Record<
  ExecutionSource,
  { authority: ExecutionAuthority; can_execute: boolean; description: string }
> = {
  AI_ADVISORY: {
    authority: 'RECOMMEND_ONLY',
    can_execute: false,
    description: 'AI can recommend but cannot execute'
  },
  TRADINGVIEW_ALERT: {
    authority: 'SIGNAL_ONLY',
    can_execute: false,
    description: 'TradingView can signal but cannot execute'
  },
  DHANLAXMI_PROMPT: {
    authority: 'DRAFT_ONLY',
    can_execute: false,
    description: 'DhanLaxmi can draft/explain/request approval but cannot execute'
  },
  USER_MANUAL: {
    authority: 'APPROVAL_REQUIRED',
    can_execute: false,
    description: 'Manual orders require approval path before OMS'
  },
  ALGO_SCHEDULER: {
    authority: 'PREAPPROVED_ALLOWED',
    can_execute: false,
    description: 'Scheduler runs only with valid preapproval'
  },
  STRATEGY_ENGINE: {
    authority: 'PREAPPROVED_ALLOWED',
    can_execute: false,
    description: 'Strategy engine cannot execute without preapproval'
  },
  BASKET_ORDER: {
    authority: 'APPROVAL_REQUIRED',
    can_execute: false,
    description: 'Basket requires approval before OMS'
  },
  CHART_ACTION: {
    authority: 'APPROVAL_REQUIRED',
    can_execute: false,
    description: 'Chart actions require preview/approval before OMS'
  },
  API_EXTERNAL: {
    authority: 'APPROVAL_REQUIRED',
    can_execute: false,
    description: 'External API cannot execute directly'
  },
  OMS: {
    authority: 'OMS_EXECUTE_ONLY',
    can_execute: true,
    description: 'Only OMS may call broker adapters'
  }
};

export function getSourceAuthority(source: ExecutionSource) {
  return SOURCE_AUTHORITY[source] || SOURCE_AUTHORITY.API_EXTERNAL;
}

export function sourceCanExecuteDirectly(source: ExecutionSource): boolean {
  return getSourceAuthority(source).can_execute === true && source === 'OMS';
}
