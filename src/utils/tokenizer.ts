import { Token } from '../types';
import { STOP_WORDS } from '../data/stopWords';
import nlp from 'compromise';

export function cleanWord(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Returns the word and any verb conjugations / inflections found via compromise
 */
export function getWordConjugations(rawWord: string): string[] {
  const norm = cleanWord(rawWord);
  if (!norm) return [];

  const results = new Set<string>([norm]);

  const addTerm = (term?: string) => {
    if (!term) return;
    term.toLowerCase().split(/\s+/).forEach(part => {
      const cleaned = cleanWord(part);
      if (cleaned && cleaned.length >= 2) {
        results.add(cleaned);
      }
    });
  };

  // Check conjugations via compromise
  let conjList: any[] = nlp(norm).verbs().conjugate();
  if (!conjList.length) {
    conjList = nlp('they ' + norm).verbs().conjugate();
  }
  if (!conjList.length) {
    conjList = nlp('to ' + norm).verbs().conjugate();
  }
  if (!conjList.length && (norm.endsWith('ed') || norm.endsWith('t') || norm.endsWith('d'))) {
    conjList = (nlp(norm) as any).tag('PastTense').verbs().conjugate();
  }
  if (!conjList.length && norm.endsWith('ing')) {
    conjList = (nlp(norm) as any).tag('Gerund').verbs().conjugate();
  }
  if (!conjList.length && norm.endsWith('s')) {
    conjList = (nlp(norm) as any).tag('PresentTense').verbs().conjugate();
  }

  for (const c of conjList) {
    addTerm(c.Infinitive);
    addTerm(c.PastTense);
    addTerm(c.PresentTense);
    addTerm(c.Gerund);
    addTerm(c.Participle);
  }

  return Array.from(results);
}

export function tokenizeText(
  rawText: string,
  isTitle = false,
  isHeading = false,
  guessedWords: Set<string> = new Set(),
  isGameOver = false
): Token[] {
  const regex = /([\p{L}\p{N}]+|[^\p{L}\p{N}\s]+|\s+)/gu;
  const tokens: Token[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawText)) !== null) {
    const text = match[0];
    if (/^\s+$/.test(text)) {
      tokens.push({
        id: 'ws_' + Math.random().toString(36).substring(2, 9),
        type: 'whitespace',
        raw: text
      });
    } else if (/^[\p{L}\p{N}]+$/u.test(text)) {
      const norm = cleanWord(text);
      const isStop = (!isTitle && !isHeading) && STOP_WORDS.has(norm);
      const isRevealed = isGameOver || isStop || guessedWords.has(norm);

      tokens.push({
        id: 'tok_' + Math.random().toString(36).substring(2, 11),
        type: 'word',
        raw: text,
        normalized: norm,
        length: Array.from(text).length,
        isRedacted: !isRevealed,
        isStopWord: isStop,
        isTitle,
        isHeading
      });
    } else {
      tokens.push({
        id: 'punct_' + Math.random().toString(36).substring(2, 9),
        type: 'punct',
        raw: text
      });
    }
  }

  return tokens;
}
