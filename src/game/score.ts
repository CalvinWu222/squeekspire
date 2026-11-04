import { ENEMIES } from './catalog.js';
import type { RunState } from './engine.js';

const bounded = (value: number) => Math.min(1e300, Math.max(0, Number.isFinite(value) ? value : 1e300));

export const SCORE_VERSION = 2;
export const FLOOR_POINTS = 200;
export const ELITE_POINTS = 300;
export const BOSS_POINTS = 1_000;
export const CLEAR_BONUS = 20_000;
export const NON_CLEAR_CEILING = CLEAR_BONUS - 1;
export const BATTLE_CAPS = { normal: 1_500, elite: 2_100, boss: 3_000 } as const;
export const BATTLE_TURN_LIMITS = { normal: 6, elite: 8, boss: 10 } as const;

export interface ScoreMultipliers {
  additiveMult: number;
  triggerMult: number;
  chainMult: number;
  frozenMult: number;
  minimumMult: number;
  multiplier: number;
}

/** The scoring rule is shared by combat, replay recording and the results explanation. */
export function scoreMultipliers(s: RunState): ScoreMultipliers {
  const c = s.combat;
  if (!c) return { additiveMult: 1, triggerMult: 1, chainMult: 1, frozenMult: 0, minimumMult: s.minMult, multiplier: Math.max(1, s.minMult) };
  const additiveMult = Math.max(0, c.addMult + c.turnMult);
  const triggerMult = c.multiply;
  const chainMult = Math.max(Math.pow(1.1 * (s.map[s.currentNode]?.jackpot ? 2 : 1), Math.min(20, c.chain)), c.frozenChain);
  const frozenMult = c.powers['frozen-mult'] ?? 0;
  const minimumMult = s.minMult;
  const multiplier = bounded(Math.max(minimumMult, frozenMult, additiveMult * triggerMult * chainMult));
  return { additiveMult, triggerMult, chainMult, frozenMult, minimumMult, multiplier };
}

export interface BattleScoreBreakdown extends ScoreMultipliers {
  number: number;
  floor: number;
  nodeId: number;
  act: number;
  hour: number;
  enemyId: string;
  enemyName: string;
  won: boolean;
  turns: number;
  baseSqueeks: number;
  difficultyMult: number;
  hibernationMult: number;
  combatScore: number;
  scoreCap: number;
  softMultiplier: number;
  scoringQuality: number;
  turnLimit: number;
  turnPenalty: number;
  score: number;
  damageTaken: number;
}

/** Snapshot a finished fight before its combat state is replaced by the next room. */
export function battleScoreBreakdown(s: RunState, won: boolean): BattleScoreBreakdown {
  const c = s.combat;
  if (!c) throw new Error('A battle score requires combat');
  const n = s.map[s.currentNode]!;
  const factors = scoreMultipliers(s);
  const combatScore = Math.round(bounded(c.squeeks * factors.multiplier));
  const difficultyMult = s.day.difficulty;
  const hibernationMult = s.day.hibernation ? 1.2 : 1;
  const kind = n.kind === 'boss' ? 'boss' : n.kind === 'elite' ? 'elite' : 'normal';
  const scoreCap = BATTLE_CAPS[kind];
  const turnLimit = BATTLE_TURN_LIMITS[kind];
  // Combat keeps its spectacular raw numbers. Only the awarded points use
  // square-root returns, a fixed room budget, and a declining late-turn budget.
  const softMultiplier = Math.sqrt(bounded(factors.multiplier));
  const scoringQuality = Math.min(1, Math.sqrt(bounded(c.squeeks) / 200) * softMultiplier / 10);
  const turnPenalty = Math.max(0, Math.min(1, (2 * turnLimit - c.turn) / turnLimit));
  const score = won ? Math.round(Math.min(scoreCap, scoreCap * scoringQuality * difficultyMult * hibernationMult) * turnPenalty) : 0;
  return {
    number: s.battleScores.length + 1, floor: s.floor, nodeId: n.id, act: n.act, hour: n.hour,
    enemyId: n.enemyId, enemyName: ENEMIES[n.enemyId]?.name ?? c.enemies[0]?.name ?? n.enemyId,
    won, turns: c.turn, baseSqueeks: c.squeeks, ...factors, difficultyMult, hibernationMult,
    combatScore, scoreCap, softMultiplier, scoringQuality, turnLimit, turnPenalty, score,
    damageTaken: c.damageTaken,
  };
}

/** The same total is used after every action, in the client and server replay. */
export function runScoreSummary(s: RunState) {
  const wins = s.battleScores.filter(battle => battle.won);
  const eliteKills = wins.filter(battle => s.map[battle.nodeId]?.kind === 'elite').length;
  const bossKills = wins.filter(battle => s.map[battle.nodeId]?.kind === 'boss').length;
  const progressionScore = s.floorsCleared * FLOOR_POINTS + eliteKills * ELITE_POINTS + bossKills * BOSS_POINTS;
  const clearBonus = s.phase === 'won' ? CLEAR_BONUS : 0;
  const earnedCombatScore = wins.reduce((total, battle) => total + battle.score, 0);
  // A run-wide non-clear budget makes completion outrank every unfinished run,
  // independently of route, seed, difficulty, or future map room counts.
  const combatScore = s.phase === 'won' ? earnedCombatScore : Math.min(earnedCombatScore, Math.max(0, NON_CLEAR_CEILING - progressionScore));
  const countedProgression = s.phase === 'won' ? progressionScore : Math.min(progressionScore, NON_CLEAR_CEILING);
  return {
    baseSqueeks: bounded(s.battleScores.reduce((total, battle) => total + battle.baseSqueeks, 0)),
    floorsCleared: s.floorsCleared, eliteKills, bossKills,
    progressionScore: countedProgression, clearBonus, combatScore,
    totalScore: countedProgression + clearBonus + combatScore,
    damageTaken: s.damageTaken,
    turns: s.battleScores.reduce((total, battle) => total + battle.turns, 0),
    battles: s.battleScores.length,
  };
}
