# Backend Requirements & Architecture

## 🎯 Overview

Your SmartTrade Portfolio Optimizer currently runs entirely in the browser with mock data. To make it production-ready with real broker integration, you need a backend server.

## 🚨 Critical Backend Requirements

### 1. **Security & Authentication**
- User registration and login
- JWT token management
- Password hashing (bcrypt)
- Session management
- API key encryption
- OAuth2 for broker connections

### 2. **Broker API Integration**
- Zerodha Kite Connect API
- Upstox API
- AngelOne API
- Token generation and refresh
- Secure credential storage
- API rate limiting

### 3. **Database**
- User profiles and settings
- Portfolio holdings
- Trade history
- Strategy configurations
- Market data cache
- Audit logs

### 4. **Real-time Data**
- WebSocket server for live prices
- Market data streaming
- Order updates
- Portfolio value updates

### 5. **Business Logic**
- Portfolio calculations
- P&L computation
- Tax calculations
- Strategy backtesting
- Risk analysis
- Rebalancing algorithms

## 🏗️ Recommended Tech Stack

### **Option 1: Node.js/Express (Recommended)**
```
Backend: Node.js + Express
Database: PostgreSQL + Redis
Real-time: Socket.io
Auth: JWT + Passport.js
ORM: Prisma or TypeORM
```

**Pros:**
- Same language as frontend (TypeScript)
- Large ecosystem
- Easy WebSocket integration
- Fast development

### **Option 2: Python/FastAPI**
```
Backend: Python + FastAPI
Database: PostgreSQL + Redis
Real-time: WebSockets
Auth: JWT + OAuth2
ORM: SQLAlchemy
```

**Pros:**
- Excellent for data science/ML
- Great for backtesting algorithms
- Strong financial libraries (pandas, numpy)
- Native async support

### **Option 3: Go**
```
Backend: Go + Gin/Fiber
Database: PostgreSQL + Redis
Real-time: Gorilla WebSocket
Auth: JWT
ORM: GORM
```

**Pros:**
- Extremely fast
- Low memory footprint
- Great for high-frequency trading
- Built-in concurrency

## 📦 Backend Services Needed

### **1. Authentication Service**
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/profile
PUT    /api/auth/profile
```

### **2. Broker Integration Service**
```
GET    /api/broker/login-url/:broker
POST   /api/broker/callback
GET    /api/broker/profile
GET    /api/broker/holdings
GET    /api/broker/positions
POST   /api/broker/order
GET    /api/broker/orders
DELETE /api/broker/disconnect
```

### **3. Portfolio Service**
```
GET    /api/portfolio/summary
GET    /api/portfolio/holdings
GET    /api/portfolio/positions
GET    /api/portfolio/history
POST   /api/portfolio/rebalance
GET    /api/portfolio/analytics
```

### **4. Market Data Service**
```
GET    /api/market/quote/:symbol
GET    /api/market/quotes (batch)
GET    /api/market/historical/:symbol
GET    /api/market/indices
WS     /ws/market/live
```

### **5. Strategy Service**
```
GET    /api/strategies
GET    /api/strategies/:id
POST   /api/strategies
PUT    /api/strategies/:id
DELETE /api/strategies/:id
POST   /api/strategies/:id/backtest
POST   /api/strategies/:id/deploy
```

### **6. Tax Service**
```
GET    /api/tax/summary
GET    /api/tax/report/:year
GET    /api/tax/transactions
POST   /api/tax/export
```

### **7. Admin Service**
```
GET    /api/admin/users
GET    /api/admin/stats
GET    /api/admin/system-health
GET    /api/admin/api-usage
POST   /api/admin/users/:id/suspend
```

## 🗄️ Database Schema

### **Users Table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  role VARCHAR(50) DEFAULT 'user'
);
```

### **Broker Connections Table**
```sql
CREATE TABLE broker_connections (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  broker VARCHAR(50) NOT NULL,
  api_key_encrypted TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Holdings Table**
```sql
CREATE TABLE holdings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  broker_connection_id UUID REFERENCES broker_connections(id),
  symbol VARCHAR(50) NOT NULL,
  exchange VARCHAR(20),
  quantity INTEGER,
  average_price DECIMAL(10,2),
  last_price DECIMAL(10,2),
  pnl DECIMAL(10,2),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### **Trades Table**
