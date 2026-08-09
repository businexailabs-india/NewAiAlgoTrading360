import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

// Import services and logger before use
import { initializeQuantConnect } from './services/quantconnect.service';
import { startAgentScheduler, stopAgentScheduler } from './services/agent-scheduler.service';
import { startMarketStream } from './services/market-stream.service';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

// Initialize QuantConnect if credentials are available
if (process.env.QC_USER_ID && process.env.QC_API_TOKEN) {
  initializeQuantConnect({
    userId: process.env.QC_USER_ID,
    apiToken: process.env.QC_API_TOKEN,
    baseUrl: process.env.QC_BASE_URL
  });
  logger.info('QuantConnect service initialized');
} else {
  logger.warn('QuantConnect credentials not set - QC endpoints will fail until configured');
}

// Import routes
import authRoutes from './routes/auth.routes';
import brokerRoutes from './routes/broker.routes';
import portfolioRoutes from './routes/portfolio.routes';
import marketRoutes from './routes/market.routes';
import strategyRoutes from './routes/strategy.routes';
import taxRoutes from './routes/tax.routes';
import adminRoutes from './routes/admin.routes';
import quantconnectRoutes from './routes/quantconnect.routes';
import predictionRoutes from './routes/prediction.routes';
import orderRoutes from './routes/order.routes';
import agentRoutes from './routes/agent.routes';
import screenerRoutes from './routes/screener.routes';
import optionsRoutes from './routes/options.routes';
import dataRoutes from './routes/data.routes';
import advisorRoutes from './routes/advisor.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import llmRoutes from './routes/llm.routes';
import integrationRoutes from './routes/integration.routes';
import advisoryMarketplaceRoutes from './routes/advisory-marketplace.routes';
import mcpProvidersRoutes from './routes/mcp-providers.routes';
import dhanlaxmiRoutes from './routes/dhanlaxmi.routes';
import watchlistRoutes from './routes/watchlist.routes';
import modeRoutes from './routes/mode.routes';
import paperRoutes from './routes/paper.routes';
import riskRoutes from './routes/risk.routes';
import riskJourneyRoutes from './routes/risk-journey.routes';
import tradingviewRoutes from './routes/tradingview.routes';
import tradingTerminalRoutes from './routes/trading-terminal.routes';
import executionGovernanceRoutes from './routes/execution-governance.routes';
import liveRoutes from './routes/live.routes';
import marketAnalyticsV1Routes from './market-analytics/routes/v1.routes';
import { RiskGateService } from './services/risk-gate.service';
import { OutboxService } from './events/outbox.service';
import { getMaEngine } from './market-analytics/engine';

// Initialize Express app
const app: Application = express();
const httpServer = createServer(app);

// Trust proxy - required for Cloud Run and rate limiting
// Only trust proxy in production (ALB); local rate-limit breaks with trust proxy=true
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (origin, callback) => {
      const allowed = [
        process.env.FRONTEND_URL,
        process.env.CORS_ORIGIN,
        'http://localhost:3000',
        'https://smarttrade-portfolio.vercel.app'
      ].filter(Boolean) as string[];
      if (!origin || allowed.includes(origin) || /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.CORS_ORIGIN,
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://smarttrade-portfolio.vercel.app'
    ].filter(Boolean) as string[];

    if (!origin) return callback(null, true);
    if (allowed.includes(origin)) return callback(null, true);
    if (/^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) return callback(null, true);

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(compression()); // Compress responses
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } })); // Logging

