import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, CheckCircle, AlertCircle, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface AccountManagementModalProps {
  onClose: () => void;
}

interface BrokerAccount {
  id: string;
  broker: string;
  accountId: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSynced: string;
  portfolioValue: number;
  logo: string;
}

const connectedAccounts: BrokerAccount[] = [
  {
    id: 'acc-1',
    broker: 'Zerodha',
    accountId: 'ZER***234',
    status: 'connected',
    lastSynced: '2 mins ago',
    portfolioValue: 1547325.50,
    logo: 'Z'
  },
  {
    id: 'acc-2',
    broker: 'AngelOne',
    accountId: 'ANG***891',
    status: 'connected',
    lastSynced: '5 mins ago',
    portfolioValue: 1300000.00,
    logo: 'A'
  },
  {
    id: 'acc-3',
    broker: 'Interactive Brokers',
    accountId: 'IB***567',
    status: 'error',
    lastSynced: '2 hours ago',
    portfolioValue: 0,
    logo: 'IB'
  }
];

export function AccountManagementModal({ onClose }: AccountManagementModalProps) {
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [accounts, setAccounts] = useState(connectedAccounts);

  const handleConnectAccount = () => {
    // Handle account connection logic
    console.log('Connecting to:', selectedBroker, apiKey, apiSecret);
    setSelectedBroker(null);
    setApiKey('');
    setApiSecret('');
  };

  const handleDisconnect = (accountId: string) => {
    setAccounts(accounts.filter(acc => acc.id !== accountId));
  };

  const handleSync = (accountId: string) => {
    // Handle sync logic
    console.log('Syncing account:', accountId);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-900 border border-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl text-white mb-1">Account Management</h2>
              <p className="text-gray-400">Connect and manage your exchange accounts</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <Tabs defaultValue="connected" className="w-full">
            <TabsList className="bg-gray-800 mb-6">
              <TabsTrigger value="connected" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                Connected Accounts ({accounts.length})
              </TabsTrigger>
              <TabsTrigger value="add" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
                Add New Account
              </TabsTrigger>
            </TabsList>

            {/* Connected Accounts */}
            <TabsContent value="connected">
              <div className="space-y-4">
                {accounts.map((account) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800/50 border border-gray-700 rounded-xl p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white">
                          {account.logo}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white">{account.broker}</h3>
                            {account.status === 'connected' ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Connected
                              </Badge>
                            ) : account.status === 'error' ? (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Connection Error
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                                Disconnected
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-400 mb-2">
                            Account ID: {account.accountId}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-gray-500">Portfolio Value</div>
                              <div className="text-white">
                                ₹{account.portfolioValue.toLocaleString('en-IN')}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Last Synced</div>
                              <div className="text-white">{account.lastSynced}</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-700 hover:bg-gray-700"
                          onClick={() => handleSync(account.id)}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-700 text-red-400 hover:bg-red-900/20"
                          onClick={() => handleDisconnect(account.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {account.status === 'error' && (
                      <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <div className="text-sm text-red-400">
                          Unable to sync. Please reconnect your account or check API credentials.
                        </div>
                        <Button
                          size="sm"
                          className="mt-2 bg-red-500/20 hover:bg-red-500/30 text-red-400"
                        >
                          Reconnect
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            {/* Add New Account */}
            <TabsContent value="add">
              <div className="space-y-6">
                <div>
                  <h3 className="text-white mb-4">Select Broker</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {['Zerodha', 'AngelOne', 'Interactive Brokers'].map((broker) => (
                      <motion.div
                        key={broker}
                        whileHover={{ scale: 1.02 }}
                        className={`bg-gray-800/50 border ${
                          selectedBroker === broker
                            ? 'border-cyan-500 bg-cyan-500/10'
                            : 'border-gray-700'
                        } rounded-xl p-4 cursor-pointer transition-all`}
                        onClick={() => setSelectedBroker(broker)}
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xl mb-3">
                            {broker.substring(0, 2)}
                          </div>
                          <h4 className="text-white">{broker}</h4>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {selectedBroker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
                  >
                    <h3 className="text-white mb-4">Connect {selectedBroker}</h3>
                    
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                      <div className="flex gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-400">
                          <p className="mb-2">You'll need API credentials from your broker:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Login to your {selectedBroker} account</li>
                            <li>Navigate to API section</li>
                            <li>Generate API Key and Secret</li>
                          </ul>
                          <Button
                            variant="link"
                            className="text-cyan-400 p-0 h-auto mt-2"
                          >
                            View Setup Guide <ExternalLink className="w-3 h-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="apiKey" className="text-gray-300">API Key</Label>
                        <Input
                          id="apiKey"
                          type="text"
                          placeholder="Enter your API key"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="bg-gray-900 border-gray-700 text-white mt-2"
                        />
                      </div>

                      <div>
                        <Label htmlFor="apiSecret" className="text-gray-300">API Secret</Label>
                        <Input
                          id="apiSecret"
                          type="password"
                          placeholder="Enter your API secret"
                          value={apiSecret}
                          onChange={(e) => setApiSecret(e.target.value)}
                          className="bg-gray-900 border-gray-700 text-white mt-2"
                        />
                      </div>

                      <Button
                        onClick={handleConnectAccount}
                        disabled={!apiKey || !apiSecret}
                        className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Connect Account
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  );
}
