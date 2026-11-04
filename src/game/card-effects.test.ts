import { describe, expect, it } from 'vitest';
import { CARDS } from './catalog';
import { act, createRun, effectiveMult, oracleDrawOptions, previewIntents, type CardInstance, type RunAction, type RunState } from './engine';
import { fallbackDay } from './data';
import { generateMap } from './map';
import { getCardPresentation } from './cardValues';

const card = (id: string, uid = id, level = 0): CardInstance => ({ id, uid, level, mergeLevel: 0 });
const scaled = (n: number, level: number) => Math.round(n * (level ? 1.5 : 1));
function battle(id: string, level = 0): RunState {
  const day = { ...fallbackDay('2026-11-04'), difficulty: 1, peakRpm: 225, hibernation: true, spinning: false };
  const map = generateMap(day);
  map[0] = { ...map[0]!, kind: 'battle', enemyId: 'dust-mite', jackpot: false, tier: 2, work: 0 };
  const s = act(createRun(day, map, 'daily'), { type: 'enter', nodeId: 0 });
  s.relics = []; s.hp = 50; s.maxHp = 100;
  const c = s.combat!;
  c.hand = [card(id, 'played', level)];
  c.draw = Array.from({ length: 35 }, (_, i) => card('cheek-pouch', `draw-${i}`));
  c.discard = []; c.exhaust = []; c.energy = 6; c.squeeks = 20; c.addMult = 1; c.turnMult = 0; c.turnHp = s.hp;
  c.enemies = Array.from({ length: 3 }, (_, i) => ({ ...c.enemies[0]!, uid: `e${i}`, hp: 100_000, maxHp: 100_000, intent: { type: 'block', damage: 6, times: 1, label: 'Gain 8 Block' } }));
  s.deck = [...c.hand, ...c.draw].map(k => ({ ...k }));
  return s;
}
function play(s: RunState, uid = 'played', extra: Partial<Extract<RunAction, { type: 'play' }>> = {}) {
  return act(s, { type: 'play', uid, target: 'e1', ...extra });
}
function next(s: RunState, count = 1): RunState {
  for (let i = 0; i < count; i++) {
    // Keep this a deterministic effect laboratory: no enemy HP loss, FUD or rejection.
    for (const enemy of s.combat!.enemies) { enemy.intent.type = 'block'; enemy.block = 0; }
    s = act(s, { type: 'endTurn' });
  }
  return s;
}
function addHand(s: RunState, id: string, uid = id, level = 0) {
  const value = card(id, uid, level); s.combat!.hand.push(value); return value;
}
function checkDamage(before: RunState, after: RunState, amount: number, all = false) {
  expect(after.combat!.enemies.map((enemy, i) => before.combat!.enemies[i]!.hp - enemy.hp)).toEqual(all ? [amount, amount, amount] : [0, amount, 0]);
}
type EffectCase = {
  setup?: (s: RunState, level: number) => Partial<Extract<RunAction, { type: 'play' }>> | void;
  verify: (after: RunState, before: RunState, level: number) => void;
};
const attack = (amount: number): EffectCase => ({ verify: (a, b, l) => checkDamage(b, a, scaled(amount, l)) });
const block = (amount: number): EffectCase => ({ verify: (a, b, l) => expect(a.combat!.block - b.combat!.block).toBe(scaled(amount, l)) });

