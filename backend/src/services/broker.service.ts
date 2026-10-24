import crypto from 'crypto';
import axios from 'axios';
import { DatabaseService } from './database.service';
import { EncryptionService } from './encryption.service';
import { AppError } from '../middleware/error.middleware';
import { calculatePnL } from '../utils/helpers';
import { FyersService } from './fyers.service';
import { FyersDirectAdapter } from './fyers-direct.adapter';

export class BrokerService {
  static generateZerodhaChecksum(requestToken: string): string {
    const apiKey = process.env.ZERODHA_API_KEY || '';
    const apiSecret = process.env.ZERODHA_API_SECRET || '';
    return crypto
      .createHash('sha256')
      .update(apiKey + requestToken + apiSecret)
      .digest('hex');
  }

  static getLoginUrl(broker: string): string {
    switch (broker.toLowerCase()) {
      case 'zerodha':
        return `https://kite.zerodha.com/connect/login?api_key=${process.env.ZERODHA_API_KEY}&v=3`;
      case 'upstox':
        return `https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.UPSTOX_API_KEY}&redirect_uri=${encodeURIComponent(process.env.UPSTOX_REDIRECT_URL || '')}&response_type=code`;
      case 'angelone':
        return `https://smartapi.angelbroking.com/publisher-login?api_key=${process.env.ANGELONE_API_KEY}`;
      case 'fyers': {
        const appId = process.env.FYERS_APP_ID || '';
        const redirect = encodeURIComponent(
          process.env.FYERS_REDIRECT_URL || 'http://localhost:3001/api/broker/callback?broker=fyers'
        );
        return `https://api-t1.fyers.in/api/v3/generate-authcode?client_id=${encodeURIComponent(appId)}&redirect_uri=${redirect}&response_type=code&state=algo360`;
      }
      default:
        throw new AppError('Unsupported broker', 400);
    }
  }

