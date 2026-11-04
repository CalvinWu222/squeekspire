export const POLICY_NAMES = ['score-greedy', 'survival', 'random', 'clear-focused'];

export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 2 ** 32; };
}

const alive = s => s.combat?.enemies.filter(e => e.hp > 0) ?? [];
const enemyHp = s => alive(s).reduce((sum, e) => sum + e.hp + e.block, 0);
const incoming = s => alive(s).reduce((sum, e) => sum + (e.intent.type === 'attack' ? e.intent.damage * e.intent.times : 0), 0);
const exposure = s => Math.max(0, incoming(s) - (s.combat?.block ?? 0));
const scorePowers = new Set(['night-owl', 'genesis-seed', 'wheely-overclock', 'maus-mode', 'marathon', 'aura-farm', 'hammy-gang']);

function cardRating(game, id, policy, s) {
  const def = game.CARDS[id];
  const normal = {
    'tail-whip': 13, 'ser': 15, 'gas-war': 21, 'buildooooor': 16, 'burst-sprint': 12,
    'double-lap': 12, 'pellet-toss': s.deck.some(c => c.id === 'pellet-toss') ? 8 : 15,
    'wood-chew': 9, 'block-reward': 12, 'bedding-fort': 11, 'cage-climb': 14,
    'wheel-brake': 9, 'ball-up': 7, 'sunflower-stash': 12, 'water-bottle': 10,
    'touch-grass': 30, 'seed-snack': 14, 'sniff': 7, '3am-dash': 11,
    'squeek': 10, 'wheel-spin': 8, 'full-moon-run': 9, 'ape-in': 7,
    'nocturnal': 7, 'moar': 7, 'overrun': 4, 'insomnia': -6,
    'gm': 7, 'gsqueek': 8, 'squeektoshi-sleeping': 4, 'sleep-cam': 0,
    'fluff-up': 7, 'burrow': 4, 'settlement': 9, 'oracle-ping': 5,
    'rolling-median': 2, 'exit-liquidity': 5,
  };
  let rating = normal[id] ?? (def.type === 'curse' ? -50 : scorePowers.has(id) ? -1 : -3);
  if (policy === 'score-greedy') {
    if (scorePowers.has(id)) rating += 25;
    if (['wen-mint', 'gud-tek', 'freeze-for-mint', 'lfg', 'wagmi', 'ape-in', 'full-moon-run'].includes(id)) rating += 20;
    if (['ser', 'bedding-fort', 'rolling-median', 'water-bottle'].includes(id)) rating += 4;
  }
  if (id === 'squeektoshi-sleeping' && s.day.hibernation) rating += 10;
  if (id === 'oracle-ping' && !s.deck.some(c => ['pellet-toss', 'oracle-ping'].includes(c.id))) rating += 5;
  const copies = s.deck.filter(c => c.id === id).length;
  if (copies > 1) rating -= copies * 3;
  return rating;
}

function rewardChoice(game, s, policy, random) {
  if (!s.reward.cards.length) return { type: 'reward', cardId: null };
  if (policy === 'random') return { type: 'reward', cardId: [...s.reward.cards, null][Math.floor(random() * (s.reward.cards.length + 1))] };
  const choices = s.reward.cards.map(id => ({ id, rating: cardRating(game, id, policy, s) })).sort((a, b) => b.rating - a.rating);
  return { type: 'reward', cardId: choices[0].rating >= (s.deck.length >= 18 ? 12 : 6) ? choices[0].id : null };
}

