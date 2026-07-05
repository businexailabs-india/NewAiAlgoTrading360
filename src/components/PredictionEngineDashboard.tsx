import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Brain, Plus, Play, Rocket, Trash2, Loader2,
  TrendingUp, TrendingDown, Minus, Cloud, Server
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { predictionService, PredictionEngine, PredictionResult } from '../services/predictionService';

const ENGINE_TYPES = [
  { value: 'momentum', label: 'Momentum', desc: 'Trend-following based on price momentum' },
  { value: 'mean_reversion', label: 'Mean Reversion', desc: 'Buys dips, sells rallies' },
  { value: 'ml_regression', label: 'ML Regression', desc: 'Python ML with linear-style signals' },
  { value: 'sklearn', label: 'Sklearn ML', desc: 'Python gradient boosting on OHLCV features' },
  { value: 'advanced_ml', label: 'Advanced ML', desc: 'Walk-forward + stacking + hyperparameter tuning' },
  { value: 'ensemble', label: 'Ensemble', desc: 'Combines Node signals + Python ML' }
];

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  training: 'bg-yellow-500/20 text-yellow-400',
  ready: 'bg-green-500/20 text-green-400',
  deployed: 'bg-cyan-500/20 text-cyan-400',
  failed: 'bg-red-500/20 text-red-400'
};

