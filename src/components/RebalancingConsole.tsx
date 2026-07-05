import { useState } from 'react';
import { motion } from 'motion/react';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Brain, PlayCircle, Loader2 } from 'lucide-react';
import { AIRecommendationsTable } from './AIRecommendationsTable';
import { tradingService } from '../services/tradingService';

interface RebalancingConsoleProps {
  autoExecute: boolean;
  setAutoExecute: (value: boolean) => void;
  selectedBroker: string;
  setSelectedBroker: (value: string) => void;
}

export function RebalancingConsole({ autoExecute, setAutoExecute, selectedBroker, setSelectedBroker }: RebalancingConsoleProps) {
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleExecuteRebalance = async () => {
    setExecuting(true);
    setLastResult(null);
    try {
      const screener = await tradingService.runScreener({ topN: 5 });
      const buys = screener.topBuys || screener.stocks?.filter((s: { signal: string }) => s.signal === 'BUY').slice(0, 3) || [];
      const isPaper = !autoExecute;

      for (const stock of buys) {
        await tradingService.placeOrder({
          symbol: stock.symbol,
          tradeType: 'BUY',
          quantity: 1,
          isPaper
        });
      }

      setLastResult(`Executed ${buys.length} ${isPaper ? 'paper' : 'live'} buy orders from screener picks`);
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : 'Rebalance failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <Brain className="w-6 h-6 text-cyan-400" />
        <h2 className="text-2xl text-white">Smart Rebalancing Console</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Target Allocation Rules */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-cyan-400 mb-4">Target Allocation (%)</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Technology</span>
                <span className="text-sm text-white">30%</span>
              </div>
              <Slider defaultValue={[30]} max={100} step={1} className="w-full" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Finance</span>
                <span className="text-sm text-white">25%</span>
              </div>
              <Slider defaultValue={[25]} max={100} step={1} className="w-full" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Healthcare</span>
                <span className="text-sm text-white">20%</span>
              </div>
              <Slider defaultValue={[20]} max={100} step={1} className="w-full" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Energy</span>
                <span className="text-sm text-white">15%</span>
              </div>
              <Slider defaultValue={[15]} max={100} step={1} className="w-full" />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-400">Consumer</span>
                <span className="text-sm text-white">10%</span>
              </div>
              <Slider defaultValue={[10]} max={100} step={1} className="w-full" />
            </div>
          </div>
        </div>

        {/* Rebalance Settings */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-cyan-400 mb-4">Rebalance Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Frequency</label>
              <Select defaultValue="monthly">
                <SelectTrigger className="bg-gray-900 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">Risk Profile</label>
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Conservative</span>
                <span>Aggressive</span>
              </div>
              <Slider defaultValue={[60]} max={100} step={1} className="w-full" />
              <div className="text-center mt-2 text-cyan-400">Moderate-Aggressive</div>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">Broker API</label>
              <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                <SelectTrigger className="bg-gray-900 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Zerodha">Zerodha</SelectItem>
                  <SelectItem value="AngelOne">AngelOne</SelectItem>
                  <SelectItem value="Interactive Brokers">Interactive Brokers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Auto Execution */}
        <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-xl p-4 border border-cyan-500/30">
          <h3 className="text-cyan-400 mb-4">Auto Execution</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
              <div>
                <div className="text-white">Auto Execute Trades</div>
                <div className="text-xs text-gray-500">Via {selectedBroker} API</div>
              </div>
              <Switch checked={autoExecute} onCheckedChange={setAutoExecute} />
            </div>
            
            {autoExecute && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3"
              >
                <div className="text-sm text-yellow-400">⚠️ Warning</div>
                <div className="text-xs text-gray-400 mt-1">
                  Trades will be executed automatically. Ensure sufficient funds and review tax implications.
                </div>
              </motion.div>
            )}

            <Button
              onClick={handleExecuteRebalance}
              disabled={executing}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
            >
              {executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              {autoExecute ? 'Execute Live Rebalance' : 'Execute Paper Rebalance'}
            </Button>
            {lastResult && (
              <p className="text-xs text-gray-400 mt-2">{lastResult}</p>
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendations Table */}
      <AIRecommendationsTable />
    </motion.div>
  );
}
