import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface GuessConsoleProps {
  onGuess: (word: string) => void;
  feedback: { message: string; type: 'info' | 'success' | 'warn' | 'error' };
  guessCount: number;
  hitCount: number;
  accuracy: number;
  disabled?: boolean;
}

export const GuessConsole: React.FC<GuessConsoleProps> = ({
  onGuess,
  feedback,
  guessCount,
  hitCount,
  accuracy,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onGuess(trimmed);
    setInputValue('');
  };

  const getFeedbackColor = () => {
    switch (feedback.type) {
      case 'success': return 'text-emerald-400 font-semibold';
      case 'warn': return 'text-amber-400 font-medium';
      case 'error': return 'text-rose-400 font-medium';
      default: return 'text-stone-400';
    }
  };

  return (
    <div className="bg-[#12141d] border border-[#212534] rounded-xl p-5 shadow-xl">
      <label htmlFor="guessInput" className="block text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold mb-2">
        Enter Your Guess
      </label>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          id="guessInput"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g. fire, honor, aang, empire, jedi..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          disabled={disabled}
          className="flex-1 bg-[#191c27] border border-[#2e3547] focus:border-amber-500 text-amber-100 text-sm rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 transition font-medium disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !inputValue.trim()}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-900 font-bold text-sm rounded-lg shadow-md transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <span>Submit</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className={`min-h-[1.5rem] mt-2 text-xs font-mono flex items-center ${getFeedbackColor()}`}>
        {feedback.message}
      </div>

      {/* Metric Counter Grid */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#212534] text-center font-mono">
        <div className="bg-[#181b26] p-2 rounded-lg border border-[#252a3b]">
          <span className="block text-[11px] text-stone-400">Guesses</span>
          <span className="text-lg font-bold text-amber-200">{guessCount}</span>
        </div>
        <div className="bg-[#181b26] p-2 rounded-lg border border-[#252a3b]">
          <span className="block text-[11px] text-stone-400">Hits</span>
          <span className="text-lg font-bold text-emerald-400">{hitCount}</span>
        </div>
        <div className="bg-[#181b26] p-2 rounded-lg border border-[#252a3b]">
          <span className="block text-[11px] text-stone-400">Accuracy</span>
          <span className="text-lg font-bold text-cyan-400">{accuracy}%</span>
        </div>
      </div>
    </div>
  );
};
