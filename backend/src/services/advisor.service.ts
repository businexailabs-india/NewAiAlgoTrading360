import { prisma } from '../config/database';
import { RagService } from './rag.service';
import { formatAdvisoryAsMarkdown, LlmClientService } from './llm-client.service';
import { LlmTrainingService } from './llm-training.service';
import { MlClientService } from './ml-client.service';
import { getLlmRegistry } from './llm/registry';
import { logger } from '../utils/logger';

export class AdvisorService {
  static async chat(
    userId: string,
    message: string,
    symbol?: string,
    adapterJobId?: string
  ) {
    const { hits, context: ragContext, mode } = await RagService.query(userId, message, symbol, 5);

    const engines = await prisma.predictionEngine.findMany({
      where: { userId, status: { in: ['ready', 'deployed'] } },
      include: { predictions: { orderBy: { createdAt: 'desc' }, take: 3 } },
      take: 5
    });

    const predictionSummary = engines.flatMap((e) =>
      e.predictions.map((p) => ({
        engine: e.name,
        engineType: e.engineType,
        symbol: p.symbol,
        direction: (p.prediction as { direction?: string }).direction,
        confidence: (p.prediction as { confidence?: number }).confidence,
        accuracy: Number(e.accuracy) || undefined
      }))
    );

    const context = {
      symbol: symbol || null,
      ragMode: mode,
      ragContext: ragContext || null,
      predictions: predictionSummary
    };

    let reply: string;
    let provider: string = 'synthesis';
    let model: string | undefined;
    let usage: unknown;
    let usedFallback = false;

    try {
      const result = await getLlmRegistry().generate_advisory(message, context, { adapterJobId });
      reply = formatAdvisoryAsMarkdown(result.data);
      provider = result.provider;
      model = result.model;
      usage = result.usage;
      usedFallback = result.usedFallback;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message.slice(0, 300) : 'unknown';
      logger.warn('Advisor LLM providers failed; using synthesis', { error: errMsg });
      reply =
        this.synthesizeReply(message, ragContext, predictionSummary, symbol) +
        `\n\n_LLM provider error (falling back to local synthesis): ${errMsg}_`;
      provider = 'synthesis';
    }

    const [mlStatus, llmStatus] = await Promise.all([
      MlClientService.getHealthDetails(),
      LlmTrainingService.getStatus()
    ]);

    return {
      reply,
      provider,
      model,
      usage,
      usedFallback,
      sources: hits.map((h) => ({
        title: String(h.metadata?.title || h.metadata?.documentId || 'Knowledge'),
        score: h.score,
        symbol: h.metadata?.symbol as string | undefined,
        method: h.method
      })),
      context: {
        engines: engines.length,
        predictions: predictionSummary.length,
        ragMode: mode,
        mlService: mlStatus,
        llmService: llmStatus,
        llmProviders: LlmClientService.listProviders()
      }
    };
  }

  private static synthesizeReply(
    message: string,
    ragContext: string,
    predictions: Array<{
      engine: string;
      engineType: string;
      symbol: string;
      direction?: string;
      confidence?: number;
      accuracy?: number;
    }>,
    symbol?: string
  ): string {
    const lines: string[] = [`**Analysis for:** ${message}\n`];

    if (ragContext) {
      lines.push('**Research context (semantic RAG):**');
      ragContext.split('\n\n').slice(0, 3).forEach((s) => {
        lines.push(`- ${s.slice(0, 280)}${s.length > 280 ? '...' : ''}`);
      });
      lines.push('');
    }

    const relevant = symbol
      ? predictions.filter((p) => p.symbol === symbol.toUpperCase())
      : predictions;

    if (relevant.length) {
      lines.push('**Your ML prediction engines:**');
      for (const p of relevant.slice(0, 5)) {
        lines.push(
          `- **${p.symbol}** (${p.engine}): ${p.direction || 'N/A'} — ` +
            `${p.confidence ?? '—'}% conf, ${p.accuracy ?? '—'}% accuracy`
        );
      }
      lines.push('');
    }

    lines.push(
      '**LLM providers:** Set `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`, ' +
        'configure `DEFAULT_LLM_PROVIDER` + `FALLBACK_LLM_PROVIDER=local`, run Ollama, or train a LoRA adapter via `/api/llm/train`.'
    );
    return lines.join('\n');
  }
}
