import axios from 'axios';
import { logger } from '../utils/logger';

const base = () => (process.env.DHAN_SIDECAR_URL || 'http://127.0.0.1:8099').replace(/\/$/, '');

export type DhanHqOptionChainRequest = {
  under_security_id?: number;
  under_exchange_segment?: string;
  expiry: string;
  client_id?: string;
  access_token?: string;
};

/**
 * Optional HTTP client for the Python DhanHQ-py sidecar.
 * Node DhanDirectAdapter remains the primary OMS path.
 */
export class DhanHqSidecarClient {
  static url(): string {
    return base();
  }

  static configured(): boolean {
    return !!process.env.DHAN_SIDECAR_URL;
  }

  static async health(): Promise<{
    ok: boolean;
    reachable: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }> {
    try {
      const res = await axios.get(`${base()}/health`, { timeout: 4000 });
      return { ok: !!res.data?.ok, reachable: true, data: res.data };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('dhanhq sidecar health failed', { message });
      return { ok: false, reachable: false, error: message };
    }
  }

  static async funds(creds?: { client_id?: string; access_token?: string }) {
    const res = await axios.get(`${base()}/v1/funds`, {
      params: creds,
      timeout: 15000
    });
    return res.data;
  }

  static async optionChain(body: DhanHqOptionChainRequest) {
    const res = await axios.post(`${base()}/v1/option-chain`, body, { timeout: 30000 });
    return res.data;
  }

  static async expiryList(
    under_security_id = 13,
    under_exchange_segment = 'IDX_I',
    creds?: { client_id?: string; access_token?: string }
  ) {
    const res = await axios.get(`${base()}/v1/expiry-list`, {
      params: { under_security_id, under_exchange_segment, ...creds },
      timeout: 15000
    });
    return res.data;
  }

  static async quotesOhlc(
    securities: Record<string, number[]>,
    creds?: { client_id?: string; access_token?: string }
  ) {
    const res = await axios.post(
      `${base()}/v1/quotes/ohlc`,
      { securities, ...creds },
      { timeout: 15000 }
    );
    return res.data;
  }
}
