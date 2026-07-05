export interface DemoAccount {
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  title: string;
  description: string;
  accent: string;
  initials: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'demo.trader@smarttrade.app',
    password: 'Demo@2026!',
    name: 'Priya Sharma',
    role: 'user',
    title: 'Active Trader',
    description: 'NSE portfolio, ML predictions & live strategies',
    accent: 'from-cyan-500 to-emerald-500',
    initials: 'PS'
  },
  {
    email: 'demo.analyst@smarttrade.app',
    password: 'Demo@2026!',
    name: 'Arjun Mehta',
    role: 'user',
    title: 'Quant Analyst',
    description: 'Backtests, screener & prediction engines',
    accent: 'from-violet-500 to-purple-500',
    initials: 'AM'
  },
  {
    email: 'demo.admin@smarttrade.app',
    password: 'Demo@2026!',
    name: 'Admin Demo',
    role: 'admin',
    title: 'Platform Admin',
    description: 'Full access including admin console',
    accent: 'from-amber-500 to-orange-500',
    initials: 'AD'
  }
];
