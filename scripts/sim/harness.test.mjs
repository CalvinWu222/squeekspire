import assert from 'node:assert/strict';
import test from 'node:test';
import { BASELINE_REF, loadGame } from './loader.mjs';
import { POLICY_NAMES, chooseAction, seededRandom } from './policies.mjs';
import { distribution } from './metrics.mjs';
import { runExploitProbes } from './probes.mjs';

test('empirical distribution uses the documented order statistics and handles empty clear cohorts', () => {
  const input = [100, 1, 3, 2, 4, 6, 8, 5, 7, 9];
  assert.deepEqual(distribution(input), { n: 10, p10: 1, p50: 5, p90: 9, max: 100, mean: 14.5 });
  assert.deepEqual(input, [100, 1, 3, 2, 4, 6, 8, 5, 7, 9]);
  assert.deepEqual(distribution([]), { n: 0, p10: null, p50: null, p90: null, max: null, mean: null });
});

test('all four bots use legal deterministic actions, with replays matching their scores', async () => {
  const loaded = await loadGame();
  try {
    const game = loaded.game;
    for (const policy of POLICY_NAMES) {
      const run = () => {
        const day = game.fallbackDay('2026-01-03');
        let state = game.createRun(day, game.generateMap(day), 'daily');
        const random = seededRandom(0x6d2b79f5 ^ 2);
        while (!['won', 'lost'].includes(state.phase)) {
          assert.ok(state.log.length < 4000, `${policy} exceeded action guard`);
          state = game.act(state, chooseAction(game, state, policy, random));
        }
        return state;
      };
      const first = run(), second = run();
      assert.deepEqual(first.log, second.log, `${policy} was nondeterministic`);
      assert.equal(first.totalScore, second.totalScore);
      assert.equal(game.replayRun(game.exportRun(first)).totalScore, first.totalScore);
    }
  } finally { await loaded.cleanup(); }
});

test('the legal stall fixture preserves spectacle while turning prolonged farming into zero payout', async () => {
  const before = await loadGame(BASELINE_REF), after = await loadGame();
  try {
    const oldProbe = runExploitProbes(before.game), newProbe = runExploitProbes(after.game);
    for (const [i, row] of newProbe.results.entries()) {
      assert.equal(row.rawVisualScore, oldProbe.results[i].rawVisualScore);
      assert.equal(row.hp, oldProbe.results[i].hp);
      assert.ok(row.earnedScore <= 1500);
      if (row.actualTurns >= 12) assert.equal(row.earnedScore, 0);
    }
    assert.ok(oldProbe.results.at(-1).earnedScore > 1e40);
    assert.ok(newProbe.results[1].earnedScore <= newProbe.results[0].earnedScore);
  } finally { await before.cleanup(); await after.cleanup(); }
});
