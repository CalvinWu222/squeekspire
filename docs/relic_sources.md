# Relic acquisition sources

Audited against `src/game/catalog.ts`, `src/game/engine.ts` (`createRun`, `findRelic`, `checkCombat`, `shop`, `act`) and `src/game/map.ts`. There are **15 relics**. All are obtainable; relic rarity does not weight drops.

## Exact source table after the fixes

`U` is the number of relics not yet owned immediately before generating the source. Each elite victory, boss victory, or opened Treasure room grants **one guaranteed unowned relic** when `U > 0`; a particular unowned relic has probability `1/U`. Shops sample without replacement, offering `min(2, U)` different unowned relics; a particular unowned relic is offered with probability `min(2, U)/U`. A shop offer is acquired only if bought with in-game coins. All random choices use the seeded run RNG, so a fixed action sequence reproduces the same results.

| Relic (code ID) | Rarity | Starting relic | Elite victory | Boss victory | Shop offer | Treasure / chest | Ordinary battles / events |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Midnight Wheel (`midnight-wheel`) | Common | 100%, every run | Already owned | Already owned | Already owned | Already owned | 0% |
| WHEELY9000 Gear (`wheely9000`) | Uncommon | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Genesis Seed (`genesis`) | Rare | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Live Camera (`live-camera`) | Common | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Aura Halo (`aura`) | Uncommon | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Name Tag (`name-tag`) | Common | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Wheelpaper Fragment (`wheelpaper`) | Common | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Pillhead’s Blessing (`pillhead`) | Rare | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Diamond Hands (`diamond-hands`) | Uncommon | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Airdrop Farmer (`airdrop-farmer`) | Uncommon | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Probably Nothing (`probably-nothing`) | Common | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Stay Squeeky (`stay-squeeky`) | Common | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Sunflower Seeds on the Wheel (`sunflower-wheel`) | Uncommon | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| HamsterFi (`hamsterfi`) | Uncommon | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |
| Early Buildooooor (`early-buildooooor`) | Rare | 0% | `1/U` | `1/U` | `min(2,U)/U` | `1/U` | 0% |

For example, with only the starting Midnight Wheel owned, `U = 14`: a specific relic has a **7.143%** chance per elite/boss/treasure pickup and a **14.286%** chance to appear among a shop's two relic offers. The chance to receive *some* new relic from a completed elite, boss or Treasure room is **100%**, not 7.143%. Once all 15 are owned, no source creates duplicates: rewards have no relic and shops have no relic offers. Midnight Wheel is technically in the same unowned pool if an artificial state removes it; normal runs always own it from the start.

Shop relic base prices are Common **145**, Uncommon **240**, Rare **300** in-game coins, multiplied by the day's `priceMultiplier`, then by `0.85` if HamsterFi is already owned, and rounded. The discount is calculated when entering the shop. Ordinary fight rewards contain cards and coins only. Neither event choice grants relics: option 0 grants coins for HP; option 1 heals and grants a card. Airdrop Farmer grants cards, not additional relics. Genesis Seed's rare card and Name Tag / Probably Nothing's upgrades trigger on pickup from every source.

## Map placement and the bug found

Each eight-hour act has one shop, one rest, and now **one Treasure room**. Treasure placement prefers a spare non-jackpot room, preserving act-opening battles, shops, rests, optional elites and mandatory gates. If three jackpots crowd out every spare room in an act, treasure replaces the optional pre-rest fight; act openings, mandatory gates, recovery and jackpot combat are preserved. Forks can skip a room, including a treasure or shop. The mandatory gates are map hours **8 and 16** (elites) and **24** (boss); these cannot be skipped. Optional elite placement depends on the pre-rest room's work: positive work makes it an elite, zero work a normal battle, unless needed for the treasure fallback above.

Before these changes, all nonstarter relics were already eligible for guaranteed elite rewards and a shop's **one** relic offer. There were **no treasure nodes** and **no event relics**. The final boss's victory code called `completeNode()` **before** generating rewards in Daily and Practice, so it awarded **zero relics**. Endless bypassed that early return and did receive a boss relic. The fix awards the boss relic before ending the run, adds one guaranteed-relic treasure room per act, and stocks two distinct unowned relics in each shop (one if only one remains). The relic is acquired automatically on an elite/boss win or opening treasure; skipping a card reward does not discard it.

## Reproducible before/after survey (200 runs per version)

Run `npm.cmd run simulate:relics -- --output docs/relic_simulation.json`. The script loads the real baseline engine/map from Git commit `612b709` and the current working-tree code in separate temporary modules. Full data, seed dates, source counts and floor counts are in [`relic_simulation.json`](relic_simulation.json).

