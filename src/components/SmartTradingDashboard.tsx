import { useState, type CSSProperties } from 'react';
import { Activity, TrendingUp, Zap, Filter, Download, Share2, Mic, Loader2, Radio } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { StrategyPerformanceDashboard } from './StrategyPerformanceDashboard';
import { TradeAnalyticsPanel } from './TradeAnalyticsPanel';
import { AIAdvisorChat } from './AIAdvisorChat';
import { MarketSentimentDashboard } from './MarketSentimentDashboard';
import { AnomalyDetectionPanel } from './AnomalyDetectionPanel';
import { VoiceAssistant } from './VoiceAssistant';
import { PerformanceComparison } from './PerformanceComparison';
import { QuantConnectDashboard } from './QuantConnectDashboard';
import { useTradingDashboard } from '../hooks/useTradingDashboard';
import { useMarketData } from '../contexts/MarketDataContext';
import { LiveIndicesBar } from './LiveIndicesBar';

const panelCard: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(34,211,238,0.22)',
  background: 'rgba(15,23,42,0.7)',
  padding: 16,
};

const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(34,211,238,0.35)',
  background: 'rgba(34,211,238,0.1)',
  color: '#67e8f9',
  cursor: 'pointer',
  fontSize: 12,
};

const solidBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#059669',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};

export function SmartTradingDashboard() {
  const [timeRange, setTimeRange] = useState('1M');
  const [strategyType, setStrategyType] = useState('all');
  const [marketSegment, setMarketSegment] = useState('all');
  const [showVoiceAssistant, setShowVoiceAssistant] = useState(false);
  const { summary, agents, orders, trades, loading } = useTradingDashboard(timeRange);
  const { isLive, lastUpdated } = useMarketData();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={panelCard}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                padding: 8,
                borderRadius: 10,
                border: '1px solid rgba(34,211,238,0.28)',
                background: 'rgba(2,6,23,0.45)',
              }}
            >
              <Activity className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, color: '#f1f5f9' }}>Smart AI Trading Analytics</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                Same desk as Trading / Investing Algos · P&amp;L · agents · AI
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" onClick={() => setShowVoiceAssistant(true)} style={solidBtn}>
              <Mic className="h-3.5 w-3.5" /> EdgeX Voice
            </button>
            <button type="button" onClick={() => console.log('export')} style={ghostBtn}>
              <Download className="h-3.5 w-3.5" /> Export
            </button>
            <button type="button" onClick={() => console.log('share')} style={ghostBtn}>
              <Share2 className="h-3.5 w-3.5" /> Share
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 10,
            marginTop: 16,
          }}
        >
          {loading ? (
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Loader2 className="h-6 w-6 animate-spin text-cyan-300" />
            </div>
          ) : (
            [
              ['Total P&L', `₹${(summary?.totalPnL ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, (summary?.totalPnL ?? 0) >= 0 ? '#34d399' : '#f87171'],
              ['Total Trades', String(summary?.totalTrades ?? 0), '#e2e8f0'],
              ['Win Rate', `${(summary?.winRate ?? 0).toFixed(1)}%`, '#e2e8f0'],
              ['Avg Return', `${(summary?.avgReturn ?? 0).toFixed(2)}%`, '#e2e8f0'],
              ['Sharpe Ratio', (summary?.sharpeRatio ?? 0).toFixed(2), '#e2e8f0'],
              ['Active Agents', String(summary?.activeAgents ?? 0), '#e2e8f0'],
            ].map(([label, value, color]) => (
              <div key={String(label)}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: String(color), marginTop: 4 }}>{value}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <LiveIndicesBar />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          padding: 12,
          borderRadius: 12,
          border: '1px solid rgba(148,163,184,0.2)',
          background: 'rgba(15,23,42,0.65)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px] border-slate-600 bg-slate-950 text-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1M">1 Month</SelectItem>
            <SelectItem value="3M">3 Months</SelectItem>
            <SelectItem value="6M">6 Months</SelectItem>
            <SelectItem value="YTD">YTD</SelectItem>
            <SelectItem value="1Y">1 Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        <Select value={strategyType} onValueChange={setStrategyType}>
          <SelectTrigger className="w-[160px] border-slate-600 bg-slate-950 text-slate-200">
            <SelectValue placeholder="Strategy Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Strategies</SelectItem>
            <SelectItem value="intraday">Intraday</SelectItem>
            <SelectItem value="swing">Swing Trading</SelectItem>
            <SelectItem value="positional">Positional</SelectItem>
          </SelectContent>
        </Select>
        <Select value={marketSegment} onValueChange={setMarketSegment}>
          <SelectTrigger className="w-[160px] border-slate-600 bg-slate-950 text-slate-200">
            <SelectValue placeholder="Market Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments</SelectItem>
            <SelectItem value="equity">Equity</SelectItem>
            <SelectItem value="futures">Futures</SelectItem>
            <SelectItem value="options">Options</SelectItem>
          </SelectContent>
        </Select>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 11,
            border: isLive ? '1px solid rgba(52,211,153,0.55)' : '1px solid rgba(148,163,184,0.25)',
            background: isLive ? 'rgba(16,185,129,0.15)' : 'transparent',
            color: isLive ? '#6ee7b7' : '#94a3b8',
          }}
        >
          <Radio className={`h-3 w-3 ${isLive ? 'animate-pulse' : ''}`} />
          {isLive ? 'Live' : 'Polling'}
          {lastUpdated ? ` · ${lastUpdated.toLocaleTimeString()}` : ''}
        </span>
      </div>

      <Tabs defaultValue="performance" className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1 border border-slate-700/80 bg-slate-950/80 p-1.5">
          <TabsTrigger value="performance" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
            <TrendingUp className="mr-2 h-4 w-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="comparison" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
            Comparison
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
            <Activity className="mr-2 h-4 w-4" />
            Trade Analytics
          </TabsTrigger>
          <TabsTrigger value="ai-advisor" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
            <Zap className="mr-2 h-4 w-4" />
            AI Advisor
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
            Market Sentiment
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
            Anomaly Detection
          </TabsTrigger>
          <TabsTrigger value="quantconnect" className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300">
            QuantConnect
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <StrategyPerformanceDashboard timeRange={timeRange} agents={agents} />
        </TabsContent>
        <TabsContent value="comparison">
          <PerformanceComparison timeRange={timeRange} />
        </TabsContent>
        <TabsContent value="analytics">
          <TradeAnalyticsPanel timeRange={timeRange} trades={trades} orders={orders} />
        </TabsContent>
        <TabsContent value="ai-advisor">
          <AIAdvisorChat />
        </TabsContent>
        <TabsContent value="sentiment">
          <MarketSentimentDashboard />
        </TabsContent>
        <TabsContent value="anomalies">
          <AnomalyDetectionPanel />
        </TabsContent>
        <TabsContent value="quantconnect">
          <QuantConnectDashboard />
        </TabsContent>
      </Tabs>

      {showVoiceAssistant && <VoiceAssistant onClose={() => setShowVoiceAssistant(false)} />}
    </div>
  );
}
