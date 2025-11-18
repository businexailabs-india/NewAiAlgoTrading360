# Quick Setup Guide - QuantConnect Integration

## ✅ What You Now Have

Your SmartTrade Portfolio Optimizer now includes complete QuantConnect Cloud integration:

### Backend Files Created:
- ✅ `backend/src/services/quantconnect.service.ts` - API wrapper
- ✅ `backend/src/controllers/quantconnect.controller.ts` - Request handlers
- ✅ `backend/src/routes/quantconnect.routes.ts` - API endpoints

### Frontend Files Created:
- ✅ `src/services/quantconnectService.ts` - Frontend API client
- ✅ `src/components/QuantConnectDashboard.tsx` - UI component

### Documentation:
- ✅ `QUANTCONNECT_INTEGRATION.md` - Complete integration guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Get QuantConnect Credentials
1. Go to https://www.quantconnect.com
2. Sign up for free account
3. Go to Account → API Access
4. Copy your **User ID** and **API Token**

### Step 2: Add to Backend Environment

Add these lines to `backend/.env`:
```env
# QuantConnect Configuration
QC_USER_ID=your_user_id_here
QC_API_TOKEN=your_api_token_here
QC_BASE_URL=https://api.quantconnect.com
```

### Step 3: Install Backend Dependencies

```bash
cd backend
npm install
```

**Note**: Axios is already included in package.json, so it will be installed automatically!

### Step 4: Initialize Service

Add to `backend/src/server.ts` (or wherever you initialize your app):

```typescript
import { initializeQuantConnect } from './services/quantconnect.service';

// After other initializations
if (process.env.QC_USER_ID && process.env.QC_API_TOKEN) {
  initializeQuantConnect({
    userId: process.env.QC_USER_ID,
    apiToken: process.env.QC_API_TOKEN,
    baseUrl: process.env.QC_BASE_URL
  });
  console.log('✓ QuantConnect initialized');
}
```

### Step 5: Register Routes

Add to your main app file where you register routes:

```typescript
import quantconnectRoutes from './routes/quantconnect.routes';

app.use('/api/quantconnect', quantconnectRoutes);
```

### Step 6: Add Dashboard Tab

Update `src/components/SmartTradingDashboard.tsx`:

```typescript
import { QuantConnectDashboard } from './QuantConnectDashboard';

// In the TabsList, add:
<TabsTrigger value="quantconnect">
  <Zap className="w-4 h-4 mr-2" />
  QuantConnect
</TabsTrigger>

// In the content area, add:
<TabsContent value="quantconnect">
  <QuantConnectDashboard />
</TabsContent>
```

### Step 7: Test It!

```bash
# Start backend
cd backend
npm run dev

# Start frontend (in another terminal)
cd ..
npm run dev
```

Navigate to your dashboard and click the "QuantConnect" tab!

## 📊 What You Can Do Now

### 1. Manage Projects
- View all your QuantConnect projects
- Create new projects
- Select projects to work with

### 2. Run Backtests
- Click "Run Backtest" on any project
- View results in real-time
- See performance metrics:
  - Total P&L
  - Win Rate
  - Sharpe Ratio
  - Max Drawdown
  - Alpha & Beta

### 3. Integrate with Your Features

#### Heat Map with Real Data
```typescript
// In AdvancedPerformanceMetrics.tsx
import { quantconnectService } from '../services/quantconnectService';

const monthlyReturns = await quantconnectService.getMonthlyReturns(
  projectId,
  backtestId
);
// Use this data in your heat map!
```

#### Strategy Performance
```typescript
const metrics = await quantconnectService.getStrategyMetrics(
  projectId,
  backtestId
);
// Display in your strategy cards
```

## 🎯 Sample Strategy

Create this in QuantConnect (copy/paste into their IDE):

```python
from AlgorithmImports import *

class IndianMarketStrategy(QCAlgorithm):
    
    def Initialize(self):
        self.SetStartDate(2023, 1, 1)
        self.SetEndDate(2024, 1, 1)
        self.SetCash(100000)
        
        # Indian stocks
        self.symbols = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"]
        
        for symbol in self.symbols:
            self.AddEquity(symbol, Resolution.Daily)
        
        # Simple momentum strategy
        self.lookback = 20
        
    def OnData(self, data):
        for symbol in self.symbols:
            if not data.ContainsKey(symbol):
                continue
            
            history = self.History(symbol, self.lookback, Resolution.Daily)
            if len(history) < self.lookback:
                continue
            
            # Calculate momentum
            momentum = (history['close'][-1] - history['close'][0]) / history['close'][0]
            
            # Buy if momentum > 5%
            if momentum > 0.05 and not self.Portfolio[symbol].Invested:
                self.SetHoldings(symbol, 0.2)
                
            # Sell if momentum < -3%
            elif momentum < -0.03 and self.Portfolio[symbol].Invested:
                self.Liquidate(symbol)
```

## 🔧 Troubleshooting

### Issue: "Cannot find module 'axios'"
**Solution**: 
```bash
cd backend
npm install axios
```

### Issue: "QuantConnect service not initialized"
**Solution**: Make sure you added the initialization code to your server.ts

### Issue: "Authentication failed"
**Solution**: Double-check your QC_USER_ID and QC_API_TOKEN in .env

### Issue: TypeScript errors in backend
**Solution**: 
```bash
cd backend
npm install
```

## 💡 Pro Tips

1. **Start with Paper Trading**: Test strategies with fake money first
2. **Use Daily Resolution**: It's free and good for testing
3. **Monitor API Limits**: Free tier has limited backtests
4. **Save Backtest IDs**: Store them to retrieve results later
5. **Version Your Strategies**: Use meaningful project names

## 📈 Next Steps

1. ✅ Set up credentials (5 min)
2. ✅ Install dependencies (2 min)
3. ✅ Initialize service (2 min)
4. ✅ Test connection (1 min)
5. ⏳ Create your first strategy
6. ⏳ Run a backtest
7. ⏳ View results in dashboard
8. ⏳ Integrate with heat maps
9. ⏳ Deploy to paper trading
10. ⏳ Go live!

## 🎓 Learning Resources

- **QuantConnect Bootcamp**: https://www.quantconnect.com/learning
- **API Docs**: https://www.quantconnect.com/docs/v2
- **Community**: https://www.quantconnect.com/forum
- **Examples**: https://github.com/QuantConnect/Lean

## 🆘 Need Help?

Check the full documentation in `QUANTCONNECT_INTEGRATION.md` for:
- Detailed API reference
- Complete code examples
- Advanced features
- Security best practices
- Cost considerations

---

**You're all set!** 🚀 Your portfolio optimizer is now connected to professional-grade backtesting infrastructure. Happy trading!
