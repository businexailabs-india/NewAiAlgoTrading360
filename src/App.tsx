import { useCallback, useState, type ReactNode } from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  CandlestickChart,
  Layers,
  Receipt,
  RefreshCw,
  Rocket,
  Sparkles,
  TrendingUp,
  Zap,
  Eye
} from 'lucide-react';
import { TopBar, TOP_CHROME_H } from './components/TopBar';
import { AlgosWorkspace } from './components/algos/AlgosWorkspace';
import { MarketTickerBar, MARKET_TICKER_H } from './components/algos/MarketTickerBar';
import { PortfolioSummaryCards } from './components/PortfolioSummaryCards';
import { AIPortfolioAdvisor } from './components/AIPortfolioAdvisor';
import { PortfolioHeader } from './components/PortfolioHeader';
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
import { WatchlistPanel } from './components/WatchlistPanel';
import { ModeSwitchModal } from './components/ModeSwitchModal';
import { OptionsWorkspace } from './components/options/OptionsWorkspace';
import { PaperOptionsTerminal } from './components/options/PaperOptionsTerminal';
import { PaperBookPanel } from './components/trading/PaperBookPanel';
import { SensexMultiAccountPortfolioPage } from './components/portfolio';
import { UsStocksManualTradingPage } from './components/trading/us-stocks';
import { LiveOptionsTerminal } from './components/options/LiveOptionsTerminal';
import { StrategyBuilder } from './components/options/StrategyBuilder';
import { RiskCenterPanel } from './components/options/RiskCenterPanel';
import { RiskControlRoomPanel } from './components/risk/RiskControlRoomPanel';
import { QuantLabPlaceholder } from './components/tradingview/QuantLabPlaceholder';
import { QuantConnectDashboard } from './components/QuantConnectDashboard';
import { TradingTerminalPanel } from './modules/trading-terminal/TradingTerminalPanel';
import { ExecutionControlRoomPanel } from './modules/execution-governance/ExecutionControlRoomPanel';
import { TradeosHome } from './modules/tradeos-home/TradeosHome';
import { DhanLaxmiPremium } from './modules/dhanlaxmi-assistant/DhanLaxmiPremium';
import { TradingViewConnectPremium } from './modules/tradingview-connect/TradingViewConnectPremium';
import { AlgoLibraryPremium } from './modules/algo-library/AlgoLibraryPremium';
import { AlgoSuitabilityPremium } from './modules/algo-suitability/AlgoSuitabilityPremium';
import { PaperTradeLabPremium } from './modules/papertrade-lab/PaperTradeLabPremium';
import { MarketAnalyticsShell } from './modules/market-analytics/MarketAnalyticsShell';
import { LiveApprovalPremium } from './modules/live-approval/LiveApprovalPremium';
import { RiskGuardPremium } from './modules/riskguard/RiskGuardPremium';
import { ExecutionTimelinePremium } from './modules/execution-timeline/ExecutionTimelinePremium';
import { OptionsAnalyticsPanel } from './components/options/OptionsAnalyticsPanel';
import { TradeJournalPanel } from './components/options/TradeJournalPanel';
import { ModuleWindow } from './components/ui/ModuleWindow';
import { WindowPane } from './components/WindowPane';
import { useWindowStack } from './contexts/WindowStackContext';
import { useAuth } from './contexts/AuthContext';
import { useTradingMode, type TradingMode } from './contexts/TradingModeContext';

