import { prisma } from '../config/database';
import { RagService } from './rag.service';
import { LlmClientService } from './llm-client.service';
import { LlmTrainingService } from './llm-training.service';
import { MlClientService } from './ml-client.service';

export class AdvisorService {
  static async chat(
    userId: string,
    message: string,
    symbol?: string,
    adapterJobId?: string
  ) {
    await RagService.seedDefaults(userId);

    const { hits, context: ragContext, mode } = await RagService.query(userId, message, symbol, 5);

    const engines = await prisma.predictionEngine.findMany({
      where: { userId, status: { in: ['ready', 'deployed'] } },
      include: { predictions: { orderBy: { createdAt: 'desc' }, take: 3 } },
      take: 5
    });

    const predictionSummary = engines.flatMap(e =>
      e.predictions.map(p => ({
        engine: e.name,
        engineType: e.engineType,
        symbol: p.symbol,
        direction: (p.prediction as { direction?: string }).direction,
        confidence: (p.prediction as { confidence?: number }).confidence,
        accuracy: Number(e.accuracy) || undefined
      }))
    );

    const systemPrompt = `You are SmartTrade AI Portfolio Advisor for Indian equities (NSE/BSE).
Use research context and ML predictions. Be specific and actionable. Mention risks. Currency: INR.
Never guarantee returns.`;

    const userPrompt = `Question: ${message}
${symbol ? `Focus symbol: ${symbol}` : ''}

Research context (RAG mode: ${mode}):
${ragContext || 'None'}

ML predictions:
${JSON.stringify(predictionSummary, null, 2)}`;

    const llmResult = await LlmClientService.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      { adapterJobId }
    );

    const reply = llmResult.provider === 'synthesis'
      ? this.synthesizeReply(message, ragContext, predictionSummary, symbol)
      : llmResult.text;

    const [mlStatus, llmStatus] = await Promise.all([
      MlClientService.getHealthDetails(),
      LlmTrainingService.getStatus()
    ]);

    return {
      reply,
      provider: llmResult.provider,
      sources: hits.map(h => ({
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
        llmService: llmStatus
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
      ragContext.split('\n\n').slice(0, 3).forEach(s => {
        lines.push(`- ${s.slice(0, 280)}${s.length > 280 ? '...' : ''}`);
      });
      lines.push('');
    }

    const relevant = symbol
      ? predictions.filter(p => p.symbol === symbol.toUpperCase())
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
      '**LLM providers:** Set `OPENAI_API_KEY`, run Ollama (`OLLAMA_URL`), or train a LoRA adapter via `/api/llm/train`.'
    );
    return lines.join('\n');
  }
}
