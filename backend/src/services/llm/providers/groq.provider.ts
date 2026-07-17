import { BaseLLMProvider, CompletionPayload } from '../base-llm-provider';
import { fetchWithTimeout, withRetry } from '../retry';
import { ChatMessage, LlmCallOptions, LlmProviderError } from '../types';

export class GroqProvider extends BaseLLMProvider {
  readonly id = 'groq' as const;

  isAvailable(): boolean {
    return !!process.env.GROQ_API_KEY;
  }

  protected async completeJson(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    if (!this.isAvailable()) {
      throw new LlmProviderError('GROQ_API_KEY not configured', this.id, 400, false);
    }
    const model = options?.model || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    return withRetry(this.id, async () => {
      const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
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
          `Groq API error: ${res.status}`,
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
