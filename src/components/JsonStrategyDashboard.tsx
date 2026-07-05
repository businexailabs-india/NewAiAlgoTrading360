import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Code, Play, BarChart3, Plus, Loader2, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { tradingService } from '../services/tradingService';

interface RuleStrategy {
  id: string;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
  parameters?: { symbols?: string[]; rules?: unknown[] };
}

interface Preset {
  name: string;
  category: string;
  rules: unknown[];
}

export function JsonStrategyDashboard() {
  const [strategies, setStrategies] = useState<RuleStrategy[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbols, setSymbols] = useState('RELIANCE,TCS,SBIN');
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        tradingService.listStrategies(),
        tradingService.getStrategyPresets()
      ]);
      setStrategies(s);
      setPresets(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean);

  const createFromPreset = async (preset: Preset) => {
    setActionLoading(`create-${preset.name}`);
    try {
      await tradingService.createStrategy({
        name: preset.name,
        description: `${preset.category} rules from preset`,
        category: preset.category,
        symbols: symbolList,
        rules: preset.rules as Array<Record<string, unknown>>
      });
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const evaluate = async (id: string) => {
    setActionLoading(`eval-${id}`);
    try {
      const data = await tradingService.evaluateStrategy(id);
      setResults({ type: 'evaluate', data });
    } finally {
      setActionLoading(null);
    }
  };

  const backtest = async (id: string) => {
    setActionLoading(`bt-${id}`);
    try {
      const data = await tradingService.backtestStrategy(id, 7);
      setResults({ type: 'backtest', data });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg border border-orange-500/30">
              <Code className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h2 className="text-2xl text-white">JSON Rule Strategies</h2>
              <p className="text-sm text-gray-400">RSI, MACD, Bollinger rules — evaluate, backtest, wire to trading agents</p>
            </div>
          </div>
          <Input
            placeholder="Symbols (comma-separated)"
            value={symbols}
            onChange={e => setSymbols(e.target.value)}
            className="bg-gray-800 border-gray-700 max-w-xs"
          />
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-orange-400" /></div>
      ) : (
        <>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400" /> Presets</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {presets.map(p => (
                <div key={p.name} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <div className="flex justify-between mb-2">
                    <span className="text-white font-medium">{p.name}</span>
                    <Badge className="bg-gray-700 text-gray-300">{p.category}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{p.rules.length} rules</p>
                  <Button size="sm" variant="outline" className="border-gray-600 w-full" onClick={() => createFromPreset(p)} disabled={!!actionLoading}>
                    {actionLoading === `create-${p.name}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3 mr-1" /> Deploy</>}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3">My Strategies ({strategies.length})</h3>
            {strategies.length === 0 ? (
              <p className="text-gray-500 text-sm">Deploy a preset above to create your first rule strategy.</p>
            ) : (
              <div className="space-y-3">
                {strategies.map(s => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div>
                      <span className="text-white font-medium">{s.name}</span>
                      <p className="text-xs text-gray-500">
                        {(s.parameters?.symbols || []).join(', ') || 'No symbols'} · {s.category}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-gray-600" onClick={() => evaluate(s.id)} disabled={!!actionLoading}>
                        <Play className="w-3 h-3 mr-1" /> Evaluate
                      </Button>
                      <Button size="sm" variant="outline" className="border-gray-600 text-cyan-400" onClick={() => backtest(s.id)} disabled={!!actionLoading}>
                        <BarChart3 className="w-3 h-3 mr-1" /> Backtest
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {results && (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <h3 className="text-white font-medium mb-2">Latest {String(results.type)} Result</h3>
              <pre className="text-xs text-gray-300 overflow-auto max-h-64 p-3 bg-gray-800 rounded-lg">
                {JSON.stringify(results.data, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
