/** Canonical Dhan MCP tool capability registry (user-dhan style). */

export type DhanCapability =
  | 'auth.login'
  | 'auth.complete_login'
  | 'search.symbol'
  | 'market.ltp'
  | 'market.ohlc'
  | 'market.quote'
  | 'market.optionchain'
  | 'market.expirylist'
  | 'historical.intraday'
  | 'historical.daily'
  | 'portfolio.holdings'
  | 'portfolio.positions'
  | 'portfolio.funds'
  | 'portfolio.trades'
  | 'orderbook.list'
  | 'orderbook.get'
  | 'orderbook.super_list'
  | 'tradebook.list'
  | 'tradebook.by_order'
  | 'margin.single'
  | 'margin.multi'
  | 'trading.place'
  | 'trading.modify'
  | 'trading.cancel'
  | 'trading.super_place'
  | 'trading.super_modify'
  | 'trading.super_cancel'
  | 'alerts.create'
  | 'alerts.modify'
  | 'alerts.list'
  | 'alerts.delete';

export interface CapabilityDefinition {
  capability: DhanCapability;
  tool: string;
  action: string;
  category: 'auth' | 'market' | 'historical' | 'portfolio' | 'orders' | 'margin' | 'trading' | 'alerts' | 'search';
  liveRequired?: boolean;
  description: string;
}

export const DHAN_CAPABILITY_REGISTRY: CapabilityDefinition[] = [
  { capability: 'auth.login', tool: 'login', action: 'login', category: 'auth', description: 'Start MCP consent login' },
  { capability: 'auth.complete_login', tool: 'complete_login', action: 'complete', category: 'auth', description: 'Complete MCP login with tokenId' },
  { capability: 'search.symbol', tool: 'search_agent_tool', action: 'search', category: 'search', description: 'Resolve symbol to securityId' },
  { capability: 'market.ltp', tool: 'market_data_agent_tool', action: 'ltp', category: 'market', description: 'Last traded price' },
  { capability: 'market.ohlc', tool: 'market_data_agent_tool', action: 'ohlc', category: 'market', description: 'OHLC quote' },
  { capability: 'market.quote', tool: 'market_data_agent_tool', action: 'quote', category: 'market', description: 'Full market quote' },
  { capability: 'market.optionchain', tool: 'market_data_agent_tool', action: 'optionchain', category: 'market', description: 'Option chain' },
  { capability: 'market.expirylist', tool: 'market_data_agent_tool', action: 'expirylist', category: 'market', description: 'Option expiry list' },
  { capability: 'historical.intraday', tool: 'historical_data_agent_tool', action: 'intraday', category: 'historical', description: 'Intraday candles' },
  { capability: 'historical.daily', tool: 'historical_data_agent_tool', action: 'historical', category: 'historical', description: 'Daily candles' },
  { capability: 'portfolio.holdings', tool: 'portfolio_agent_tool', action: 'holdings', category: 'portfolio', description: 'Demat holdings' },
  { capability: 'portfolio.positions', tool: 'portfolio_agent_tool', action: 'positions', category: 'portfolio', description: 'Open positions' },
  { capability: 'portfolio.funds', tool: 'portfolio_agent_tool', action: 'funds', category: 'portfolio', description: 'Funds / margin limits' },
  { capability: 'portfolio.trades', tool: 'portfolio_agent_tool', action: 'trades', category: 'portfolio', description: 'Today trades' },
  { capability: 'orderbook.list', tool: 'orderbook_agent_tool', action: 'list', category: 'orders', description: 'Today order book' },
  { capability: 'orderbook.get', tool: 'orderbook_agent_tool', action: 'get', category: 'orders', description: 'Order by id' },
  { capability: 'orderbook.super_list', tool: 'orderbook_agent_tool', action: 'super_list', category: 'orders', description: 'Super order book' },
  { capability: 'tradebook.list', tool: 'tradebook_agent_tool', action: 'list', category: 'orders', description: 'Today trade book' },
  { capability: 'tradebook.by_order', tool: 'tradebook_agent_tool', action: 'by_order', category: 'orders', description: 'Trades by order id' },
  { capability: 'margin.single', tool: 'margin_agent_tool', action: 'single', category: 'margin', description: 'Single order margin' },
  { capability: 'margin.multi', tool: 'margin_agent_tool', action: 'multi', category: 'margin', description: 'Basket margin' },
  { capability: 'trading.place', tool: 'trading_agent_tool', action: 'place', category: 'trading', liveRequired: true, description: 'Place order' },
  { capability: 'trading.modify', tool: 'trading_agent_tool', action: 'modify', category: 'trading', liveRequired: true, description: 'Modify order' },
  { capability: 'trading.cancel', tool: 'trading_agent_tool', action: 'cancel', category: 'trading', liveRequired: true, description: 'Cancel order' },
  { capability: 'trading.super_place', tool: 'trading_agent_tool', action: 'super_place', category: 'trading', liveRequired: true, description: 'Place super order' },
  { capability: 'trading.super_modify', tool: 'trading_agent_tool', action: 'super_modify', category: 'trading', liveRequired: true, description: 'Modify super order' },
  { capability: 'trading.super_cancel', tool: 'trading_agent_tool', action: 'super_cancel', category: 'trading', liveRequired: true, description: 'Cancel super order' },
  { capability: 'alerts.create', tool: 'alerts_agent_tool', action: 'create', category: 'alerts', description: 'Create alert' },
  { capability: 'alerts.modify', tool: 'alerts_agent_tool', action: 'modify', category: 'alerts', description: 'Modify alert' },
  { capability: 'alerts.list', tool: 'alerts_agent_tool', action: 'list', category: 'alerts', description: 'List alerts' },
  { capability: 'alerts.delete', tool: 'alerts_agent_tool', action: 'delete', category: 'alerts', description: 'Delete alert' }
];

export function capabilityMatrixFromTools(toolNames: string[]): Record<DhanCapability, boolean> {
  const set = new Set(toolNames.map(t => t.toLowerCase()));
  const matrix = {} as Record<DhanCapability, boolean>;
  for (const def of DHAN_CAPABILITY_REGISTRY) {
    matrix[def.capability] = set.has(def.tool.toLowerCase());
  }
  return matrix;
}

export function getCapabilityDef(capability: DhanCapability): CapabilityDefinition {
  const def = DHAN_CAPABILITY_REGISTRY.find(d => d.capability === capability);
  if (!def) throw new Error(`Unknown capability: ${capability}`);
  return def;
}
