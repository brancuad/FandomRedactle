export interface ArticleSection {
  heading: string | null;
  paragraphs: string[];
}

export interface Article {
  id: string;
  title: string;
  sections: ArticleSection[];
  fandomId?: string;
  imageUrl?: string;
}

export type TokenType = 'word' | 'punct' | 'whitespace';

export interface Token {
  id: string;
  type: TokenType;
  raw: string;
  normalized?: string;
  length?: number;
  isRedacted?: boolean;
  isStopWord?: boolean;
  isTitle?: boolean;
  isHeading?: boolean;
}

export interface GuessEntry {
  guessNum: number;
  word: string;
  hits: number;
  timestamp: number;
  conjugations?: string[];
}

export interface FandomConfig {
  id: string;
  name: string;
  icon: string;
  apiDomain: string;
  themeBadge: string;
  tagline: string;
  /** Whether to fetch articles from Wikipedia instead of a Fandom wiki. Defaults to 'fandom'. */
  sourceType?: 'fandom' | 'wikipedia';
}
