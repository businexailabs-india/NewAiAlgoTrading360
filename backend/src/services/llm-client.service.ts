import axios from 'axios';
import { logger } from '../utils/logger';

export type LlmProvider = 'openai' | 'ollama' | 'lora' | 'synthesis';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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

  static async chat(
    messages: ChatMessage[],
    options?: { adapterJobId?: string; model?: string }
  ): Promise<{ text: string; provider: LlmProvider }> {
    const system = messages.find(m => m.role === 'system')?.content || '';
    const userMsgs = messages.filter(m => m.role !== 'system');
    const lastUser = [...userMsgs].reverse().find(m => m.role === 'user')?.content || '';
    const prompt = `${system}\n\n${userMsgs.map(m => `${m.role}: ${m.content}`).join('\n')}`;

    if (process.env.OPENAI_API_KEY) {
      try {
        const text = await this.callOpenAI(messages, options?.model);
        return { text, provider: 'openai' };
      } catch (err) {
        logger.warn('OpenAI failed, trying fallback', err);
      }
    }

    if (await this.checkOllama()) {
      try {
        const text = await this.callOllama(messages, options?.model);
        return { text, provider: 'ollama' };
      } catch (err) {
        logger.warn('Ollama failed, trying LLM service', err);
      }
    }

    if (await this.checkLlmService()) {
      try {
        const res = await axios.post(
          `${this.llmServiceUrl}/generate`,
          { prompt: lastUser || prompt, adapter_job_id: options?.adapterJobId, max_tokens: 800 },
          { timeout: 120000 }
        );
        return { text: res.data.data.text, provider: 'lora' };
      } catch (err) {
        logger.warn('LLM service inference failed', err);
      }
    }

    return { text: '', provider: 'synthesis' };
  }

  private static async callOpenAI(messages: ChatMessage[], model?: string): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        temperature: 0.4,
        max_tokens: 800
      })
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || '';
  }

  private static async callOllama(messages: ChatMessage[], model?: string): Promise<string> {
    const res = await axios.post(
      `${this.ollamaUrl}/api/chat`,
      {
        model: model || process.env.OLLAMA_MODEL || 'llama3.2',
        messages,
        stream: false,
        options: { temperature: 0.4 }
      },
      { timeout: 120000 }
    );
    return res.data.message?.content || res.data.response || '';
  }
}
