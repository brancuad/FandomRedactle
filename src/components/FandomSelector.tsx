import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, Dices, Globe, X, Shuffle } from 'lucide-react';
import { FandomConfig } from '../types';
import { CURATED_ARTICLES_BY_FANDOM } from '../data/curatedArticles';

export interface FandomSelectorProps {
  fandoms: FandomConfig[];
  selectedFandomIds: string[];
  onToggleFandom: (fandomId: string) => void;
  onSelectAll: () => void;
  onSelectOnly: (fandomId: string) => void;
  onRollRandom: () => void;
  currentFandom: FandomConfig;
  isGameOver: boolean;
  isLoading?: boolean;
}

export const FandomSelector: React.FC<FandomSelectorProps> = ({
  fandoms,
  selectedFandomIds,
  onToggleFandom,
  onSelectAll,
  onSelectOnly,
  onRollRandom,
  currentFandom,
  isGameOver,
  isLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const allSelected = selectedFandomIds.length === fandoms.length;
  const singleSelected = selectedFandomIds.length === 1;

  // Filter fandoms based on search input
  const filteredFandoms = fandoms.filter(f =>
    f.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    f.tagline.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Trigger button label and icon
  const getButtonDisplay = () => {
    if (singleSelected) {
      const singleFandom = fandoms.find(f => f.id === selectedFandomIds[0]) || currentFandom;
      return {
        icon: <span className="text-sm leading-none">{singleFandom.icon}</span>,
        label: singleFandom.name,
        badge: '1 source'
      };
    }

    if (allSelected) {
      return {
        icon: <Globe className="w-3.5 h-3.5 text-amber-400" />,
        label: 'All Fandoms',
        badge: `${fandoms.length} sources`
      };
    }

    return {
      icon: <Dices className="w-3.5 h-3.5 text-amber-400" />,
      label: `${selectedFandomIds.length} Fandoms Selected`,
      badge: `${selectedFandomIds.length} sources`
    };
  };

  const buttonDisplay = getButtonDisplay();

  const handleToggle = (id: string) => {
    if (selectedFandomIds.includes(id) && selectedFandomIds.length === 1) {
      setAlertMessage('At least 1 fandom must remain selected.');
      setTimeout(() => setAlertMessage(null), 2500);
      return;
    }
    onToggleFandom(id);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs bg-[#1a1d29] hover:bg-[#232737] border border-[#2e3547] hover:border-amber-500/40 text-amber-200 rounded-lg px-2.5 py-1 font-medium cursor-pointer transition flex items-center gap-2 shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Choose fandom sources to randomize from"
      >
        <span className="flex items-center justify-center w-4 h-4">
          {buttonDisplay.icon}
        </span>
        <span className="max-w-[130px] sm:max-w-[180px] truncate text-stone-200 font-semibold">
          {buttonDisplay.label}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono font-semibold">
          {buttonDisplay.badge}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-amber-400' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-[#131620] border border-[#2d3345] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-3 bg-[#171a27] border-b border-[#252a3b]">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Dices className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-cinzel font-bold text-amber-200 uppercase tracking-wider">
                  Fandom Sources
                </h4>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={onSelectAll}
                  className={`px-2 py-0.5 rounded font-mono transition text-stone-300 hover:text-amber-300 hover:bg-[#222738] ${
                    allSelected ? 'text-amber-400 font-bold' : ''
                  }`}
                >
                  All ({fandoms.length})
                </button>
                <span className="text-stone-600">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const first = fandoms[0]?.id;
                    if (first) onSelectOnly(first);
                  }}
                  className="px-2 py-0.5 rounded font-mono text-stone-300 hover:text-amber-300 hover:bg-[#222738] transition"
                  title="Reset to first fandom only"
                >
                  Reset (1)
                </button>
              </div>
            </div>
            <p className="text-[11px] text-stone-400">
              Check multiple universes to draw random articles from any of them.
            </p>

            {/* Quick search filter */}
            <div className="mt-2 relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Filter universes..."
                className="w-full bg-[#0d0f17] border border-[#262c3e] focus:border-amber-500/50 rounded-lg pl-8 pr-7 py-1 text-xs text-stone-200 placeholder-stone-500 focus:outline-none"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Alert notice if user tries to deselect all */}
          {alertMessage && (
            <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-[11px] font-mono flex items-center justify-between">
              <span>{alertMessage}</span>
            </div>
          )}

          {/* Fandom Checkbox List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 divide-y divide-[#1e2333]/50">
            {filteredFandoms.map(fandom => {
              const isChecked = selectedFandomIds.includes(fandom.id);
              const articleCount = CURATED_ARTICLES_BY_FANDOM[fandom.id]?.length || 0;
              const isRevealedTarget = !isLoading && isGameOver && fandom.id === currentFandom.id;

              return (
                <div
                  key={fandom.id}
                  className={`group flex items-center justify-between p-2 rounded-lg transition cursor-pointer pt-2 ${
                    isChecked
                      ? 'bg-[#1b1f2e]/80 hover:bg-[#22273a]'
                      : 'hover:bg-[#171a26] opacity-75 hover:opacity-100'
                  }`}
                  onClick={() => handleToggle(fandom.id)}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Custom Styled Checkbox */}
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center transition border ${
                        isChecked
                          ? 'bg-amber-500 border-amber-400 text-stone-950 shadow-sm shadow-amber-500/40'
                          : 'border-[#394158] bg-[#0f111a] group-hover:border-stone-400'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>

                    {/* Fandom Icon */}
                    <span className="w-6 h-6 rounded-md bg-[#222638] flex items-center justify-center text-xs font-bold shrink-0 text-amber-200">
                      {fandom.icon}
                    </span>

                    {/* Fandom Name & Details */}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-stone-200 truncate flex items-center gap-1.5">
                        <span>{fandom.name}</span>
                        {isRevealedTarget && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono">
                            revealed
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-400 truncate">
                        {articleCount} curated articles
                      </div>
                    </div>
                  </div>

                  {/* "Only" quick switch button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectOnly(fandom.id);
                      setIsOpen(false);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] font-mono px-2 py-0.5 rounded bg-[#2b3145] hover:bg-amber-500 hover:text-stone-950 text-stone-300 transition shrink-0 ml-2 font-medium"
                    title={`Play exclusively from ${fandom.name}`}
                  >
                    Only
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer controls: Roll action */}
          <div className="p-3 bg-[#151825] border-t border-[#252a3b] flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onRollRandom();
                setIsOpen(false);
              }}
              className="flex-1 py-1.5 px-3 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-stone-950 font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Roll From Selected ({selectedFandomIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="py-1.5 px-2.5 bg-[#202536] hover:bg-[#2b3146] text-stone-300 text-xs rounded-lg transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
