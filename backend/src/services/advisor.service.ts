import { prisma } from '../config/database';
import { RagService } from './rag.service';
import { PredictionService } from './prediction.service';
import { logger } from '../utils/logger';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AdvisorService {
  static async chat(
    userId: string,
    message: string,
    symbol?: string
  ): Promise<{ reply: string; sources: Array<{ title: string; score: number; symbol?: string }>; context: {
    engines: number;
    predictions: number;
  } }> {
    await RagService.seedDefaults(userId);

    const { hits, context: ragContext } = await RagService.query(userId, message, symbol, 5);

    const engines = await prisma.predictionEngine.findMany({
      where: { userId, status: { in: ['ready', 'deployed'] } },
      include: {
        predictions: { orderBy: { createdAt: 'desc' }, take: 3 }
      },
      take: 5
    });

    const predictionSummary = engines.flatMap(e =>
      (e.predictions as Array<{ symbol: string; prediction: Record<string, unknown> }>).map(p => ({
        engine: e.name,
        engineType: e.engineType,
        symbol: p.symbol,
        direction: (p.prediction as { direction?: string }).direction,
        confidence: (p.prediction as { confidence?: number }).confidence,
        accuracy: Number(e.accuracy) || undefined
      }))
    );

    if (process.env.OPENAI_API_KEY) {
      try {
        const reply = await this.callOpenAI(message, ragContext, predictionSummary);
        return {
          reply,
          sources: hits.map(h => ({
            title: String(h.metadata?.title || 'Knowledge'),
            score: h.score,
            symbol: h.metadata?.symbol as string | undefined
          })),
          context: { engines: engines.length, predictions: predictionSummary.length }
        };
      } catch (err) {
        logger.warn('OpenAI call failed, using local synthesis', err);
      }
    }

    const reply = this.synthesizeReply(message, ragContext, predictionSummary, symbol);
    return {
      reply,
      sources: hits.map(h => ({
        title: String(h.metadata?.title || 'Knowledge'),
        score: h.score,
        symbol: h.metadata?.symbol as string | undefined
      })),
      context: { engines: engines.length, predictions: predictionSummary.length }
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
    const lines: string[] = [];
    lines.push(`**Analysis for:** ${message}\n`);

    if (ragContext) {
      lines.push('**Research context (RAG):**');
      const snippets = ragContext.split('\n\n').slice(0, 3);
      snippets.forEach(s => lines.push(`- ${s.slice(0, 280)}${s.length > 280 ? '...' : ''}`));
      lines.push('');
    }

    const relevant = symbol
      ? predictions.filter(p => p.symbol === symbol.toUpperCase())
      : predictions;

    if (relevant.length) {
      lines.push('**Your ML prediction engines:**');
      for (const p of relevant.slice(0, 5)) {
        lines.push(
          `- **${p.symbol}** (${p.engine}, ${p.engineType}): ${p.direction || 'N/A'} ` +
          `— confidence ${p.confidence ?? '—'}%, model accuracy ${p.accuracy ?? '—'}%`
        );
      }
      lines.push('');
    } else if (predictions.length) {
      lines.push('**Recent predictions across portfolio:**');
      for (const p of predictions.slice(0, 4)) {
        lines.push(`- ${p.symbol}: ${p.direction} (${p.confidence}% conf, ${p.engine})`);
      }
      lines.push('');
    }

    const lower = message.toLowerCase();
    if (lower.includes('rebalanc')) {
      lines.push(
        '**Recommendation:** Review sector weights vs targets. Trim positions >5% above target. ' +
        'Use sklearn/advanced_ml engines for 7-day horizon signals before executing trades.'
      );
    } else if (lower.includes('risk')) {
      lines.push(
        '**Risk note:** Diversify across sectors. Set stop-losses on high-beta names. ' +
        'Walk-forward validated models (advanced_ml) are more reliable in volatile regimes.'
      );
    } else if (lower.includes('tech') || lower.includes('it')) {
      lines.push(
        '**Sector view:** IT showing mixed signals — check USD/INR and client spending. ' +
        'Consider mean_reversion or stacking models after extended rallies.'
      );
    } else {
      lines.push(
        '**Next steps:** Train an `advanced_ml` engine with walk-forward validation on your symbols. ' +
        'Add research notes in Knowledge Base to improve RAG-augmented predictions.'
      );
    }

    lines.push('\n_Set `OPENAI_API_KEY` for GPT-powered responses. Current mode: RAG + ML synthesis._');
    return lines.join('\n');
  }

  private static async callOpenAI(
    message: string,
    ragContext: string,
    predictions: Array<Record<string, unknown>>
  ): Promise<string> {
    const system = `You are SmartTrade AI Portfolio Advisor for Indian equities (NSE/BSE).
Use the research context and user's ML predictions. Be specific, actionable, and mention risks.
Never guarantee returns. Currency in INR.`;

    const userContent = `Question: ${message}

Research context:
${ragContext || 'None'}

User ML predictions:
${JSON.stringify(predictions, null, 2)}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent }
        ],
        temperature: 0.4,
        max_tokens: 800
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI error: ${res.status}`);
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0]?.message?.content || 'Unable to generate response.';
  }
}

// Avoid circular import unused warning
void PredictionService;
