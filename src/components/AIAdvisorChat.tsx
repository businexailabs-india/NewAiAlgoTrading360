import { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Bot, User, TrendingUp, PieChart, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

const suggestedQuestions = [
  {
    icon: TrendingUp,
    text: "Should I increase my tech sector allocation now?",
    category: "Portfolio"
  },
  {
    icon: PieChart,
    text: "What's the optimal portfolio rebalancing strategy?",
    category: "Strategy"
  },
  {
    icon: Shield,
    text: "How can I reduce portfolio risk in this market?",
    category: "Risk"
  },
  {
    icon: TrendingUp,
    text: "Which sectors are showing strongest momentum?",
    category: "Market"
  }
];

export function AIAdvisorChat() {
  const [messages, setMessages] = useState([
    {
      type: 'ai',
      text: "Hello! I'm your AI Portfolio Advisor powered by GPT-4. I can help you with portfolio analysis, market insights, investment strategies, and risk management. What would you like to know?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = { type: 'user', text: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse = {
        type: 'ai',
        text: `Based on your current portfolio analysis and market conditions:

**Technology Sector (Current: 35%)**
- Your tech allocation is 5% above target (30%)
- NIFTY IT index showing strong momentum (+1.67% today)
- However, consider trimming positions due to:
  • High valuation metrics (P/E ratio above historical average)
  • Upcoming Q4 results may cause volatility
  • Dollar weakness could impact IT exporters

**Recommendation:**
1. Reduce tech allocation to 30% by selling 80 shares of INFY
2. Expected tax impact: ₹15,400 (LTCG)
3. Redeploy capital into Banking sector (underweight at 20% vs 25% target)

**Risk-Adjusted Return:**
- Expected portfolio Sharpe ratio improvement: 1.84 → 2.08
- Volatility reduction: ~12%
- Diversification benefit: Reduced single-sector concentration

Would you like me to create a detailed rebalancing plan?`
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 2000);
  };

  const handleQuestionClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className="space-y-6">
      {/* Chat Messages */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-xl p-6 min-h-[500px] max-h-[600px] overflow-y-auto">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.type === 'ai' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div className={`max-w-[80%] rounded-xl p-4 ${
                msg.type === 'user'
                  ? 'bg-cyan-500/20 border border-cyan-500/30 text-white'
                  : 'bg-gray-900/50 border border-gray-700 text-gray-300'
              }`}>
                <div className="text-sm whitespace-pre-line">{msg.text}</div>
              </div>

              {msg.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Suggested Questions */}
      {messages.length === 1 && (
        <div>
          <h4 className="text-gray-400 text-sm mb-3">Suggested Questions:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {suggestedQuestions.map((q, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handleQuestionClick(q.text)}
                className="flex items-start gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-purple-500/50 transition-all text-left"
              >
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <q.icon className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-purple-400 mb-1">{q.category}</div>
                  <div className="text-sm text-gray-300">{q.text}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3">
        <Textarea
          placeholder="Ask anything about your portfolio, market trends, or investment strategies..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          className="bg-gray-800 border-gray-700 text-white resize-none"
          rows={3}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      <div className="text-xs text-gray-500 text-center">
        AI-powered insights are based on historical data and current market conditions. Always conduct your own research before making investment decisions.
      </div>
    </div>
  );
}
