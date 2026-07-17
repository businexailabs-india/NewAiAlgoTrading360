import { useState } from 'react';
import { motion } from 'motion/react';
import { X, Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { advisorService } from '../services/advisorService';

interface VoiceAssistantProps {
  onClose: () => void;
}

const quickCommands = [
  "What was my P&L this month?",
  "Show expected return next quarter",
  "What's the market sentiment today?",
  "Which strategies are performing best?",
  "Show anomalies detected this week",
  "What's my win rate?"
];

export function VoiceAssistant({ onClose }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVoiceCommand = async (command: string) => {
    setTranscript(command);
    setResponse('');
    setLoading(true);
    setIsListening(true);

    try {
      const result = await advisorService.chat(command);
      setResponse(result.reply || 'No response available.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setResponse(`Could not reach the advisor API. Ensure you are signed in and the backend is running.\n\n${msg}`);
    } finally {
      setLoading(false);
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (loading) return;
    setIsListening(!isListening);
    setTranscript('');
    setResponse('');
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
        className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl text-white mb-1">EdgeX Voice Assistant</h2>
              <p className="text-gray-400">Ask me anything about your portfolio</p>
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
        </div>

        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleListening}
              className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                isListening || loading
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                  : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50'
              }`}
            >
              {loading ? (
                <Loader2 className="w-12 h-12 text-white animate-spin" />
              ) : isListening ? (
                <Mic className="w-12 h-12 text-white" />
              ) : (
                <MicOff className="w-12 h-12 text-purple-400" />
              )}
            </motion.button>

            <div className="mt-4 text-center">
              <div className="text-sm text-gray-400 mb-1">
                {loading ? 'Thinking...' : isListening ? 'Listening...' : 'Select a command below'}
              </div>
            </div>
          </div>

          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4 mb-4"
            >
              <div className="flex items-start gap-2">
                <Volume2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-cyan-400 mb-1">You asked:</div>
                  <div className="text-white">{transcript}</div>
                </div>
              </div>
            </motion.div>
          )}

          {response && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 mb-6"
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm">AI</span>
                </div>
                <div>
                  <div className="text-xs text-purple-400 mb-1">EdgeX Voice:</div>
                  <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">{response}</div>
                </div>
              </div>
            </motion.div>
          )}

          <div>
            <div className="text-sm text-gray-400 mb-3">Try these commands:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {quickCommands.map((command, i) => (
                <button
                  key={i}
                  onClick={() => handleVoiceCommand(command)}
                  disabled={loading}
                  className="text-left text-sm bg-gray-800/50 hover:bg-gray-800 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {command}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 p-4 bg-gray-900/50">
          <div className="text-xs text-gray-500 text-center">
            Responses from advisor API • Secure & Private
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
