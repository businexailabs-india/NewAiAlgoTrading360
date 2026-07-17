import { logger } from '../../utils/logger';
import { LlmOperation, LlmProviderId, TokenUsage } from './types';

/** Approximate USD per 1M tokens (input, output). Local/unknown => null cost. */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
  'mixtral-8x7b-32768': { input: 0.24, output: 0.24 }
};

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const key = Object.keys(MODEL_PRICING).find((k) => model.includes(k) || k.includes(model));
  const pricing = key ? MODEL_PRICING[key] : undefined;
  if (!pricing) return null;
  return Number(
    ((inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output).toFixed(6)
  );
}

export function normalizeUsage(
  model: string,
  partial: Partial<TokenUsage> & { promptTokens?: number; completionTokens?: number }
): TokenUsage {
  const inputTokens = partial.inputTokens ?? partial.promptTokens ?? 0;
  const outputTokens = partial.outputTokens ?? partial.completionTokens ?? 0;
  const totalTokens = partial.totalTokens ?? inputTokens + outputTokens;
  const estimatedCostUsd =
    partial.estimatedCostUsd !== undefined
      ? partial.estimatedCostUsd
      : estimateCostUsd(model, inputTokens, outputTokens);
  return { inputTokens, outputTokens, totalTokens, estimatedCostUsd };
}

export function logLlmUsage(meta: {
  provider: LlmProviderId;
  model: string;
  operation: LlmOperation;
  latencyMs: number;
  usage: TokenUsage;
  usedFallback?: boolean;
  ok?: boolean;
  error?: string;
}): void {
  logger.info('llm.usage', {
    provider: meta.provider,
    model: meta.model,
    operation: meta.operation,
    latencyMs: meta.latencyMs,
    inputTokens: meta.usage.inputTokens,
    outputTokens: meta.usage.outputTokens,
    totalTokens: meta.usage.totalTokens,
    estimatedCostUsd: meta.usage.estimatedCostUsd,
    usedFallback: !!meta.usedFallback,
    ok: meta.ok !== false,
    error: meta.error ? String(meta.error).slice(0, 200) : undefined
  });
}
