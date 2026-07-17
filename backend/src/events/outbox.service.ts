import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { KafkaTopics } from './topics';

const ADVISORY_URL = process.env.AI_ADVISORY_SERVICE_URL || 'http://localhost:8091';

/**
 * Persist-then-publish outbox. Login never awaits Kafka/advisory completion.
 */
export class OutboxService {
  static async enqueue(input: {
    topic: string;
    tenantId?: string | null;
    userId?: string | null;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }) {
    const eventId = randomUUID();
    const idempotencyKey = input.idempotencyKey || `${input.topic}:${input.userId}:${eventId}`;
    try {
      const row = await prisma.eventOutbox.create({
        data: {
          topic: input.topic,
          eventId,
          idempotencyKey,
          tenantId: input.tenantId || null,
          userId: input.userId || null,
          payload: {
            event_id: eventId,
            event_type: input.topic,
            tenant_id: input.tenantId,
            user_id: input.userId,
            idempotency_key: idempotencyKey,
            payload: input.payload,
            occurred_at: new Date().toISOString()
          } as Prisma.InputJsonValue,
          status: 'PENDING'
        }
      });
      // Fire-and-forget dispatch — does not block caller
      setImmediate(() => {
        void OutboxService.dispatchOne(row.id).catch((err) =>
          logger.warn('outbox.dispatch_failed', { error: err instanceof Error ? err.message : String(err) })
        );
      });
      return row;
    } catch (err) {
      // Unique idempotency / missing table during migrate — never fail login
      logger.warn('outbox.enqueue_failed', { error: err instanceof Error ? err.message : String(err) });
      return null;
    }
  }

  static async emitLoginSuccess(input: {
    userId: string;
    tenantId: string;
    email: string;
    authMethod: 'password' | 'local_guest';
    ip?: string;
    userAgent?: string;
  }) {
    return this.enqueue({
      topic: KafkaTopics.USER_LOGIN_SUCCESS,
      tenantId: input.tenantId,
      userId: input.userId,
      idempotencyKey: `login:${input.userId}:${new Date().toISOString().slice(0, 13)}`,
      payload: {
        email: input.email,
        authMethod: input.authMethod,
        ip: input.ip,
        userAgent: input.userAgent
      }
    });
  }

  static async dispatchOne(id: string) {
    const row = await prisma.eventOutbox.findUnique({ where: { id } });
    if (!row || row.status === 'PUBLISHED') return;

    try {
      if (row.topic === KafkaTopics.USER_LOGIN_SUCCESS) {
        const payload = row.payload as {
          tenant_id?: string;
          user_id?: string;
          idempotency_key?: string;
          payload?: Record<string, unknown>;
        };
        // Prefer direct internal HTTP when Kafka not configured
        const res = await fetch(`${ADVISORY_URL}/internal/events/user.login.success`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: payload.tenant_id || row.tenantId,
            user_id: payload.user_id || row.userId,
            payload: payload.payload || {},
            idempotency_key: payload.idempotency_key || row.idempotencyKey
          }),
          signal: AbortSignal.timeout(Number(process.env.ADVISORY_DISPATCH_TIMEOUT_MS || 5000))
        });
        if (!res.ok) {
          throw new Error(`advisory dispatch HTTP ${res.status}`);
        }
      }

      await prisma.eventOutbox.update({
        where: { id },
        data: { status: 'PUBLISHED', publishedAt: new Date(), attempts: { increment: 1 }, lastError: null }
      });
    } catch (err) {
      const attempts = row.attempts + 1;
      await prisma.eventOutbox.update({
        where: { id },
        data: {
          attempts,
          status: attempts >= 5 ? 'DEAD' : 'FAILED',
          lastError: err instanceof Error ? err.message.slice(0, 500) : 'dispatch failed'
        }
      });
      throw err;
    }
  }

  static async dispatchPending(limit = 20) {
    const rows = await prisma.eventOutbox.findMany({
      where: { status: { in: ['PENDING', 'FAILED'] } },
      orderBy: { createdAt: 'asc' },
      take: limit
    });
    for (const row of rows) {
      try {
        await this.dispatchOne(row.id);
      } catch {
        /* logged in dispatchOne */
      }
    }
  }
}