/** Every candidate is an ordinary player action accepted by the actual reducer. */
export function legalPlays(game, s) {
  const result = [];
  for (const card of s.combat.hand) {
    if (game.cardPlayDisabledReason(s, card)) continue;
    const action = { type: 'play', uid: card.uid };
    if (card.id === 'oracle-ping') {
      const options = game.oracleDrawOptions(s);
      if (options.length) action.choice = options.map((c, index) => ({ index, value: cardRating(game, c.id, 'clear-focused', s) })).sort((a, b) => b.value - a.value)[0].index;
    }
    if (card.id === 'gud-tek') {
      const choices = s.combat.hand.filter(c => c.uid !== card.uid).map((c, index) => ({ c, index })).filter(({ c }) => c.level || game.isCardUpgradable(c));
      if (!choices.length) continue;
      action.choice = choices.sort((a, b) => cardRating(game, b.c.id, 'clear-focused', s) + b.c.level * 4 - cardRating(game, a.c.id, 'clear-focused', s) - a.c.level * 4)[0].index;
    }
    if (card.id === 'merge') {
      if (s.mergeActs.includes(s.map[s.currentNode].act)) continue;
      const candidates = game.mergeCandidates(s);
      if (!candidates.length) continue;
      action.mergePair = candidates[0].pair;
    }
    if (game.CARDS[card.id].type === 'attack' || card.id === 'exit-liquidity') {
      // A single target per copy is enough for the policies; choose exposed lowest HP.
      action.target = [...alive(s)].sort((a, b) => a.hp + a.block - b.hp - b.block)[0]?.uid;
    }
    result.push({ action, card });
  }
  return result;
}

function chooseCombat(game, s, policy, random) {
  // A policy decision budget keeps legal zero-cost draw/energy loops finite.
  // This ends the turn through the reducer, rather than changing game state.
  if (s.combat.turnCards.length >= 40) return { type: 'endTurn' };
  const plays = legalPlays(game, s);
  if (policy === 'random') return random() < 0.08 || !plays.length ? { type: 'endTurn' } : plays[Math.floor(random() * plays.length)].action;
  const c = s.combat;
  const stall = policy === 'score-greedy' && c.turn < 25 && s.hp > 16;
  let best = { action: { type: 'endTurn' }, value: 0.01 };
  for (const { action, card } of plays) {
    const def = game.CARDS[card.id];
    const next = game.act(s, action);
    const cost = game.cardValues(card, s).cost;
    const damage = enemyHp(s) - enemyHp(next);
    const killed = alive(s).length - alive(next).length;
    const prevented = exposure(s) - exposure(next);
    const hp = next.hp - s.hp;
    const handGain = (next.combat?.hand.length ?? 0) - c.hand.length + 1;
    const won = next.phase === 'won' || next.phase === 'reward';
    let value = damage * (policy === 'clear-focused' ? 1.45 : 1.05)
      + prevented * (s.hp < 25 ? 2.4 : policy === 'survival' ? 1.9 : 1.35)
      + killed * 3 + hp * (s.hp < 30 ? 3 : 1.7) + handGain * 3;
    // Weak continues to protect beyond this turn; Vulnerable enables later attacks.
    const target = alive(s).find(e => e.uid === action.target);
    if (card.id === 'tail-whip' && target && !target.weak) value += 4;
    if (card.id === '3am-dash' && target && !target.vulnerable) value += Math.min(8, target.hp / 6);
    if (card.id === 'sunflower-stash') value += 3;
    if (card.id === 'settlement') value += c.turn < 5 ? 9 : 4;
    if (card.id === 'insomnia') value += s.hp > 40 && c.turn < 3 ? 2 : -8;
    if (card.id === 'nocturnal' && s.map[s.currentNode].jackpot) value += 18;
    if (card.id === 'rolling-median') value += c.turn < 3 ? 4 : 0;
    if (card.id === 'oracle-ping') value += alive(s).some(e => e.id === 'sybil-swarm') ? 40 : 1;
    if (card.id === 'merge') value += 4;
    if (card.id === 'gud-tek') value += 4;
    if (card.id === 'touch-grass' && s.hp > s.maxHp * 0.65) value -= 60;
    if (card.id === 'ngmi') value -= 3;
    if (won) value += stall ? -100 : 50;
    if (stall) {
      const rawBefore = Math.log1p(game.scoreBattle(s));
      const rawAfter = Math.log1p(game.scoreBattle(next));
      value += Math.max(-15, Math.min(20, (rawAfter - rawBefore) * 12));
      if (scorePowers.has(card.id)) value += 18;
      if (['wen-mint', 'gud-tek', 'freeze-for-mint', 'lfg', 'wagmi'].includes(card.id)) value += 12;
      // Deliberately leave a living target while the engine keeps score growing.
      if (def.type === 'attack' && enemyHp(s) < 30) value -= 30;
      value += prevented * 0.8;
    }
    // Prefer efficient cards, with free cards and draw resolved before X spenders.
    value = value / (0.65 + cost * 0.65);
    if (cost === 0 && value > 0) value += 2;
    if (value > best.value) best = { action, value };
  }
  return best.action;
}

