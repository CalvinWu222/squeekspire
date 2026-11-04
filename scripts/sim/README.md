# Scoring balance simulations

Run from the repository root using Node 22 and portable Git on `PATH`:

```powershell
npm.cmd run simulate:balance
node scripts/sim/index.mjs --runs 500 --seed 0 --variant both --output docs/balance_simulation.json
node --test scripts/sim/harness.test.mjs
```

The default compares the exact old source at `6c15f32f1e4427650e37be7709aa9a5fd84f8de6` with the current checkout, with 500 seeds for each of four policies in each version (4,000 complete run attempts). `--variant before` and `--variant after` can run independently. `--runs` and `--seed` enable smaller diagnostics or independent samples. The saved JSON records all samples, battle payouts/turns, floor and hour reached, clear-only and non-clear distributions, raw Mult, guard counts, and policy definitions. Floor reached counts rooms entered; hour reached is map position, which differs because routes can skip an hour.

`loader.mjs` transpiles the actual game source to an isolated temporary directory. Bots call the same pure `act` reducer as the client and replay. Their decks, relics, enemies, HP, map, draws and rewards are never modified. Policies inspect public state and legal Oracle choices only. Legal choices are seeded and repeated across scoring versions. The score-greedy policy deliberately postpones lethal attacks, while buying Mult powers; it still has to survive real enemy actions. The other policies value survival, choose actions randomly, or prioritize clearing.

Each bot legally ends its turn after 40 plays, bounding zero-cost draw/energy loops within a turn. Runs stop naturally on a win/loss. A 4,000-action or 100-turn fight guard records the intervention and uses a legal `abandon` action. These are bot/harness runtime limits; the scoring rules independently remove late-fight payouts. Clear rates describe these bots against the published fallback snapshot and varied date seeds, not human player win rates.

`probes.mjs` contains a separate, explicitly curated adversarial scenario. Its constructed deck, relics and golden room are set up before combat; every subsequent play and turn is a real engine action. This fixture demonstrates sustainable stalling and exponential raw Mult while preserving the distinction from the unmodified 500-run cohorts.
