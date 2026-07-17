import { BaseLLMProvider, CompletionPayload } from '../base-llm-provider';
import {
  bifrostAnthropicApiKey,
  isBifrostEnabled,
  resolveAnthropicMessagesUrl
} from '../bifrost';
import { fetchWithTimeout, withRetry } from '../retry';
import { ChatMessage, LlmCallOptions, LlmProviderError } from '../types';
import { logger } from '../../../utils/logger';

/**
 * Anthropic Claude provider.
 * When Bifrost is enabled, requests go to the Bifrost Anthropic drop-in endpoint.
 * If Bifrost is unreachable, falls back to direct Anthropic API when a key is set.
 */
export class ClaudeProvider extends BaseLLMProvider {
  readonly id = 'claude' as const;

  isAvailable(): boolean {
    if (isBifrostEnabled()) {
      return true; // Bifrost holds / proxies the Anthropic key
    }
    return !!process.env.ANTHROPIC_API_KEY;
  }

  protected async completeJson(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    if (!this.isAvailable()) {
      throw new LlmProviderError('ANTHROPIC_API_KEY not configured', this.id, 400, false);
    }

    const model = options?.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    const body = {
      model,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.3,
      system,
      messages: anthropicMessages
    };

    try {
      return await this.callMessagesApi(
        resolveAnthropicMessagesUrl(),
        bifrostAnthropicApiKey(),
        body,
        options,
        isBifrostEnabled() ? 'bifrost' : 'direct'
      );
    } catch (err) {
      // Bifrost down → direct Anthropic so Ask Advisor still works
      if (isBifrostEnabled() && process.env.ANTHROPIC_API_KEY && this.isConnectionError(err)) {
        logger.warn('llm.bifrost_unreachable_fallback_direct', {
          error: err instanceof Error ? err.message : String(err)
        });
        return this.callMessagesApi(
          (process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages').replace(
            /\/$/,
            ''
          ),
          process.env.ANTHROPIC_API_KEY,
          body,
          options,
          'direct'
        );
      }
      throw err;
    }
  }

  private isConnectionError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    return (
      msg.includes('fetch failed') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('network') ||
      msg.includes('aborted') ||
      err.name === 'AbortError'
    );
  }

  private async callMessagesApi(
    url: string,
    apiKey: string,
    body: Record<string, unknown>,
    options: LlmCallOptions | undefined,
    via: 'bifrost' | 'direct'
  ): Promise<CompletionPayload> {
    const model = String(body.model || 'claude-sonnet-5');

    return withRetry(this.id, async () => {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body),
        timeoutMs: options?.timeoutMs
      });

      if (!res.ok) {
        const status = res.status;
        let detail = '';
        try {
          const errBody = (await res.json()) as { error?: { message?: string; type?: string } };
          detail = errBody?.error?.message || errBody?.error?.type || '';
        } catch {
          /* ignore parse errors */
        }
        throw new LlmProviderError(
          detail
            ? `Claude API error (${status}/${via}): ${detail} [model=${model}]`
            : `Claude API error: ${status} (${via}) [model=${model}]`,
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
