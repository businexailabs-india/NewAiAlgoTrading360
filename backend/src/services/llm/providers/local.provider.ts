import axios from 'axios';
import { BaseLLMProvider, CompletionPayload } from '../base-llm-provider';
import { getLlmTimeoutMs, withRetry } from '../retry';
import { ChatMessage, LlmCallOptions, LlmProviderError } from '../types';

type LocalMode = 'ollama' | 'lora';

/**
 * Local LLM via Ollama or LoRA sidecar (LLM_SERVICE_URL).
 * LOCAL_LLM_MODE=ollama|lora (default: auto — prefer Ollama if up, else LoRA).
 */
export class LocalLLMProvider extends BaseLLMProvider {
  readonly id = 'local' as const;

  private ollamaUrl(): string {
    return process.env.OLLAMA_URL || 'http://localhost:11434';
  }

  private llmServiceUrl(): string {
    return process.env.LLM_SERVICE_URL || 'http://localhost:8082';
  }

  isAvailable(): boolean {
    // Availability is optimistic for local; health checked at call time.
    return true;
  }

  async checkOllama(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.ollamaUrl()}/api/tags`, { timeout: 3000 });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  async checkLora(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.llmServiceUrl()}/health`, { timeout: 3000 });
      return res.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  private async resolveMode(): Promise<LocalMode | null> {
    const forced = (process.env.LOCAL_LLM_MODE || '').toLowerCase();
    if (forced === 'ollama' || forced === 'lora') return forced;
    if (await this.checkOllama()) return 'ollama';
    if (await this.checkLora()) return 'lora';
    return null;
  }

  protected async completeJson(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    const mode = await this.resolveMode();
    if (!mode) {
      throw new LlmProviderError('No local LLM available (Ollama/LoRA)', this.id, 503, true);
    }

    return withRetry(this.id, async () => {
      if (mode === 'ollama') return this.callOllama(messages, options);
      return this.callLora(messages, options);
    }, { maxRetries: options?.maxRetries });
  }

  private async callOllama(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    const model = options?.model || process.env.OLLAMA_MODEL || 'llama3.2';
    const timeout = options?.timeoutMs ?? getLlmTimeoutMs();
    try {
      const res = await axios.post(
        `${this.ollamaUrl()}/api/chat`,
        {
          model,
          messages,
          stream: false,
          format: 'json',
          options: { temperature: options?.temperature ?? 0.3 }
        },
        { timeout }
      );
      return {
        text: res.data.message?.content || res.data.response || '',
        model,
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
      };
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      throw new LlmProviderError(
        'Ollama request failed',
        this.id,
        status,
        !status || status === 408 || status === 429 || status >= 500,
        err
      );
    }
  }

  private async callLora(
    messages: ChatMessage[],
    options?: LlmCallOptions
  ): Promise<CompletionPayload> {
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const prompt = `${system}\n\n${lastUser}`;
    const timeout = options?.timeoutMs ?? Math.max(getLlmTimeoutMs(), 120000);
    try {
      const res = await axios.post(
        `${this.llmServiceUrl()}/generate`,
        {
          prompt,
          adapter_job_id: options?.adapterJobId,
          max_tokens: options?.maxTokens ?? 800
        },
        { timeout }
      );
      return {
        text: res.data?.data?.text || res.data?.text || '',
        model: process.env.LLM_BASE_MODEL || 'local-lora',
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
      };
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      throw new LlmProviderError(
        'LoRA sidecar request failed',
        this.id,
        status,
        !status || status === 408 || status === 429 || status >= 500,
        err
      );
    }
  }
}
