import { EventEmitter } from 'events';

export type MaEventType =
  | 'webhook.received'
  | 'signal.accepted'
  | 'signal.rejected'
  | 'order.submitted'
  | 'order.status'
  | 'execution.received'
  | 'position.changed'
  | 'pnl.changed'
  | 'risk.limit'
  | 'connection.changed'
  | 'reconciliation.failed'
  | 'kill_switch.activated';

export interface MaEvent {
  seq: number;
  type: MaEventType;
  tenantId: string;
  at: string;
  payload: Record<string, unknown>;
}

class MaEventBus extends EventEmitter {
  private seq = 0;
  private recent: MaEvent[] = [];

  publish(type: MaEventType, tenantId: string, payload: Record<string, unknown>): MaEvent {
    const evt: MaEvent = {
      seq: ++this.seq,
      type,
      tenantId,
      at: new Date().toISOString(),
      payload,
    };
    this.recent.push(evt);
    if (this.recent.length > 500) this.recent.shift();
    this.emit('event', evt);
    this.emit(tenantId, evt);
    return evt;
  }

  since(seq: number, tenantId?: string): MaEvent[] {
    return this.recent.filter((e) => e.seq > seq && (!tenantId || e.tenantId === tenantId));
  }
}

export const maEventBus = new MaEventBus();
