import axios from 'axios';
import { AppError } from '../middleware/error.middleware';
import { FyersService } from './fyers.service';

const FYERS_API = (process.env.FYERS_BASE_URL || 'https://api-t1.fyers.in').replace(/\/$/, '');

export interface FyersCredentials {
  appId: string;
  accessToken: string;
}

export class FyersDirectAdapter {
  constructor(private credentials: FyersCredentials) {
    if (!credentials.appId || !credentials.accessToken) {
      throw new AppError('Fyers credentials incomplete (appId + accessToken)', 400);
    }
  }

  private headers() {
    return {
      Authorization: FyersService.authHeader(this.credentials.appId, this.credentials.accessToken)
    };
  }

  async getProfile() {
    const res = await axios.get(`${FYERS_API}/api/v3/profile`, {
      headers: this.headers(),
      timeout: 10000
    });
    return res.data;
  }

  async getHoldings() {
    const res = await axios.get(`${FYERS_API}/api/v3/holdings`, {
      headers: this.headers(),
      timeout: 15000
    });
    return res.data;
  }

  async getPositions() {
    const res = await axios.get(`${FYERS_API}/api/v3/positions`, {
      headers: this.headers(),
      timeout: 15000
    });
    return res.data;
  }

  async getQuotes(symbols: string[]) {
    return FyersService.getQuotes(symbols, this.credentials);
  }

  async probe(): Promise<{ ok: boolean; error?: string }> {
    try {
      const quotes = await this.getQuotes(['NSE:NIFTY50-INDEX']);
      if (![...quotes.values()].some((q) => q.price > 0)) {
        await this.getProfile();
      }
      return { ok: true };
    } catch (err) {
      const ax = err as { response?: { data?: { message?: string; s?: string } }; message?: string };
      return {
        ok: false,
        error: ax.response?.data?.message || ax.message || String(err)
      };
    }
  }
}
