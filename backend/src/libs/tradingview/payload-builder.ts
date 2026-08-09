export type PayloadKind = 'BUY' | 'SELL' | 'EXIT' | 'STOP_LOSS' | 'OPTIONS' | 'MULTI_ACCOUNT' | 'STANDARD';

export function buildPayloadTemplate(kind: PayloadKind, secretPlaceholder = 'USER_WEBHOOK_SECRET') {
  const base = {
    secret: secretPlaceholder,
    strategy_id: 'strat_tv_1',
    symbol: '{{ticker}}',
    exchange: '{{exchange}}',
    timeframe: '{{interval}}',
    price: '{{close}}',
    quantity: 1,
    timestamp: '{{time}}'
  };

  switch (kind) {
    case 'BUY':
      return { ...base, side: 'BUY', signal_type: 'VWAP_BREAKOUT', stop_loss: 0, target: 0 };
    case 'SELL':
      return { ...base, side: 'SELL', signal_type: 'VWAP_BREAKDOWN', stop_loss: 0, target: 0 };
    case 'EXIT':
      return { ...base, side: 'EXIT', signal_type: 'EXIT_POSITION', quantity: 0 };
    case 'STOP_LOSS':
      return { ...base, side: 'SELL', signal_type: 'STOP_LOSS', stop_loss: '{{close}}' };
    case 'OPTIONS':
      return {
        ...base,
        side: 'BUY',
        signal_type: 'LONG_CALL',
        asset_class: 'OPTION',
        quantity: 1,
        stop_loss: 0,
        target: 0
      };
    case 'MULTI_ACCOUNT':
      return {
        ...base,
        side: 'BUY',
        signal_type: 'MULTI_ACCOUNT',
        accounts: [
          { label: 'paper-main', allocation_pct: 60 },
          { label: 'paper-sat', allocation_pct: 40 }
        ]
      };
    default:
      return {
        secret: secretPlaceholder,
        symbol: '{{ticker}}',
        side: 'BUY',
        signal_type: 'TV_ALERT',
        price: '{{close}}',
        timestamp: '{{time}}'
      };
  }
}

export function systemPayloadTemplates() {
  const kinds: PayloadKind[] = ['BUY', 'SELL', 'EXIT', 'STOP_LOSS', 'OPTIONS', 'MULTI_ACCOUNT', 'STANDARD'];
  return kinds.map((kind) => ({
    name: `TradingView ${kind}`,
    kind,
    templateJson: buildPayloadTemplate(kind),
    isSystem: true
  }));
}

export function defaultPaperRiskRules(capital = 100000) {
  return {
    stop_loss_percent: 1,
    target_percent: 1.5,
    max_daily_loss: Math.min(1000, capital * 0.01),
    max_trades_per_day: 5,
    cooldown_after_loss: 1,
    paper_only: true
  };
}
