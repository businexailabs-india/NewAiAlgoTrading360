import { prisma } from '../config/database';
import { ExecutionTargetResolver } from './execution-target.resolver';
import { logger } from '../utils/logger';

const STATUS_MAP: Record<string, string> = {
  TRANSIT: 'PENDING',
  PENDING: 'PENDING',
  OPEN: 'OPEN',
  TRIGGER_PENDING: 'OPEN',
  PART_TRADED: 'PARTIAL',
  TRADED: 'COMPLETE',
  COMPLETE: 'COMPLETE',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  CANCELED: 'CANCELLED',
  EXPIRED: 'REJECTED'
};

export class OrderReconcilerService {
  static normalizeStatus(brokerStatus?: string | null): string {
    if (!brokerStatus) return 'PENDING';
    return STATUS_MAP[brokerStatus.toUpperCase()] || brokerStatus.toUpperCase();
  }

  static async reconcileOrder(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) return null;
    if (order.isPaper) return order;
    if (!order.brokerOrderId || !order.brokerConnectionId) return order;

    try {
      const target = await ExecutionTargetResolver.resolve(userId, {
        brokerConnectionId: order.brokerConnectionId,
        requireLive: true
      });

      let raw: unknown;
      if (target.mcp) {
        raw = await target.mcp.getOrder(order.brokerOrderId);
      } else if (target.direct) {
        raw = await target.direct.getOrder(order.brokerOrderId);
      } else {
        return order;
      }

      const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
      const brokerStatus = String(obj.orderStatus || obj.status || '');
      const status = this.normalizeStatus(brokerStatus);
      const avgPrice = Number(obj.averageTradedPrice || obj.averagePrice || obj.price || order.price || 0);

      const updated = await prisma.order.update({
        where: { id: order.id },
        data: {
          status,
          ...(avgPrice ? { price: avgPrice } : {}),
          ...(status === 'COMPLETE' ? { executedAt: new Date() } : {}),
          ...(status === 'REJECTED' ? { rejectionReason: String(obj.rejectionReason || obj.message || 'Rejected') } : {})
        }
      });

      await prisma.executionAttempt.updateMany({
        where: { orderId: order.id, userId },
        data: {
          brokerStatus: status,
          responseRedacted: { status, brokerOrderId: order.brokerOrderId },
          reconciledAt: new Date()
        }
      });

      return updated;
    } catch (err) {
      logger.warn(`Reconcile failed for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`);
      return order;
    }
  }

  static async reconcileOpenOrders(userId: string) {
    const open = await prisma.order.findMany({
      where: {
        userId,
        isPaper: false,
        status: { in: ['PENDING', 'OPEN', 'PARTIAL', 'TRANSIT'] },
        brokerOrderId: { not: null }
      },
      take: 50
    });
    const results = [];
    for (const o of open) {
      results.push(await this.reconcileOrder(userId, o.id));
    }
    return results;
  }
}
