import { CARDS, CARD_POOL, STARTER_DECK, RELICS, ENEMIES, type CardType, type Rarity } from './catalog.js';
import { nextRandom, hashString } from './rng.js';
import { generateMap } from './map.js';
import { battleScoreBreakdown, runScoreSummary, scoreMultipliers, SCORE_VERSION, type BattleScoreBreakdown } from './score.js';
import type { DayData, MapNode, RunMode } from './types.js';
import { cardValues, isCardUpgradable, mergeCandidates, triggerFactor } from './cardValues.js';

export interface CardInstance { uid: string; id: string; level: number; mergeLevel: number; }
export interface EnemyIntent { type: string; damage: number; times: number; label: string; }
export interface EnemyState { uid: string; id: string; name: string; hp: number; maxHp: number; block: number; strength: number; weak: number; fud?: boolean; vulnerable: number; intent: EnemyIntent; }
interface Pending { kind: 'settlement' | 'wen-mint'; turn: number; baseline: number; }
export interface CombatState {
  hand: CardInstance[]; draw: CardInstance[]; discard: CardInstance[]; exhaust: CardInstance[];
  enemies: EnemyState[]; turn: number; energy: number; block: number; squeeks: number;
  addMult: number; multiply: number; chain: number; chainType: CardType | null; frozenChain: number;
  damageDealt: number; damageTaken: number; turnCards: string[]; powers: Record<string, number>; pending: Pending[];
  nextEnergy: number; skipDraw: boolean; turnMult: number; turnStartMult: number;
  weak: number; fud: boolean; noDamageTurns: number; turnHp: number; attacks: number;
  lastAttackDamage: number; rejected: boolean; stayBonus: number; noAttackTurns: number;
}
export interface ShopOffer { kind: 'card' | 'relic'; id: string; price: number; sold: boolean; }
export interface ShopState { offers: ShopOffer[]; removePrice: number; }
export type RunAction =
  | { type: 'enter'; nodeId: number }
  | { type: 'play'; uid: string; target?: string; choice?: number; mergePair?: [string, string]; prediction?: CardType }
  | { type: 'endTurn' }
  | { type: 'reward'; cardId: string | null }
  | { type: 'buy'; index: number }
  | { type: 'remove'; uid: string }
  | { type: 'rest'; option: 'heal' | 'upgrade'; uid?: string }
  | { type: 'event'; option: 0 | 1 }
  | { type: 'leave' }
  | { type: 'elapsed'; ms: number }
  | { type: 'abandon' };
