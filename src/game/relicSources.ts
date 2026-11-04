import { RELICS } from './catalog.js';

/** Player-facing acquisition rules shared by the Codex and relic details. */
export function relicHowToGet(id: string): string {
  if (!RELICS[id]) return '';
  if (id === 'midnight-wheel') return 'Starting relic: yours at the beginning of every run.';
  return 'Win an elite or boss fight, or open a Treasure room, for a guaranteed random relic you do not own. Each act has one Treasure room. Shops offer 2 different unowned relics to buy (1 if only one remains). All unowned relics have equal odds; rarity only changes shop price.';
}
