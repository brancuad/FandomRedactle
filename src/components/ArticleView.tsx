import React, { useState } from 'react';
import { Trophy, Eye, Share2, Check, ArrowRight, Loader2 } from 'lucide-react';
import { Article, Token, FandomConfig } from '../types';

interface ArticleViewProps {
  article: Article;
  titleTokens: Token[];
  sectionTokens: {
    headingTokens: Token[] | null;
    paragraphTokens: Token[][];
  }[];
  activeWord: string | null;
  activeWordForms?: Set<string> | null;
  activeTokenId: string | null;
  totalWords: number;
  redactedWords: number;
  formattedTime: string;
  isGameOver: boolean;
  isWon?: boolean;
  totalGuesses?: number;
  accuracy?: number;
  onNextArticle?: () => void;
  cycleInfo?: { current: number; total: number } | null;
  currentFandom?: FandomConfig;
  selectedFandomCount?: number;
  isLoading?: boolean;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article,
  titleTokens,
  sectionTokens,
  activeWord,
  activeWordForms,
  activeTokenId,
  totalWords,
  redactedWords,
  formattedTime,
  isGameOver,
  isWon = false,
  totalGuesses = 0,
  accuracy = 0,
  onNextArticle,
  cycleInfo,
  currentFandom,
  selectedFandomCount = 1,
  isLoading = false
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const fandomInfo = currentFandom ? ` (${currentFandom.name})` : '';
    const shareText = `🧩 Fandom Redactle Solved!\nArticle: "${article.title}"${fandomInfo}\nGuesses: ${totalGuesses}\nAccuracy: ${accuracy}%\nTime: ${formattedTime}`;
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderToken = (token: Token) => {
    if (token.type === 'whitespace') {
      return token.raw;
    }

    if (token.type === 'punct') {
      return (
        <span key={token.id} className="text-stone-400 select-text font-mono">
          {token.raw}
        </span>
      );
    }

    const isMatch = activeWordForms
      ? (token.normalized ? activeWordForms.has(token.normalized) : false)
      : (activeWord ? token.normalized === activeWord : false);
    const isActiveTarget = token.id === activeTokenId;

    if (token.isRedacted && !isGameOver) {
      return (
        <span
          key={token.id}
          id={token.id}
          style={{ '--char-len': token.length || 1 } as React.CSSProperties}
          className="word-token redacted"
        >
          {token.length}
        </span>
      );
    }

    let extraClasses = '';
    if (isActiveTarget) {
      extraClasses += ' active-occurrence';
    } else if (isMatch) {
      extraClasses += ' matched-cycle';
    }

    if (token.isTitle) {
      extraClasses += ' text-amber-200 font-bold';
    } else if (token.isHeading) {
      extraClasses += ' text-amber-300 font-semibold';
    }

    return (
      <span
        key={token.id}
        id={token.id}
        data-word={token.normalized}
        className={`word-token revealed ${extraClasses}`}
      >
        {token.raw}
      </span>
    );
  };

