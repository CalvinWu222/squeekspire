import { describe, expect, it } from 'vitest';
import { CARDS } from './catalog';
import { fallbackDay } from './data';
import { act, createRun, effectiveMult, exportRun, replayRun, scoreBattle, type RunState } from './engine';
import { generateMap } from './map';
import { battleScoreBreakdown, runScoreSummary, scoreMultipliers } from './score';

function firstCombat(): RunState {
  const day = fallbackDay('2026-11-04');
  const state = createRun(day, generateMap(day), 'practice');
  return act(state, { type: 'enter', nodeId: 0 });
}

function finishFirstBattle(): RunState {
  let state = firstCombat();
  for (let turn = 0; turn < 200 && state.phase === 'combat'; turn++) {
    const c = state.combat!;
    const available = c.hand.filter(card => CARDS[card.id]!.cost !== 'X' && (CARDS[card.id]!.cost as number) <= c.energy);
    const card = available.find(card => CARDS[card.id]!.type === 'attack') ?? available[0];
    state = act(state, card ? { type: 'play', uid: card.uid } : { type: 'endTurn' });
  }
  return state;
}

describe('score explanations and combat accounting', () => {
  it('shares additive, trigger, chain and frozen floors with the effective combat multiplier', () => {
    const state = firstCombat(), c = state.combat!;
    state.map[0]!.jackpot = false;
    c.squeeks = 123; c.addMult = 3; c.turnMult = 0.5; c.multiply = 2; c.chain = 2; c.frozenChain = 1;
    const normal = scoreMultipliers(state);
    expect(normal).toMatchObject({ additiveMult: 3.5, triggerMult: 2, frozenMult: 0, minimumMult: 1 });
    expect(normal.chainMult).toBeCloseTo(1.1 ** 2);
    expect(normal.multiplier).toBe(effectiveMult(state));
    expect(battleScoreBreakdown(state, true).combatScore).toBe(scoreBattle(state));
    c.powers['frozen-mult'] = 100;
    state.minMult = 80;
    expect(scoreMultipliers(state).multiplier).toBe(100);
    c.powers['frozen-mult'] = 10;
    expect(scoreMultipliers(state).multiplier).toBe(80);
  });

  it('records each paid battle exactly once and reconstructs its breakdown from replay actions', () => {
    const state = finishFirstBattle();
    expect(state.phase).toBe('reward');
    expect(state.battleScores).toHaveLength(1);
    const row = state.battleScores[0]!;
    expect(row.won).toBe(true);
    expect(row.score).toBe(state.totalScore);
    expect(row.score).toBe(Math.round(row.combatScore * row.difficultyMult * row.hibernationMult));
    expect(row.baseSqueeks).toBe(state.combat!.squeeks);
    expect(row.damageTaken).toBe(state.damageTaken);
    expect(runScoreSummary(state)).toMatchObject({ baseSqueeks: row.baseSqueeks, totalScore: row.score, damageTaken: row.damageTaken, turns: row.turns, battles: 1 });
    expect(replayRun(exportRun(state))).toEqual(state);
    const retired = act(state, { type: 'abandon' });
    expect(retired.battleScores).toEqual(state.battleScores);
  });

  it('retains damage taken when the same card heals and then ends the turn', () => {
    const state = firstCombat(), c = state.combat!;
    state.hp = 10;
    c.enemies = [c.enemies[0]!];
    c.enemies[0]!.id = 'dust-mite';
    c.enemies[0]!.strength = 9;
    c.enemies[0]!.intent = { type: 'attack', damage: 12, times: 1, label: 'Attack 12' };
    c.hand = [{ id: 'touch-grass', uid: 'grass', level: 0, mergeLevel: 0 }];
    c.draw = []; c.discard = []; c.block = 0;
    const healed = act(state, { type: 'play', uid: 'grass' });
    expect(healed.hp).toBe(60);
    expect(healed.damageTaken).toBe(12);
    expect(healed.combat!.damageTaken).toBe(12);
    const retired = act(healed, { type: 'abandon' });
    expect(retired.battleScores).toHaveLength(1);
    expect(retired.battleScores[0]).toMatchObject({ won: false, score: 0, damageTaken: 12 });
  });

  it.each(['shop', 'rest', 'event'] as const)('does not fabricate a defeated battle when retiring in a %s', kind => {
    let state = finishFirstBattle();
    const previousRows = structuredClone(state.battleScores);
    // The engine retains the previous combat state between rooms. Custom map
    // fixtures exercise the same transition for each possible noncombat room.
    state.map[1]!.kind = kind;
    state = act(state, { type: 'reward', cardId: null });
    state = act(state, { type: 'enter', nodeId: 1 });
    expect(state.phase).toBe(kind);
    const retired = act(state, { type: 'abandon' });
    expect(retired.battleScores).toEqual(previousRows);
  });

  it('counts event HP costs only in the run total, with the actual nonlethal loss', () => {
    let state = finishFirstBattle();
    const battleDamage = state.combat!.damageTaken;
    state.map[1]!.kind = 'event';
    state = act(state, { type: 'reward', cardId: null });
    state = act(state, { type: 'enter', nodeId: 1 });
    state.hp = 3;
    const before = state.damageTaken;
    state = act(state, { type: 'event', option: 0 });
    expect(state.hp).toBe(1);
    expect(state.damageTaken).toBe(before + 2);
    expect(state.combat!.damageTaken).toBe(battleDamage);
    expect(state.battleScores).toHaveLength(1);
  });
});
