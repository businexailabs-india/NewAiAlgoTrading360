# Supabase Integration Guide

## 🎯 What is Supabase?

Supabase is an open-source Firebase alternative that provides:
- ✅ **PostgreSQL Database** - Powerful relational database
- ✅ **Authentication** - Built-in auth with JWT
- ✅ **Real-time** - Live data updates via WebSockets
- ✅ **Storage** - File storage
- ✅ **Auto-generated APIs** - REST and GraphQL
- ✅ **Row Level Security** - Database-level security

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project"
3. Create a new project
4. Choose a region (closest to your users)
5. Set a strong database password
6. Wait 2 minutes for project to be ready

### Step 2: Get Your Credentials
1. Go to Project Settings → API
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (keep this secret!)

### Step 3: Configure Backend
```bash
cd backend
cp .env.example .env
```

Edit `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

### Step 4: Create Database Tables
Run this SQL in Supabase SQL Editor:

```sql
-- Users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Broker connections
CREATE TABLE broker_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker VARCHAR(50) NOT NULL,
  api_key_encrypted TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Holdings
CREATE TABLE holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker_connection_id UUID REFERENCES broker_connections(id) ON DELETE CASCADE,
  symbol VARCHAR(50) NOT NULL,
  exchange VARCHAR(20),
  quantity INTEGER,
  average_price DECIMAL(10,2),
  last_price DECIMAL(10,2),
  pnl DECIMAL(10,2),
  pnl_percentage DECIMAL(5,2),
  current_value DECIMAL(12,2),
  invested_value DECIMAL(12,2),
  product VARCHAR(20),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Trades
CREATE TABLE trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  broker_connection_id UUID REFERENCES broker_connections(id) ON DELETE CASCADE,
  order_id VARCHAR(100),
  symbol VARCHAR(50) NOT NULL,
  exchange VARCHAR(20),
  trade_type VARCHAR(10),
  quantity INTEGER,
  price DECIMAL(10,2),
  order_type VARCHAR(20),
  product VARCHAR(20),
  status VARCHAR(20),
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Portfolios
CREATE TABLE portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  description TEXT,
  total_value DECIMAL(12,2),
  invested_value DECIMAL(12,2),
  current_value DECIMAL(12,2),
  total_pnl DECIMAL(12,2),
  total_pnl_percent DECIMAL(5,2),
  day_pnl DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User settings
CREATE TABLE user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_holdings_user_id ON holdings(user_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_created_at ON trades(created_at);
CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
```

### Step 5: Enable Row Level Security (RLS)
```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE broker_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Holdings policies
CREATE POLICY "Users can view own holdings" ON holdings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own holdings" ON holdings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own holdings" ON holdings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own holdings" ON holdings
  FOR DELETE USING (auth.uid() = user_id);

-- Similar policies for other tables...
```

### Step 6: Install Dependencies & Start
```bash
cd backend
npm install
npm run dev
```

## 📝 Usage Examples

### Basic Query
```typescript
import { supabase } from './config/supabase';

// Get all holdings for a user
const { data, error } = await supabase
  .from('holdings')
  .select('*')
  .eq('user_id', userId);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Holdings:', data);
}
```

### Insert Data
```typescript
const { data, error } = await supabase
  .from('holdings')
  .insert({
    user_id: userId,
    symbol: 'RELIANCE',
    exchange: 'NSE',
    quantity: 100,
    average_price: 2450.50,
    last_price: 2678.90
  })
  .select()
  .single();
```

### Update Data
```typescript
const { data, error } = await supabase
  .from('holdings')
  .update({ last_price: 2700.00 })
  .eq('id', holdingId)
  .select()
  .single();
```

### Delete Data
```typescript
const { error } = await supabase
  .from('holdings')
  .delete()
  .eq('id', holdingId);
```

### Complex Query with Joins
```typescript
const { data, error } = await supabase
  .from('holdings')
  .select(`
    *,
    broker_connections (
      broker,
      is_active
    )
  `)
  .eq('user_id', userId)
  .order('symbol', { ascending: true });