/** Window ids owned by each left-menu section — restored on menu click. */
const SECTION_WINDOWS: Record<string, string[]> = {
  dashboard: ['tradeos-home'],
  dhanlaxmi: ['dhanlaxmi-premium'],
  'algo-library': ['algo-library'],
  'algo-suitability': ['algo-suitability'],
  'papertrade-lab': ['papertrade-lab'],
  'market-analytics': ['market-analytics'],
  'live-approval': ['live-approval'],
  riskguard: ['riskguard'],
  'execution-timeline': ['execution-timeline'],
  'smart-trading': ['smart-trading'],
  algos: ['algos-workspace'],
  portfolio: ['sensex-multi-account-portfolio'],
  watchlist: ['watchlist'],
  'ai-advisor': ['ai-algo-advisory', 'advisory-marketplace'],
  strategies: ['trading-tabs', 'strategies-hub'],
  'strategies-builder': ['strategy-builder'],
  'strategies-mine': ['strategies-hub'],
  'strategies-backtest': ['trading-tabs'],
  'strategies-deploy': ['strategies-hub'],
  'tradingview-connect': ['tradingview-connect'],
  'quant-lab': ['quant-lab'],
  'knowledge-llm': ['knowledge-llm'],
  analytics: ['ai-insights'],
  'analytics-options': ['options-analytics'],
  'analytics-greeks': ['options-greeks'],
  'analytics-pnl': ['trade-journal'],
  'analytics-journal': ['trade-journal'],
  'markets-equity': ['markets-equity'],
  'markets-futures': ['markets-futures'],
  'markets-options': ['options-workspace'],
  'markets-fno-scanner': ['fno-scanner'],
  'execution-governance': ['execution-governance'],
  'trading-terminal': ['trading-terminal'],
  'trade-us-stocks': ['us-stocks-manual-trading'],
  'basket-orders': ['basket-orders'],
  'trade-paper': ['paper-options-terminal'],
  'trade-live': ['live-options-terminal'],
  'trade-orders': ['trading-tabs'],
  'trade-positions': ['trading-tabs'],
  'trade-paper-holdings': ['paper-book'],
  'trade-paper-positions': ['paper-book'],
  'trade-holdings': ['portfolio-header'],
  alerts: ['alerts-automation'],
  'broker-connections': ['broker-connections'],
  'risk-center': ['risk-center'],
  reports: ['tax-analytics'],
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
  const { mode } = useTradingMode();
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
  const [modeModal, setModeModal] = useState<{ open: boolean; target: TradingMode | null }>({
    open: false,
    target: null
  });

  const openModeSwitch = (target: TradingMode) => setModeModal({ open: true, target });
  const closeModeSwitch = () => setModeModal({ open: false, target: null });

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
    const go = (section: string) => handleSectionChange(section);

    switch (activeSection) {
      case 'dashboard':
        return (
          <Win id="tradeos-home" title="TradeOS Home" subtitle="Protected · Paper first · Approval required" cascadeIndex={1}>
            <TradeosHome onNavigate={go} />
          </Win>
        );

      case 'dhanlaxmi':
        return (
          <Win id="dhanlaxmi-premium" title="DhanLaxmi" subtitle="Explain · draft · approve — never execute" cascadeIndex={1}>
            <DhanLaxmiPremium />
          </Win>
        );

      case 'algo-library':
        return (
          <Win id="algo-library" title="Algo Library" subtitle="Calm strategies · paper first" cascadeIndex={1}>
            <AlgoLibraryPremium onNavigate={go} />
          </Win>
        );

      case 'algo-suitability':
        return (
          <Win id="algo-suitability" title="Algo Suitability" subtitle="Fit score · not a profit promise" cascadeIndex={1}>
            <AlgoSuitabilityPremium onNavigate={go} />
          </Win>
        );

      case 'papertrade-lab':
        return (
          <Win id="papertrade-lab" title="PaperTrade Lab" subtitle="No real money" cascadeIndex={1}>
            <PaperTradeLabPremium onNavigate={go} />
          </Win>
        );

      case 'market-analytics':
        return (
          <Win
            id="market-analytics"
            title="Market Analytics"
            subtitle="Paper-only · TradingView → risk → broker paper"
            cascadeIndex={1}
          >
            <MarketAnalyticsShell />
          </Win>
        );

      case 'live-approval':
        return (
          <Win id="live-approval" title="Live Approval" subtitle="Your clear yes required" cascadeIndex={1}>
            <LiveApprovalPremium />
          </Win>
        );

      case 'riskguard':
        return (
          <Win id="riskguard" title="RiskGuard" subtitle="Battery health for trading" cascadeIndex={1}>
            <RiskGuardPremium />
          </Win>
        );

      case 'execution-timeline':
        return (
          <Win id="execution-timeline" title="Execution Timeline" subtitle="Human-readable safety path" cascadeIndex={1}>
            <ExecutionTimelinePremium />
          </Win>
        );

      case 'smart-trading':
        return (
          <Win
            id="smart-trading"
            title="Smart Trading"
            subtitle="Algos Live desk · P&L · agents · AI"
            icon={<Zap className="h-4 w-4 text-emerald-300" />}
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
          <Win
            id="sensex-multi-account-portfolio"
            title="SENSEX & Multi-Account Portfolio"
            subtitle="Consolidated positions, capital, orders and risk across brokers"
            icon={<Briefcase className="h-4 w-4 text-sky-300" />}
            cascadeIndex={1}
          >
            <SensexMultiAccountPortfolioPage />
          </Win>
        );

      case 'watchlist':
        return (
          <Win
            id="watchlist"
            title="Stock Watchlist"
            subtitle="Algos Live desk · lists · quotes · charts"
            icon={<Eye className="h-4 w-4 text-cyan-300" />}
            cascadeIndex={1}
          >
            <WatchlistPanel />
          </Win>
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
              subtitle="Algos Live desk · backtest · paper · live"
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

      case 'markets-equity':
        return (
          <Win id="markets-equity" title="Equity Markets" subtitle="Cash equities desk" cascadeIndex={1}>
            <WatchlistPanel />
          </Win>
        );

      case 'markets-futures':
        return (
          <Win
            id="markets-futures"
            title="Futures"
            subtitle="Index & stock futures — from instrument master"
            icon={<Activity className="h-4 w-4 text-amber-300" />}
            cascadeIndex={1}
          >
            <OptionsWorkspace segment="FUT" />
          </Win>
        );

      case 'markets-options':
        return (
          <Win
            id="options-workspace"
            title="Options Chain"
            subtitle="NSE F&O · instrument master · Live/Delayed"
            icon={<Layers className="h-4 w-4 text-cyan-300" />}
            cascadeIndex={1}
          >
            <OptionsWorkspace />
          </Win>
        );

      case 'markets-fno-scanner':
        return (
          <Win id="fno-scanner" title="F&O Scanner" subtitle="OI / PCR / momentum scans" cascadeIndex={1}>
            <OptionsWorkspace scanner />
          </Win>
        );

      case 'execution-governance':
        return (
          <Win
            id="execution-governance"
            title="ExecutionGovernance360"
            subtitle="Recommend → approve → RMS → OMS only"
            cascadeIndex={1}
          >
            <ExecutionControlRoomPanel />
          </Win>
        );

      case 'trading-terminal':
        return (
          <Win
            id="trading-terminal"
            title="Trading Terminal"
            subtitle="Buy/Sell · Index derivatives · Chart qty · Paper default"
            cascadeIndex={1}
          >
            <TradingTerminalPanel />
          </Win>
        );

      case 'trade-us-stocks':
        return (
          <Win
            id="us-stocks-manual-trading"
            title="US Stocks Manual Trading"
            subtitle="IBKR paper/live · ConID · preview · broker reply · audit"
            icon={<CandlestickChart className="h-4 w-4 text-sky-300" />}
            cascadeIndex={1}
          >
            <UsStocksManualTradingPage />
          </Win>
        );

      case 'basket-orders':
        return (
          <Win
            id="basket-orders"
            title="Basket Orders"
            subtitle="Multi-leg paper baskets · RMS preview · OMS submit"
            cascadeIndex={1}
          >
            <TradingTerminalPanel initialTab="basket" />
          </Win>
        );

      case 'trade-paper':
        return (
          <Win
            id="paper-options-terminal"
            title="Paper Options Terminal"
            subtitle="SIMULATION · blue safe chrome · no live broker submit"
            icon={<Zap className="h-4 w-4 text-sky-300" />}
            cascadeIndex={1}
          >
            <PaperOptionsTerminal />
          </Win>
        );

      case 'trade-live':
        return (
          <Win
            id="live-options-terminal"
            title="Live Options Terminal"
            subtitle="REAL MONEY preview · submit gated by FEATURE_LIVE_OPTIONS"
            icon={<Zap className="h-4 w-4 text-orange-300" />}
            cascadeIndex={1}
          >
            <LiveOptionsTerminal />
          </Win>
        );

      case 'trade-orders':
      case 'trade-positions':
        return (
          <Win id="trading-tabs" title="Orders & Positions" cascadeIndex={1}>
            <TradingTabs />
          </Win>
        );

      case 'trade-paper-holdings':
        return (
          <Win
            id="paper-book"
            title="Paper Holdings"
            subtitle="Simulated book · cash · fills · no live risk"
            icon={<Briefcase className="h-4 w-4 text-sky-300" />}
            cascadeIndex={1}
          >
            <PaperBookPanel initialTab="holdings" />
          </Win>
        );

      case 'trade-paper-positions':
        return (
          <Win
            id="paper-book"
            title="Paper Positions"
            subtitle="Open F&O paper positions · MTM · order history"
            icon={<Layers className="h-4 w-4 text-sky-300" />}
            cascadeIndex={1}
          >
            <PaperBookPanel initialTab="positions" />
          </Win>
        );

      case 'trade-holdings':
        return (
          <Win id="portfolio-header" title="Holdings" cascadeIndex={1}>
            <PortfolioHeader />
          </Win>
        );

      case 'strategies-builder':
        return (
          <Win id="strategy-builder" title="Strategy Builder" cascadeIndex={1}>
            <StrategyBuilder />
          </Win>
        );

      case 'strategies-mine':
      case 'strategies-deploy':
        return (
          <Win id="strategies-hub" title="My Strategies" cascadeIndex={1}>
            <StrategiesHub />
          </Win>
        );

      case 'strategies-backtest':
        return (
          <Win id="trading-tabs" title="Backtesting" cascadeIndex={1}>
            <TradingTabs />
          </Win>
        );

      case 'tradingview-connect':
        return (
          <Win
            id="tradingview-connect"
            title="TradingView Connect"
            subtitle="Alerts become safe signals first"
            cascadeIndex={1}
          >
            <TradingViewConnectPremium />
          </Win>
        );

      case 'quant-lab':
        return (
          <Win id="quant-lab" title="Quant Lab" subtitle="Optional QuantConnect / LEAN" cascadeIndex={1}>
            <div className="space-y-4">
              <QuantLabPlaceholder />
              <QuantConnectDashboard />
            </div>
          </Win>
        );

      case 'analytics-options':
        return (
          <Win id="options-analytics" title="Option Analytics" cascadeIndex={1}>
            <OptionsAnalyticsPanel focus="analytics" />
          </Win>
        );

      case 'analytics-greeks':
        return (
          <Win id="options-greeks" title="Greeks & IV" cascadeIndex={1}>
            <OptionsAnalyticsPanel focus="greeks" />
          </Win>
        );

      case 'analytics-pnl':
      case 'analytics-journal':
        return (
          <Win id="trade-journal" title="P&L / Trade Journal" cascadeIndex={1}>
            <TradeJournalPanel />
          </Win>
        );

      case 'alerts':
        return (
          <Win id="alerts-automation" title="Alerts & Automation" cascadeIndex={1}>
            <TradingOperationsDashboard />
          </Win>
        );

      case 'broker-connections':
        return (
          <Win id="broker-connections" title="Broker Connections" cascadeIndex={1}>
            <SettingsPanel />
          </Win>
        );

      case 'risk-center':
        return (
          <Win id="risk-center" title="Risk Center" subtitle="F&O preflight · 1L Control Room · events" cascadeIndex={1}>
            <div className="space-y-4">
              <RiskControlRoomPanel />
              <RiskCenterPanel />
            </div>
          </Win>
        );

      case 'reports':
        return (
          <Win id="tax-analytics" title="Reports" cascadeIndex={1}>
            <TaxAnalytics />
          </Win>
        );

      default:
        return (
          <Win id="tradeos-home" title="TradeOS Home" subtitle="Protected · Paper first · Approval required" cascadeIndex={1}>
            <TradeosHome onNavigate={go} />
          </Win>
        );
    }
  };

  return (
    <div
      className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100"
      style={{ height: '100vh', overflow: 'hidden' }}
    >
      <Sidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        user={user}
        onLogout={logout}
        onRequestLiveMode={() => openModeSwitch('live')}
        onRequestPaperMode={() => openModeSwitch('paper')}
      />

      <TopBar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onRequestModeSwitch={() => openModeSwitch(mode === 'live' ? 'paper' : 'live')}
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

      <ModeSwitchModal
        open={modeModal.open}
        target={modeModal.target}
        onClose={closeModeSwitch}
        onNeedBrokers={() => handleSectionChange('broker-connections')}
      />
    </div>
  );
}
