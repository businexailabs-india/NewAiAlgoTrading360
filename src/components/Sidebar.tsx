import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Briefcase,
  Layers,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  User,
  Zap,
  LogOut,
  Shield,
  Eye,
  LineChart,
  CandlestickChart,
  ScanSearch,
  FileText,
  Bell,
  Link2,
  Lock,
  Store,
  Sparkles,
  Activity,
} from 'lucide-react';
import { Badge } from './ui/badge';
import { TOP_CHROME_H } from './TopBar';
import { useTradingMode } from '@/contexts/TradingModeContext';

export const SIDEBAR_W = 80;

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout?: () => void;
  user?: { name: string | null; email: string; role: string } | null;
  onRequestLiveMode?: () => void;
  onRequestPaperMode?: () => void;
}

type NavLeaf = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: { text: string; color: string } | null;
  locked?: boolean;
  onLockedClick?: () => void;
};

type NavGroup = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

function isGroup(item: NavEntry): item is NavGroup {
  return 'children' in item;
}

export function Sidebar({
  activeSection,
  onSectionChange,
  onLogout,
  user,
  onRequestLiveMode,
  onRequestPaperMode,
}: SidebarProps) {
  const { liveLocked, mode } = useTradingMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    trade: true,
    advanced: false,
  });

  const menuItems: NavEntry[] = useMemo(
    () => [
      { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
      { id: 'dhanlaxmi', label: 'DhanLaxmi', icon: Sparkles },
      {
        id: 'tradingview-connect',
        label: 'TradingView',
        icon: Zap,
        badge: { text: 'SAFE', color: 'cyan' },
      },
      { id: 'algo-library', label: 'Algo Library', icon: Layers },
      {
        id: 'papertrade-lab',
        label: 'PaperTrade Lab',
        icon: Shield,
        badge: { text: 'SAFE', color: 'blue' },
      },
      {
        id: 'market-analytics',
        label: 'Market Analytics',
        icon: LineChart,
        badge: { text: 'PAPER', color: 'cyan' },
      },
      {
        id: 'live-approval',
        label: 'Live Approval',
        icon: FileText,
        badge: { text: 'LOCK', color: 'amber' },
      },
      {
        id: 'trade',
        label: 'Trade',
        icon: CandlestickChart,
        children: [
          { id: 'trading-terminal', label: 'Trading Terminal', icon: CandlestickChart },
          {
            id: 'trade-us-stocks',
            label: 'US Stocks (IBKR)',
            icon: CandlestickChart,
            badge: { text: 'IBKR', color: 'cyan' },
          },
          { id: 'basket-orders', label: 'Basket Orders', icon: Briefcase },
          { id: 'trade-orders', label: 'Orders', icon: FileText },
          { id: 'trade-positions', label: 'Positions', icon: Briefcase },
          {
            id: 'trade-paper-holdings',
            label: 'Paper Holdings',
            icon: Briefcase,
            badge: { text: 'PAPER', color: 'blue' },
          },
          {
            id: 'trade-paper-positions',
            label: 'Paper Positions',
            icon: Layers,
            badge: { text: 'PAPER', color: 'blue' },
          },
          {
            id: 'trade-live',
            label: 'Live Trading',
            icon: Zap,
            badge: { text: 'LOCKED', color: 'amber' },
            locked: liveLocked,
            onLockedClick: () => onSectionChange('live-approval'),
          },
        ],
      },
      { id: 'portfolio', label: 'Portfolio', icon: Briefcase, badge: { text: 'MULTI', color: 'cyan' } },
      { id: 'riskguard', label: 'RiskGuard', icon: Shield, badge: { text: 'HEALTH', color: 'amber' } },
      { id: 'watchlist', label: 'Activity', icon: Eye },
      { id: 'settings', label: 'Settings', icon: Settings },
      {
        id: 'advanced',
        label: 'Advanced',
        icon: BarChart3,
        children: [
          { id: 'execution-timeline', label: 'Execution Timeline', icon: Activity },
          { id: 'execution-governance', label: 'Control Room', icon: Shield },
          { id: 'broker-connections', label: 'BrokerConnect', icon: Link2 },
          { id: 'admin', label: 'Admin', icon: User },
          { id: 'quant-lab', label: 'Quant Lab', icon: BarChart3, badge: { text: 'OPTIONAL', color: 'purple' } },
          { id: 'algo-suitability', label: 'Algo Suitability', icon: Layers },
          { id: 'risk-center', label: 'Risk Center (legacy)', icon: Shield },
        ],
      },
    ],
    [liveLocked, onSectionChange]
  );

  const bottomItems = [
    { id: 'admin', label: 'Admin', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'blue':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'amber':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'red':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'purple':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default:
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    }
  };

  function clickLeaf(item: NavLeaf) {
    if (item.locked) {
      item.onLockedClick?.();
      return;
    }
    if (item.id === 'trade-live') {
      if (mode !== 'live') onRequestLiveMode?.();
      onSectionChange(item.id);
      return;
    }
    if (item.id === 'trade-paper') {
      if (mode !== 'paper') onRequestPaperMode?.();
      onSectionChange(item.id);
      return;
    }
    onSectionChange(item.id);
  }

  function renderLeaf(item: NavLeaf, nested = false) {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    return (
      <motion.button
        key={item.id}
        type="button"
        onClick={() => clickLeaf(item)}
        className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
          isActive ? 'text-cyan-200' : 'text-gray-400 hover:text-white'
        } ${nested && isExpanded ? 'ml-2' : ''}`}
        style={
          isActive
            ? {
                background:
                  item.id === 'trade-live'
                    ? 'linear-gradient(90deg, rgba(251,146,60,0.25) 0%, rgba(220,38,38,0.15) 100%)'
                    : item.id === 'trade-paper'
                      ? 'linear-gradient(90deg, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.16) 100%)'
                      : 'linear-gradient(90deg, rgba(34,211,238,0.28) 0%, rgba(16,185,129,0.18) 100%)',
                border:
                  item.id === 'trade-live'
                    ? '1px solid rgba(251,146,60,0.5)'
                    : '1px solid rgba(34,211,238,0.45)',
              }
            : {
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }
        }
      >
        {item.locked ? <Lock className="h-4 w-4 flex-shrink-0 text-orange-300" /> : <Icon className="h-4 w-4 flex-shrink-0" />}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-between gap-2 min-w-0"
            >
              <span className="truncate text-sm">{item.label}</span>
              {item.badge ? (
                <Badge className={`${getBadgeColor(item.badge.color)} shrink-0 px-1.5 py-0 text-[10px]`}>
                  {item.badge.text}
                </Badge>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
        {!isExpanded && (
          <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
            {item.label}
            {item.locked ? ' (locked)' : ''}
          </div>
        )}
      </motion.button>
    );
  }

  return (
    <motion.div
      className="fixed left-0 z-40 flex flex-col overflow-hidden"
      style={{
        top: TOP_CHROME_H,
        height: `calc(100vh - ${TOP_CHROME_H}px)`,
        background:
          'linear-gradient(180deg, rgba(2,6,23,1) 0%, rgba(8,47,73,0.98) 35%, rgba(6,78,59,0.35) 100%)',
        borderRight: '1px solid rgba(34,211,238,0.35)',
        boxShadow: '8px 0 28px rgba(0,0,0,0.45)',
        backdropFilter: 'blur(18px)',
      }}
      initial={{ width: SIDEBAR_W }}
      animate={{ width: isExpanded ? 260 : SIDEBAR_W }}
      transition={{ duration: 0.25 }}
      onMouseEnter={() => {
        if (!isPinned) setIsExpanded(true);
      }}
      onMouseLeave={() => {
        if (!isPinned) setIsExpanded(false);
      }}
    >
      <div className="flex items-center justify-center border-b border-cyan-500/20 px-2 py-2" style={{ minHeight: 40 }}>
        <button
          type="button"
          onClick={() => {
            setIsPinned((p) => !p);
            setIsExpanded((e) => (!isPinned ? true : e));
          }}
          className="flex h-8 w-full items-center justify-center rounded-lg text-slate-400 hover:text-cyan-300"
          title={isPinned ? 'Unpin' : 'Pin'}
        >
          {isExpanded ? (
            <span className="flex w-full items-center justify-between px-2 text-xs">
              Main menu {isPinned ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </span>
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="no-scrollbar flex-1 space-y-1.5 overflow-y-auto px-2.5 py-3">
        {menuItems.map((item) => {
          if (!isGroup(item)) return renderLeaf(item);
          const Icon = item.icon;
          const open = openGroups[item.id];
          const childActive = item.children.some((c) => c.id === activeSection);
          return (
            <div key={item.id} className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  if (!isExpanded) {
                    setIsExpanded(true);
                    setOpenGroups((g) => ({ ...g, [item.id]: true }));
                    return;
                  }
                  setOpenGroups((g) => ({ ...g, [item.id]: !g[item.id] }));
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                  childActive ? 'text-cyan-200' : 'text-slate-400 hover:text-white'
                }`}
                style={{
                  background: childActive ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {isExpanded ? (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
                  </>
                ) : null}
              </button>
              {isExpanded && open ? (
                <div className="space-y-1 pl-1">{item.children.map((c) => renderLeaf(c, true))}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 border-t border-cyan-500/20 bg-slate-950/55 px-2.5 py-3">
        {bottomItems.map((item) => renderLeaf(item as NavLeaf))}
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            {isExpanded ? <span className="text-sm">Logout</span> : null}
          </button>
        ) : null}
      </div>

      <div className="border-t border-cyan-500/20 p-2.5">
        <div
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isExpanded ? '' : 'justify-center'}`}
          style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.25)' }}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm text-white">
            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
          {isExpanded ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">{user?.name || 'Trader'}</div>
              <div className="truncate text-[10px] text-slate-400">{user?.email || ''}</div>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