  static async exchangeToken(broker: string, params: { requestToken?: string; code?: string }) {
    switch (broker.toLowerCase()) {
      case 'zerodha': {
        if (!params.requestToken) throw new AppError('Request token is required', 400);
        const checksum = this.generateZerodhaChecksum(params.requestToken);
        const response = await axios.post(
          'https://api.kite.trade/session/token',
          new URLSearchParams({
            api_key: process.env.ZERODHA_API_KEY || '',
            request_token: params.requestToken,
            checksum
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        return {
          accessToken: response.data.data.access_token,
          refreshToken: null
        };
      }
      case 'upstox': {
        if (!params.code) throw new AppError('Authorization code is required', 400);
        const response = await axios.post(
          'https://api.upstox.com/v2/login/authorization/token',
          {
            code: params.code,
            client_id: process.env.UPSTOX_API_KEY,
            client_secret: process.env.UPSTOX_API_SECRET,
            redirect_uri: process.env.UPSTOX_REDIRECT_URL,
            grant_type: 'authorization_code'
          }
        );
        return {
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token
        };
      }
      case 'fyers': {
        if (!params.code) throw new AppError('Authorization code is required', 400);
        const appId = process.env.FYERS_APP_ID || '';
        const appSecret = process.env.FYERS_APP_SECRET || '';
        const appIdHash = crypto.createHash('sha256').update(`${appId}:${appSecret}`).digest('hex');
        const response = await axios.post(
          `${(process.env.FYERS_BASE_URL || 'https://api-t1.fyers.in').replace(/\/$/, '')}/api/v3/validate-authcode`,
          {
            grant_type: 'authorization_code',
            appIdHash,
            code: params.code
          }
        );
        const accessToken = response.data?.access_token || response.data?.data?.access_token;
        if (!accessToken) throw new AppError('Fyers did not return an access token', 502);
        return {
          accessToken,
          refreshToken: response.data?.refresh_token || response.data?.data?.refresh_token || null
        };
      }
      default:
        throw new AppError('Unsupported broker', 400);
    }
  }

  static async fetchHoldings(broker: string, accessToken: string) {
    switch (broker.toLowerCase()) {
      case 'zerodha': {
        const response = await axios.get('https://api.kite.trade/portfolio/holdings', {
          headers: {
            Authorization: `token ${process.env.ZERODHA_API_KEY}:${accessToken}`,
            'X-Kite-Version': '3'
          }
        });
        return response.data.data || [];
      }
      case 'upstox': {
        const response = await axios.get(
          'https://api.upstox.com/v2/portfolio/long-term-holdings',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return response.data.data || [];
      }
      case 'fyers': {
        const adapter = new FyersDirectAdapter({
          appId: process.env.FYERS_APP_ID || '',
          accessToken
        });
        const raw = await adapter.getHoldings();
        return Array.isArray(raw?.holdings) ? raw.holdings : Array.isArray(raw?.data) ? raw.data : [];
      }
      default:
        throw new AppError('Unsupported broker', 400);
    }
  }

  static async fetchQuotes(broker: string, accessToken: string, symbols: string[]) {
    switch (broker.toLowerCase()) {
      case 'zerodha': {
        const instruments = symbols.map(s => `NSE:${s}`).join(',');
        const response = await axios.get(
          `https://api.kite.trade/quote?i=${encodeURIComponent(instruments)}`,
          {
            headers: {
              Authorization: `token ${process.env.ZERODHA_API_KEY}:${accessToken}`,
              'X-Kite-Version': '3'
            }
          }
        );
        return Object.values(response.data.data || {}).map((q: any) => ({
          symbol: q.instrument_token ? symbols.find(s => instruments.includes(s)) || q.tradingsymbol : q.tradingsymbol,
          price: q.last_price,
          change: q.net_change || 0,
          changePercent: q.ohlc?.close ? ((q.last_price - q.ohlc.close) / q.ohlc.close) * 100 : 0,
          open: q.ohlc?.open,
          high: q.ohlc?.high,
          low: q.ohlc?.low,
          volume: q.volume
        }));
      }
      case 'upstox': {
        const response = await axios.get(
          `https://api.upstox.com/v2/market-quote/quotes?symbol=${symbols.map(s => `NSE_EQ|${s}`).join(',')}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return Object.entries(response.data.data || {}).map(([key, q]: [string, any]) => ({
          symbol: key.split('|').pop() || key,
          price: q.last_price,
          change: q.net_change,
          changePercent: q.percentage_change,
          open: q.ohlc?.open,
          high: q.ohlc?.high,
          low: q.ohlc?.low,
          volume: q.volume
        }));
      }
      case 'fyers': {
        const map = await FyersService.getQuotes(symbols, {
          appId: process.env.FYERS_APP_ID || '',
          accessToken
        });
        return [...map.values()].map((q) => ({
          symbol: q.symbol,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          open: q.open,
          high: q.high,
          low: q.low,
          volume: q.volume
        }));
      }
      default:
        return [];
    }
  }

  static async syncHoldings(userId: string, brokerConnectionId: string) {
    const connection = await DatabaseService.getBrokerConnectionById(brokerConnectionId);
    if (connection.userId !== userId) throw new AppError('Unauthorized', 403);

    const accessToken = EncryptionService.decrypt(connection.accessTokenEncrypted!);
    const rawHoldings = await this.fetchHoldings(connection.broker, accessToken);

    let count = 0;
    for (const h of rawHoldings) {
      const symbol = h.tradingsymbol || h.symbol || h.trading_symbol;
      const qty = h.quantity || h.qty || 0;
      const avgPrice = h.average_price || h.avg_price || 0;
      const lastPrice = h.last_price || h.ltp || avgPrice;
      const { pnl, pnlPercentage } = calculatePnL(qty, avgPrice, lastPrice);

      await DatabaseService.createHolding({
        userId,
        brokerConnectionId,
        symbol,
        exchange: h.exchange || 'NSE',
        quantity: qty,
        averagePrice: avgPrice,
        lastPrice,
        pnl,
        pnlPercentage,
        currentValue: qty * lastPrice,
        investedValue: qty * avgPrice,
        product: h.product || 'CNC',
        isin: h.isin
      });
      count++;
    }

    return { count };
  }

  static async getActiveBrokerToken(userId: string): Promise<{ broker: string; accessToken: string } | null> {
    const connections = await DatabaseService.getBrokerConnections(userId);
    if (!connections.length) return null;
    const conn = connections[0];
    if (!conn.accessTokenEncrypted) return null;
    return {
      broker: conn.broker,
      accessToken: EncryptionService.decrypt(conn.accessTokenEncrypted)
    };
  }
}
