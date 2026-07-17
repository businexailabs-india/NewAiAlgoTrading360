import { BaseLLMProvider, CompletionPayload } from '../base-llm-provider';
import { fetchWithTimeout, withRetry } from '../retry';
import { ChatMessage, LlmCallOptions, LlmProviderError } from '../types';

/**
 * Anthropic Claude provider — uses ANTHROPIC_API_KEY from environment only.
 */
export class ClaudeProvider extends BaseLLMProvider {
  readonly id = 'claude' as const;

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  protected async completeJson(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    if (!this.isAvailable()) {
      throw new LlmProviderError('ANTHROPIC_API_KEY not configured', this.id, 400, false);
    }

    const model = options?.model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022';
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    return withRetry(this.id, async () => {
      const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: options?.maxTokens ?? 2048,
          temperature: options?.temperature ?? 0.3,
          system,
          messages: anthropicMessages
        }),
        timeoutMs: options?.timeoutMs
      });

      if (!res.ok) {
        const status = res.status;
        throw new LlmProviderError(
          `Claude API error: ${status}`,
          this.id,
          status,
          status === 408 || status === 429 || status >= 500
        );
      }

      const data = (await res.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        model?: string;
      };
      const text = (data.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text || '')
        .join('\n')
        .trim();

      return {
        text,
        model: data.model || model,
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0
        }
      };
    }, { maxRetries: options?.maxRetries });
  }
}
