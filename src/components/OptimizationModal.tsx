import { motion } from 'motion/react';
import { X, Zap, TrendingUp, Shield, Target } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface Strategy {
  id: number;
  name: string;
  type: string;
  segment: string;
}

interface OptimizationModalProps {
  strategy: Strategy;
  onClose: () => void;
  onApply: (optimizations: string[]) => void;
}

const optimizationSuggestions = [
  {
    id: 1,
    title: 'Adjust Stop Loss Levels',
    description: 'Current stop loss at -3.5% is too tight. AI recommends -5.0% to reduce premature exits.',
    impact: {
      winRate: '+8.2%',
      avgReturn: '+0.5%',
      trades: '-12 exits/month'
    },
    confidence: 87,
    icon: Shield,
    color: 'red'
  },
  {
    id: 2,
    title: 'Optimize Entry Timing',
    description: 'Best entry window is 9:45-10:15 AM. Avoid entries after 2:30 PM for intraday.',
    impact: {
      winRate: '+5.4%',
      avgReturn: '+0.3%',
      slippage: '-0.08%'
    },
    confidence: 92,
    icon: Target,
    color: 'cyan'
  },
  {
    id: 3,
    title: 'Increase Position Size',
    description: 'Current ₹50k position size is conservative. Can increase to ₹75k based on performance.',
    impact: {
      returns: '+45%',
      riskLevel: '+12%',
      capitalUsage: 'Better'
    },
    confidence: 78,
    icon: TrendingUp,
    color: 'green'
  },
  {
    id: 4,
    title: 'Filter Low Volatility Days',
    description: 'Skip trading when VIX < 15. Performance drops 23% on low volatility days.',
    impact: {
      winRate: '+6.8%',
      trades: '-8/month',
      avgReturn: '+0.4%'
    },
    confidence: 84,
    icon: Zap,
    color: 'yellow'
  }
];

export function OptimizationModal({ strategy, onClose, onApply }: OptimizationModalProps) {
  const handleApplyAll = () => {
    const allOptimizations = optimizationSuggestions.map(s => s.title);
    onApply(allOptimizations);
    onClose();
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
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl text-white">AI Optimization Suggestions</h2>
                  <p className="text-sm text-gray-400">{strategy.name}</p>
                </div>
              </div>
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

          <div className="flex gap-3 mt-4">
            <Button 
              onClick={handleApplyAll}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              Apply All Optimizations
            </Button>
            <Button variant="outline" className="border-gray-700">
              Save for Review
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {optimizationSuggestions.map((suggestion, i) => (
            <motion.div
              key={suggestion.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`bg-${suggestion.color}-500/10 border border-${suggestion.color}-500/30 rounded-xl p-5`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 bg-${suggestion.color}-500/20 rounded-lg`}>
                  <suggestion.icon className={`w-6 h-6 text-${suggestion.color}-400`} />
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h3 className="text-white text-lg mb-1">{suggestion.title}</h3>
                      <p className="text-sm text-gray-300">{suggestion.description}</p>
                    </div>
                    <Badge className={`bg-${suggestion.color}-500/20 text-${suggestion.color}-400 border-${suggestion.color}-500/30`}>
                      {suggestion.confidence}% confidence
                    </Badge>
                  </div>

                  <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                    <div className="text-sm text-gray-400 mb-2">Expected Impact:</div>
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(suggestion.impact).map(([key, value]) => (
                        <div key={key}>
                          <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                          <div className={`text-sm ${
                            typeof value === 'string' && value.startsWith('+') ? 'text-green-400' :
                            typeof value === 'string' && value.startsWith('-') ? 'text-red-400' :
                            'text-cyan-400'
                          }`}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button 
                    size="sm" 
                    className={`bg-${suggestion.color}-500/20 hover:bg-${suggestion.color}-500/30 text-${suggestion.color}-400 border-${suggestion.color}-500/30`}
                  >
                    Apply This Optimization
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
