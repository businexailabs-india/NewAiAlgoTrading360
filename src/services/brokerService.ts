/**
 * Broker Integration Service
 * Connects to Zerodha, Upstox, and other broker APIs
 * to fetch real portfolio data, positions, and holdings
 */

export interface BrokerCredentials {
  apiKey: string;
  apiSecret?: string;
  accessToken?: string;
  clientId?: string;
}

export interface Holding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  pnlPercentage: number;
  value: number;
  product: string;
}

export interface Position {
  tradingsymbol: string;
  exchange: string;
  quantity: number;
  buyQuantity: number;
  sellQuantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  product: string;
  overnight: boolean;
}

export interface PortfolioSummary {
  totalValue: number;
  investedValue: number;
  currentValue: number;
  totalPnL: number;
  totalPnLPercentage: number;
  dayPnL: number;
  holdings: Holding[];
  positions: Position[];
}

export interface BrokerProfile {
  userId: string;
  userName: string;
  email: string;
  broker: string;
  segments: string[];
  products: string[];
}

/**
 * Zerodha Kite Connect Integration
 */
class ZerodhaService {
  private apiKey: string = '';
  private accessToken: string = '';
  private baseUrl = 'https://api.kite.trade';

  /**
   * Initialize with API credentials
   */
  initialize(credentials: BrokerCredentials) {
    this.apiKey = credentials.apiKey;
    this.accessToken = credentials.accessToken || '';
  }

  /**
   * Get authorization URL for login
   */
  getLoginUrl(): string {
    return `https://kite.zerodha.com/connect/login?api_key=${this.apiKey}&v=3`;
  }

  /**
   * Generate session from request token
   */
  async generateSession(requestToken: string, apiSecret: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/session/token`, {
        method: 'POST',
        headers: {
          'X-Kite-Version': '3',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          api_key: this.apiKey,
          request_token: requestToken,
          checksum: this.generateChecksum(this.apiKey, requestToken, apiSecret)
        })
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        this.accessToken = data.data.access_token;
        // Store access token securely
        localStorage.setItem('zerodha_access_token', this.accessToken);
        return data.data;
      }
      
      throw new Error(data.message || 'Failed to generate session');
    } catch (error) {
      console.error('Zerodha session generation error:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<BrokerProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/user/profile`, {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${this.apiKey}:${this.accessToken}`
        }
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        return {
          userId: data.data.user_id,
          userName: data.data.user_name,
          email: data.data.email,
          broker: 'Zerodha',
          segments: data.data.exchanges,
          products: data.data.products
        };
      }
      
      throw new Error(data.message || 'Failed to fetch profile');
    } catch (error) {
      console.error('Zerodha profile fetch error:', error);
      throw error;
    }
  }

  /**
   * Get holdings (long-term investments)
   */
  async getHoldings(): Promise<Holding[]> {
    try {
      const response = await fetch(`${this.baseUrl}/portfolio/holdings`, {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${this.apiKey}:${this.accessToken}`
        }
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        return data.data.map((holding: any) => ({
          tradingsymbol: holding.tradingsymbol,
          exchange: holding.exchange,
          isin: holding.isin,
          quantity: holding.quantity,
          averagePrice: holding.average_price,
          lastPrice: holding.last_price,
          pnl: holding.pnl,
          pnlPercentage: ((holding.last_price - holding.average_price) / holding.average_price) * 100,
          value: holding.last_price * holding.quantity,
          product: holding.product
        }));
      }
      
