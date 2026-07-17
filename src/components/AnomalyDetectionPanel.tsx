import { motion } from 'motion/react';
import { AlertTriangle, Activity, Clock, DollarSign } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface Anomaly {
  id: number | string;
  type: string;
  severity: string;
  trade: string;
  detected: string;
  details: string;
  impact: string;
  timestamp: string;
  recommendation: string;
}

interface AnomalyStat {
  label: string;
  value: string;
  trend: number;
  color: string;
}

interface AnomalyDetectionPanelProps {
  anomalies?: Anomaly[];
  anomalyStats?: AnomalyStat[];
}

export function AnomalyDetectionPanel({ anomalies = [], anomalyStats = [] }: AnomalyDetectionPanelProps) {
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

  const stats = anomalyStats.length > 0 ? anomalyStats : [
    { label: 'Total Detected', value: '0', trend: 0, color: 'cyan' },
    { label: 'High Severity', value: '0', trend: 0, color: 'red' },
    { label: 'Avg Slippage', value: '—', trend: 0, color: 'yellow' },
    { label: 'Saved via Alerts', value: '—', trend: 0, color: 'green' }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-gray-800/30 border border-gray-700 rounded-xl p-4"
          >
            <div className="text-sm text-gray-400 mb-1">{stat.label}</div>
            <div className="text-2xl text-white mb-2">{stat.value}</div>
            {stat.trend !== 0 && (
              <div className={`text-xs ${stat.trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stat.trend >= 0 ? '↑' : '↓'} {Math.abs(stat.trend)}% from last month
              </div>
            )}
          </motion.div>
        ))}
      </div>

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

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-800/30 border border-gray-700 rounded-xl p-6"
      >
        <h3 className="text-white mb-4">Detected Anomalies (Last 7 Days)</h3>
        
        {anomalies.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No data available</div>
        ) : (
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
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-white">{anomaly.detected}</h4>
                        <Badge className={getSeverityColor(anomaly.severity)}>
                          {anomaly.severity} severity
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{anomaly.trade}</p>
                      <p className="text-sm text-gray-300 mb-2">{anomaly.details}</p>
                      <p className="text-sm text-orange-400 mb-3">{anomaly.impact}</p>
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
        )}
      </motion.div>
    </div>
  );
}
