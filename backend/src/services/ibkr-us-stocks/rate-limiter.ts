/**
 * Simple in-memory username-level pacing + 429/backoff stub with request dedupe keys.
 * Not a production IBKR gateway rate limiter — scaffolding only.
 */

export class RateLimitError extends Error {
  statusCode = 429;
  retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export interface PaceOptions {
  /** Minimum ms between paced calls for the same user. */
  minIntervalMs?: number;
  /** Cooldown after a simulated 429. */
  backoffMs?: number;
}

interface UserPaceState {
  lastRequestAt: number;
  backoffUntil: number;
  inFlight: Set<string>;
}

const DEFAULT_MIN_INTERVAL_MS = 50;
const DEFAULT_BACKOFF_MS = 1000;

export class IbkrRateLimiter {
  private users = new Map<string, UserPaceState>();
  private minIntervalMs: number;
  private backoffMs: number;

  constructor(opts: PaceOptions = {}) {
    this.minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.backoffMs = opts.backoffMs ?? DEFAULT_BACKOFF_MS;
  }

  private state(userId: string): UserPaceState {
    let s = this.users.get(userId);
    if (!s) {
      s = { lastRequestAt: 0, backoffUntil: 0, inFlight: new Set() };
      this.users.set(userId, s);
    }
    return s;
  }

  /**
   * Acquire a paced slot. Optional dedupeKey prevents concurrent identical in-flight requests.
   */
  async acquire(userId: string, dedupeKey?: string): Promise<() => void> {
    const s = this.state(userId);
    const now = Date.now();

    if (s.backoffUntil > now) {
      throw new RateLimitError(
        `IBKR pace backoff active; retry after ${s.backoffUntil - now}ms`,
        s.backoffUntil - now
      );
    }

    if (dedupeKey && s.inFlight.has(dedupeKey)) {
      throw new RateLimitError(`Duplicate in-flight request: ${dedupeKey}`, this.minIntervalMs);
    }

    const since = now - s.lastRequestAt;
    if (since < this.minIntervalMs) {
      await sleep(this.minIntervalMs - since);
    }

    s.lastRequestAt = Date.now();
    if (dedupeKey) s.inFlight.add(dedupeKey);

    return () => {
      if (dedupeKey) s.inFlight.delete(dedupeKey);
    };
  }

  /** Stub: mark user as rate-limited (simulates broker 429). */
  simulate429(userId: string, backoffMs?: number): void {
    const s = this.state(userId);
    s.backoffUntil = Date.now() + (backoffMs ?? this.backoffMs);
  }

  clear(userId?: string): void {
    if (userId) this.users.delete(userId);
    else this.users.clear();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const ibkrRateLimiter = new IbkrRateLimiter();
