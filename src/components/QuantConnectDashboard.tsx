import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Square, TrendingUp, Activity, Zap, ExternalLink, Plus, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { quantconnectService, QCProject, QCBacktestResult, QCStrategyMetrics } from '../services/quantconnectService';

export function QuantConnectDashboard() {
  const [projects, setProjects] = useState<QCProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<QCProject | null>(null);
  const [backtestResults, setBacktestResults] = useState<QCBacktestResult | null>(null);
  const [strategyMetrics, setStrategyMetrics] = useState<QCStrategyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [backtesting, setBacktesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await quantconnectService.getProjects();
      setProjects(projectList);
      
      setSelectedProject(projectList[0] ?? null);
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to load projects. Please check your QuantConnect credentials and backend connection.');
      setProjects([]);
      setSelectedProject(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBacktest = async () => {
    if (!selectedProject) return;

    try {
      setBacktesting(true);
      setError(null);
      const result = await quantconnectService.runBacktest(
        selectedProject.projectId,
        `Backtest-${Date.now()}`
      );

      if (result.success) {
        // Poll for results
        setTimeout(async () => {
          try {
            const backtestData = await quantconnectService.getBacktestResults(
              selectedProject.projectId,
              result.backtestId
            );
            setBacktestResults(backtestData);

            const metrics = await quantconnectService.getStrategyMetrics(
              selectedProject.projectId,
              result.backtestId
            );
            setStrategyMetrics(metrics);
          } catch (err) {
            console.error('Error fetching backtest results:', err);
            setError('Backtest started but results not available yet.');
          }
        }, 5000); // Wait 5 seconds for backtest to complete
      }
    } catch (error) {
      console.error('Error running backtest:', error);
      setError('Failed to run backtest. Please check your QuantConnect credentials and try again.');
      setStrategyMetrics(null);
    } finally {
      setBacktesting(false);
    }
  };

  const handleCreateProject = async () => {
    try {
      setCreating(true);
      setError(null);
      const newProject = await quantconnectService.createProject(
        `Strategy-${Date.now()}`,
        'Py'
      );
      setProjects([...projects, newProject]);
      setSelectedProject(newProject);
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project. Please check your QuantConnect credentials.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-white mb-2">QuantConnect Integration</h2>
          <p className="text-gray-400">Connect your strategies to QuantConnect Cloud for backtesting and live trading</p>
        </div>
        <Button
          onClick={handleCreateProject}
          disabled={creating}
          className="bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </>
          )}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-yellow-400 font-semibold">Notice</p>
              <p className="text-yellow-300/80 text-sm mt-1">{error}</p>
              <p className="text-yellow-300/60 text-xs mt-2">
                To connect to real QuantConnect data, ensure your backend is running and credentials are configured.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projects List */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
        <h3 className="text-white mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          All Projects ({projects.length})
        </h3>

        {projects.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No projects found. Create your first project to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              return (
                <motion.div
                  key={project.projectId}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`
                    bg-gray-900/50 border rounded-lg p-4 cursor-pointer transition-all
                    ${selectedProject?.projectId === project.projectId
                      ? 'border-cyan-500 ring-2 ring-cyan-500/20'
                      : 'border-gray-700 hover:border-cyan-500/50'
                    }
                  `}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="text-white font-semibold">{project.name}</h4>
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      {project.language}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500">
                    Created: {new Date(project.created).toLocaleDateString()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Project Actions */}
      {selectedProject && (
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white text-lg">{selectedProject.name}</h3>
            <div className="flex gap-2">
              <Button
                onClick={handleRunBacktest}
                disabled={backtesting}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                {backtesting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Backtest
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="border-gray-700"
                onClick={() => window.open(`https://www.quantconnect.com/project/${selectedProject.projectId}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in QC
              </Button>
            </div>
          </div>

          {/* Results */}
          {strategyMetrics && (
            <Tabs defaultValue="metrics" className="w-full">
              <TabsList className="bg-gray-700/50 mb-6">
                <TabsTrigger value="metrics">Performance Metrics</TabsTrigger>
                <TabsTrigger value="trades">Trades</TabsTrigger>
                <TabsTrigger value="equity">Equity Curve</TabsTrigger>
              </TabsList>

              <TabsContent value="metrics">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-gray-900/50 border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-gray-400">Total P&L</span>
                    </div>
                    <div className={`text-2xl font-semibold ${strategyMetrics.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {strategyMetrics.totalPnL >= 0 ? '+' : ''}₹{strategyMetrics.totalPnL.toLocaleString()}
                    </div>
                  </Card>

                  <Card className="bg-gray-900/50 border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm text-gray-400">Win Rate</span>
                    </div>
                    <div className="text-2xl text-white font-semibold">
                      {strategyMetrics.winRate.toFixed(1)}%
                    </div>
                  </Card>

                  <Card className="bg-gray-900/50 border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-gray-400">Sharpe Ratio</span>
                    </div>
                    <div className="text-2xl text-white font-semibold">
                      {strategyMetrics.sharpeRatio.toFixed(2)}
                    </div>
                  </Card>

                  <Card className="bg-gray-900/50 border-gray-700 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-red-400" />
                      <span className="text-sm text-gray-400">Max Drawdown</span>
                    </div>
                    <div className="text-2xl text-red-400 font-semibold">
                      {strategyMetrics.maxDrawdown.toFixed(2)}%
                    </div>
                  </Card>

                  <Card className="bg-gray-900/50 border-gray-700 p-4">
                    <div className="text-sm text-gray-400 mb-1">Total Trades</div>
                    <div className="text-xl text-white">{strategyMetrics.totalTrades}</div>
                  </Card>

                  <Card className="bg-gray-900/50 border-gray-700 p-4">
                    <div className="text-sm text-gray-400 mb-1">Avg Return</div>
                    <div className="text-xl text-green-400">+{strategyMetrics.avgReturn.toFixed(2)}%</div>
                  </Card>

                  <Card className="bg-gray-900/50 border-gray-700 p-4">
                    <div className="text-sm text-gray-400 mb-1">Alpha</div>
                    <div className="text-xl text-cyan-400">{strategyMetrics.alpha.toFixed(3)}</div>
                  </Card>

                  <Card className="bg-gray-900/50 border-gray-700 p-4">
                    <div className="text-sm text-gray-400 mb-1">Beta</div>
                    <div className="text-xl text-white">{strategyMetrics.beta.toFixed(3)}</div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="trades">
                <div className="text-center py-8 text-gray-400">
                  <p>Trade details will be displayed here</p>
                  <p className="text-sm mt-2">Run a backtest to see individual trades</p>
                </div>
              </TabsContent>

              <TabsContent value="equity">
                <div className="text-center py-8 text-gray-400">
                  <p>Equity curve chart will be displayed here</p>
                  <p className="text-sm mt-2">Run a backtest to see the equity curve</p>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {!strategyMetrics && !backtesting && (
            <div className="text-center py-12 text-gray-400">
              <Play className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p>Run a backtest to see performance metrics</p>
            </div>
          )}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Zap className="w-6 h-6 text-cyan-400 mt-1" />
          <div>
            <h4 className="text-white font-semibold mb-2">QuantConnect Cloud Integration</h4>
            <p className="text-sm text-gray-300">Projects and backtest results shown above come from the configured QuantConnect integration.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
