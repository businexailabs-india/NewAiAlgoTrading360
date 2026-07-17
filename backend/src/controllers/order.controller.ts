import { Request, Response } from 'express';
import { OrderExecutionService } from '../services/order-execution.service';
import { OrderReconcilerService } from '../services/order-reconciler.service';
import { asyncHandler } from '../middleware/error.middleware';

export const placeOrder = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const body = req.body || {};
  const order = await OrderExecutionService.placeOrder({
    userId,
    symbol: body.symbol,
    exchange: body.exchange,
    tradeType: body.tradeType,
    quantity: Number(body.quantity),
    orderType: body.orderType,
    product: body.product,
    price: body.price != null ? Number(body.price) : undefined,
    triggerPrice: body.triggerPrice != null ? Number(body.triggerPrice) : undefined,
    instrumentType: body.instrumentType,
    optionDetails: body.optionDetails,
    isPaper: body.isPaper !== false,
    brokerConnectionId: body.brokerConnectionId,
    agentId: body.agentId,
    idempotencyKey: body.idempotencyKey,
    source: body.source || 'MANUAL'
  });
  res.status(201).json({ success: true, message: 'Order placed', data: order });
});

export const reconcileOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await OrderReconcilerService.reconcileOrder(req.user!.id, req.params.id);
  res.json({ success: true, data: order });
});

export const getOrders = asyncHandler(async (req: Request, res: Response) => {
  const orders = await OrderExecutionService.getOrders(req.user!.id, {
    isPaper: req.query.isPaper === 'true' ? true : req.query.isPaper === 'false' ? false : undefined,
    status: req.query.status as string
  });
  res.json({ success: true, data: orders });
});

export const getOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await OrderExecutionService.getOrderById(req.user!.id, req.params.id);
  res.json({ success: true, data: order });
});

export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await OrderExecutionService.cancelOrder(req.user!.id, req.params.id);
  res.json({ success: true, message: 'Order cancelled', data: order });
});
