/**
 * Real-time transport abstraction — WebSocket / SSE / polling fallback.
 * UI subscribes to typed events; adapters swap without changing components.
 */

export type PortfolioRealtimeEventType =
  | 'quote'
  | 'order'
  | 'fill'
  | 'position'
  | 'pnl'
  | 'margin'
  | 'risk'
  | 'connectivity'
  | 'reconciliation';

export interface PortfolioRealtimeEvent {
  type: PortfolioRealtimeEventType;
  payload: unknown;
  timestamp: string;
  correlationId?: string;
}

export type Unsubscribe = () => void;

export interface RealtimeTransport {
  connect(): Promise<void>;
  disconnect(): void;
  subscribe(types: PortfolioRealtimeEventType[], handler: (e: PortfolioRealtimeEvent) => void): Unsubscribe;
  lastEventAt(): string | null;
}

type Handler = (e: PortfolioRealtimeEvent) => void;

export class PollingRealtimeTransport implements RealtimeTransport {
  private timers: number[] = [];
  private handlers = new Map<PortfolioRealtimeEventType, Set<Handler>>();
  private lastAt: string | null = null;
  private intervalMs: number;

  constructor(intervalMs = 15_000) {
    this.intervalMs = intervalMs;
  }

  async connect() {
    this.lastAt = new Date().toISOString();
    const id = window.setInterval(() => {
      this.lastAt = new Date().toISOString();
      this.emit({
        type: 'pnl',
        payload: { source: 'POLL_FALLBACK', demo: true },
        timestamp: this.lastAt,
      });
    }, this.intervalMs);
    this.timers.push(id);
  }

  disconnect() {
    for (const t of this.timers) window.clearInterval(t);
    this.timers = [];
  }

  subscribe(types: PortfolioRealtimeEventType[], handler: Handler): Unsubscribe {
    for (const t of types) {
      const set = this.handlers.get(t) || new Set();
      set.add(handler);
      this.handlers.set(t, set);
    }
    return () => {
      for (const t of types) this.handlers.get(t)?.delete(handler);
    };
  }

  lastEventAt() {
    return this.lastAt;
  }

  private emit(e: PortfolioRealtimeEvent) {
    const set = this.handlers.get(e.type);
    if (!set) return;
    for (const h of set) h(e);
  }
}

/** Placeholder for Socket.IO / native WS when backend streams are available. */
export class WebSocketRealtimeTransport implements RealtimeTransport {
  private url: string;
  private ws: WebSocket | null = null;
  private handlers = new Map<PortfolioRealtimeEventType, Set<Handler>>();
  private lastAt: string | null = null;

  constructor(url: string) {
    this.url = url;
  }

  async connect() {
    // Intentionally not auto-connecting to a fake URL in demo mode.
    this.lastAt = new Date().toISOString();
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  subscribe(types: PortfolioRealtimeEventType[], handler: Handler): Unsubscribe {
    for (const t of types) {
      const set = this.handlers.get(t) || new Set();
      set.add(handler);
      this.handlers.set(t, set);
    }
    return () => {
      for (const t of types) this.handlers.get(t)?.delete(handler);
    };
  }

  lastEventAt() {
    return this.lastAt;
  }
}

export function createDefaultRealtimeTransport(): RealtimeTransport {
  return new PollingRealtimeTransport(20_000);
}

export function isStale(lastAt: string | null, thresholdMs = 60_000): boolean {
  if (!lastAt) return true;
  return Date.now() - new Date(lastAt).getTime() > thresholdMs;
}
