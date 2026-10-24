import { useEffect, useState } from 'react';
import { ChevronDown, Link as LinkIcon, Loader2, Settings } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { integrationService, BrokerAccountView } from '../services/integrationService';
import { portfolioService, PortfolioSummary, PortfolioView } from '../services/portfolioService';

interface UserProfileHeaderProps {
  onPortfolioChange: (portfolioId: string) => void;
  onManageAccounts: () => void;
  onSettings: () => void;
  /** Compact controls for the market ticker strip. */
  compact?: boolean;
}

export function UserProfileHeader({
  onPortfolioChange,
  onManageAccounts,
  onSettings,
  compact = false
}: UserProfileHeaderProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const light = theme === 'light';
  const [portfolios, setPortfolios] = useState<PortfolioView[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [accounts, setAccounts] = useState<BrokerAccountView[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      portfolioService.getPortfolios(),
      portfolioService.getSummary(),
      integrationService.listAccounts()
    ]).then(([portfolioResult, summaryResult, accountResult]) => {
      if (!active) return;
      const loaded = portfolioResult.status === 'fulfilled' ? portfolioResult.value : [];
      setPortfolios(loaded);
      setSelectedPortfolio(loaded[0] ?? null);
      if (loaded[0]) onPortfolioChange(loaded[0].id);
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
      if (accountResult.status === 'fulfilled') setAccounts(accountResult.value);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [onPortfolioChange]);

  const handlePortfolioSwitch = (portfolio: PortfolioView) => {
    setSelectedPortfolio(portfolio);
    onPortfolioChange(portfolio.id);
  };

  const initials = (user?.name || user?.email || 'U').slice(0, 2).toUpperCase();
  const valueLabel = summary
    ? `₹${summary.totalCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '₹0.00';

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
          marginLeft: 'auto'
        }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                borderRadius: 8,
                border: light ? '1px solid #cbd5e1' : '1px solid rgba(148,163,184,0.25)',
                background: light ? '#ffffff' : 'rgba(15,23,42,0.65)',
                color: light ? '#0f172a' : '#e2e8f0',
                cursor: 'pointer',
                maxWidth: 220
              }}
            >
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loading ? 'Loading…' : selectedPortfolio?.name || 'No portfolios'}
                  </span>
                  {accounts.length > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: 'rgba(34,211,238,0.15)',
                        color: '#67e8f9',
                        border: '1px solid rgba(34,211,238,0.35)',
                        flexShrink: 0
                      }}
                    >
                      {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{valueLabel}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[280px] bg-gray-900 border-gray-700">
            <DropdownMenuLabel className="text-gray-400">Your Portfolios</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-700" />
            {loading && (
              <DropdownMenuItem disabled>
                <Loader2 className="w-4 h-4 mr-2" />
                Loading…
              </DropdownMenuItem>
            )}
            {!loading && portfolios.length === 0 && (
              <DropdownMenuItem disabled className="text-gray-500">
                No portfolios yet
              </DropdownMenuItem>
            )}
            {portfolios.map((portfolio) => (
              <DropdownMenuItem
                key={portfolio.id}
                onClick={() => handlePortfolioSwitch(portfolio)}
                className={`cursor-pointer ${
                  portfolio.id === selectedPortfolio?.id
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {portfolio.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          title="Manage Accounts"
          aria-label="Manage Accounts"
          onClick={onManageAccounts}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            padding: 0,
            borderRadius: 8,
            border: light ? '1px solid #cbd5e1' : '1px solid rgba(148,163,184,0.25)',
            background: light ? '#ffffff' : 'rgba(15,23,42,0.5)',
            color: light ? '#0f172a' : '#e2e8f0',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title={user?.name || 'Account'}
              aria-label="Account menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 34,
                height: 34,
                padding: 0,
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#e2e8f0',
                flexShrink: 0
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff'
                }}
              >
                {initials}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-gray-900 border-gray-700">
            <DropdownMenuLabel className="text-gray-400">My Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-700" />
            <DropdownMenuItem onClick={onSettings} className="cursor-pointer text-gray-300 hover:bg-gray-800">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onManageAccounts} className="cursor-pointer text-gray-300 hover:bg-gray-800">
              <LinkIcon className="w-4 h-4 mr-2" />
              Linked Accounts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/50 p-4 backdrop-blur-sm">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex h-auto items-center gap-3 border-gray-700 px-4 py-3 hover:bg-gray-800">
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-white">
                  {loading ? 'Loading portfolios…' : selectedPortfolio?.name || 'No portfolios'}
                </span>
                {accounts.length > 0 && (
                  <Badge className="border-cyan-500/30 bg-cyan-500/20 text-xs text-cyan-400">
                    {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-400">
                {summary
                  ? `₹${summary.totalCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : 'Portfolio value unavailable'}
              </div>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 text-gray-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[320px] border-gray-700 bg-gray-900">
          <DropdownMenuLabel className="text-gray-400">Your Portfolios</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-700" />
          {loading && (
            <DropdownMenuItem disabled>
              <Loader2 className="mr-2 h-4 w-4" />
              Loading…
            </DropdownMenuItem>
          )}
          {!loading && portfolios.length === 0 && (
            <DropdownMenuItem disabled className="text-gray-500">
              No portfolios yet
            </DropdownMenuItem>
          )}
          {portfolios.map((portfolio) => (
            <DropdownMenuItem
              key={portfolio.id}
              onClick={() => handlePortfolioSwitch(portfolio)}
              className={`cursor-pointer ${
                portfolio.id === selectedPortfolio?.id
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span>{portfolio.name}</span>
                  {portfolio.id === selectedPortfolio?.id && (
                    <Badge className="border-cyan-500/30 bg-cyan-500/20 text-xs text-cyan-400">Active</Badge>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {portfolio.currentValue == null
                    ? 'Value unavailable'
                    : `₹${Number(portfolio.currentValue).toLocaleString('en-IN')}`}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button onClick={onManageAccounts} variant="outline" className="border-gray-700 hover:bg-gray-800">
        <LinkIcon className="mr-2 h-4 w-4" />
        Manage Accounts
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-3 hover:bg-gray-800">
            <div className="hidden text-right md:block">
              <div className="flex items-center gap-2 text-sm text-white">{user?.name || 'Account'}</div>
              <div className="text-xs text-gray-400">{user?.email || '—'}</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
              {initials}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 border-gray-700 bg-gray-900">
          <DropdownMenuLabel className="text-gray-400">My Account</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-700" />
          <DropdownMenuItem onClick={onSettings} className="cursor-pointer text-gray-300 hover:bg-gray-800">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onManageAccounts} className="cursor-pointer text-gray-300 hover:bg-gray-800">
            <LinkIcon className="mr-2 h-4 w-4" />
            Linked Accounts
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
