# SmartTrade Portfolio Optimizer - Backend API

## 🚀 Complete Production-Ready Backend

This is the backend API server for SmartTrade Portfolio Optimizer with full broker integration, authentication, and real-time data support.

## 📦 What's Included

### ✅ Core Features
- **Authentication & Authorization** (JWT-based)
- **Broker API Integration** (Zerodha, Upstox, AngelOne)
- **Portfolio Management** (Holdings, Positions, P&L)
- **Real-time Market Data** (WebSocket support)
- **Strategy Management** (Backtesting, Deployment)
- **Tax Calculations** (Capital gains, reports)
- **Admin Dashboard** (User management, analytics)
- **Security** (Encryption, rate limiting, CORS)

### 📁 Project Structure
```
backend/
├── src/
│   ├── controllers/      # Request handlers
│   │   ├── auth.controller.ts
│   │   ├── broker.controller.ts
│   │   ├── portfolio.controller.ts
│   │   ├── market.controller.ts
│   │   ├── strategy.controller.ts
│   │   ├── tax.controller.ts
│   │   └── admin.controller.ts
│   ├── routes/          # API routes
│   │   ├── auth.routes.ts
│   │   ├── broker.routes.ts
│   │   ├── portfolio.routes.ts
│   │   ├── market.routes.ts
│   │   ├── strategy.routes.ts
│   │   ├── tax.routes.ts
│   │   └── admin.routes.ts
│   ├── middleware/      # Custom middleware
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   ├── services/        # Business logic
│   │   ├── auth.service.ts
│   │   ├── broker.service.ts
│   │   ├── portfolio.service.ts
│   │   ├── market.service.ts
│   │   └── encryption.service.ts
│   ├── utils/           # Utilities
│   │   ├── logger.ts
│   │   ├── validators.ts
│   │   └── helpers.ts
│   └── server.ts        # Main server file
├── prisma/
│   └── schema.prisma    # Database schema
├── .env.example         # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Redis 6+
- npm or yarn

### Step 1: Install Dependencies
```bash
cd backend
npm install
```

### Step 2: Set up Environment Variables
```bash
cp .env.example .env
# Edit .env with your actual values
```

### Step 3: Set up Database
```bash
# Start PostgreSQL (if not running)
# Mac: brew services start postgresql
# Linux: sudo systemctl start postgresql

# Run Prisma migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate
```

### Step 4: Start Redis
```bash
# Mac: brew services start redis
# Linux: sudo systemctl start redis
# Windows: Download from https://redis.io/download
```

### Step 5: Start Development Server
```bash
npm run dev
```

Server will start on `http://localhost:3001`

## 🔐 Environment Variables

Create a `.env` file with these variables:

```bash
# Server
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/smarttrade"

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-min-32-characters
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=your-refresh-secret-key

# Encryption (32 bytes)
ENCRYPTION_KEY=your-32-byte-encryption-key-here

# Zerodha
ZERODHA_API_KEY=your_zerodha_api_key
ZERODHA_API_SECRET=your_zerodha_secret
ZERODHA_REDIRECT_URL=http://localhost:3001/api/broker/zerodha/callback

# Upstox
UPSTOX_API_KEY=your_upstox_api_key
UPSTOX_API_SECRET=your_upstox_secret
UPSTOX_REDIRECT_URL=http://localhost:3001/api/broker/upstox/callback
```

## 📡 API Endpoints

### Authentication
```
POST   /api/auth/register      - Register new user
POST   /api/auth/login         - Login user
POST   /api/auth/logout        - Logout user
POST   /api/auth/refresh       - Refresh access token
GET    /api/auth/profile       - Get user profile
PUT    /api/auth/profile       - Update user profile
```

### Broker Integration
```
GET    /api/broker/login-url/:broker        - Get broker login URL
POST   /api/broker/callback                 - Handle OAuth callback
GET    /api/broker/profile                  - Get broker profile
GET    /api/broker/holdings                 - Get holdings
GET    /api/broker/positions                - Get positions
POST   /api/broker/order                    - Place order
GET    /api/broker/orders                   - Get order history
DELETE /api/broker/disconnect/:broker       - Disconnect broker
```

### Portfolio
```
GET    /api/portfolio/summary               - Get portfolio summary
GET    /api/portfolio/holdings              - Get all holdings
GET    /api/portfolio/positions             - Get all positions
GET    /api/portfolio/history               - Get portfolio history
POST   /api/portfolio/rebalance             - Execute rebalancing
GET    /api/portfolio/analytics             - Get analytics
```

### Market Data
```
GET    /api/market/quote/:symbol            - Get single quote
POST   /api/market/quotes                   - Get multiple quotes
GET    /api/market/historical/:symbol       - Get historical data
GET    /api/market/indices                  - Get market indices
WS     /ws/market/live                      - WebSocket for live data
```

### Strategy
```
GET    /api/strategy                        - List all strategies
GET    /api/strategy/:id                    - Get strategy details
POST   /api/strategy                        - Create strategy
PUT    /api/strategy/:id                    - Update strategy
DELETE /api/strategy/:id                    - Delete strategy
POST   /api/strategy/:id/backtest           - Run backtest
POST   /api/strategy/:id/deploy             - Deploy strategy
```