```

### Real-time Subscriptions
```typescript
// Subscribe to changes
const subscription = supabase
  .channel('holdings-changes')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'holdings',
      filter: `user_id=eq.${userId}`
    },
    (payload) => {
      console.log('Change received!', payload);
      // Update your UI here
    }
  )
  .subscribe();

// Unsubscribe when done
subscription.unsubscribe();
```

## 🔐 Authentication with Supabase

### Sign Up
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securePassword123',
  options: {
    data: {
      name: 'John Doe'
    }
  }
});
```

### Sign In
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securePassword123'
});

// Access token
const token = data.session?.access_token;
```

### Get Current User
```typescript
const { data: { user } } = await supabase.auth.getUser();
```

### Sign Out
```typescript
await supabase.auth.signOut();
```

## 🎨 Frontend Integration

### Install Supabase in Frontend
```bash
cd ../  # Go to frontend directory
npm install @supabase/supabase-js
```

### Create Supabase Client (Frontend)
```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### React Hook Example
```typescript
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

function Holdings() {
  const [holdings, setHoldings] = useState([]);

  useEffect(() => {
    // Fetch holdings
    const fetchHoldings = async () => {
      const { data } = await supabase
        .from('holdings')
        .select('*')
        .order('symbol');
      
      setHoldings(data || []);
    };

    fetchHoldings();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('holdings')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'holdings' },
        (payload) => {
          fetchHoldings(); // Refresh data
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div>
      {holdings.map(holding => (
        <div key={holding.id}>{holding.symbol}</div>
      ))}
    </div>
  );
}
```

## 📊 Using the Supabase Service

### In Your Controllers
```typescript
import { SupabaseService } from '../services/supabase.service';

export const getHoldings = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  
  const holdings = await SupabaseService.getHoldings(userId);
  
  res.status(200).json({
    success: true,
    data: holdings
  });
});
```

### Portfolio Summary
```typescript
const summary = await SupabaseService.getPortfolioSummary(userId);
// Returns: { totalInvested, totalCurrent, totalPnL, totalPnLPercent, holdingsCount }
```

### Real-time Updates
```typescript
// In your WebSocket handler
SupabaseService.subscribeToHoldings(userId, (payload) => {
  // Emit to connected clients
  io.to(userId).emit('holdings-update', payload);
});
```

## 🚀 Advantages Over Prisma

### Why Supabase?
1. **No Database Setup** - Hosted PostgreSQL included
2. **Built-in Auth** - No need for JWT implementation
3. **Real-time** - WebSocket support out of the box
4. **Auto APIs** - REST and GraphQL generated automatically
5. **Dashboard** - Visual database management
6. **Free Tier** - 500MB database, 1GB file storage
7. **Backups** - Automatic daily backups
8. **Scaling** - Easy to scale as you grow

### Prisma vs Supabase
| Feature | Prisma | Supabase |
|---------|--------|----------|
| Database | Self-hosted | Hosted |
| Auth | Manual | Built-in |
| Real-time | Manual | Built-in |
| APIs | Manual | Auto-generated |
| Dashboard | Prisma Studio | Full Dashboard |
| Cost | DB hosting cost | Free tier available |

## 💰 Pricing

### Free Tier
- 500MB database
- 1GB file storage
- 2GB bandwidth
- 50,000 monthly active users
- Unlimited API requests

### Pro Tier ($25/month)
- 8GB database
- 100GB file storage
- 50GB bandwidth
- 100,000 monthly active users
- Daily backups

## 🎯 Next Steps

1. ✅ Supabase client configured
2. ✅ Service layer created
3. ⏳ Create database tables (run SQL above)
4. ⏳ Enable RLS policies
5. ⏳ Update controllers to use SupabaseService
6. ⏳ Test endpoints
7. ⏳ Integrate with frontend

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Real-time](https://supabase.com/docs/guides/realtime)

**Supabase integration complete! Much simpler than managing your own database!** 🎉
