import { motion } from 'motion/react';
import { Target } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

interface PortfolioAction {
  id: number | string;
  type: string;
  priority: string;
  title: string;
  description: string;
  impact: { risk: number; returns: number; taxImpact: number };
  actions: string[];
  confidence: number;
  icon?: typeof Target;
}

interface AIInsight {
  title: string;
  description: string;
  icon?: typeof Target;
  color: string;
}

interface AIRecommendationsProps {
  portfolioActions?: PortfolioAction[];
  aiInsights?: AIInsight[];
}

export function AIRecommendations({ portfolioActions = [], aiInsights = [] }: AIRecommendationsProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'low': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {aiInsights.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiInsights.map((insight, i) => {
            const Icon = insight.icon || Target;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`bg-${insight.color}-500/10 border border-${insight.color}-500/30 rounded-xl p-4`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 text-${insight.color}-400 flex-shrink-0 mt-0.5`} />
                  <div>
                    <h4 className={`text-sm text-${insight.color}-400 mb-1`}>{insight.title}</h4>
                    <p className="text-xs text-gray-300">{insight.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-8 text-center text-gray-400">
          No AI insights available
        </div>
      )}

      <div>
        <h3 className="text-white mb-4">AI-Powered Portfolio Actions</h3>
        {portfolioActions.length === 0 ? (
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center text-gray-400">
            No data available
          </div>
        ) : (
          <div className="space-y-4">
            {portfolioActions.map((action, i) => {
              const Icon = action.icon || Target;
              return (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-purple-500/20 rounded-lg">
                      <Icon className="w-6 h-6 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white">{action.title}</h4>
                        <Badge className={getPriorityColor(action.priority)}>
                          {action.priority} priority
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mb-4">{action.description}</p>
                      <div className="flex gap-2">
                        <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
                          Execute Now
                        </Button>
                        <Button variant="outline" className="border-gray-700">Add to Plan</Button>
                        <Button variant="outline" className="border-gray-700">Dismiss</Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
