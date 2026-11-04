import { describe, expect, it } from 'vitest';
import { CARDS } from './catalog';
import { fallbackDay } from './data';
import { act, createRun, effectiveMult, exportRun, replayRun, scoreBattle, type RunState } from './engine';
import { generateMap } from './map';
import { battleScoreBreakdown, runScoreSummary, scoreMultipliers, CLEAR_BONUS, NON_CLEAR_CEILING, SCORE_VERSION } from './score';

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
    expect(row.score + 200).toBe(state.totalScore);
    expect(row.score).toBe(Math.round(Math.min(row.scoreCap, row.scoreCap * row.scoringQuality * row.difficultyMult * row.hibernationMult) * row.turnPenalty));
    expect(row.baseSqueeks).toBe(state.combat!.squeeks);
    expect(row.damageTaken).toBe(state.damageTaken);
    expect(runScoreSummary(state)).toMatchObject({ baseSqueeks: row.baseSqueeks, totalScore: row.score + 200, combatScore: row.score, progressionScore: 200, clearBonus: 0, floorsCleared: 1, damageTaken: row.damageTaken, turns: row.turns, battles: 1 });
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

describe('progression-weighted scoring v2', () => {
  it('does not award progression for entering or abandoning an undefeated room', () => {
    const state = firstCombat();
    expect(state.floor).toBe(1);
    expect(state.floorsCleared).toBe(0);
    expect(act(state, { type: 'abandon' }).totalScore).toBe(0);
    let won = finishFirstBattle();
    expect(won.floorsCleared).toBe(1);
    won = act(won, { type: 'reward', cardId: null });
    expect(won.floorsCleared).toBe(1); // Claiming loot never pays twice.
  });

  it.each(['battle', 'elite', 'boss'] as const)('caps %s rewards after all day modifiers and penalizes late turns', kind => {
    const state = firstCombat(), c = state.combat!;
    state.map[0]!.kind = kind; state.day.difficulty = 1.3; state.day.hibernation = true;
    c.squeeks = 1e300; c.multiply = 1e300;
    const full = battleScoreBreakdown(state, true);
    expect(full.score).toBe(full.scoreCap);
    expect(Number.isFinite(full.combatScore)).toBe(true);
    c.turn = full.turnLimit;
    expect(battleScoreBreakdown(state, true).score).toBe(full.scoreCap);
    c.turn = full.turnLimit + 1;
    expect(battleScoreBreakdown(state, true).score).toBeLessThan(full.scoreCap);
    c.turn = full.turnLimit * 2;
    expect(battleScoreBreakdown(state, true).score).toBe(0);
    c.turn = 10_000;
    expect(battleScoreBreakdown(state, true).score).toBe(0);
    expect(battleScoreBreakdown(state, false).score).toBe(0);
  });

  it('keeps raw visual combo growth while applying square-root diminishing returns', () => {
    const state = firstCombat(), c = state.combat!;
    state.map[0]!.jackpot = false; state.day.difficulty = 1; state.day.hibernation = false;
    c.squeeks = 200; c.addMult = 1; c.turnMult = 0; c.chain = 0;
    c.multiply = 4;
    const low = battleScoreBreakdown(state, true);
    c.multiply = 16;
    const high = battleScoreBreakdown(state, true);
    expect(high.combatScore).toBe(low.combatScore * 4);
    expect(high.score).toBe(low.score * 2);
    expect(high.softMultiplier).toBe(4);
    c.multiply = 1e300;
    expect(scoreBattle(state)).toBeGreaterThan(1e100);
    expect(battleScoreBreakdown(state, true).score).toBe(1_500);
  });

  it('makes every clear outrank even an adversarial maximum-depth non-clear', () => {
    const farmer = firstCombat(), c = farmer.combat!;
    c.squeeks = 1e300; c.multiply = 1e300;
    farmer.floorsCleared = 24;
    // Stress the run budget beyond canonical map possibilities as a future-map guard.
    farmer.battleScores = Array.from({ length: 100 }, () => battleScoreBreakdown(farmer, true));
    farmer.phase = 'lost';
    const nonclear = runScoreSummary(farmer);
    expect(nonclear.totalScore).toBe(NON_CLEAR_CEILING);
    expect(nonclear.totalScore).toBe(nonclear.progressionScore + nonclear.combatScore);
    const clear = createRun(farmer.day, farmer.map, 'daily');
    clear.phase = 'won';
    expect(runScoreSummary(clear).totalScore).toBe(CLEAR_BONUS);
    expect(runScoreSummary(clear).totalScore).toBeGreaterThan(nonclear.totalScore);
  });

  it('gives skillful Mult clears a meaningful bounded premium on the same full route', () => {
    const state = firstCombat(), c = state.combat!;
    state.day.difficulty = 1; state.day.hibernation = false;
    state.floorsCleared = 24; state.phase = 'won';
    const simulate = (mult: number) => {
      state.battleScores = [];
      for (const n of state.map.filter(n => ['battle', 'elite', 'boss'].includes(n.kind))) {
        state.currentNode = n.id; n.jackpot = false;
        c.squeeks = 200; c.addMult = 1; c.turnMult = 0; c.chain = 0; c.multiply = mult;
        state.battleScores.push(battleScoreBreakdown(state, true));
      }
      return runScoreSummary(state).totalScore;
    };
    const standard = simulate(1), skillful = simulate(100), extreme = simulate(1e300);
    expect(skillful / standard).toBeGreaterThanOrEqual(1.5);
    expect(extreme / standard).toBeLessThanOrEqual(3);
    expect(extreme).toBe(skillful);
  });

  it('exports and verifies the score version and rejects old replays before replaying', () => {
    const state = finishFirstBattle(), payload = exportRun(state);
    expect(payload.scoreVersion).toBe(SCORE_VERSION);
    expect(replayRun(payload).totalScore).toBe(state.totalScore);
    expect(() => replayRun({ ...payload, scoreVersion: SCORE_VERSION - 1 })).toThrow(/score version/);
    const { scoreVersion: _version, ...legacy } = payload;
    expect(() => replayRun(legacy as typeof payload)).toThrow(/score version/);
  });
});
