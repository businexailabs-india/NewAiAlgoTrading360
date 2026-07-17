import { ReactNode } from 'react';
import {
  LayoutDashboard,
  Zap,
  Briefcase,
  Brain,
  Layers,
  BarChart3,
  Receipt
} from 'lucide-react';

interface TopBarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  children?: ReactNode;
}

const quickNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'smart-trading', label: 'Smart Trading', icon: Zap },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'ai-advisor', label: 'AI Advisor', icon: Brain },
  { id: 'strategies', label: 'Strategies', icon: Layers },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'tax-reports', label: 'Tax', icon: Receipt }
];

export function TopBar({ activeSection, onSectionChange, children }: TopBarProps) {
  return (
    <header className="fixed left-20 right-0 top-0 z-30 h-16 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      <div className="flex h-full items-center gap-4 px-6">
        <div className="hidden items-center gap-2 pr-2 lg:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-600 text-white shadow-[0_0_14px_rgba(34,211,238,0.4)]">
            <LayoutDashboard className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold text-white">AlgoTradingV360</span>
        </div>

        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
          {quickNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.2)]'
                    : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">{children}</div>
      </div>
    </header>
  );
}