export interface RunState {
  version: 1; scoreVersion: number; day: DayData; map: MapNode[]; mode: RunMode;
  phase: 'map' | 'combat' | 'reward' | 'shop' | 'rest' | 'event' | 'won' | 'lost';
  floor: number; floorsCleared: number; currentNode: number; reachable: number[]; hp: number; maxHp: number; gold: number;
  deck: CardInstance[]; relics: string[]; combat?: CombatState; reward?: { cards: string[]; relic?: string }; shop?: ShopState;
  totalScore: number; bestHit: number; battles: number; bossKills: number; elapsedMs: number;
  battleScores: BattleScoreBreakdown[]; damageTaken: number;
  log: RunAction[]; hints: string[]; history: string[]; rng: number; serial: number;
  runMult: number; minMult: number; buildCount: number; touchGrassUsed: boolean;
  mergeActs: number[]; removeCount: number; hamsterfiUsed: boolean;
}
export interface RunExport { version: 1; scoreVersion: number; day: DayData; mode: RunMode; actions: RunAction[]; claimedScore: number; claimedBestHit: number; checksum: string; }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const bounded = (n: number) => Math.min(1e300, Math.max(0, Number.isFinite(n) ? n : 1e300));
function fail(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function random(s: RunState) { const r = nextRandom(s.rng); s.rng = r.state; return r.value; }
function pick<T>(s: RunState, items: T[]): T { fail(items.length, 'Empty random pool'); return items[Math.floor(random(s) * items.length)]!; }
function shuffle<T>(s: RunState, items: T[]) { for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random(s) * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; } return items; }
function instance(s: RunState, id: string): CardInstance { fail(CARDS[id], 'Unknown card'); return { uid: `c${++s.serial}`, id, level: 0, mergeLevel: 0 }; }
const node = (s: RunState) => s.map[s.currentNode]!;
const has = (s: RunState, id: string) => s.relics.includes(id);
const living = (s: RunState) => s.combat!.enemies.filter(e => e.hp > 0);
const say = (s: RunState, text: string) => { s.history = [...s.history.slice(-11), text]; };
function loseHp(s: RunState, amount: number, minimum = 0) {
  const lost = Math.min(Math.max(0, s.hp - minimum), Math.max(0, amount));
  s.hp -= lost; s.damageTaken = (s.damageTaken ?? 0) + lost;
  if (s.phase === 'combat' && s.combat) s.combat.damageTaken = (s.combat.damageTaken ?? 0) + lost;
}
function hint(s: RunState, name: string, text: string) { if (!s.hints.some(h => h.startsWith(name + ':'))) { s.hints.push(`${name}: ${text}`); say(s, `Secret combo · ${name}`); } }
function trigger(s: RunState, factor: number) { s.combat!.multiply = bounded(s.combat!.multiply * triggerFactor(s, factor)); }
export function effectiveMult(s: RunState): number {
  return scoreMultipliers(s).multiplier;
}
export function scoreBattle(s: RunState): number { return s.combat ? Math.round(bounded(s.combat.squeeks * effectiveMult(s))) : 0; }
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '1e300';
  if (value >= 1e15) return value.toExponential(2).replace('e+', 'e');
  const units = ['', 'K', 'M', 'B', 'T'];
  const group = Math.max(0, Math.min(4, Math.floor(Math.log10(Math.max(1, Math.abs(value))) / 3)));
  return group ? `${(value / 1000 ** group).toFixed(value / 1000 ** group >= 100 ? 0 : 2).replace(/\.0+$|(?<=\.[0-9])0$/, '')}${units[group]}` : Math.round(value).toLocaleString('en-US');
}
export function createRun(day: DayData, map: MapNode[], mode: RunMode): RunState {
  fail(['daily', 'practice', 'endless'].includes(mode), 'Invalid mode');
  fail(day.hours.length === 24 && Number.isInteger(day.seed) && day.difficulty >= 0.8 && day.difficulty <= 1.3, 'Invalid daily data');
  fail(map.length === 24, 'Map must contain 24 hours');
  const s: RunState = { version: 1, scoreVersion: SCORE_VERSION, day: clone(day), map: clone(map), mode, phase: 'map', floor: 0, floorsCleared: 0, currentNode: -1, reachable: [0], hp: 72, maxHp: 72, gold: 75, deck: [], relics: ['midnight-wheel'], totalScore: 0, bestHit: 0, battles: 0, bossKills: 0, elapsedMs: 0, battleScores: [], damageTaken: 0, log: [], hints: [], history: ['gm, I have not slept'], rng: (day.seed ^ 0x53515545) >>> 0, serial: 0, runMult: 0, minMult: 1, buildCount: 0, touchGrassUsed: false, mergeActs: [], removeCount: 0, hamsterfiUsed: false };
  s.deck = STARTER_DECK.map(id => instance(s, id));
  return s;
}
function draw(s: RunState, count: number) {
  const c = s.combat!;
  for (let i = 0; i < count && c.hand.length < 10; i++) {
    if (!c.draw.length) { c.draw = shuffle(s, c.discard.splice(0)); if (!c.draw.length) break; }
    const card = c.draw.pop()!; c.hand.push(card);
    if (card.id === 'ngmi') c.turnMult -= 1;
    if (card.id === 'nyn-sob') loseHp(s, 2);
  }
}
function prepareOracleDraw(s: RunState) {
  const c = s.combat!;
  // The existing top cards are drawn before a shuffled discard. Materialize that
  // same sequence now so the choice can include all of the next three draws.
  if (c.draw.length < 3 && c.discard.length) c.draw = [...shuffle(s, c.discard.splice(0)), ...c.draw];
}
/** Pure Oracle choices, including the deterministic next discard reshuffle. */
export function oracleDrawOptions(state: RunState): CardInstance[] {
  if (!state.combat) return [];
  const s = clone(state); prepareOracleDraw(s);
  return s.combat!.draw.slice(-3).reverse();
}
function intent(s: RunState, enemy: EnemyState, forcedType?: string): EnemyIntent {
  const definition = ENEMIES[enemy.id]!;
  const type = forcedType ?? definition.pattern[(s.combat!.turn - 1) % definition.pattern.length]!;
  const times = enemy.id === 'squeektoshi' ? 1 + Math.min(2, Math.floor(s.day.peakRpm / 100)) : 1;
  let attack = definition.attack;
  if (!['oracle-judge', 'difficulty-adjuster', 'stale-ghost', 'squeektoshi'].includes(enemy.id)) attack += Math.max(0, node(s).act - 1) * 4;
  const damage = Math.max(0, Math.round((attack + enemy.strength) * (enemy.weak ? 0.75 : 1) * (enemy.fud ? 0.5 : 1) * s.day.difficulty * (s.mode === 'endless' ? 1.15 ** Math.max(0, s.floor - 1) : 1)) - (s.combat!.powers['fluff-up'] ?? 0));
  return { type, damage, times, label: type === 'attack' ? `Attack ${damage}${times > 1 ? ` ×${times}` : ''}` : type === 'reject' ? 'Reject highest-cost card' : type === 'fud' ? 'FUD · next first card ×0.5' : type === 'block' ? 'Gain 8 Block' : 'Gain 2 Strength' };
}
function refreshIntents(s: RunState) { for (const enemy of living(s)) enemy.intent = intent(s, enemy, enemy.intent.type); }
/** Upcoming pattern intents after the currently displayed turn; does not advance the run. */
export function previewIntents(state: RunState, turns = 2): { uid: string; name: string; intents: EnemyIntent[] }[] {
  if (!state.combat) return [];
  const s = clone(state), count = Math.max(0, Math.min(5, Math.floor(turns)));
  const result = living(s).map(enemy => ({ uid: enemy.uid, name: enemy.name, intents: [] as EnemyIntent[] }));
  for (let turn = 0; turn < count; turn++) {
    const fold = s.combat!.powers['spacetime-fold'] && !s.combat!.powers['fold-used'] && living(s).every(enemy => enemy.intent.type !== 'attack');
    if (fold) s.combat!.powers['fold-used'] = 1;
    else for (const enemy of living(s)) {
        if (enemy.intent.type === 'attack') enemy.fud = false;
        if (enemy.intent.type === 'buff') enemy.strength += 2;
        if (enemy.id === 'queue-snake') enemy.strength++;
        enemy.weak = Math.max(0, enemy.weak - 1);
      }
    delete s.combat!.powers['fluff-up'];
    s.combat!.turn++;
    for (const enemy of living(s)) {
      enemy.intent = intent(s, enemy);
      result.find(item => item.uid === enemy.uid)!.intents.push(enemy.intent);
    }
  }
  return result;
}
/** Revealed absolute turns stay visible until their enemy actions have resolved. */
export function revealedIntents(state: RunState): { uid: string; name: string; intents: { turn: number; intent: EnemyIntent }[] }[] {
  if (!state.combat) return [];
  const c = state.combat, camera = has(state, 'live-camera');
  const from = c.powers['sleep-cam-from'] ?? Infinity;
  const until = c.powers['sleep-cam-until'] ?? 0;
  const future = camera || until > c.turn ? previewIntents(state, 2) : [];
  return living(state).map(enemy => {
    const intents: { turn: number; intent: EnemyIntent }[] = [];
    if (from <= c.turn && c.turn <= until) intents.push({ turn: c.turn, intent: clone(enemy.intent) });
    for (const [index, intent] of (future.find(item => item.uid === enemy.uid)?.intents ?? []).entries()) {
      const turn = c.turn + index + 1;
      if (camera || from <= turn && turn <= until) intents.push({ turn, intent });
    }
    return { uid: enemy.uid, name: enemy.name, intents };
  }).filter(enemy => enemy.intents.length);
}
function startTurn(s: RunState, first = false) {
  const c = s.combat!;
  if (!first) c.turn++;
  c.chain = 0; c.chainType = null; c.turnCards = []; c.turnMult = 0;
  c.energy = Math.max(0, 3 + c.nextEnergy + (s.mode === 'practice' && s.day.spinning ? 1 : 0) + (has(s, 'sunflower-wheel') && node(s).jackpot ? 1 : 0));
  c.nextEnergy = 0;
  c.block = first ? 0 : c.powers['rolling-median'] ? Math.floor(c.block * 0.5) : 0;
  if (first && has(s, 'midnight-wheel')) c.turnMult += 1;
  if (!first) { for (let i = 0; i < (c.powers['genesis-seed'] ?? 0); i++) trigger(s, i < (c.powers['genesis-upgraded'] ?? 0) ? 1.3 : 1.2); for (let i = 0; i < (c.powers['wheely-overclock'] ?? 0); i++) trigger(s, 1 + s.day.peakRpm / (i < (c.powers['overclock-upgraded'] ?? 0) ? 750 : 1000)); }
  c.squeeks = bounded(c.squeeks + (c.powers['night-owl'] ?? 0));
  c.turnHp = s.hp;
  if (!c.skipDraw) draw(s, 5 + (c.powers['insomnia'] ?? 0) + (c.powers['insomnia-upgraded'] ?? 0));
  c.skipDraw = false;
  for (const delayed of c.pending.filter(p => p.turn <= c.turn)) {
    if (delayed.kind === 'settlement') {
      const damage = Math.round(Math.max(0, c.damageDealt - delayed.baseline) * 1.5);
      hit(s, living(s)[0], damage, true);
      say(s, `Settlement paid ${damage} damage.`);
      if (c.rejected) { hit(s, living(s)[0], damage * 2, true); hint(s, 'Double Settlement', 'A rejected delayed settlement paid triple damage.'); }
      s.bestHit = Math.max(s.bestHit, Math.round(bounded(damage * (c.rejected ? 3 : 1) * effectiveMult(s))));
    } else { c.squeeks = bounded(c.squeeks + Math.max(0, c.squeeks - delayed.baseline)); say(s, 'Wen Mint? Accumulated Squeeks doubled.'); }
  }
  c.pending = c.pending.filter(p => p.turn > c.turn);
  for (const e of living(s)) e.intent = intent(s, e);
  c.turnStartMult = effectiveMult(s);
  checkCombat(s);
}
function beginCombat(s: RunState) {
  const n = node(s), definition = ENEMIES[n.enemyId] ?? ENEMIES['queue-snake']!;
  const sybil = definition.id === 'sybil-swarm';
  const actScale = ['oracle-judge', 'difficulty-adjuster', 'stale-ghost', 'squeektoshi'].includes(definition.id) ? 1 : 1 + Math.max(0, n.act - 1) * 0.6;
  const hp = sybil ? 1 : Math.round(definition.hp * actScale * s.day.difficulty * (s.mode === 'endless' ? 1.15 ** Math.max(0, s.floor - 1) : 1));
  s.combat = { hand: [], draw: shuffle(s, clone(s.deck)), discard: [], exhaust: [], enemies: Array.from({ length: sybil ? 5 : 1 }, (_, i) => ({ uid: `e${i}`, id: definition.id, name: definition.name, hp, maxHp: hp, block: 0, strength: 0, weak: 0, vulnerable: 0, intent: { type: 'attack', damage: 0, times: 1, label: '' } })), turn: 1, energy: 3, block: 0, squeeks: 0, addMult: 1 + s.runMult + (has(s, 'aura') ? s.battles * 0.2 : 0), multiply: 1, chain: 0, chainType: null, frozenChain: 1, damageDealt: 0, damageTaken: 0, turnCards: [], powers: {}, pending: [], nextEnergy: 0, skipDraw: false, turnMult: 0, turnStartMult: 1, weak: 0, fud: false, noDamageTurns: 0, turnHp: s.hp, attacks: 0, lastAttackDamage: 0, rejected: false, stayBonus: 0, noAttackTurns: 0 };
  s.phase = 'combat'; startTurn(s, true);
  say(s, `${definition.name} · ${hp}${sybil ? ' ×5' : ''} HP`);
}
function hit(s: RunState, target: EnemyState | undefined, amount: number, count = true) {
  if (!target || target.hp <= 0) return;
  const c = s.combat!, damage = Math.round(Math.max(0, amount) * (target.vulnerable ? 1.5 : 1) * (c.weak ? 0.75 : 1));
  const absorbed = Math.min(target.block, damage); target.block -= absorbed;
  const dealt = Math.max(0, damage - absorbed); target.hp = Math.max(0, target.hp - dealt);
  if (count) { c.damageDealt += dealt; c.squeeks = bounded(c.squeeks + amount); }
}
function randomCard(s: RunState, elite = false, shop = false) {
  const roll = random(s), rare = (shop ? 0.09 : elite ? 0.1 : 0.03) + Math.min(0.08, Math.max(0, s.day.rareBonus));
  const rarity: Rarity = roll < rare ? 'rare' : roll < rare + (shop ? 0.37 : elite ? 0.4 : 0.37) ? 'uncommon' : 'common';
  return pick(s, CARD_POOL.filter(id => CARDS[id]!.rarity === rarity));
}
function addRelic(s: RunState, id: string) {
  if (has(s, id)) return;
  s.relics.push(id); say(s, `Relic found: ${RELICS[id]!.name}`);
  if (id === 'genesis') s.deck.push(instance(s, pick(s, CARD_POOL.filter(key => CARDS[key]!.rarity === 'rare'))));
  if (id === 'name-tag' || id === 'probably-nothing') { const cards = s.deck.filter(c => isCardUpgradable(c) && (id === 'name-tag' || CARDS[c.id]!.rarity === 'common')); if (cards.length) pick(s, cards).level = 1; }
}
/** Every unowned relic has equal weight; rarity affects price, never drops. */
function findRelic(s: RunState): string | undefined {
  const pool = Object.keys(RELICS).filter(id => !has(s, id));
  // Settled block metadata directly changes placement without changing odds.
  return pool.length ? pool[(Math.floor(random(s) * pool.length) + s.day.blockHeight + s.day.blockProgress + node(s).id) % pool.length] : undefined;
}
function completeNode(s: RunState) {
  s.floorsCleared = s.floor;
  if (has(s, 'airdrop-farmer')) for (let i = 0; i < (node(s).kind === 'elite' ? 2 : 1); i++) s.deck.push(instance(s, pick(s, CARD_POOL.filter(id => CARDS[id]!.cost === 0))));
  delete s.reward; delete s.shop;
  if (node(s).id === 23 && s.mode !== 'endless') { s.phase = 'won'; say(s, 'Squeektoshi can finally sleep.'); }
  else { s.phase = 'map'; s.reachable = node(s).id === 23 ? [0] : [...node(s).connections]; }
}
function checkCombat(s: RunState) {
  if (s.hp <= 0) { s.phase = 'lost'; say(s, 'The wheel is quiet.'); return; }
  if (s.phase !== 'combat' || living(s).length) return;
  const breakdown = battleScoreBreakdown(s, true);
  s.battleScores.push(breakdown);
  const earned = breakdown.score;
  s.floorsCleared = s.floor; s.battles++;
  if (node(s).id % 8 === 7) s.bossKills++;
  say(s, `Battle won · ${formatNumber(earned)} Squeeks`);
  const elite = node(s).kind === 'elite' || node(s).kind === 'boss';
  s.gold += elite ? 25 + Math.floor(random(s) * 11) : 10 + Math.floor(random(s) * 11);
  const cards: string[] = []; while (cards.length < 3) { const id = randomCard(s, elite); if (!cards.includes(id)) cards.push(id); }
  const relic = elite ? findRelic(s) : undefined;
  if (relic) addRelic(s, relic);
  // The final boss must award its relic before the run changes to won.
  if (node(s).id === 23 && s.mode !== 'endless') { completeNode(s); return; }
  s.reward = { cards, relic }; s.phase = 'reward';
}
function endTurn(s: RunState) {
  const c = s.combat!;
  const attacksThisTurn = c.turnCards.filter(id => CARDS[id]!.type === 'attack').length;
  c.noAttackTurns = attacksThisTurn ? 0 : c.noAttackTurns + 1;
  if (c.noAttackTurns >= 2) for (const pile of [c.hand, c.draw, c.discard]) {
    for (let i = pile.length - 1; i >= 0; i--) if (pile[i]!.id === 'ngmi') c.exhaust.push(...pile.splice(i, 1));
  }
  for (const _curse of c.hand.filter(k => k.id === 'paper-hands')) {
    // Compare each card's immediate scoring outcome with the same current state.
    // Choice cards use their best legal choice; delayed effects have no score yet.
    const candidates = c.hand.filter(k => k.id !== 'paper-hands').map(candidate => {
      let score = -1;
      const oracleOptions = candidate.id === 'oracle-ping' ? oracleDrawOptions(s) : [];
      const choices = candidate.id === 'oracle-ping' && oracleOptions.length ? oracleOptions.map((_, i) => i)
        : candidate.id === 'gud-tek' ? c.hand.filter(k => k.uid !== candidate.uid).map((_, i) => i) : [undefined];
      const pairs = candidate.id === 'merge' ? mergeCandidates(s).map(item => item.pair) : [undefined];
      for (const choice of choices) for (const mergePair of pairs) {
        try {
          const projected = clone(s), cost = CARDS[candidate.id]!.cost;
          // A spent Seed supply must not protect a high-scoring fixed-cost card.
          // X cards continue to use the actual current supply for their formula.
          if (cost !== 'X') projected.combat!.energy = Math.max(projected.combat!.energy, cost);
          play(projected, { type: 'play', uid: candidate.uid, choice, mergePair });
          score = Math.max(score, scoreBattle(projected) - scoreBattle(s));
        } catch { /* Invalid choices or spent once-per-run cards have no immediate score. */ }
      }
      return { card: candidate, score };
    }).sort((a, b) => b.score - a.score);
    if (candidates.length) { const candidate = candidates[0]!.card; c.hand = c.hand.filter(k => k.uid !== candidate.uid); c.discard.push(candidate); }
  }
  if (has(s, 'stay-squeeky') && effectiveMult(s) >= c.turnStartMult && c.stayBonus < 2) { const add = Math.min(0.2, 2 - c.stayBonus); c.addMult += add; c.stayBonus += add; }
  const retained = has(s, 'diamond-hands') && !c.powers.lfg;
  if (retained) c.addMult += c.hand.length * 0.2;
  else c.discard.push(...c.hand.splice(0));
  if (c.powers.insomnia) loseHp(s, 2 * c.powers.insomnia);
  const fold = c.powers['spacetime-fold'] && !c.powers['fold-used'] && living(s).every(e => e.intent.type !== 'attack');
  if (fold) { c.powers['fold-used'] = 1; say(s, 'Spacetime folded: one free turn.'); }
  else for (const e of living(s)) {
    if (e.intent.type === 'attack') { for (let i = 0; i < e.intent.times; i++) { const damage = e.intent.damage; const absorb = Math.min(c.block, damage); c.block -= absorb; loseHp(s, damage - absorb); } e.fud = false; }
    if (e.intent.type === 'block') e.block += 8;
    if (e.intent.type === 'fud' && s.minMult < 1.5) c.fud = true;
    if (e.intent.type === 'buff') e.strength += 2;
    if (e.intent.type === 'reject') {
      // Reject from the next draw too, so non-retained hands do not evade the Oracle.
      const source = retained ? c.hand : c.draw.length ? c.draw : c.discard;
      const rejected = [...source].sort((a, b) => (CARDS[b.id]!.cost === 'X' ? 3 : CARDS[b.id]!.cost as number) - (CARDS[a.id]!.cost === 'X' ? 3 : CARDS[a.id]!.cost as number))[0];
      if (rejected) { source.splice(source.findIndex(k => k.uid === rejected.uid), 1); c.exhaust.push(rejected); c.rejected = true; say(s, `oracle rejected: ${CARDS[rejected.id]!.name}`); }
    }
    if (e.id === 'queue-snake') e.strength++;
    if ((e.id === 'stale-ghost' || e.id === 'stale-sprite') && c.turn % 3 === 0) loseHp(s, 2);
    e.weak = Math.max(0, e.weak - 1); e.vulnerable = Math.max(0, e.vulnerable - 1);
  }
  c.noDamageTurns = s.hp >= c.turnHp ? c.noDamageTurns + 1 : 0;
  if (c.powers['aura-farm'] && c.noDamageTurns && c.noDamageTurns % 3 === 0) { s.runMult += 0.5 * c.powers['aura-farm']; c.addMult += 0.5 * c.powers['aura-farm']; }
  if (c.powers['aura-farm'] && has(s, 'aura') && c.noDamageTurns > 0 && c.noDamageTurns % 3 === 0) { trigger(s, 1.5); hint(s, 'Honest Work', 'Aura Farm and Aura Halo reward a clean three-turn streak.'); }
  delete c.powers.lfg; delete c.powers['fluff-up']; delete c.powers['wild-chain'];
  c.weak = Math.max(0, c.weak - 1);
  checkCombat(s); if (s.phase === 'combat') startTurn(s);
}
function play(s: RunState, action: Extract<RunAction, { type: 'play' }>) {
  const c = s.combat!, index = c.hand.findIndex(k => k.uid === action.uid);
  fail(index >= 0, 'Card is not in hand');
  const card = c.hand[index]!, definition = CARDS[card.id]!;
  if (card.id === 'touch-grass') fail(!s.touchGrassUsed, 'Touch Grass is once per run');
  const discount = c.powers.nocturnal && node(s).jackpot ? 1 : 0;
  const cost = definition.cost === 'X' ? c.energy : Math.max(0, definition.cost - discount);
  fail(c.energy >= cost, 'Not enough Seeds');
  if (action.choice !== undefined) fail(Number.isInteger(action.choice) && action.choice >= 0 && action.choice < 10, 'Invalid card choice');
  const target = action.target ? living(s).find(e => e.uid === action.target) : living(s)[0];
  if (action.target) fail(target, 'Invalid enemy target');
  const choiceCards = c.hand.filter(k => k.uid !== card.uid);
  if (card.id === 'oracle-ping') {
    prepareOracleDraw(s);
    const count = Math.min(3, c.draw.length);
    fail(!count || (action.choice !== undefined && action.choice < count), 'Choose one of the next Oracle draws');
    fail(count > 0 || action.choice === undefined, 'Oracle has no draw to choose');
  }
  if (card.id === 'gud-tek') {
    const chosen = action.choice === undefined ? undefined : choiceCards[action.choice];
    fail(chosen && (chosen.level > 0 || isCardUpgradable(chosen)), 'Choose an upgradable or upgraded card in hand');
  }
  const merge = card.id === 'merge' ? mergeCandidates(s).find(candidate => action.mergePair?.length === 2 && candidate.pair.every(uid => action.mergePair!.includes(uid))) : undefined;
  if (card.id === 'merge') {
    fail(!s.mergeActs.includes(node(s).act), 'Merge already used this act');
    fail(merge, 'Choose two matching equal-level cards to merge');
  }
  const previousChainFactor = Math.pow(1.1 * (node(s).jackpot ? 2 : 1), c.chain);
  const previousMult = effectiveMult(s);
  c.energy -= cost; c.hand.splice(index, 1);
  const before = c.turnCards.length;
  if (card.id !== 'wheel-brake') c.chain = c.chainType === definition.type || c.powers['wild-chain'] ? Math.min(20, c.chain + 1) : 0;
  if (card.id !== 'wheel-brake') c.chainType = definition.type;
  // Transfer before the generic first-card consumption, including a first-card FUD.
  if (card.id === 'exit-liquidity' && target) {
    target.weak += c.weak; target.fud = !!target.fud || c.fud;
    c.weak = 0; c.fud = false;
  }
  if (c.fud && before === 0) { if (card.id !== 'wagmi') trigger(s, 0.5); c.fud = false; }
  if (has(s, 'pillhead') && !c.powers['pillhead-used']) { trigger(s, node(s).jackpot ? 3 : 2); c.powers['pillhead-used'] = 1; }
  if (c.powers['maus-mode'] && cost === 0) c.addMult += c.powers['maus-mode'];
  if (c.powers.lfg) c.turnMult += 0.3 * c.powers.lfg;
  // Compute X-card values before paying, so the resolver and preview use the same X.
  const values = cardValues(card, { ...s, combat: { ...c, energy: cost } });
  let damage = values.rawDamage;
  if (card.id === 'buildooooor') { if (!s.buildCount && has(s, 'early-buildooooor')) s.buildCount += 4; s.buildCount++; }
  if (card.id === 'peak-rpm') c.turnMult += cost;
  if (card.id === 'gas-war') { const x = cost + (node(s).jackpot ? 1 : 0); c.squeeks = bounded(c.squeeks * x * x); }
  if (definition.type === 'attack') {
    if (card.id === 'pellet-toss') for (const e of living(s)) hit(s, e, damage);
    else { hit(s, target, damage); if (card.id === 'double-lap') hit(s, target, damage); }
    c.lastAttackDamage = damage; c.attacks++;
    if (c.powers.marathon && c.attacks % 3 === 0) c.addMult += 0.5 * c.powers.marathon;
    if (card.id === 'block-reward' && target?.hp === 0) s.gold += 15;
  }
  if (definition.block) c.block += values.block;
  switch (card.id) {
    case 'wheel-kick': c.squeeks = bounded(c.squeeks + values.rawDamage); break;
    case '3am-dash': if (target) target.vulnerable += values.vulnerable; break;
    case 'tail-whip': if (target) target.weak += values.weak; break;
    case 'seed-snack': draw(s, values.draw); c.chain = Math.min(20, c.chain + 1); break;
    case 'double-lap': c.chain = Math.min(20, c.chain + 1); break;
    case 'sniff': draw(s, 2); if (c.hand.length) c.discard.push(c.hand.shift()!); break;
    case 'sunflower-stash': c.nextEnergy++; break;
    case 'water-bottle': s.hp = Math.min(s.maxHp, s.hp + values.heal); break;
    case 'squeek': c.turnMult += 0.5; break;
    case 'cage-climb': draw(s, 1); break;
    case 'fluff-up': c.powers['fluff-up'] = (c.powers['fluff-up'] ?? 0) + values.reduction; break;
    case 'settlement': c.pending.push({ kind: 'settlement', turn: c.turn + 3, baseline: c.damageDealt }); break;
    case 'oracle-ping': {
      const count = Math.min(3, c.draw.length), choice = action.choice ?? 0;
      if (count) { const top = c.draw.splice(c.draw.length - count); const chosen = top.splice(top.length - 1 - choice, 1)[0]!; c.draw.push(...top, chosen); say(s, `Oracle: ${[...c.draw].reverse().slice(0, 3).map(k => CARDS[k.id]!.name).join(' → ')}`); }
      for (const e of living(s).filter(e => e.id === 'sybil-swarm')) hit(s, e, e.hp);
      if (c.pending.length) { c.addMult += 1; hint(s, 'Oracle’s Receipt', 'Oracle Ping found a pending settlement: +1 Mult.'); }
      break;
    }
    case 'merge': {
      const first = s.deck.find(k => k.uid === merge!.first.uid)!, second = merge!.second;
      first.mergeLevel++; s.deck = s.deck.filter(k => k.uid !== second.uid);
      for (const pile of [c.hand, c.draw, c.discard, c.exhaust]) { const removed = pile.findIndex(k => k.uid === second.uid); if (removed >= 0) pile.splice(removed, 1); const copy = pile.find(k => k.uid === first.uid); if (copy) copy.mergeLevel = first.mergeLevel; }
      s.mergeActs.push(node(s).act); say(s, `Merged ${CARDS[first.id]!.name} · +10% stats`); break;
    }
    case 'stake': c.skipDraw = true; c.nextEnergy += 2; break;
    case 'full-moon-run': trigger(s, 2); break;
    case 'freeze-for-mint': c.frozenChain = Math.max(c.frozenChain, previousChainFactor); c.powers['frozen-mult'] = Math.max(c.powers['frozen-mult'] ?? 0, previousMult); if (has(s, 'diamond-hands')) { s.minMult = Math.max(2, s.minMult); hint(s, 'Never Selling', 'Diamond Hands + Freeze for Mint lock the run’s minimum Mult at ×2.'); } break;
    case 'squeektoshi-sleeping': if (!node(s).jackpot && (s.day.hibernation || node(s).work === 0)) { draw(s, 2); c.energy++; } break;
    case 'gm': if (c.turn === 1) { draw(s, 1); c.chain = Math.min(20, c.chain + 1); } break;
    case 'wagmi': s.minMult = Math.max(1.5, s.minMult); c.powers['wild-chain'] = 1; c.fud = false; break;
    case 'rug-pull': { const stolen = living(s).reduce((sum, e) => sum + e.block, 0); c.squeeks += stolen; for (const e of living(s)) e.block = 0; c.block = 0; if (stolen >= 8 && c.turnCards.includes('ser')) { trigger(s, 2); hint(s, 'Polite Exit', 'ser created liquidity for a Rug Pull.'); } break; }
    case 'ser': for (const e of living(s).filter(e => e.intent.type === 'attack').slice(0, values.serTargets)) e.intent = { type: 'block', damage: 0, times: 1, label: 'Gain 8 Block (ser)' }; break;
    case 'lfg': c.turnMult += 0.3 * (before + 1); c.powers.lfg = (c.powers.lfg ?? 0) + 1; break;
    case 'wen-mint': c.pending.push({ kind: 'wen-mint', turn: c.turn + 3, baseline: c.squeeks }); break;
    case 'ape-in': trigger(s, 3); c.nextEnergy -= 2; break;
    case 'exit-liquidity': break; // Status transfer precedes first-card FUD consumption above.
    case 'touch-grass': s.hp = s.maxHp; s.touchGrassUsed = true; s.deck = s.deck.filter(k => CARDS[k.id]!.type !== 'curse'); for (const pile of [c.hand, c.draw, c.discard, c.exhaust]) for (let i = pile.length - 1; i >= 0; i--) if (CARDS[pile[i]!.id]!.type === 'curse') pile.splice(i, 1); c.weak = 0; c.fud = false; break;
    case 'gsqueek': if (c.turn === 1) { draw(s, 1); c.turnMult += 0.5; } break;
    case 'hammy-gang': c.addMult += s.deck.filter(k => /hammy|squeek/i.test(CARDS[k.id]!.name)).length * 0.3; break;
    case 'gud-tek': { const chosen = c.hand[action.choice!]!; if (chosen.level) c.squeeks = bounded(c.squeeks * 1.5); else chosen.level = 1; break; }
    case 'sleep-cam': {
      const active = (c.powers['sleep-cam-until'] ?? 0) >= c.turn;
      c.powers['sleep-cam-from'] = active ? Math.min(c.powers['sleep-cam-from'] ?? c.turn, c.turn + 1) : c.turn + 1;
      c.powers['sleep-cam-until'] = Math.max(c.powers['sleep-cam-until'] ?? 0, c.turn + 2);
      c.powers['sleep-cam'] = 1;
      if (s.day.hibernation) draw(s, 1);
      break;
    }
    case 'nyn-sob': c.squeeks += 10; break;
    case 'firmware-upgrade':
      for (const pile of [s.deck, c.hand, c.draw, c.discard, c.exhaust]) for (const k of pile) if (/WHEELY/i.test(CARDS[k.id]!.name) && isCardUpgradable(k)) k.level = 1;
      if (c.powers['wheely-overclock']) c.powers['overclock-upgraded'] = c.powers['wheely-overclock'];
      break;
  }
  if (definition.type === 'power') {
    c.powers[card.id] = (c.powers[card.id] ?? 0) + (card.id === 'night-owl' ? values.nightSqueeks : 1);
    if (card.level && card.id === 'insomnia') c.powers['insomnia-upgraded'] = (c.powers['insomnia-upgraded'] ?? 0) + 1;
    if (card.level && card.id === 'genesis-seed') c.powers['genesis-upgraded'] = (c.powers['genesis-upgraded'] ?? 0) + 1;
    if (card.level && card.id === 'wheely-overclock') c.powers['overclock-upgraded'] = (c.powers['overclock-upgraded'] ?? 0) + 1;
    for (const e of living(s)) if (e.id === 'difficulty-adjuster') e.strength += 2;
  }
  refreshIntents(s);
  c.turnCards.push(card.id);
  if (has(s, 'wheely9000') && c.turnCards.length % 3 === 0) c.energy++;
  if (['gm', 'buildooooor', 'lfg'].every(id => c.turnCards.includes(id)) && !c.powers['night-shift']) { trigger(s, 5); c.powers['night-shift'] = 1; hint(s, 'Night Shift', 'gm + Buildooooor + LFG: ×5 Mult.'); }
  if (c.turn === 1 && c.turnCards.includes('gm') && c.turnCards.includes('gsqueek') && !c.powers['greeting-combo']) { c.powers['greeting-combo'] = 1; c.turnMult += 0.5; hint(s, 'Good Squeeking', 'gm and gsqueek greet the same night.'); }
  if (card.id === 'gas-war' && c.powers['wheely-overclock'] && !c.powers['gas-combo']) { trigger(s, 2); c.powers['gas-combo'] = 1; hint(s, 'Priority Wheel', 'Gas War + WHEELY9000 Overclock: ×2 Mult.'); }
  if (card.id === 'squeektoshi-sleeping' && c.turnCards.includes('sleep-cam') && s.day.hibernation && !c.powers['dream-combo']) { c.addMult += 2; c.powers['dream-combo'] = 1; hint(s, 'Dream Stream', 'Sleep Cam watched Squeektoshi sleeping on a hibernation day: +2 Mult.'); }
  if (definition.exhaust || definition.type === 'power' || card.id === 'paper-hands') c.exhaust.push(card); else c.discard.push(card);
  s.bestHit = Math.max(s.bestHit, Math.round(bounded(Math.max(0, damage) * effectiveMult(s))));
  checkCombat(s);
  if (card.id === 'touch-grass' && s.phase === 'combat') endTurn(s);
}
function shop(s: RunState) {
  const cards = Array.from({ length: 3 }, () => randomCard(s, false, true));
  const sale = Math.floor(random(s) * 3), discount = s.day.priceMultiplier * (has(s, 'hamsterfi') ? 0.85 : 1);
  const ranges = { common: [45, 55], uncommon: [70, 80], rare: [135, 165] };
  const offers: ShopOffer[] = cards.map((id, i) => { const [lo, hi] = ranges[CARDS[id]!.rarity]; return { kind: 'card', id, price: Math.round((lo! + random(s) * (hi! - lo!)) * discount * (i === sale ? 0.5 : 1)), sold: false }; });
  const relicPool = Object.keys(RELICS).filter(id => !has(s, id));
  for (let i = 0; i < 2 && relicPool.length; i++) {
    const id = pick(s, relicPool); relicPool.splice(relicPool.indexOf(id), 1);
    offers.push({ kind: 'relic', id, price: Math.round(({ common: 145, uncommon: 240, rare: 300 }[RELICS[id]!.rarity]) * discount), sold: false });
  }
  s.shop = { offers, removePrice: Math.round((50 + s.removeCount * 25) * discount) }; s.phase = 'shop';
}
/** Pure reducer. Rejected actions throw and leave the caller's state untouched. */
export function act(original: RunState, action: RunAction): RunState {
  fail(action && typeof action.type === 'string', 'Invalid action');
  fail(original.phase !== 'won' && original.phase !== 'lost', 'Run is over');
  const s = clone(original);
  if (action.type === 'elapsed') {
    fail(Number.isInteger(action.ms) && action.ms >= s.elapsedMs && action.ms <= 300_000, 'Elapsed time must be monotonic and within five minutes');
    s.elapsedMs = action.ms;
    if (s.mode === 'endless' && s.elapsedMs === 300_000) { s.phase = 'lost'; say(s, 'Five minutes. The wheel rests.'); }
  } else if (action.type === 'abandon') { s.phase = 'lost'; say(s, 'Run retired. Tomorrow is another wheel.'); }
  else if (action.type === 'enter') {
    fail(s.phase === 'map' && s.reachable.includes(action.nodeId), 'That hour is not reachable');
    fail(Number.isInteger(action.nodeId) && s.map[action.nodeId], 'Invalid node');
    s.currentNode = action.nodeId; s.floor++;
    if (['battle', 'elite', 'boss'].includes(node(s).kind)) beginCombat(s);
    else if (node(s).kind === 'shop') shop(s);
    else if (node(s).kind === 'treasure') {
      const relic = findRelic(s);
      if (relic) addRelic(s, relic);
      s.reward = { cards: [], relic }; s.phase = 'reward';
      say(s, relic ? 'Treasure opened. The relic is yours.' : 'Treasure opened. You already own every relic.');
    }
    else s.phase = node(s).kind as 'rest' | 'event';
  } else if (action.type === 'play') { fail(s.phase === 'combat', 'Not in combat'); play(s, action); }
  else if (action.type === 'endTurn') { fail(s.phase === 'combat', 'Not in combat'); endTurn(s); }
  else if (action.type === 'reward') {
    fail(s.phase === 'reward' && s.reward, 'No reward to choose');
    fail(action.cardId === null || s.reward.cards.includes(action.cardId), 'Card is not a reward');
    if (action.cardId) s.deck.push(instance(s, action.cardId)); completeNode(s);
  } else if (action.type === 'buy') {
    fail(s.phase === 'shop' && s.shop, 'Not in a shop');
    const offer = s.shop.offers[action.index]; fail(offer && !offer.sold, 'Offer unavailable'); fail(s.gold >= offer.price, 'Not enough Gold');
    s.gold -= offer.price; offer.sold = true;
    if (offer.kind === 'card') s.deck.push(instance(s, offer.id)); else addRelic(s, offer.id);
  } else if (action.type === 'remove') {
    fail(s.phase === 'shop' && s.shop, 'Not in a shop'); fail(s.deck.length > 1, 'Keep at least one card');
    fail(s.deck.some(k => k.uid === action.uid), 'Card not in deck'); fail(s.gold >= s.shop.removePrice, 'Not enough Gold');
    s.gold -= s.shop.removePrice; s.deck = s.deck.filter(k => k.uid !== action.uid);
    if (has(s, 'hamsterfi') && !s.hamsterfiUsed) s.hamsterfiUsed = true; else s.removeCount++;
    s.shop.removePrice = Math.round((50 + s.removeCount * 25) * s.day.priceMultiplier * (has(s, 'hamsterfi') ? 0.85 : 1));
  } else if (action.type === 'rest') {
    fail(s.phase === 'rest', 'Not at rest');
    if (action.option === 'heal') { const healed = Math.min(s.maxHp - s.hp, Math.round(s.maxHp * 0.3)); s.hp += healed; say(s, `A soft nap restored ${healed} HP.`); }
    else { fail(action.option === 'upgrade', 'Invalid rest option'); const card = s.deck.find(k => k.uid === action.uid); fail(card && isCardUpgradable(card), 'Choose a card with an available upgrade'); card.level = 1; say(s, `Upgraded ${CARDS[card.id]!.name}`); }
    completeNode(s);
  } else if (action.type === 'event') {
    fail(s.phase === 'event' && (action.option === 0 || action.option === 1), 'Invalid event choice');
    if (action.option === 0) { s.gold += 25 + Math.max(0, node(s).tier) * 5; const lost = Math.min(6, s.hp - 1); loseHp(s, 6, 1); say(s, `You found forgotten seeds: +Gold, −${lost} HP.`); }
    else { const healed = Math.min(s.maxHp - s.hp, 10); s.hp += healed; const id = pick(s, ['gm', 'gsqueek', 'sleep-cam', 'squeektoshi-sleeping']); s.deck.push(instance(s, id)); say(s, `A peaceful round: +${healed} HP and ${CARDS[id]!.name}.`); }
    completeNode(s);
  } else if (action.type === 'leave') { fail(s.phase === 'shop' || s.phase === 'rest' || s.phase === 'event', 'Cannot leave this encounter'); completeNode(s); }
  else throw new Error('Unknown action');
  if (s.phase === 'lost' && s.combat && ['battle', 'elite', 'boss'].includes(s.map[s.currentNode]?.kind ?? '')
    && !s.battleScores.some(battle => battle.floor === s.floor)) {
    s.battleScores.push(battleScoreBreakdown(s, false));
  }
  s.totalScore = runScoreSummary(s).totalScore;
  s.log.push(clone(action));
  return s;
}
function checksum(exported: Omit<RunExport, 'checksum'>) { return hashString(JSON.stringify(exported)).toString(16).padStart(8, '0'); }
export function exportRun(s: RunState): RunExport {
  const exported: Omit<RunExport, 'checksum'> = { version: 1, scoreVersion: SCORE_VERSION, day: clone(s.day), mode: s.mode, actions: clone(s.log), claimedScore: s.totalScore, claimedBestHit: s.bestHit };
  return { ...exported, checksum: checksum(exported) };
}
/** A server must provide its authoritative archived day; standalone replay verifies self-contained exports. */
export function replayRun(input: RunExport, authoritativeDay?: DayData): RunState {
  fail(input?.version === 1 && Array.isArray(input.actions) && input.actions.length <= 25_000, 'Invalid replay format');
  fail(input.scoreVersion === SCORE_VERSION, 'Unsupported score version; start a new run');
  const { checksum: claimedChecksum, ...body } = input;
  fail(claimedChecksum === checksum(body), 'Replay checksum mismatch');
  const day = input.day;
  if (authoritativeDay) {
    // Display labels can change between releases without invalidating an archived
    // run. Every hourly gameplay value still belongs to the authoritative rules.
    const stableRules = ({ source: _source, notice: _notice, spinning: _spinning, hours, ...rules }: DayData) => ({
      ...rules, hours: hours.map(({ label: _label, ...hour }) => hour),
    });
    fail(JSON.stringify(stableRules(input.day)) === JSON.stringify(stableRules(authoritativeDay)), 'Replay does not match the authoritative daily snapshot');
  }
  let state = createRun(day, generateMap(day), input.mode);
  for (const action of input.actions) state = act(state, action);
  fail(state.totalScore === input.claimedScore && state.bestHit === input.claimedBestHit, 'Recomputed score does not match claim');
  return state;
}
