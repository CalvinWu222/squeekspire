import { ENEMIES } from './catalog.js';
import type { RunState } from './engine.js';

const bounded = (value: number) => Math.min(1e300, Math.max(0, Number.isFinite(value) ? value : 1e300));

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
  return {
    number: s.battleScores.length + 1, floor: s.floor, nodeId: n.id, act: n.act, hour: n.hour,
    enemyId: n.enemyId, enemyName: ENEMIES[n.enemyId]?.name ?? c.enemies[0]?.name ?? n.enemyId,
    won, turns: c.turn, baseSqueeks: c.squeeks, ...factors, difficultyMult, hibernationMult,
    combatScore, score: won ? Math.round(bounded(combatScore * difficultyMult * hibernationMult)) : 0,
    damageTaken: c.damageTaken,
  };
}

export function runScoreSummary(s: RunState): { baseSqueeks: number; totalScore: number; damageTaken: number; turns: number; battles: number } {
  return {
    baseSqueeks: bounded(s.battleScores.reduce((total, battle) => total + battle.baseSqueeks, 0)),
    totalScore: s.totalScore,
    damageTaken: s.damageTaken,
    turns: s.battleScores.reduce((total, battle) => total + battle.turns, 0),
    battles: s.battleScores.length,
  };
}
