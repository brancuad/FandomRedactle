import { FandomConfig } from '../types';

export const SUPPORTED_FANDOMS: FandomConfig[] = [
  {
    id: 'atla',
    name: 'Avatar (ATLA)',
    icon: '气',
    apiDomain: 'avatar.fandom.com',
    themeBadge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    tagline: 'Water. Earth. Fire. Air. The complete lore encyclopedia.'
  },
  {
    id: 'bbus',
    name: 'Big Brother (US)',
    icon: '👁️',
    apiDomain: 'bigbrother.fandom.com',
    themeBadge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    tagline: 'Expect the unexpected. Houseguests, blindsides, and seasons (US).'
  },
  {
    id: 'bbcan',
    name: 'Big Brother Canada',
    icon: '🍁',
    apiDomain: 'bigbrother.fandom.com',
    themeBadge: 'bg-red-500/10 text-red-400 border-red-500/30',
    tagline: 'The Great White North house. Houseguests, twists, and seasons (BBCAN).'
  },
  {
    id: 'pokemon',
    name: 'Pokémon',
    icon: '⚡',
    apiDomain: 'pokemon.fandom.com',
    themeBadge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    tagline: "Gotta catch 'em all! Creatures, trainers, and regions."
  },
  {
    id: 'kingdomhearts',
    name: 'Kingdom Hearts',
    icon: '🗝️',
    apiDomain: 'kingdomhearts.fandom.com',
    themeBadge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    tagline: 'May your heart be your guiding key. Lore, Keyblades, and worlds.'
  },
  {
    id: 'finalfantasy',
    name: 'Final Fantasy',
    icon: '⚔️',
    apiDomain: 'finalfantasy.fandom.com',
    themeBadge: 'bg-blue-600/10 text-blue-400 border-blue-500/30',
    tagline: 'Crystals, summons, chocobos, and legendary heroes.'
  },
  {
    id: 'amazingrace',
    name: 'The Amazing Race',
    icon: '✈️',
    apiDomain: 'amazingrace.fandom.com',
    themeBadge: 'bg-amber-600/10 text-amber-400 border-amber-600/30',
    tagline: 'The world is waiting for you. Detours, Roadblocks, and Pit Stops.'
  },
  {
    id: 'broadway',
    name: 'Broadway',
    icon: '🎭',
    apiDomain: 'broadway.fandom.com',
    themeBadge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    tagline: 'The bright lights of theatre: musicals, legends, and showstoppers.'
  },
  {
    id: 'disney',
    name: 'Disney',
    icon: '🏰',
    apiDomain: 'disney.fandom.com',
    themeBadge: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    tagline: 'When you wish upon a star. Animated classics, Pixar, and legends.'
  },
  {
    id: 'glee',
    name: 'Glee',
    icon: '🎤',
    apiDomain: 'glee.fandom.com',
    themeBadge: 'bg-red-500/10 text-red-400 border-red-500/30',
    tagline: "Don't Stop Believin'. New Directions, showstoppers, slushies, and McKinley High."
  }
];
