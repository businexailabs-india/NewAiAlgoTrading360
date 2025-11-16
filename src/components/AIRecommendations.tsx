import { motion } from 'motion/react';
import { Target, TrendingUp, Shield, AlertCircle, Zap, ChevronRight, Activity } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const portfolioActions = [
  {
    id: 1,
    type: 'rebalance',
    priority: 'high',
    title: 'Rebalance Technology Sector',
    description: 'Your tech allocation has grown to 35% vs target 30%. Consider trimming INFY and TCS positions.',
    impact: {
      risk: -12,
      returns: 3.5,
      taxImpact: 15400
    },
    actions: ['Sell 80 shares of INFY', 'Sell 45 shares of TCS', 'Deploy ₹2.5L in Banking sector'],
    confidence: 94,
    icon: Target
  },
  {
    id: 2,
    type: 'opportunity',
    priority: 'high',
    title: 'Banking Sector Entry Opportunity',
    description: 'Strong technical setup in HDFCBANK and ICICIBANK. RSI oversold with bullish divergence.',
    impact: {
      risk: 8,
      returns: 18.2,
      taxImpact: 0
    },
    actions: ['Buy 150 shares HDFCBANK @ ₹1,650', 'Buy 200 shares ICICIBANK @ ₹985', 'Set stop-loss at -5%'],
    confidence: 87,
    icon: TrendingUp
  },
  {
    id: 3,
    type: 'risk',
    priority: 'medium',
    title: 'Energy Sector Concentration Risk',
    description: 'RELIANCE represents 18% of portfolio. Diversify to reduce single-stock risk.',
    impact: {
      risk: -25,
      returns: -2.1,
      taxImpact: 28700
    },
    actions: ['Reduce RELIANCE by 100 shares', 'Diversify into ONGC and BPCL', 'Maintain 15% energy allocation'],
    confidence: 91,
    icon: Shield
  },
  {
    id: 4,
    type: 'alert',
    priority: 'low',
    title: 'Defensive Positioning Suggested',
    description: 'Market volatility increasing. Consider adding FMCG and Pharma for stability.',
    impact: {
      risk: -18,
      returns: 5.8,
      taxImpact: 0
    },
    actions: ['Add ITC and HUL for FMCG exposure', 'Consider SUNPHARMA for healthcare', 'Target 15% defensive allocation'],
    confidence: 76,
    icon: AlertCircle
  }
];

const aiInsights = [
  {
    title: 'Sector Rotation Signal',
    description: 'AI model detects capital rotation from IT to Banking sector. Historical accuracy: 82%',
    icon: Zap,
    color: 'purple'
  },
  {
    title: 'Volatility Forecast',
    description: 'Expected market volatility: Medium (±1.2%) for next 5 trading days based on historical patterns',
    icon: Activity,
    color: 'cyan'
  },
  {
    title: 'Optimal Entry Points',
    description: '3 stocks in your watchlist showing optimal risk-reward ratios based on technical analysis',
    icon: Target,
    color: 'green'
  }
];

export function AIRecommendations() {
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
      {/* AI Quick Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {aiInsights.map((insight, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-${insight.color}-500/10 border border-${insight.color}-500/30 rounded-xl p-4`}
          >
            <div className="flex items-start gap-3">
              <insight.icon className={`w-5 h-5 text-${insight.color}-400 flex-shrink-0 mt-0.5`} />
              <div>
                <h4 className={`text-sm text-${insight.color}-400 mb-1`}>{insight.title}</h4>
                <p className="text-xs text-gray-300">{insight.description}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Recommended Actions */}
      <div>
        <h3 className="text-white mb-4">AI-Powered Portfolio Actions</h3>
        <div className="space-y-4">
          {portfolioActions.map((action, i) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-5 hover:border-purple-500/50 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <action.icon className="w-6 h-6 text-purple-400" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white">{action.title}</h4>
                        <Badge className={getPriorityColor(action.priority)}>
                          {action.priority} priority
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">{action.description}</p>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">Confidence</div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                            style={{ width: `${action.confidence}%` }}
                          ></div>
                        </div>
                        <span className="text-purple-400 text-sm">{action.confidence}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Impact Metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-900/50 rounded-lg">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Risk Impact</div>
                      <div className={`${action.impact.risk < 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {action.impact.risk < 0 ? '' : '+'}{action.impact.risk}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Expected Returns</div>
                      <div className={`${action.impact.returns > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {action.impact.returns > 0 ? '+' : ''}{action.impact.returns}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Tax Impact</div>
                      <div className="text-orange-400">
                        ₹{action.impact.taxImpact.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Action Steps */}
                  <div className="mb-4">
                    <div className="text-sm text-gray-400 mb-2">Recommended Steps:</div>
                    <div className="space-y-2">
                      {action.actions.map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                          <ChevronRight className="w-4 h-4 text-cyan-400" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => {
                        console.log('Executing recommendation:', action.title);
                        alert(`Executing: ${action.title}\n\n${action.description}`);
                      }}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
                    >
                      Execute Now
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-gray-700"
                      onClick={() => {
                        console.log('Adding to plan:', action.title);
                        alert(`Added "${action.title}" to your trading plan`);
                      }}
                    >
                      Add to Plan
                    </Button>
                    <Button 
                      variant="outline" 
                      className="border-gray-700"
                      onClick={() => {
                        console.log('Dismissing recommendation:', action.title);
                        alert(`Dismissed: ${action.title}`);
                      }}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}