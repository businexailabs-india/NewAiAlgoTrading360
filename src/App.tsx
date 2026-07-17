import { useCallback, useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  Layers,
  PieChart,
  Receipt,
  RefreshCw,
  Rocket,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';
import { TopBar, TOP_CHROME_H } from './components/TopBar';
import { AlgosWorkspace } from './components/algos/AlgosWorkspace';
import { MarketTickerBar, MARKET_TICKER_H } from './components/algos/MarketTickerBar';
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
import { ModuleWindow } from './components/ui/ModuleWindow';
import { WindowPane } from './components/WindowPane';
import { useWindowStack } from './contexts/WindowStackContext';
import { useAuth } from './contexts/AuthContext';

/** Window ids owned by each left-menu section — restored on menu click. */
const SECTION_WINDOWS: Record<string, string[]> = {
  dashboard: [
    'algos-workspace-home',
    'portfolio-summary',
    'smart-trading-home',
    'portfolio-header-home',
    'performance-home',
    'allocation-home',
    'rebalancing',
    'tax-home',
    'trading-tabs-home',
    'strategy-explorer',
    'ai-insights-home'
  ],
  'smart-trading': ['smart-trading'],
  algos: ['algos-workspace'],
  portfolio: ['portfolio-header', 'performance-cards', 'asset-allocation'],
  'ai-advisor': ['ai-algo-advisory', 'advisory-marketplace'],
  strategies: ['trading-tabs', 'strategies-hub'],
  'knowledge-llm': ['knowledge-llm'],
  analytics: ['ai-insights'],
  'tax-reports': ['tax-analytics'],
  anomalies: ['anomalies'],
  'integration-guide': ['integration-guide'],
  'heatmap-analysis': ['heatmap-analysis'],
  settings: ['settings'],
  profile: ['profile'],
  admin: ['admin'],
  predictions: ['predictions'],
  'auto-trading': ['auto-trading']
};

/** Always mounted above section content — must be closed when leaving their sections. */
const OVERLAY_WINDOWS = ['ai-algo-advisory', 'ai-portfolio-advisor'] as const;

function Win({
  id,
  title,
  subtitle,
  icon,
  cascadeIndex,
  alwaysOnTop,
  children
}: {
  id: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  cascadeIndex?: number;
  alwaysOnTop?: boolean;
  children: ReactNode;
}) {
  return (
    <ModuleWindow
      id={id}
      title={title}
      subtitle={subtitle}
      icon={icon}
      cascadeIndex={cascadeIndex}
      alwaysOnTop={alwaysOnTop}
    >
      {children}
    </ModuleWindow>
  );
}

export default function App() {
  const { user, logout } = useAuth();
  const { restoreWindow, closeWindow } = useWindowStack();
  const [autoExecute, setAutoExecute] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState('');
  const [showAccountManagement, setShowAccountManagement] = useState(false);
  const [, setCurrentPortfolio] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [sectionEpoch, setSectionEpoch] = useState(0);
  const [dhanLaxmiOpen, setDhanLaxmiOpen] = useState(false);
  const [portfolioAdvisorPopupToken, setPortfolioAdvisorPopupToken] = useState(0);
  const [advisoryPopupToken, setAdvisoryPopupToken] = useState(0);

  const handlePortfolioChange = useCallback((portfolioId: string) => {
    setCurrentPortfolio(portfolioId);
  }, []);

  const handleManageAccounts = () => {
    setShowAccountManagement(true);
    setPortfolioAdvisorPopupToken((token) => token + 1);
    restoreWindow('ai-portfolio-advisor');
    window.setTimeout(() => {
      document
        .querySelector('[data-window-id="ai-portfolio-advisor"]')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const handleSettings = () => {
    handleSectionChange('settings');
  };

  const handleSectionChange = (section: string) => {
    const windowIds = SECTION_WINDOWS[section] || SECTION_WINDOWS.dashboard;
    const keep = new Set(windowIds);

    // Overlay cards sit above section content — dismiss when leaving their home sections.
    OVERLAY_WINDOWS.forEach((id) => {
      if (!keep.has(id)) closeWindow(id);
    });

    // Re-open any closed/minimized module windows for this menu item
    // instead of leaving the user staring at the right Window Pane.
    windowIds.forEach((id) => restoreWindow(id));
    setActiveSection(section);
    setSectionEpoch((n) => n + 1);
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'smart-trading':
        return (
          <Win
            id="smart-trading"
            title="Smart Trading"
            subtitle="Live signals and execution workspace"
            icon={<Zap className="h-4 w-4 text-cyan-300" />}
            cascadeIndex={1}
          >
            <SmartTradingDashboard />
          </Win>
        );

      case 'algos':
        return (
          <Win
            id="algos-workspace"
            title="Algos Live"
            subtitle="Marketplace · My Algos · Positions · Orders"
            icon={<Rocket className="h-4 w-4 text-emerald-300" />}
            cascadeIndex={1}
          >
            <AlgosWorkspace embedded />
          </Win>
        );

      case 'portfolio':
        return (
          <>
            <Win
              id="portfolio-header"
              title="Portfolio Overview"
              icon={<Briefcase className="h-4 w-4 text-cyan-300" />}
              cascadeIndex={1}
            >
              <PortfolioHeader />
            </Win>
            <Win
              id="performance-cards"
              title="Performance"
              icon={<TrendingUp className="h-4 w-4 text-emerald-300" />}
              cascadeIndex={2}
            >
              <PerformanceCards />
            </Win>
            <Win
              id="asset-allocation"
              title="Asset Allocation"
              icon={<PieChart className="h-4 w-4 text-amber-300" />}
              cascadeIndex={3}
            >
              <AssetAllocationCharts />
            </Win>
          </>
        );

      case 'ai-advisor':
        return (
          <Win
            id="advisory-marketplace"
            title="Strategy Marketplace"
            icon={<Sparkles className="h-4 w-4 text-cyan-300" />}
            cascadeIndex={1}
          >
            <AdvisoryMarketplacePanel />
          </Win>
        );

      case 'strategies':
        return (
          <>
            <Win
              id="trading-tabs"
              title="Trading Desk"
              icon={<Activity className="h-4 w-4 text-cyan-300" />}
              cascadeIndex={1}
            >
              <TradingTabs />
            </Win>
            <Win
              id="strategies-hub"
              title="Strategies Hub"
              icon={<Layers className="h-4 w-4 text-emerald-300" />}
              cascadeIndex={2}
            >
              <StrategiesHub />
            </Win>
          </>
        );

      case 'knowledge-llm':
        return (
          <Win
            id="knowledge-llm"
            title="Knowledge & LLM"
            icon={<Sparkles className="h-4 w-4 text-cyan-300" />}
            cascadeIndex={1}
          >
            <KnowledgeLlmDashboard />
          </Win>
        );

      case 'analytics':
        return (
          <Win
            id="ai-insights"
            title="AI Insights"
            icon={<BarChart3 className="h-4 w-4 text-cyan-300" />}
            cascadeIndex={1}
          >
            <AIInsightsPanel />
          </Win>
        );

      case 'tax-reports':
        return (
          <Win
            id="tax-analytics"
            title="Tax Reports"
            icon={<Receipt className="h-4 w-4 text-amber-300" />}
            cascadeIndex={1}
          >
            <TaxAnalytics />
          </Win>
        );

      case 'anomalies':
        return (
          <Win
            id="anomalies"
            title="Anomaly Desk"
            icon={<Activity className="h-4 w-4 text-red-300" />}
            cascadeIndex={1}
          >
            <SmartTradingDashboard />
          </Win>
        );

      case 'integration-guide':
        return (
          <Win
            id="integration-guide"
            title="Integration Guide"
            cascadeIndex={1}
          >
            <TradingIntegrationGuide />
          </Win>
        );

      case 'heatmap-analysis':
        return (
          <Win id="heatmap-analysis" title="Heat Map Analysis" cascadeIndex={1}>
            <StrategyHeatMapAnalysis strategyName="" />
          </Win>
        );

      case 'settings':
        return (
          <Win id="settings" title="Settings" cascadeIndex={1}>
            <SettingsPanel />
          </Win>
        );

      case 'profile':
        return (
          <Win id="profile" title="Profile" cascadeIndex={1}>
            <ProfilePanel />
          </Win>
        );

      case 'admin':
        return (
          <Win id="admin" title="Admin Console" cascadeIndex={1}>
            <AdminConsole />
          </Win>
        );

      case 'predictions':
        return (
          <Win id="predictions" title="Prediction Engines" cascadeIndex={1}>
            <PredictionEngineDashboard />
          </Win>
        );

      case 'auto-trading':
        return (
          <Win id="auto-trading" title="Auto Trading Ops" cascadeIndex={1}>
            <TradingOperationsDashboard />
          </Win>
        );

      default:
        return (
          <>
            <Win
              id="algos-workspace-home"
              title="Algos Live"
              subtitle="Marketplace · My Algos · Positions · Orders"
              icon={<Rocket className="h-4 w-4 text-emerald-300" />}
              cascadeIndex={1}
            >
              <AlgosWorkspace embedded />
            </Win>
            <Win
              id="portfolio-summary"
              title="Portfolio Summary"
              icon={<Briefcase className="h-4 w-4 text-cyan-300" />}
              cascadeIndex={2}
            >
              <PortfolioSummaryCards />
            </Win>
            <Win
              id="smart-trading-home"
              title="Smart Trading"
              icon={<Zap className="h-4 w-4 text-emerald-300" />}
              cascadeIndex={3}
            >
              <SmartTradingDashboard />
            </Win>
            <Win
              id="portfolio-header-home"
              title="Portfolio Overview"
              icon={<TrendingUp className="h-4 w-4 text-cyan-300" />}
              cascadeIndex={4}
            >
              <PortfolioHeader />
            </Win>
            <Win
              id="performance-home"
              title="Performance"
              icon={<BarChart3 className="h-4 w-4 text-amber-300" />}
              cascadeIndex={5}
            >
              <PerformanceCards />
            </Win>
            <Win
              id="allocation-home"
              title="Asset Allocation"
              icon={<PieChart className="h-4 w-4 text-cyan-300" />}
              cascadeIndex={6}
            >
              <AssetAllocationCharts />
            </Win>
            <Win
              id="rebalancing"
              title="Rebalancing Console"
              icon={<RefreshCw className="h-4 w-4 text-emerald-300" />}
              cascadeIndex={7}
            >
              <RebalancingConsole
                autoExecute={autoExecute}
                setAutoExecute={setAutoExecute}
                selectedBroker={selectedBroker}
                setSelectedBroker={setSelectedBroker}
              />
            </Win>
            <Win
              id="tax-home"
              title="Tax Analytics"
              icon={<Receipt className="h-4 w-4 text-amber-300" />}
              cascadeIndex={8}
            >
              <TaxAnalytics />
            </Win>
            <Win
              id="trading-tabs-home"
              title="Trading Desk"
              icon={<Activity className="h-4 w-4 text-cyan-300" />}
              cascadeIndex={9}
            >
              <TradingTabs />
            </Win>
            <Win
              id="strategy-explorer"
              title="Strategy Explorer"
              icon={<Layers className="h-4 w-4 text-emerald-300" />}
              cascadeIndex={10}
            >
              <StrategyExplorer />
            </Win>
            <Win
              id="ai-insights-home"
              title="AI Insights"
              icon={<Sparkles className="h-4 w-4 text-cyan-300" />}
              cascadeIndex={11}
            >
              <AIInsightsPanel />
            </Win>
          </>
        );
    }
  };

  return (
    <div
      className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100"
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <Sidebar activeSection={activeSection} onSectionChange={handleSectionChange} user={user} onLogout={logout} />

      <TopBar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onNavigateAlgos={() => {
          if (activeSection !== 'dashboard' && activeSection !== 'algos') {
            handleSectionChange('dashboard');
          } else {
            restoreWindow(
              activeSection === 'algos' ? 'algos-workspace' : 'algos-workspace-home'
            );
          }
        }}
        onOpenAdvisory={() => {
          // Open advisory on its section so other nav options can dismiss it cleanly.
          if (activeSection !== 'ai-advisor') {
            handleSectionChange('ai-advisor');
          }
          setAdvisoryPopupToken((n) => n + 1);
          restoreWindow('ai-algo-advisory');
          window.setTimeout(() => {
            document
              .querySelector('[data-window-id="ai-algo-advisory"]')
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }}
      >
        <DhanLaxmiAssistant
          placement="top"
          open={dhanLaxmiOpen}
          onOpenChange={setDhanLaxmiOpen}
        />
      </TopBar>

      <MarketTickerBar
        onPortfolioChange={handlePortfolioChange}
        onManageAccounts={handleManageAccounts}
        onSettings={handleSettings}
      />

      {/* Main desktop — inset clears Window Pane so the scrollbar stays visible */}
      <div
        className="main-desktop-scroll"
        style={{
          marginLeft: 80,
          marginRight: 'var(--window-pane-inset, 62px)',
          paddingTop: TOP_CHROME_H + MARKET_TICKER_H,
          height: '100vh',
          overflowX: 'hidden',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          scrollbarGutter: 'stable'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 'none',
            margin: 0,
            padding: '0 10px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxSizing: 'border-box',
            minHeight: 'min-content'
          }}
        >
          <LoginAdvisoryCard
            startClosed
            popupToken={advisoryPopupToken}
            onOpenMarketplace={() => handleSectionChange('ai-advisor')}
          />
          <AIPortfolioAdvisor popupToken={portfolioAdvisorPopupToken} />

          <div
            key={`${activeSection}-${sectionEpoch}`}
            style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}
          >
            {renderContent()}
          </div>

          {showAccountManagement && (
            <AccountManagementModal onClose={() => setShowAccountManagement(false)} />
          )}
        </div>
      </div>

      <WindowPane />
    </div>
  );
}