```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  broker_connection_id UUID REFERENCES broker_connections(id),
  order_id VARCHAR(100),
  symbol VARCHAR(50) NOT NULL,
  exchange VARCHAR(20),
  trade_type VARCHAR(10), -- BUY/SELL
  quantity INTEGER,
  price DECIMAL(10,2),
  order_type VARCHAR(20), -- MARKET/LIMIT/SL
  status VARCHAR(20),
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### **Settings Table**
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  settings JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔐 Security Implementation

### **1. Environment Variables (.env)**
```bash
# Server
NODE_ENV=production
PORT=3001
API_URL=https://api.yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/smarttrade
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_SECRET=another-secret-key

# Encryption
ENCRYPTION_KEY=32-byte-encryption-key

# Zerodha
ZERODHA_API_KEY=your_zerodha_api_key
ZERODHA_API_SECRET=your_zerodha_api_secret

# Upstox
UPSTOX_API_KEY=your_upstox_api_key
UPSTOX_API_SECRET=your_upstox_api_secret

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### **2. API Key Encryption**
```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY),
    iv
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

## 🚀 Deployment Options

### **Option 1: Cloud Platforms**
- **Vercel/Netlify**: Frontend
- **Railway/Render**: Backend + Database
- **Upstash**: Redis
- **Supabase**: Database + Auth

### **Option 2: Traditional Hosting**
- **DigitalOcean Droplet**: Full stack
- **AWS EC2**: Scalable
- **Google Cloud Run**: Serverless
- **Heroku**: Easy deployment

### **Option 3: Containerized**
- **Docker**: Container
- **Kubernetes**: Orchestration
- **Docker Compose**: Local dev

## 📊 Cost Estimates

### **Minimal Setup (Hobby)**
```
Frontend (Vercel): Free
Backend (Render): $7/month
Database (Supabase): Free tier
Redis (Upstash): Free tier
Domain: $12/year
---
Total: ~$10/month
```

### **Production Setup**
```
Frontend (Vercel Pro): $20/month
Backend (Railway): $20/month
Database (Supabase Pro): $25/month
Redis (Upstash): $10/month
Domain + SSL: $12/year
CDN (Cloudflare): Free
---
Total: ~$75/month
```

### **Enterprise Setup**
```
Frontend (Vercel Enterprise): $150/month
Backend (AWS ECS): $100/month
Database (AWS RDS): $150/month
Redis (AWS ElastiCache): $50/month
Load Balancer: $20/month
Monitoring (DataDog): $50/month
---
Total: ~$520/month
```

## 🔄 Development Workflow

### **1. Local Development**
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### **2. Environment Setup**
```bash
# Install PostgreSQL
brew install postgresql  # Mac
sudo apt install postgresql  # Linux

# Install Redis
brew install redis  # Mac
sudo apt install redis  # Linux

# Start services
brew services start postgresql
brew services start redis
```

### **3. Database Migration**
```bash
# Using Prisma
npx prisma migrate dev
npx prisma generate
npx prisma studio  # GUI
```

## 📝 Next Steps

1. **Choose Tech Stack** (Recommended: Node.js + Express)
2. **Set up Database** (PostgreSQL + Redis)
3. **Implement Authentication** (JWT)
4. **Integrate Broker APIs** (Zerodha/Upstox)
5. **Create API Endpoints**
6. **Add WebSocket Support**
7. **Deploy Backend**
8. **Connect Frontend**
9. **Test End-to-End**
10. **Go Live!**

## 🎯 Quick Start Options

### **Option A: Use Existing Backend Template**
I can create a complete Node.js/Express backend for you with:
- All API endpoints
- Database schema
- Authentication
- Broker integration
- WebSocket support
- Docker setup

### **Option B: Use Backend-as-a-Service**
- **Supabase**: Database + Auth + Real-time
- **Firebase**: All-in-one solution
- **Appwrite**: Open-source BaaS
- **AWS Amplify**: AWS ecosystem

### **Option C: Serverless**
- **Vercel Functions**: API routes
- **AWS Lambda**: Serverless functions
- **Cloudflare Workers**: Edge computing

## 🤔 Recommendation

**For SmartTrade Portfolio Optimizer, I recommend:**

1. **Backend**: Node.js + Express + TypeScript
2. **Database**: Supabase (PostgreSQL + Auth + Real-time)
3. **Caching**: Upstash Redis (free tier)
4. **Deployment**: Railway or Render
5. **Frontend**: Keep on Vercel

**Why?**
- Same language stack (TypeScript)
- Fast development
- Cost-effective
- Easy to scale
- Great developer experience

Would you like me to create the complete backend code for you?
