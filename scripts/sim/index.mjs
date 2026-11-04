import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { BASELINE_REF, loadGame } from './loader.mjs';
import { POLICY_NAMES, chooseAction, seededRandom } from './policies.mjs';
import { runExploitProbes } from './probes.mjs';
import { distribution, compareVariants } from './metrics.mjs';

const arg = (name, fallback) => process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : fallback;
const runs = Number(arg('--runs', '500'));
if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');
const variants = arg('--variant', 'both');
const firstSeed = Number(arg('--seed', '0'));
const actionLimit = 4000, battleTurnLimit = 100;

function runPolicy(game, policy) {
  const samples = [];
  for (let sample = firstSeed; sample < firstSeed + runs; sample++) {
    const date = new Date(Date.UTC(2026, 0, 1 + sample)).toISOString().slice(0, 10);
    const day = game.fallbackDay(date);
    let state = game.createRun(day, game.generateMap(day), 'daily');
    const random = seededRandom(0x6d2b79f5 ^ sample);
    let guard = null;
    while (state.phase !== 'won' && state.phase !== 'lost') {
      if (state.log.length >= actionLimit || state.phase === 'combat' && state.combat.turn > battleTurnLimit) {
        guard = state.log.length >= actionLimit ? 'action-limit' : 'turn-limit';
        state = game.act(state, { type: 'abandon' });
        break;
      }
      const action = chooseAction(game, state, policy, random);
      try { state = game.act(state, action); }
      catch (error) { throw new Error(`${policy} seed ${sample} phase ${state.phase} action ${JSON.stringify(action)}: ${error.message}`, { cause: error }); }
    }
    samples.push({
      seed: sample, day: date, score: state.totalScore, clear: state.phase === 'won', floorReached: state.floor,
      hourReached: state.currentNode + 1, floorsCleared: state.floorsCleared ?? (state.floor - (state.phase === 'lost' ? 1 : 0)),
      hp: state.hp, actions: state.log.length, guard, bestHit: state.bestHit,
      turns: state.battleScores.reduce((sum, battle) => sum + battle.turns, 0),
      battles: state.battleScores.map(b => ({ floor: b.floor, nodeId: b.nodeId, won: b.won, turns: b.turns, score: b.score, combatScore: b.combatScore, rawCombatScore: b.rawCombatScore ?? b.combatScore, multiplier: b.multiplier })),
    });
    if ((sample - firstSeed + 1) % 100 === 0) console.log(`  ${policy}: ${sample - firstSeed + 1}/${runs} seeds complete`);
  }
  const clears = samples.filter(s => s.clear), failures = samples.filter(s => !s.clear);
  const battles = samples.flatMap(s => s.battles);
  return {
    runs, clearCount: clears.length, clearRate: clears.length / runs, score: distribution(samples.map(s => s.score)),
    clearScore: distribution(clears.map(s => s.score)), nonClearScore: distribution(failures.map(s => s.score)),
    floorReached: distribution(samples.map(s => s.floorReached)), hourReached: distribution(samples.map(s => s.hourReached)),
    floorsCleared: distribution(samples.map(s => s.floorsCleared)), perBattleScore: distribution(battles.filter(b => b.won).map(b => b.score)),
    perBattleTurns: distribution(battles.map(b => b.turns)), runTurns: distribution(samples.map(s => s.turns)),
    guardCount: samples.filter(s => s.guard).length,
    samples,
  };
}

const result = {
  baselineRef: BASELINE_REF, runsPerPolicy: runs, firstSeed,
  method: {
    daySource: 'fallbackDay UTC dates starting 2026-01-01; sample seed is day offset',
    engine: 'Actual createRun, generateMap and act reducers transpiled from git baseline/current source; no injected cards, HP, damage, relics or altered state.',
    policies: {
      'score-greedy': 'Select score powers/Mult rewards; favor scoring routes, block and delay lethal attacks while HP >16 through turn 24, then try to win. Raw visual score drives scoring choices under both rules.',
      survival: 'Value preventing incoming damage and healing, choose recovery/treasure routes and efficient combat cards.',
      random: 'Seeded uniform playable-card choices with 8% chance to end turn; uniform route/reward/event choices; deterministic canonical target and choice-card options; buys affordable useful cards.',
      'clear-focused': 'Value damage, lethal plays, efficient block and enemy debuffs; choose recovery/treasure routes, damage upgrades and useful rewards.',
    },
    visibility: 'Bots inspect current hand, public intents, revealed map and legal Oracle draw choices; no hidden draw inspection.',
    guards: { actionLimit, battleTurnLimit, policyPlaysPerTurn: 40, behavior: 'Bots legally end their turn after 40 plays to bound zero-cost draw/energy loops. The run action/turn guards record intervention and legally abandon; these are harness runtime limits, not scoring rules.' },
    comparison: 'Same date seeds and policy source before/after. Scoring-only changes should preserve trajectories. Bots are diagnostics, not estimates of human win rate.',
    quantiles: 'Sorted empirical order statistic at floor((n-1)*q); null for empty samples.',
  },
};
for (const variant of variants === 'both' ? ['before', 'after'] : [variants]) {
  if (!['before', 'after'].includes(variant)) throw new Error('--variant must be before, after or both');
  const loaded = await loadGame(variant === 'before' ? BASELINE_REF : undefined);
  try {
    result[variant] = {};
    for (const policy of POLICY_NAMES) {
      const start = Date.now();
      const report = runPolicy(loaded.game, policy);
      result[variant][policy] = report;
      console.log(`${variant} ${policy}: ${report.runs} runs; score ${report.score.p10}/${report.score.p50}/${report.score.p90}/${report.score.max}; clears ${report.clearCount} (${(100 * report.clearRate).toFixed(1)}%); floor p50 ${report.floorReached.p50}; ${(Date.now() - start) / 1000}s`);
    }
    result[`${variant}ExploitProbes`] = runExploitProbes(loaded.game);
  } finally { await loaded.cleanup(); }
}
if (result.before && result.after) result.comparison = compareVariants(result.before, result.after);
const output = path.resolve(arg('--output', 'docs/balance_simulation.json'));
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${output}`);