The 200 daily seeds cover **2026-01-01 through 2026-07-19**, using the published fallback hourly data. An independent seeded RNG chooses uniformly among each room's legal onward routes. The harness uses real map, reward, event, shop and pickup reducers; it forces each fight to a one-play win, skips card rewards, chooses peaceful events, and buys affordable shop relics cheapest first without spending coins elsewhere. These are **acquisition results conditional on completing the route**, not player win-rate or combat-difficulty estimates. Real short/lost runs will encounter fewer relics.

“Distinct seen” counts unique relic IDs owned or offered in a shop within a run, including the starter. “Encounters” also count repeat shop offers. “Acquired” counts owned relics, including purchases and the starter; unbought offers do not count as acquired.

| Metric per completed run | Before | After |
| --- | ---: | ---: |
| Average distinct relics seen | 6.175 | 10.435 |
| Average relic encounters, including repeat offers | 6.465 | 11.915 |
| Average relics acquired | 4.980 | 8.355 |
| Distinct relics seen, minimum–maximum | 4–8 | 7–14 |
| Catalog relics acquired across all 200 runs | 15 / 15 | 15 / 15 |
| Starter acquired | 1.000 | 1.000 |
| Elite relics acquired | 3.190 | 3.200 |
| Boss relics acquired | 0.000 | 1.000 |
| Treasure relics acquired | 0.000 | 2.135 |
| Shop relics offered | 2.275 | 4.580 |
| Shop relics bought | 0.790 | 1.020 |

Observed **map hours** at which relics appeared in this seed sample (not an exhaustive list of possible placements on other daily data):

| Source | Before hours | After hours |
| --- | --- | --- |
| Starter | Before entering floor 1 | Before entering floor 1 |
| Elite rewards | 6, 8, 10, 16 | 6, 8, 10, 16 |
| Boss reward | None | 24 |
| Treasure rooms | None | 2, 3, 12, 18, 19, 20, 21 |
| Shop offers | 2, 3, 13, 14, 15, 18, 19, 20, 21, 22, 23 | 2, 3, 13, 14, 15, 18, 19, 20, 21, 22, 23 |

The following table uses **visited floor number**, which differs from map hour when a route skips rooms. Values are encounters/acquisitions at that floor divided by **all 200 runs**, not just runs that reached that floor. Repeat offers can be counted here; sums match the encounters/acquired averages above. No sampled route visited 24 rooms.

| Visited floor | Before seen | Before acquired | After seen | After acquired |
| --- | ---: | ---: | ---: | ---: |
| 0 (starter) | 1.000 | 1.000 | 1.000 | 1.000 |
| 1 | 0.000 | 0.000 | 0.000 | 0.000 |
| 2 | 0.500 | 0.000 | 1.500 | 0.500 |
| 3 | 0.245 | 0.000 | 0.730 | 0.240 |
| 4 | 0.160 | 0.160 | 0.170 | 0.170 |
| 5 | 0.435 | 0.435 | 0.440 | 0.440 |
| 6 | 0.590 | 0.590 | 0.605 | 0.605 |
| 7 | 0.450 | 0.450 | 0.430 | 0.430 |
| 8 | 0.300 | 0.300 | 0.340 | 0.340 |
| 9 | 0.260 | 0.240 | 0.555 | 0.485 |
| 10 | 0.215 | 0.130 | 0.760 | 0.485 |
| 11 | 0.320 | 0.160 | 0.715 | 0.375 |
| 12 | 0.400 | 0.295 | 0.665 | 0.435 |
| 13 | 0.560 | 0.480 | 0.655 | 0.525 |
| 14 | 0.315 | 0.290 | 0.520 | 0.415 |
| 15 | 0.175 | 0.125 | 0.535 | 0.315 |
| 16 | 0.205 | 0.130 | 0.565 | 0.305 |
| 17 | 0.150 | 0.095 | 0.465 | 0.255 |
| 18 | 0.110 | 0.055 | 0.430 | 0.290 |
| 19 | 0.055 | 0.040 | 0.385 | 0.320 |
| 20 | 0.015 | 0.005 | 0.260 | 0.245 |
| 21 | 0.005 | 0.000 | 0.155 | 0.145 |
| 22 | 0.000 | 0.000 | 0.025 | 0.025 |
| 23 | 0.000 | 0.000 | 0.010 | 0.010 |

Regression coverage in `src/game/relic-sources.test.ts` exercises 200 map/activity profiles and all 2,024 combinations of three jackpot hours, every relic's elite/boss/treasure/shop availability, both normal and final-floor rewards, treasure continuation, distinct shop stock, pickup effects and collection exhaustion.

This update changes map generation and reward RNG consumption. Replay exports and
active saves created under earlier rules may fail validation against this release;
new runs replay deterministically under the updated rules.
