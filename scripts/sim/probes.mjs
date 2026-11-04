/** Curated adversarial fixtures, separate from unmodified seeded bot runs. */
export function runExploitProbes(game) {
  const results = [];
  for (const targetTurn of [4, 6, 12, 24, 48, 96]) {
    const day = game.fallbackDay('2026-01-01');
    const map = game.generateMap(day);
    // Explicit scenario setup: a golden Dust Mite room and a constructed legal
    // deck/relic build. After setup every transition goes through act().
    map[0] = { ...map[0], kind: 'battle', enemyId: 'dust-mite', jackpot: true };
    let state = game.createRun(day, map, 'daily');
    state.deck = ['night-owl', 'genesis-seed', 'nocturnal', 'ser', 'ser', 'bedding-fort', 'seed-snack', 'rug-pull', 'gas-war'].map((id, i) => ({ id, uid: `fixture-${i}`, level: 1, mergeLevel: 0 }));
    state.relics = ['midnight-wheel', 'diamond-hands', 'wheely9000', 'sunflower-wheel'];
    state = game.act(state, { type: 'enter', nodeId: 0 });
    let peakRawScore = 0;
    while (state.phase === 'combat' && state.combat.turn <= targetTurn + 5) {
      const c = state.combat;
      const playable = id => c.hand.find(k => k.id === id && !game.cardPlayDisabledReason(state, k));
      let action;
      if (c.turn >= targetTurn && playable('rug-pull') && playable('gas-war') && c.energy >= 2) {
        state = game.act(state, { type: 'play', uid: playable('rug-pull').uid });
        const gas = state.combat.hand.find(k => k.id === 'gas-war');
        state = game.act(state, { type: 'play', uid: gas.uid });
        peakRawScore = Math.max(peakRawScore, game.scoreBattle(state));
        break;
      }
      const ser = playable('ser');
      if (ser && c.enemies.some(e => e.hp > 0 && e.intent.type === 'attack')) action = { type: 'play', uid: ser.uid };
      if (!action && c.turn < targetTurn) {
        for (const id of ['nocturnal', 'night-owl', 'genesis-seed', 'seed-snack']) {
          const card = playable(id);
          // Avoid replaying a retained zero-cost Seed Snack forever after deck depletion.
          if (card && (id !== 'seed-snack' || c.draw.length)) { action = { type: 'play', uid: card.uid }; break; }
        }
      }
      state = game.act(state, action ?? { type: 'endTurn' });
      peakRawScore = Math.max(peakRawScore, game.scoreBattle(state));
    }
    const battle = state.battleScores[0];
    if (!battle?.won) throw new Error(`Stall fixture did not win at target ${targetTurn}`);
    results.push({ targetTurn, actualTurns: battle.turns, hp: state.hp, earnedScore: battle.score, combatScore: battle.combatScore, rawVisualScore: peakRawScore, multiplier: battle.multiplier, baseSqueeks: battle.baseSqueeks });
  }
  return {
    setup: 'Curated golden Dust Mite room, upgraded Night Owl / Genesis Seed / Nocturnal / 2x Ser / Bedding Fort / Seed Snack / Rug Pull / Gas War; Midnight Wheel, Diamond Hands, WHEELY9000 Gear, Sunflower Wheel. Scenario deck/relic/map setup precedes combat; all subsequent plays/end turns are actual legal engine actions. This is an exploit stress fixture, not part of the 500-run bot cohorts or a drop-probability claim.',
    strategy: 'Retain Ser to suppress attacks, play passive Squeek and Mult powers, delay lethal, then Rug Pull enemy Block and finish with Gas War.',
    results,
  };
}
