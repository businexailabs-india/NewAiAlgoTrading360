import { useCallback, useState } from 'react';
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
import { StrategiesHub } from './components/StrategiesHub';
import { AdvisoryMarketplacePanel } from './components/AdvisoryMarketplacePanel';
import { LoginAdvisoryCard } from './components/LoginAdvisoryCard';
import { DhanLaxmiAssistant } from './components/DhanLaxmiAssistant';
import { KnowledgeLlmDashboard } from './components/KnowledgeLlmDashboard';
import { SmartTradingDashboard } from './components/SmartTradingDashboard';
import { AccountManagementModal } from './components/AccountManagementModal';
import { Sidebar } from './components/Sidebar';
import { SettingsPanel } from './components/SettingsPanel';
import { ProfilePanel } from './components/ProfilePanel';
import { TradingIntegrationGuide } from './components/TradingIntegrationGuide';
import { StrategyHeatMapAnalysis } from './components/StrategyHeatMapAnalysis';
import { AdminConsole } from './components/AdminConsole';
import { PredictionEngineDashboard } from './components/PredictionEngineDashboard';
import { TradingOperationsDashboard } from './components/TradingOperationsDashboard';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { user, logout } = useAuth();
  const [autoExecute, setAutoExecute] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState('');
  const [showAccountManagement, setShowAccountManagement] = useState(false);
  const [, setCurrentPortfolio] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');

  const handlePortfolioChange = useCallback((portfolioId: string) => {
    setCurrentPortfolio(portfolioId);
  }, []);

  const handleManageAccounts = () => {
    setShowAccountManagement(true);
  };

  const handleSettings = () => {
    setActiveSection('settings');
  };

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    setActiveSection(section);
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
        return (
          <>
            <AdvisoryMarketplacePanel />
            <AIPortfolioAdvisor />
          </>
        );
      
      case 'strategies':
        return (
          <>
            <TradingTabs />
            <StrategiesHub />
          </>
        );

      case 'knowledge-llm':
        return <KnowledgeLlmDashboard />;
      
      case 'analytics':
        return <AIInsightsPanel />;
      
      case 'tax-reports':
        return <TaxAnalytics />;
      
      case 'anomalies':
        return <SmartTradingDashboard />;
      
      case 'integration-guide':
        return <TradingIntegrationGuide />;
      
      case 'heatmap-analysis':
        return <StrategyHeatMapAnalysis strategyName="" />;
      
      case 'settings':
        return <SettingsPanel />;
      
      case 'profile':
        return <ProfilePanel />;
      
      case 'admin':
        return <AdminConsole />;

      case 'predictions':
        return <PredictionEngineDashboard />;

      case 'auto-trading':
        return <TradingOperationsDashboard />;
      
      default:
        return (
          <>
            <LoginAdvisoryCard />
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
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} user={user} onLogout={logout} />

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
      <DhanLaxmiAssistant />
    </div>
  );
}