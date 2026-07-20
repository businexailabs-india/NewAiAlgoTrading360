import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Activity, 
  Briefcase, 
  Brain, 
  Layers, 
  BarChart3, 
  Receipt, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  User,
  TrendingUp,
  Zap,
  AlertCircle,
  FileText,
  LogOut,
  Shield,
  Rocket,
  Eye
} from 'lucide-react';
import { Badge } from './ui/badge';
import { TOP_CHROME_H } from './TopBar';

export const SIDEBAR_W = 80;

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onLogout?: () => void;
  user?: { name: string | null; email: string; role: string } | null;
}

const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    badge: null
  },
  {
    id: 'smart-trading',
    label: 'Smart Trading',
    icon: Zap,
    badge: null
  },
  {
    id: 'algos',
    label: 'Algos',
    icon: Rocket,
    badge: { text: 'New', color: 'green' }
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: Briefcase,
    badge: null
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: Eye,
    badge: { text: 'New', color: 'cyan' }
  },
  {
    id: 'ai-advisor',
    label: 'AI Advisor',
    icon: Brain,
    badge: null
  },
  {
    id: 'strategies',
    label: 'Strategies',
    icon: Layers,
    badge: null
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    badge: null
  },
  {
    id: 'anomalies',
    label: 'Anomalies',
    icon: AlertCircle,
    badge: null
  },
  {
    id: 'tax-reports',
    label: 'Tax Reports',
    icon: Receipt,
    badge: null
  },
  {
    id: 'integration-guide',
    label: 'Integration Guide',
    icon: FileText,
    badge: { text: 'New', color: 'cyan' }
  },
  {
    id: 'heatmap-analysis',
    label: 'Heat Map Analysis',
    icon: BarChart3,
    badge: { text: 'New', color: 'purple' }
  },
  {
    id: 'auto-trading',
    label: 'Auto Trading',
    icon: Zap,
    badge: { text: 'New', color: 'green' }
  },
  {
    id: 'knowledge-llm',
    label: 'Knowledge & LLM',
    icon: FileText,
    badge: { text: 'RAG', color: 'cyan' }
  },
  {
    id: 'predictions',
    label: 'Prediction Engines',
    icon: Brain,
    badge: { text: 'ML', color: 'purple' }
  }
];

const bottomItems = [
  {
    id: 'admin',
    label: 'Admin / MCP',
    icon: Shield
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User
  }
];

export function Sidebar({ activeSection, onSectionChange, onLogout, user }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const handleMouseEnter = () => {
    if (!isPinned) {
      setIsExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      setIsExpanded(false);
    }
  };

  const togglePin = () => {
    setIsPinned(!isPinned);
    setIsExpanded(!isPinned);
  };

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'green':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'purple':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'red':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    }
  };

  return (
    <motion.div
      className="fixed left-0 z-40 flex flex-col overflow-hidden"
      style={{
        top: TOP_CHROME_H,
        height: `calc(100vh - ${TOP_CHROME_H}px)`,
        background:
          'linear-gradient(180deg, rgba(2,6,23,1) 0%, rgba(8,47,73,0.98) 35%, rgba(6,78,59,0.35) 100%)',
        borderRight: '1px solid rgba(34,211,238,0.35)',
        boxShadow:
          '8px 0 28px rgba(0,0,0,0.45), inset -1px 0 0 rgba(34,211,238,0.18), 0 0 30px rgba(16,185,129,0.08)',
        backdropFilter: 'blur(18px)'
      }}
      initial={{ width: SIDEBAR_W }}
      animate={{ width: isExpanded ? 240 : SIDEBAR_W }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Compact pin — brand lives in the top menu above */}
      <div
        className="flex items-center justify-center px-2 py-2"
        style={{
          borderBottom: '1px solid rgba(34,211,238,0.2)',
          minHeight: 40
        }}
      >
        {isExpanded ? (
          <button
            type="button"
            onClick={togglePin}
            title={isPinned ? 'Unpin menu' : 'Pin menu'}
            className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
              isPinned ? 'text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span className="font-medium">Main menu</span>
            {isPinned ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={togglePin}
            title="Expand menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-cyan-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Section icons under the top Algos menu */}
      <div className="no-scrollbar flex-1 space-y-2 overflow-x-hidden overflow-y-auto px-3 py-3">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSectionChange(item.id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                isActive ? 'text-cyan-200' : 'text-gray-400 hover:text-white'
              }`}
              style={
                isActive
                  ? {
                      background:
                        'linear-gradient(90deg, rgba(34,211,238,0.28) 0%, rgba(16,185,129,0.18) 100%)',
                      border: '1px solid rgba(34,211,238,0.45)',
                      boxShadow: '0 0 16px rgba(34,211,238,0.2)'
                    }
                  : {
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }
              }
            >
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 h-8 w-1 rounded-r-full bg-cyan-300"
                  style={{ boxShadow: '0 0 10px rgba(34,211,238,0.8)' }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-cyan-400' : ''}`} />

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between flex-1"
                  >
                    <span className="text-sm whitespace-nowrap">{item.label}</span>
                    {item.badge && (
                      <Badge className={`${getBadgeColor(item.badge.color)} text-xs px-2 py-0`}>
                        {item.badge.text}
                      </Badge>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tooltip for collapsed state */}
              {!isExpanded && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
                  {item.label}
                  {item.badge && (
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getBadgeColor(item.badge.color)}`}>
                      {item.badge.text}
                    </span>
                  )}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Bottom Menu Items */}
      <div
        className="space-y-2 px-3 py-4"
        style={{
          borderTop: '1px solid rgba(34,211,238,0.22)',
          background: 'rgba(2,6,23,0.55)'
        }}
      >
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                isActive ? 'text-cyan-200' : 'text-gray-400 hover:text-white'
              }`}
              style={
                isActive
                  ? {
                      background:
                        'linear-gradient(90deg, rgba(34,211,238,0.28) 0%, rgba(16,185,129,0.18) 100%)',
                      border: '1px solid rgba(34,211,238,0.45)',
                      boxShadow: '0 0 16px rgba(34,211,238,0.2)'
                    }
                  : {
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }
              }
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-cyan-300' : ''}`} />

              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap text-sm"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip for collapsed state */}
              {!isExpanded && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-gray-700">
                  {item.label}
                </div>
              )}
            </motion.button>
          );
        })}

        {onLogout && (
          <motion.button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all relative group border border-transparent hover:border-red-500/30"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {isExpanded && <span className="text-sm whitespace-nowrap">Logout</span>}
          </motion.button>
        )}
      </div>

      {/* User Info at Bottom */}
      <div
        className="p-3"
        style={{ borderTop: '1px solid rgba(34,211,238,0.22)' }}
      >
        <motion.div
          className={`flex items-center gap-3 rounded-xl px-3 py-3 ${
            isExpanded ? '' : 'justify-center'
          }`}
          style={{
            background: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.25)'
          }}
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-white flex-shrink-0">
            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex-1 min-w-0"
              >
                <div className="text-sm text-white truncate">{user?.name || 'Trader'}</div>
                <div className="text-xs text-gray-400 truncate">{user?.email || 'Not signed in'}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}