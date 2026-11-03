import React from 'react';
import { GuessEntry } from '../types';

interface GuessHistoryProps {
  history: GuessEntry[];
  onSelectWord: (word: string) => void;
  activeWord: string | null;
}

export const GuessHistory: React.FC<GuessHistoryProps> = ({
  history,
  onSelectWord,
  activeWord
}) => {
  return (
    <div className="bg-[#12141d] border border-[#212534] rounded-xl shadow-xl overflow-hidden flex flex-col h-[520px]">
      <div className="px-4 py-3 bg-[#161924] border-b border-[#212534] flex items-center justify-between">
        <h3 className="text-xs uppercase font-mono tracking-wider text-stone-300 font-semibold flex items-center gap-2">
          Guess History
          <span className="bg-[#222736] text-stone-400 px-1.5 py-0.5 rounded text-[10px]">
            {history.length}
          </span>
        </h3>
        <span className="text-[11px] text-cyan-400/80">Click row to cycle hits</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead className="sticky top-0 bg-[#141620] text-stone-400 border-b border-[#212534] z-10">
            <tr>
              <th className="py-2 px-3 w-10 text-stone-500">#</th>
              <th className="py-2 px-3">Word</th>
              <th className="py-2 px-3 text-right">Hits</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1c202d] text-stone-300">
            {history.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-12 text-stone-500 italic">
                  No guesses yet. Redacted numbers indicate letter count!
                </td>
              </tr>
            ) : (
              // Display in reverse order (most recent first) with original guess #
              [...history].reverse().map((item) => {
                const isSelected = activeWord === item.word;
                return (
                  <tr
                    key={item.guessNum}
                    onClick={() => onSelectWord(item.word)}
                    className={`cursor-pointer transition ${
                      isSelected ? 'bg-cyan-950/40 border-l-2 border-cyan-400' : 'hover:bg-[#191d2a]'
                    }`}
                  >
                    <td className="py-2 px-3 text-stone-500">{item.guessNum}</td>
                    <td className={`py-2 px-3 font-semibold ${item.hits > 0 ? 'text-amber-300' : 'text-stone-400'}`}>
                      <div>{item.word}</div>
                      {item.conjugations && item.conjugations.length > 1 && (
                        <div className="text-[10px] text-stone-500 font-normal truncate max-w-[140px]" title={item.conjugations.join(', ')}>
                          {item.conjugations.filter(c => c !== item.word).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                        item.hits > 0
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold'
                          : 'text-stone-500'
                      }`}>
                        {item.hits}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
