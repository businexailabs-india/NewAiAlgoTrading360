import { tradingService } from '@/services/tradingService';

export type MarketplaceSourceKind = 'classic' | 'agent' | 'advisory' | 'preset';

export type MarketplaceStrategy = {
  id: number;
  name: string;
  description?: string;
  category: string;
  code?: string;
  codeSnippet?: string;
  sourceKind?: MarketplaceSourceKind;
  agentId?: string;
  /** Agent runtime config when deploying classics / clones */
  deployConfig?: Record<string, unknown>;
  /** Rule-strategy rules when cloning presets */
  rules?: Array<Record<string, unknown>>;
  symbols?: string[];
};

export type MarketplaceActionResult = {
  ok: boolean;
  message: string;
  agentId?: string;
  strategyId?: string;
  run?: unknown;
};

function defaultSymbols(s: MarketplaceStrategy): string[] {
  if (s.symbols?.length) return s.symbols;
  const cfg = s.deployConfig;
  if (cfg && Array.isArray(cfg.symbols) && cfg.symbols.length) {
    return cfg.symbols.map(String);
  }
  return ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Deploy = create (if needed) + run paper agent / evaluate rule strategy. */
export async function deployMarketplaceStrategy(
  strategy: MarketplaceStrategy
): Promise<MarketplaceActionResult> {
  // Existing workspace agent → run now
  if (strategy.sourceKind === 'agent' && strategy.agentId) {
    const run = await tradingService.runAgent(strategy.agentId);
    const placed = Array.isArray((run as { ordersPlaced?: unknown }).ordersPlaced)
      ? ((run as { ordersPlaced: unknown[] }).ordersPlaced.length)
      : Number((run as { ordersPlaced?: number })?.ordersPlaced ?? 0);
    return {
      ok: true,
      message: `Agent ran · ${placed} order(s) placed (paper/live per mode)`,
      agentId: strategy.agentId,
      run
    };
  }

  // Rule preset / rules payload → create + evaluate
  if (strategy.rules?.length || strategy.sourceKind === 'preset') {
    const created = await tradingService.createStrategy({
      name: strategy.name,
      description: strategy.description || `Deployed from marketplace`,
      category: strategy.category,
      symbols: defaultSymbols(strategy),
      rules: strategy.rules?.length
        ? strategy.rules
        : [{ indicator: 'rsi', op: '<', value: 30, action: 'BUY' }]
    });
    let evalMsg = '';
    try {
      const ev = await tradingService.evaluateStrategy(created.id);
      evalMsg = ` · evaluate: ${JSON.stringify(ev).slice(0, 120)}`;
    } catch {
      evalMsg = ' · created (evaluate skipped)';
    }
    return {
      ok: true,
      message: `Rule strategy saved${evalMsg}. Open My Rule Strategies to backtest.`,
      strategyId: created.id
    };
  }

  // Options classic → guidance only (no silent fake deploy)
  if (/option/i.test(strategy.category) || /option/i.test(strategy.name)) {
    return {
      ok: true,
      message:
        'Options strategies deploy from Markets → Paper Options Terminal (Seed ATM → Place Paper).'
    };
  }

  // Advisory / classic momentum → create paper agent + run
  const cfg = {
    symbols: defaultSymbols(strategy),
    minConfidence: 55,
    maxOrdersPerRun: 3,
    defaultQuantity: 1,
    useScreener: true,
    screenerTopN: 8,
    product: 'CNC',
    ...(strategy.deployConfig || {})
  };

  const agent = await tradingService.createAgent({
    name: strategy.name,
    description: strategy.description || 'Deployed from Strategy Marketplace',
    mode: 'paper',
    config: cfg
  });

  await tradingService.updateAgent(agent.id, { isActive: true });
  const run = await tradingService.runAgent(agent.id);
  const placed = Array.isArray((run as { ordersPlaced?: unknown }).ordersPlaced)
    ? ((run as { ordersPlaced: unknown[] }).ordersPlaced.length)
    : Number((run as { ordersPlaced?: number })?.ordersPlaced ?? 0);

  return {
    ok: true,
    message: `Paper agent created & ran · ${placed} order(s). Configure in Algos.`,
    agentId: agent.id,
    run
  };
}

/** Clone = save to workspace without requiring a run. */
export async function cloneMarketplaceStrategy(
  strategy: MarketplaceStrategy
): Promise<MarketplaceActionResult> {
  if (strategy.rules?.length || strategy.sourceKind === 'preset') {
    const created = await tradingService.createStrategy({
      name: `${strategy.name} (clone)`,
      description: strategy.description || 'Cloned from marketplace',
      category: strategy.category,
      symbols: defaultSymbols(strategy),
      rules: strategy.rules?.length
        ? strategy.rules
        : [{ indicator: 'rsi', op: '<', value: 30, action: 'BUY' }]
    });
    return {
      ok: true,
      message: 'Cloned to My Rule Strategies.',
      strategyId: created.id
    };
  }

  if (/option/i.test(strategy.category)) {
    const copied = await copyText(strategy.codeSnippet || strategy.code || strategy.name);
    return {
      ok: true,
      message: copied
        ? 'Options template copied. Paste into Paper Options / Strategy Builder.'
        : 'Open Markets → Paper Options Terminal to build this structure.'
    };
  }

  const cfg = {
    symbols: defaultSymbols(strategy),
    minConfidence: 55,
    maxOrdersPerRun: 3,
    defaultQuantity: 1,
    useScreener: true,
    screenerTopN: 8,
    product: 'CNC',
    ...(strategy.deployConfig || {})
  };

  const agent = await tradingService.createAgent({
    name: `${strategy.name} (clone)`,
    description: strategy.description || 'Cloned from marketplace',
    mode: 'paper',
    config: cfg
  });

  return {
    ok: true,
    message: 'Cloned as paper agent (paused). Activate & Deploy from Algos.',
    agentId: agent.id
  };
}

export async function exportMarketplaceStrategy(
  strategy: MarketplaceStrategy
): Promise<MarketplaceActionResult> {
  const text = strategy.codeSnippet || strategy.code || JSON.stringify(strategy, null, 2);
  const copied = await copyText(text);
  return {
    ok: copied,
    message: copied ? 'Script copied to clipboard.' : 'Could not copy — select Code tab and copy manually.'
  };
}
