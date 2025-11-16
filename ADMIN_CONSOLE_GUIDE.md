# Admin Console Guide

## 🎯 Overview

The **Admin Console** is a comprehensive dashboard for system administrators to monitor, manage, and control the SmartTrade Portfolio Optimizer platform.

## 🚀 Access

**Location**: Click the **Shield icon** (Admin) in the bottom of the sidebar

**Features Available**:
- Real-time system monitoring
- User management
- Revenue analytics
- API performance tracking
- System alerts & notifications
- Database operations

## 📊 Dashboard Sections

### 1. **Overview Tab**

#### Key Metrics (Top Cards)
- **Total Users**: 12,847 users (+12.5% growth)
- **Active Users**: 8,234 currently active (+8.3%)
- **Total Revenue**: ₹4.57 Cr (+15.7%)
- **API Calls**: 2.85M total calls (+23.1%)

#### Revenue & User Growth Chart
- Line chart showing monthly revenue trends
- User acquisition overlay
- 6-month historical data
- Interactive tooltips with detailed metrics

#### User Activity (24h)
- Bar chart showing hourly active users
- Peak usage times identification
- Real-time activity monitoring
- Helps optimize server resources

#### Subscription Distribution
- Pie chart showing plan breakdown:
  - **Free**: 3,500 users (28.8%)
  - **Basic**: 4,200 users (34.6%)
  - **Pro**: 2,800 users (23.1%)
  - **Enterprise**: 1,376 users (11.3%)

### 2. **Users Tab**

#### User Management Features
- **Search**: Find users by name, email, or ID
- **Filters**: Filter by plan, status, date joined
- **Add User**: Create new user accounts
- **Bulk Actions**: Export, email, manage multiple users

#### User Table Columns
- **User Info**: Name, email, profile picture
- **Plan**: Free, Basic, Pro, Enterprise
- **Status**: Active, Pending, Suspended
- **Revenue**: Total revenue from user
- **Joined Date**: Account creation date
- **Actions**: View, Edit, Delete, More options

#### User Actions
- 👁️ **View**: See full user profile
- ✏️ **Edit**: Modify user details
- 🗑️ **Delete**: Remove user account
- ⋮ **More**: Additional options (suspend, email, etc.)

### 3. **System Tab**

#### System Health Metrics
- **System Uptime**: 99.98% (excellent)
- **Avg Response Time**: 145ms (fast)
- **Error Rate**: 0.02% (very low)
- **Active Subscriptions**: 9,876 active

#### System Actions
Available operations:
- 💾 **Backup Database**: Create full system backup
- 📥 **Export Logs**: Download system logs
- 📤 **Import Data**: Bulk data import
- 🔄 **Clear Cache**: Clear application cache
- 📧 **Send Bulk Email**: Email all users
- ⚙️ **System Config**: Modify system settings

### 4. **API Monitor Tab**

#### API Endpoint Performance
Real-time monitoring of all API endpoints:

| Endpoint | Calls | Avg Time | Error Rate | Status |
|----------|-------|----------|------------|--------|
| `/api/portfolio/holdings` | 145,678 | 120ms | 0.01% | 🟢 Healthy |
| `/api/market/data` | 892,341 | 85ms | 0.02% | 🟢 Healthy |
| `/api/trading/orders` | 67,234 | 210ms | 0.05% | 🟡 Warning |
| `/api/user/profile` | 234,567 | 95ms | 0.01% | 🟢 Healthy |
| `/api/broker/connect` | 12,456 | 450ms | 0.15% | 🔴 Critical |

#### Status Indicators
- 🟢 **Healthy**: < 200ms response, < 1% errors
- 🟡 **Warning**: 200-400ms response, 1-5% errors
- 🔴 **Critical**: > 400ms response, > 5% errors

### 5. **Alerts Tab**

#### System Alerts
Real-time notifications for:
- ⚠️ **High API Usage**: Server load warnings
- ❌ **Database Issues**: Backup failures, connection issues
- ℹ️ **System Updates**: Deployment notifications
- 🔒 **Security Alerts**: SSL expiry, unauthorized access

#### Alert Severity Levels
- 🔴 **High**: Immediate action required
- 🟡 **Medium**: Monitor and plan action
- 🔵 **Low**: Informational only

#### Alert Actions
- 👁️ **View Details**: See full alert information
- ❌ **Dismiss**: Mark alert as resolved
- 📧 **Notify Team**: Send alert to team members

## 🎨 Features

### Real-Time Updates
- Auto-refresh every 30 seconds
- Manual refresh button available
- Live data streaming for critical metrics

### Time Range Selection
Filter data by:
- Last 24 hours
- Last 7 days (default)
- Last 30 days
- Last 90 days

### Interactive Charts
- Hover for detailed tooltips
- Click to drill down
- Export chart data
- Responsive design

### Search & Filter
- Global search across all users
- Advanced filters by multiple criteria
- Saved filter presets
- Export filtered results

## 🔐 Security Features

