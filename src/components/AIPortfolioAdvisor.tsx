import { Brain, TrendingUp, BarChart2, Target, Zap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LiveMarketData } from './LiveMarketData';
import { MarketSentimentDashboard } from './MarketSentimentDashboard';
import { AIRecommendations } from './AIRecommendations';
import { TrendingStocks } from './TrendingStocks';
import { AIAdvisorChat } from './AIAdvisorChat';
import { MacWindow } from './ui/mac-window';

interface AIPortfolioAdvisorProps {
  /** Bump this when Manage / Login Accounts is clicked to open in the main desktop. */
  popupToken?: number;
}

export function AIPortfolioAdvisor({ popupToken = 0 }: AIPortfolioAdvisorProps) {
  return (
    <MacWindow
      windowId="ai-portfolio-advisor"
      title="AI Portfolio Advisor"
      subtitle="Personalized portfolio guidance after account login"
      icon={
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-400/15">
          <Brain className="h-4 w-4 text-cyan-300" />
        </span>
      }
      initialWidth={1100}
      initialHeight={720}
      minWidth={640}
      minHeight={420}
      defaultMode="inline"
      fitMain
      startClosed
      popupToken={popupToken}
      reopenLabel="Open AI Portfolio Advisor"
      initialPosition={{ x: 148, y: 108 }}
      className="w-full neon-card-amber"
    >
      <div className="relative isolate flex min-h-0 flex-col overflow-hidden">
        <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-cyan-400/15 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-emerald-400/10 blur-2xl" />

        <div className="relative border-b border-white/10 bg-slate-950/45 px-5 py-3">
          <p className="text-sm text-slate-200">
            Opens in the main desktop when you manage login accounts — same chrome as AI Algo Advisory.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Fits the main window column · resize height · minimize / maximize / close anytime.
          </p>
        </div>

        <div
          className="relative min-h-0 flex-1 overflow-y-auto p-5"
          style={{ maxHeight: 'clamp(360px, 60vh, 720px)', scrollbarGutter: 'stable' }}
        >
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-5 flex h-auto flex-wrap gap-1 border border-white/10 bg-white/5 p-1">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-100"
              >
                <BarChart2 className="mr-2 h-4 w-4" />
                Market Overview
              </TabsTrigger>
              <TabsTrigger
                value="sentiment"
                className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-100"
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Sentiment
              </TabsTrigger>
              <TabsTrigger
                value="recommendations"
                className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-100"
              >
                <Target className="mr-2 h-4 w-4" />
                Recommendations
              </TabsTrigger>
              <TabsTrigger
                value="trending"
                className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-100"
              >
                <Zap className="mr-2 h-4 w-4" />
                Trending
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="data-[state=active]:bg-cyan-400/20 data-[state=active]:text-cyan-100"
              >
                <Brain className="mr-2 h-4 w-4" />
                Ask Advisor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-0">
              <LiveMarketData />
            </TabsContent>
            <TabsContent value="sentiment" className="mt-0">
              <MarketSentimentDashboard />
            </TabsContent>
            <TabsContent value="recommendations" className="mt-0">
              <AIRecommendations />
            </TabsContent>
            <TabsContent value="trending" className="mt-0">
              <TrendingStocks />
            </TabsContent>
            <TabsContent value="chat" className="mt-0">
              <AIAdvisorChat />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MacWindow>
  );
}
