# Broker Integration Guide - Connect Your Real Portfolio

## 🎯 Overview

This guide shows you how to connect your **actual Zerodha or Upstox portfolio** to view real holdings, positions, and P&L in the SmartTrade Portfolio Optimizer.

## ⚠️ Current Status

**What's Ready:**
- ✅ Broker service layer created (`src/services/brokerService.ts`)
- ✅ UI components for portfolio display
- ✅ Settings panel with API key management
- ✅ Account management modal

**What's Needed:**
- 🔧 Broker API credentials (API Key, Secret)
- 🔧 Backend server for secure token handling (recommended)
- 🔧 OAuth flow implementation

## 🚀 Quick Start - Zerodha Integration

### Step 1: Get Zerodha API Credentials

1. **Login to Kite Connect Developer Console**
   - Visit: https://developers.kite.trade/
   - Sign up with your Zerodha account

2. **Create an App**
   - Go to "My Apps" → "Create new app"
   - Fill in details:
     - **App name**: SmartTrade Portfolio Optimizer
     - **Redirect URL**: `http://localhost:3000/callback` (for development)
     - **Postback URL**: (optional)

3. **Get Your Credentials**
   - **API Key**: Copy this (e.g., `abc123xyz`)
   - **API Secret**: Copy this (keep it secret!)

### Step 2: Configure the App

Add your credentials to the app:

```typescript
// In your component or settings
import { brokerService } from './services/brokerService';

// Initialize Zerodha connection
await brokerService.connect('zerodha', {
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET'
});
```

### Step 3: Implement Login Flow

```typescript
// 1. Get login URL
const loginUrl = brokerService.getLoginUrl('zerodha');

// 2. Redirect user to Zerodha login
window.location.href = loginUrl;

// 3. After login, Zerodha redirects back with request_token
// Handle callback in your app:
const urlParams = new URLSearchParams(window.location.search);
const requestToken = urlParams.get('request_token');

if (requestToken) {
  // Generate session (this should be done on backend for security)
  await zerodhaService.generateSession(requestToken, 'YOUR_API_SECRET');
  
  // Now you can fetch portfolio
  const portfolio = await brokerService.getPortfolioSummary();
  console.log(portfolio);
}
```

### Step 4: Fetch Your Portfolio

```typescript
// Get complete portfolio summary
const summary = await brokerService.getPortfolioSummary();

console.log('Total Value:', summary.totalValue);
console.log('Total P&L:', summary.totalPnL);
console.log('Holdings:', summary.holdings);
console.log('Positions:', summary.positions);
```

## 🔐 Upstox Integration

### Step 1: Get Upstox API Credentials

1. **Visit Upstox Developer Portal**
   - URL: https://upstox.com/developer/
   - Login with your Upstox account

2. **Create an App**
   - Go to "My Apps" → "Create App"
   - Get your **API Key** and **Secret**

3. **Configure Redirect URI**
   - Set to: `http://localhost:3000/callback`

### Step 2: Connect Upstox

```typescript
import { brokerService } from './services/brokerService';

// Initialize Upstox connection
await brokerService.connect('upstox', {
  apiKey: 'YOUR_UPSTOX_API_KEY',
  accessToken: 'YOUR_ACCESS_TOKEN' // After OAuth
});

// Fetch portfolio
const portfolio = await brokerService.getPortfolioSummary();
```

## 📊 Using Portfolio Data

### Display Holdings

```typescript
const holdings = await brokerService.getHoldings();

holdings.forEach(holding => {
  console.log(`${holding.tradingsymbol}: ${holding.quantity} shares`);
  console.log(`Avg Price: ₹${holding.averagePrice}`);
  console.log(`Current Price: ₹${holding.lastPrice}`);
  console.log(`P&L: ₹${holding.pnl} (${holding.pnlPercentage.toFixed(2)}%)`);
});
```

### Display Positions

