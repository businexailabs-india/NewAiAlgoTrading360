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
import { startAgentScheduler } from './services/agent-scheduler.service';
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

// Initialize Express app
const app: Application = express();
const httpServer = createServer(app);

// Trust proxy - required for Cloud Run and rate limiting
app.set('trust proxy', true);

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression()); // Compress responses
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } })); // Logging

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

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

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Subscribe to market data
  socket.on('subscribe', (symbols: string[]) => {
    logger.info(`Client ${socket.id} subscribed to: ${symbols.join(', ')}`);
    socket.join(symbols);
  });

  // Unsubscribe from market data
  socket.on('unsubscribe', (symbols: string[]) => {
    logger.info(`Client ${socket.id} unsubscribed from: ${symbols.join(', ')}`);
    symbols.forEach(symbol => socket.leave(symbol));
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

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
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, io };
