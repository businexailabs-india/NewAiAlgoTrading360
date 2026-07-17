import { BaseLLMProvider, CompletionPayload } from '../base-llm-provider';
import { fetchWithTimeout, withRetry } from '../retry';
import { ChatMessage, LlmCallOptions, LlmProviderError } from '../types';

/**
 * Azure OpenAI — requires AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_DEPLOYMENT.
 */
export class AzureOpenAIProvider extends BaseLLMProvider {
  readonly id = 'azure_openai' as const;

  isAvailable(): boolean {
    return !!(
      process.env.AZURE_OPENAI_API_KEY &&
      process.env.AZURE_OPENAI_ENDPOINT &&
      process.env.AZURE_OPENAI_DEPLOYMENT
    );
  }

  protected async completeJson(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    if (!this.isAvailable()) {
      throw new LlmProviderError(
        'Azure OpenAI env incomplete (AZURE_OPENAI_API_KEY/ENDPOINT/DEPLOYMENT)',
        this.id,
        400,
        false
      );
    }

    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!;
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
    const base = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, '');
    const url = `${base}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    return withRetry(this.id, async () => {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': process.env.AZURE_OPENAI_API_KEY!
        },
        body: JSON.stringify({
          messages,
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? 2048,
          response_format: { type: 'json_object' }
        }),
        timeoutMs: options?.timeoutMs
      });

      if (!res.ok) {
        throw new LlmProviderError(
          `Azure OpenAI error: ${res.status}`,
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
        model: data.model || deployment,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens
        }
      };
    }, { maxRetries: options?.maxRetries });
  }
}
