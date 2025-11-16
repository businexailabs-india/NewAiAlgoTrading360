import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from './ui/button';

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
  const [waveAnimation, setWaveAnimation] = useState(false);

  useEffect(() => {
    if (isListening) {
      setWaveAnimation(true);
      // Simulate voice recognition
      const timeout = setTimeout(() => {
        setIsListening(false);
        setWaveAnimation(false);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isListening]);

  const handleVoiceCommand = (command: string) => {
    setTranscript(command);
    setIsListening(true);
    
    // Simulate AI response based on command
    setTimeout(() => {
      let aiResponse = '';
      
      if (command.includes('P&L') || command.includes('profit')) {
        aiResponse = "Your total P&L for this month is ₹1,56,780.50 with 342 executed trades. You're up 8.2% compared to last month. Your best performing strategy is Momentum Breakout Pro with ₹45,670 profit.";
      } else if (command.includes('expected return') || command.includes('forecast')) {
        aiResponse = "Based on AI analysis, your expected return for next quarter is between ₹2.2 lakhs to ₹3.6 lakhs with 82% confidence. The model predicts a most likely outcome of ₹2.9 lakhs based on current market conditions.";
      } else if (command.includes('sentiment')) {
        aiResponse = "Current market sentiment index is 72 out of 100, indicating a moderately bullish trend. Banking sector shows strong positive sentiment at 78, while energy sector is relatively weak at 58.";
      } else if (command.includes('strategies') || command.includes('performing')) {
        aiResponse = "Your top performing strategy is Momentum Breakout Pro with ₹45,670 profit and 72.4% win rate. Second is Options Iron Condor with ₹32,400 profit. Mean Reversion Alpha is underperforming with -₹5,200 loss.";
      } else if (command.includes('anomalies')) {
        aiResponse = "12 anomalies detected this week. 3 are high severity including unusual slippage on RELIANCE trade and price deviation on HDFCBANK. Total impact: ₹15,888. I recommend using limit orders during high volatility.";
      } else if (command.includes('win rate')) {
        aiResponse = "Your current win rate is 67.5% across all strategies with an average return of 2.34% per trade. Your Sharpe ratio is 1.89, which is above the benchmark of 1.5.";
      } else {
        aiResponse = "I'm your EdgeX Voice assistant. I can help you with portfolio performance, market analysis, strategy insights, and anomaly reports. What would you like to know?";
      }
      
      setResponse(aiResponse);
      setIsListening(false);
      setWaveAnimation(false);
    }, 2000);
  };

  const toggleListening = () => {
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
        {/* Header */}
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

        {/* Voice Interface */}
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            {/* Microphone Button with Wave Animation */}
            <div className="relative">
              {waveAnimation && (
                <>
                  <div className="absolute inset-0 -m-4 rounded-full bg-purple-500/20 animate-ping"></div>
                  <div className="absolute inset-0 -m-8 rounded-full bg-purple-500/10 animate-ping" style={{ animationDelay: '0.5s' }}></div>
                  <div className="absolute inset-0 -m-12 rounded-full bg-purple-500/5 animate-ping" style={{ animationDelay: '1s' }}></div>
                </>
              )}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleListening}
                className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                    : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50'
                }`}
              >
                {isListening ? (
                  <Mic className="w-12 h-12 text-white" />
                ) : (
                  <MicOff className="w-12 h-12 text-purple-400" />
                )}
              </motion.button>
            </div>

            <div className="mt-4 text-center">
              <div className="text-sm text-gray-400 mb-1">
                {isListening ? 'Listening...' : 'Tap to speak'}
              </div>
            </div>
          </div>

          {/* Transcript */}
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

          {/* Response */}
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
                  <div className="text-white text-sm leading-relaxed">{response}</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Commands */}
          <div>
            <div className="text-sm text-gray-400 mb-3">Try these commands:</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {quickCommands.map((command, i) => (
                <button
                  key={i}
                  onClick={() => handleVoiceCommand(command)}
                  className="text-left text-sm bg-gray-800/50 hover:bg-gray-800 border border-gray-700 text-gray-300 px-3 py-2 rounded-lg transition-colors"
                >
                  {command}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 p-4 bg-gray-900/50">
          <div className="text-xs text-gray-500 text-center">
            Voice recognition powered by EdgeXAi Labs • Secure & Private
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