  return (
    <section className="lg:col-span-8 bg-[#12141d] border border-[#212534] rounded-xl shadow-2xl flex flex-col overflow-hidden min-h-[750px] max-h-[88vh]">
      
      {/* Article Status Bar */}
      <div className="px-5 py-3 bg-[#161924] border-b border-[#212534] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 text-xs flex-wrap">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-mono text-stone-300 text-[11px] uppercase tracking-wider font-semibold">
            {isLoading
              ? 'FETCHING SECRET ARTICLE...'
              : isGameOver
                ? `ARTICLE: ${article.title.toUpperCase()}`
                : 'LORE ENCYCLOPEDIA ARCHIVE'}
          </span>

          {/* Fandom Source: completely hidden during gameplay and while loading, only shown once revealed */}
          {!isLoading && isGameOver && currentFandom && (
            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono flex items-center gap-1 font-semibold animate-in fade-in duration-300 ${currentFandom.themeBadge}`}>
              <span>{currentFandom.icon}</span> {currentFandom.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-stone-400">
          <span>Words: <strong className="text-stone-200">{totalWords}</strong></span>
          <span>Redacted: <strong className="text-amber-400">{isGameOver ? 0 : redactedWords}</strong></span>
          <span>Time: <strong className="text-stone-200">{formattedTime}</strong></span>
        </div>
      </div>

      {/* Inline Victory / Revealed Card */}
      {!isLoading && isGameOver && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-950/60 via-[#1a1d29] to-[#141724] border border-amber-500/50 shadow-xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-yellow-400 text-stone-950 flex items-center justify-center font-bold text-xl shadow-lg shadow-amber-500/20">
              {isWon ? <Trophy className="w-6 h-6 text-amber-950" /> : <Eye className="w-6 h-6 text-amber-950" />}
            </div>
            <div>
              <div className="text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold">
                {isWon ? 'Honor Restored!' : 'Article Revealed'}
              </div>
              <h3 className="text-lg font-cinzel font-bold text-amber-100 flex items-center gap-2 flex-wrap">
                <span>{article.title}</span>
                {currentFandom && (
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] font-sans font-semibold tracking-normal ${currentFandom.themeBadge}`}>
                    {currentFandom.icon} {currentFandom.name}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3 text-xs font-mono text-stone-300 mt-1">
                <span>Guesses: <strong className="text-amber-300">{totalGuesses}</strong></span>
                <span className="text-stone-600">&bull;</span>
                <span>Accuracy: <strong className="text-emerald-400">{accuracy}%</strong></span>
                <span className="text-stone-600">&bull;</span>
                <span>Time: <strong className="text-cyan-400">{formattedTime}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-3.5 py-2 bg-[#212534] hover:bg-[#2b3042] text-stone-200 rounded-lg text-xs font-mono transition flex items-center gap-1.5 border border-[#343b50]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-amber-400" />}
              <span>{copied ? 'Copied!' : 'Share'}</span>
            </button>
            {onNextArticle && (
              <button
                onClick={onNextArticle}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-stone-900 font-bold text-xs rounded-lg shadow-md transition flex items-center gap-1.5"
              >
                <span>Play Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Article Title */}
      <div className="px-6 py-5 border-b border-[#212534] bg-gradient-to-b from-[#191c28]/40 to-transparent">
        <div className="text-[11px] uppercase tracking-wider text-amber-500 font-mono font-semibold mb-1">
          Article Title
        </div>
        <h2 className="text-2xl sm:text-3xl font-cinzel font-bold text-amber-100 flex flex-wrap gap-1.5 items-center">
          {titleTokens.map(t => renderToken(t))}
        </h2>
      </div>

      {/* Scrollable Article Body */}
      <div id="articleScrollContainer" className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-[15px] leading-relaxed text-[#dcd4c3] relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[#12141d]/85 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-200">
            <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            <p className="font-mono text-sm text-amber-200 font-semibold tracking-wider uppercase">
              Loading New Article...
            </p>
            <p className="text-xs text-stone-400">
              Redacting lore entries & preparing secret puzzle
            </p>
          </div>
        )}
        
        {/* Full Article Text with Floated Image */}
        <div>
          {/* Article Image from Wiki Site (Revealed only when game over) */}
          {!isLoading && isGameOver && article.imageUrl && (
            <div className="float-right ml-6 mb-4 max-w-[280px] sm:max-w-[320px] bg-[#161925] border border-amber-500/30 rounded-xl p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
              <img
                src={article.imageUrl}
                alt={article.title}
                referrerPolicy="no-referrer"
                loading="eager"
                className="w-full h-auto rounded-lg object-cover max-h-[340px] shadow"
              />
              <div className="text-[11px] font-mono text-amber-300/80 text-center mt-2 px-1 font-medium">
                {article.title}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {sectionTokens.map((sec, idx) => (
              <div key={idx} className="space-y-4">
                {sec.headingTokens && sec.headingTokens.length > 0 ? (
                  <h3 className="text-xl font-cinzel font-bold text-amber-300 pt-3 pb-1 border-b border-[#242938] flex flex-wrap gap-1.5 items-center">
                    {sec.headingTokens.map(t => renderToken(t))}
                  </h3>
                ) : idx === 0 ? (
                  <div className="text-[11px] uppercase tracking-wider text-amber-500/80 font-mono font-semibold">
                    Lead Overview
                  </div>
                ) : null}

                {sec.paragraphTokens.map((pTokens, pIdx) => {
                  const isBullet = pTokens.length > 0 && pTokens[0]?.raw?.trim() === '•';
                  return (
                    <div
                      key={pIdx}
                      className={
                        isBullet
                          ? "leading-relaxed text-[#ded5c2] tracking-wide select-text pl-6 -indent-6 my-2"
                          : "leading-relaxed text-[#ded5c2] tracking-wide select-text my-3"
                      }
                    >
                      {pTokens.map(t => renderToken(t))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Helper Ribbon */}
      <div className="px-5 py-2.5 bg-[#0f1118] border-t border-[#1f2331] text-[11px] text-stone-400 flex items-center justify-between">
        <span>Redacted pills show letter count & expand proportionally</span>
        {cycleInfo && (
          <span className="font-mono text-cyan-400">
            Word "{activeWord}": occurrence {cycleInfo.current} of {cycleInfo.total}
          </span>
        )}
      </div>

    </section>
  );
};
