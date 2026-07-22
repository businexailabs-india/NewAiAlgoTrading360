import axios from 'axios';
import { DHAN_NSE_EQ_IDS, DHAN_IDX_IDS } from './dhan.service';
import { BrokerAdapterResult, PlaceOrderInput } from './dhan-mcp.adapter';
import { AppError } from '../middleware/error.middleware';

const DHAN_BASE = 'https://api.dhan.co/v2';

export interface DhanCredentials {
  clientId: string;
  accessToken: string;
}

/**
 * Direct Dhan API v2 adapter — credentials injected per call (no process.env reads).
 */
export class DhanDirectAdapter {
  constructor(private credentials: DhanCredentials) {
    if (!credentials.clientId || !credentials.accessToken) {
      throw new AppError('Dhan credentials incomplete', 400);
    }
  }

  private headers() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'access-token': this.credentials.accessToken,
      'client-id': this.credentials.clientId
    };
  }

  static resolveEquityId(symbol: string): number | null {
    const key = symbol.toUpperCase().replace(/\.NS$/i, '');
    return DHAN_NSE_EQ_IDS[key] ?? null;
  }

  async getFunds() {
    const res = await axios.get(`${DHAN_BASE}/fundlimit`, { headers: this.headers(), timeout: 10000 });
    return res.data;
  }

  async getHoldings() {
    try {
      const res = await axios.get(`${DHAN_BASE}/holdings`, { headers: this.headers(), timeout: 15000 });
      return res.data;
    } catch (err: unknown) {
      // Dhan returns HTTP 500 + DH-1111 when the demat has no CNC holdings
      const data = (err as { response?: { data?: { errorCode?: string; errorMessage?: string } } })?.response?.data;
      if (data?.errorCode === 'DH-1111') {
        return [];
      }
      throw err;
    }
  }

  async getPositions() {
    try {
      const res = await axios.get(`${DHAN_BASE}/positions`, { headers: this.headers(), timeout: 15000 });
      return res.data;
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { errorCode?: string } } })?.response?.data;
      if (data?.errorCode === 'DH-1111') return [];
      throw err;
    }
  }

  async getOrders() {
    const res = await axios.get(`${DHAN_BASE}/orders`, { headers: this.headers(), timeout: 15000 });
    return res.data;
  }

  async getOrder(orderId: string) {
    const res = await axios.get(`${DHAN_BASE}/orders/${orderId}`, { headers: this.headers(), timeout: 10000 });
    return res.data;
  }

  async getTrades() {
    const res = await axios.get(`${DHAN_BASE}/trades`, { headers: this.headers(), timeout: 15000 });
    return res.data;
  }

  async ltp(securities: Record<string, number[]>) {
    const res = await axios.post(`${DHAN_BASE}/marketfeed/ltp`, securities, {
      headers: this.headers(),
      timeout: 10000
    });
    return res.data;
  }

  async quote(securities: Record<string, number[]>) {
    const res = await axios.post(`${DHAN_BASE}/marketfeed/quote`, securities, {
      headers: this.headers(),
      timeout: 12000
    });
    return res.data;
  }

  async optionChain(input: { UnderlyingScrip: number; UnderlyingSeg: string; Expiry: string }) {
    const res = await axios.post(`${DHAN_BASE}/optionchain`, input, {
      headers: this.headers(),
      timeout: 15000
    });
    return res.data;
  }

  async placeOrder(input: PlaceOrderInput): Promise<BrokerAdapterResult> {
    let securityId = input.securityId ? Number(input.securityId) : null;
    if (!securityId && input.symbol) securityId = DhanDirectAdapter.resolveEquityId(input.symbol);
    if (!securityId) throw new AppError(`Unknown Dhan securityId for ${input.symbol || 'symbol'}`, 400);

    const productMap: Record<string, string> = { CNC: 'CNC', MIS: 'INTRADAY', NRML: 'MARGIN' };
    const orderTypeMap: Record<string, string> = {
      MARKET: 'MARKET',
      LIMIT: 'LIMIT',
      SL: 'STOP_LOSS',
      'SL-M': 'STOP_LOSS_MARKET'
    };

    const body = {
      dhanClientId: this.credentials.clientId,
      transactionType: input.tradeType,
      exchangeSegment: input.exchangeSegment || 'NSE_EQ',
      productType: productMap[input.product || 'CNC'] || 'CNC',
      orderType: orderTypeMap[input.orderType || 'MARKET'] || 'MARKET',
      validity: input.validity || 'DAY',
      securityId: String(securityId),
      quantity: input.quantity,
      price: input.price ?? 0,
      triggerPrice: input.triggerPrice ?? 0,
      correlationId: input.correlationId?.slice(0, 30)
    };

    const res = await axios.post(`${DHAN_BASE}/orders`, body, {
      headers: this.headers(),
      timeout: 15000
    });
    const data = res.data || {};
    return {
      brokerOrderId: data.orderId ? String(data.orderId) : undefined,
      status: String(data.orderStatus || 'TRANSIT'),
      raw: data
    };
  }

  async cancelOrder(orderId: string) {
    const res = await axios.delete(`${DHAN_BASE}/orders/${orderId}`, {
      headers: this.headers(),
      timeout: 10000
    });
    return res.data;
  }

  async modifyOrder(input: {
    orderId: string;
    orderType?: string;
    quantity?: number;
    price?: number;
    triggerPrice?: number;
    validity?: string;
  }): Promise<BrokerAdapterResult> {
    const orderTypeMap: Record<string, string> = {
      MARKET: 'MARKET',
      LIMIT: 'LIMIT',
      SL: 'STOP_LOSS',
      'SL-M': 'STOP_LOSS_MARKET'
    };
    const body: Record<string, unknown> = {
      dhanClientId: this.credentials.clientId,
      orderId: input.orderId,
      validity: input.validity || 'DAY'
    };
    if (input.orderType) body.orderType = orderTypeMap[input.orderType] || input.orderType;
    if (input.quantity != null) body.quantity = input.quantity;
    if (input.price != null) body.price = input.price;
    if (input.triggerPrice != null) body.triggerPrice = input.triggerPrice;

    const res = await axios.put(`${DHAN_BASE}/orders/${input.orderId}`, body, {
      headers: this.headers(),
      timeout: 15000
    });
    const data = res.data || {};
    return {
      brokerOrderId: data.orderId ? String(data.orderId) : input.orderId,
      status: String(data.orderStatus || 'TRANSIT'),
      raw: data
    };
  }

  async probe(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.getFunds();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export { DHAN_IDX_IDS };
