import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { 
  Bell, 
  Shield, 
  Palette, 
  Zap, 
  Database, 
  Key, 
  Globe, 
  Moon,
  Sun,
  Mail,
  MessageSquare,
  DollarSign,
  Lock,
  Eye,
  EyeOff,
  Check,
  Save,
  CheckCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

// Settings storage key
const SETTINGS_STORAGE_KEY = 'smarttrade_settings';

// Default settings
const DEFAULT_SETTINGS = {
  notifications: {
    emailAlerts: true,
    pushNotifications: true,
    tradeExecutions: true,
    priceAlerts: true,
    anomalyDetection: true,
    dailyReports: false,
    weeklyReports: true
  },
  general: {
    language: 'en',
    currency: 'INR',
    timezone: 'Asia/Kolkata'
  },
  appearance: {
    theme: 'dark',
    chartColorScheme: 'green-red'
  },
  trading: {
    defaultOrderType: 'market',
    defaultQuantity: 100,
    maxPositionSize: 100000,
    defaultStopLoss: 3.5,
    defaultTarget: 5.0
  },
  security: {
    twoFactorEnabled: true
  }
};

export function SettingsPanel() {
  // Load settings from localStorage on mount
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    return DEFAULT_SETTINGS;
  };

  const [notifications, setNotifications] = useState(loadSettings().notifications);
  const [theme, setTheme] = useState(loadSettings().appearance.theme);
  const [language, setLanguage] = useState(loadSettings().general.language);
  const [currency, setCurrency] = useState(loadSettings().general.currency);
  const [timezone, setTimezone] = useState(loadSettings().general.timezone);
  const [chartColorScheme, setChartColorScheme] = useState(loadSettings().appearance.chartColorScheme);
  const [tradingSettings, setTradingSettings] = useState(loadSettings().trading);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(loadSettings().security.twoFactorEnabled);
  
  const [showApiKey, setShowApiKey] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Save all settings to localStorage
  const saveAllSettings = () => {
    const settings = {
      notifications,
      general: {
        language,
        currency,
        timezone
      },
      appearance: {
        theme,
        chartColorScheme
      },
      trading: tradingSettings,
      security: {
        twoFactorEnabled
      },
      lastUpdated: new Date().toISOString()
    };

    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      console.log('Settings saved successfully:', settings);
      
      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  };

  const handleSaveSettings = () => {
    saveAllSettings();
  };

  // Auto-save when critical settings change
  useEffect(() => {
    const timer = setTimeout(() => {
      saveAllSettings();
    }, 1000); // Debounce auto-save by 1 second

    return () => clearTimeout(timer);
  }, [notifications, theme, language, currency, timezone, twoFactorEnabled]);

  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3"
        >
          <CheckCircle className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-green-400 font-medium">Settings Saved Successfully!</p>
            <p className="text-sm text-green-300/70">Your preferences have been updated.</p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-500/30">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl text-white">Settings</h2>
            <p className="text-sm text-gray-400">Manage your platform preferences and security</p>
          </div>
        </div>
      </motion.div>

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-gray-800 mb-6 flex-wrap h-auto">
          <TabsTrigger value="general" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Globe className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Key className="w-4 h-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="trading" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Zap className="w-4 h-4 mr-2" />
            Trading
          </TabsTrigger>
          <TabsTrigger value="appearance" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Palette className="w-4 h-4 mr-2" />
            Appearance
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6 space-y-6"
          >
            <div>
              <h3 className="text-white mb-4">Regional Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="language" className="text-gray-300">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="mr">Marathi</SelectItem>
                      <SelectItem value="ta">Tamil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="currency" className="text-gray-300">Default Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="timezone" className="text-gray-300">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                      <SelectItem value="America/New_York">America/New York (EST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button onClick={handleSaveSettings} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
              Save Changes
            </Button>
          </motion.div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6 space-y-6"
          >
            <div>
              <h3 className="text-white mb-4">Notification Preferences</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-white">Email Alerts</div>
                      <div className="text-sm text-gray-400">Receive important updates via email</div>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.emailAlerts}
                    onCheckedChange={(checked) => setNotifications({...notifications, emailAlerts: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-white">Push Notifications</div>
                      <div className="text-sm text-gray-400">Real-time browser notifications</div>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.pushNotifications}
                    onCheckedChange={(checked) => setNotifications({...notifications, pushNotifications: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-white">Trade Executions</div>
                      <div className="text-sm text-gray-400">Notify on trade executions</div>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.tradeExecutions}
                    onCheckedChange={(checked) => setNotifications({...notifications, tradeExecutions: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-yellow-400" />
                    <div>
                      <div className="text-white">Price Alerts</div>
                      <div className="text-sm text-gray-400">Alerts for price movements</div>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.priceAlerts}
                    onCheckedChange={(checked) => setNotifications({...notifications, priceAlerts: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-red-400" />
                    <div>
                      <div className="text-white">Anomaly Detection</div>
                      <div className="text-sm text-gray-400">Alert on trading anomalies</div>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.anomalyDetection}
                    onCheckedChange={(checked) => setNotifications({...notifications, anomalyDetection: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                    <div>
                      <div className="text-white">Daily Reports</div>
                      <div className="text-sm text-gray-400">Daily P&L summary reports</div>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.dailyReports}
                    onCheckedChange={(checked) => setNotifications({...notifications, dailyReports: checked})}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="text-white">Weekly Reports</div>
                      <div className="text-sm text-gray-400">Weekly performance summaries</div>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.weeklyReports}
                    onCheckedChange={(checked) => setNotifications({...notifications, weeklyReports: checked})}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveSettings} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
              Save Preferences
            </Button>
          </motion.div>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white mb-4">Security Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-400" />
                    <div>
                      <div className="text-white">Two-Factor Authentication</div>
                      <div className="text-sm text-gray-400">Add extra security layer</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      <Check className="w-3 h-3 mr-1" />
                      Enabled
                    </Badge>
                    <Switch 
                      checked={twoFactorEnabled}
                      onCheckedChange={setTwoFactorEnabled}
                    />
                  </div>
                </div>

                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <Label htmlFor="current-password" className="text-white mb-2">Change Password</Label>
                  <div className="space-y-3 mt-3">
                    <Input 
                      id="current-password"
                      type="password" 
                      placeholder="Current Password" 
                      className="bg-gray-800 border-gray-700"
                    />
                    <Input 
                      type="password" 
                      placeholder="New Password" 
                      className="bg-gray-800 border-gray-700"
                    />
                    <Input 
                      type="password" 
                      placeholder="Confirm New Password" 
                      className="bg-gray-800 border-gray-700"
                    />
                    <Button size="sm" className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border-cyan-500/30">
                      Update Password
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white mb-4">Active Sessions</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div>
                    <div className="text-white">Chrome on Windows</div>
                    <div className="text-sm text-gray-400">Mumbai, India • Active now</div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Current</Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
                  <div>
                    <div className="text-white">Mobile App on Android</div>
                    <div className="text-sm text-gray-400">Mumbai, India • 2 hours ago</div>
                  </div>
                  <Button size="sm" variant="outline" className="border-red-700 text-red-400 hover:bg-red-900/20">
                    Revoke
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <h3 className="text-white mb-4">API Key Management</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <Shield className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-yellow-400 mb-1">Security Notice</div>
                    <div className="text-sm text-gray-300">Never share your API keys. They provide full access to your trading account.</div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-white">Zerodha API Key</div>
                      <div className="text-sm text-gray-400">Created: Jan 5, 2025</div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      type={showApiKey ? "text" : "password"}
                      value="ak_live_xxxxxxxxxxxxxxxxxxxxxx"
                      readOnly
                      className="bg-gray-800 border-gray-700 font-mono text-sm"
                    />
                    <Button 
                      size="icon"
                      variant="outline"
                      className="border-gray-700"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="p-4 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-white">AngelOne API Key</div>
                      <div className="text-sm text-gray-400">Created: Dec 28, 2024</div>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="password"
                      value="ak_live_xxxxxxxxxxxxxxxxxxxxxx"
                      readOnly
                      className="bg-gray-800 border-gray-700 font-mono text-sm"
                    />
                    <Button size="icon" variant="outline" className="border-gray-700">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                <Key className="w-4 h-4 mr-2" />
                Generate New API Key
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        {/* Trading Settings */}
        <TabsContent value="trading">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6 space-y-6"
          >
            <div>
              <h3 className="text-white mb-4">Trading Preferences</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="default-order-type" className="text-gray-300">Default Order Type</Label>
                  <Select 
                    value={tradingSettings.defaultOrderType}
                    onValueChange={(value) => setTradingSettings({...tradingSettings, defaultOrderType: value})}
                  >
                    <SelectTrigger className="bg-gray-800 border-gray-700 mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="market">Market Order</SelectItem>
                      <SelectItem value="limit">Limit Order</SelectItem>
                      <SelectItem value="stop-loss">Stop Loss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="default-quantity" className="text-gray-300">Default Quantity</Label>
                  <Input 
                    id="default-quantity"
                    type="number"
                    value={tradingSettings.defaultQuantity}
                    onChange={(e) => setTradingSettings({...tradingSettings, defaultQuantity: parseInt(e.target.value) || 0})}
                    className="bg-gray-800 border-gray-700 mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="max-position-size" className="text-gray-300">Max Position Size (₹)</Label>
                  <Input 
                    id="max-position-size"
                    type="number"
                    value={tradingSettings.maxPositionSize}
                    onChange={(e) => setTradingSettings({...tradingSettings, maxPositionSize: parseInt(e.target.value) || 0})}
                    className="bg-gray-800 border-gray-700 mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="default-stop-loss" className="text-gray-300">Default Stop Loss (%)</Label>
                  <Input 
                    id="default-stop-loss"
                    type="number"
                    step="0.1"
                    value={tradingSettings.defaultStopLoss}
                    onChange={(e) => setTradingSettings({...tradingSettings, defaultStopLoss: parseFloat(e.target.value) || 0})}
                    className="bg-gray-800 border-gray-700 mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="default-target" className="text-gray-300">Default Target (%)</Label>
                  <Input 
                    id="default-target"
                    type="number"
                    step="0.1"
                    value={tradingSettings.defaultTarget}
                    onChange={(e) => setTradingSettings({...tradingSettings, defaultTarget: parseFloat(e.target.value) || 0})}
                    className="bg-gray-800 border-gray-700 mt-2"
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveSettings} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
              Save Trading Settings
            </Button>
          </motion.div>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
          >
            <h3 className="text-white mb-4">Appearance Settings</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 mb-3 block">Theme</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === 'dark'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-gray-700 bg-gray-900/50'
                    }`}
                  >
                    <Moon className="w-6 h-6 text-cyan-400 mb-2" />
                    <div className="text-white">Dark Mode</div>
                    <div className="text-xs text-gray-400">Current theme</div>
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      theme === 'light'
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-gray-700 bg-gray-900/50'
                    }`}
                  >
                    <Sun className="w-6 h-6 text-yellow-400 mb-2" />
                    <div className="text-white">Light Mode</div>
                    <div className="text-xs text-gray-400">Coming soon</div>
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Chart Color Scheme</Label>
                <Select 
                  value={chartColorScheme}
                  onValueChange={setChartColorScheme}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="green-red">Green/Red (Default)</SelectItem>
                    <SelectItem value="blue-orange">Blue/Orange</SelectItem>
                    <SelectItem value="purple-yellow">Purple/Yellow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleSaveSettings} className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 mt-6">
              Apply Theme
            </Button>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Copyright Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center"
      >
        <p className="text-sm text-gray-400">
          © 2025 BusineXAi Solutions Lab. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
