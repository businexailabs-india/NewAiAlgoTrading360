import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { MlClientService } from './ml-client.service';
import { logger } from '../utils/logger';

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
    await prisma.knowledgeDocument.delete({ where: { id: docId } });
    await this.reindexUser(userId);
    return { message: 'Document deleted' };
  }

  static async reindexUser(userId: string): Promise<number> {
    if (!(await MlClientService.checkHealth())) {
      logger.warn('ML service down — RAG index not rebuilt');
      return 0;
    }

    const docs = await prisma.knowledgeDocument.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    const payload = docs.map(d => ({
      text: `${d.title}\n${d.content}`,
      metadata: {
        docId: d.id,
        title: d.title,
        docType: d.docType,
        symbol: d.symbol,
        tags: d.tags
      }
    }));

    return MlClientService.ragIngest(userId, payload);
  }

  static async query(userId: string, query: string, symbol?: string, topK = 5) {
    if (!(await MlClientService.checkHealth())) {
      return { hits: [], context: '' };
    }

    const hits = await MlClientService.ragQuery(userId, query, topK, symbol);
    const context = hits.map(h => h.text).join('\n\n');
    return { hits, context };
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
      }
    ];

    for (const d of defaults) {
      await this.createDocument(userId, d);
    }
  }
}
