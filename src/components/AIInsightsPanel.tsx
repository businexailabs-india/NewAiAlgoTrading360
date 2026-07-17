import { useState } from 'react';
import { motion } from 'motion/react';
import { Brain, Send, Sparkles, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { advisorService } from '../services/advisorService';

const suggestedQuestions = [
  "What's the optimal time to rebalance considering tax implications?",
  "How does my portfolio compare to the Nifty 50 benchmark?",
  "What sectors should I increase exposure to?",
  "What's the risk of my current allocation?"
];

export function AIInsightsPanel() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Array<{ type: 'user' | 'ai', text: string }>>([]);
  const [loading, setLoading] = useState(false);

  const handleSendQuestion = async () => {
    if (!question.trim() || loading) return;
    
    const userText = question.trim();
    setMessages(prev => [...prev, { type: 'user', text: userText }]);
    setQuestion('');
    setLoading(true);

    try {
      const result = await advisorService.chat(userText);
      setMessages(prev => [...prev, { type: 'ai', text: result.reply || 'No response available.' }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => [...prev, {
        type: 'ai',
        text: `Could not reach the advisor API. Ensure you are signed in and the backend is running.\n\n_${msg}_`
      }]);
    } finally {
      setLoading(false);
    }
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
          <p className="text-sm text-gray-400">Ask the portfolio advisor for live insights</p>
        </div>
      </div>

      {/* Empty insights until advisor responds */}
      <div className="mb-6 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-6 text-center">
        <Sparkles className="w-6 h-6 text-purple-400 mx-auto mb-2" />
        <p className="text-gray-400 text-sm">No insights yet. Ask a question below to get analysis from the advisor.</p>
      </div>

      {/* Chat Interface */}
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
        <h3 className="text-white mb-4">Ask Questions About Your Portfolio</h3>
        
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
                  <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

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
            disabled={loading}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-6"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
