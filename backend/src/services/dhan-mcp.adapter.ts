import { McpHttpClient } from './mcp-http.client';
import { DhanCapability, getCapabilityDef } from './dhan-capability.registry';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

export interface PlaceOrderInput {
  symbol?: string;
  securityId?: string;
  exchangeSegment?: string;
  tradeType: 'BUY' | 'SELL';
  quantity: number;
  orderType?: string;
  product?: string;
  price?: number;
  triggerPrice?: number;
  validity?: string;
  correlationId?: string;
  preflight?: boolean;
}

export interface BrokerAdapterResult {
  brokerOrderId?: string;
  status: string;
  raw: unknown;
  filledPrice?: number;
}

/**
 * Dhan MCP adapter — typed capability calls only (no open-ended tool proxy).
 */
export class DhanMcpAdapter {
  constructor(private client: McpHttpClient) {}

  async invokeCapability(capability: DhanCapability, payload: Record<string, unknown> = {}) {
    const def = getCapabilityDef(capability);
    const args =
      def.tool.endsWith('_tool') || def.tool.includes('agent')
        ? { action: def.action, payload: JSON.stringify(payload) }
        : payload;

    logger.info(`MCP capability ${capability} via ${def.tool}.${def.action}`);
    return this.client.callTool(def.tool, args);
  }

  async searchSymbol(query: string, exchange = 'NSE') {
    return this.invokeCapability('search.symbol', { query, exchange });
  }

  async getFunds() {
    return this.invokeCapability('portfolio.funds', {});
  }

  async getHoldings() {
    return this.invokeCapability('portfolio.holdings', {});
  }

  async getPositions() {
    return this.invokeCapability('portfolio.positions', {});
  }

  async getOrderBook() {
    return this.invokeCapability('orderbook.list', {});
  }

  async getOrder(orderId: string) {
    return this.invokeCapability('orderbook.get', { orderId });
  }

  async getTradeBook() {
    return this.invokeCapability('tradebook.list', {});
  }

  async marginSingle(payload: Record<string, unknown>) {
    return this.invokeCapability('margin.single', payload);
  }

  async placeOrder(input: PlaceOrderInput): Promise<BrokerAdapterResult> {
    const productMap: Record<string, string> = {
      CNC: 'CNC',
      MIS: 'INTRADAY',
      NRML: 'MARGIN',
      INTRADAY: 'INTRADAY',
      MARGIN: 'MARGIN',
      MTF: 'MTF'
    };
    const orderTypeMap: Record<string, string> = {
      MARKET: 'MARKET',
      LIMIT: 'LIMIT',
      SL: 'STOP_LOSS',
      'SL-M': 'STOP_LOSS_MARKET',
      STOP_LOSS: 'STOP_LOSS',
      STOP_LOSS_MARKET: 'STOP_LOSS_MARKET'
    };

    const payload: Record<string, unknown> = {
      transactionType: input.tradeType,
      exchangeSegment: input.exchangeSegment || 'NSE_EQ',
      quantity: input.quantity,
      orderType: orderTypeMap[input.orderType || 'MARKET'] || 'MARKET',
      productType: productMap[input.product || 'CNC'] || 'CNC',
      price: input.price ?? 0,
      triggerPrice: input.triggerPrice ?? 0,
      validity: input.validity || 'DAY',
      preflight: input.preflight !== false
    };
    if (input.securityId) payload.securityId = input.securityId;
    if (input.symbol) payload.symbol = input.symbol;
    if (input.correlationId) payload.correlationId = input.correlationId;

    const raw = await this.invokeCapability('trading.place', payload);
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const brokerOrderId = String(obj.orderId || obj.order_id || obj.id || '');
    const status = String(obj.orderStatus || obj.status || (brokerOrderId ? 'TRANSIT' : 'UNKNOWN'));
    if (!brokerOrderId && /error|fail|reject/i.test(JSON.stringify(raw))) {
      throw new AppError(`Dhan MCP order rejected: ${JSON.stringify(raw)}`, 400);
    }
    return { brokerOrderId: brokerOrderId || undefined, status, raw };
  }

  async modifyOrder(payload: Record<string, unknown>) {
    return this.invokeCapability('trading.modify', payload);
  }

  async cancelOrder(orderId: string) {
    return this.invokeCapability('trading.cancel', { orderId });
  }

  async ltp(securities: Record<string, number[]>) {
    return this.invokeCapability('market.ltp', securities);
  }

  async quote(securities: Record<string, number[]>) {
    return this.invokeCapability('market.quote', securities);
  }
}
