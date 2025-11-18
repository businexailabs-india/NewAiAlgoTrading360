# Where to Find QuantConnect Features

## 🎯 Quick Answer

**QuantConnect features are now accessible in your main dashboard!**

### Location:
```
SmartTrade Portfolio Optimizer
    → Main Dashboard
        → Top Navigation Tabs
            → Click "QuantConnect" Tab ⚡
```

---

## 📍 Step-by-Step Navigation

### 1. Open Your App
```
http://localhost:5173
(or your deployed URL)
```

### 2. You'll See the Main Dashboard
```
┌────────────────────────────────────────────────────────┐
│  Smart AI Trading Analytics                            │
│  Real-time strategy monitoring & AI-powered insights   │
└────────────────────────────────────────────────────────┘
```

### 3. Look for the Tab Bar
```
┌──────────────────────────────────────────────────────────────┐
│ [Performance] [Comparison] [Trade Analytics] [AI Advisor]   │
│ [Market Sentiment] [Anomaly Detection] [QuantConnect ⚡]    │
└──────────────────────────────────────────────────────────────┘
```

### 4. Click the "QuantConnect" Tab
- **Icon**: ⚡ Lightning bolt (Zap icon)
- **Color**: Cyan/Blue when active
- **Position**: Last tab on the right

---

## 🎨 What You'll See

### When You Click "QuantConnect" Tab:

```
┌────────────────────────────────────────────────────────────┐
│  🎯 QuantConnect Integration        [+ New Project]       │
│  Connect your strategies to QuantConnect Cloud            │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  ⚡ Recent Projects                                        │
│  • Virtual Fluorescent Pink Sheep                         │
│  • Clone of BTC Dual Thrust Long Only                     │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  ⚡ All Projects (5)                                       │
│  [Project Cards Grid]                                      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│  Selected Project: Virtual Fluorescent Pink Sheep         │
│  [▶ Run Backtest]  [🔗 Open in QC]                        │
│                                                            │
│  Performance Metrics:                                      │
│  [Total P&L] [Win Rate] [Sharpe] [Drawdown]              │
└────────────────────────────────────────────────────────────┘
```

---

## 📊 All QuantConnect Features in the App

### 1. **QuantConnect Tab** (Main Location)
**Path**: Dashboard → QuantConnect Tab

**Features**:
- ✅ View all your QC projects
- ✅ Recent projects highlighted
- ✅ Run backtests
- ✅ View performance metrics
- ✅ Create new projects
- ✅ Open projects in QuantConnect Cloud

---

### 2. **Advanced Performance Metrics**
**Path**: Dashboard → Performance Tab → Advanced Metrics

**QuantConnect Data Used**:
- ✅ Monthly Returns Heat Map (from QC backtests)
- ✅ Multi-period statistics (from QC data)
- ✅ Drawdown analysis (from QC equity curve)

**How to Access**:
1. Click "Performance" tab
2. Scroll down to "Advanced Performance Metrics"
3. Heat map shows real data from QuantConnect backtests

---

### 3. **Strategy Performance Dashboard**
**Path**: Dashboard → Performance Tab

**QuantConnect Data Used**:
- ✅ Strategy cards (from QC projects)
- ✅ Real P&L (from QC backtests)
- ✅ Win rates (from QC statistics)
- ✅ Trade counts (from QC orders)

**How to Access**:
1. Click "Performance" tab
2. See strategy cards at top
3. Each card shows real QC backtest data

---

### 4. **Trade History**
**Path**: Dashboard → Performance Tab → Strategy Card → View Details

**QuantConnect Data Used**:
- ✅ All trades from backtests
- ✅ Entry/exit prices
- ✅ P&L per trade
- ✅ Trade timestamps

**How to Access**:
1. Click "Performance" tab
2. Click "View Details" on any strategy card
3. Go to "All Trades" tab
4. See complete trade history from QuantConnect

---

## 🗺️ Visual Map

```
SmartTrade Portfolio Optimizer
│
├── 📊 Performance Tab
│   ├── Strategy Cards (QC data)
│   ├── Expected vs Executed (QC backtests)
│   ├── Daily P&L Chart (QC data)
│   └── Advanced Metrics
│       └── Heat Map (QC monthly returns) ✅
│
├── 📈 Comparison Tab
│   └── Strategy comparison (can use QC data)
│
├── 📉 Trade Analytics Tab
│   └── Trade analysis (can use QC trades)
│
├── 🤖 AI Advisor Tab
│   └── AI insights (can analyze QC data)
│
├── 📰 Market Sentiment Tab
│   └── Market analysis
│
├── 🔍 Anomaly Detection Tab
│   └── Anomaly detection
│
└── ⚡ QuantConnect Tab ← MAIN LOCATION
    ├── Recent Projects Section ✅
    ├── All Projects Grid ✅
    ├── Project Selection ✅
    ├── Run Backtest Button ✅
    ├── Performance Metrics ✅
    └── Open in QC Link ✅
```

