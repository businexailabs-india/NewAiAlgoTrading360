import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Button } from './ui/button';
import { Brain, PlayCircle, Loader2 } from 'lucide-react';
import { AIRecommendationsTable } from './AIRecommendationsTable';
import { tradingService } from '../services/tradingService';
import { integrationService, BrokerAccountView } from '../services/integrationService';

interface RebalancingConsoleProps {
  autoExecute: boolean;
  setAutoExecute: (value: boolean) => void;
  selectedBroker: string;
  setSelectedBroker: (value: string) => void;
}

export function RebalancingConsole({ autoExecute, setAutoExecute, selectedBroker, setSelectedBroker }: RebalancingConsoleProps) {
  const [executing, setExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<BrokerAccountView[]>([]);

  useEffect(() => {
    setAutoExecute(false);
    integrationService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [setAutoExecute]);

  const handleExecuteRebalance = async () => {
    setExecuting(true);
    setLastResult(null);
    try {
      const screener = await tradingService.runScreener({ topN: 5 });
      const buys = screener.topBuys || screener.stocks?.filter((s: { signal: string }) => s.signal === 'BUY').slice(0, 3) || [];
      for (const stock of buys) {
        await tradingService.placeOrder({
          symbol: stock.symbol,
          tradeType: 'BUY',
          quantity: 1,
          isPaper: true
        });
      }

      setLastResult(`Executed ${buys.length} paper buy orders from screener results`);
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
          <div className="text-center py-12 text-gray-400">No target allocation configuration is available.</div>
        </div>

        {/* Rebalance Settings */}
        <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
          <h3 className="text-cyan-400 mb-4">Rebalance Settings</h3>
          <div className="space-y-4">
            <div className="text-sm text-gray-400">Frequency: <span className="text-white">—</span></div>
            <div className="text-sm text-gray-400">Risk profile: <span className="text-white">—</span></div>

            <div>
              <label className="text-sm text-gray-400 block mb-2">Broker API</label>
              <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                <SelectTrigger className="bg-gray-900 border-gray-700">
                  <SelectValue placeholder="No account selected" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>{account.displayName || account.broker}</SelectItem>
                  ))}
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
                <div className="text-white">Execution Mode</div>
                <div className="text-xs text-gray-500">Paper trading only</div>
              </div>
              <span className="text-sm text-cyan-400">Paper</span>
            </div>

            <Button
              onClick={handleExecuteRebalance}
              disabled={executing}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
            >
              {executing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
              Execute Paper Rebalance
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
