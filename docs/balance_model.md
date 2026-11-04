# Progression-weighted scoring, version 2

Scoring v2 rewards completing the spire first, then building strong combos and
finishing fights efficiently. Raw Squeeks, Mult, chain effects, number formatting,
and celebration animations retain their original growth. They are explicitly
labelled **combo**, rather than the points admitted to the leaderboard.

## Reproduction and scope

```powershell
npm.cmd run simulate:balance
npm.cmd test
npm.cmd run test:sim
npm.cmd run build
```

The checked-in [full report](balance_simulation.json) compares the actual engine at
`6c15f32f1e4427650e37be7709aa9a5fd84f8de6` with this implementation. Each version
runs 500 deterministic date seeds per policy: **4,000 run attempts in total**.
The dates begin 2026-01-01 and use the published fallback hourly snapshot. The
same policy, seeded decisions, real map, rewards, shop, shuffle, enemy actions,
and combat reducer run under both versions. The cohort never injects cards,
changes enemy HP, or forces wins.

The policies are score-greedy/stall-farming, survival/balanced, random, and
clear-focused. They inspect public combat/map state and legal Oracle choices.
The farmer delays lethal attacks while building score and blocking; survival
values avoiding damage and recovery; clear-focused values damage, debuffs and
lethal plays. Random makes seeded legal decisions. Exact heuristics are in
[`scripts/sim/policies.mjs`](../scripts/sim/policies.mjs).

The harness separately records rooms entered, rooms completed, and map hour
reached: routes can skip an hour. Its runtime guards legally abandon after 4,000
actions or a fight exceeds 100 turns, and record every intervention. These are
simulation limits, not game scoring rules. Quantiles use the sorted observation
at `floor((n - 1) * q)`. Clear rates measure these bots, not human win rates.

## Exploits in version 1

1. **Progression had no explicit value.** Score was only the sum of winning
   fights' `round(round(Squeeks * Mult) * difficulty * hibernation)`. Rooms,
   elite difficulty, and clearing had no guaranteed reward.
2. **Sustainable passive farming.** Retained Ser can convert attacks to Block;
   defensive builds can survive while Night Owl adds Squeeks and Genesis Seed
   or Overclock compounds Mult every turn. The enemy can remain alive indefinitely.
3. **Multiplicative runaway.** Zoomies doubles trigger factors, Genesis can stack,
   and Gas War/Wen Mint can grow Squeeks. Rug Pull even converts enemy Block
   accumulated during the stall into Squeeks. The numeric safety limit `1e300`
   prevented overflow, but provided no meaningful balance limit.
4. **Persistent farming and misleading ranking.** Aura Farm carries additive
   Mult into later fights. Endless also ranked raw best hit, giving large
   combos direct ranking value regardless of progression.
5. **Same-turn loops.** Zero-cost draw/energy combinations can prolong a turn,
   avoiding a turn-only anti-stall rule. The room and run budgets bound this too;
   scoring does not rely on a turn penalty alone.

Caps and diminishing returns bound every source, including persistent Mult.
Late-turn penalties remove the current fight's award, and progression/clear
priority prevents a farmer's unfinished run from beating a clear. Every mode
now ranks final score; biggest combo remains a display stat. The model does not
remove combo synergies or claim that every additional setup turn is suboptimal.

## Exact math

For a fight, let `S` be nonnegative base Squeeks, `M` the existing effective raw
Mult (including additive, trigger, chain, frozen and minimum effects), and `t`
the finishing turn, numbered from 1.

```text
rawCombo       = round(bounded(S * M))          # display only
softMultiplier = sqrt(bounded(M))
quality        = min(1, sqrt(bounded(S) / 200) * softMultiplier / 10)
pace           = clamp((2 * L - t) / L, 0, 1)
combatPoints   = win ? round(min(C, C * quality * D * H) * pace) : 0
```

`bounded` clamps at `1e300`; `D` is canonical daily difficulty (0.8–1.3), and
`H` is 1.2 during hibernation or 1 otherwise. Intermediate quality is capped before
the daily modifiers, the room budget is capped after them, and pace is applied
last. This order is shared by client and authoritative server replay.

| Encounter | Room budget C | Full pace through turn L | Zero combat points from turn |
|---|---:|---:|---:|
| Normal | 1,500 | 6 | 12 |
| Elite | 2,100 | 8 | 16 |
| Boss | 3,000 | 10 | 20 |

