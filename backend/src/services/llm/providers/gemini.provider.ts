import { BaseLLMProvider, CompletionPayload } from '../base-llm-provider';
import { fetchWithTimeout, withRetry } from '../retry';
import { ChatMessage, LlmCallOptions, LlmProviderError } from '../types';

export class GeminiProvider extends BaseLLMProvider {
  readonly id = 'gemini' as const;

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  protected async completeJson(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    if (!this.isAvailable()) {
      throw new LlmProviderError('GEMINI_API_KEY not configured', this.id, 400, false);
    }

    const model = options?.model || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(process.env.GEMINI_API_KEY!)}`;

    return withRetry(this.id, async () => {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: {
            temperature: options?.temperature ?? 0.3,
            maxOutputTokens: options?.maxTokens ?? 2048,
            responseMimeType: 'application/json'
          }
        }),
        timeoutMs: options?.timeoutMs
      });

      if (!res.ok) {
        throw new LlmProviderError(
          `Gemini API error: ${res.status}`,
          this.id,
          res.status,
          res.status === 408 || res.status === 429 || res.status >= 500
        );
      }

      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';

      return {
        text,
        model,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata?.totalTokenCount
        }
      };
    }, { maxRetries: options?.maxRetries });
  }
}
