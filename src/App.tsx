import { useState } from 'react';
import { UserProfileHeader } from './components/UserProfileHeader';
import { PortfolioSummaryCards } from './components/PortfolioSummaryCards';
import { AIPortfolioAdvisor } from './components/AIPortfolioAdvisor';
import { PortfolioHeader } from './components/PortfolioHeader';
import { PerformanceCards } from './components/PerformanceCards';
import { AssetAllocationCharts } from './components/AssetAllocationCharts';
import { RebalancingConsole } from './components/RebalancingConsole';
import { TaxAnalytics } from './components/TaxAnalytics';
import { TradingTabs } from './components/TradingTabs';
import { AIInsightsPanel } from './components/AIInsightsPanel';
import { StrategyExplorer } from './components/StrategyExplorer';
import { SmartTradingDashboard } from './components/SmartTradingDashboard';
import { AccountManagementModal } from './components/AccountManagementModal';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { TradingIntegrationGuide } from './components/TradingIntegrationGuide';
import { StrategyHeatMapAnalysis } from './components/StrategyHeatMapAnalysis';

export default function App() {
  const [autoExecute, setAutoExecute] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState('Zerodha');
  const [showAccountManagement, setShowAccountManagement] = useState(false);
  const [currentPortfolio, setCurrentPortfolio] = useState('portfolio-1');
  const [activeSection, setActiveSection] = useState('dashboard');

  const handlePortfolioChange = (portfolioId: string) => {
    setCurrentPortfolio(portfolioId);
    // Here you would fetch and update portfolio data based on portfolioId
    console.log('Switching to portfolio:', portfolioId);
  };

  const handleManageAccounts = () => {
    setShowAccountManagement(true);
  };

  const handleSettings = () => {
    console.log('Opening settings...');
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    console.log('Navigating to:', section);
    // Scroll to section or show/hide components based on section
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'smart-trading':
        return <SmartTradingDashboard />;
      
      case 'portfolio':
        return (
          <>
            <PortfolioHeader />
            <PerformanceCards />
            <AssetAllocationCharts />
          </>
        );
      
      case 'ai-advisor':
        return <AIPortfolioAdvisor />;
      
      case 'strategies':
        return (
          <>
            <TradingTabs />
            <StrategyExplorer />
          </>
        );
      
      case 'analytics':
        return <AIInsightsPanel />;
      
      case 'tax-reports':
        return <TaxAnalytics />;
      
      case 'anomalies':
        return <SmartTradingDashboard />;
      
      case 'integration-guide':
        return <TradingIntegrationGuide />;
      
      case 'heatmap-analysis':
        return <StrategyHeatMapAnalysis strategyName="Momentum Breakout Strategy" />;
      
      case 'settings':
        return <SettingsPanel />;
      
      case 'profile':
        return <ProfilePanel />;
      
      default:
        return (
          <>
            <PortfolioSummaryCards />
            <SmartTradingDashboard />
            <AIPortfolioAdvisor />
            <PortfolioHeader />
            <PerformanceCards />
            <AssetAllocationCharts />
            <RebalancingConsole 
              autoExecute={autoExecute}
              setAutoExecute={setAutoExecute}
              selectedBroker={selectedBroker}
              setSelectedBroker={setSelectedBroker}
            />
            <TaxAnalytics />
            <TradingTabs />
            <StrategyExplorer />
            <AIInsightsPanel />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100">
      {/* Sidebar */}
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} />

      {/* Main Content with left margin for sidebar */}
      <div className="ml-20 transition-all duration-300">
        <div className="max-w-[1800px] mx-auto p-6 space-y-6">
          {/* User Profile & Portfolio Selector */}
          <UserProfileHeader 
            onPortfolioChange={handlePortfolioChange}
            onManageAccounts={handleManageAccounts}
            onSettings={handleSettings}
          />

          {/* Dynamic Content Based on Active Section */}
          {renderContent()}

          {/* Account Management Modal */}
          {showAccountManagement && (
            <AccountManagementModal onClose={() => setShowAccountManagement(false)} />
          )}
        </div>
      </div>
    </div>
  );
}