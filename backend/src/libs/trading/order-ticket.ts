export type OrderMode = 'PAPER' | 'LIVE';
export type OrderSource = 'CHART' | 'ORDER_TICKET' | 'BASKET';

export interface OrderPreviewRequest {
  tenant_id?: string;
  user_id?: string;
  account_id?: string;
  broker_provider_id?: string;
  instrument_id?: string;
  symbol: string;
  exchange?: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  order_type?: string;
  product_type?: string;
  price?: number;
  trigger_price?: number;
  stop_loss?: number;
  target?: number;
  mode?: OrderMode;
  source?: OrderSource;
  idempotency_key?: string;
}

export interface ChartOrderActionRequest {
  instrument_id?: string;
  account_id?: string;
  position_id?: string;
  symbol?: string;
  exchange?: string;
  action: 'BUY' | 'SELL' | 'ADD_QTY' | 'REDUCE_QTY' | 'EXIT_QTY' | 'EXIT_FULL';
  quantity?: number;
  order_type?: string;
  price?: number;
  trigger_price?: number;
  mode?: OrderMode;
  source?: 'CHART';
  confirmation_token?: string;
  idempotency_key?: string;
}

export function oppositeSide(side: 'BUY' | 'SELL'): 'BUY' | 'SELL' {
  return side === 'BUY' ? 'SELL' : 'BUY';
}

export function estimateCharges(notional: number): number {
  // Simplified India equity charges placeholder (brokerage + taxes ballpark)
  return Math.max(5, Math.round(notional * 0.0005 * 100) / 100);
}

export function estimateMargin(notional: number, productType: string, instrumentType: string): number {
  if (instrumentType.includes('OPTION')) return notional;
  if (instrumentType.includes('FUTURE') || productType === 'MIS' || productType === 'NRML') {
    return Math.round(notional * 0.2 * 100) / 100;
  }
  return notional;
}

export function estimateMaxLoss(
  qty: number,
  price: number,
  stopLoss?: number | null,
  side: 'BUY' | 'SELL' = 'BUY'
): number {
  if (stopLoss != null && stopLoss > 0 && price > 0) {
    return Math.abs(price - stopLoss) * qty;
  }
  return price * qty * 0.02; // default 2% risk estimate
}
