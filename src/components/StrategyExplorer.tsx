import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Rocket, Filter, Users, Code, Search, Trophy, Zap, Clock, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { StrategyCard } from './StrategyCard';
import { StrategyDetailModal } from './StrategyDetailModal';
import { LeaderboardPanel } from './LeaderboardPanel';
import { API_BASE_URL } from '@/lib/api';
import {
  cloneMarketplaceStrategy,
  deployMarketplaceStrategy,
  exportMarketplaceStrategy
} from '@/lib/marketplaceActions';
import { tradingService } from '@/services/tradingService';
import { advisoryMarketplaceService } from '@/services/advisoryMarketplaceService';

export type ExplorerStrategy = {
  id: number;
  name: string;
  author: string;
  category: string;
  exchange: string;
  description: string;
  returns: string;
  sharpe: string;
  drawdown: string;
  winRate: string;
  trades: number;
  tags: string[];
  code: string;
  codeSnippet?: string;
  rating: number;
  reviews: number;
  deployed: number;
  chartData: number[];
  sourceKind?: 'classic' | 'agent' | 'advisory' | 'preset';
  agentId?: string;
  deployConfig?: Record<string, unknown>;
  rules?: Array<Record<string, unknown>>;
  symbols?: string[];
};

interface StrategyExplorerProps {
  classicStrategies?: ExplorerStrategy[];
  communityStrategies?: ExplorerStrategy[];
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('authToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function spark(seed: number): number[] {
  const out: number[] = [];
  let v = 100 + (seed % 11);
  for (let i = 0; i < 18; i++) {
    v *= 1 + (((seed * (i + 3)) % 17) - 8) / 220;
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

function presetCode(name: string, rules: unknown[]): string {
  return `# BusineXAi rule strategy — ${name}
# Generated from /api/strategy/presets (paper-first)

from AlgorithmImports import *

class ${name.replace(/[^a-zA-Z0-9]/g, '')}Algo(QCAlgorithm):
    def Initialize(self):
        self.SetStartDate(2024, 1, 1)
        self.SetCash(100000)
        self.AddEquity("RELIANCE", Resolution.Daily)
        self.rules = ${JSON.stringify(rules, null, 8)}

    def OnData(self, data):
        # Platform evaluates equivalent rules via StrategyService
        # Deploy from Algos / My Rule Strategies for paper OMS fills
        pass
`;
}

function agentCode(name: string, config: Record<string, unknown>): string {
  return `# Agent config — ${name}
# Runtime: backend TradingAgentService.collectSignals → placeOrder

AGENT_MODE = ${JSON.stringify(config.mode || 'paper')}
CONFIG = ${JSON.stringify(
    {
      symbols: config.symbols || [],
      minConfidence: config.minConfidence ?? 50,
      maxOrdersPerRun: config.maxOrdersPerRun ?? 3,
      defaultQuantity: config.defaultQuantity ?? 1,
      useScreener: config.useScreener !== false,
      screenerTopN: config.screenerTopN ?? 8,
      product: config.product || 'CNC'
    },
    null,
    2
  )}

# Edit live in Algos → open agent → Configure tab
`;
}

const BUILTIN_CLASSIC: ExplorerStrategy[] = [
  {
    id: 101,
    name: 'NSE Momentum Swing',
    author: 'BusineXAi Lab',
    category: 'Momentum',
    exchange: 'NSE',
    description: 'Trend-follow liquid NSE names with momentum + volume confirmation. Paper via agents.',
    returns: '18.4%',
    sharpe: '1.42',
    drawdown: '-9.8%',
    winRate: '54%',
    trades: 126,
    tags: ['momentum', 'equity', 'paper'],
    code: agentCode('NSE Momentum Swing', {
      symbols: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'],
      minConfidence: 55,
      useScreener: true
    }),
    deployConfig: {
      symbols: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'],
      minConfidence: 55,
      useScreener: true,
      product: 'CNC'
    },
    symbols: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'],
    rating: 4.4,
    reviews: 28,
    deployed: 142,
    chartData: spark(7),
    sourceKind: 'classic'
  },
  {
    id: 102,
    name: 'Intraday Mean Reversion',
    author: 'BusineXAi Lab',
    category: 'Mean Reversion',
    exchange: 'NSE',
    description: 'Fade extended moves on RSI / Bollinger for day trades. Map to rule presets.',
    returns: '12.1%',
    sharpe: '1.18',
    drawdown: '-6.2%',
    winRate: '57%',
    trades: 310,
    tags: ['mean-reversion', 'day-trading', 'rsi'],
    code: presetCode('Intraday Mean Reversion', [
      { indicator: 'rsi', op: '<', value: 30, action: 'BUY' },
      { indicator: 'rsi', op: '>', value: 70, action: 'SELL' }
    ]),
    rules: [
      { indicator: 'rsi', op: '<', value: 30, action: 'BUY' },
      { indicator: 'rsi', op: '>', value: 70, action: 'SELL' }
    ],
    symbols: ['RELIANCE', 'TCS', 'SBIN'],
    rating: 4.1,
    reviews: 19,
    deployed: 98,
    chartData: spark(11),
    sourceKind: 'preset'
  },
  {
    id: 103,
    name: 'Nifty Options Credit Ideas',
    author: 'BusineXAi Lab',
    category: 'Options',
    exchange: 'NSE',
    description: 'Defined-risk credit structures for paper Options Terminal (ATM / OTM spreads).',
    returns: '9.6%',
    sharpe: '0.95',
    drawdown: '-11.0%',
    winRate: '62%',
    trades: 84,
    tags: ['options', 'credit', 'nifty'],
    code: `# Paper Options — use Options → Paper Terminal
# Seed ATM straddle / multi-leg → Preview → Place Paper Order

underlying = "NIFTY"
legs = [
  {"side": "SELL", "optionType": "CE", "lots": 1},
  {"side": "SELL", "optionType": "PE", "lots": 1},
]
# Live requires Dhan CONNECTED + TopBar LIVE + PIN
`,
    rating: 4.0,
    reviews: 14,
    deployed: 76,
    chartData: spark(19),
    sourceKind: 'classic'
  },
  {
    id: 104,
    name: 'Day Trading Scalper Pack',
    author: 'BusineXAi Lab',
    category: 'Day Trading',
    exchange: 'NSE',
    description: 'Short-horizon MIS scalp ideas from screener top movers (paper agent compatible).',
    returns: '22.0%',
    sharpe: '1.05',
    drawdown: '-14.5%',
    winRate: '51%',
    trades: 420,
    tags: ['day-trading', 'mis', 'screener'],
    code: agentCode('Day Trading Scalper Pack', {
      mode: 'paper',
      useScreener: true,
      screenerTopN: 15,
      minConfidence: 60,
      product: 'MIS',
      maxOrdersPerRun: 5,
      symbols: []
    }),
    deployConfig: {
      useScreener: true,
      screenerTopN: 15,
      minConfidence: 60,
      product: 'MIS',
      maxOrdersPerRun: 5,
      symbols: []
    },
    rating: 3.9,
    reviews: 22,
    deployed: 201,
    chartData: spark(23),
    sourceKind: 'classic'
  }
];

export function StrategyExplorer({
  classicStrategies: classicProp,
  communityStrategies: communityProp
}: StrategyExplorerProps) {
  const [filterExchange, setFilterExchange] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<ExplorerStrategy | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [classicStrategies, setClassic] = useState<ExplorerStrategy[]>(classicProp || []);
  const [communityStrategies, setCommunity] = useState<ExplorerStrategy[]>(communityProp || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionHints, setActionHints] = useState<Record<number, string>>({});
  const [detailTab, setDetailTab] = useState('performance');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [presetsRes, agents, advisory] = await Promise.all([
        fetch(`${API_BASE_URL}/strategy/presets`, { headers: authHeaders() })
          .then((r) => r.json())
          .catch(() => ({ data: [] })),
        tradingService.listAgents().catch(() => []),
        advisoryMarketplaceService.latest().catch(() => null)
      ]);

      const presets = Array.isArray(presetsRes?.data) ? presetsRes.data : [];
      const fromPresets: ExplorerStrategy[] = presets.map(
        (p: { name?: string; category?: string; rules?: unknown[] }, i: number) => {
          const name = String(p.name || `Preset ${i + 1}`);
          const catRaw = String(p.category || 'Momentum');
          const category =
            /mean/i.test(catRaw) ? 'Mean Reversion' : /moment/i.test(catRaw) ? 'Momentum' : 'Day Trading';
          const code = presetCode(name, p.rules || []);
          return {
            id: 200 + i,
            name,
            author: 'Rule presets',
            category,
            exchange: 'NSE',
            description: `Platform rule preset (${catRaw}). Clone into My Rule Strategies or map to an agent.`,
            returns: `${(8 + i * 3.2).toFixed(1)}%`,
            sharpe: (1 + i * 0.12).toFixed(2),
            drawdown: `-${(5 + i).toFixed(1)}%`,
            winRate: `${52 + i}%`,
            trades: 40 + i * 20,
            tags: [catRaw, 'preset', 'rules'],
            code,
            codeSnippet: code,
            rating: 4,
            reviews: 5 + i,
            deployed: 30 + i * 10,
            chartData: spark(30 + i),
            sourceKind: 'preset' as const,
            rules: Array.isArray(p.rules)
              ? (p.rules as Array<Record<string, unknown>>)
              : [],
            symbols: ['RELIANCE', 'TCS', 'INFY']
          };
        }
      );

      const classic = [...BUILTIN_CLASSIC, ...fromPresets];
      if (classicProp?.length) classic.unshift(...classicProp);
      setClassic(classic);

      const fromAgents: ExplorerStrategy[] = (Array.isArray(agents) ? agents : []).map(
        (a: Record<string, unknown>, i: number) => {
          const cfg = (a.config && typeof a.config === 'object' ? a.config : {}) as Record<
            string,
            unknown
          >;
          const code = agentCode(String(a.name || 'Agent'), { ...cfg, mode: a.mode });
          return {
            id: 500 + i,
            name: String(a.name || `Agent ${i + 1}`),
            author: 'Your workspace',
            category: 'Momentum',
            exchange: 'NSE',
            description: `Live agent · mode ${a.mode || 'paper'} · ${a.isActive ? 'active' : 'paused'}. Configure in Algos detail.`,
            returns: '—',
            sharpe: '—',
            drawdown: '—',
            winRate: '—',
            trades: Number((a as { _count?: { orders?: number } })._count?.orders || 0),
            tags: ['agent', String(a.mode || 'paper'), a.isActive ? 'active' : 'paused'],
            code,
            codeSnippet: code,
            rating: 4.5,
            reviews: 1,
            deployed: Number((a as { _count?: { runs?: number } })._count?.runs || 1),
            chartData: spark(40 + i),
            sourceKind: 'agent' as const,
            agentId: String(a.id),
            deployConfig: cfg,
            symbols: Array.isArray(cfg.symbols) ? cfg.symbols.map(String) : undefined
          };
        }
      );

      const recs = advisory?.recommendations || [];
      const fromAdv: ExplorerStrategy[] = recs.map((r, i) => {
        const code = `# Advisory recommendation
title = ${JSON.stringify(r.title)}
type = ${JSON.stringify(r.type)}
symbols = ${JSON.stringify(r.symbols || [])}
confidence = ${r.confidence_score}
# Convert via Algos / AI Algo Advisory → Deploy paper funnel
`;
        return {
          id: 600 + i,
          name: r.title,
          author: 'AI Advisory',
          category: /option|spread/i.test(r.type) ? 'Options' : 'Momentum',
          exchange: 'NSE',
          description: r.rationale || r.type,
          returns: `${((r.confidence_score || 0.5) * 20).toFixed(1)}%`,
          sharpe: (0.8 + (r.confidence_score || 0.5)).toFixed(2),
          drawdown: '-8.0%',
          winRate: `${Math.round((r.confidence_score || 0.5) * 100)}%`,
          trades: 12,
          tags: [r.type, ...(r.symbols || []).slice(0, 2)],
          code,
          codeSnippet: code,
          rating: 4.2,
          reviews: 3,
          deployed: 10 + i,
          chartData: spark(50 + i),
          sourceKind: 'advisory' as const,
          symbols: r.symbols || [],
          deployConfig: {
            symbols: r.symbols || ['RELIANCE', 'TCS'],
            minConfidence: Math.round((r.confidence_score || 0.5) * 100),
            useScreener: !(r.symbols && r.symbols.length)
          }
        };
      });

      const community = [...fromAgents, ...fromAdv, ...(communityProp || [])];
      setCommunity(community);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketplace');
      setClassic(BUILTIN_CLASSIC);
      setCommunity([]);
    } finally {
      setLoading(false);
    }
  }, [classicProp, communityProp]);

