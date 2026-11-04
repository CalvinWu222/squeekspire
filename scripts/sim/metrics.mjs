export function distribution(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const quantile = q => ordered.length ? ordered[Math.floor((ordered.length - 1) * q)] : null;
  return { n: ordered.length, p10: quantile(0.1), p50: quantile(0.5), p90: quantile(0.9), max: ordered.at(-1) ?? null, mean: ordered.length ? values.reduce((a, b) => a + b, 0) / ordered.length : null };
}

export function compareVariants(before, after) {
  const policies = {};
  const trajectory = s => JSON.stringify({
    seed: s.seed, day: s.day, clear: s.clear, floor: s.floorReached, hour: s.hourReached,
    floorsCleared: s.floorsCleared, hp: s.hp, actions: s.actions, turns: s.turns, guard: s.guard,
    bestHit: s.bestHit, battles: s.battles.map(b => ({ floor: b.floor, nodeId: b.nodeId, won: b.won, turns: b.turns, combatScore: b.combatScore, multiplier: b.multiplier })),
  });
  for (const policy of Object.keys(before)) {
    const old = before[policy].samples, next = after[policy].samples;
    if (old.length !== next.length) throw new Error(`Unpaired ${policy} sample counts`);
    const mismatches = old.filter((sample, i) => trajectory(sample) !== trajectory(next[i])).map(s => s.seed);
    policies[policy] = {
      pairs: old.length, trajectoryMismatches: mismatches.length, mismatchedSeeds: mismatches,
      beforeGuardCount: before[policy].guardCount, afterGuardCount: after[policy].guardCount,
      clearP90ToP10Before: before[policy].clearScore.p10 ? before[policy].clearScore.p90 / before[policy].clearScore.p10 : null,
      clearP90ToP10After: after[policy].clearScore.p10 ? after[policy].clearScore.p90 / after[policy].clearScore.p10 : null,
    };
  }
  const samples = Object.values(after).flatMap(row => row.samples);
  const clearScores = samples.filter(s => s.clear).map(s => s.score);
  const nonClearScores = samples.filter(s => !s.clear).map(s => s.score);
  const minimumClear = clearScores.length ? Math.min(...clearScores) : null;
  const maximumNonClear = nonClearScores.length ? Math.max(...nonClearScores) : null;
  return { policies, minimumClear, maximumNonClear, allSampledClearsBeatAllSampledNonClears: minimumClear !== null && maximumNonClear !== null ? minimumClear > maximumNonClear : null };
}
