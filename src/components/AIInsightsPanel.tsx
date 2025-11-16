import { useState } from 'react';
import { motion } from 'motion/react';
import { Brain, Send, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

const sampleInsights = [
  "Your portfolio is currently overweight in mid-cap stocks (30% vs target 25%). Rebalancing to 40% large cap could reduce volatility by 15%.",
  "Technology sector allocation is optimal. However, consider reducing energy exposure from 18.5% to 15% to align with target allocation and minimize tax impact.",
  "With current market conditions, the AI model suggests a moderate-aggressive stance. Your Sharpe ratio could improve from 1.84 to 2.08 after rebalancing."
];

const suggestedQuestions = [
  "What's the optimal time to rebalance considering tax implications?",
  "How does my portfolio compare to the Nifty 50 benchmark?",
  "What sectors should I increase exposure to?",
  "What's the risk of my current allocation?"
];

export function AIInsightsPanel() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<{ type: 'user' | 'ai', text: string }>>([]);

  const handleSendQuestion = () => {
    if (!question.trim()) return;
    
    setMessages([...messages, 
      { type: 'user', text: question },
      { type: 'ai', text: "Based on your portfolio analysis, I recommend focusing on rebalancing your mid-cap holdings. The current allocation of 30% is above your target of 25%, which increases portfolio volatility. By shifting 5% to large-cap stocks, you could reduce risk by approximately 15% while maintaining similar returns. The optimal execution window would be next month to minimize short-term capital gains tax." }
    ]);
    setQuestion('');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
      className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 shadow-xl"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border border-purple-500/30">
          <Brain className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl text-white">AI Insights & Analysis</h2>
          <p className="text-sm text-gray-400">Powered by GPT-4 Portfolio Intelligence</p>
        </div>
      </div>

      {/* Natural Language Summary */}
      <div className="space-y-4 mb-6">
        {sampleInsights.map((insight, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * index }}
            className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4"
          >
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p className="text-gray-300 text-sm">{insight}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chat Interface */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-white mb-4">Ask Questions About Your Portfolio</h3>
        
        {/* Suggested Questions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {suggestedQuestions.map((q, index) => (
            <button
              key={index}
              onClick={() => setQuestion(q)}
              className="text-xs bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        {messages.length > 0 && (
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-xl p-3 ${
                  msg.type === 'user' 
                    ? 'bg-cyan-500/20 border border-cyan-500/30 text-white' 
                    : 'bg-purple-500/10 border border-purple-500/20 text-gray-300'
                }`}>
                  <p className="text-sm">{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask me anything about your portfolio..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendQuestion())}
            className="bg-gray-900 border-gray-700 text-white resize-none"
            rows={2}
          />
          <Button 
            onClick={handleSendQuestion}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