export function PredictionEngineDashboard() {
  const [engines, setEngines] = useState<PredictionEngine[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [mlStatus, setMlStatus] = useState<{ healthy?: boolean; service?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newEngine, setNewEngine] = useState({
    name: '',
    engineType: 'ensemble' as PredictionEngine['engineType'],
    symbols: 'RELIANCE,TCS,INFY'
  });

  const loadEngines = async () => {
    try {
      setLoading(true);
      const [data, ml] = await Promise.all([
        predictionService.listEngines(),
        predictionService.getMlStatus().catch(() => null)
      ]);
      setEngines(data);
      setMlStatus(ml);
    } catch (err) {
      console.error('Failed to load engines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEngines(); }, []);

  const handleCreate = async () => {
    setActionLoading('create');
    try {
      await predictionService.createEngine({
        name: newEngine.name,
        engineType: newEngine.engineType,
        symbols: newEngine.symbols.split(',').map(s => s.trim()).filter(Boolean),
        parameters: { lookbackDays: 30, threshold: 0.02, horizonDays: 5 }
      });
      setShowCreate(false);
      setNewEngine({ name: '', engineType: 'ensemble', symbols: 'RELIANCE,TCS,INFY' });
      await loadEngines();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTrain = async (id: string) => {
    setActionLoading(`train-${id}`);
    try {
      await predictionService.trainEngine(id);
      await loadEngines();
    } finally {
      setActionLoading(null);
    }
  };

  const handlePredict = async (id: string) => {
    setActionLoading(`predict-${id}`);
    try {
      const results = await predictionService.runPredictions(id);
      setPredictions(results);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeploy = async (id: string, target: 'vercel' | 'aws') => {
    setActionLoading(`deploy-${id}`);
    try {
      await predictionService.deployEngine(id, target);
      await loadEngines();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this prediction engine?')) return;
    await predictionService.deleteEngine(id);
    await loadEngines();
  };

  const DirectionIcon = ({ direction }: { direction: string }) => {
    if (direction === 'BUY') return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (direction === 'SELL') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl text-white">Prediction Engine Platform</h2>
              <p className="text-sm text-gray-400">Create, train, and deploy ML prediction engines to Vercel or AWS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mlStatus && (
              <Badge className={mlStatus.healthy ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                <Server className="w-3 h-3 mr-1 inline" />
                ML {mlStatus.healthy ? 'Online' : 'Offline'}
              </Badge>
            )}
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-purple-500/20 border border-purple-500/30 text-purple-400">
            <Plus className="w-4 h-4 mr-2" /> New Engine
          </Button>
          </div>
        </div>

        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Engine name"
                value={newEngine.name}
                onChange={(e) => setNewEngine({ ...newEngine, name: e.target.value })}
                className="bg-gray-900 border-gray-700"
              />
              <Select
                value={newEngine.engineType}
                onValueChange={(v) => setNewEngine({ ...newEngine, engineType: v as PredictionEngine['engineType'] })}
              >
                <SelectTrigger className="bg-gray-900 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENGINE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Symbols (comma-separated)"
                value={newEngine.symbols}
                onChange={(e) => setNewEngine({ ...newEngine, symbols: e.target.value })}
                className="bg-gray-900 border-gray-700"
              />
            </div>
            <Button onClick={handleCreate} disabled={!newEngine.name || actionLoading === 'create'}>
              {actionLoading === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Engine'}
            </Button>
          </motion.div>
        )}
      </motion.div>

      <Tabs defaultValue="engines">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="engines">Engines ({engines.length})</TabsTrigger>
          <TabsTrigger value="predictions">Latest Predictions</TabsTrigger>
          <TabsTrigger value="types">Engine Types</TabsTrigger>
        </TabsList>

        <TabsContent value="engines" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
          ) : engines.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No prediction engines yet. Create one to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {engines.map((engine) => (
                <motion.div
                  key={engine.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-gray-900/50 border border-gray-800 rounded-xl p-5"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-white font-medium">{engine.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {(engine.symbols as string[]).join(', ')}
                      </p>
                    </div>
                    <Badge className={STATUS_COLORS[engine.status]}>{engine.status}</Badge>
                  </div>

                  <div className="flex gap-2 text-xs text-gray-400 mb-4">
                    <span className="px-2 py-1 bg-gray-800 rounded">{engine.engineType}</span>
                    {engine.accuracy != null && (
                      <span className="px-2 py-1 bg-gray-800 rounded">Accuracy: {Number(engine.accuracy).toFixed(1)}%</span>
                    )}
                    {engine._count && (
                      <span className="px-2 py-1 bg-gray-800 rounded">{engine._count.predictions} predictions</span>
                    )}
                  </div>

                  {engine.deployUrl && (
                    <p className="text-xs text-cyan-400 mb-3 truncate">Deployed: {engine.deployUrl}</p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTrain(engine.id)}
                      disabled={!!actionLoading}
                      className="border-gray-700"
                    >
                      {actionLoading === `train-${engine.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                      Train
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePredict(engine.id)}
                      disabled={!!actionLoading}
                      className="border-gray-700"
                    >
                      Predict
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeploy(engine.id, 'vercel')}
                      disabled={engine.status !== 'ready' && engine.status !== 'deployed'}
                      className="border-gray-700 text-cyan-400"
                    >
                      <Cloud className="w-3 h-3 mr-1" /> Vercel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeploy(engine.id, 'aws')}
                      disabled={engine.status !== 'ready' && engine.status !== 'deployed'}
                      className="border-gray-700 text-orange-400"
                    >
                      <Server className="w-3 h-3 mr-1" /> AWS
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(engine.id)}
                      className="border-red-500/30 text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="predictions" className="mt-4">
          {predictions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Run predictions on an engine to see results here.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {predictions.map((p) => (
                <div key={p.symbol} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{p.symbol}</span>
                    <div className="flex items-center gap-1">
                      <DirectionIcon direction={p.direction} />
                      <span className={
                        p.direction === 'BUY' ? 'text-green-400' :
                        p.direction === 'SELL' ? 'text-red-400' : 'text-gray-400'
                      }>{p.direction}</span>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-gray-400">
                      <span>Confidence</span>
                      <span className="text-white">{p.confidence}%</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Current</span>
                      <span className="text-white">₹{p.currentPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Target ({p.horizonDays}d)</span>
                      <span className="text-cyan-400">₹{p.targetPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ENGINE_TYPES.map((t) => (
              <div key={t.value} className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Rocket className="w-4 h-4 text-purple-400" />
                  <h3 className="text-white">{t.label}</h3>
                </div>
                <p className="text-sm text-gray-400">{t.desc}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