function chooseRoute(s, policy, random) {
  if (policy === 'random') return s.reachable[Math.floor(random() * s.reachable.length)];
  const preference = n => {
    const weights = { treasure: 28, rest: s.hp < 50 ? 32 : 12, shop: s.gold >= 50 ? 17 : 4, event: 18, battle: 1, elite: -12, boss: 0 };
    let value = weights[n.kind];
    if (policy === 'score-greedy') value += n.kind === 'battle' ? 10 : n.kind === 'elite' && s.hp > 40 ? 8 : 0;
    if (n.jackpot && policy === 'score-greedy') value += 15;
    // Count a nearby healing room rather than accidentally skipping it.
    return value;
  };
  return [...s.reachable].sort((a, b) => preference(s.map[b]) - preference(s.map[a]) || b - a)[0];
}

export function chooseAction(game, s, policy, random) {
  if (s.phase === 'combat') return chooseCombat(game, s, policy, random);
  if (s.phase === 'map') return { type: 'enter', nodeId: chooseRoute(s, policy, random) };
  if (s.phase === 'reward') return rewardChoice(game, s, policy, random);
  if (s.phase === 'event') return { type: 'event', option: policy === 'random' ? Math.floor(random() * 2) : 1 };
  if (s.phase === 'rest') {
    const upgrade = s.deck.filter(c => game.isCardUpgradable(c)).sort((a, b) => {
      const rating = c => cardRating(game, c.id, policy, s) + (c.id === 'wheel-kick' ? 11 : c.id === 'cheek-pouch' ? 4 : 0);
      return rating(b) - rating(a);
    })[0];
    return s.hp < (policy === 'survival' ? 65 : 55) || !upgrade || policy === 'random' && random() < 0.5
      ? { type: 'rest', option: 'heal' } : { type: 'rest', option: 'upgrade', uid: upgrade.uid };
  }
  if (s.phase === 'shop') {
    const offers = s.shop.offers.map((offer, index) => ({ offer, index, rating: offer.kind === 'card' ? cardRating(game, offer.id, policy, s) : ({ wheely9000: 24, 'sunflower-wheel': 20, 'diamond-hands': 18, 'pillhead': policy === 'score-greedy' ? 25 : 5 }[offer.id] ?? 2) })).filter(({ offer, rating }) => !offer.sold && offer.price <= s.gold && rating >= 9);
    if (offers.length && (policy !== 'random' || random() < 0.7)) return { type: 'buy', index: offers.sort((a, b) => b.rating / b.offer.price - a.rating / a.offer.price)[0].index };
    const remove = s.deck.filter(c => game.CARDS[c.id].type === 'curse' || c.id === 'cheek-pouch' && s.deck.length > 13 && s.deck.filter(k => game.CARDS[k.id].block).length > 4).sort((a, b) => game.CARDS[a.id].type === 'curse' ? -1 : 1)[0];
    if (remove && s.gold >= s.shop.removePrice && policy !== 'random') return { type: 'remove', uid: remove.uid };
    return { type: 'leave' };
  }
  throw new Error(`Unexpected phase ${s.phase}`);
}
