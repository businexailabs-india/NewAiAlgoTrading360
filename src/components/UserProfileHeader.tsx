import { useState } from 'react';
import { motion } from 'motion/react';
import { User, Settings, LogOut, Plus, ChevronDown, Link as LinkIcon } from 'lucide-react';
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

interface Portfolio {
  id: string;
  name: string;
  value: number;
  accounts: string[];
  isActive: boolean;
}

interface UserProfileHeaderProps {
  onPortfolioChange: (portfolioId: string) => void;
  onManageAccounts: () => void;
  onSettings: () => void;
}

const userProfile = {
  name: 'Rajesh Kumar',
  email: 'rajesh.kumar@email.com',
  avatar: 'RK',
  isPremium: true
};

const portfolios: Portfolio[] = [
  {
    id: 'portfolio-1',
    name: 'Smart Portfolio Alpha',
    value: 2847325.50,
    accounts: ['Zerodha', 'AngelOne'],
    isActive: true
  },
  {
    id: 'portfolio-2',
    name: 'Conservative Growth',
    value: 1245680.00,
    accounts: ['Interactive Brokers'],
    isActive: false
  },
  {
    id: 'portfolio-3',
    name: 'Aggressive Tech Fund',
    value: 3521450.75,
    accounts: ['Zerodha', 'Interactive Brokers'],
    isActive: false
  }
];

export function UserProfileHeader({ onPortfolioChange, onManageAccounts, onSettings }: UserProfileHeaderProps) {
  const [selectedPortfolio, setSelectedPortfolio] = useState(portfolios[0]);

  const handlePortfolioSwitch = (portfolio: Portfolio) => {
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
                <span className="text-white">{selectedPortfolio.name}</span>
                {selectedPortfolio.accounts.length > 1 && (
                  <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                    {selectedPortfolio.accounts.length} accounts
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-400">
                ₹{selectedPortfolio.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[320px] bg-gray-900 border-gray-700">
          <DropdownMenuLabel className="text-gray-400">Your Portfolios</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-700" />
          {portfolios.map((portfolio) => (
            <DropdownMenuItem
              key={portfolio.id}
              onClick={() => handlePortfolioSwitch(portfolio)}
              className={`cursor-pointer ${
                portfolio.id === selectedPortfolio.id 
                  ? 'bg-cyan-500/10 text-cyan-400' 
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span>{portfolio.name}</span>
                  {portfolio.id === selectedPortfolio.id && (
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                      Active
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  ₹{portfolio.value.toLocaleString('en-IN')}
                </div>
                <div className="flex gap-1 mt-1">
                  {portfolio.accounts.map((account) => (
                    <Badge key={account} className="text-xs bg-gray-800 text-gray-400 border-gray-700">
                      {account}
                    </Badge>
                  ))}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-gray-700" />
          <DropdownMenuItem className="text-cyan-400 cursor-pointer hover:bg-gray-800">
            <Plus className="w-4 h-4 mr-2" />
            Create New Portfolio
          </DropdownMenuItem>
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
                {userProfile.name}
                {userProfile.isPremium && (
                  <Badge className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                    Premium
                  </Badge>
                )}
              </div>
              <div className="text-xs text-gray-400">{userProfile.email}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white">
              {userProfile.avatar}
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
          <DropdownMenuSeparator className="bg-gray-700" />
          <DropdownMenuItem className="cursor-pointer text-red-400 hover:bg-gray-800">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