Quadrupling Squeeks or Mult doubles quality until the cap. A gigantic Mult can
fill a room budget, but cannot expand it or undo a late-turn penalty. Longer
fights still award progression when won, even when combat points reach zero.

Let `F` be completed visited rooms, `E` defeated elite rooms, `B` defeated boss
rooms, and `A` the sum of winning fight combat points. Act gates at hours 8 and
16 are elites; the final boss at hour 24 is a boss. Elite/boss bonuses stack with
their room's completion points.

```text
P = 200 * F + 300 * E + 1,000 * B

if clear:
    progression = P
    clearBonus  = 20,000
    combat      = A
else:
    progression = min(P, 19,999)
    clearBonus  = 0
    combat      = min(A, max(0, 19,999 - P))

finalScore = progression + clearBonus + combat
```

Thus **every non-clear is at most 19,999 and every clear is at least 20,000**.
This is stronger than requiring clears to beat non-clears at similar/lower depth,
and holds across seeds and difficulty, rather than only in the sampled runs.
The non-clear budget is intentional and also bounds endless rankings.

Entering a room grants no completion points. A combat victory pays once before
loot selection; choosing the reward cannot pay again. Rest, event, treasure and
shop rooms pay when completed. Loss/abandonment preserves previously earned
progression and awards no combat points for the lost fight. Elapsed wall time
never affects this formula.

## Before/after cohort results

| Policy | Version | Score p10 | p50 | p90 | Maximum | Clear rate |
|---|---|---:|---:|---:|---:|---:|
| Farming | before | 0 | 1,005 | 2,661,933 | 2,780,174,799,599 | 12.2% |
| Farming | after | 0 | 1,300 | 25,769 | 28,775 | 12.2% |
| Survival / balanced | before | 705 | 1,646 | 13,332 | 3,089,759 | 94.0% |
| Survival / balanced | after | 26,062 | 26,715 | 28,229 | 30,982 | 94.0% |
| Random | before | 309 | 595 | 3,118 | 117,278 | 1.8% |
| Random | after | 2,005 | 2,824 | 4,615 | 28,579 | 1.8% |
| Clear-focused | before | 694 | 1,440 | 12,302 | 134,322 | 90.2% |
| Clear-focused | after | 25,831 | 26,647 | 28,220 | 29,771 | 90.2% |

Per-battle points below include winning fights only; turn counts include every recorded fight. Gameplay trajectories were identical in all 2,000 paired attempts, so depth, clear rates and turn counts are unchanged.

| Policy | Rooms reached p50 / mean | Map hour p50 | Battle points p50, before → after | Battle points p90, before → after | Battle turns p50 / p90 | Run turns p10 / p50 / p90 / max |
|---|---:|---:|---:|---:|---:|---:|
| Farming | 7 / 9.36 | 8 | 163 → 0 | 14,161 → 188 | 25 / 27 | 18 / 96 / 149 / 222 |
| Survival / balanced | 20 / 19.74 | 24 | 95 → 102 | 606 → 321 | 3 / 8 | 24 / 34 / 50 / 127 |
| Random | 9 / 10.56 | 10 | 85 → 75 | 486 → 200 | 6 / 11 | 30 / 40 / 55 / 116 |
| Clear-focused | 20 / 19.67 | 24 | 95 → 102 | 615 → 310 | 3 / 8 | 22 / 32 / 46 / 92 |

Clear-only distributions separate successful builds from failed farming attempts.

| Policy | Version | Clear score p10 | p50 | p90 | Maximum |
|---|---|---:|---:|---:|---:|
| Farming | before | 6,404 | 400,978 | 1,412,469,820 | 190,736,207,999 |
| Farming | after | 25,606 | 26,314 | 27,724 | 28,775 |
| Survival / balanced | before | 717 | 1,731 | 14,510 | 3,089,759 |
| Survival / balanced | after | 26,237 | 26,751 | 28,287 | 30,982 |
| Random | before | 1,040 | 3,128 | 7,065 | 24,534 |
| Random | after | 26,156 | 26,926 | 27,292 | 28,579 |
| Clear-focused | before | 725 | 1,585 | 13,529 | 134,322 |
| Clear-focused | after | 26,253 | 26,742 | 28,280 | 29,771 |

Across all current cohorts, the lowest clear was **25,278** and the highest non-clear **7,221**. The old farming maximum was 2,780,174,799,599 despite only 12.2% clears. Survival cleared 94.0% and its median now exceeds the farming median by 20.6×.