```typescript
const positions = await brokerService.getPositions();

positions.forEach(position => {
  console.log(`${position.tradingsymbol}: ${position.quantity} qty`);
  console.log(`P&L: ₹${position.pnl}`);
  console.log(`Type: ${position.overnight ? 'Overnight' : 'Intraday'}`);
});
```

### Get User Profile

```typescript
const profile = await brokerService.getProfile();

console.log('User ID:', profile.userId);
console.log('Name:', profile.userName);
console.log('Email:', profile.email);
console.log('Broker:', profile.broker);
```

## 🔒 Security Best Practices

### ⚠️ NEVER Store Secrets in Frontend

**Bad (Insecure):**
```typescript
// ❌ Don't do this!
const apiSecret = 'your_secret_here'; // Exposed in browser
```

**Good (Secure):**
```typescript
// ✅ Do this instead - use backend
// Backend handles secrets, frontend only gets access token
const response = await fetch('/api/broker/login', {
  method: 'POST',
  body: JSON.stringify({ broker: 'zerodha', requestToken })
});
const { accessToken } = await response.json();
```

### Recommended Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │─────▶│   Backend   │─────▶│   Broker    │
│  (Frontend) │      │   Server    │      │     API     │
└─────────────┘      └─────────────┘      └─────────────┘
     │                      │                     │
     │ 1. Request login     │                     │
     │─────────────────────▶│                     │
     │                      │ 2. Get login URL    │
     │                      │────────────────────▶│
     │                      │ 3. Return URL       │
     │                      │◀────────────────────│
     │ 4. Redirect to URL   │                     │
     │◀─────────────────────│                     │
     │                      │                     │
     │ 5. User logs in      │                     │
     │─────────────────────────────────────────▶│
     │                      │                     │
     │ 6. Callback with token                    │
     │◀──────────────────────────────────────────│
     │                      │                     │
     │ 7. Send token        │                     │
     │─────────────────────▶│                     │
     │                      │ 8. Generate session │
     │                      │────────────────────▶│
     │                      │ 9. Access token     │
     │                      │◀────────────────────│
     │ 10. Return token     │                     │
     │◀─────────────────────│                     │
```

## 🛠️ Backend Implementation (Node.js Example)

### Setup Express Server

```javascript
// server.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const ZERODHA_API_KEY = process.env.ZERODHA_API_KEY;
const ZERODHA_API_SECRET = process.env.ZERODHA_API_SECRET;

