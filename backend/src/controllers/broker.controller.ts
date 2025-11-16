import { Request, Response } from 'express';
import { SupabaseService } from '../services/supabase.service';
import { EncryptionService } from '../services/encryption.service';
import { asyncHandler } from '../middleware/error.middleware';
import { AppError } from '../middleware/error.middleware';
import axios from 'axios';

export const getLoginUrl = asyncHandler(async (req: Request, res: Response) => {
  const { broker } = req.params;

  let loginUrl = '';

  switch (broker.toLowerCase()) {
    case 'zerodha':
      loginUrl = `https://kite.zerodha.com/connect/login?api_key=${process.env.ZERODHA_API_KEY}`;
      break;
    case 'upstox':
      loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.UPSTOX_API_KEY}&redirect_uri=${process.env.UPSTOX_REDIRECT_URL}&response_type=code`;
      break;
    case 'angelone':
      loginUrl = `https://smartapi.angelbroking.com/publisher-login?api_key=${process.env.ANGELONE_API_KEY}`;
      break;
    default:
      throw new AppError('Unsupported broker', 400);
  }

  res.status(200).json({
    success: true,
    data: { loginUrl }
  });
});

export const handleCallback = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { broker, request_token, code } = req.query;

  if (!broker) {
    throw new AppError('Broker parameter is required', 400);
  }

  let accessToken = '';
  let refreshToken = '';

  // Handle different broker callbacks
  switch ((broker as string).toLowerCase()) {
    case 'zerodha':
      if (!request_token) {
        throw new AppError('Request token is required', 400);
      }
      // Generate session with Zerodha
      const zerodhaResponse = await axios.post('https://api.kite.trade/session/token', {
        api_key: process.env.ZERODHA_API_KEY,
        request_token,
        checksum: '' // Generate proper checksum
      });
      accessToken = zerodhaResponse.data.access_token;
      break;

    case 'upstox':
      if (!code) {
        throw new AppError('Authorization code is required', 400);
      }
      // Exchange code for token
      const upstoxResponse = await axios.post('https://api.upstox.com/v2/login/authorization/token', {
        code,
        client_id: process.env.UPSTOX_API_KEY,
        client_secret: process.env.UPSTOX_API_SECRET,
        redirect_uri: process.env.UPSTOX_REDIRECT_URL,
        grant_type: 'authorization_code'
      });
      accessToken = upstoxResponse.data.access_token;
      refreshToken = upstoxResponse.data.refresh_token;
      break;

    default:
      throw new AppError('Unsupported broker', 400);
  }

  // Encrypt tokens
  const encryptedAccessToken = EncryptionService.encrypt(accessToken);
  const encryptedRefreshToken = refreshToken ? EncryptionService.encrypt(refreshToken) : null;

  // Save to database
  const connection = await SupabaseService.createBrokerConnection({
    user_id: userId,
    broker: broker as string,
    access_token_encrypted: encryptedAccessToken,
    refresh_token_encrypted: encryptedRefreshToken,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
  });

  res.status(200).json({
    success: true,
    message: 'Broker connected successfully',
    data: connection
  });
});

export const getBrokerConnections = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const connections = await SupabaseService.getBrokerConnections(userId);

  // Don't send encrypted tokens to client
  const sanitizedConnections = connections.map(conn => ({
    id: conn.id,
    broker: conn.broker,
    is_active: conn.is_active,
    created_at: conn.created_at
  }));

  res.status(200).json({
    success: true,
    data: sanitizedConnections
  });
});

export const disconnectBroker = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  await SupabaseService.updateBrokerConnection(id, { is_active: false });

  res.status(200).json({
    success: true,
    message: 'Broker disconnected successfully'
  });
});

export const syncHoldings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { brokerId } = req.params;

  // Get broker connection
  const connections = await SupabaseService.getBrokerConnections(userId);
  const connection = connections.find(c => c.id === brokerId);

  if (!connection) {
    throw new AppError('Broker connection not found', 404);
  }

  // Decrypt access token
  const accessToken = EncryptionService.decrypt(connection.access_token_encrypted!);

  // Fetch holdings from broker API
  let holdings = [];
  switch (connection.broker.toLowerCase()) {
    case 'zerodha':
      const zerodhaHoldings = await axios.get('https://api.kite.trade/portfolio/holdings', {
        headers: {
          'Authorization': `token ${process.env.ZERODHA_API_KEY}:${accessToken}`
        }
      });
      holdings = zerodhaHoldings.data.data;
      break;

    case 'upstox':
      const upstoxHoldings = await axios.get('https://api.upstox.com/v2/portfolio/long-term-holdings', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      holdings = upstoxHoldings.data.data;
      break;
  }

  // Save holdings to database
  for (const holding of holdings) {
    await SupabaseService.createHolding({
      user_id: userId,
      broker_connection_id: brokerId,
      symbol: holding.tradingsymbol || holding.symbol,
      exchange: holding.exchange,
      quantity: holding.quantity,
      average_price: holding.average_price,
      last_price: holding.last_price,
      pnl: holding.pnl,
      pnl_percentage: holding.pnl ? (holding.pnl / (holding.quantity * holding.average_price)) * 100 : 0,
      current_value: holding.quantity * holding.last_price,
      invested_value: holding.quantity * holding.average_price,
      product: holding.product || 'CNC'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Holdings synced successfully',
    data: { count: holdings.length }
  });
});