      throw new Error(data.message || 'Failed to fetch holdings');
    } catch (error) {
      console.error('Zerodha holdings fetch error:', error);
      throw error;
    }
  }

  /**
   * Get positions (intraday + overnight)
   */
  async getPositions(): Promise<Position[]> {
    try {
      const response = await fetch(`${this.baseUrl}/portfolio/positions`, {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${this.apiKey}:${this.accessToken}`
        }
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        const allPositions = [...data.data.net, ...data.data.day];
        return allPositions.map((position: any) => ({
          tradingsymbol: position.tradingsymbol,
          exchange: position.exchange,
          quantity: position.quantity,
          buyQuantity: position.buy_quantity,
          sellQuantity: position.sell_quantity,
          averagePrice: position.average_price,
          lastPrice: position.last_price,
          pnl: position.pnl,
          product: position.product,
          overnight: position.overnight
        }));
      }
      
      throw new Error(data.message || 'Failed to fetch positions');
    } catch (error) {
      console.error('Zerodha positions fetch error:', error);
      throw error;
    }
  }

  /**
   * Get complete portfolio summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    try {
      const [holdings, positions] = await Promise.all([
        this.getHoldings(),
        this.getPositions()
      ]);

      const holdingsValue = holdings.reduce((sum, h) => sum + h.value, 0);
      const holdingsInvested = holdings.reduce((sum, h) => sum + (h.averagePrice * h.quantity), 0);
      const holdingsPnL = holdings.reduce((sum, h) => sum + h.pnl, 0);
      
      const positionsPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

      return {
        totalValue: holdingsValue,
        investedValue: holdingsInvested,
        currentValue: holdingsValue,
        totalPnL: holdingsPnL + positionsPnL,
        totalPnLPercentage: ((holdingsValue - holdingsInvested) / holdingsInvested) * 100,
        dayPnL: positionsPnL,
        holdings,
        positions
      };
    } catch (error) {
      console.error('Zerodha portfolio summary error:', error);
      throw error;
    }
  }

  /**
   * Generate checksum for authentication
   */
  private generateChecksum(apiKey: string, requestToken: string, apiSecret: string): string {
    // This requires crypto library - implement based on Zerodha docs
    // For now, return placeholder
    return `${apiKey}${requestToken}${apiSecret}`;
  }
}

/**
 * Upstox Integration
 */
class UpstoxService {
  private apiKey: string = '';
  private accessToken: string = '';
  private baseUrl = 'https://api.upstox.com/v2';

  initialize(credentials: BrokerCredentials) {
    this.apiKey = credentials.apiKey;
    this.accessToken = credentials.accessToken || '';
  }

  getLoginUrl(): string {
    return `https://api.upstox.com/v2/login/authorization/dialog?client_id=${this.apiKey}&redirect_uri=YOUR_REDIRECT_URI&response_type=code`;
  }

  async getProfile(): Promise<BrokerProfile> {
    try {
      const response = await fetch(`${this.baseUrl}/user/profile`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        return {
          userId: data.data.user_id,
          userName: data.data.user_name,
          email: data.data.email,
          broker: 'Upstox',
          segments: data.data.exchanges,
          products: data.data.products
        };
      }
      
      throw new Error('Failed to fetch Upstox profile');
    } catch (error) {
      console.error('Upstox profile fetch error:', error);
      throw error;
    }
  }

  async getHoldings(): Promise<Holding[]> {
    try {
      const response = await fetch(`${this.baseUrl}/portfolio/long-term-holdings`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        return data.data.map((holding: any) => ({
          tradingsymbol: holding.trading_symbol,
          exchange: holding.exchange,
          isin: holding.isin,
          quantity: holding.quantity,
          averagePrice: holding.average_price,
          lastPrice: holding.last_price,
          pnl: holding.pnl,
          pnlPercentage: holding.pnl_percentage,
          value: holding.last_price * holding.quantity,
          product: 'CNC'
        }));
      }
      
      throw new Error('Failed to fetch Upstox holdings');
    } catch (error) {
      console.error('Upstox holdings fetch error:', error);
      throw error;
    }
  }

  async getPositions(): Promise<Position[]> {
    try {
      const response = await fetch(`${this.baseUrl}/portfolio/short-term-positions`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.status === 'success') {
        return data.data.map((position: any) => ({
          tradingsymbol: position.trading_symbol,
          exchange: position.exchange,
          quantity: position.quantity,
          buyQuantity: position.buy_quantity,
          sellQuantity: position.sell_quantity,
          averagePrice: position.average_price,
          lastPrice: position.last_price,
          pnl: position.pnl,
          product: position.product,
          overnight: position.is_overnight
        }));
      }
      
      throw new Error('Failed to fetch Upstox positions');
    } catch (error) {
      console.error('Upstox positions fetch error:', error);
      throw error;
    }
  }

  async getPortfolioSummary(): Promise<PortfolioSummary> {
    try {
      const [holdings, positions] = await Promise.all([
        this.getHoldings(),
        this.getPositions()
      ]);

      const holdingsValue = holdings.reduce((sum, h) => sum + h.value, 0);
      const holdingsInvested = holdings.reduce((sum, h) => sum + (h.averagePrice * h.quantity), 0);
      const holdingsPnL = holdings.reduce((sum, h) => sum + h.pnl, 0);
      const positionsPnL = positions.reduce((sum, p) => sum + p.pnl, 0);

      return {
        totalValue: holdingsValue,
        investedValue: holdingsInvested,
        currentValue: holdingsValue,
        totalPnL: holdingsPnL + positionsPnL,
        totalPnLPercentage: ((holdingsValue - holdingsInvested) / holdingsInvested) * 100,
        dayPnL: positionsPnL,
        holdings,
        positions
      };
    } catch (error) {
      console.error('Upstox portfolio summary error:', error);
      throw error;
    }
  }
}

/**
 * Unified Broker Service
 */
class BrokerService {
  private zerodha = new ZerodhaService();
  private upstox = new UpstoxService();
  private activeBroker: 'zerodha' | 'upstox' | null = null;

  /**
   * Initialize broker connection
   */
  async connect(broker: 'zerodha' | 'upstox', credentials: BrokerCredentials) {
    this.activeBroker = broker;
    
    if (broker === 'zerodha') {
      this.zerodha.initialize(credentials);
    } else if (broker === 'upstox') {
      this.upstox.initialize(credentials);
    }
  }

  /**
   * Get login URL for broker
   */
  getLoginUrl(broker: 'zerodha' | 'upstox'): string {
    if (broker === 'zerodha') {
      return this.zerodha.getLoginUrl();
    } else {
      return this.upstox.getLoginUrl();
    }
  }

  /**
   * Get user profile
   */
  async getProfile(): Promise<BrokerProfile | null> {
    if (!this.activeBroker) return null;
    
    if (this.activeBroker === 'zerodha') {
      return await this.zerodha.getProfile();
    } else {
      return await this.upstox.getProfile();
    }
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(): Promise<PortfolioSummary | null> {
    if (!this.activeBroker) return null;
    
    if (this.activeBroker === 'zerodha') {
      return await this.zerodha.getPortfolioSummary();
    } else {
      return await this.upstox.getPortfolioSummary();
    }
  }

  /**
   * Get holdings
   */
  async getHoldings(): Promise<Holding[]> {
    if (!this.activeBroker) return [];
    
    if (this.activeBroker === 'zerodha') {
      return await this.zerodha.getHoldings();
    } else {
      return await this.upstox.getHoldings();
    }
  }

  /**
   * Get positions
   */
  async getPositions(): Promise<Position[]> {
    if (!this.activeBroker) return [];
    
    if (this.activeBroker === 'zerodha') {
      return await this.zerodha.getPositions();
    } else {
      return await this.upstox.getPositions();
    }
  }

  /**
   * Check if broker is connected
   */
  isConnected(): boolean {
    return this.activeBroker !== null;
  }

  /**
   * Get active broker name
   */
  getActiveBroker(): string | null {
    return this.activeBroker;
  }
}

export const brokerService = new BrokerService();
export { ZerodhaService, UpstoxService };
