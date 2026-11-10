import { BIG_BROTHER_US_CURATED_ARTICLES } from './bigBrotherUsArticles';
import { BIG_BROTHER_CAN_CURATED_ARTICLES } from './bigBrotherCanArticles';

/**
 * Combined Big Brother Articles (legacy export for backwards compatibility)
 */
export const BIG_BROTHER_CURATED_ARTICLES: string[] = [
  ...Array.from(new Set([...BIG_BROTHER_US_CURATED_ARTICLES, ...BIG_BROTHER_CAN_CURATED_ARTICLES]))
];
