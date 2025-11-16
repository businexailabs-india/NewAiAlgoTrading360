/**
 * WebSocket Service for Real-time Market Data
 * Provides live updates for stock prices, indices, and market data
 */

import { StockQuote, IndexData } from './marketDataService';

export type MarketDataCallback = (data: any) => void;

export interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private subscribers: Map<string, Set<MarketDataCallback>> = new Map();
  private isConnected = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(config: WebSocketConfig): void {
    if (this.ws && this.isConnected) {
      console.log('WebSocket already connected');
      return;
    }

    try {
      this.ws = new WebSocket(config.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.notifySubscribers('connection', { status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.notifySubscribers('error', { error });
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.stopHeartbeat();
        this.notifySubscribers('connection', { status: 'disconnected' });
        this.attemptReconnect(config);
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.attemptReconnect(config);
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
      this.stopHeartbeat();
    }
  }

  /**
   * Subscribe to market data updates
   */
  subscribe(channel: string, callback: MarketDataCallback): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    
    this.subscribers.get(channel)!.add(callback);

    // Send subscription message to server
    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channel: channel
      }));
    }

    // Return unsubscribe function
    return () => {
      const channelSubscribers = this.subscribers.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(callback);
        if (channelSubscribers.size === 0) {
          this.subscribers.delete(channel);
          // Send unsubscribe message to server
          if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
              type: 'unsubscribe',
              channel: channel
            }));
          }
        }
      }
    };
  }

  /**
   * Subscribe to specific stock updates
   */
  subscribeToStock(symbol: string, callback: MarketDataCallback): () => void {
    return this.subscribe(`stock:${symbol}`, callback);
  }

  /**
   * Subscribe to index updates
   */
  subscribeToIndex(indexName: string, callback: MarketDataCallback): () => void {
    return this.subscribe(`index:${indexName}`, callback);
  }

  /**
   * Subscribe to all market updates
   */
  subscribeToMarket(callback: MarketDataCallback): () => void {
    return this.subscribe('market', callback);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: any): void {
    const { type, channel, payload } = data;

    switch (type) {
      case 'stock_update':
        this.notifySubscribers(`stock:${payload.symbol}`, payload);
        break;
      
      case 'index_update':
        this.notifySubscribers(`index:${payload.name}`, payload);
        break;
      
      case 'market_update':
        this.notifySubscribers('market', payload);
        break;
      
      case 'pong':
        // Heartbeat response
        break;
      
      default:
        if (channel) {
          this.notifySubscribers(channel, payload);
        }
    }
  }

  /**
   * Notify all subscribers of a channel
   */
  private notifySubscribers(channel: string, data: any): void {
    const channelSubscribers = this.subscribers.get(channel);
    if (channelSubscribers) {
      channelSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }
  }

  /**
   * Attempt to reconnect to WebSocket server
   */
  private attemptReconnect(config: WebSocketConfig): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.notifySubscribers('connection', { 
        status: 'failed', 
        message: 'Max reconnection attempts reached' 
      });
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      this.connect(config);
    }, this.reconnectInterval);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Send custom message to server
   */
  send(message: any): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected. Message not sent.');
    }
  }
}

// Singleton instance
export const websocketService = new WebSocketService();

/**
 * Simulated WebSocket Service for Development
 * Uses polling to simulate real-time updates when WebSocket is not available
 */
class SimulatedWebSocketService {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private subscribers: Map<string, Set<MarketDataCallback>> = new Map();

  subscribe(channel: string, callback: MarketDataCallback): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
      this.startPolling(channel);
    }
    
    this.subscribers.get(channel)!.add(callback);

    return () => {
      const channelSubscribers = this.subscribers.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(callback);
        if (channelSubscribers.size === 0) {
          this.stopPolling(channel);
          this.subscribers.delete(channel);
        }
      }
    };
  }

  private startPolling(channel: string): void {
    // Simulate updates every 5 seconds
    const interval = setInterval(() => {
      const data = this.generateMockData(channel);
      this.notifySubscribers(channel, data);
    }, 5000);

    this.intervals.set(channel, interval);
  }

  private stopPolling(channel: string): void {
    const interval = this.intervals.get(channel);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(channel);
    }
  }

  private notifySubscribers(channel: string, data: any): void {
    const channelSubscribers = this.subscribers.get(channel);
    if (channelSubscribers) {
      channelSubscribers.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in subscriber callback:', error);
        }
      });
    }
  }

  private generateMockData(channel: string): any {
    // Generate random price movements
    const randomChange = (Math.random() - 0.5) * 2; // -1 to 1
    
    if (channel.startsWith('stock:')) {
      const symbol = channel.split(':')[1];
      return {
        symbol,
        price: 1000 + Math.random() * 500,
        change: randomChange * 10,
        changePercent: randomChange,
        timestamp: new Date()
      };
    }
    
    if (channel.startsWith('index:')) {
      const indexName = channel.split(':')[1];
      return {
        name: indexName,
        value: 20000 + Math.random() * 5000,
        change: randomChange * 100,
        changePercent: randomChange,
        timestamp: new Date()
      };
    }

    return { timestamp: new Date() };
  }

  disconnect(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.subscribers.clear();
  }
}

export const simulatedWebSocketService = new SimulatedWebSocketService();
