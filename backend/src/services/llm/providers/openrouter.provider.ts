import { BaseLLMProvider, CompletionPayload } from '../base-llm-provider';
import { fetchWithTimeout, withRetry } from '../retry';
import { ChatMessage, LlmCallOptions, LlmProviderError } from '../types';

export class OpenRouterProvider extends BaseLLMProvider {
  readonly id = 'openrouter' as const;

  isAvailable(): boolean {
    return !!process.env.OPENROUTER_API_KEY;
  }

  protected async completeJson(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    if (!this.isAvailable()) {
      throw new LlmProviderError('OPENROUTER_API_KEY not configured', this.id, 400, false);
    }
    const model = options?.model || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

    return withRetry(this.id, async () => {
      const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
          'X-Title': 'SmartTrade Portfolio Advisor'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 2048,
          response_format: { type: 'json_object' }
        }),
        timeoutMs: options?.timeoutMs
      });

      if (!res.ok) {
        throw new LlmProviderError(
          `OpenRouter API error: ${res.status}`,
          this.id,
          res.status,
          res.status === 408 || res.status === 429 || res.status >= 500
        );
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        model?: string;
      };

      return {
        text: data.choices?.[0]?.message?.content || '',
        model: data.model || model,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens
        }
      };
    }, { maxRetries: options?.maxRetries });
  }
}
