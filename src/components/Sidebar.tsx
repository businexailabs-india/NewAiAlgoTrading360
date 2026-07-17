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
  Shield
} from 'lucide-react';
import { Badge } from './ui/badge';

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
    id: 'portfolio',
    label: 'Portfolio',
    icon: Briefcase,
    badge: null
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
    label: 'Admin',
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
      className="fixed left-0 top-0 h-screen bg-gray-900/95 backdrop-blur-xl border-r border-gray-800 z-40 flex flex-col"
      initial={{ width: 80 }}
      animate={{ width: isExpanded ? 240 : 80 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo & Pin Button */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-gray-800">
        <motion.div
          className="flex items-center gap-3"
          initial={false}
          animate={{ opacity: isExpanded ? 1 : 0 }}
        >
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="text-white font-semibold">BusineXAi</div>
                <div className="text-xs text-gray-400">Solutions Lab</div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {!isExpanded && (
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
        )}

        <AnimatePresence>
          {isExpanded && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={togglePin}
              className={`p-1 rounded hover:bg-gray-800 transition-colors ${
                isPinned ? 'text-cyan-400' : 'text-gray-400'
              }`}
            >
              {isPinned ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Main Menu Items */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
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
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative group ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 text-cyan-400'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              {/* Active Indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 w-1 h-8 bg-cyan-400 rounded-r-full"
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
      <div className="border-t border-gray-800 py-4 px-3 space-y-2">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative group ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 text-cyan-400'
                  : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-cyan-400' : ''}`} />

              <AnimatePresence>
                {isExpanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap"
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
      <div className="border-t border-gray-800 p-3">
        <motion.div
          className={`flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-800/50 ${
            isExpanded ? '' : 'justify-center'
          }`}
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