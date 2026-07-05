import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

let client: RedisClientType | null = null;
let connectPromise: Promise<RedisClientType | null> | null = null;

export class CacheService {
  static isEnabled(): boolean {
    return !!process.env.REDIS_URL;
  }

  static async getClient(): Promise<RedisClientType | null> {
    if (!this.isEnabled()) return null;
    if (client?.isOpen) return client;

    if (!connectPromise) {
      connectPromise = (async () => {
        try {
          client = createClient({ url: process.env.REDIS_URL });
          client.on('error', (err) => logger.warn('Redis error', err));
          await client.connect();
          logger.info('Redis cache connected');
          return client;
        } catch (err) {
          logger.warn('Redis unavailable — running without cache', err);
          client = null;
          return null;
        }
      })();
    }
    return connectPromise;
  }

  static async get<T>(key: string): Promise<T | null> {
    const c = await this.getClient();
    if (!c) return null;
    try {
      const raw = await c.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  static async set(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
    const c = await this.getClient();
    if (!c) return;
    try {
      await c.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.warn(`Cache set failed: ${key}`, err);
    }
  }

  static async del(pattern: string): Promise<void> {
    const c = await this.getClient();
    if (!c) return;
    try {
      const keys = await c.keys(pattern);
      if (keys.length) await c.del(keys);
    } catch {
      /* ignore */
    }
  }

  static ragQueryKey(userId: string, query: string, symbol?: string): string {
    const sym = symbol || 'all';
    const hash = Buffer.from(query.toLowerCase().trim()).toString('base64url').slice(0, 32);
    return `rag:${userId}:${sym}:${hash}`;
  }

  static embeddingKey(text: string): string {
    const hash = Buffer.from(text.slice(0, 200)).toString('base64url').slice(0, 40);
    return `emb:${hash}`;
  }
}