// Generate session endpoint
app.post('/api/broker/zerodha/session', async (req, res) => {
  const { requestToken } = req.body;
  
  try {
    // Generate checksum
    const checksum = crypto
      .createHash('sha256')
      .update(ZERODHA_API_KEY + requestToken + ZERODHA_API_SECRET)
      .digest('hex');
    
    // Call Zerodha API
    const response = await axios.post('https://api.kite.trade/session/token', {
      api_key: ZERODHA_API_KEY,
      request_token: requestToken,
      checksum: checksum
    });
    
    // Return access token to frontend
    res.json({
      success: true,
      accessToken: response.data.data.access_token
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Proxy portfolio requests
app.get('/api/broker/zerodha/holdings', async (req, res) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  
  try {
    const response = await axios.get('https://api.kite.trade/portfolio/holdings', {
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${ZERODHA_API_KEY}:${accessToken}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3001, () => {
  console.log('Broker API server running on port 3001');
});
```

### Environment Variables

```bash
# .env
ZERODHA_API_KEY=your_api_key_here
ZERODHA_API_SECRET=your_api_secret_here
UPSTOX_API_KEY=your_upstox_key_here
UPSTOX_API_SECRET=your_upstox_secret_here
```

## 📱 Frontend Integration

### Create a React Hook

```typescript
// src/hooks/useBrokerPortfolio.ts
import { useState, useEffect } from 'react';
import { brokerService, PortfolioSummary } from '../services/brokerService';

export function useBrokerPortfolio(broker: 'zerodha' | 'upstox') {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        setLoading(true);
        const data = await brokerService.getPortfolioSummary();
        setPortfolio(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch portfolio');
      } finally {
        setLoading(false);
      }
    }

    if (brokerService.isConnected()) {
      fetchPortfolio();
    }
  }, [broker]);

  return { portfolio, loading, error };
}
```

### Use in Component

```typescript
// src/components/RealPortfolio.tsx
import { useBrokerPortfolio } from '../hooks/useBrokerPortfolio';

export function RealPortfolio() {
  const { portfolio, loading, error } = useBrokerPortfolio('zerodha');

  if (loading) return <div>Loading portfolio...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!portfolio) return <div>No portfolio data</div>;

  return (
    <div>
      <h2>Your Zerodha Portfolio</h2>
      <p>Total Value: ₹{portfolio.totalValue.toLocaleString()}</p>
      <p>Total P&L: ₹{portfolio.totalPnL.toLocaleString()}</p>
      
      <h3>Holdings</h3>
      {portfolio.holdings.map(holding => (
        <div key={holding.tradingsymbol}>
          <strong>{holding.tradingsymbol}</strong>: {holding.quantity} shares
          <br />
          P&L: ₹{holding.pnl.toFixed(2)} ({holding.pnlPercentage.toFixed(2)}%)
        </div>
      ))}
    </div>
  );
}
```

## 🔄 Auto-Refresh Portfolio

```typescript
// Refresh portfolio every 5 minutes
useEffect(() => {
  const interval = setInterval(async () => {
    const updated = await brokerService.getPortfolioSummary();
    setPortfolio(updated);
  }, 5 * 60 * 1000); // 5 minutes

  return () => clearInterval(interval);
}, []);
```

## 📋 Checklist

### For Zerodha:
- [ ] Register on Kite Connect Developer Console
- [ ] Create app and get API Key + Secret
- [ ] Set up backend server (recommended)
- [ ] Implement OAuth login flow
- [ ] Store access token securely
- [ ] Test with sandbox/demo account first
- [ ] Implement token refresh logic
- [ ] Add error handling

### For Upstox:
- [ ] Register on Upstox Developer Portal
- [ ] Create app and get credentials
- [ ] Set up OAuth flow
- [ ] Implement backend proxy
- [ ] Test API endpoints
- [ ] Handle token expiry

## 🚨 Important Notes

1. **API Costs**: Zerodha charges ₹2,000/month for Kite Connect API access
2. **Rate Limits**: Both brokers have API rate limits (check documentation)
3. **Token Expiry**: Access tokens expire daily, implement refresh logic
4. **Testing**: Use sandbox/demo accounts before going live
5. **Compliance**: Ensure you comply with broker terms of service

## 📚 Official Documentation

- **Zerodha Kite Connect**: https://kite.trade/docs/connect/v3/
- **Upstox API**: https://upstox.com/developer/api-documentation/

## 🎯 Next Steps

1. **Get API credentials** from your broker
2. **Set up backend server** for secure token handling
3. **Implement OAuth flow** in your app
4. **Test with demo data** first
5. **Go live** with real portfolio

## 💡 Alternative: Mock Data for Testing

If you want to test the UI without broker API:

```typescript
// Mock portfolio data
const mockPortfolio: PortfolioSummary = {
  totalValue: 2847325.50,
  investedValue: 2500000,
  currentValue: 2847325.50,
  totalPnL: 347325.50,
  totalPnLPercentage: 13.89,
  dayPnL: 12450.75,
  holdings: [
    {
      tradingsymbol: 'RELIANCE',
      exchange: 'NSE',
      isin: 'INE002A01018',
      quantity: 100,
      averagePrice: 2450.50,
      lastPrice: 2678.90,
      pnl: 22840,
      pnlPercentage: 9.32,
      value: 267890,
      product: 'CNC'
    }
    // Add more holdings...
  ],
  positions: []
};
```

Your app is **ready for broker integration** - just add your API credentials and implement the OAuth flow! 🚀
