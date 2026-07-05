import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Bot, Play, Plus, Loader2, TrendingUp, TrendingDown,
  Search, Layers, ShoppingCart, Zap, AlertTriangle, Trash2
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { tradingService } from '../services/tradingService';
import { predictionService } from '../services/predictionService';

export function TradingOperationsDashboard() {
  const [agents, setAgents] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [screener, setScreener] = useState<any>(null);
  const [optionsSignals, setOptionsSignals] = useState<any[]>([]);
  const [engines, setEngines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', mode: 'paper' as 'paper' | 'live', engineId: '' });

  const load = async () => {
    try {
      const [a, o, e] = await Promise.all([
        tradingService.listAgents(),
        tradingService.getOrders(),
        predictionService.listEngines().catch(() => [])
      ]);
      setAgents(a);
      setOrders(o);
      setEngines(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreateAgent = async () => {
    setActionId('create');
    try {
      await tradingService.createAgent({
        name: newAgent.name,
        mode: newAgent.mode,
        engineId: newAgent.engineId || undefined,
        config: { minConfidence: 65, maxOrdersPerRun: 5, useScreener: true, screenerTopN: 10 }
      });
      setShowCreateAgent(false);
      setNewAgent({ name: '', mode: 'paper', engineId: '' });
      await load();
    } finally {
      setActionId(null);
    }
  };

  const handleRunAgent = async (id: string) => {
    setActionId(id);
    try {
      await tradingService.runAgent(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Agent run failed');
    } finally {
      setActionId(null);
    }
  };

  const handleRunScreener = async () => {
    setActionId('screener');
    try {
      const result = await tradingService.runScreener({ topN: 15 });
      setScreener(result);
    } finally {
      setActionId(null);
    }
  };

  const handleOptionsScan = async () => {
    setActionId('options');
    try {
      const result = await tradingService.getOptionsSignals(['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS']);
      setOptionsSignals(result.signals || []);
    } finally {
      setActionId(null);
    }
  };

  const handleQuickOrder = async (symbol: string, tradeType: 'BUY' | 'SELL', isPaper = true) => {
    setActionId(`order-${symbol}`);
    try {
      await tradingService.placeOrder({ symbol, tradeType, quantity: 1, isPaper });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-green-500/20 to-cyan-500/20 rounded-lg border border-green-500/30">
            <Zap className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl text-white">Auto Trading Operations</h2>
            <p className="text-sm text-gray-400">Agents, order execution, stock screener & options signals</p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="agents">
        <TabsList className="bg-gray-900 border border-gray-800 flex-wrap h-auto">
          <TabsTrigger value="agents">Trading Agents</TabsTrigger>
          <TabsTrigger value="orders">Order Book</TabsTrigger>
          <TabsTrigger value="screener">Stock Screener</TabsTrigger>
          <TabsTrigger value="options">Options Signals</TabsTrigger>
        </TabsList>

        {/* AGENTS */}
        <TabsContent value="agents" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-400 text-sm">Agents connect prediction engines + screener → automatic orders</p>
            <Button onClick={() => setShowCreateAgent(!showCreateAgent)} className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
              <Plus className="w-4 h-4 mr-1" /> New Agent
            </Button>
          </div>

          {showCreateAgent && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <Input placeholder="Agent name" value={newAgent.name} onChange={e => setNewAgent({ ...newAgent, name: e.target.value })} className="bg-gray-900 border-gray-700" />
              <Select value={newAgent.mode} onValueChange={v => setNewAgent({ ...newAgent, mode: v as 'paper' | 'live' })}>
                <SelectTrigger className="bg-gray-900 border-gray-700"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paper">Paper Trading</SelectItem>
                  <SelectItem value="live">Live Trading</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newAgent.engineId} onValueChange={v => setNewAgent({ ...newAgent, engineId: v })}>
                <SelectTrigger className="bg-gray-900 border-gray-700"><SelectValue placeholder="Prediction engine (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {engines.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleCreateAgent} disabled={!newAgent.name || actionId === 'create'}>
                {actionId === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
              </Button>
            </div>
          )}

          {agents.length === 0 ? (
            <div className="text-center py-12 text-gray-400 border border-dashed border-gray-700 rounded-xl">
              No agents yet. Create one to start automated trading in paper mode.
            </div>
          ) : (
            agents.map(agent => (
              <div key={agent.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-cyan-400" />
                    <span className="text-white font-medium">{agent.name}</span>
                    <Badge className={agent.mode === 'paper' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}>
                      {agent.mode}
                    </Badge>
                    {agent.isActive && <Badge className="bg-green-500/20 text-green-400">Active</Badge>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Runs: {agent._count?.runs || 0} · Orders: {agent._count?.orders || 0}
                    {agent.lastRunAt && ` · Last: ${new Date(agent.lastRunAt).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleRunAgent(agent.id)} disabled={!!actionId} className="bg-green-500/20 border border-green-500/30 text-green-400">
                    {actionId === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Play className="w-3 h-3 mr-1" /> Run Now</>}
                  </Button>
                  <Button size="sm" variant="outline" className="border-gray-700" onClick={() => tradingService.updateAgent(agent.id, { isActive: !agent.isActive }).then(load)}>
                    {agent.isActive ? 'Pause' : 'Activate'}
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-500/30 text-red-400" onClick={() => tradingService.deleteAgent(agent.id).then(load)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              <strong className="text-yellow-400">Paper mode is default.</strong> Agents place simulated orders using live market prices.
              Switch to <strong>live</strong> only after connecting a broker and testing thoroughly.
            </div>
          </div>
        </TabsContent>

        {/* ORDERS */}
        <TabsContent value="orders" className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left py-3 px-2">Time</th>
                  <th className="text-left py-3 px-2">Symbol</th>
                  <th className="text-left py-3 px-2">Type</th>
                  <th className="text-left py-3 px-2">Qty</th>
                  <th className="text-left py-3 px-2">Price</th>
                  <th className="text-left py-3 px-2">Mode</th>
                  <th className="text-left py-3 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-gray-500">No orders yet — run an agent or place a manual order</td></tr>
                ) : orders.map(o => (
                  <tr key={o.id} className="border-b border-gray-800/50 text-gray-300">
                    <td className="py-3 px-2">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="py-3 px-2 text-white">{o.symbol}</td>
                    <td className={`py-3 px-2 ${o.tradeType === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>{o.tradeType}</td>
                    <td className="py-3 px-2">{o.quantity}</td>
                    <td className="py-3 px-2">₹{Number(o.price || 0).toLocaleString()}</td>
                    <td className="py-3 px-2"><Badge className={o.isPaper ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}>{o.isPaper ? 'Paper' : 'Live'}</Badge></td>
                    <td className="py-3 px-2"><Badge className="bg-gray-700">{o.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* SCREENER */}
        <TabsContent value="screener" className="mt-4 space-y-4">
          <Button onClick={handleRunScreener} disabled={actionId === 'screener'} className="bg-purple-500/20 border border-purple-500/30 text-purple-400">
            {actionId === 'screener' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Scan NIFTY 50 for Best Picks
          </Button>

          {screener && (
            <>
              <p className="text-sm text-gray-400">Scanned {screener.totalScanned} stocks · {screener.scannedAt}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {screener.stocks?.map((s: any) => (
                  <div key={s.symbol} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-white font-medium">#{s.rank} {s.symbol}</span>
                        <div className="text-xs text-gray-500">Score: {s.score}</div>
                      </div>
                      <Badge className={s.signal === 'BUY' ? 'bg-green-500/20 text-green-400' : s.signal === 'SELL' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}>
                        {s.signal}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1">
                      <div>₹{s.price?.toLocaleString()} ({s.changePercent > 0 ? '+' : ''}{s.changePercent}%)</div>
                      <div>Momentum: {s.momentum}%</div>
                    </div>
                    {s.signal === 'BUY' && (
                      <Button size="sm" className="mt-3 w-full" variant="outline" onClick={() => handleQuickOrder(s.symbol, 'BUY')} disabled={!!actionId}>
                        <ShoppingCart className="w-3 h-3 mr-1" /> Paper Buy
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* OPTIONS */}
        <TabsContent value="options" className="mt-4 space-y-4">
          <Button onClick={handleOptionsScan} disabled={actionId === 'options'} className="bg-orange-500/20 border border-orange-500/30 text-orange-400">
            {actionId === 'options' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
            Scan Options Signals
          </Button>

          {optionsSignals.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {optionsSignals.map((s: any, i: number) => (
                <div key={i} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-white">{s.underlying} {s.strike} {s.optionType}</span>
                    <Badge className={s.signal === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}>{s.signal}</Badge>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    <div>Strategy: <span className="text-cyan-400">{s.strategy}</span></div>
                    <div>LTP: ₹{s.ltp} · IV: {s.iv}% · Confidence: {s.confidence}%</div>
                    <div className="text-xs">{s.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
