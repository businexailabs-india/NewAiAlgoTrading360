/**
 * In-memory audit log (userId scoped) for IBKR US Stocks manual trading.
 */

import { AuditEvent, TradingEnvironment } from './types';

let seq = 0;
const events: AuditEvent[] = [];

export interface AuditAppendInput {
  userId: string;
  action: string;
  environment?: TradingEnvironment;
  accountId?: string;
  orderId?: string;
  details?: Record<string, unknown>;
}

export function appendAudit(input: AuditAppendInput): AuditEvent {
  const event: AuditEvent = {
    id: `aud-${++seq}-${Date.now()}`,
    userId: input.userId,
    action: input.action,
    at: new Date().toISOString(),
    environment: input.environment,
    accountId: input.accountId,
    orderId: input.orderId,
    details: input.details
  };
  events.push(event);
  // Cap memory
  if (events.length > 5000) {
    events.splice(0, events.length - 5000);
  }
  return event;
}

export function listAudit(userId: string, limit = 200): AuditEvent[] {
  return events
    .filter((e) => e.userId === userId)
    .slice(-limit)
    .reverse();
}

/** Test helper */
export function clearAudit(userId?: string): void {
  if (!userId) {
    events.length = 0;
    return;
  }
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].userId === userId) events.splice(i, 1);
  }
}
