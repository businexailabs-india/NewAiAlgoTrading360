# QuantConnect Integration Guide

## Overview
Complete integration of QuantConnect Cloud API into SmartTrade Portfolio Optimizer for professional-grade backtesting, live trading, and strategy analysis.

## Features Implemented

### 🎯 Core Functionality
1. **Project Management**
   - List all QuantConnect projects
   - Create new projects
   - Select and manage projects

2. **Backtesting**
   - Run backtests on cloud servers
   - Fetch backtest results
   - View performance metrics
   - Analyze trades

3. **Live Trading** (Ready to implement)
   - Deploy algorithms to live markets
   - Monitor live algorithm status
   - View live logs
   - Stop live algorithms

4. **Data Integration**
   - Monthly returns for heat maps
   - Strategy performance metrics
   - Trade-by-trade analysis
   - Equity curve data

## Architecture

### Backend Structure
```
backend/src/
├── services/
│   └── quantconnect.service.ts    # QuantConnect API wrapper
├── controllers/
│   └── quantconnect.controller.ts # Request handlers
└── routes/
    └── quantconnect.routes.ts     # API endpoints
```

### Frontend Structure
```
src/
├── services/
│   └── quantconnectService.ts     # Frontend API client
└── components/
    └── QuantConnectDashboard.tsx  # UI component
```

## Setup Instructions

### 1. Get QuantConnect API Credentials

1. **Sign up** at [QuantConnect.com](https://www.quantconnect.com)
2. **Navigate** to Account Settings
3. **Generate** API Token
4. **Copy** your User ID and API Token

### 2. Configure Environment Variables

#### Backend (.env)
```env
# QuantConnect Configuration
QC_USER_ID=your_user_id_here
QC_API_TOKEN=your_api_token_here
QC_BASE_URL=https://api.quantconnect.com

# Existing variables
PORT=5000
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

### 3. Install Dependencies

#### Backend
```bash
cd backend
npm install
```

**Note**: All required dependencies including axios are already in package.json!

#### Frontend
```bash
npm install
# All dependencies already in package.json
```

### 4. Initialize QuantConnect Service

Add to `backend/src/server.ts` or `app.ts`:

```typescript
import { initializeQuantConnect } from './services/quantconnect.service';

// Initialize QuantConnect
if (process.env.QC_USER_ID && process.env.QC_API_TOKEN) {
  initializeQuantConnect({
    userId: process.env.QC_USER_ID,
    apiToken: process.env.QC_API_TOKEN,
    baseUrl: process.env.QC_BASE_URL
  });
  console.log('✓ QuantConnect service initialized');
}
```

### 5. Register Routes

Add to your main router file:

```typescript
import quantconnectRoutes from './routes/quantconnect.routes';

// Register QuantConnect routes
app.use('/api/quantconnect', quantconnectRoutes);
```

### 6. Add Dashboard to Frontend

Update `SmartTradingDashboard.tsx`:

```typescript
import { QuantConnectDashboard } from './QuantConnectDashboard';

// Add new tab
<TabsTrigger value="quantconnect">
  QuantConnect
</TabsTrigger>

// Add content
<TabsContent value="quantconnect">
  <QuantConnectDashboard />
</TabsContent>
```

## API Endpoints

### Project Management

#### Get Projects
```http
GET /api/quantconnect/projects
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "projectId": 123456,
      "name": "My Strategy",
      "created": "2024-01-01T00:00:00Z",
      "modified": "2024-01-15T00:00:00Z",
      "language": "Py"
    }
  ]
}
```

#### Create Project
```http
POST /api/quantconnect/projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "New Strategy",
  "language": "Py"
}
```

### Backtesting

#### Run Backtest
```http
POST /api/quantconnect/backtest
Authorization: Bearer {token}
Content-Type: application/json

