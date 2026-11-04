import { describe, expect, it } from 'vitest';
import { act, createRun, effectiveMult, type CardInstance, type RunState } from './engine';
import { fallbackDay } from './data';
import { generateMap } from './map';
import { scoreMultipliers } from './score';
import { getCardPresentation } from './cardValues';

const card = (id: string, uid = id): CardInstance => ({ id, uid, level: 0, mergeLevel: 0 });
function battle(ids: string[]): RunState {
  const day = { ...fallbackDay('2026-11-04'), difficulty: 1, spinning: false };
  const map = generateMap(day);
  map[0] = { ...map[0]!, kind: 'battle', enemyId: 'dust-mite', jackpot: false };
  const state = act(createRun(day, map, 'daily'), { type: 'enter', nodeId: 0 });
  state.relics = [];
  const c = state.combat!;
  c.hand = ids.map((id, i) => card(id, `play-${i}`));
  c.draw = Array.from({ length: 30 }, (_, i) => card('cheek-pouch', `draw-${i}`));
  c.discard = []; c.exhaust = []; c.energy = 100; c.turnMult = 0;
  c.enemies[0]!.hp = c.enemies[0]!.maxHp = 100_000;
  c.enemies[0]!.intent = { type: 'block', damage: 0, times: 1, label: 'Gain 8 Block' };
  return state;
}
const play = (state: RunState, index: number) => act(state, { type: 'play', uid: `play-${index}` });

describe('documented Zoomie Chain rules', () => {
  it('starts at zero, increments matching card types, and resets on any type switch', () => {
    let state = battle(['tail-whip', 'tail-whip', 'cheek-pouch', 'cheek-pouch', 'ngmi', 'night-owl']);
    const expected = [0, 1, 0, 1, 0, 0];
    for (let i = 0; i < expected.length; i++) {
      state = play(state, i);
      expect(state.combat!.chain).toBe(expected[i]);
    }
    expect(state.combat!.chainType).toBe('power');
  });

  it('Wheel Brake leaves the count and matched type untouched, but grants no turn retention', () => {
    let state = battle(['wheel-brake', 'tail-whip', 'cheek-pouch']);
    state.combat!.chain = 4; state.combat!.chainType = 'attack';
    state = play(state, 0);
    expect(state.combat).toMatchObject({ chain: 4, chainType: 'attack', block: 6 });
    state = play(state, 1);
    expect(state.combat!.chain).toBe(5);
    state = play(state, 2);
    expect(state.combat).toMatchObject({ chain: 0, chainType: 'skill' });
    expect(getCardPresentation(null, card('wheel-brake')).text).toContain('End turn still resets them.');
  });

  it.each(['no damage', 'enemy damage', 'Spacetime Fold'] as const)('resets at the next turn after %s', condition => {
    let state = battle(['wheel-brake']);
    state.combat!.chain = 4; state.combat!.chainType = 'attack';
    state = play(state, 0);
    state.combat!.block = 0;
    if (condition === 'enemy damage') state.combat!.enemies[0]!.intent = { type: 'attack', damage: 5, times: 1, label: 'Attack 5' };
    if (condition === 'Spacetime Fold') state.combat!.powers['spacetime-fold'] = 1;
    const hp = state.hp;
    state = act(state, { type: 'endTurn' });
    expect(state.combat).toMatchObject({ turn: 2, chain: 0, chainType: null });
    expect(state.hp).toBe(hp - (condition === 'enemy damage' ? 5 : 0));
    if (condition === 'Spacetime Fold') expect(state.combat!.powers['fold-used']).toBe(1);
  });

  it('adds extra card bonuses after type matching/reset, without exceeding 20', () => {
    let state = battle(['seed-snack', 'seed-snack', 'double-lap', 'double-lap', 'tail-whip']);
    for (const [index, expected] of [1, 3, 1, 3].entries()) {
      state = play(state, index);
      expect(state.combat!.chain).toBe(expected);
    }
    state.combat!.chain = 20;
    state = play(state, 4);
    expect(state.combat!.chain).toBe(20);
    let bonus = battle(['seed-snack']);
    bonus.combat!.chain = 19; bonus.combat!.chainType = 'skill';
    bonus = play(bonus, 0);
    expect(bonus.combat!.chain).toBe(20);
  });

  it('HP loss during a card draw does not independently reset an existing chain', () => {
    let state = battle(['seed-snack']);
    state.combat!.chain = 4; state.combat!.chainType = 'skill';
    state.combat!.draw.push(card('nyn-sob', 'drawn-curse'));
    const hp = state.hp;
    state = play(state, 0);
    expect(state.hp).toBe(hp - 2);
    expect(state.combat).toMatchObject({ chain: 6, chainType: 'skill' });
  });

  it('gm grants its extra point only on turn 1; later it still follows normal Skill matching', () => {
    let state = battle(['gm', 'gm']);
    state = play(state, 0);
    expect(state.combat!.chain).toBe(1);
    state.combat!.turn = 2;
    state = play(state, 1);
    expect(state.combat!.chain).toBe(2);
  });

  it('WAGMI itself follows normal matching, then grants wildcard matches until End Turn', () => {
    let state = battle(['wagmi', 'ngmi', 'tail-whip', 'cheek-pouch', 'wheel-brake']);
    state.combat!.chain = 4; state.combat!.chainType = 'attack';
    state = play(state, 0);
    expect(state.combat).toMatchObject({ chain: 0, chainType: 'power' });
    for (const index of [1, 2, 3]) {
      state = play(state, index);
      expect(state.combat!.chain).toBe(index);
    }
    state = play(state, 4);
    expect(state.combat).toMatchObject({ chain: 3, chainType: 'skill' });
    state = act(state, { type: 'endTurn' });
    expect(state.combat!.powers['wild-chain']).toBeUndefined();
    expect(state.combat).toMatchObject({ chain: 0, chainType: null });
    const uid = state.combat!.hand[0]!.uid;
    state = act(state, { type: 'play', uid });
    expect(state.combat!.chain).toBe(0);
  });

  it('Freeze for Mint saves pre-play scoring floors while live Chain continues to reset', () => {
    let state = battle(['freeze-for-mint', 'tail-whip']);
    state.combat!.chain = 4; state.combat!.chainType = 'attack';
    state.combat!.turnMult = 2; state.combat!.multiply = 2;
    const before = effectiveMult(state);
    state = play(state, 0);
    expect(state.combat).toMatchObject({ chain: 0, chainType: 'skill' });
    expect(state.combat!.frozenChain).toBeCloseTo(1.1 ** 4);
    expect(state.combat!.powers['frozen-mult']).toBeCloseTo(before);
    state = play(state, 1);
    state = act(state, { type: 'endTurn' });
    expect(state.combat).toMatchObject({ chain: 0, chainType: null });
    expect(effectiveMult(state)).toBeGreaterThanOrEqual(before);
  });

  it('uses 1.1 per live Chain point, or 2.2 during Zoomies, as a scoring multiplier', () => {
    const state = battle([]);
    state.combat!.chain = 3;
    expect(scoreMultipliers(state).chainMult).toBeCloseTo(1.1 ** 3);
    state.map[0]!.jackpot = true;
    expect(scoreMultipliers(state).chainMult).toBeCloseTo(2.2 ** 3);
  });
});
