# QuantConnect Integration - Troubleshooting Guide

## 🔧 Common Issues and Solutions

### Issue 1: "Failed to load projects" Error

**Symptoms**:
- Yellow notice box appears
- Message: "Failed to load projects. Using mock data for testing."
- Mock projects shown instead of real ones

**Causes**:
1. Backend server not running
2. QuantConnect credentials not configured
3. Backend routes not registered
4. CORS issues

**Solutions**:

#### Step 1: Check if Backend is Running
```bash
cd backend
npm run dev
```

You should see:
```
Server running on port 5000
✓ QuantConnect initialized
```

#### Step 2: Verify Credentials in `.env`
```bash
# Check backend/.env file
cd backend
cat .env  # or type .env on Windows
```

Should contain:
```env
QC_USER_ID=your_user_id_here
QC_API_TOKEN=your_api_token_here
QC_BASE_URL=https://api.quantconnect.com
```

#### Step 3: Get QuantConnect Credentials
1. Go to https://www.quantconnect.com
2. Sign in to your account
3. Click your profile → Account → API Access
4. Copy **User ID** and **API Token**
5. Paste into `backend/.env`

#### Step 4: Initialize QuantConnect Service
Check `backend/src/server.ts` or `backend/src/app.ts`:

```typescript
import { initializeQuantConnect } from './services/quantconnect.service';

// Add this after other initializations
if (process.env.QC_USER_ID && process.env.QC_API_TOKEN) {
  initializeQuantConnect({
    userId: process.env.QC_USER_ID,
    apiToken: process.env.QC_API_TOKEN,
    baseUrl: process.env.QC_BASE_URL
  });
  console.log('✓ QuantConnect initialized');
} else {
  console.warn('⚠ QuantConnect credentials not found');
}
```

#### Step 5: Register Routes
Check your main app file:

```typescript
import quantconnectRoutes from './routes/quantconnect.routes';

// Add this with other routes
app.use('/api/quantconnect', quantconnectRoutes);
```

#### Step 6: Restart Backend
```bash
# Stop the server (Ctrl+C)
# Start again
npm run dev
```

---

### Issue 2: "New Project" Button Not Working

**Symptoms**:
- Button shows "Creating..." spinner
- Error message appears
- Mock project created instead

**Solutions**:

#### Check 1: Backend Running?
```bash
# In backend folder
npm run dev
```

#### Check 2: API Endpoint Working?
Test manually:
```bash
curl -X POST http://localhost:5000/api/quantconnect/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test Project","language":"Py"}'
```

#### Check 3: Authentication Token
The frontend needs an auth token. Check browser console:
```javascript
localStorage.getItem('authToken')
```

If null, you need to log in first.

#### Check 4: CORS Configuration
In `backend/src/server.ts`:
```typescript
import cors from 'cors';

app.use(cors({
  origin: 'http://localhost:5173', // Your frontend URL
  credentials: true
}));
```

---

### Issue 3: Mock Data Showing Instead of Real Data

**This is actually a FEATURE, not a bug!**

**Why Mock Data?**
- Allows testing without QuantConnect account
- Works offline
- Instant feedback during development

**To Use Real Data**:
1. ✅ Add QuantConnect credentials
2. ✅ Start backend server
3. ✅ Initialize service
4. ✅ Refresh the page

**Mock Data Includes**:
- Virtual Fluorescent Pink Sheep (project)
- Clone of BTC Dual Thrust Long Only (project)
- Sample backtest metrics
- Mock performance data

---

### Issue 4: Backend Not Starting

**Error**: `Cannot find module 'axios'`

**Solution**:
```bash
cd backend
npm install
```

**Error**: `Cannot find module 'express'`

**Solution**:
```bash
cd backend
npm install
```

**Error**: TypeScript errors

**Solution**:
```bash
cd backend
npm install
npm run build
```

---

### Issue 5: Frontend Not Showing QuantConnect Tab

**Symptoms**:
- No "QuantConnect" tab in navigation
- Tab bar doesn't show lightning icon

**Solutions**:

#### Check 1: Component Imported?
In `src/components/SmartTradingDashboard.tsx`:
```typescript
import { QuantConnectDashboard } from './QuantConnectDashboard';
```

#### Check 2: Tab Added?
```typescript
<TabsTrigger value="quantconnect">
  <Zap className="w-4 h-4 mr-2" />
  QuantConnect
</TabsTrigger>
```

#### Check 3: Content Added?
```typescript
<TabsContent value="quantconnect">
  <QuantConnectDashboard />
</TabsContent>
```

#### Check 4: Refresh Browser
```
Ctrl + Shift + R (hard refresh)
```

---

### Issue 6: "Run Backtest" Not Working

**Symptoms**:
- Button shows spinner
- No results appear
- Error message shown

**Solutions**:

#### Check 1: Project Selected?
- Make sure a project card is highlighted
- Click a project card to select it

#### Check 2: Backend Running?
```bash
cd backend
npm run dev
```

#### Check 3: QuantConnect Account Active?
- Log in to quantconnect.com
- Check if you have active projects
- Verify API access is enabled

#### Check 4: Check Browser Console
Press F12 and look for errors:
```
Failed to fetch
Network error
401 Unauthorized
```

---

### Issue 7: CORS Errors in Browser Console

**Error**: 
```
Access to fetch at 'http://localhost:5000/api/quantconnect/projects' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

**Solution**:

Add to `backend/src/server.ts`:
```typescript
import cors from 'cors';

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