{
  "projectId": 123456,
  "name": "Backtest-2024-01-15"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "backtestId": "abc123def456",
    "success": true
  }
}
```

#### Get Backtest Results
```http
GET /api/quantconnect/backtest/{projectId}/{backtestId}
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "backtestId": "abc123",
    "projectId": "123456",
    "statistics": {
      "totalTrades": 289,
      "winRate": 69.8,
      "sharpeRatio": 1.88,
      "maxDrawdown": -9.5,
      "annualReturn": 24.5,
      "totalReturn": 52.3,
      "profitLoss": 125430.50,
      "alpha": 0.15,
      "beta": 0.85
    },
    "trades": [...],
    "equity": [...]
  }
}
```

#### Get Monthly Returns
```http
GET /api/quantconnect/backtest/{projectId}/{backtestId}/monthly-returns
Authorization: Bearer {token}
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "month": "2024-01",
      "return": "5.23",
      "trades": 45,
      "totalPnL": 12500.50
    }
  ]
}
```

#### Get Strategy Metrics
```http
GET /api/quantconnect/backtest/{projectId}/{backtestId}/metrics
Authorization: Bearer {token}
```

### Live Trading

#### Get Live Algorithm
```http
GET /api/quantconnect/live/{projectId}/{deployId}
Authorization: Bearer {token}
```

#### Deploy Live
```http
POST /api/quantconnect/live/deploy
Authorization: Bearer {token}
Content-Type: application/json

{
  "projectId": 123456,
  "compileId": "compile123",
  "brokerage": "InteractiveBrokers",
  "settings": {
    "accountId": "your_account_id",
    "environment": "paper"
  }
}
```

#### Stop Live Algorithm
```http
DELETE /api/quantconnect/live/{projectId}/{deployId}
Authorization: Bearer {token}
```

## Usage Examples

### Frontend Usage

#### Load Projects
```typescript
import { quantconnectService } from '../services/quantconnectService';

const projects = await quantconnectService.getProjects();
console.log('Projects:', projects);
```

#### Run Backtest
```typescript
const result = await quantconnectService.runBacktest(
  projectId,
  'My Backtest'
);

// Wait for completion, then fetch results
const backtestData = await quantconnectService.getBacktestResults(
  projectId,
  result.backtestId
);
```

#### Get Monthly Returns for Heat Map
```typescript
const monthlyReturns = await quantconnectService.getMonthlyReturns(
  projectId,
  backtestId
);

// Use in AdvancedPerformanceMetrics component
```

### Backend Usage

```typescript
import { getQuantConnectService } from '../services/quantconnect.service';

const qcService = getQuantConnectService();

// Get projects
const projects = await qcService.getProjects();

// Run backtest
const backtest = await qcService.createBacktest(projectId, 'Test');

// Get results
const results = await qcService.getBacktestResults(projectId, backtestId);
```

## Integration with Existing Features

### 1. Heat Map Integration

Update `AdvancedPerformanceMetrics.tsx` to use QuantConnect data:

```typescript
import { quantconnectService } from '../services/quantconnectService';

// Fetch real data from QuantConnect
const monthlyReturns = await quantconnectService.getMonthlyReturns(
  projectId,
  backtestId
);

// Transform to heat map format
const heatMapData = transformToHeatMap(monthlyReturns);
```

### 2. Strategy Performance Dashboard

Link QuantConnect metrics to your strategy cards:

```typescript
const metrics = await quantconnectService.getStrategyMetrics(
  projectId,
  backtestId
);

// Display in StrategyPerformanceDashboard
```

### 3. Trade History

Populate trade history from backtest results:

```typescript
const results = await quantconnectService.getBacktestResults(
  projectId,
  backtestId
);

// Use results.trades in StrategyDetailsModal
```

## Sample QuantConnect Algorithm

Create this in your QuantConnect project:

```python
from AlgorithmImports import *

