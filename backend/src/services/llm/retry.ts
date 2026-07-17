import { LlmProviderError, LlmProviderId } from './types';

export function getLlmTimeoutMs(): number {
  const sec = Number(process.env.LLM_TIMEOUT_SECONDS || 30);
  return Math.max(1000, (Number.isFinite(sec) ? sec : 30) * 1000);
}

export function getLlmMaxRetries(): number {
  const n = Number(process.env.LLM_MAX_RETRIES ?? 2);
  return Math.max(0, Math.min(5, Number.isFinite(n) ? n : 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status?: number): boolean {
  if (status == null) return true;
  return status === 408 || status === 429 || status >= 500;
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof LlmProviderError) return err.retryable;
  const any = err as { code?: string; response?: { status?: number }; status?: number; name?: string };
  if (any?.name === 'AbortError') return true;
  if (any?.code === 'ECONNRESET' || any?.code === 'ETIMEDOUT' || any?.code === 'ECONNABORTED') return true;
  const status = any?.response?.status ?? any?.status;
  return isRetryableStatus(status);
}

/**
 * Bounded retry with exponential backoff + jitter.
 * Retries only transient network / 408 / 429 / 5xx failures.
 */
export async function withRetry<T>(
  provider: LlmProviderId,
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; baseDelayMs?: number }
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? getLlmMaxRetries();
  const baseDelayMs = opts?.baseDelayMs ?? 400;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = isRetryableError(err);
      if (!retryable || attempt >= maxRetries) break;
      const jitter = Math.floor(Math.random() * 200);
      const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
      await sleep(delay);
    }
  }

  if (lastError instanceof LlmProviderError) throw lastError;
  const msg = lastError instanceof Error ? lastError.message : 'LLM request failed';
  throw new LlmProviderError(msg, provider, undefined, false, lastError);
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? getLlmTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { timeoutMs: _t, ...rest } = init;
    return await fetch(url, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