### Access Control
- Admin-only access (role-based)
- Activity logging for all actions
- Audit trail for sensitive operations
- Session timeout after inactivity

### Data Protection
- Encrypted data transmission
- Secure API endpoints
- Rate limiting on admin actions
- Two-factor authentication required

## 📈 Use Cases

### 1. Monitor System Health
```
1. Open Admin Console
2. Check Overview tab for key metrics
3. Review API Monitor for performance
4. Check Alerts for any issues
```

### 2. Manage Users
```
1. Go to Users tab
2. Search for specific user
3. View user details
4. Take action (edit, suspend, etc.)
```

### 3. Analyze Revenue
```
1. View Revenue & User Growth chart
2. Check subscription distribution
3. Identify growth trends
4. Export data for reporting
```

### 4. Troubleshoot Issues
```
1. Check Alerts tab for recent issues
2. Review API Monitor for slow endpoints
3. Check System tab for health metrics
4. Export logs for detailed analysis
```

### 5. Perform Maintenance
```
1. Go to System tab
2. Click "Backup Database"
3. Clear cache if needed
4. Review system config
```

## 🛠️ Admin Operations

### Database Backup
```typescript
// Automated daily backups
// Manual backup available in System tab
// Retention: 30 days
// Storage: Encrypted cloud storage
```

### User Management
```typescript
// Create, read, update, delete users
// Bulk operations supported
// Email notifications automatic
// Activity tracking enabled
```

### System Configuration
```typescript
// Modify system settings
// Update feature flags
// Configure integrations
// Set rate limits
```

## 📊 Metrics Explained

### System Uptime
- **Target**: > 99.9%
- **Current**: 99.98%
- **Calculation**: (Total time - Downtime) / Total time

### Response Time
- **Target**: < 200ms
- **Current**: 145ms average
- **Measured**: Server response time for API calls

### Error Rate
- **Target**: < 0.1%
- **Current**: 0.02%
- **Calculation**: (Failed requests / Total requests) × 100

### Active Users
- **Definition**: Users with activity in last 24h
- **Includes**: Login, trades, portfolio views
- **Excludes**: Inactive sessions

## 🎯 Best Practices

### Daily Tasks
- [ ] Check system health metrics
- [ ] Review new alerts
- [ ] Monitor API performance
- [ ] Check user growth trends

### Weekly Tasks
- [ ] Review revenue analytics
- [ ] Analyze user activity patterns
- [ ] Check subscription distribution
- [ ] Export weekly reports

### Monthly Tasks
- [ ] Full system audit
- [ ] Database optimization
- [ ] Security review
- [ ] Performance optimization

## 🚨 Emergency Procedures

### High Error Rate
1. Check API Monitor tab
2. Identify failing endpoints
3. Review system logs
4. Scale resources if needed
5. Notify engineering team

### Database Issues
1. Check System tab health
2. Attempt manual backup
3. Review error logs
4. Contact database admin
5. Initiate failover if critical

### Security Alert
1. Review alert details
2. Check user activity logs
3. Suspend suspicious accounts
4. Change API keys if compromised
5. Notify security team

## 📱 Mobile Access

The Admin Console is **fully responsive**:
- ✅ Works on tablets
- ✅ Optimized for mobile
- ✅ Touch-friendly interface
- ✅ Swipe gestures supported

## 🔄 Auto-Refresh

Data automatically refreshes:
- **Overview metrics**: Every 30 seconds
- **User list**: Every 60 seconds
- **API stats**: Every 15 seconds
- **Alerts**: Real-time (WebSocket)

## 📥 Export Options

Export data in multiple formats:
- **CSV**: User lists, revenue data
- **JSON**: API metrics, system logs
- **PDF**: Reports and analytics
- **Excel**: Financial reports

## 🎨 Customization

Admins can customize:
- Dashboard layout
- Metric cards display
- Chart preferences
- Alert thresholds
- Email notifications

## 🔗 Integration

Admin Console integrates with:
- User management system
- Payment gateway
- Email service
- Analytics platform
- Monitoring tools

## 📚 Additional Resources

- **API Documentation**: `/docs/api`
- **User Guide**: `/docs/users`
- **System Architecture**: `/docs/architecture`
- **Security Policies**: `/docs/security`

## 💡 Tips & Tricks

1. **Keyboard Shortcuts**
   - `Ctrl + R`: Refresh data
   - `Ctrl + F`: Focus search
   - `Ctrl + E`: Export current view

2. **Quick Actions**
   - Double-click user row to edit
   - Right-click for context menu
   - Drag columns to reorder

3. **Performance**
   - Use time range filters to reduce load
   - Export large datasets instead of viewing
   - Clear browser cache periodically

## 🎯 Summary

The Admin Console provides:
- ✅ **Complete visibility** into system operations
- ✅ **Powerful tools** for user management
- ✅ **Real-time monitoring** of all metrics
- ✅ **Quick actions** for common tasks
- ✅ **Professional interface** with modern design

**Access it now by clicking the Shield icon in the sidebar!** 🛡️
