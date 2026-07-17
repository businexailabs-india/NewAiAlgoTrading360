import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Settings, ChevronDown, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { integrationService, BrokerAccountView } from '../services/integrationService';
import { portfolioService, PortfolioSummary, PortfolioView } from '../services/portfolioService';

interface UserProfileHeaderProps {
  onPortfolioChange: (portfolioId: string) => void;
  onManageAccounts: () => void;
  onSettings: () => void;
}

export function UserProfileHeader({ onPortfolioChange, onManageAccounts, onSettings }: UserProfileHeaderProps) {
  const { user } = useAuth();
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
    return () => { active = false; };
  }, [onPortfolioChange]);

  const handlePortfolioSwitch = (portfolio: PortfolioView) => {
    setSelectedPortfolio(portfolio);
    onPortfolioChange(portfolio.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-4 mb-6 bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-4"
    >
      {/* Portfolio Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="border-gray-700 hover:bg-gray-800 flex items-center gap-3 h-auto py-3 px-4"
          >
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-white">{loading ? 'Loading portfolios…' : selectedPortfolio?.name || 'No portfolios'}</span>
                {accounts.length > 0 && (
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                    {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-400">
                {summary ? `₹${summary.totalCurrent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'Portfolio value unavailable'}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[320px] bg-gray-900 border-gray-700">
          <DropdownMenuLabel className="text-gray-400">Your Portfolios</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-700" />
          {loading && <DropdownMenuItem disabled><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading…</DropdownMenuItem>}
          {!loading && portfolios.length === 0 && (
            <DropdownMenuItem disabled className="text-gray-500">No portfolios yet</DropdownMenuItem>
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
                <div className="flex items-center gap-2 mb-1">
                  <span>{portfolio.name}</span>
                  {portfolio.id === selectedPortfolio?.id && (
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {portfolio.currentValue == null ? 'Value unavailable' : `₹${Number(portfolio.currentValue).toLocaleString('en-IN')}`}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Exchange Accounts Quick Link */}
      <Button
        onClick={onManageAccounts}
        variant="outline"
        className="border-gray-700 hover:bg-gray-800"
      >
        <LinkIcon className="w-4 h-4 mr-2" />
        Manage Accounts
      </Button>

      {/* User Profile Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-3 hover:bg-gray-800">
            <div className="text-right hidden md:block">
              <div className="text-sm text-white flex items-center gap-2">
                {user?.name || 'Account'}
              </div>
              <div className="text-xs text-gray-400">{user?.email || '—'}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white">
              {(user?.name || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
          </Button>
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
    </motion.div>
  );
}
