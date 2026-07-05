import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { MlClientService } from './ml-client.service';
import { CacheService } from './cache.service';
import { topKBySimilarity } from '../utils/vector-math';
import { logger } from '../utils/logger';

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 80;

function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + CHUNK_SIZE);
    chunks.push(normalized.slice(start, end));
    if (end >= normalized.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }
  return chunks;
}

export class RagService {
  static async listDocuments(userId: string, symbol?: string) {
    return prisma.knowledgeDocument.findMany({
      where: {
        userId,
        ...(symbol ? { symbol: symbol.toUpperCase() } : {})
      },
      orderBy: { updatedAt: 'desc' },
      take: 100
    });
  }

  static async createDocument(
    userId: string,
    data: { title: string; content: string; docType?: string; symbol?: string; tags?: string[] }
  ) {
    const doc = await prisma.knowledgeDocument.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        docType: data.docType || 'note',
        symbol: data.symbol?.toUpperCase(),
        tags: data.tags || []
      }
    });
    await this.reindexUser(userId);
    return doc;
  }

  static async deleteDocument(userId: string, docId: string) {
    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id: docId, userId }
    });
    if (!doc) throw new AppError('Document not found', 404);
    await prisma.knowledgeChunk.deleteMany({ where: { documentId: docId } });
    await prisma.knowledgeDocument.delete({ where: { id: docId } });
    await CacheService.del(`rag:${userId}:*`);
    await this.reindexUser(userId);
    return { message: 'Document deleted' };
  }

  static async reindexUser(userId: string): Promise<number> {
    const docs = await prisma.knowledgeDocument.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    await prisma.knowledgeChunk.deleteMany({ where: { userId } });

    const payload: Array<{ text: string; metadata: Record<string, unknown> }> = [];
    let chunkCount = 0;

    for (const doc of docs) {
      const chunks = chunkText(`${doc.title}\n${doc.content}`);
      const texts = chunks.length ? chunks : [`${doc.title}\n${doc.content}`];

      let embeddings: number[][] = [];
      if (await MlClientService.checkHealth()) {
        try {
          embeddings = await MlClientService.embedTexts(texts);
        } catch (err) {
          logger.warn('Embedding failed during reindex', err);
        }
      }

      for (let i = 0; i < texts.length; i++) {
        await prisma.knowledgeChunk.create({
          data: {
            userId,
            documentId: doc.id,
            chunkIndex: i,
            text: texts[i],
            symbol: doc.symbol,
            embedding: embeddings[i] || []
          }
        });
        chunkCount++;
      }

      payload.push({
        text: `${doc.title}\n${doc.content}`,
        metadata: {
          docId: doc.id,
          title: doc.title,
          docType: doc.docType,
          symbol: doc.symbol,
          tags: doc.tags
        }
      });
    }

    if (await MlClientService.checkHealth()) {
      await MlClientService.ragIngest(userId, payload, 'hybrid');
    }

    await CacheService.del(`rag:${userId}:*`);
    return chunkCount;
  }

  static async query(userId: string, query: string, symbol?: string, topK = 5): Promise<{
    hits: RagHit[];
    context: string;
    mode: string;
  }> {
    const cacheKey = CacheService.ragQueryKey(userId, query, symbol);
    const cached = await CacheService.get<{ hits: RagHit[]; context: string; mode: string }>(cacheKey);
    if (cached) return cached;

    let hits: RagHit[] = [];

    // 1. Semantic search from Postgres-stored embeddings
    const chunks = await prisma.knowledgeChunk.findMany({
      where: {
        userId,
        ...(symbol ? { symbol: symbol.toUpperCase() } : {})
      },
      take: 500
    });

    if (chunks.length && (await MlClientService.checkHealth())) {
      try {
        const [queryEmb] = await MlClientService.embedTexts([query]);
        const withEmb = chunks
          .filter((c: { embedding: unknown }) => Array.isArray(c.embedding) && (c.embedding as number[]).length > 0)
          .map((c: { text: string; embedding: unknown; documentId: string; symbol: string | null }) => ({
            text: c.text,
            embedding: c.embedding as number[],
            metadata: { documentId: c.documentId, symbol: c.symbol }
          }));

        const ranked = topKBySimilarity(queryEmb, withEmb, topK);
        hits = ranked.map(r => ({
          text: (r as typeof withEmb[0] & { score: number }).text,
          score: r.score,
          metadata: (r as typeof withEmb[0] & { score: number }).metadata,
          method: 'semantic-pg'
        }));
      } catch (err) {
        logger.warn('Semantic PG search failed', err);
      }
    }

    // 2. Hybrid in-memory index via ML service
    if (hits.length < topK && (await MlClientService.checkHealth())) {
      const mlHits = await MlClientService.ragQuery(userId, query, topK, symbol, 'hybrid');
      for (const h of mlHits) {
        if (!hits.some(x => x.text === h.text)) hits.push(h);
      }
      hits = hits.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    const result = {
      hits,
      context: hits.map(h => h.text).join('\n\n'),
      mode: (hits[0]?.method || 'none') as string
    };

    await CacheService.set(cacheKey, result, 600);
    return result;
  }

  static async seedDefaults(userId: string) {
    const count = await prisma.knowledgeDocument.count({ where: { userId } });
    if (count > 0) return;

    const defaults = [
      {
        title: 'NIFTY Banking Sector Outlook',
        content:
          'Indian banking sector shows resilient credit growth. PSU banks benefit from government capex. ' +
          'Monitor RBI policy and NPA trends. SBIN and HDFCBANK remain core holdings for diversified portfolios.',
        docType: 'research',
        symbol: 'SBIN',
        tags: ['banking', 'nifty']
      },
      {
        title: 'IT Sector Risk Factors',
        content:
          'Technology sector faces headwinds from USD strength and client spending cuts. ' +
          'Mean reversion strategies may work after sharp drawdowns. TCS and INFY offer defensive quality.',
        docType: 'research',
        symbol: 'TCS',
        tags: ['it', 'risk']
      },
      {
        title: 'Portfolio Rebalancing Guidelines',
        content:
          'Rebalance when sector allocation drifts more than 5% from target. ' +
          'Trim overweight momentum names after 20%+ quarterly gains. Increase allocation to underweight defensive sectors.',
        docType: 'strategy',
        tags: ['rebalancing', 'risk']
      },
      {
        title: 'LoRA Fine-tuning Best Practices',
        content:
          'Use QLoRA with 4-bit quantization for 7B models on single GPU. ' +
          'Rank 8-16 LoRA adapters work well for domain-specific financial Q&A. ' +
          'Combine RAG retrieval with fine-tuned adapters for best advisor accuracy.',
        docType: 'strategy',
        tags: ['llm', 'lora', 'qlora']
      }
    ];

    for (const d of defaults) {
      await this.createDocument(userId, d);
    }
  }
}

export interface RagHit {
  text: string;
  score: number;
  metadata: Record<string, unknown>;
  method?: string;
}
