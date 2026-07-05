import { useState } from 'react';
import { motion } from 'motion/react';
import { Send, Bot, User, TrendingUp, PieChart, Shield } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { advisorService } from '../services/advisorService';

const suggestedQuestions = [
  { icon: TrendingUp, text: 'Should I increase my tech sector allocation now?', category: 'Portfolio' },
  { icon: PieChart, text: "What's the optimal portfolio rebalancing strategy?", category: 'Strategy' },
  { icon: Shield, text: 'How can I reduce portfolio risk in this market?', category: 'Risk' },
  { icon: TrendingUp, text: 'Which sectors are showing strongest momentum?', category: 'Market' }
];

type ChatMessage = {
  type: 'user' | 'ai';
  text: string;
  provider?: string;
  sources?: Array<{ title: string; score: number }>;
};

export function AIAdvisorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      type: 'ai',
      text: "Hello! I'm your SmartTrade AI Advisor with semantic RAG, ML predictions, and optional LoRA/Ollama/OpenAI. Ask about portfolio, sectors, or strategies."
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setMessages(prev => [...prev, { type: 'user', text: userText }]);
    setInput('');
    setIsTyping(true);
    setError(null);

    try {
      const result = await advisorService.chat(userText);
      setMessages(prev => [
        ...prev,
        {
          type: 'ai',
          text: result.reply,
          provider: result.provider,
          sources: result.sources?.map(s => ({ title: s.title, score: s.score }))
        }
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Advisor unavailable';
      setError(msg);
      setMessages(prev => [
        ...prev,
        {
          type: 'ai',
          text: `Could not reach the advisor API. Sign in and ensure the backend is running.\n\n_${msg}_`,
          provider: 'error'
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuestionClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className="space-y-6">
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
                {msg.provider && msg.type === 'ai' && (
                  <Badge className="mb-2 bg-purple-500/20 text-purple-300 text-xs">{msg.provider}</Badge>
                )}
                <div className="text-sm whitespace-pre-line">{msg.text}</div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-700 text-xs text-gray-500">
                    Sources: {msg.sources.slice(0, 3).map(s => s.title).join(', ')}
                  </div>
                )}
              </div>

              {msg.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </motion.div>
          ))}

          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

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

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <Textarea
          placeholder="Ask about portfolio, RAG research, ML signals, or LoRA-trained models..."
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
        Powered by semantic RAG + sklearn predictions. Optional: OpenAI, Ollama, or LoRA/QLoRA adapters.
      </div>
    </div>
  );
}