---

## 🎯 Quick Access Guide

### To View Your Projects:
1. **Click**: QuantConnect tab
2. **See**: All your projects listed
3. **Action**: Click any project to select

### To Run a Backtest:
1. **Click**: QuantConnect tab
2. **Select**: A project (e.g., "Virtual Fluorescent Pink Sheep")
3. **Click**: "Run Backtest" button
4. **Wait**: 5-10 seconds
5. **View**: Results appear automatically

### To See Monthly Returns Heat Map:
1. **Click**: Performance tab
2. **Scroll**: To "Advanced Performance Metrics"
3. **View**: Heat map with real QC data
4. **Hover**: Over cells to see details

### To View Trade History:
1. **Click**: Performance tab
2. **Click**: "View Details" on strategy card
3. **Click**: "All Trades" tab
4. **See**: Complete trade list from QC

---

## 🔧 Setup Required

Before you can see QuantConnect features, you need to:

### 1. Add Credentials
```env
# In backend/.env
QC_USER_ID=your_user_id
QC_API_TOKEN=your_api_token
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Initialize Service
Add to `backend/src/server.ts`:
```typescript
import { initializeQuantConnect } from './services/quantconnect.service';

initializeQuantConnect({
  userId: process.env.QC_USER_ID!,
  apiToken: process.env.QC_API_TOKEN!,
  baseUrl: process.env.QC_BASE_URL
});
```

### 4. Register Routes
Add to your main app file:
```typescript
import quantconnectRoutes from './routes/quantconnect.routes';
app.use('/api/quantconnect', quantconnectRoutes);
```

### 5. Start the App
```bash
# Backend
cd backend
npm run dev

# Frontend (in another terminal)
cd ..
npm run dev
```

### 6. Open Browser
```
http://localhost:5173
```

### 7. Click QuantConnect Tab
You should now see all your projects! 🎉

---

## 📱 Mobile/Responsive View

On smaller screens:
- Tabs may wrap to multiple lines
- QuantConnect tab will still be visible
- All features remain accessible
- UI adapts to screen size

---

## 🎨 Visual Indicators

### Tab Appearance:
- **Inactive**: Gray text, no background
- **Active**: Cyan background, cyan text, lightning icon
- **Hover**: Slight highlight

### Project Cards:
- **Recent Projects**: Purple/pink gradient border
- **Selected Project**: Cyan border with ring
- **Regular Projects**: Gray border
- **Crypto Projects**: Orange "Crypto Strategy" badge

---

## 🚀 What Happens After Setup

### First Time:
1. Click QuantConnect tab
2. App fetches your projects from QC
3. "Virtual Fluorescent Pink Sheep" auto-selected
4. Ready to run backtests!

### Every Time After:
1. Click QuantConnect tab
2. See your projects instantly
3. Recent projects highlighted
4. One-click backtesting

---

## 💡 Pro Tips

### Quick Navigation:
- **Keyboard**: Use Tab key to navigate between tabs
- **Bookmarks**: Bookmark with `#quantconnect` hash
- **Direct Link**: `http://localhost:5173/#quantconnect`

### Best Workflow:
1. Start in QuantConnect tab
2. Run backtest
3. Switch to Performance tab to see results
4. Check Advanced Metrics for heat map
5. View trade details in Strategy Details

---

## 🆘 Troubleshooting

### "QuantConnect tab not showing"
- ✅ Make sure you saved `SmartTradingDashboard.tsx`
- ✅ Refresh your browser
- ✅ Check console for errors

### "No projects showing"
- ✅ Check QC credentials in .env
- ✅ Verify backend is running
- ✅ Check browser console for API errors
- ✅ Ensure routes are registered

### "Tab is there but empty"
- ✅ Check if QuantConnectDashboard component exists
- ✅ Verify import statement
- ✅ Check for TypeScript errors

---

## 📚 Related Documentation

- **Setup Guide**: `QUANTCONNECT_SETUP.md`
- **Features Mapping**: `QUANTCONNECT_FEATURES_MAPPING.md`
- **Visual Guide**: `QUANTCONNECT_VISUAL_GUIDE.md`
- **Your Projects**: `MY_QUANTCONNECT_PROJECTS.md`
- **Integration Guide**: `QUANTCONNECT_INTEGRATION.md`

---

## ✅ Summary

**To see QuantConnect features:**

1. ✅ Open your app: `http://localhost:5173`
2. ✅ Look at the top navigation tabs
3. ✅ Click the **"QuantConnect ⚡"** tab (last tab)
4. ✅ See all your projects and features!

**That's it!** All QuantConnect features are now in one convenient location! 🎉
