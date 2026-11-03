import { ATLA_CURATED_ARTICLES } from './atla500Articles';
import { BIG_BROTHER_CURATED_ARTICLES } from './bigBrotherArticles';
import { POKEMON_CURATED_ARTICLES } from './pokemonArticles';
import { KINGDOM_HEARTS_CURATED_ARTICLES } from './kingdomHeartsArticles';
import { FINAL_FANTASY_CURATED_ARTICLES } from './finalFantasyArticles';
import { AMAZING_RACE_CURATED_ARTICLES } from './amazingRaceArticles';
import { BROADWAY_CURATED_ARTICLES } from './broadwayArticles';
import { DISNEY_CURATED_ARTICLES } from './disneyArticles';

export const CURATED_ARTICLES_BY_FANDOM: Record<string, string[]> = {
  atla: ATLA_CURATED_ARTICLES,
  bigbrother: BIG_BROTHER_CURATED_ARTICLES,
  pokemon: POKEMON_CURATED_ARTICLES,
  kingdomhearts: KINGDOM_HEARTS_CURATED_ARTICLES,
  finalfantasy: FINAL_FANTASY_CURATED_ARTICLES,
  amazingrace: AMAZING_RACE_CURATED_ARTICLES,
  broadway: BROADWAY_CURATED_ARTICLES,
  disney: DISNEY_CURATED_ARTICLES
};