One farming run and one survival run hit the 100-turn battle guard in each version; no random or clear-focused run hit a guard. The policy also ends a turn legally after 40 card plays to bound same-turn draw/energy loops. These explicit policy/runtime limits keep the cohort finite; the separate stress fixture tests prolonged farming directly. Full distributions and every battle observation are in the JSON.


## Adversarial stall probe

The separate stress fixture constructs a golden Dust Mite encounter with upgraded
Night Owl, Genesis Seed, Nocturnal, two Ser, Bedding Fort, Seed Snack, Rug Pull and
Gas War; relics are Midnight Wheel, Diamond Hands, WHEELY9000 Gear and Sunflower
Wheel. This setup is deliberately curated and is **not** included in the 500-run
bot cohorts or presented as an acquisition probability. After setup, every card
play and end turn uses the real engine. The bot maintains 67 HP and eventually
wins with Rug Pull/Gas War. Both versions retain identical raw visuals.

| Winning turn | Old awarded points | New awarded points | Raw combo, unchanged | Remaining HP |
|---|---:|---:|---:|---:|
| 4 | 55,313 | 1,202 | 69,044 | 67 |
| 6 | 956,897 | 1,202 | 1,194,449 | 67 |
| 12 | 1,378,641,647 | 0 | 1,720,892,398 | 67 |
| 24 | 565,836,560,419,878 | 0 | 706,306,702,525,260 | 67 |
| 48 | 2.135e+25 | 0 | 2.665e+25 | 67 |
| 96 | 7.207e+45 | 0 | 8.997e+45 | 67 |


## Clear build calibration

The scoring unit test also compares standard and skillful clear summaries on the
same canonical 2026-11-04 full route: 200 Squeeks per combat, Mult 1 versus Mult
100, daily modifiers neutral, fights finished within the allowance. This isolates
the score curve from acquisition luck; it is a controlled math fixture, not a
claim that a bot obtained those builds. That route has 10 fights, including four
elites and one boss, so progression contributes 7,000 points.

| Controlled clear | Combat points | Progression + clear bonus | Final score | Relative |
|---|---:|---:|---:|---:|
| Mult 1 | 1,890 | 27,000 | 28,890 | 1.00× |
| Mult 100 | 18,900 | 27,000 | 45,900 | 1.59× |
| Mult 1e300 | 18,900 | 27,000 | 45,900 | 1.59× |

The regression test requires the skillful premium to remain at least 1.5× and
the extreme premium at most 3×. Natural clear-only distributions are reported
above separately.

There is also a conservative bound independent of bot results. Each canonical
act retains three distinct peaceful rooms (rest, shop, treasure), giving at most
15 fights. At most five are elite and exactly one is the final boss. Therefore
combat points are at most `9 * 1,500 + 5 * 2,100 + 3,000 = 27,000`, and progression
is at most `24 * 200 + 5 * 300 + 1,000 = 7,300`. A clear is at most **54,300**.
Every clear must defeat the two elite gates and final boss, so even counting only
those three completed rooms gives at least `600 + 600 + 1,000 + 20,000 = 22,200`.
Thus **the largest canonical clear is less than 2.45× the smallest**, even across
different routes and seeds. This bound applies to generated daily/practice maps;
endless has no clear, and custom test maps are outside the bound.

## Shared implementation, records and verification

`src/game/score.ts` owns constants, battle accounting, and final totals. The pure
engine recomputes the total after each action; server replay uses that same engine
and never trusts a claimed score. The UI displays progression + clear bonus +
counted combat = final score, with raw combo, quality, cap, day modifiers, turn
allowance, pace and damage in each battle row. A non-clear ceiling can reduce the
counted combat total below the sum of room awards and is disclosed in the UI.

Exports and submissions require `scoreVersion: 2` inside the checksum. Old,
missing or future versions are rejected. Redis starts fresh with
`squeekspire:score-v2:` indices/entries/deduplication; server file storage, browser
storage and API readers hide old-version records. Old active saves cannot resume
under changed scoring. Profiles, daily attempt claims, and streaks are preserved.
No destructive leaderboard deletion or unverifiable conversion of old totals is
needed. See [the API contract](api-shape.md#game-score-api-and-scoring-reset).

Tests cover caps after difficulty/hibernation, extreme numeric values, square-root
returns, late payout removal, clear dominance, build premium, completed-room
accounting, one-time payouts, replay parity/version rejection, stale Redis/local
records, final-score ranking in every mode, and score explanation UI. Harness
tests cover quantiles, legal deterministic policies and replay roundtrips, plus
the before/after stall regression.