class MomentumBreakoutStrategy(QCAlgorithm):
    
    def Initialize(self):
        self.SetStartDate(2020, 1, 1)
        self.SetEndDate(2024, 1, 1)
        self.SetCash(100000)
        
        # Add Indian stocks
        self.AddEquity("RELIANCE", Resolution.Daily)
        self.AddEquity("TCS", Resolution.Daily)
        self.AddEquity("HDFCBANK", Resolution.Daily)
        
        # Set indicators
        self.sma_fast = {}
        self.sma_slow = {}
        
        for symbol in ["RELIANCE", "TCS", "HDFCBANK"]:
            self.sma_fast[symbol] = self.SMA(symbol, 20)
            self.sma_slow[symbol] = self.SMA(symbol, 50)
    
    def OnData(self, data):
        for symbol in ["RELIANCE", "TCS", "HDFCBANK"]:
            if not self.sma_fast[symbol].IsReady:
                continue
            
            # Buy signal: Fast SMA crosses above Slow SMA
            if self.sma_fast[symbol].Current.Value > self.sma_slow[symbol].Current.Value:
                if not self.Portfolio[symbol].Invested:
                    self.SetHoldings(symbol, 0.33)
                    self.Debug(f"Bought {symbol}")
            
            # Sell signal: Fast SMA crosses below Slow SMA
            elif self.sma_fast[symbol].Current.Value < self.sma_slow[symbol].Current.Value:
                if self.Portfolio[symbol].Invested:
                    self.Liquidate(symbol)
                    self.Debug(f"Sold {symbol}")
```

## Data Flow Diagram

```
User Action (Run Backtest)
    ↓
Frontend (QuantConnectDashboard)
    ↓
Frontend Service (quantconnectService.ts)
    ↓
HTTP Request
    ↓
Backend Route (quantconnect.routes.ts)
    ↓
Backend Controller (quantconnect.controller.ts)
    ↓
QuantConnect Service (quantconnect.service.ts)
    ↓
QuantConnect API (api.quantconnect.com)
    ↓
Backtest Execution on Cloud
    ↓
Results Returned
    ↓
Stored in Backend
    ↓
Sent to Frontend
    ↓
Displayed in Dashboard
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```
Error: Failed to fetch projects
```
**Solution**: Check your QC_USER_ID and QC_API_TOKEN in .env file

#### Issue: Axios Not Found
```
Cannot find module 'axios'
```
**Solution**: Run `npm install` in backend folder (axios is already in package.json)

#### 3. TypeScript Errors
```
Cannot find module 'express'
```
**Solution**: Run `npm install` in backend folder to install all dependencies

#### 4. CORS Errors
**Solution**: Ensure your backend has CORS enabled for your frontend URL

### Debug Mode

Enable debug logging:

```typescript
// In quantconnect.service.ts
console.log('QC API Request:', url, params);
console.log('QC API Response:', response.data);
```

## Security Best Practices

1. **Never commit** API tokens to version control
2. **Use environment variables** for all sensitive data
3. **Validate** all user inputs before sending to QuantConnect
4. **Implement rate limiting** to avoid API quota issues
5. **Log** all API calls for audit purposes

## Cost Considerations

### QuantConnect Pricing
- **Free Tier**: 1 live algorithm, daily resolution data
- **Team**: $20/month - More backtests, minute data
- **Professional**: $50/month - Multiple live algos, tick data
- **Institution**: Custom pricing

### API Limits
- **Backtests**: Limited by subscription tier
- **Live Algorithms**: 1-10 depending on tier
- **Data Resolution**: Daily to tick depending on tier

## Next Steps

1. ✅ Set up QuantConnect account
2. ✅ Get API credentials
3. ✅ Configure environment variables
4. ✅ Install dependencies
5. ✅ Test API connection
6. ⏳ Create your first strategy
7. ⏳ Run backtest
8. ⏳ Integrate with heat maps
9. ⏳ Deploy to paper trading
10. ⏳ Go live!

## Support & Resources

- **QuantConnect Docs**: https://www.quantconnect.com/docs
- **API Reference**: https://www.quantconnect.com/docs/v2/cloud-platform/api-reference
- **Community Forum**: https://www.quantconnect.com/forum
- **GitHub**: https://github.com/QuantConnect/Lean

## Conclusion

Your SmartTrade Portfolio Optimizer is now fully integrated with QuantConnect Cloud! You can:
- ✅ Manage projects
- ✅ Run backtests
- ✅ Fetch real performance data
- ✅ Populate heat maps with actual trades
- ✅ Deploy to live trading (when ready)

All the infrastructure is in place - just add your API credentials and start testing your strategies!
