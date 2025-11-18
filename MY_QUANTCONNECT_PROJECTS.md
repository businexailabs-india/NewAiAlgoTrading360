# My QuantConnect Projects

## Recent Active Projects

### 1. Virtual Fluorescent Pink Sheep 🐑
**Type**: Custom Strategy
**Status**: Active
**Language**: Python/C#

**Description**: 
Your custom trading strategy with unique naming. This project will be automatically highlighted in the dashboard with special purple/pink styling.

**Features**:
- Auto-selected when dashboard loads
- Highlighted with "Recent" badge
- Purple border for easy identification

**Quick Actions**:
- Click to select
- Run backtest with one click
- View performance metrics
- Open in QuantConnect Cloud

---

### 2. Clone of BTC Dual Thrust Long Only 🪙
**Type**: Cryptocurrency Strategy
**Status**: Active
**Language**: Python/C#
**Asset**: Bitcoin (BTC)

**Description**:
A clone of the BTC Dual Thrust Long Only strategy. Focuses on long-only positions in Bitcoin using the Dual Thrust breakout system.

**Strategy Details**:
- **Type**: Dual Thrust Breakout
- **Direction**: Long Only
- **Asset**: BTC
- **Timeframe**: Varies based on implementation

**Features**:
- Crypto strategy indicator (orange badge)
- Special styling in dashboard
- One-click backtesting
- Performance tracking

---

## Dashboard Features for Your Projects

### Auto-Selection
When you open the QuantConnect dashboard, it will automatically select one of your recent projects:
1. First priority: "Virtual Fluorescent Pink Sheep"
2. Second priority: "Clone of BTC Dual Thrust Long Only"
3. Fallback: First available project

### Visual Highlights

**Recent Projects Section**:
- Purple/pink gradient background
- Lists your recent projects
- Quick visual reference

**Project Cards**:
- **Recent Badge**: Pink badge for recent projects
- **Crypto Indicator**: Orange "Crypto Strategy" tag for BTC project
- **Purple Border**: Special border color for recent projects
- **Language Badge**: Shows Python or C#

### Quick Actions

For each project you can:
1. **Select**: Click to make it active
2. **Run Backtest**: One-click backtesting
3. **View Results**: See performance metrics instantly
4. **Open in QC**: Direct link to QuantConnect Cloud
5. **View Metrics**: See detailed analytics

## Using Your Projects

### Running a Backtest

```typescript
// Automatically uses selected project
1. Select "Virtual Fluorescent Pink Sheep"
2. Click "Run Backtest"
3. Wait 5-10 seconds
4. View results automatically
```

### Viewing Performance

After backtest completes, you'll see:
- **Total P&L**: Profit/Loss in ₹
- **Win Rate**: Percentage of winning trades
- **Sharpe Ratio**: Risk-adjusted returns
- **Max Drawdown**: Largest decline
- **Total Trades**: Number of trades executed
- **Alpha & Beta**: Market correlation metrics

### Integration with Dashboard

Your projects automatically integrate with:
- **Heat Maps**: Monthly returns visualization
- **Strategy Performance**: Real metrics
- **Trade History**: Actual trades from backtests
- **Equity Curve**: Portfolio value over time

## Project Management

### Viewing All Projects
- Dashboard shows count: "All Projects (X)"
- Grid view with 3 columns
- Sorted by creation date
- Recent projects highlighted

### Creating New Projects
1. Click "New Project" button
2. Auto-generated name with timestamp
3. Choose Python or C# (default: Python)
4. Instantly available in list

### Switching Projects
- Click any project card to select
- Selected project has cyan border
- Recent projects have purple border
- Smooth animations on selection

## API Integration

### Fetching Your Projects
```typescript
const projects = await quantconnectService.getProjects();
// Returns all your projects including:
// - Virtual Fluorescent Pink Sheep
// - Clone of BTC Dual Thrust Long Only
// - Any other projects you have
```

### Running Backtests
```typescript
const result = await quantconnectService.runBacktest(
  projectId,
  'Backtest-' + Date.now()
);
```

### Getting Results
```typescript
const results = await quantconnectService.getBacktestResults(
  projectId,
  backtestId
);
```

## Strategy Descriptions

### Virtual Fluorescent Pink Sheep
This is your custom strategy. The dashboard will:
- ✅ Auto-select it on load
- ✅ Highlight with special styling
- ✅ Show "Recent" badge
- ✅ Enable one-click backtesting

### BTC Dual Thrust Long Only
Your Bitcoin strategy. The dashboard will:
- ✅ Show "Crypto Strategy" indicator
- ✅ Display with orange accent
- ✅ Highlight as recent project
- ✅ Enable crypto-specific features

## Tips for Using Your Projects

### Best Practices
1. **Regular Backtesting**: Run weekly backtests to track performance
2. **Compare Results**: Compare both strategies side-by-side
3. **Monitor Metrics**: Watch Sharpe ratio and drawdown
4. **Paper Trading**: Test before going live
5. **Keep Updated**: Sync with QuantConnect regularly

### Performance Tracking
- Use heat maps to see monthly performance
- Track win rates over time
- Monitor drawdown patterns
- Compare against benchmarks

### Optimization
- Adjust parameters in QuantConnect
- Run backtests after changes
- Compare before/after metrics
- Document what works

## Next Steps

### For Virtual Fluorescent Pink Sheep
1. ✅ Project is ready to use
2. ⏳ Run initial backtest
3. ⏳ Review performance metrics
4. ⏳ Optimize parameters
5. ⏳ Deploy to paper trading

### For BTC Dual Thrust
1. ✅ Project is ready to use
2. ⏳ Run backtest on recent BTC data
3. ⏳ Analyze crypto-specific metrics
4. ⏳ Compare with buy-and-hold
5. ⏳ Test with different timeframes

## Troubleshooting

### Project Not Showing
- Check QuantConnect credentials in .env
- Verify API connection
- Refresh dashboard
- Check console for errors

### Backtest Not Running
- Ensure project is compiled in QuantConnect
- Check for algorithm errors
- Verify subscription tier
- Try again after a minute

### Results Not Loading
- Wait 5-10 seconds after starting backtest
- Check backtest status in QuantConnect
- Refresh the page
- Check API logs

## Support

If you need help with your projects:
1. Check QuantConnect documentation
2. Review error logs in console
3. Visit QuantConnect forum
4. Check project status in QC Cloud

---

**Your projects are now fully integrated with the SmartTrade Portfolio Optimizer!** 🚀

The dashboard will automatically recognize and highlight:
- ✨ Virtual Fluorescent Pink Sheep (with special styling)
- 🪙 Clone of BTC Dual Thrust Long Only (with crypto indicator)

Just add your QuantConnect credentials and start backtesting! 📊
