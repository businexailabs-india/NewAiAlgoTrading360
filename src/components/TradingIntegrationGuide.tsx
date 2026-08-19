import { motion } from 'motion/react';
import { useState } from 'react';
import { 
  BookOpen, 
  Network, 
  Zap, 
  Shield, 
  TrendingUp, 
  Database,
  Code,
  CheckCircle,
  AlertTriangle,
  Server,
  RefreshCw,
  DollarSign,
  BarChart3,
  Lock,
  Activity
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';

export function TradingIntegrationGuide() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/30 rounded-2xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-cyan-500/20 rounded-lg">
            <BookOpen className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl text-white mb-2">NSE/BSE Trading Integration Guide</h2>
            <p className="text-gray-300">
              Comprehensive documentation on real trading integration with Indian stock exchanges, 
              broker APIs, order execution, and portfolio management systems.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="bg-gray-800 mb-6 flex-wrap h-auto">
          <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Network className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="architecture" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Server className="w-4 h-4 mr-2" />
            Architecture
          </TabsTrigger>
          <TabsTrigger value="brokers" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Shield className="w-4 h-4 mr-2" />
            Broker APIs
          </TabsTrigger>
          <TabsTrigger value="orders" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Zap className="w-4 h-4 mr-2" />
            Order Execution
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <RefreshCw className="w-4 h-4 mr-2" />
            Portfolio Sync
          </TabsTrigger>
          <TabsTrigger value="pnl" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <DollarSign className="w-4 h-4 mr-2" />
            P&L Tracking
          </TabsTrigger>
          <TabsTrigger value="implementation" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
            <Code className="w-4 h-4 mr-2" />
            Implementation
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">System Overview</h3>
              
              <div className="space-y-4 text-gray-300">
                <p>
                  The EdgeXAi trading platform integrates with NSE (National Stock Exchange) and BSE (Bombay Stock Exchange) 
                  through certified broker APIs. This enables real-time order execution, portfolio management, and comprehensive 
                  P&L tracking for equity, futures, and options trading.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <h4 className="text-white">Supported Exchanges</h4>
                    </div>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• NSE (Cash, F&O, Currency)</li>
                      <li>• BSE (Cash)</li>
                      <li>• MCX (Commodities)</li>
                    </ul>
                  </div>

                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-cyan-400" />
                      <h4 className="text-white">Supported Brokers</h4>
                    </div>
                    <ul className="text-sm text-gray-300 space-y-1">
                      <li>• Zerodha (Kite Connect API)</li>
                      <li>• AngelOne (SmartAPI)</li>
                      <li>• Dhan (DhanHQ API)</li>
                      <li>• Upstox, 5Paisa (coming soon)</li>
                    </ul>
                  </div>
                </div>

                <h4 className="text-white text-lg mt-6 mb-3">Key Features</h4>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">Real-time Order Execution:</strong> Place market, limit, stop-loss, and bracket orders instantly</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">Live Portfolio Sync:</strong> Automatic synchronization of positions, holdings, and margins</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">P&L Tracking:</strong> Real-time profit/loss calculation with tax implications (STCG/LTCG)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">Market Data Feeds:</strong> Live quotes, depth, and order book updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-white">Risk Management:</strong> Position limits, stop-loss automation, margin monitoring</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                <div>
                  <h4 className="text-yellow-400 text-lg mb-2">Security & Compliance</h4>
                  <p className="text-gray-300">
                    All broker integrations use OAuth 2.0 authentication and encrypted API keys. 
                    Your credentials are never stored on our servers. The platform is compliant with 
                    SEBI regulations for algorithmic trading and follows NSE/BSE guidelines for API usage.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Architecture Tab */}
        <TabsContent value="architecture">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">System Architecture</h3>
              
              <div className="bg-gray-900/50 rounded-lg p-6 mb-6 font-mono text-sm">
                <pre className="text-cyan-400 overflow-x-auto">
{`┌─────────────────────────────────────────────────────────────┐
│                    EdgeXAi Trading Platform                  │
│                      (React Frontend)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                  Backend API Server                          │
│              (Node.js / FastAPI)                             │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Order       │  │  Portfolio    │  │  Market Data │     │
│  │  Management  │  │  Sync Engine  │  │  WebSocket   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────┬────────────┬────────────────┬─────────────────┘
             │            │                │
             ↓            ↓                ↓
┌────────────────────────────────────────────────────────────┐
│                   Broker API Layer                          │
│                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐        │
│  │ Zerodha  │    │ AngelOne │    │ Interactive  │        │
│  │  Kite    │    │ SmartAPI │    │   Brokers    │        │
│  └──────────┘    └──────────┘    └──────────────┘        │
└───────┬─────────────┬─────────────────┬──────────────────┘
        │             │                 │
        ↓             ↓                 ↓
┌────────────────────────────────────────────────────────────┐
│                NSE / BSE / MCX Exchanges                    │
└────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>

              <h4 className="text-white text-lg mb-3">Component Breakdown</h4>
              
              <div className="space-y-4">
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <h5 className="text-cyan-400 mb-2 flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    1. Frontend Application
                  </h5>
                  <p className="text-gray-300 text-sm">
                    React-based UI with real-time updates via WebSocket. Handles user interactions, 
                    displays market data, and manages order placement interface.
                  </p>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <h5 className="text-green-400 mb-2 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    2. Backend API Server
                  </h5>
                  <p className="text-gray-300 text-sm mb-2">
                    Manages business logic, authentication, and broker API interactions.
                  </p>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• <strong>Order Management:</strong> Validates and routes orders to brokers</li>
                    <li>• <strong>Portfolio Sync:</strong> Polls broker APIs every 30s for position updates</li>
                    <li>• <strong>Market Data:</strong> WebSocket server for real-time price feeds</li>
                    <li>• <strong>Database:</strong> TimescaleDB for time-series data, PostgreSQL for trades</li>
                  </ul>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <h5 className="text-purple-400 mb-2 flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    3. Broker API Layer
                  </h5>
                  <p className="text-gray-300 text-sm">
                    Abstraction layer that normalizes different broker APIs into a unified interface. 
                    Handles authentication, rate limiting, and error recovery.
                  </p>
                </div>
              </div>
            </div>

            {/* Data Flow */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Order Execution Flow</h3>
              
              <div className="space-y-3">
                {[
                  { step: 1, title: 'User places order', desc: 'Frontend validates order parameters', color: 'cyan' },
                  { step: 2, title: 'API request sent', desc: 'Secure POST request with encrypted payload', color: 'green' },
                  { step: 3, title: 'Backend validation', desc: 'Check margin, position limits, risk rules', color: 'yellow' },
                  { step: 4, title: 'Broker API call', desc: 'Order forwarded to broker API (Zerodha/AngelOne)', color: 'purple' },
                  { step: 5, title: 'Exchange routing', desc: 'Broker routes to NSE/BSE exchange', color: 'blue' },
                  { step: 6, title: 'Order confirmation', desc: 'Order ID returned from exchange', color: 'orange' },
                  { step: 7, title: 'Status updates', desc: 'Real-time updates via WebSocket', color: 'pink' },
                  { step: 8, title: 'Portfolio sync', desc: 'Position and P&L updated automatically', color: 'green' }
                ].map((item) => (
                  <div key={item.step} className={`bg-${item.color}-500/10 border border-${item.color}-500/30 rounded-lg p-3`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-${item.color}-500/20 flex items-center justify-center text-${item.color}-400`}>
                        {item.step}
                      </div>
                      <div className="flex-1">
                        <div className="text-white text-sm">{item.title}</div>
                        <div className="text-gray-400 text-xs">{item.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Broker APIs Tab */}
        <TabsContent value="brokers">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Zerodha */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-xl">Zerodha Kite Connect API</h3>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
              </div>
              
              <div className="space-y-4 text-gray-300">
                <p>
                  Zerodha's Kite Connect is India's most popular broker API, supporting NSE, BSE, and MCX trading.
                </p>

                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h4 className="text-white mb-2">Setup Steps:</h4>
                  <ol className="text-sm space-y-2 list-decimal list-inside">
                    <li>Create a Kite Connect app at <code className="text-cyan-400">https://kite.trade</code></li>
                    <li>Get your API Key and Secret</li>
                    <li>Complete OAuth authentication flow</li>
                    <li>Store access token securely (valid for 1 day)</li>
                  </ol>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                  <div className="text-gray-400 mb-2"># Python Example - Place Order</div>
                  <pre className="text-cyan-400 overflow-x-auto">
{`from kiteconnect import KiteConnect

kite = KiteConnect(api_key="your_api_key")
kite.set_access_token("your_access_token")

# Place a market order
order_id = kite.place_order(
    variety=kite.VARIETY_REGULAR,
    exchange=kite.EXCHANGE_NSE,
    tradingsymbol="RELIANCE",
    transaction_type=kite.TRANSACTION_TYPE_BUY,
    quantity=1,
    product=kite.PRODUCT_MIS,
    order_type=kite.ORDER_TYPE_MARKET
)

print(f"Order placed. ID: {order_id}")`}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-white text-sm mb-2">Rate Limits:</h5>
                    <ul className="text-sm space-y-1">
                      <li>• Order APIs: 10 req/sec</li>
                      <li>• Quote APIs: 1 req/sec</li>
                      <li>• Historical: 3 req/sec</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="text-white text-sm mb-2">Supported Products:</h5>
                    <ul className="text-sm space-y-1">
                      <li>• CNC (Cash & Carry)</li>
                      <li>• MIS (Intraday)</li>
                      <li>• NRML (F&O Normal)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* AngelOne */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-xl">AngelOne SmartAPI</h3>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
              </div>
              
              <div className="space-y-4 text-gray-300">
                <p>
                  AngelOne SmartAPI provides comprehensive access to NSE, BSE, MCX with WebSocket streaming.
                </p>

                <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                  <div className="text-gray-400 mb-2"># Python Example - Login & Place Order</div>
                  <pre className="text-cyan-400 overflow-x-auto">
{`from smartapi import SmartConnect

obj = SmartConnect(api_key="your_api_key")
data = obj.generateSession("client_id", "password")

# Place order
order_params = {
    "variety": "NORMAL",
    "tradingsymbol": "SBIN-EQ",
    "symboltoken": "3045",
    "transactiontype": "BUY",
    "exchange": "NSE",
    "ordertype": "LIMIT",
    "producttype": "INTRADAY",
    "duration": "DAY",
    "price": "590",
    "quantity": "1"
}

order_id = obj.placeOrder(order_params)
print(f"Order ID: {order_id}")`}
                  </pre>
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <h5 className="text-cyan-400 mb-2">Key Features:</h5>
                  <ul className="text-sm space-y-1">
                    <li>• Real-time WebSocket for live quotes</li>
                    <li>• Historical data API (1min to 1day candles)</li>
                    <li>• Order modification & cancellation</li>
                    <li>• Portfolio holdings & positions API</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Order Execution Tab */}
        <TabsContent value="orders">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Order Types & Execution</h3>
              
              <div className="space-y-4">
                {[
                  {
                    type: 'Market Order',
                    desc: 'Executed immediately at the best available price',
                    use: 'High liquidity stocks, urgent execution needed',
                    risk: 'Price slippage in volatile markets',
                    code: `{
  order_type: "MARKET",
  quantity: 100,
  symbol: "RELIANCE"
}`
                  },
                  {
                    type: 'Limit Order',
                    desc: 'Executed only at specified price or better',
                    use: 'Price-sensitive trades, low liquidity stocks',
                    risk: 'May not execute if price not reached',
                    code: `{
  order_type: "LIMIT",
  quantity: 100,
  symbol: "TCS",
  price: 3650.00
}`
                  },
                  {
                    type: 'Stop Loss (SL)',
                    desc: 'Triggered when price hits stop-loss level',
                    use: 'Risk management, protect profits',
                    risk: 'Gap risk in overnight positions',
                    code: `{
  order_type: "SL",
  quantity: 100,
  symbol: "INFY",
  trigger_price: 1420.00,
  price: 1418.00
}`
                  },
                  {
                    type: 'Stop Loss Market (SL-M)',
                    desc: 'Market order triggered at stop-loss',
                    use: 'Guaranteed exit at trigger',
                    risk: 'Execution at unfavorable price',
                    code: `{
  order_type: "SL-M",
  quantity: 100,
  symbol: "HDFCBANK",
  trigger_price: 1640.00
}`
                  },
                  {
                    type: 'Bracket Order (BO)',
                    desc: 'Entry + SL + Target in single order',
                    use: 'Intraday trading with defined risk/reward',
                    risk: 'Only for intraday, squared off at 3:20 PM',
                    code: `{
  order_type: "BO",
  quantity: 100,
  symbol: "SBIN",
  price: 600.00,
  stoploss: 10.00,
  target: 20.00
}`
                  }
                ].map((order, i) => (
                  <div key={i} className="bg-gray-900/50 border border-gray-700 rounded-lg p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-white text-lg mb-1">{order.type}</h4>
                        <p className="text-gray-400 text-sm">{order.desc}</p>
                      </div>
                      <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                        {order.type.split(' ')[0]}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-green-400 text-sm mb-1">✓ Best for:</div>
                        <div className="text-gray-300 text-sm">{order.use}</div>
                      </div>
                      <div>
                        <div className="text-red-400 text-sm mb-1">⚠ Risk:</div>
                        <div className="text-gray-300 text-sm">{order.risk}</div>
                      </div>
                    </div>

                    <div className="bg-gray-950 rounded p-3 font-mono text-xs">
                      <pre className="text-cyan-400 overflow-x-auto">{order.code}</pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Status Lifecycle */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Order Status Lifecycle</h3>
              
              <div className="space-y-2">
                {[
                  { status: 'PENDING', desc: 'Order received, awaiting validation', color: 'yellow' },
                  { status: 'OPEN', desc: 'Order validated and sent to exchange', color: 'blue' },
                  { status: 'TRIGGER_PENDING', desc: 'Stop-loss order awaiting trigger', color: 'purple' },
                  { status: 'COMPLETE', desc: 'Order fully executed', color: 'green' },
                  { status: 'CANCELLED', desc: 'Order cancelled by user or system', color: 'gray' },
                  { status: 'REJECTED', desc: 'Order rejected by exchange/broker', color: 'red' }
                ].map((item) => (
                  <div key={item.status} className={`bg-${item.color}-500/10 border border-${item.color}-500/30 rounded-lg p-3`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <code className={`text-${item.color}-400 font-mono text-sm`}>{item.status}</code>
                        <span className="text-gray-300 text-sm">{item.desc}</span>
                      </div>
                      <Activity className={`w-4 h-4 text-${item.color}-400`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Portfolio Sync Tab */}
        <TabsContent value="portfolio">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Portfolio Synchronization</h3>
              
              <div className="space-y-4 text-gray-300">
                <p>
                  The platform automatically synchronizes your portfolio with broker accounts every 30 seconds 
                  to ensure real-time accuracy of positions, holdings, and available margins.
                </p>

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <h4 className="text-cyan-400 mb-3">Sync Components:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-white text-sm mb-2">Positions (Intraday)</h5>
                      <ul className="text-sm space-y-1">
                        <li>• Open positions</li>
                        <li>• Average buy price</li>
                        <li>• Current LTP</li>
                        <li>• Realized P&L</li>
                        <li>• Unrealized P&L</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-white text-sm mb-2">Holdings (Long-term)</h5>
                      <ul className="text-sm space-y-1">
                        <li>• Delivery holdings</li>
                        <li>• Quantity & avg price</li>
                        <li>• Current value</li>
                        <li>• Overall P&L</li>
                        <li>• Day change %</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                  <div className="text-gray-400 mb-2"># Portfolio Sync Implementation</div>
                  <pre className="text-cyan-400 overflow-x-auto">
{`// Node.js - Portfolio Sync Service
const syncPortfolio = async (userId, broker) => {
  try {
    // 1. Fetch positions from broker
    const positions = await broker.getPositions();
    
    // 2. Fetch holdings
    const holdings = await broker.getHoldings();
    
    // 3. Fetch margins
    const margins = await broker.getMargins();
    
    // 4. Calculate total P&L
    const totalPnL = calculatePnL(positions, holdings);
    
    // 5. Update database
    await db.portfolio.upsert({
      userId,
      positions,
      holdings,
      margins,
      totalPnL,
      lastSyncAt: new Date()
    });
    
    // 6. Emit WebSocket update to frontend
    io.to(userId).emit('portfolio:updated', {
      positions,
      holdings,
      totalPnL
    });
    
    console.log(\`Portfolio synced for user: \${userId}\`);
  } catch (error) {
    console.error('Sync failed:', error);
  }
};

// Run sync every 30 seconds
setInterval(() => syncPortfolio(userId, broker), 30000);`}
                  </pre>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <h4 className="text-green-400 mb-2">Real-time Updates via WebSocket</h4>
                  <p className="text-sm mb-3">
                    Live price updates are streamed via WebSocket for instant P&L calculation without API polling.
                  </p>
                  <div className="bg-gray-950 rounded p-3 font-mono text-xs">
                    <pre className="text-cyan-400 overflow-x-auto">
{`// Frontend WebSocket listener
socket.on('market:tick', (data) => {
  const { symbol, ltp, change } = data;
  updatePositionPnL(symbol, ltp);
});`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Margin Management */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Margin Management</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="text-cyan-400 text-sm mb-2">Available Margin</h5>
                    <div className="text-2xl text-white mb-1">₹2,45,000</div>
                    <div className="text-xs text-gray-400">Cash + Collateral</div>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="text-yellow-400 text-sm mb-2">Used Margin</h5>
                    <div className="text-2xl text-white mb-1">₹1,15,000</div>
                    <div className="text-xs text-gray-400">47% utilized</div>
                  </div>
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <h5 className="text-green-400 text-sm mb-2">Free Margin</h5>
                    <div className="text-2xl text-white mb-1">₹1,30,000</div>
                    <div className="text-xs text-gray-400">Available for trading</div>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-yellow-400 mb-1">Margin Shortfall Protection</h5>
                      <p className="text-sm text-gray-300">
                        The system automatically monitors margin usage. If available margin falls below 20%, 
                        new orders are blocked and alerts are sent. Positions may be squared off if margin 
                        shortfall exceeds limits (per broker policy).
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* P&L Tracking Tab */}
        <TabsContent value="pnl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">P&L Calculation Methods</h3>
              
              <div className="space-y-4">
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-5">
                  <h4 className="text-white text-lg mb-3">1. Realized P&L (Closed Positions)</h4>
                  <p className="text-gray-300 text-sm mb-3">
                    Profit or loss from positions that have been closed during the trading session.
                  </p>
                  <div className="bg-gray-950 rounded p-4 font-mono text-sm">
                    <div className="text-gray-400 mb-2">Formula:</div>
                    <pre className="text-cyan-400">
{`Realized P&L = (Sell Price - Buy Price) × Quantity - Charges

Example:
Buy: 100 shares @ ₹2450 = ₹2,45,000
Sell: 100 shares @ ₹2498 = ₹2,49,800
Brokerage + Taxes = ₹175
Realized P&L = ₹2,49,800 - ₹2,45,000 - ₹175 = ₹4,625`}
                    </pre>
                  </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-5">
                  <h4 className="text-white text-lg mb-3">2. Unrealized P&L (Open Positions)</h4>
                  <p className="text-gray-300 text-sm mb-3">
                    Floating profit or loss on positions that are currently open (mark-to-market).
                  </p>
                  <div className="bg-gray-950 rounded p-4 font-mono text-sm">
                    <div className="text-gray-400 mb-2">Formula:</div>
                    <pre className="text-cyan-400">
{`Unrealized P&L = (Current LTP - Avg Buy Price) × Quantity

Example:
Buy: 100 shares @ ₹1648 = ₹1,64,800
Current LTP: ₹1,625
Unrealized P&L = (₹1,625 - ₹1,648) × 100 = -₹2,300`}
                    </pre>
                  </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-5">
                  <h4 className="text-white text-lg mb-3">3. Day P&L</h4>
                  <p className="text-gray-300 text-sm mb-3">
                    Total profit/loss for the current trading day (both realized and unrealized).
                  </p>
                  <div className="bg-gray-950 rounded p-4 font-mono text-sm">
                    <div className="text-gray-400 mb-2">Formula:</div>
                    <pre className="text-cyan-400">
{`Day P&L = Realized P&L + Unrealized P&L

Example:
Realized P&L = ₹4,625 (from closed trades)
Unrealized P&L = -₹2,300 (from open positions)
Day P&L = ₹4,625 - ₹2,300 = ₹2,325`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Tax Implications */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Tax Calculation (STCG/LTCG)</h3>
              
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <h4 className="text-green-400 mb-2">Short Term Capital Gains (STCG)</h4>
                  <p className="text-sm text-gray-300 mb-3">
                    Applicable when equity shares are sold within 12 months of purchase.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400">Tax Rate</div>
                      <div className="text-white">15%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Holding Period</div>
                      <div className="text-white">{"< 12 months"}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <h4 className="text-cyan-400 mb-2">Long Term Capital Gains (LTCG)</h4>
                  <p className="text-sm text-gray-300 mb-3">
                    Applicable when equity shares are sold after 12 months of purchase.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-400">Tax Rate</div>
                      <div className="text-white">10%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Exemption</div>
                      <div className="text-white">₹1,00,000/year</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Holding Period</div>
                      <div className="text-white">{"> 12 months"}</div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                  <div className="text-gray-400 mb-2"># Tax Calculation Example</div>
                  <pre className="text-cyan-400 overflow-x-auto">
{`// LTCG Tax Calculation
const calculateLTCG = (gains) => {
  const exemptionLimit = 100000; // ₹1 lakh
  const taxableGains = Math.max(0, gains - exemptionLimit);
  const tax = taxableGains * 0.10; // 10% tax
  return tax;
};

// Example:
const totalGains = 250000; // ₹2.5 lakhs
const tax = calculateLTCG(totalGains);
// Tax = (250000 - 100000) * 0.10 = ₹15,000`}
                  </pre>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-yellow-400 mb-1">Important Notes:</h5>
                      <ul className="text-sm text-gray-300 space-y-1">
                        <li>• F&O trading profits are treated as business income (taxed at slab rate)</li>
                        <li>• Intraday equity trading is also treated as business income</li>
                        <li>• STT (Securities Transaction Tax) is automatically deducted</li>
                        <li>• Consult a tax advisor for accurate tax planning</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* P&L Report Structure */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Automated P&L Reports</h3>
              
              <div className="space-y-4 text-gray-300">
                <p>
                  The platform automatically generates detailed P&L reports with the following structure:
                </p>

                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h5 className="text-white mb-3">Daily Report (Generated at 3:30 PM)</h5>
                  <ul className="text-sm space-y-2">
                    <li>✓ Total trades executed</li>
                    <li>✓ Realized P&L breakdown by stock</li>
                    <li>✓ Best and worst performing trades</li>
                    <li>✓ Total charges (brokerage, STT, GST)</li>
                    <li>✓ Net P&L after charges</li>
                  </ul>
                </div>

                <div className="bg-gray-900/50 rounded-lg p-4">
                  <h5 className="text-white mb-3">Monthly Report (Generated on 1st of month)</h5>
                  <ul className="text-sm space-y-2">
                    <li>✓ Total profit/loss for the month</li>
                    <li>✓ Win rate and average return per trade</li>
                    <li>✓ Strategy-wise performance breakdown</li>
                    <li>✓ STCG/LTCG calculation</li>
                    <li>✓ Estimated tax liability</li>
                    <li>✓ Downloadable PDF report</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* Implementation Tab */}
        <TabsContent value="implementation">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Implementation Guide</h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-white text-lg mb-3">Step 1: Backend Setup</h4>
                  <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                    <pre className="text-cyan-400 overflow-x-auto">
{`# Install dependencies
npm install kiteconnect smartapi-javascript axios ws

# Project structure
trading-platform/
├── backend/
│   ├── services/
│   │   ├── brokerService.js      # Broker API abstraction
│   │   ├── orderService.js       # Order management
│   │   ├── portfolioService.js   # Portfolio sync
│   │   └── pnlService.js         # P&L calculation
│   ├── routes/
│   │   ├── orders.js
│   │   ├── portfolio.js
│   │   └── auth.js
│   └── websocket/
│       └── marketData.js         # WebSocket server
└── frontend/
    └── components/
        ├── TradingDashboard/
        ├── OrderPanel/
        └── PortfolioView/`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-white text-lg mb-3">Step 2: Environment Variables</h4>
                  <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                    <pre className="text-cyan-400 overflow-x-auto">
{`# .env file
ZERODHA_API_KEY=your_api_key
ZERODHA_API_SECRET=your_secret
ANGELONE_API_KEY=your_api_key
ANGELONE_CLIENT_ID=your_client_id

DATABASE_URL=postgresql://user:pass@localhost:5432/trading
REDIS_URL=redis://localhost:6379

JWT_SECRET=your_jwt_secret
PORT=3000`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-white text-lg mb-3">Step 3: Broker Service Implementation</h4>
                  <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                    <pre className="text-cyan-400 overflow-x-auto">
{`// brokerService.js
class BrokerService {
  constructor(broker, credentials) {
    this.broker = broker;
    this.credentials = credentials;
    this.client = this.initializeClient();
  }

  async placeOrder(orderParams) {
    try {
      const orderId = await this.client.placeOrder(orderParams);
      
      // Log order to database
      await db.orders.create({
        userId: this.userId,
        orderId,
        symbol: orderParams.symbol,
        quantity: orderParams.quantity,
        price: orderParams.price,
        orderType: orderParams.orderType,
        status: 'PENDING',
        timestamp: new Date()
      });

      return { success: true, orderId };
    } catch (error) {
      console.error('Order placement failed:', error);
      return { success: false, error: error.message };
    }
  }

  async getPositions() {
    return await this.client.getPositions();
  }

  async getHoldings() {
    return await this.client.getHoldings();
  }

  async cancelOrder(orderId) {
    return await this.client.cancelOrder(orderId);
  }
}

module.exports = BrokerService;`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-white text-lg mb-3">Step 4: WebSocket Implementation</h4>
                  <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                    <pre className="text-cyan-400 overflow-x-auto">
{`// marketData.js - WebSocket Server
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Connect to broker WebSocket for live data
const connectToBrokerWS = (symbols) => {
  // Subscribe to live ticks for symbols
  broker.subscribeTicks(symbols);
  
  broker.on('tick', (tick) => {
    // Broadcast to all connected clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'MARKET_TICK',
          data: tick
        }));
      }
    });
  });
};

// Frontend connection
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    const { action, symbols } = JSON.parse(message);
    if (action === 'subscribe') {
      connectToBrokerWS(symbols);
    }
  });
});`}
                    </pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-white text-lg mb-3">Step 5: Frontend Integration</h4>
                  <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                    <pre className="text-cyan-400 overflow-x-auto">
{`// React - Order Placement Component
const placeOrder = async (orderData) => {
  try {
    const response = await fetch('/api/orders/place', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${token}\`
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();
    
    if (result.success) {
      toast.success(\`Order placed! ID: \${result.orderId}\`);
      // Refresh portfolio
      fetchPortfolio();
    } else {
      toast.error(\`Order failed: \${result.error}\`);
    }
  } catch (error) {
    toast.error('Network error');
  }
};

// WebSocket listener for live updates
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080');
  
  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    if (type === 'MARKET_TICK') {
      updateLivePrice(data);
    }
  };

  return () => ws.close();
}, []);`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Best Practices */}
            <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6">
              <h3 className="text-white text-xl mb-4">Best Practices & Security</h3>
              
              <div className="space-y-3">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-green-400 mb-1">Error Handling</h5>
                      <p className="text-sm text-gray-300">
                        Implement retry logic with exponential backoff for API failures. 
                        Store failed orders in queue for manual review.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Lock className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-cyan-400 mb-1">API Key Security</h5>
                      <p className="text-sm text-gray-300">
                        Never store API keys in frontend. Use environment variables and encrypted storage. 
                        Implement token refresh mechanism for expired sessions.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-yellow-400 mb-1">Rate Limiting</h5>
                      <p className="text-sm text-gray-300">
                        Respect broker API rate limits. Implement request queuing and throttling. 
                        Cache frequently accessed data (margins, holdings) to reduce API calls.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Database className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-purple-400 mb-1">Data Persistence</h5>
                      <p className="text-sm text-gray-300">
                        Log all orders, trades, and errors to database for audit trail. 
                        Use TimescaleDB for efficient time-series data storage.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Shield className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-red-400 mb-1">Risk Management</h5>
                      <p className="text-sm text-gray-300">
                        Implement circuit breakers for rapid losses. Set position size limits per strategy. 
                        Auto-square off positions before market close to avoid overnight risk.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center"
      >
        <p className="text-gray-400 mb-2">
          For implementation support or questions, contact our technical team
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <a href="mailto:support@businexai.com" className="text-cyan-400 hover:underline">
            support@businexai.com
          </a>
          <span className="text-gray-600">|</span>
          <a href="https://docs.businexai.com" className="text-cyan-400 hover:underline">
            Documentation
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          © 2026 AlgoTradingV360. All rights reserved.
        </p>
      </motion.div>
    </div>
  );
}
