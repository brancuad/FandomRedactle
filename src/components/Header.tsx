import React, { useState } from 'react';
import { Flag, Loader2, Search, X, Shuffle } from 'lucide-react';
import { FandomConfig } from '../types';
import { FandomSelector } from './FandomSelector';

interface HeaderProps {
  currentFandom: FandomConfig;
  selectedFandomIds: string[];
  fandoms: FandomConfig[];
  onToggleFandom: (fandomId: string) => void;
  onSelectAllFandoms: () => void;
  onSelectOnlyFandom: (fandomId: string) => void;
  mysteryMode: boolean;
  onToggleMysteryMode: () => void;
  onFetchNewRandom: () => void;
  onFetchCustom: (titleOrUrl: string) => void;
  isLoading: boolean;
  onGiveUp: () => void;
  isGameOver: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentFandom,
  selectedFandomIds,
  fandoms,
  onToggleFandom,
  onSelectAllFandoms,
  onSelectOnlyFandom,
  mysteryMode,
  onToggleMysteryMode,
  onFetchNewRandom,
  onFetchCustom,
  isLoading,
  onGiveUp,
  isGameOver
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    onFetchCustom(searchQuery.trim());
    setShowSearch(false);
    setSearchQuery('');
  };

  const isMysteryActive = mysteryMode && !isGameOver && selectedFandomIds.length > 1;

  return (
    <header className="border-b border-[#212635] bg-[#11131c]/95 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-[1700px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Brand & Multi-Fandom Selector */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 via-red-600 to-cyan-700 flex items-center justify-center shadow-lg shadow-amber-900/30 ring-1 ring-amber-500/30 font-bold text-amber-100 text-lg transition-all">
            {isMysteryActive ? '🎲' : currentFandom.icon}
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-cinzel font-bold tracking-wider text-amber-200">
                FANDOM <span className="text-amber-500 text-[11px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 font-sans tracking-normal font-semibold">REDACTLE</span>
              </h1>
              
              {/* Multi-Fandom Selector Dropdown */}
              <FandomSelector
                fandoms={fandoms}
                selectedFandomIds={selectedFandomIds}
                onToggleFandom={onToggleFandom}
                onSelectAll={onSelectAllFandoms}
                onSelectOnly={onSelectOnlyFandom}
                mysteryMode={mysteryMode}
                onToggleMysteryMode={onToggleMysteryMode}
                onRollRandom={onFetchNewRandom}
                currentFandom={currentFandom}
                isGameOver={isGameOver}
              />
            </div>
            <p className="text-[11px] text-stone-400 hidden sm:block">
              {isMysteryActive
                ? `Random pool: ${selectedFandomIds.length} mystery universes active`
                : currentFandom.tagline}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          
          {/* Custom Article Search Bar or Toggle */}
          {showSearch ? (
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-1 bg-[#171a25] border border-amber-500/50 rounded-lg px-2 py-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${currentFandom.name} or paste wiki URL...`}
                autoFocus
                className="bg-transparent text-amber-200 text-xs focus:outline-none w-48 sm:w-64"
              />
              <button type="submit" className="text-amber-400 hover:text-amber-300 px-1 font-bold">
                Load
              </button>
              <button
                type="button"
                onClick={() => setShowSearch(false)}
                className="text-stone-400 hover:text-stone-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowSearch(true)}
              className="px-2.5 py-1.5 bg-[#171a25] hover:bg-[#222736] text-stone-300 rounded-lg border border-[#2c3243] transition flex items-center gap-1.5 font-medium"
              title="Search a specific wiki article or paste URL"
            >
              <Search className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Article</span>
            </button>
          )}

          {/* New Random Article Button */}
          <button 
            onClick={onFetchNewRandom}
            disabled={isLoading}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-600/25 to-red-600/25 hover:from-amber-600/35 hover:to-red-600/35 text-amber-300 rounded-lg border border-amber-500/40 transition flex items-center gap-1.5 font-medium shadow-sm disabled:opacity-50"
            title={selectedFandomIds.length > 1 ? `Randomize from ${selectedFandomIds.length} selected fandoms` : 'Fetch new random article'}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />
            ) : (
              <Shuffle className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>
              Random Article
              {selectedFandomIds.length > 1 && (
                <span className="ml-1 text-[10px] text-amber-400/80 font-mono">
                  ({selectedFandomIds.length})
                </span>
              )}
            </span>
          </button>

          {/* Give up button */}
          {!isGameOver && (
            <button 
              onClick={onGiveUp}
              className="px-2.5 py-1.5 text-stone-400 hover:text-red-400 transition text-[11px] underline flex items-center gap-1"
            >
              <Flag className="w-3 h-3" />
              <span>Give Up</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
