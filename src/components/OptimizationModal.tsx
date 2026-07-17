import { motion } from 'motion/react';
import { X, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface Strategy {
  id: number | string;
  name: string;
  type: string;
  segment: string;
}

interface OptimizationSuggestion {
  id: number | string;
  title: string;
  description: string;
  impact: Record<string, string>;
  confidence: number;
  color?: string;
}

interface OptimizationModalProps {
  strategy: Strategy;
  onClose: () => void;
  onApply: (optimizations: string[]) => void;
  suggestions?: OptimizationSuggestion[];
}

export function OptimizationModal({ strategy, onClose, onApply, suggestions = [] }: OptimizationModalProps) {
  const handleApplyAll = () => {
    onApply(suggestions.map(s => s.title));
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

          {suggestions.length > 0 && (
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
          )}
        </div>

        <div className="p-6 space-y-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-16 text-gray-400">No data available</div>
          ) : (
            suggestions.map((suggestion, i) => (
              <motion.div
                key={suggestion.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="text-white text-lg mb-1">{suggestion.title}</h3>
                    <p className="text-sm text-gray-300">{suggestion.description}</p>
                  </div>
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                    {suggestion.confidence}% confidence
                  </Badge>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                  <div className="text-sm text-gray-400 mb-2">Expected Impact:</div>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(suggestion.impact).map(([key, value]) => (
                      <div key={key}>
                        <div className="text-xs text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</div>
                        <div className="text-sm text-cyan-400">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <Button size="sm" className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30">
                  Apply This Optimization
                </Button>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
