import { BaseLLMProvider } from './base-llm-provider';
import { AzureOpenAIProvider } from './providers/azure-openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { GroqProvider } from './providers/groq.provider';
import { LocalLLMProvider } from './providers/local.provider';
import { MockLLMProvider } from './providers/mock.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';
import {
  AdvisoryResponse,
  LlmCallOptions,
  LlmOperation,
  LlmProviderError,
  LlmProviderId,
  LlmProviderResult,
  MarketSummaryResponse,
  RiskExplanationResponse,
  StrategyReviewResponse,
  StrategyRulesResponse
} from './types';
import { logger } from '../../utils/logger';

const PROVIDER_ALIASES: Record<string, LlmProviderId> = {
  claude: 'claude',
  anthropic: 'claude',
  openai: 'openai',
  azure: 'azure_openai',
  azure_openai: 'azure_openai',
  gemini: 'gemini',
  google: 'gemini',
  groq: 'groq',
  openrouter: 'openrouter',
  local: 'local',
  ollama: 'local',
  lora: 'local',
  mock: 'mock'
};

export function normalizeProviderId(raw?: string | null): LlmProviderId | null {
  if (!raw) return null;
  return PROVIDER_ALIASES[raw.trim().toLowerCase()] || null;
}

export class LlmProviderRegistry {
  private providers = new Map<LlmProviderId, BaseLLMProvider>();

  constructor(instances?: BaseLLMProvider[]) {
    const list =
      instances ||
      ([
        new ClaudeProvider(),
        new OpenAIProvider(),
        new AzureOpenAIProvider(),
        new GeminiProvider(),
        new GroqProvider(),
        new OpenRouterProvider(),
        new LocalLLMProvider(),
        new MockLLMProvider()
      ] as BaseLLMProvider[]);

    for (const p of list) {
      this.providers.set(p.id, p);
    }
  }

  get(id: LlmProviderId): BaseLLMProvider | undefined {
    return this.providers.get(id);
  }

  list(): Array<{ id: LlmProviderId; available: boolean }> {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      available: p.isAvailable()
    }));
  }

  resolveDefault(): LlmProviderId {
    const configured = normalizeProviderId(process.env.DEFAULT_LLM_PROVIDER) || 'claude';
    if (configured === 'mock' && process.env.ALLOW_MOCK_LLM !== 'true' && process.env.NODE_ENV !== 'test') {
      throw new LlmProviderError(
        'Mock provider cannot be DEFAULT_LLM_PROVIDER without ALLOW_MOCK_LLM=true',
        'mock',
        400,
        false
      );
    }
    return configured;
  }

  resolveFallback(primary: LlmProviderId): LlmProviderId | null {
    const raw = process.env.FALLBACK_LLM_PROVIDER;
    if (!raw) return null;
    const fb = normalizeProviderId(raw);
    if (!fb) {
      throw new LlmProviderError(`Invalid FALLBACK_LLM_PROVIDER: ${raw}`, primary, 400, false);
    }
    if (fb === primary) {
      throw new LlmProviderError(
        'FALLBACK_LLM_PROVIDER must differ from DEFAULT_LLM_PROVIDER',
        primary,
        400,
        false
      );
    }
    if (fb === 'mock' && process.env.ALLOW_MOCK_LLM !== 'true' && process.env.NODE_ENV !== 'test') {
      throw new LlmProviderError(
        'Mock provider cannot be FALLBACK_LLM_PROVIDER without ALLOW_MOCK_LLM=true',
        'mock',
        400,
        false
      );
    }
    return fb;
  }

  private async invoke<T>(
    operation: LlmOperation,
    run: (provider: BaseLLMProvider) => Promise<LlmProviderResult<T>>,
    prefer?: LlmProviderId
  ): Promise<LlmProviderResult<T>> {
    const primaryId = prefer || this.resolveDefault();
    const primary = this.providers.get(primaryId);
    if (!primary) {
      throw new LlmProviderError(`Unknown provider: ${primaryId}`, primaryId, 400, false);
    }

    try {
      if (!primary.isAvailable()) {
        throw new LlmProviderError(`Provider unavailable: ${primaryId}`, primaryId, 503, true);
      }
      const result = await run(primary);
      return result;
    } catch (primaryErr) {
      const fallbackId = this.resolveFallback(primaryId);
      if (!fallbackId) throw primaryErr;

      const fallback = this.providers.get(fallbackId);
      if (!fallback || !fallback.isAvailable()) {
        logger.warn('llm.fallback_unavailable', {
          primary: primaryId,
          fallback: fallbackId,
          operation
        });
        throw primaryErr;
      }

      logger.warn('llm.fallback', {
        primary: primaryId,
        fallback: fallbackId,
        operation,
        error: primaryErr instanceof Error ? primaryErr.message.slice(0, 200) : 'unknown'
      });

      try {
        const result = await run(fallback);
        return { ...result, usedFallback: true };
      } catch {
        throw primaryErr;
      }
    }
  }

  generate_advisory(prompt: string, context: unknown, options?: LlmCallOptions, prefer?: LlmProviderId) {
    return this.invoke<AdvisoryResponse>(
      'generate_advisory',
      (p) => p.generate_advisory(prompt, context, options),
      prefer
    );
  }

  generate_strategy_rules(prompt: string, context: unknown, options?: LlmCallOptions, prefer?: LlmProviderId) {
    return this.invoke<StrategyRulesResponse>(
      'generate_strategy_rules',
      (p) => p.generate_strategy_rules(prompt, context, options),
      prefer
    );
  }

  explain_risk(
    strategy: unknown,
    portfolio: unknown,
    market_context: unknown,
    options?: LlmCallOptions,
    prefer?: LlmProviderId
  ) {
    return this.invoke<RiskExplanationResponse>(
      'explain_risk',
      (p) => p.explain_risk(strategy, portfolio, market_context, options),
      prefer
    );
  }

  summarize_market(market_context: unknown, options?: LlmCallOptions, prefer?: LlmProviderId) {
    return this.invoke<MarketSummaryResponse>(
      'summarize_market',
      (p) => p.summarize_market(market_context, options),
      prefer
    );
  }

  review_strategy(strategy_config: unknown, options?: LlmCallOptions, prefer?: LlmProviderId) {
    return this.invoke<StrategyReviewResponse>(
      'review_strategy',
      (p) => p.review_strategy(strategy_config, options),
      prefer
    );
  }
}

let singleton: LlmProviderRegistry | null = null;

export function getLlmRegistry(override?: LlmProviderRegistry): LlmProviderRegistry {
  if (override) {
    singleton = override;
    return singleton;
  }
  if (!singleton) singleton = new LlmProviderRegistry();
  return singleton;
}

export function resetLlmRegistry(): void {
  singleton = null;
}