### Tax
```
GET    /api/tax/summary                     - Get tax summary
GET    /api/tax/report/:year                - Get annual report
GET    /api/tax/transactions                - Get taxable transactions
POST   /api/tax/export                      - Export tax report
```

### Admin
```
GET    /api/admin/users                     - List all users
GET    /api/admin/stats                     - Get system stats
GET    /api/admin/system-health             - System health check
GET    /api/admin/api-usage                 - API usage statistics
POST   /api/admin/users/:id/suspend         - Suspend user
```

## 🔌 WebSocket Events

### Client → Server
```javascript
// Subscribe to market data
socket.emit('subscribe', ['RELIANCE', 'TCS', 'INFY']);

// Unsubscribe
socket.emit('unsubscribe', ['RELIANCE']);
```

### Server → Client
```javascript
// Market data updates
socket.on('market-update', (data) => {
  console.log(data); // { symbol, price, change, ... }
});

// Portfolio updates
socket.on('portfolio-update', (data) => {
  console.log(data); // { totalValue, pnl, ... }
});

// Order updates
socket.on('order-update', (data) => {
  console.log(data); // { orderId, status, ... }
});
```

## 🔐 Authentication Flow

### 1. Register/Login
```javascript
// Register
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}

// Response
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "name": "..." },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### 2. Use Access Token
```javascript
// Include in headers
headers: {
  'Authorization': 'Bearer eyJhbGc...'
}
```

### 3. Refresh Token
```javascript
POST /api/auth/refresh
{
  "refreshToken": "eyJhbGc..."
}
```

## 🏦 Broker Integration Flow

### Zerodha Example

#### 1. Get Login URL
```javascript
GET /api/broker/login-url/zerodha

Response:
{
  "loginUrl": "https://kite.zerodha.com/connect/login?api_key=..."
}
```

#### 2. User Logs In
- Redirect user to loginUrl
- User logs in on Zerodha
- Zerodha redirects back with request_token

#### 3. Handle Callback
```javascript
GET /api/broker/callback?request_token=xxx&broker=zerodha

// Backend generates session and stores encrypted tokens
```

#### 4. Fetch Portfolio
```javascript
GET /api/broker/holdings
Authorization: Bearer <access_token>

Response:
{
  "success": true,
  "data": {
    "holdings": [
      {
        "symbol": "RELIANCE",
        "quantity": 100,
        "averagePrice": 2450.50,
        "lastPrice": 2678.90,
        "pnl": 22840,
        "pnlPercentage": 9.32
      }
    ]
  }
}
```

## 🗄️ Database Schema

### Users Table
- id, email, password_hash, name, phone, role, is_active
- created_at, updated_at

### Broker Connections
- id, user_id, broker, api_key_encrypted, access_token_encrypted
- refresh_token_encrypted, expires_at, is_active

### Holdings
- id, user_id, broker_connection_id, symbol, exchange
- quantity, average_price, last_price, pnl, pnl_percentage

### Trades
- id, user_id, broker_connection_id, order_id, symbol
- trade_type, quantity, price, order_type, status

### Portfolios
- id, user_id, name, total_value, invested_value
- current_value, total_pnl, day_pnl

## 🚀 Deployment

### Option 1: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### Option 2: Render
```bash
# Connect GitHub repo
# Add environment variables in dashboard
# Deploy automatically on push
```

### Option 3: Docker
```bash
# Build image
docker build -t smarttrade-backend .

# Run container
docker run -p 3001:3001 --env-file .env smarttrade-backend
```

## 📊 Monitoring & Logging

### Logs
Logs are stored in `logs/app.log` and console

### Health Check
```bash
GET /health

Response:
{
  "status": "ok",
  "timestamp": "2025-01-16T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- auth.test.ts
```

## 📝 Development

### Adding New Endpoint
1. Create controller in `src/controllers/`
2. Create route in `src/routes/`
3. Add route to `src/server.ts`
4. Update this README

### Database Changes
```bash
# Create migration
npx prisma migrate dev --name add_new_field

# Apply migration
npx prisma migrate deploy

# View database
npx prisma studio
```

## 🔒 Security Best Practices

1. **Never commit .env file**
2. **Use strong JWT secrets** (min 32 characters)
3. **Encrypt sensitive data** (API keys, tokens)
4. **Enable rate limiting** (already configured)
5. **Use HTTPS in production**
6. **Validate all inputs**
7. **Sanitize database queries**
8. **Keep dependencies updated**

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
pg_isready

# Check connection string in .env
DATABASE_URL="postgresql://user:pass@localhost:5432/smarttrade"
```

### Redis Connection Error
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG
```

### Port Already in Use
```bash
# Change PORT in .env
PORT=3002
```

## 📚 Additional Resources

- [Zerodha Kite Connect Docs](https://kite.trade/docs/connect/v3/)
- [Upstox API Docs](https://upstox.com/developer/api-documentation/)
- [Prisma Docs](https://www.prisma.io/docs/)
- [Express.js Docs](https://expressjs.com/)
- [Socket.IO Docs](https://socket.io/docs/)

## 🤝 Support

For issues or questions:
- Create an issue on GitHub
- Email: support@businexai.com
- Documentation: [Full API Docs](./API_DOCS.md)

## 📄 License

MIT License - BusineXAi Solutions Lab

---

**Backend is ready! Install dependencies and start coding!** 🚀
