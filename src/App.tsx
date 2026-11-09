import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { ArticleView } from './components/ArticleView';
import { GuessConsole } from './components/GuessConsole';
import { GuessHistory } from './components/GuessHistory';
import confetti from 'canvas-confetti';
import { Article, GuessEntry, Token, FandomConfig } from './types';
import { SUPPORTED_FANDOMS } from './data/fandoms';
import { CURATED_ARTICLES_BY_FANDOM } from './data/curatedArticles';
import { cleanWord, tokenizeText, getWordConjugations } from './utils/tokenizer';
import { fetchRandomWikiArticle, fetchWikiArticle } from './utils/fandomApi';

const PLACEHOLDER_ARTICLE: Article = {
  id: 'INITIAL',
  title: 'Avatar Redactle',
  sections: [
    {
      heading: null,
      paragraphs: ['Select a game or click Random Article to begin revealing lore!']
    }
  ]
};

export const App: React.FC = () => {
  // Multi-Fandom Selection State
  const [selectedFandomIds, setSelectedFandomIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fandom_selected_sources');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(id => SUPPORTED_FANDOMS.some(f => f.id === id));
          if (valid.length > 0) return valid;
        }
      }
    } catch (e) {}
    // Default to Avatar initially, or whatever active puzzle was
    return [SUPPORTED_FANDOMS[0].id];
  });

  // Persist selected fandoms
  useEffect(() => {
    try {
      localStorage.setItem('fandom_selected_sources', JSON.stringify(selectedFandomIds));
    } catch (e) {}
  }, [selectedFandomIds]);

  // Current Article Fandom & Article State
  const [currentFandom, setCurrentFandom] = useState<FandomConfig>(() => {
    const firstSelected = SUPPORTED_FANDOMS.find(f => f.id === selectedFandomIds[0]);
    return firstSelected || SUPPORTED_FANDOMS[0];
  });
  const [currentArticle, setCurrentArticle] = useState<Article>(PLACEHOLDER_ARTICLE);
  const [isLoading, setIsLoading] = useState(false);

  // Gameplay State
  const [guessedWords, setGuessedWords] = useState<Set<string>>(new Set());
  const [guessHistory, setGuessHistory] = useState<GuessEntry[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'info' | 'success' | 'warn' | 'error' }>({
    message: 'Type any term, character, or element to reveal matches.',
    type: 'info'
  });

  // Occurrence Cycling State
  const [activeCycleWord, setActiveCycleWord] = useState<string | null>(null);
  const [activeCycleIndex, setActiveCycleIndex] = useState<number>(-1);
  const [activeTokenId, setActiveTokenId] = useState<string | null>(null);

  // Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);

  // Start / Reset Timer
  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (!isGameOver && currentArticle.id !== 'INITIAL') {
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isGameOver, currentArticle.id]);

  // Format Elapsed Time
  const formattedTime = useMemo(() => {
    const mins = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const secs = (elapsedSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }, [elapsedSeconds]);

  // Load article helper
  const loadArticle = useCallback((article: Article, fandom?: FandomConfig) => {
    const activeFandom = fandom || currentFandom;
    setCurrentArticle(article);
    setIsGameOver(false);
    setIsWon(false);
    setActiveCycleWord(null);
    setActiveCycleIndex(-1);
    setActiveTokenId(null);

    // Check for saved progress in LocalStorage
    try {
      localStorage.setItem('fandom_active_puzzle', JSON.stringify({
        title: article.title,
        domain: activeFandom.apiDomain,
        fandomId: activeFandom.id,
        articleId: article.id
      }));

      const savedRaw = localStorage.getItem('fandom_save_' + article.id);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        setGuessedWords(new Set(saved.guessedWords || []));
        setGuessHistory(saved.guessHistory || []);
        setElapsedSeconds(saved.elapsedSeconds || 0);
        setFeedback({
          message: `Resumed previous session with ${saved.guessHistory?.length || 0} guesses!`,
          type: 'info'
        });
        return;
      }
    } catch (e) {
      // LocalStorage fallback
    }

    setGuessedWords(new Set());
    setGuessHistory([]);
    setElapsedSeconds(0);
    setFeedback({
      message: 'New secret article loaded! Type any term to start guessing.',
      type: 'info'
    });
  }, [currentFandom]);

  // Auto-save game progress to LocalStorage
  useEffect(() => {
    if (currentArticle && currentArticle.id !== 'INITIAL' && !isGameOver && guessedWords.size > 0) {
      try {
        localStorage.setItem('fandom_save_' + currentArticle.id, JSON.stringify({
          guessedWords: Array.from(guessedWords),
          guessHistory,
          elapsedSeconds
        }));
      } catch (e) {}
    }
  }, [currentArticle.id, guessedWords, guessHistory, elapsedSeconds, isGameOver]);

  // Tokenize Article (Title + Sections)
  const { titleTokens, sectionTokens, allWordTokens } = useMemo(() => {
    const title = tokenizeText(currentArticle.title, true, false, guessedWords, isGameOver);
    const sections = currentArticle.sections.map(s => ({
      headingTokens: s.heading ? tokenizeText(s.heading, false, true, guessedWords, isGameOver) : null,
      paragraphTokens: s.paragraphs.map(p => tokenizeText(p, false, false, guessedWords, isGameOver))
    }));

    const allWords: Token[] = [
      ...title.filter(t => t.type === 'word'),
      ...sections.flatMap(s => [
        ...(s.headingTokens?.filter(t => t.type === 'word') || []),
        ...s.paragraphTokens.flat().filter(t => t.type === 'word')
      ])
    ];

    return { titleTokens: title, sectionTokens: sections, allWordTokens: allWords };
  }, [currentArticle, guessedWords, isGameOver]);

  // Calculate Stats
  const totalWords = allWordTokens.length;
  const redactedWords = allWordTokens.filter(t => t.isRedacted).length;
  const successfulGuesses = guessHistory.filter(g => g.hits > 0).length;
  const accuracy = guessHistory.length > 0
    ? Math.round((successfulGuesses / guessHistory.length) * 100)
    : 0;

  // Occurrence Cycling Handler
  const cycleWordMatches = useCallback((word: string) => {
    const norm = cleanWord(word);
    if (!norm) return;

    const forms = new Set(getWordConjugations(norm));
    const matches = allWordTokens.filter(t => t.normalized && forms.has(t.normalized) && !t.isRedacted);
    if (matches.length === 0) return;

    let nextIndex = 0;
    if (activeCycleWord === norm) {
      nextIndex = (activeCycleIndex + 1) % matches.length;
    }

    const targetTok = matches[nextIndex];
    setActiveCycleWord(norm);
    setActiveCycleIndex(nextIndex);
    setActiveTokenId(targetTok.id);

    // Smooth scroll to target element
    setTimeout(() => {
      const el = document.getElementById(targetTok.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }, [allWordTokens, activeCycleWord, activeCycleIndex]);

  // Handle Guess Submission
  const handleGuess = (input: string) => {
    if (isGameOver || currentArticle.id === 'INITIAL') return;

    const normalized = cleanWord(input);
    if (!normalized) {
      setFeedback({ message: 'Please enter a valid word.', type: 'warn' });
      return;
    }

    if (guessedWords.has(normalized)) {
      setFeedback({ message: `"${normalized}" was already guessed!`, type: 'warn' });
      cycleWordMatches(normalized);
      return;
    }

    // Get word conjugations via compromise
    const forms = getWordConjugations(normalized);
    const formsSet = new Set(forms);

    // Count hits in article across guessed word and its conjugations
    const matchingTokens = allWordTokens.filter(t => t.normalized && formsSet.has(t.normalized));
    const hits = matchingTokens.length;

    // Update guessed set & history: reveal the word and all its conjugations
    const nextGuessed = new Set(guessedWords);
    forms.forEach(w => nextGuessed.add(w));
    setGuessedWords(nextGuessed);

    const newEntry: GuessEntry = {
      guessNum: guessHistory.length + 1,
      word: normalized,
      hits,
      timestamp: Date.now(),
      conjugations: forms.length > 1 ? forms : undefined
    };
    setGuessHistory(prev => [...prev, newEntry]);

    if (hits > 0) {
      const otherForms = forms.filter(f => f !== normalized);
      const conjugationsNote = otherForms.length > 0 ? ` (+${otherForms.join(', ')})` : '';
      setFeedback({
        message: `Hit! "${normalized}"${conjugationsNote} appeared ${hits} time${hits > 1 ? 's' : ''}.`,
        type: 'success'
      });

      // Immediately place revealed words into the active highlighted state
      const firstTarget = matchingTokens[0];
      setActiveCycleWord(normalized);
      setActiveCycleIndex(0);
      setActiveTokenId(firstTarget.id);

      setTimeout(() => {
        const el = document.getElementById(firstTarget.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 70);
    } else {
      setFeedback({
        message: `Zero hits for "${normalized}".`,
        type: 'error'
      });
    }

    // Check Win Condition: Are all non-stop title words revealed?
    const titleWords = titleTokens.filter(t => t.type === 'word' && !t.isStopWord);
    const allTitleSolved = titleWords.length > 0 && titleWords.every(t =>
      t.normalized && (nextGuessed.has(t.normalized) || formsSet.has(t.normalized))
    );

    if (allTitleSolved) {
      setIsGameOver(true);
      setIsWon(true);
      if (timerRef.current) window.clearInterval(timerRef.current);
      try {
        localStorage.removeItem('fandom_active_puzzle');
        localStorage.removeItem('fandom_save_' + currentArticle.id);
      } catch (e) {}

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 }
        });
      } catch (e) {}
      setFeedback({
        message: `Honor Restored! You solved "${currentArticle.title}" from ${currentFandom.name}! Full article unmasked below!`,
        type: 'success'
      });
    }
  };

  // Give Up
  const handleGiveUp = () => {
    setIsGameOver(true);
    setIsWon(false);
    if (timerRef.current) window.clearInterval(timerRef.current);
    try {
      localStorage.removeItem('fandom_active_puzzle');
      localStorage.removeItem('fandom_save_' + currentArticle.id);
    } catch (e) {}
    setFeedback({
      message: `Revealed! The article was "${currentArticle.title}" from ${currentFandom.name}. Full article unmasked below!`,
      type: 'warn'
    });
  };

  // Fetch New Random Article (from target fandom or randomly from selected fandoms)
  const handleFetchRandom = async (targetFandom?: FandomConfig) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('fandom_active_puzzle');
    } catch (e) {}

    // Pick fandom from pool
    let chosenFandom = targetFandom;
    if (!chosenFandom) {
      const activeFandoms = SUPPORTED_FANDOMS.filter(f => selectedFandomIds.includes(f.id));
      const pool = activeFandoms.length > 0 ? activeFandoms : SUPPORTED_FANDOMS;
      chosenFandom = pool[Math.floor(Math.random() * pool.length)];
    }

    setCurrentFandom(chosenFandom);

    setFeedback({
      message: 'Fetching a random article...',
      type: 'info'
    });

    try {
      let article: Article;
      const curatedList = CURATED_ARTICLES_BY_FANDOM[chosenFandom.id];
      if (curatedList && curatedList.length > 0) {
        const randTitle = curatedList[Math.floor(Math.random() * curatedList.length)];
        article = await fetchWikiArticle(randTitle, chosenFandom.apiDomain);
      } else {
        article = await fetchRandomWikiArticle(chosenFandom.apiDomain);
      }
      article.fandomId = chosenFandom.id;

      loadArticle(article, chosenFandom);
      setFeedback({
        message: 'New secret article loaded! All title words and lore are redacted. Good luck!',
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({
        message: `Wiki Notice: ${err.message || 'API request failed'}. Please try again.`,
        type: 'warn'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Custom Article or URL
  const handleFetchCustom = async (input: string) => {
    setIsLoading(true);
    try {
      localStorage.removeItem('fandom_active_puzzle');
    } catch (e) {}

    let domain = currentFandom.apiDomain;
    let title = input.trim();
    let matchedFandom = currentFandom;

    if (/https?:\/\//i.test(title)) {
      try {
        const parsed = new URL(title);
        domain = parsed.hostname;
        const found = SUPPORTED_FANDOMS.find(f => f.apiDomain === parsed.hostname);
        if (found) {
          matchedFandom = found;
          setCurrentFandom(found);
        }
        const pathSegments = parsed.pathname.split('/').filter(Boolean);
        const wikiIdx = pathSegments.indexOf('wiki');
        if (wikiIdx !== -1 && pathSegments[wikiIdx + 1]) {
          title = decodeURIComponent(pathSegments[wikiIdx + 1]).replace(/_/g, ' ');
        }
      } catch (e) {}
    }

    setFeedback({
      message: `Loading article...`,
      type: 'info'
    });

    try {
      const article = await fetchWikiArticle(title, domain);
      article.fandomId = matchedFandom.id;
      loadArticle(article, matchedFandom);
      setFeedback({
        message: 'Article loaded and redacted! Enter your guesses to reveal words.',
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({
        message: `Error loading article: ${err.message || 'Page not found'}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load on startup: resumes current in-progress puzzle if refreshing
  useEffect(() => {
    // Clear out any old shared bug keys
    try {
      localStorage.removeItem('fandom_save_FANDOM-LIVE');
    } catch (e) {}

    const initApp = async () => {
      try {
        const raw = localStorage.getItem('fandom_active_puzzle');
        if (raw) {
          const active = JSON.parse(raw);
          if (active && active.title) {
            const foundFandom = SUPPORTED_FANDOMS.find(f => f.id === active.fandomId) || currentFandom;
            if (foundFandom.id !== currentFandom.id) {
              setCurrentFandom(foundFandom);
            }
            setIsLoading(true);
            const article = await fetchWikiArticle(active.title, active.domain || foundFandom.apiDomain);
            article.fandomId = foundFandom.id;
            loadArticle(article, foundFandom);
            setIsLoading(false);
            return;
          }
        }
      } catch (e) {
        setIsLoading(false);
      }
      handleFetchRandom();
    };

    initApp();
  }, []);

  // Active Occurrence Info & Forms
  const activeCycleForms = useMemo(() => {
    if (!activeCycleWord) return null;
    return new Set(getWordConjugations(activeCycleWord));
  }, [activeCycleWord]);

  const cycleInfo = useMemo(() => {
    if (!activeCycleWord || !activeCycleForms) return null;
    const matches = allWordTokens.filter(t => t.normalized && activeCycleForms.has(t.normalized) && !t.isRedacted);
    if (matches.length === 0) return null;
    return {
      current: activeCycleIndex + 1,
      total: matches.length
    };
  }, [activeCycleWord, activeCycleForms, activeCycleIndex, allWordTokens]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0d13] text-[#ded6c5]">
      {/* Top Navigation */}
      <Header
        currentFandom={currentFandom}
        selectedFandomIds={selectedFandomIds}
        fandoms={SUPPORTED_FANDOMS}
        onToggleFandom={(id) => {
          setSelectedFandomIds(prev =>
            prev.includes(id)
              ? prev.filter(fId => fId !== id)
              : [...prev, id]
          );
        }}
        onSelectAllFandoms={() => {
          setSelectedFandomIds(SUPPORTED_FANDOMS.map(f => f.id));
        }}
        onSelectOnlyFandom={(id) => {
          const found = SUPPORTED_FANDOMS.find(f => f.id === id);
          setSelectedFandomIds([id]);
          if (found) {
            setCurrentFandom(found);
            handleFetchRandom(found);
          }
        }}
        onFetchNewRandom={() => handleFetchRandom()}
        onFetchCustom={handleFetchCustom}
        isLoading={isLoading}
        onGiveUp={handleGiveUp}
        isGameOver={isGameOver}
      />

      {/* Main Game Interface */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Article Viewer (Left 8 Columns) */}
        <ArticleView
          article={currentArticle}
          titleTokens={titleTokens}
          sectionTokens={sectionTokens}
          activeWord={activeCycleWord}
          activeWordForms={activeCycleForms}
          activeTokenId={activeTokenId}
          totalWords={totalWords}
          redactedWords={redactedWords}
          formattedTime={formattedTime}
          isGameOver={isGameOver}
          isWon={isWon}
          totalGuesses={guessHistory.length}
          accuracy={accuracy}
          onNextArticle={() => handleFetchRandom()}
          cycleInfo={cycleInfo}
          currentFandom={currentFandom}
          selectedFandomCount={selectedFandomIds.length}
        />

        {/* Side Console & History Panel (Right 4 Columns) */}
        <aside className="lg:col-span-4 space-y-4">
          <GuessConsole
            onGuess={handleGuess}
            feedback={feedback}
            guessCount={guessHistory.length}
            hitCount={successfulGuesses}
            accuracy={accuracy}
            disabled={isGameOver || currentArticle.id === 'INITIAL'}
          />

          <GuessHistory
            history={guessHistory}
            onSelectWord={cycleWordMatches}
            activeWord={activeCycleWord}
          />
        </aside>
      </main>
    </div>
  );
};
