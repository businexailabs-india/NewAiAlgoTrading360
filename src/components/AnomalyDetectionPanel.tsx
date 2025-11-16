import { motion } from 'motion/react';
import { AlertTriangle, Activity, Clock, DollarSign } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

const anomalies = [
  {
    id: 1,
    type: 'slippage',
    severity: 'high',
    trade: 'RELIANCE Buy @ 2450.50',
    detected: 'High slippage detected',
    details: 'Expected execution: ₹2450.50, Actual: ₹2453.20 (0.11% slippage)',
    impact: 'Additional cost: ₹2,700',
    timestamp: '2025-01-10 10:45 AM',
    recommendation: 'Consider using limit orders during high volatility periods'
  },
  {
    id: 2,
    type: 'liquidity',
    severity: 'medium',
    trade: 'NYKAA Sell @ 234.75',
    detected: 'Low liquidity warning',
    details: 'Bid-ask spread: 1.2% (above 0.5% threshold)',
    impact: 'Potential delay in execution',
    timestamp: '2025-01-10 02:30 PM',
    recommendation: 'Split large orders into smaller chunks'
  },
  {
    id: 3,
    type: 'timing',
    severity: 'low',
    trade: 'TCS Options Buy',
    detected: 'Unusual execution time',
    details: 'Trade executed during low liquidity window (3:15 PM)',
    impact: 'Minor impact on fill price',
    timestamp: '2025-01-09 03:15 PM',
    recommendation: 'Avoid trading in last 15 minutes unless necessary'
  },
  {
    id: 4,
    type: 'price',
    severity: 'high',
    trade: 'HDFCBANK Buy @ 1648.50',
    detected: 'Price deviation anomaly',
    details: 'Execution price 0.8% above VWAP',
    impact: 'Suboptimal entry: ₹13,188 cost increase',
    timestamp: '2025-01-09 11:20 AM',
    recommendation: 'Use TWAP or VWAP execution algorithms'
  }
];

const anomalyStats = [
  { label: 'Total Detected', value: '12', trend: -15, color: 'cyan' },
  { label: 'High Severity', value: '3', trend: -25, color: 'red' },
  { label: 'Avg Slippage', value: '0.14%', trend: -8, color: 'yellow' },
  { label: 'Saved via Alerts', value: '₹45K', trend: 22, color: 'green' }
];

export function AnomalyDetectionPanel() {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'slippage': return DollarSign;
      case 'liquidity': return Activity;
      case 'timing': return Clock;
      case 'price': return AlertTriangle;
      default: return AlertTriangle;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {anomalyStats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-${stat.color}-500/10 border border-${stat.color}-500/30 rounded-xl p-4`}
          >
            <div className="text-sm text-gray-400 mb-1">{stat.label}</div>
            <div className={`text-2xl text-${stat.color}-400 mb-2`}>{stat.value}</div>
            <div className={`text-xs ${stat.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stat.trend >= 0 ? '↑' : '↓'} {Math.abs(stat.trend)}% from last month
            </div>
          </motion.div>
        ))}
      </div>

      {/* Anomaly Detection Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-6"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-500/20 rounded-lg">
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl text-white mb-2">AI Anomaly Detection System</h3>
            <p className="text-gray-300">
              Machine learning models continuously monitor trade executions for unusual patterns, high slippage, 
              low liquidity conditions, and execution inefficiencies.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Detected Anomalies */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Detected Anomalies (Last 7 Days)</h3>
        
        <div className="space-y-4">
          {anomalies.map((anomaly, i) => {
            const Icon = getTypeIcon(anomaly.type);
            
            return (
              <motion.div
                key={anomaly.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-5 hover:border-orange-500/50 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 ${
                    anomaly.severity === 'high' ? 'bg-red-500/20' :
                    anomaly.severity === 'medium' ? 'bg-yellow-500/20' :
                    'bg-blue-500/20'
                  } rounded-lg`}>
                    <Icon className={`w-5 h-5 ${
                      anomaly.severity === 'high' ? 'text-red-400' :
                      anomaly.severity === 'medium' ? 'text-yellow-400' :
                      'text-blue-400'
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white">{anomaly.detected}</h4>
                          <Badge className={getSeverityColor(anomaly.severity)}>
                            {anomaly.severity} severity
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400">{anomaly.trade}</p>
                      </div>
                      
                      <div className="text-xs text-gray-500">
                        {anomaly.timestamp}
                      </div>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-3 mb-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500">Details: </span>
                          <span className="text-gray-300">{anomaly.details}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Impact: </span>
                          <span className="text-orange-400">{anomaly.impact}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-cyan-400 text-sm">💡 Recommendation:</span>
                      <span className="text-sm text-gray-300">{anomaly.recommendation}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30">
                        View Full Report
                      </Button>
                      <Button size="sm" variant="outline" className="border-gray-700">
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Prevention Tips */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">AI Prevention Tips</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
            <h4 className="text-cyan-400 mb-2">Best Execution Times</h4>
            <p className="text-sm text-gray-300">
              AI analysis shows optimal execution windows: 10:00-11:30 AM and 1:30-2:30 PM for NSE stocks.
              Avoid trading in first 15 and last 15 minutes unless necessary.
            </p>
          </div>
          
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <h4 className="text-green-400 mb-2">Order Type Recommendations</h4>
            <p className="text-sm text-gray-300">
              Use limit orders for low liquidity stocks. For high-cap stocks, market orders are safe during peak hours.
              Consider TWAP for large orders above ₹5L.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