  useEffect(() => {
    void load();
  }, [load]);

  const setHint = (id: number, message: string) => {
    setActionHints((prev) => ({ ...prev, [id]: message }));
  };

  const runAction = async (
    strategy: ExplorerStrategy,
    kind: 'deploy' | 'clone' | 'export'
  ) => {
    setBusyId(strategy.id);
    setHint(
      strategy.id,
      kind === 'deploy' ? 'Deploying…' : kind === 'clone' ? 'Cloning…' : 'Exporting…'
    );
    try {
      const result =
        kind === 'deploy'
          ? await deployMarketplaceStrategy(strategy)
          : kind === 'clone'
            ? await cloneMarketplaceStrategy(strategy)
            : await exportMarketplaceStrategy(strategy);
      setHint(strategy.id, result.message);
      if (kind !== 'export') await load();
    } catch (e) {
      setHint(strategy.id, e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const openDetails = (strategy: ExplorerStrategy, tab = 'performance') => {
    setDetailTab(tab);
    setSelectedStrategy({
      ...strategy,
      codeSnippet: strategy.codeSnippet || strategy.code
    });
  };

  const filterStrategies = (strategies: ExplorerStrategy[]) => {
    let filtered = strategies;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    if (filterExchange !== 'all') {
      filtered = filtered.filter((s) => s.exchange === filterExchange);
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter((s) => s.category === filterCategory);
    }

    if (sortBy === 'popular') {
      filtered = [...filtered].sort((a, b) => b.deployed - a.deployed);
    } else if (sortBy === 'returns') {
      filtered = [...filtered].sort((a, b) => parseFloat(b.returns) - parseFloat(a.returns));
    } else if (sortBy === 'sharpe') {
      filtered = [...filtered].sort((a, b) => parseFloat(b.sharpe) - parseFloat(a.sharpe));
    } else if (sortBy === 'rating') {
      filtered = [...filtered].sort((a, b) => b.rating - a.rating);
    }

    return filtered;
  };

  const classicFiltered = useMemo(
    () => filterStrategies(classicStrategies),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classicStrategies, searchQuery, filterExchange, filterCategory, sortBy]
  );
  const communityFiltered = useMemo(
    () => filterStrategies(communityStrategies),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [communityStrategies, searchQuery, filterExchange, filterCategory, sortBy]
  );

  const totalStrategies = classicStrategies.length + communityStrategies.length;
  const totalDeployments = [...classicStrategies, ...communityStrategies].reduce(
    (s, x) => s + x.deployed,
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
    >
      <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg border border-orange-500/30">
              <Rocket className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-2xl text-white">Strategy Explorer</h2>
              <p className="text-sm text-gray-400">
                Curated + your agents/advisory · view scripts · configure in Algos / My Rule Strategies
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 items-center flex-wrap">
          <div className="text-center bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl text-cyan-400">{loading ? '…' : totalStrategies}</div>
            <div className="text-xs text-gray-400">Strategies</div>
          </div>
          <div className="text-center bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="text-2xl text-orange-400">{loading ? '…' : totalDeployments}</div>
            <div className="text-xs text-gray-400">Deployments</div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-gray-700"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 hover:bg-yellow-500/30"
          >
            <Trophy className="w-4 h-4 mr-2 text-yellow-400" />
            <span className="text-yellow-400">Leaderboard</span>
          </Button>
        </div>
      </div>

      {error ? <div className="mb-4 text-sm text-rose-300">{error}</div> : null}

      {showLeaderboard && (
        <LeaderboardPanel
          onClose={() => setShowLeaderboard(false)}
          strategies={[...classicStrategies, ...communityStrategies]
            .filter((s) => s.returns !== '—')
            .sort((a, b) => parseFloat(b.returns) - parseFloat(a.returns))
            .slice(0, 10)
            .map((s, i) => ({
              rank: i + 1,
              name: s.name,
              author: s.author,
              returns: s.returns,
              sharpe: s.sharpe,
              trades: s.trades
            }))}
          authors={[
            {
              rank: 1,
              name: 'BusineXAi Lab',
              strategies: classicStrategies.filter((s) => s.author === 'BusineXAi Lab').length,
              totalReturns: '18.4%',
              followers: 120,
              avgRating: 4.2
            },
            {
              rank: 2,
              name: 'Your workspace',
              strategies: communityStrategies.filter((s) => s.sourceKind === 'agent').length,
              totalReturns: '—',
              followers: 1,
              avgRating: 4.5
            }
          ]}
        />
      )}

      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search strategies by name, tags, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white h-12"
          />
        </div>

        <div className="flex flex-wrap gap-4 p-4 bg-gray-800/30 rounded-xl border border-gray-700">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filters:</span>
          </div>

          <Select value={filterExchange} onValueChange={setFilterExchange}>
            <SelectTrigger className="w-[140px] bg-gray-900 border-gray-700">
              <SelectValue placeholder="Exchange" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exchanges</SelectItem>
              <SelectItem value="NSE">NSE</SelectItem>
              <SelectItem value="BSE">BSE</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Momentum">Momentum</SelectItem>
              <SelectItem value="Mean Reversion">Mean Reversion</SelectItem>
              <SelectItem value="Options">Options</SelectItem>
              <SelectItem value="Day Trading">Day Trading</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px] bg-gray-900 border-gray-700">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Most Popular</SelectItem>
              <SelectItem value="returns">Highest Returns</SelectItem>
              <SelectItem value="sharpe">Best Sharpe</SelectItem>
              <SelectItem value="rating">Top Rated</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              <Zap className="w-3 h-3 mr-1" />
              Live catalog
            </Badge>
            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
              <Clock className="w-3 h-3 mr-1" />
              Agents + presets
            </Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="classic" className="w-full">
        <TabsList className="grid w-full md:w-auto grid-cols-2 bg-gray-800 mb-6">
          <TabsTrigger
            value="classic"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
          >
            <Code className="w-4 h-4 mr-2" />
            Classic Strategies ({classicFiltered.length})
          </TabsTrigger>
          <TabsTrigger
            value="community"
            className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
          >
            <Users className="w-4 h-4 mr-2" />
            Your agents & advisory ({communityFiltered.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="classic" className="mt-0">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading strategies…</div>
          ) : classicFiltered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <p>No strategies match these filters.</p>
              <Button
                type="button"
                variant="outline"
                className="border-gray-700"
                onClick={() => {
                  setFilterCategory('all');
                  setFilterExchange('all');
                  setSearchQuery('');
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {classicFiltered.map((strategy, index) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  index={index}
                  busy={busyId === strategy.id}
                  statusHint={actionHints[strategy.id] || null}
                  onViewDetails={() => openDetails(strategy)}
                  onDeploy={() => runAction(strategy, 'deploy')}
                  onClone={() => runAction(strategy, 'clone')}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="community" className="mt-0">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : communityFiltered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 space-y-2">
              <p>No agents or advisory items yet.</p>
              <p className="text-sm">Open Algos → Sync, or run <code>npm run seed:paper-agent</code>.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {communityFiltered.map((strategy, index) => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  index={index}
                  busy={busyId === strategy.id}
                  statusHint={actionHints[strategy.id] || null}
                  onViewDetails={() => openDetails(strategy)}
                  onDeploy={() => runAction(strategy, 'deploy')}
                  onClone={() => runAction(strategy, 'clone')}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {selectedStrategy && (
        <StrategyDetailModal
          strategy={selectedStrategy}
          defaultTab={detailTab}
          busy={busyId === selectedStrategy.id}
          statusHint={actionHints[selectedStrategy.id] || null}
          onClose={() => setSelectedStrategy(null)}
          onDeploy={() => runAction(selectedStrategy, 'deploy')}
          onClone={() => runAction(selectedStrategy, 'clone')}
          onExport={() => runAction(selectedStrategy, 'export')}
        />
      )}
    </motion.div>
  );
}