// Expected values below are a second, hand-written interpretation of the card rules.
// They deliberately do not call cardValues/the resolver to obtain their expectations.
const effects: Record<string, EffectCase> = {
  'wheel-kick': { verify(a, b, l) { checkDamage(b, a, scaled(6, l)); expect(a.combat!.squeeks - b.combat!.squeeks).toBe(scaled(6, l) * 2); } },
  'cheek-pouch': { verify(a, b, l) { expect(a.combat!.block - b.combat!.block).toBe(l ? 8 : 5); } },
  '3am-dash': { verify(a, b, l) { checkDamage(b, a, l ? 10 : 8); expect(a.combat!.enemies.map(e => e.vulnerable)).toEqual([0, l ? 3 : 2, 0]); } },
  'seed-snack': { verify(a, b, l) { expect(a.combat!.hand.length).toBe(l ? 2 : 1); expect(a.combat!.chain).toBe(1); } },
  'burst-sprint': attack(9),
  'double-lap': { verify(a, b, l) { checkDamage(b, a, scaled(4, l) * 2); expect(a.combat!.squeeks - b.combat!.squeeks).toBe(scaled(4, l) * 2); expect(a.combat!.chain).toBe(1); } },
  'tail-whip': { verify(a, b, l) { checkDamage(b, a, scaled(3, l)); expect(a.combat!.enemies.map(e => e.weak)).toEqual([0, 1, 0]); expect(a.combat!.enemies[1]!.intent.damage).toBe(5); } },
  'wood-chew': attack(14),
  'wheel-spin': { verify(a, b, l) { checkDamage(b, a, scaled(6, l)); } },
  'bedding-fort': block(8),
  'ball-up': block(13),
  'sniff': { setup(s) { addHand(s, 'wood-chew', 'oldest'); addHand(s, 'ball-up', 'newer'); }, verify(a) { expect(a.combat!.hand.map(k => k.uid)).toEqual(['newer', 'draw-34', 'draw-33']); expect(a.combat!.discard.map(k => k.uid)).toEqual(['oldest', 'played']); } },
  'sunflower-stash': { verify(a, b, l) { expect(a.combat!.block).toBe(scaled(5, l)); expect(a.combat!.nextEnergy).toBe(1); expect(next(a).combat!.energy).toBe(4); } },
  'water-bottle': { verify(a, b, l) { expect(a.hp - b.hp).toBe(scaled(4, l)); } },
  'squeek': { verify(a, b, l) { checkDamage(b, a, scaled(6, l)); expect(a.combat!.turnMult).toBe(0.5); expect(next(a).combat!.turnMult).toBe(0); } },
  'pellet-toss': { verify(a, b, l) { checkDamage(b, a, scaled(5, l), true); expect(a.combat!.squeeks - b.combat!.squeeks).toBe(scaled(5, l) * 3); } },
  'wheel-brake': { setup(s) { s.combat!.chain = 4; s.combat!.chainType = 'attack'; }, verify(a, b, l) { expect(a.combat!.block).toBe(scaled(6, l)); expect(a.combat!.chain).toBe(4); expect(a.combat!.chainType).toBe('attack'); } },
  'cage-climb': { verify(a, b, l) { expect(a.combat!.block).toBe(scaled(7, l)); expect(a.combat!.hand.map(k => k.uid)).toEqual(['draw-34']); } },
  'night-owl': { verify(a, b, l) { expect(a.combat!.squeeks).toBe(20); expect(next(a, 2).combat!.squeeks).toBe(20 + (l ? 2 : 1) * 2); } },
  'fluff-up': { setup(s) { s.hp = 200; s.maxHp = 200; for (const e of s.combat!.enemies) { e.id = 'squeektoshi'; e.intent = { type: 'attack', damage: 15, times: 3, label: 'Attack 15 ×3' }; } }, verify(a, b, l) { expect(a.combat!.enemies.map(e => e.intent.damage)).toEqual(Array(3).fill(l ? 12 : 13)); expect(a.combat!.enemies.every(e => e.intent.times === 3)).toBe(true); const ended = act(a, { type: 'endTurn' }); expect(b.hp - ended.hp).toBe((l ? 12 : 13) * 9); expect(ended.combat!.powers['fluff-up']).toBeUndefined(); } },
  'marathon': { verify(a) { for (let i = 0; i < 6; i++) { a.combat!.energy = 6; addHand(a, 'burst-sprint', `attack-${i}`); a = play(a, `attack-${i}`); expect(a.combat!.addMult).toBe(1 + Math.floor((i + 1) / 3) * 0.5); } expect(next(a).combat!.addMult).toBe(2); } },
  'settlement': { verify(a) { addHand(a, 'wood-chew'); a = play(a, 'wood-chew'); expect(a.combat!.damageDealt).toBe(14); expect(next(structuredClone(a), 2).combat!.pending).toHaveLength(1); const ended = next(a, 3); expect(ended.combat!.enemies[0]!.hp).toBe(100_000 - 21 + 8); expect(ended.combat!.pending).toHaveLength(0); expect(ended.history.join(' ')).toContain('Settlement paid 21 damage'); } },
  'oracle-ping': { setup() { return { choice: 1 }; }, verify(a, b) { expect(a.combat!.draw.slice(-3).map(k => k.uid)).toEqual(['draw-32', 'draw-34', 'draw-33']); const drawn = next(a); expect(drawn.combat!.hand.slice(0, 3).map(k => k.uid)).toEqual(['draw-33', 'draw-34', 'draw-32']); expect(b.combat!.draw).toHaveLength(35); } },
  'block-reward': { setup(s, l) { s.combat!.enemies[1]!.hp = scaled(18, l); }, verify(a, b, l) { expect(a.combat!.enemies[1]!.hp).toBe(0); expect(a.gold - b.gold).toBe(15); expect(a.phase).toBe('combat'); } },
  'overrun': { setup(s) { s.combat!.turnCards = ['gm', 'cheek-pouch', 'sniff']; }, verify(a, b, l) { checkDamage(b, a, scaled(15, l)); } },
  'merge': { setup(s) { s.deck.push(card('wheel-kick', 'merge-a'), card('wheel-kick', 'merge-b')); s.combat!.draw.push(card('wheel-kick', 'merge-a'), card('wheel-kick', 'merge-b')); return { mergePair: ['merge-a', 'merge-b'] }; }, verify(a) { expect(a.deck.find(k => k.uid === 'merge-a')!.mergeLevel).toBe(1); expect(a.deck.some(k => k.uid === 'merge-b')).toBe(false); expect(a.combat!.draw.find(k => k.uid === 'merge-a')!.mergeLevel).toBe(1); expect(a.combat!.draw.some(k => k.uid === 'merge-b')).toBe(false); expect(a.mergeActs).toEqual([1]); } },
  'stake': { verify(a) { expect(a.combat!.skipDraw).toBe(true); const later = next(a); expect(later.combat!.energy).toBe(5); expect(later.combat!.hand).toHaveLength(0); expect(next(later).combat!.hand).toHaveLength(5); } },
  'burrow': block(20),
  'rolling-median': { setup(s) { s.combat!.block = 11; }, verify(a) { expect(next(a).combat!.block).toBe(5); } },
  'insomnia': { verify(a, b, l) { const later = next(a); expect(later.hp).toBe(b.hp - 2); expect(later.combat!.hand).toHaveLength(l ? 7 : 6); expect(next(later).hp).toBe(b.hp - 4); } },
  'genesis-seed': { verify(a, b, l) { expect(a.combat!.multiply).toBe(1); expect(next(a, 2).combat!.multiply).toBeCloseTo((l ? 1.3 : 1.2) ** 2); } },
  'peak-rpm': { verify(a, b, l) { checkDamage(b, a, Math.round(6 * 225 / 100 * (l ? 1.5 : 1))); expect(a.combat!.energy).toBe(0); expect(a.combat!.turnMult).toBe(6); expect(next(a).combat!.turnMult).toBe(0); } },
  'nocturnal': { setup(s) { s.map[0]!.jackpot = true; }, verify(a) { addHand(a, 'wood-chew'); const later = play(a, 'wood-chew'); expect(a.combat!.energy - later.combat!.energy).toBe(1); addHand(later, 'tail-whip'); expect(play(later, 'tail-whip').combat!.energy).toBe(later.combat!.energy); } },
  'full-moon-run': { verify(a, b, l) { checkDamage(b, a, scaled(30, l)); expect(a.combat!.multiply).toBe(2); expect(next(a).combat!.multiply).toBe(2); } },
  'maus-mode': { verify(a) { addHand(a, 'seed-snack'); a = play(a, 'seed-snack'); expect(a.combat!.addMult).toBe(2); addHand(a, 'cheek-pouch'); a = play(a, 'cheek-pouch'); expect(a.combat!.addMult).toBe(2); expect(next(a).combat!.addMult).toBe(2); } },
  'freeze-for-mint': { setup(s) { s.combat!.chain = 3; s.combat!.chainType = 'attack'; s.combat!.turnMult = 2; s.combat!.multiply = 2; }, verify(a, b) { expect(a.combat!.frozenChain).toBeCloseTo(1.1 ** 3); expect(a.combat!.powers['frozen-mult']).toBeCloseTo(effectiveMult(b)); expect(effectiveMult(next(a))).toBeGreaterThanOrEqual(effectiveMult(b)); } },
  'aura-farm': { verify(a) { expect(next(structuredClone(a), 2).runMult).toBe(0); a = next(a, 3); expect(a.runMult).toBe(0.5); expect(a.combat!.addMult).toBe(1.5); expect(next(a, 3).runMult).toBe(1); } },
  'buildooooor': { verify(a, b, l) { checkDamage(b, a, scaled(7, l)); expect(a.buildCount).toBe(1); addHand(a, 'buildooooor', 'second', l); checkDamage(a, play(a, 'second'), scaled(8, l)); } },
  'squeektoshi-sleeping': { verify(a) { expect(a.combat!.hand).toHaveLength(2); expect(a.combat!.energy).toBe(7); } },
  'wheely-overclock': { verify(a, b, l) { expect(a.combat!.multiply).toBe(1); expect(next(a, 2).combat!.multiply).toBeCloseTo((1 + 225 / (l ? 750 : 1000)) ** 2); } },
  'gm': { verify(a) { expect(a.combat!.hand).toHaveLength(1); expect(a.combat!.chain).toBe(1); } },
  'paper-hands': { verify(a) { expect(a.combat!.exhaust.some(k => k.uid === 'played')).toBe(true); expect(a.deck.some(k => k.uid === 'played')).toBe(true); } },
  'wagmi': { setup(s) { s.combat!.fud = true; }, verify(a) { expect(a.minMult).toBe(1.5); expect(a.combat!.fud).toBe(false); expect(a.combat!.multiply).toBe(1); addHand(a, 'tail-whip'); a = play(a, 'tail-whip'); expect(a.combat!.chain).toBe(1); addHand(a, 'cheek-pouch'); a = play(a, 'cheek-pouch'); expect(a.combat!.chain).toBe(2); a.combat!.enemies[0]!.intent.type = 'fud'; a = act(a, { type: 'endTurn' }); expect(a.combat!.fud).toBe(false); expect(a.combat!.powers['wild-chain']).toBeUndefined(); } },
  'ngmi': { verify(a) { expect(a.combat!.discard.some(k => k.uid === 'played')).toBe(true); a = next(a, 2); expect(a.combat!.exhaust.some(k => k.uid === 'played')).toBe(true); expect([...a.combat!.hand, ...a.combat!.draw, ...a.combat!.discard].some(k => k.uid === 'played')).toBe(false); } },
  'rug-pull': { setup(s) { s.combat!.block = 9; s.combat!.enemies.forEach((e, i) => { e.block = i + 2; }); }, verify(a, b) { expect(a.combat!.enemies.map(e => e.block)).toEqual([0, 0, 0]); expect(a.combat!.enemies.map(e => e.hp)).toEqual(b.combat!.enemies.map(e => e.hp)); expect(a.combat!.squeeks - b.combat!.squeeks).toBe(9); expect(a.combat!.block).toBe(0); } },
  'gas-war': { verify(a, b, l) { checkDamage(b, a, scaled(216, l)); expect(a.combat!.squeeks).toBe(20 * 36 + scaled(216, l)); expect(a.combat!.energy).toBe(0); } },
  'ser': { setup(s) { s.combat!.enemies.forEach(e => { e.intent.type = 'attack'; }); }, verify(a, b, l) { expect(a.combat!.enemies.map(e => e.intent.type)).toEqual(l ? ['block', 'block', 'attack'] : ['block', 'attack', 'attack']); } },
  'lfg': { setup(s) { s.relics = ['diamond-hands']; s.combat!.turnCards = ['cheek-pouch', 'sniff']; addHand(s, 'tail-whip'); }, verify(a) { expect(a.combat!.turnMult).toBeCloseTo(0.9); a = play(a, 'tail-whip'); expect(a.combat!.turnMult).toBeCloseTo(1.2); addHand(a, 'wood-chew', 'discard-me'); a = next(a); expect(a.combat!.hand.some(k => k.uid === 'discard-me')).toBe(false); expect(a.combat!.powers.lfg).toBeUndefined(); expect(a.combat!.turnMult).toBe(0); } },
  'wen-mint': { verify(a) { addHand(a, 'nyn-sob'); a = play(a, 'nyn-sob'); expect(next(structuredClone(a), 2).combat!.squeeks).toBe(30); a = next(a, 3); expect(a.combat!.squeeks).toBe(40); expect(a.combat!.pending).toHaveLength(0); } },
  'ape-in': { verify(a, b, l) { checkDamage(b, a, scaled(12, l)); expect(a.combat!.multiply).toBe(3); expect(a.combat!.nextEnergy).toBe(-2); expect(next(a).combat!.energy).toBe(1); } },
  'exit-liquidity': { setup(s) { s.combat!.weak = 2; s.combat!.fud = true; s.combat!.enemies[1]!.intent.type = 'attack'; }, verify(a) { expect(a.combat!.weak).toBe(0); expect(a.combat!.fud).toBe(false); expect(a.combat!.multiply).toBe(1); expect(a.combat!.enemies.map(e => [e.weak, !!e.fud])).toEqual([[0, false], [2, true], [0, false]]); expect(a.combat!.enemies[1]!.intent.damage).toBe(2); a = act(a, { type: 'endTurn' }); expect(a.hp).toBe(48); expect(a.combat!.enemies[1]!.fud).toBe(false); } },
  'touch-grass': { setup(s) { s.combat!.weak = 3; s.combat!.fud = true; for (const [i, pile] of [s.deck, s.combat!.hand, s.combat!.draw, s.combat!.discard, s.combat!.exhaust].entries()) pile.push(card('nyn-sob', `curse-${i}`)); }, verify(a) { expect(a.hp).toBe(100); expect(a.touchGrassUsed).toBe(true); expect(a.combat!.turn).toBe(2); expect(a.combat!.weak).toBe(0); expect(a.combat!.fud).toBe(false); for (const pile of [a.deck, a.combat!.hand, a.combat!.draw, a.combat!.discard, a.combat!.exhaust]) expect(pile.some(k => CARDS[k.id]!.type === 'curse')).toBe(false); } },
  'gsqueek': { setup(s) { s.combat!.turnCards = ['gm']; }, verify(a) { expect(a.combat!.hand).toHaveLength(1); expect(a.combat!.turnMult).toBe(1); } },
  'hammy-gang': { setup(s) { s.deck = [card('squeek'), card('squeektoshi-sleeping'), card('gsqueek'), card('wheel-kick')]; }, verify(a) { expect(a.combat!.addMult).toBeCloseTo(1.9); expect(next(a).combat!.addMult).toBeCloseTo(1.9); } },
  'gud-tek': { setup(s) { addHand(s, 'wood-chew', 'choice'); return { choice: 0 }; }, verify(a) { expect(a.combat!.hand.find(k => k.uid === 'choice')!.level).toBe(1); expect(a.deck.find(k => k.uid === 'played')!.level).toBe(a.combat!.discard[0]!.level); checkDamage(a, play(a, 'choice'), 21); } },
  'moar': { setup(s) { s.combat!.lastAttackDamage = 14; }, verify(a, b, l) { checkDamage(b, a, scaled(14, l)); } },
  'sleep-cam': { verify(a) { expect(a.combat!.powers['sleep-cam']).toBe(1); expect(previewIntents(a).map(e => e.intents.length)).toEqual([2, 2, 2]); expect(a.combat!.hand).toHaveLength(1); } },
  'spacetime-fold': { verify(a) { const ended = next(a); expect(ended.combat!.turn).toBe(2); expect(ended.combat!.enemies.map(e => e.block)).toEqual([0, 0, 0]); expect(ended.combat!.powers['fold-used']).toBe(1); expect(next(ended).combat!.enemies.map(e => e.block)).toEqual([8, 8, 8]); } },
  'nyn-sob': { verify(a, b) { expect(a.hp).toBe(b.hp); expect(a.combat!.squeeks - b.combat!.squeeks).toBe(10); } },
  'firmware-upgrade': { setup(s) { for (const [i, pile] of [s.deck, s.combat!.hand, s.combat!.draw, s.combat!.discard, s.combat!.exhaust].entries()) pile.push(card('wheely-overclock', `wheely-${i}`)); }, verify(a) { for (const pile of [a.deck, a.combat!.hand, a.combat!.draw, a.combat!.discard, a.combat!.exhaust]) for (const k of pile.filter(k => k.id === 'wheely-overclock')) expect(k.level).toBe(1); } },
};

