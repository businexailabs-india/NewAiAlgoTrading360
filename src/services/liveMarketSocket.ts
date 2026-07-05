/**
 * Live market WebSocket via Socket.IO (backend market stream).
 */
import { io, Socket } from 'socket.io-client';
import { getWsUrl } from '../lib/ws';

export type MarketTickCallback = (data: Record<string, unknown>) => void;

class LiveMarketSocket {
  private socket: Socket | null = null;
  private connected = false;

  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    this.socket = io(getWsUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000
    });

    this.socket.on('connect', () => {
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
    });

    return this.socket;
  }

  isConnected(): boolean {
    return this.connected && !!this.socket?.connected;
  }

  subscribe(channels: string[]): void {
    const sock = this.connect();
    sock.emit('subscribe', channels);
  }

  onIndices(callback: MarketTickCallback): () => void {
    const sock = this.connect();
    const handler = (data: Record<string, unknown>) => callback(data);
    sock.on('market:indices', handler);
    return () => sock.off('market:indices', handler);
  }

  onGainers(callback: MarketTickCallback): () => void {
    const sock = this.connect();
    const handler = (data: Record<string, unknown>) => callback(data);
    sock.on('market:gainers', handler);
    return () => sock.off('market:gainers', handler);
  }

  onLosers(callback: MarketTickCallback): () => void {
    const sock = this.connect();
    const handler = (data: Record<string, unknown>) => callback(data);
    sock.on('market:losers', handler);
    return () => sock.off('market:losers', handler);
  }

  onSectors(callback: MarketTickCallback): () => void {
    const sock = this.connect();
    const handler = (data: Record<string, unknown>) => callback(data);
    sock.on('market:sectors', handler);
    return () => sock.off('market:sectors', handler);
  }

  onBreadth(callback: MarketTickCallback): () => void {
    const sock = this.connect();
    const handler = (data: Record<string, unknown>) => callback(data);
    sock.on('market:breadth', handler);
    return () => sock.off('market:breadth', handler);
  }

  onTick(channel: string, callback: MarketTickCallback): () => void {
    const sock = this.connect();
    sock.emit('subscribe', [channel]);
    const handler = (data: Record<string, unknown>) => {
      if (data.type === 'index' && channel.startsWith('index:') && data.name === channel.slice(6)) {
        callback(data);
      }
      if (data.type === 'stock' && channel.startsWith('stock:') && data.symbol === channel.slice(6)) {
        callback(data);
      }
    };
    sock.on('market:tick', handler);
    return () => sock.off('market:tick', handler);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }
}

export const liveMarketSocket = new LiveMarketSocket();
