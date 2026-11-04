import { STARTER_DECK } from './catalog.js';

const themes: readonly [string, readonly string[]][] = [
  ['Hammy Gang', ['hammy-gang', 'squeek', 'gsqueek', 'squeektoshi-sleeping']],
  ['Wheel Engine', ['genesis-seed', 'wheely-overclock', 'firmware-upgrade', 'nocturnal', 'marathon', 'night-owl']],
  ['Burrow Guard', ['bedding-fort', 'ball-up', 'burrow', 'rolling-median', 'cage-climb', 'fluff-up', 'sunflower-stash']],
  ['Chain Runner', ['double-lap', 'wheel-brake', 'freeze-for-mint', 'wagmi', 'gm', 'seed-snack']],
  ['Zero-Cost Zoomies', ['maus-mode', 'tail-whip', 'sniff', 'oracle-ping', 'ser', 'sleep-cam', 'touch-grass']],
  ['Burst Sprint', ['peak-rpm', 'gas-war', 'ape-in', 'full-moon-run', 'overrun', 'wood-chew', 'burst-sprint', 'moar']],
  ['Multiplier Lab', ['settlement', 'wen-mint', 'lfg', 'aura-farm', 'spacetime-fold', 'rug-pull']],
];
const starter = new Set(STARTER_DECK);

/** Display metadata comes from the verified final deck, never a submitted label. */
export function deckTheme(deck: readonly { id: string }[]): string {
  const additions = deck.filter(card => !starter.has(card.id));
  if (!additions.length) return 'Starter Wheel';
  let result = 'Mixed Seeds';
  let best = 0;
  for (const [name, ids] of themes) {
    const count = additions.filter(card => ids.includes(card.id)).length;
    if (count > best) { result = name; best = count; }
  }
  return result;
}
