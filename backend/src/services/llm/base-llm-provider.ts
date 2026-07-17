import { SCHEMA_INSTRUCTIONS, parseJsonFromLlmText, validateBySchema } from './schemas';
import { redactPrompt, safeContextJson } from './redaction';
import { logLlmUsage, normalizeUsage } from './usage';
import {
  AdvisoryResponse,
  ChatMessage,
  LlmCallOptions,
  LlmOperation,
  LlmProviderId,
  LlmProviderResult,
  MarketSummaryResponse,
  RiskExplanationResponse,
  SchemaName,
  StrategyReviewResponse,
  StrategyRulesResponse,
  TokenUsage
} from './types';

export interface CompletionPayload {
  text: string;
  model: string;
  usage?: Partial<TokenUsage> & { promptTokens?: number; completionTokens?: number };
}

/**
 * Base interface / abstract implementation for pluggable LLM providers.
 * Vendor adapters implement `completeJson` transport only.
 */
export abstract class BaseLLMProvider {
  abstract readonly id: LlmProviderId;

  abstract isAvailable(): boolean;

  /** Low-level JSON completion after prompts are already redacted. */
  protected abstract completeJson(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload>;

  validate_response_schema(response: unknown, schema: SchemaName = 'advisory'): unknown {
    return validateBySchema(schema, response);
  }

  async generate_advisory(
    prompt: string,
    context: unknown,
    options?: LlmCallOptions
  ): Promise<LlmProviderResult<AdvisoryResponse>> {
    return this.runStructured('generate_advisory', 'advisory', prompt, context, options) as Promise<
      LlmProviderResult<AdvisoryResponse>
    >;
  }

  async generate_strategy_rules(
    prompt: string,
    context: unknown,
    options?: LlmCallOptions
  ): Promise<LlmProviderResult<StrategyRulesResponse>> {
    return this.runStructured(
      'generate_strategy_rules',
      'strategy_rules',
      prompt,
      context,
      options
    ) as Promise<LlmProviderResult<StrategyRulesResponse>>;
  }

  async explain_risk(
    strategy: unknown,
    portfolio: unknown,
    market_context: unknown,
    options?: LlmCallOptions
  ): Promise<LlmProviderResult<RiskExplanationResponse>> {
    const prompt = 'Explain portfolio and strategy risk for Indian equities trading.';
    const context = { strategy, portfolio, market_context };
    return this.runStructured('explain_risk', 'risk_explanation', prompt, context, options) as Promise<
      LlmProviderResult<RiskExplanationResponse>
    >;
  }

  async summarize_market(
    market_context: unknown,
    options?: LlmCallOptions
  ): Promise<LlmProviderResult<MarketSummaryResponse>> {
    return this.runStructured(
      'summarize_market',
      'market_summary',
      'Summarize current Indian equity market context.',
      market_context,
      options
    ) as Promise<LlmProviderResult<MarketSummaryResponse>>;
  }

  async review_strategy(
    strategy_config: unknown,
    options?: LlmCallOptions
  ): Promise<LlmProviderResult<StrategyReviewResponse>> {
    return this.runStructured(
      'review_strategy',
      'strategy_review',
      'Review this trading strategy configuration.',
      strategy_config,
      options
    ) as Promise<LlmProviderResult<StrategyReviewResponse>>;
  }

  protected buildMessages(schema: SchemaName, prompt: string, context: unknown): ChatMessage[] {
    const system = `You are SmartTrade AI Portfolio Advisor for Indian equities (NSE/BSE).
Currency: INR. Never guarantee returns. Never invent broker credentials.
Always respond with structured JSON only — no markdown prose outside JSON.
Response schema: ${schema}
${SCHEMA_INSTRUCTIONS[schema]}`;

    const user = `${redactPrompt(prompt)}

Context (redacted):
${safeContextJson(context)}`;

    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  }

  protected async runStructured(
    operation: LlmOperation,
    schema: SchemaName,
    prompt: string,
    context: unknown,
    options?: LlmCallOptions
  ): Promise<LlmProviderResult<unknown>> {
    const started = Date.now();
    const messages = this.buildMessages(schema, prompt, context);
    try {
      const completion = await this.completeJson(messages, options);
      const parsed = parseJsonFromLlmText(completion.text);
      const data = this.validate_response_schema(parsed, schema);
      const usage = normalizeUsage(completion.model, completion.usage || {});
      const latencyMs = Date.now() - started;
      logLlmUsage({
        provider: this.id,
        model: completion.model,
        operation,
        latencyMs,
        usage,
        ok: true
      });
      return {
        data,
        provider: this.id,
        model: completion.model,
        operation,
        usage,
        latencyMs,
        usedFallback: false,
        rawText: completion.text
      };
    } catch (err) {
      const latencyMs = Date.now() - started;
      logLlmUsage({
        provider: this.id,
        model: options?.model || 'unknown',
        operation,
        latencyMs,
        usage: normalizeUsage('unknown', {}),
        ok: false,
        error: err instanceof Error ? err.message : 'unknown'
      });
      throw err;
    }
  }
}