### Issue 8: Authentication Errors

**Error**: `401 Unauthorized`

**Causes**:
1. No auth token in localStorage
2. Invalid or expired token
3. Backend auth middleware blocking requests

**Solutions**:

#### Option 1: Disable Auth for Testing
In `backend/src/routes/quantconnect.routes.ts`:
```typescript
// Temporarily comment out auth middleware
// router.use(authenticate);

router.get('/projects', getProjects);
// ... other routes
```

#### Option 2: Add Auth Token
```javascript
// In browser console
localStorage.setItem('authToken', 'your_test_token');
```

#### Option 3: Implement Proper Auth
See your auth documentation for proper login flow.

---

## 🎯 Quick Diagnostic Checklist

Run through this checklist:

- [ ] Backend server is running (`npm run dev` in backend folder)
- [ ] Frontend is running (`npm run dev` in root folder)
- [ ] QuantConnect credentials in `backend/.env`
- [ ] Service initialized in `backend/src/server.ts`
- [ ] Routes registered in main app file
- [ ] CORS configured properly
- [ ] Auth token in localStorage (if required)
- [ ] Browser console shows no errors
- [ ] QuantConnect tab visible in UI
- [ ] Projects loading (real or mock)

---

## 🔍 Debug Mode

### Enable Detailed Logging

#### Backend:
Add to `backend/src/services/quantconnect.service.ts`:
```typescript
console.log('QC API Request:', url, params);
console.log('QC API Response:', response.data);
```

#### Frontend:
Check browser console (F12) for:
```
Error loading projects: ...
Error creating project: ...
Error running backtest: ...
```

### Test API Manually

#### Test Projects Endpoint:
```bash
curl http://localhost:5000/api/quantconnect/projects \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test Create Project:
```bash
curl -X POST http://localhost:5000/api/quantconnect/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"Test","language":"Py"}'
```

---

## 💡 Working with Mock Data

**Mock data is enabled by default for testing!**

### When Mock Data Appears:
- ✅ Backend not running → Shows mock projects
- ✅ No credentials → Shows mock projects
- ✅ API error → Shows mock metrics
- ✅ Network issue → Fallback to mock

### Mock Data Includes:
```javascript
Projects:
- Virtual Fluorescent Pink Sheep
- Clone of BTC Dual Thrust Long Only

Metrics:
- Total P&L: ₹125,430
- Win Rate: 69.8%
- Sharpe Ratio: 1.88
- Total Trades: 289
```

### To Disable Mock Data:
Remove the catch blocks in `QuantConnectDashboard.tsx` that create mock data.

---

## 🆘 Still Not Working?

### 1. Check All Prerequisites:
- ✅ Node.js installed
- ✅ Dependencies installed (`npm install`)
- ✅ QuantConnect account created
- ✅ API credentials obtained
- ✅ Environment variables set

### 2. Start Fresh:
```bash
# Stop all servers
# Delete node_modules
rm -rf node_modules backend/node_modules

# Reinstall
npm install
cd backend && npm install

# Restart
cd backend && npm run dev
# In another terminal
npm run dev
```

### 3. Check Documentation:
- `QUANTCONNECT_SETUP.md` - Setup guide
- `QUANTCONNECT_INTEGRATION.md` - Full integration guide
- `WHERE_TO_FIND_QUANTCONNECT.md` - Navigation guide

### 4. Check Browser Console:
Press F12 and look for:
- Network errors
- JavaScript errors
- Failed API calls
- CORS issues

### 5. Check Backend Logs:
Look at terminal where backend is running for:
- Server startup messages
- API request logs
- Error messages
- QuantConnect initialization status

---

## ✅ Success Indicators

**Everything is working when you see**:

### Backend Terminal:
```
Server running on port 5000
✓ QuantConnect initialized
✓ Database connected
✓ Routes registered
```

### Frontend:
- ✅ QuantConnect tab visible
- ✅ Projects loading (with or without notice)
- ✅ "New Project" button working
- ✅ Project cards clickable
- ✅ "Run Backtest" button working
- ✅ Metrics displaying

### Browser Console:
- ✅ No red errors
- ✅ Successful API calls (200 status)
- ✅ Data loading messages

---

## 📞 Getting Help

If you're still stuck:

1. **Check the error message** - It tells you what's wrong
2. **Read the yellow notice** - It provides guidance
3. **Check browser console** - Press F12
4. **Check backend logs** - Look at terminal
5. **Review documentation** - All guides in root folder
6. **Test with mock data** - Verify UI works
7. **Test API manually** - Use curl or Postman

---

## 🎓 Understanding the Flow

```
User clicks "New Project"
    ↓
Frontend calls quantconnectService.createProject()
    ↓
Fetch request to backend API
    ↓
Backend receives request
    ↓
Backend calls QuantConnect API
    ↓
QuantConnect creates project
    ↓
Backend returns project data
    ↓
Frontend updates UI
    ↓
New project appears in list
```

**If any step fails, mock data is used as fallback!**

---

## 🚀 Pro Tips

1. **Start with mock data** - Verify UI works first
2. **Add credentials later** - Connect to real API when ready
3. **Check one thing at a time** - Don't change everything
4. **Use browser DevTools** - Network tab shows API calls
5. **Read error messages** - They're helpful!
6. **Keep backend running** - Don't stop the server
7. **Hard refresh browser** - Ctrl+Shift+R clears cache

---

**Remember: Mock data is a feature, not a bug! It allows you to test the UI without a QuantConnect account.** 🎉