describe('complete card catalog declared-effect contract', () => {
  it('has an independent effect contract for every catalog entry', () => {
    expect(Object.keys(effects).sort()).toEqual(Object.keys(CARDS).sort());
  });
  for (const [id, effect] of Object.entries(effects)) {
    it.each([0, 1])(`${CARDS[id]!.name} level %i resolves every declared effect`, level => {
      const before = battle(id, level);
      const extra = effect.setup?.(before, level) ?? {};
      const original = structuredClone(before);
      const after = play(before, 'played', extra);
      expect(before).toEqual(original);
      const definition = CARDS[id]!;
      if (id !== 'touch-grass') {
        expect(after.combat!.energy).toBe(before.combat!.energy - (definition.cost === 'X' ? before.combat!.energy : definition.cost) + (id === 'squeektoshi-sleeping' ? 1 : 0));
        const exhausted = definition.exhaust || definition.type === 'power' || id === 'paper-hands';
        expect(after.combat![exhausted ? 'exhaust' : 'discard'].some(k => k.uid === 'played')).toBe(true);
      }
      effect.verify(after, original, level);
    });
  }
});

describe('card conditions, choices and numerical boundaries', () => {
  it.each([0, 1])('rounds the complete Peak RPM formula once at upgrade %i', level => {
    const s = battle('peak-rpm', level); s.combat!.energy = 3;
    checkDamage(s, play(s), Math.round(3 * 225 / 100 * (level ? 1.5 : 1)));
  });
  it.each(['ngmi', 'nyn-sob'])('applies %s draw penalties, including drawing by a played card', id => {
    const s = battle('seed-snack'); s.combat!.draw.push(card(id, 'drawn-curse'));
    const a = play(s);
    expect(a.combat!.hand[0]!.uid).toBe('drawn-curse');
    expect(a.hp).toBe(id === 'nyn-sob' ? 48 : 50);
    expect(a.combat!.turnMult).toBe(id === 'ngmi' ? -1 : 0);
  });
  it.each(['gm', 'gsqueek'])('%s has no greeting effect after turn 1', id => {
    const s = battle(id); s.combat!.turn = 2;
    const a = play(s); expect(a.combat!.hand).toHaveLength(0); expect(a.combat!.chain).toBe(0); expect(a.combat!.turnMult).toBe(0);
  });
  it.each([['hibernation', false, 20, false], ['zero work', false, 0, true], ['Zoomies', true, 0, false]] as const)('Sleeping condition: %s', (_label, jackpot, work, active) => {
    const s = battle('squeektoshi-sleeping'); s.day.hibernation = false; s.map[0]!.work = work; s.map[0]!.jackpot = jackpot;
    const a = play(s); expect(a.combat!.hand).toHaveLength(active ? 2 : 0); expect(a.combat!.energy).toBe(active ? 7 : 6);
  });
  it('Sleep Cam does not draw outside hibernation', () => {
    const s = battle('sleep-cam'); s.day.hibernation = false; expect(play(s).combat!.hand).toHaveLength(0);
  });
  it('Water Bottle caps healing at maximum HP', () => {
    const s = battle('water-bottle', 1); s.hp = 99; expect(play(s).hp).toBe(100);
  });
  it('Block Reward pays only a lethal hit', () => {
    const s = battle('block-reward'); expect(play(s).gold).toBe(s.gold);
  });
  it('Gud Tek multiplies Squeeks for an already upgraded selection without a permanent deck upgrade', () => {
    const s = battle('gud-tek'); addHand(s, 'wood-chew', 'chosen', 1); s.deck.push(card('wood-chew', 'chosen', 1));
    expect(play(s, 'played', { choice: 0 }).combat!.squeeks).toBe(30);
    const base = battle('gud-tek'); addHand(base, 'wood-chew', 'chosen'); base.deck.push(card('wood-chew', 'chosen'));
    const a = play(base, 'played', { choice: 0 }); expect(a.deck.find(k => k.uid === 'chosen')!.level).toBe(0);
  });
  it('Oracle, Gud Tek and Merge reject incomplete choices without spending or moving a card', () => {
    for (const id of ['oracle-ping', 'gud-tek', 'merge']) {
      const s = battle(id); const original = structuredClone(s);
      expect(() => play(s)).toThrow('Choose'); expect(s).toEqual(original);
    }
    const oracle = battle('oracle-ping'); expect(() => play(oracle, 'played', { choice: 3 })).toThrow('Choose');
  });
  it('Oracle handles empty draws, preserves unchosen order, and clears all Sybil copies', () => {
    const s = battle('oracle-ping'); s.combat!.draw = []; s.combat!.enemies.forEach(e => { e.id = 'sybil-swarm'; e.hp = 1; });
    const a = play(s); expect(a.phase).toBe('reward'); expect(a.combat!.enemies.every(e => e.hp === 0)).toBe(true);
  });
  it('Oracle previews and chooses from the next discard reshuffle without mutating the preview state', () => {
    const s = battle('oracle-ping'); s.combat!.draw = [card('wheel-kick', 'remaining-top')];
    s.combat!.discard = Array.from({ length: 4 }, (_, i) => card('wood-chew', `reshuffled-${i}`));
    const original = structuredClone(s), options = oracleDrawOptions(s);
    expect(s).toEqual(original); expect(options).toHaveLength(3); expect(options[0]!.uid).toBe('remaining-top');
    const a = play(s, 'played', { choice: 2 });
    expect(a.combat!.draw.at(-1)!.uid).toBe(options[2]!.uid);
    expect(a.combat!.draw.slice(-3).reverse().map(k => k.uid)).toEqual([options[2]!.uid, options[0]!.uid, options[1]!.uid]);
    expect(a.combat!.discard.map(k => k.uid)).toEqual(['played']);
  });
  it('Merge enforces once per act, equal copies, and the level-100 limit', () => {
    const s = battle('merge'); s.deck = [card('wheel-kick', 'a'), card('wheel-kick', 'b')];
    s.mergeActs = [1]; expect(() => play(s, 'played', { mergePair: ['a', 'b'] })).toThrow('already used');
    s.mergeActs = []; s.deck[0]!.mergeLevel = 100; s.deck[1]!.mergeLevel = 100;
    expect(() => play(s, 'played', { mergePair: ['a', 'b'] })).toThrow('Choose');
    s.deck[0]!.mergeLevel = 0; s.deck[1]!.mergeLevel = 0; s.deck[1]!.level = 1;
    expect(() => play(s, 'played', { mergePair: ['a', 'b'] })).toThrow('Choose');
  });
  it('Touch Grass cannot be replayed during the run', () => {
    const s = battle('touch-grass'); s.touchGrassUsed = true; expect(() => play(s)).toThrow('once per run');
  });
  it('NGMI attack-free count resets after an attack and applies to copies in every active pile', () => {
    let s = battle('burst-sprint'); s.combat!.noAttackTurns = 1;
    for (const [i, pile] of [s.combat!.hand, s.combat!.draw, s.combat!.discard].entries()) pile.push(card('ngmi', `ngmi-${i}`));
    s = next(play(s)); expect(s.combat!.noAttackTurns).toBe(0); expect(s.combat!.exhaust).toHaveLength(0);
    s = next(s, 2); expect(s.combat!.exhaust.filter(k => k.id === 'ngmi')).toHaveLength(3);
  });
  it('Paper Hands discards the highest current scoring attack from a retained hand', () => {
    const s = battle('cheek-pouch'); s.relics = ['diamond-hands'];
    s.combat!.hand = [card('paper-hands'), card('burst-sprint'), card('wheel-spin')]; s.map[0]!.tier = 4;
    const a = next(s); expect(a.combat!.discard.some(k => k.id === 'wheel-spin')).toBe(true); expect(a.combat!.hand.some(k => k.id === 'burst-sprint')).toBe(true);
  });
  it('each held Paper Hands copy discards the best current score, including multiplier cards', () => {
    const s = battle('cheek-pouch'); s.relics = ['diamond-hands'];
    s.combat!.hand = [card('paper-hands', 'curse-a'), card('paper-hands', 'curse-b'), card('full-moon-run'), card('wheel-kick'), card('wood-chew')];
    const a = next(s);
    expect(a.combat!.discard.map(k => k.id)).toEqual(['full-moon-run', 'wood-chew']);
    expect(a.combat!.hand.some(k => k.id === 'wheel-kick')).toBe(true);
  });
  it('spending all Seeds does not protect the highest-scoring card from Paper Hands', () => {
    const s = battle('cheek-pouch'); s.relics = ['diamond-hands']; s.combat!.energy = 0;
    s.combat!.hand = [card('paper-hands'), card('wheel-kick'), card('full-moon-run')];
    const a = next(s); expect(a.combat!.discard.map(k => k.id)).toEqual(['full-moon-run']);
  });
  it('Firmware upgrades active Overclock triggers in the current battle as well as the run deck', () => {
    let s = play(battle('wheely-overclock')); addHand(s, 'firmware-upgrade'); s = play(s, 'firmware-upgrade');
    expect(s.deck.find(k => k.uid === 'played')!.level).toBe(1);
    expect(s.combat!.exhaust.find(k => k.uid === 'played')!.level).toBe(1);
    expect(next(s).combat!.multiply).toBeCloseTo(1.3);
  });
  it('Sleep Cam preview skips the same buff and queue actions as Spacetime Fold', () => {
    const s = battle('spacetime-fold'); s.combat!.enemies[0]!.id = 'queue-snake'; s.combat!.enemies[0]!.intent.type = 'buff';
    const a = play(s), original = structuredClone(a), predictions = previewIntents(a);
    expect(a).toEqual(original);
    const ended = act(a, { type: 'endTurn' });
    expect(ended.combat!.enemies[0]!.strength).toBe(0);
    expect(predictions.map(e => e.intents[0])).toEqual(ended.combat!.enemies.map(e => e.intent));
    const endedAgain = act(ended, { type: 'endTurn' });
    expect(predictions.map(e => e.intents[1])).toEqual(endedAgain.combat!.enemies.map(e => e.intent));
  });
  it('A damaged turn breaks Aura Farm clean-turn streaks', () => {
    let s = next(play(battle('aura-farm')), 2);
    s.combat!.enemies[0]!.intent = { type: 'attack', damage: 1, times: 1, label: 'Attack 1' };
    s = act(s, { type: 'endTurn' }); expect(s.runMult).toBe(0); expect(s.combat!.noDamageTurns).toBe(0);
    s = next(s, 3); expect(s.runMult).toBe(0.5);
  });
  it('Genesis and Overclock powers stack base and upgraded factors and double triggers in Zoomies', () => {
    for (const id of ['genesis-seed', 'wheely-overclock']) for (const jackpot of [false, true]) {
      let s = battle(id); s.map[0]!.jackpot = jackpot; s.combat!.energy = 10;
      s = play(s); addHand(s, id, 'upgraded', 1); s = play(s, 'upgraded'); s = next(s);
      const factors = id === 'genesis-seed' ? [1.2, 1.3] : [1 + 225 / 1000, 1 + 225 / 750];
      expect(s.combat!.multiply).toBeCloseTo(factors[0]! * factors[1]! * (jackpot ? 4 : 1));
    }
  });
  it('Gas War adds one to X in Zoomies and zero-Seed X cards remain legal', () => {
    for (const energy of [0, 2]) for (const jackpot of [false, true]) {
      const s = battle('gas-war'); s.combat!.energy = energy; s.map[0]!.jackpot = jackpot;
      const x = energy + (jackpot ? 1 : 0), a = play(s);
      checkDamage(s, a, 6 * x ** 2); expect(a.combat!.squeeks).toBe(20 * x ** 2 + 6 * x ** 2); expect(a.combat!.energy).toBe(0);
    }
    const peak = battle('peak-rpm'); peak.combat!.energy = 0; checkDamage(peak, play(peak), 0);
  });
  it('Nocturnal does not discount ordinary hours', () => {
    let s = play(battle('nocturnal')); addHand(s, 'wood-chew'); const before = s.combat!.energy; s = play(s, 'wood-chew'); expect(s.combat!.energy).toBe(before - 2);
  });
  it('Buildooooor growth caps at five and merged stats round once', () => {
    const s = battle('buildooooor', 1); s.buildCount = 100; s.combat!.hand[0]!.mergeLevel = 2;
    checkDamage(s, play(s), Math.round(12 * 1.5 * 1.1 ** 2));
    const early = battle('buildooooor'); early.relics = ['early-buildooooor']; checkDamage(early, play(early), 11);
  });
  it('live descriptions show the damage, status counts and X formula used by the battle', () => {
    const s = battle('3am-dash', 1); expect(getCardPresentation(s, s.combat!.hand[0]!).text).toContain('Deal 10 damage. Apply 3 Vulnerable.');
    const peak = battle('peak-rpm', 1); peak.combat!.energy = 3; expect(getCardPresentation(peak, peak.combat!.hand[0]!).text).toContain('Deal 10 damage');
  });
});
