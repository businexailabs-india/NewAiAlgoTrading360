# Settings Persistence Guide

## Overview

The Settings Panel now has **full persistence** using browser localStorage. All your preferences are automatically saved and restored when you return to the application.

## Features Implemented

### ✅ Auto-Save Functionality
- Settings automatically save 1 second after any change (debounced)
- No need to manually click save for most changes
- Success notification appears when settings are saved

### ✅ Persistent Settings

#### **1. General Settings**
- Language (English, Hindi, Marathi, Tamil)
- Currency (INR, USD, EUR)
- Timezone (IST, EST, GMT)

#### **2. Notifications**
- Email Alerts
- Push Notifications
- Trade Executions
- Price Alerts
- Anomaly Detection
- Daily Reports
- Weekly Reports

#### **3. Security**
- Two-Factor Authentication toggle
- Password change (UI ready, needs backend)
- Active sessions display

#### **4. API Keys**
- Show/Hide API keys
- API key management (UI ready, needs backend)

#### **5. Trading Settings**
- Default Order Type (Market/Limit/Stop Loss)
- Default Quantity
- Max Position Size (₹)
- Default Stop Loss (%)
- Default Target (%)

#### **6. Appearance**
- Theme (Dark/Light)
- Chart Color Scheme (Green/Red, Blue/Orange, Purple/Yellow)

## How It Works

### Storage Location
Settings are stored in browser localStorage under the key: `smarttrade_settings`

### Data Structure
```json
{
  "notifications": {
    "emailAlerts": true,
    "pushNotifications": true,
    "tradeExecutions": true,
    "priceAlerts": true,
    "anomalyDetection": true,
    "dailyReports": false,
    "weeklyReports": true
  },
  "general": {
    "language": "en",
    "currency": "INR",
    "timezone": "Asia/Kolkata"
  },
  "appearance": {
    "theme": "dark",
    "chartColorScheme": "green-red"
  },
  "trading": {
    "defaultOrderType": "market",
    "defaultQuantity": 100,
    "maxPositionSize": 100000,
    "defaultStopLoss": 3.5,
    "defaultTarget": 5.0
  },
  "security": {
    "twoFactorEnabled": true
  },
  "lastUpdated": "2025-01-16T07:24:00.000Z"
}
```

### Auto-Save Behavior

Settings automatically save when you:
- Toggle any notification switch
- Change language, currency, or timezone
- Switch themes
- Change chart color scheme
- Toggle two-factor authentication

**Debounce**: Changes are saved 1 second after the last modification to prevent excessive writes.

### Manual Save

You can also manually save by clicking the **"Save Changes"** button in any tab. This will:
1. Immediately save all settings
2. Show a success notification
3. Log the saved settings to console

## Usage Examples

### Check Current Settings
Open browser console and run:
```javascript
JSON.parse(localStorage.getItem('smarttrade_settings'))
```

### Clear All Settings
To reset to defaults:
```javascript
localStorage.removeItem('smarttrade_settings')
// Then refresh the page
```

### Export Settings
```javascript
const settings = localStorage.getItem('smarttrade_settings');
console.log(settings); // Copy this to backup
```

### Import Settings
```javascript
const backupSettings = '{"notifications":{...}}'; // Your backup
localStorage.setItem('smarttrade_settings', backupSettings);
// Then refresh the page
```

## Benefits

### ✅ Persistence Across Sessions
- Settings survive page refreshes
- Settings survive browser restarts
- Settings persist until you clear browser data

### ✅ User Experience
- No need to reconfigure every time
- Instant feedback with success notifications
- Seamless experience across sessions

### ✅ Performance
- Debounced saves prevent excessive writes
- Efficient localStorage usage
- Fast load times

## Limitations & Future Enhancements

### Current Limitations
1. **Browser-Specific**: Settings don't sync across devices or browsers
2. **No Cloud Backup**: Clearing browser data loses settings
3. **No Version Control**: Can't revert to previous settings

### Planned Enhancements
- [ ] Cloud sync via backend API
- [ ] Settings export/import UI
- [ ] Settings history/versioning
- [ ] Multi-device sync
- [ ] Settings profiles (e.g., "Conservative", "Aggressive")
- [ ] Encrypted storage for sensitive settings

## Backend Integration (Future)

To sync settings to a backend server, update the `saveAllSettings` function:

```typescript
const saveAllSettings = async () => {
  const settings = {
    // ... current settings
  };

  try {
    // Save to localStorage (current)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    
    // Also save to backend (future)
    await fetch('/api/user/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(settings)
    });
    
    setSaveSuccess(true);
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
};
```

## Testing

### Test Auto-Save
1. Go to Settings panel
2. Toggle any notification switch
3. Wait 1 second
4. Refresh the page
5. Verify the toggle state is preserved

### Test Manual Save
1. Change multiple settings
2. Click "Save Changes" button
3. See success notification
4. Refresh the page
5. Verify all changes are preserved

### Test Trading Settings
1. Change default quantity to 500
2. Change stop loss to 5%
3. Click "Save Trading Settings"
4. Refresh the page
5. Verify values are preserved

## Troubleshooting

### Settings Not Saving
- Check browser console for errors
- Verify localStorage is enabled in browser
- Check if browser is in private/incognito mode
- Try clearing localStorage and refreshing

### Settings Reset After Refresh
- Check if localStorage is disabled
- Verify browser allows localStorage
- Check for JavaScript errors in console

### Success Notification Not Showing
- This is normal for auto-save (silent)
- Manual save always shows notification
- Check console for "Settings saved successfully" log

## Security Notes

⚠️ **Important**: 
- Settings are stored in plain text in localStorage
- Don't store sensitive data (passwords, API keys) in settings
- API keys should be stored securely on backend
- Consider encryption for production deployment

## Summary

Your settings are now **fully persistent** with:
- ✅ Auto-save (1 second debounce)
- ✅ Manual save with confirmation
- ✅ Success notifications
- ✅ Default values fallback
- ✅ Error handling
- ✅ Console logging for debugging

All settings survive page refreshes and browser restarts! 🎉
