import { Request, Response } from 'express';
import { BrokerService } from '../services/broker.service';
import { DatabaseService } from '../services/database.service';
import { EncryptionService } from '../services/encryption.service';
import { asyncHandler } from '../middleware/error.middleware';
import { AppError } from '../middleware/error.middleware';

export const getLoginUrl = asyncHandler(async (req: Request, res: Response) => {
  const loginUrl = BrokerService.getLoginUrl(req.params.broker);
  res.status(200).json({ success: true, data: { loginUrl } });
});

export const handleCallback = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const broker = (req.query.broker || req.params.broker) as string;
  if (!broker) throw new AppError('Broker parameter is required', 400);

  const tokens = await BrokerService.exchangeToken(broker, {
    requestToken: req.query.request_token as string,
    code: req.query.code as string
  });

  const connection = await DatabaseService.createBrokerConnection({
    userId,
    broker,
    accessTokenEncrypted: EncryptionService.encrypt(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken
      ? EncryptionService.encrypt(tokens.refreshToken)
      : null,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  res.status(200).json({
    success: true,
    message: 'Broker connected successfully',
    data: { id: connection.id, broker: connection.broker, isActive: connection.isActive }
  });
});

export const getBrokerConnections = asyncHandler(async (req: Request, res: Response) => {
  const connections = await DatabaseService.getBrokerConnections(req.user!.id);
  res.status(200).json({
    success: true,
    data: connections.map(c => ({
      id: c.id,
      broker: c.broker,
      isActive: c.isActive,
      createdAt: c.createdAt
    }))
  });
});

export const disconnectBroker = asyncHandler(async (req: Request, res: Response) => {
  await DatabaseService.updateBrokerConnection(req.params.id, { isActive: false });
  res.status(200).json({ success: true, message: 'Broker disconnected successfully' });
});

export const syncHoldings = asyncHandler(async (req: Request, res: Response) => {
  const result = await BrokerService.syncHoldings(req.user!.id, req.params.brokerId);
  res.status(200).json({
    success: true,
    message: 'Holdings synced successfully',
    data: result
  });
});
