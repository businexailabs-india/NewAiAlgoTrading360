export type TradePermission =
  | 'trade_stock'
  | 'trade_index_derivatives'
  | 'trade_options'
  | 'create_basket_order'
  | 'submit_basket_order'
  | 'chart_quick_trade'
  | 'chart_exit_position'
  | 'live_trade'
  | 'paper_trade'
  | 'approve_order';

export type TradeRole =
  | 'Beginner'
  | 'Trader'
  | 'Advanced Trader'
  | 'Institutional Trader'
  | 'Risk Manager'
  | 'Admin';

const ROLE_PERMS: Record<TradeRole, TradePermission[]> = {
  Beginner: [
    'paper_trade',
    'trade_stock',
    'trade_index_derivatives',
    'trade_options',
    'chart_quick_trade',
    'chart_exit_position',
    'create_basket_order'
  ],
  Trader: [
    'paper_trade',
    'trade_stock',
    'trade_index_derivatives',
    'trade_options',
    'chart_quick_trade',
    'chart_exit_position',
    'create_basket_order',
    'submit_basket_order',
    'approve_order'
  ],
  'Advanced Trader': [
    'paper_trade',
    'trade_stock',
    'trade_index_derivatives',
    'trade_options',
    'chart_quick_trade',
    'chart_exit_position',
    'create_basket_order',
    'submit_basket_order',
    'approve_order',
    'live_trade'
  ],
  'Institutional Trader': [
    'paper_trade',
    'live_trade',
    'trade_stock',
    'trade_index_derivatives',
    'trade_options',
    'create_basket_order',
    'submit_basket_order',
    'chart_quick_trade',
    'chart_exit_position',
    'approve_order'
  ],
  'Risk Manager': ['paper_trade', 'approve_order', 'create_basket_order'],
  Admin: [
    'paper_trade',
    'live_trade',
    'trade_stock',
    'trade_index_derivatives',
    'trade_options',
    'create_basket_order',
    'submit_basket_order',
    'chart_quick_trade',
    'chart_exit_position',
    'approve_order'
  ]
};

export function roleFromUserRole(role?: string | null): TradeRole {
  if (role === 'admin') return 'Admin';
  return 'Trader';
}

export function permissionForInstrumentType(instrumentType: string): TradePermission {
  const t = (instrumentType || '').toUpperCase();
  if (t.includes('OPTION')) return 'trade_options';
  if (t.includes('FUTURE') || t === 'INDEX') return 'trade_index_derivatives';
  return 'trade_stock';
}

export function hasPermission(role: TradeRole, perm: TradePermission): boolean {
  return ROLE_PERMS[role].includes(perm);
}

export function permissionsForRole(role: TradeRole): TradePermission[] {
  return [...ROLE_PERMS[role]];
}
