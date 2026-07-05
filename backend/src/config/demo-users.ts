export interface DemoUserDefinition {
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  title: string;
  description: string;
}

export const DEMO_USERS: DemoUserDefinition[] = [
  {
    email: 'demo.trader@smarttrade.app',
    password: 'Demo@2026!',
    name: 'Priya Sharma',
    role: 'user',
    title: 'Active Trader',
    description: 'NSE portfolio, ML predictions & live strategies'
  },
  {
    email: 'demo.analyst@smarttrade.app',
    password: 'Demo@2026!',
    name: 'Arjun Mehta',
    role: 'user',
    title: 'Quant Analyst',
    description: 'Backtests, screener & prediction engines'
  },
  {
    email: 'demo.admin@smarttrade.app',
    password: 'Demo@2026!',
    name: 'Admin Demo',
    role: 'admin',
    title: 'Platform Admin',
    description: 'Full access including admin console'
  }
];
