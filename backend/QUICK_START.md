# 🚀 Quick Start Guide

## Setup in 3 Steps (2 Minutes)

### Step 1: Run Setup Script
```powershell
cd backend
.\setup-env.ps1
```

This will:
- ✅ Create `.env` file with your Supabase credentials
- ✅ Install all dependencies
- ✅ Configure everything automatically

### Step 2: Start Development Server
```bash
npm run dev
```

Server starts on `http://localhost:3001` 🎉

### Step 3: Test API
```bash
# Health check
curl http://localhost:3001/health

# Market status
curl http://localhost:3001/api/market/status

# Market indices
curl http://localhost:3001/api/market/indices
```

## ✅ Your Supabase is Configured

Your backend is already connected to:
- **Project**: dfzrjfrplludgnycfqbj
- **Region**: AWS AP South 1 (Mumbai)
- **Database**: PostgreSQL (ready to use)

## 📊 Create Database Tables

Go to your Supabase project:
1. Open SQL Editor: https://supabase.com/dashboard/project/dfzrjfrplludgnycfqbj/sql
2. Copy SQL from `SUPABASE_SETUP.md` (lines 35-130)
3. Click "Run" to create all tables

## 🧪 Test Authentication

### Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "name": "Test User"
  }'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

Copy the `accessToken` from response.

### Get Profile
```bash
curl http://localhost:3001/api/auth/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 📡 Available Endpoints

### Public (No Auth Required)
- `GET /health` - Health check
- `GET /api/market/status` - Market open/closed
- `GET /api/market/indices` - NIFTY, SENSEX data
- `GET /api/market/search?query=RELIANCE` - Search stocks

### Authentication
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/profile` - Get profile (auth required)

### Portfolio (Auth Required)
- `GET /api/portfolio/summary` - Portfolio summary
- `GET /api/portfolio/holdings` - All holdings
- `POST /api/portfolio/holdings` - Add holding
- `GET /api/portfolio/trades` - Trade history

### Broker (Auth Required)
- `GET /api/broker/login-url/zerodha` - Get Zerodha login URL
- `GET /api/broker/connections` - Your broker connections
- `POST /api/broker/sync/:brokerId` - Sync holdings

### Market Data
- `GET /api/market/quote/RELIANCE` - Get stock quote
- `POST /api/market/quotes` - Get multiple quotes
- `GET /api/market/historical/RELIANCE` - Historical data

## 🔐 Add Broker API Keys (Optional)

Edit `.env` file and add your broker credentials:

```bash
# Zerodha
ZERODHA_API_KEY=your_actual_api_key
ZERODHA_API_SECRET=your_actual_secret

# Upstox
UPSTOX_API_KEY=your_actual_api_key
UPSTOX_API_SECRET=your_actual_secret
```

Get API keys from:
- Zerodha: https://kite.trade/
- Upstox: https://upstox.com/developer/

## 📱 Connect Frontend

Update your frontend `.env`:
```bash
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://dfzrjfrplludgnycfqbj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🐛 Troubleshooting

### Port 3001 already in use
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Change port in .env
PORT=3002
```

### Dependencies not installed
```bash
cd backend
npm install
```

### Database connection error
Check your Supabase project is active:
https://supabase.com/dashboard/project/dfzrjfrplludgnycfqbj

## 📚 Documentation

- **SUPABASE_SETUP.md** - Database setup & SQL scripts
- **README.md** - Complete API documentation
- **IMPLEMENTATION_STATUS.md** - Implementation checklist

## 🎯 What's Working

✅ **Authentication** - Register, login, JWT tokens  
✅ **Database** - Supabase PostgreSQL  
✅ **Market Data** - Live quotes, indices  
✅ **Portfolio** - CRUD operations  
✅ **Broker** - Zerodha/Upstox integration ready  
✅ **Security** - Encryption, validation, rate limiting  
✅ **Real-time** - WebSocket subscriptions  

## 🚀 Deploy to Production

### Option 1: Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login & deploy
railway login
railway up
```

### Option 2: Render
1. Connect GitHub repo
2. Add environment variables
3. Deploy automatically

### Option 3: Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

## 💡 Tips

- Use Postman for API testing
- Check logs in `backend/logs/`
- Monitor Supabase dashboard for database activity
- Enable Row Level Security in Supabase for production

## 🎉 You're Ready!

Your backend is fully configured and ready to use. Just run:
```bash
npm run dev
```

**Happy coding!** 🚀