// Rate limiting — disabled in development (dashboard/watchlist poll heavily and hit 429 otherwise)
const isDev = (process.env.NODE_ENV || 'development') !== 'production';
if (!isDev || process.env.RATE_LIMIT_DISABLE_IN_DEV === 'false') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '2000'),
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false },
  });
  app.use('/api/', limiter);
  logger.info('API rate limiter enabled (max=%s)', process.env.RATE_LIMIT_MAX_REQUESTS || '2000');
} else {
  logger.info('API rate limiter DISABLED (development)');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/strategy', strategyRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/quantconnect', quantconnectRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/screener', screenerRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/advisor', advisorRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api', advisoryMarketplaceRoutes);
app.use('/api', mcpProvidersRoutes);
app.use('/api', dhanlaxmiRoutes);
app.use('/api', watchlistRoutes);
app.use('/api', modeRoutes);
app.use('/api/paper', paperRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api', riskJourneyRoutes);
app.use('/api', tradingviewRoutes);
app.use('/api', tradingTerminalRoutes);
app.use('/api', executionGovernanceRoutes);
app.use('/api/live', liveRoutes);
// BxAi Trade Market Analytics — paper-only (/api/v1/*)
app.use('/api/v1', marketAnalyticsV1Routes);
try {
  getMaEngine();
  logger.info('Market Analytics engine ready (paper-only; TRADING_MODE=%s)', process.env.TRADING_MODE || 'signal');
} catch (e) {
  logger.warn('Market Analytics engine init deferred: %s', e instanceof Error ? e.message : e);
}

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Subscribe to market data
  socket.on('subscribe', (channels: string[]) => {
    const list = Array.isArray(channels) ? channels : [channels];
    logger.info(`Client ${socket.id} subscribed to: ${list.join(', ')}`);
    list.forEach(ch => socket.join(ch));
  });

  socket.on('unsubscribe', (channels: string[]) => {
    const list = Array.isArray(channels) ? channels : [channels];
    list.forEach(ch => socket.leave(ch));
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Poll MCP provider health and broadcast on channel mcp.connection.health.changed
const MCP_HEALTH_POLL_MS = Number(process.env.MCP_HEALTH_POLL_MS || 15000);
setInterval(() => {
  void (async () => {
    try {
      const { McpConnectorProxyService } = await import('./services/mcp-connector-proxy.service');
      const systemUser = process.env.MCP_HEALTH_SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000001';
      const health = await McpConnectorProxyService.proxy(systemUser, 'admin', '/admin/mcp/provider-health', {
        asAdmin: true
      });
      io.to('mcp.connection.health.changed').emit('mcp.connection.health.changed', {
        at: new Date().toISOString(),
        data: health
      });
    } catch {
      // MCP connector may be offline in local/dev — ignore
    }
  })();
}, MCP_HEALTH_POLL_MS);

// Option-chain quote poll → Delayed badge feed for subscribers (options:NIFTY, …)
const OPTIONS_QUOTE_POLL_MS = Number(process.env.OPTIONS_QUOTE_POLL_MS || 12000);
setInterval(() => {
  void (async () => {
    try {
      const { OptionsChainService } = await import('./services/options/options-chain.service');
      const underlyings = ['NIFTY', 'BANKNIFTY'];
      for (const u of underlyings) {
        const room = `options:${u}`;
        const sockets = await io.in(room).fetchSockets();
        if (!sockets.length) continue;
        const chain = await OptionsChainService.getAnalytics(u, undefined);
        io.to(room).emit('options.chain.update', {
          underlying: u,
          at: new Date().toISOString(),
          quoteFreshness: 'delayed',
          data: chain
        });
      }
    } catch {
      /* ignore when master empty / DB down */
    }
  })();
}, OPTIONS_QUOTE_POLL_MS);

// Make io accessible to routes
app.set('io', io);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
  logger.info(`🔗 API URL: ${process.env.API_URL}`);
  logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);

  if (process.env.ENABLE_AGENT_SCHEDULER !== 'false') {
    startAgentScheduler();
  }

  startMarketStream(io);

  RiskGateService.ensureGlobalControl().catch(err => {
    logger.warn(`Trading control seed failed: ${err instanceof Error ? err.message : String(err)}`);
  });

  // Non-blocking outbox dispatcher for login → advisory events
  setInterval((): void => {
    void OutboxService.dispatchPending(25).catch((): undefined => undefined);
  }, Number(process.env.OUTBOX_DISPATCH_INTERVAL_MS || 5000));

  logger.info(`Live trading env gate: LIVE_TRADING_ENABLED=${process.env.LIVE_TRADING_ENABLED === 'true'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  stopAgentScheduler();
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, io };
