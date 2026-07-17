import axios from 'axios';
import { getLlmRegistry } from './llm/registry';
import { LocalLLMProvider } from './llm/providers/local.provider';
import { ChatMessage, LlmProviderId } from './llm/types';
import { logger } from '../utils/logger';

/** @deprecated Prefer LlmProviderId — kept for Advisor API compatibility */
export type LlmProvider = 'openai' | 'ollama' | 'lora' | 'synthesis' | LlmProviderId;

export type { ChatMessage };

function mapProviderForLegacy(id: LlmProviderId | 'synthesis'): LlmProvider {
  if (id === 'openai') return 'openai';
  if (id === 'local') {
    const mode = (process.env.LOCAL_LLM_MODE || '').toLowerCase();
    if (mode === 'lora') return 'lora';
    return 'ollama';
  }
  return id;
}

/**
 * Compatibility façade over the pluggable LLM provider registry.
 * Preserves checkOllama / checkLlmService / chat({text, provider}) for existing callers.
 */
export class LlmClientService {
  private static ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  private static llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:8082';

  static async checkOllama(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 3000 });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  static async checkLlmService(): Promise<boolean> {
    try {
      const res = await axios.get(`${this.llmServiceUrl}/health`, { timeout: 3000 });
      return res.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  static listProviders() {
    return getLlmRegistry().list();
  }

  /**
   * Free-form chat used by legacy callers. Routes through structured advisory when possible.
   */
  static async chat(
    messages: ChatMessage[],
    options?: { adapterJobId?: string; model?: string }
  ): Promise<{ text: string; provider: LlmProvider; usage?: unknown; model?: string }> {
    const system = messages.find((m) => m.role === 'system')?.content || '';
    const userMsgs = messages.filter((m) => m.role !== 'system');
    const lastUser = [...userMsgs].reverse().find((m) => m.role === 'user')?.content || '';

    try {
      const result = await getLlmRegistry().generate_advisory(
        lastUser || userMsgs.map((m) => m.content).join('\n'),
        { system, messages: userMsgs },
        { adapterJobId: options?.adapterJobId, model: options?.model }
      );

      const text = formatAdvisoryAsMarkdown(result.data);
      return {
        text,
        provider: mapProviderForLegacy(result.provider),
        usage: result.usage,
        model: result.model
      };
    } catch (err) {
      logger.warn('LlmClientService.chat providers failed', {
        error: err instanceof Error ? err.message : 'unknown'
      });
      return { text: '', provider: 'synthesis' };
    }
  }

  static async advisory(
    prompt: string,
    context: unknown,
    options?: { adapterJobId?: string; model?: string }
  ) {
    return getLlmRegistry().generate_advisory(prompt, context, options);
  }
}

export function formatAdvisoryAsMarkdown(data: {
  summary: string;
  recommendations: Array<{
    action: string;
    symbol?: string;
    rationale: string;
    confidence: number;
    riskNotes?: string;
  }>;
  risks: string[];
  disclaimer: string;
}): string {
  const lines: string[] = [`**${data.summary}**\n`];
  if (data.recommendations?.length) {
    lines.push('**Recommendations:**');
    for (const r of data.recommendations) {
      lines.push(
        `- **${r.action}**${r.symbol ? ` ${r.symbol}` : ''} (${r.confidence}%): ${r.rationale}` +
          (r.riskNotes ? ` — _${r.riskNotes}_` : '')
      );
    }
    lines.push('');
  }
  if (data.risks?.length) {
    lines.push('**Risks:**');
    data.risks.forEach((risk) => lines.push(`- ${risk}`));
    lines.push('');
  }
  lines.push(`_${data.disclaimer}_`);
  return lines.join('\n');
}

// Re-export LocalLLMProvider health helpers for status endpoints if needed
export { LocalLLMProvider };
