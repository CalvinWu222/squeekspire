# Squeekspire art and animation critique

2026-11-04 · Senior game design / art direction review · Recommendations only

The strongest asset is the theme: a tiny sleepless hamster, sunflower seeds, wheel equipment and warm fur inside a cool midnight cage. The 60 original card compositions provide a complete visual foundation. Preserve that personality. The immediate priority is making threats, choices and consequences readable; additional spectacle should follow that work.

This review uses the current local source and [48 current PNGs](shots.md), rather than historical screenshots. Desktop is 1440×1000; mobile is 390×844 CSS pixels at device scale 1. Most encounters are controlled audit states rendered by the real UI; the game-over images come from a menu-started, replayable practice loss. Leaderboard rows are synthetic visual samples. [Capture report](capture-report.json) records the state, viewport, scroll dimensions, motion and diagnostics. Full-page shots preserve scrollable content; viewport shots 44/46/47/48 show what is actually visible without scrolling. Fixed/sticky controls can cross content in a full-page capture; that alone does not establish inaccessible content. No live deployment parity claim is made.

Use **Slay the Spire** as the visual reference for recognizing threats and build objects at the point of decision; use **Balatro** for making score construction and escalating payoff understandable. These are art-direction interpretations of the [official Mega Crit game visuals](https://www.megacrit.com/games/) and [official Balatro screenshots/GIFs](https://www.playbalatro.com/press-kit). Keep Squeekspire's hamster vocabulary and original assets.

**Priority:** P0 = decision/readability defects to address first; P1 = core feel and identity; P2 = consistency and enrichment. **Effort:** S = contained style, asset or timing change; M = coordinated component/presentation pass; L = new art family or substantial sequence. Estimates are relative, include integration, and exclude balance changes. Each numbered item has one effort class.

## P0 — fix the decision surface

### P0-1. Keep the hovered card's identity visible — S

- **What's wrong:** Hovering Wheel Kick removes its type, name and seed cost behind the hand's upper clipping edge. Compare [idle](shots/05_combat_desktop.png) with [hover](shots/06_card_hover_desktop.png). Browser diagnostics confirm `overflow-y:hidden`, a −35px/1.07× transform, and approximately **50px of card area above the clipping boundary** at 1440×1000. The larger-height desktop rule differs from the ≤950px override.
- **Why it matters:** Hover should make a choice clearer. Hiding cost and identity at that moment undermines confidence and makes the card feel broken.
- **Exact fix:** Reserve enough top inset for lift and cost overflow inside the horizontal scroller, and cap the lift to that inset; or use an independent preview layer outside clipping ancestors. Do not rely on `overflow-y:visible` beside an x scroller. Check first/middle/last card, focus and selection at 1440×1000 and 1366×768. Keep the entire title, cost and rules visible in every state.
- **Evidence:** `src/style.css` hand hover rules; `src/hand-readability.css:2`; `capture-report.json → hoverDiagnostics`.

### P0-2. Give mobile threats and actions a shared viewport budget — M

- **What's wrong:** The readable 14px mobile card rules sit beside microscopic actor information. Current intent numbers, HP, block and status labels are much smaller. In [the initial 390×844 viewport](shots/44_combat_mobile_390_viewport.png), End Turn and piles are below the fold. The normal combat document is about 1047px tall; two revealed-intent enemies expand it to about 1428px. [Five enemies with Live Camera](shots/46_sybil_intents_mobile_390_viewport.png) separate threats from the hand even further. There is no horizontal document overflow; the problem is hierarchy and vertical expansion.
- **Why it matters:** Players must compare incoming damage, defenses, a selected card and its target without repeatedly losing their place. An information-granting relic should not make combat harder to operate.
- **Exact fix:** Use ≥14px intent numbers, ≥12px HP/active status/actor names, and ≥10px secondary labels. Remove repeated TARGET and YOUR NIGHT CREW microcopy. Compress the heading and scoring explanation; put detailed score math behind disclosure. Anchor energy, End Turn and piles in a compact action rail. Keep current intents visible in a bounded two-row enemy area; show future intents in a selected-enemy strip or expandable detail without expanding every actor vertically. Keep the enlarged card rules. Validate at 390×844 with five enemies, revealed intents, a long debuff and ten hand cards; selected threat and action rail should remain visible together.
- **Evidence:** [28 combat](shots/28_combat_mobile_390.png), [31 intents](shots/31_enemy_intents_mobile_390.png), [45 swarm full page](shots/45_sybil_intents_mobile_390.png); `src/style.css` mobile actor rules; `src/intent-queue.css`; `src/hand-readability.css`; capture dimensions and computed-label diagnostics.

### P0-3. Make one Sybil target look like one creature — S

- **What's wrong:** The engine creates five targetable Sybil enemies, each with 1 HP, but each sprite contains five hamsters. [The encounter therefore displays 25 hamsters for five actual targets](shots/40_sybil_swarm_desktop.png).
- **Why it matters:** The illustration misstates the combat topology. Players should be able to count bodies, intents and health bars and reach the same answer.
- **Exact fix:** Use one small clone per target, reusing the existing hamster motif. Give each clone one grounded shadow, one current intent and one HP bar. Keep the five-clone group composition only for the Codex/group portrait if desired. Add a subtle index/formation offset so the five actual targets remain distinguishable at 390px.
- **Evidence:** `src/art.ts → sprites['sybil-swarm']`; `src/game/engine.ts → beginCombat()`; shots 40/45/46.

## P1 — make the action feel authored

### P1-1. Synchronize contact, reactions and displayed state — M

- **What's wrong:** Dispatch shows final HP/block/score immediately and starts damage floats and flashes at once, while a 500ms lunge reaches contact at 45% (225ms). Enemy actions overlap with only 90ms staggers and player damage becomes one aggregate float. Browser checks confirm that an action replaces both the health-fill and ambient-wheel elements. This prevents a persistent old-to-new HP transition and restarts ambient nodes. A 1050ms cleanup also cuts a 1200ms celebration and late fifth-enemy floats short.
- **Why it matters:** Action and consequence should land together. Early numbers, overlapping attacks and interrupted motion make hits feel like screen refreshes and obscure which enemy caused damage.
- **Exact fix:** Preserve actor/HP/ambient DOM identity and build a presentation-only event sequence: approximately 70ms windup, 90–140ms travel, contact, 30–50ms optional local hit stop, then 120–180ms recoil. On contact, update displayed HP, flash, number and shield response together. Sequence enemy contacts 250–350ms apart and show each hit of a multi-hit attack. Apply no hurt recoil when no damage/impact occurred. Queue or merge rapid plays instead of clearing the previous presentation. Clean up after the longest scheduled effect, including scaled delays; keep simulation/replay timing unchanged. Reduced effects should immediately show final state plus a concise result label.
- **Evidence:** `src/main.ts → render()/dispatch()/clearPresentation()`; `src/style.css:440` onward; [08 impact](shots/08_card_play_impact_desktop.png), [11 enemy attack](shots/11_enemy_attack_desktop.png); `capture-report.json → domReplacementDiagnostics`. Timing findings come from source, not a still frame.

### P1-2. Give damage, absorption, statuses and scoring separate visual meanings — M

- **What's wrong:** Floating feedback covers HP loss and net block gain. Fully absorbed damage has no explicit result, status changes remain small text, and power/skill/cast actions share broad glows. The same action may change damage, Squeeks and Mult without showing their relationship.
- **Why it matters:** Players need to distinguish survival from the score economy, and understand why a card worked. A blocked hit should feel successful rather than absent.
- **Exact fix:** Define a small effect vocabulary: warm impact + integer for HP loss; blue shield deflection + `BLOCKED` or absorbed amount; mint seed sparks to Squeeks; lilac/rose ticks to Mult; icon + short status label beside its recipient. Show `3 × 4` as three legible beats or an explicitly grouped result. Give block break a cracked-shield accent. Use shape, label and direction as well as color. Anchor feedback to the affected actor and keep it outside intent text.
- **Evidence:** `src/main.ts → floatingEffect()/battle()/dispatch()`; [09 block](shots/09_block_feedback_desktop.png), [10 intent colors](shots/10_enemy_intents_desktop.png), [11 damage](shots/11_enemy_attack_desktop.png).

### P1-3. Give a played card an origin and destination — M

- **What's wrong:** The card effect creates a 160px copy at `left:calc(50% - 80px); top:40%` regardless of the hand slot or selected target. [It floats over the fight](shots/08_card_play_impact_desktop.png) with the same generic exit for every card.
- **Why it matters:** Spatial continuity makes the card feel held, spent and responsible for the result. The center copy competes with the target reaction.
- **Exact fix:** Capture the source card rectangle before dispatch. Move a short-lived ghost from that slot toward the enemy for attacks, toward the player for skills, or into the persistent power area for powers. Resolve at contact, then use a short discard/exhaust indication. Keep the effect below the intent band and avoid covering the target's HP. Reduced effects should use an origin outline fade and target highlight.
- **Evidence:** `src/main.ts → dispatch()`; `src/style.css → .card-play-effect / @keyframes card-play`; [30 mobile play](shots/30_card_play_mobile_390.png).

### P1-4. Make the score explain itself before it celebrates — M

- **What's wrong:** Squeeks × Mult = Combo is a good structure, but all values jump together and one aggregate gain pops. The same large SQUEEK wash and whole-interface shake handles a new best hit ≥100 or score gain ≥1000. [The burst, flying card and damage flash compete simultaneously](shots/41_combo_burst_desktop.png).
- **Why it matters:** Balatro's useful lesson is a sequence the player can follow: contribution, multiplication, result, payoff. Repeated large overlays flatten the emotional range and obscure the next decision.
- **Exact fix:** Tick Squeeks, highlight the specific source of Mult, light only newly earned chain pips, pulse a contributing relic once, then settle Combo. Use three bounded tiers: local number bump; stronger arena-only accent; exceptional best/clear celebration. Base intensity on encounter/run significance and suppress repeat full-screen bursts during ordinary chains. Keep threats visible, shake the stage rather than controls, and offer a compact contribution summary with reduced effects. Use the completion lifecycle from P1-1.
- **Evidence:** `src/main.ts → battle()/dispatch()/render()`; `src/style.css → score-float/squeek-pop/screen-shake`; shot 41.

### P1-5. Make relics collectible objects with one identity — M

- **What's wrong:** Fifteen relics use thin monochrome line icons against the filled pixel language of cards and actors. The character screen depicts Midnight Wheel with the rest/moon symbol, while the topbar depicts a wheel. [Treasure discovery is text without a featured relic](shots/17_treasure_relic_reward_desktop.png); [the shop](shots/14_shop_desktop.png) enlarges simple line symbols into its most prominent item art.
- **Why it matters:** Relics are lasting build anchors. Distinct silhouettes and consistent depictions make them memorable and make acquisition feel valuable.
- **Exact fix:** Immediately use the canonical wheel symbol for the starter relic. Then author a 32×32 or 48×48 filled pixel family: unique silhouette, one material cue, one restrained accent per item. Reuse the exact asset in topbar, shop, Codex and detail modal. On acquisition show icon/name/one-line rule for 250–400ms, then settle toward the topbar slot; on activation use one small pulse with the result label.
- **Evidence:** `src/main.ts → relicIcon()/characterSelect()/reward()/modalMarkup()`; [18 relic detail](shots/18_relic_detail_desktop.png), [42 relic Codex](shots/42_relic_codex_desktop.png).

### P1-6. Make the acts look and feel like a climb — L

- **What's wrong:** The map names three distinct acts, but all combat uses the same Bedding Burrows cage/wheel stage. Golden rooms add accents; every encounter vignette begins with the same cage background. [The boss](shots/12_boss_zoomies_desktop.png) inherits much of the opening room's staging.
- **Why it matters:** Environmental progression gives repeated fights meaning and makes the run's chapters memorable before the player reads a label.
- **Exact fix:** Build three small environment kits: warm low bedding/burrows; cooler mid-cage bottle/pipes/moon shadows; high wheel supports/gears/rim light. Change ground silhouette, landmark props and lighting direction rather than only tint. Keep the gameplay band quiet. Echo the kit in map edges and shop/rest banners, add a distinct boss landmark, and use a brief act-title silhouette transition.
- **Evidence:** `src/main.ts → mapMarkup()/battle()`; `src/art.ts → cageBackground()/scenes`; [04 map](shots/04_map_desktop.png), [05 combat](shots/05_combat_desktop.png), [12 boss](shots/12_boss_zoomies_desktop.png).

### P1-7. Express enemy behavior through pose and silhouette — L

- **What's wrong:** The actor set has distinct compositions, but largely front-facing, continuously breathing sprites share generic lunge/cast motion. Oracle acolyte/judge and stale sprite/ghost have related silhouettes. The five-target swarm issue is handled separately in P0-3.
- **Why it matters:** Recognizable poses teach threats, make enemies feel intentional and give elites/bosses authority beyond a larger number.
- **Exact fix:** Give the player idle/attack/hurt/defend poses and a consistent facing direction. Give each family one behavior: snake coils, thief grips/throws seeds, moth tightens wings before FUD, oracle raises paper/gavel, ghost breaks into fragments. Use 2–4 discrete pose frames or articulated SVG groups. Give bosses a stable larger footprint and 400–600ms entrance without moving the intent band.
- **Evidence:** `src/art.ts → sprites`; `src/style.css` actor and action animation selectors; [43 enemy Codex](shots/43_enemy_codex_desktop.png), shots 05/12/40.

### P1-8. Give reward, rest and outcome screens their own emotional beats — M

- **What's wrong:** Rewards mostly arrive as a heading and cards; treasure uses the same title with an already-added relic hint. Mobile rewards require substantial vertical comparison. Rest changes state without a bespoke recovery/upgrading beat. [Defeat displays the crowned hamster and trophy vignette](shots/23_game_over_desktop.png), and retry follows a lengthy score audit.
- **Why it matters:** Rewards release tension and help players picture a build. Recovery should feel comforting; defeat should invite another run without borrowing victory's imagery.
- **Exact fix:** Use a brief `CHOOSE 1 CARD` reveal with common comparison alignment; on mobile offer a compact horizontally browsable comparison plus the existing large inspect view. Send the chosen card toward a deck counter. Give rest a short seed/HP recovery or wheel-tuning gesture and an upgrade value highlight. Reserve the crown/trophy for victory; use a curled hamster, still wheel and softer moonlight for defeat. Put headline score, best achievement and retry in the first view; make detailed score tables expandable. Relic rewards follow P1-5.
- **Evidence:** `src/main.ts → reward()/rest()/result()/scoreBreakdown()`; `src/art.ts → scenes.results`; [13 reward](shots/13_reward_desktop.png), [32 mobile reward](shots/32_reward_mobile_390.png), [15 rest](shots/15_rest_desktop.png), shots 17/23/36.

## P2 — improve consistency and character

### P2-1. Strengthen card recognition and frame grammar — M

- **What's wrong:** Many hamster/wheel/seed compositions have similar weight on the same plum field. Type and rarity depend on face/trim color plus a small metadata strip. Upgrades and merges alter text without changing the illustration.
- **Why it matters:** Familiar cards should be recognized before their rules are reread. Rare and upgraded finds need visible identity without adding clutter.
- **Exact fix:** Add a small type silhouette badge, one type-specific edge treatment and one/two/three rarity marks. Keep cost position and seed shape stable. Differentiate the closest illustrations through action lines: diagonal Wheel Kick contact, double-loop Double Lap, radial Wheel Spin, speed-fan Peak RPM. Add a stable small upgrade seal and highlight changed rule values. Preserve the 14px mobile rules and avoid making every rare card glow continuously.
- **Evidence:** `src/art.ts → cardPictures/cardArt()`; `src/main.ts → cardMarkup()`; [19 card Codex](shots/19_card_codex_desktop.png), [13 rewards](shots/13_reward_desktop.png).

### P2-2. Consolidate color and typography around roles — M

- **What's wrong:** The source has 510 normalized CSS hex values including alpha/shadow variants and superseded declarations. SVG and UI have different ink/cream/gold sets. Six named system typefaces, tiny console labels, smooth line icons, rounded pills and pixel actors coexist. This is source complexity, not a claim that 510 distinct colors are visible on one screen.
- **Why it matters:** Consistent contrast, line weights and type roles make hierarchy easier to learn and keep future art additions coherent across platforms.
- **Exact fix:** Create a one-page style guide with display/rules/metadata roles, breakpoint minimum sizes, a 4px spacing rhythm, icon weight, corner treatment and semantic colors. Map surfaces, focus, damage, defense, score, Mult and status onto tokens. Define shared illustration/UI shadow and highlight bridges; retain the cool-night/warm-fur contrast. Reserve console text for short ≥10px metadata. Choose and package a licensed text/display pair only after checking small-size rendering and fallback behavior.
- **Evidence:** [complete palette](color-palette.md), [font inventory](motion_inventory.md); `src/style.css` root tokens; `src/art.ts → C`; `src/guide.ts` SVG colors; shots 01/05/42.

### P2-3. Make the route feel traversed — M

- **What's wrong:** [The map](shots/04_map_desktop.png) is a long repeating field. Current, reachable, completed and jackpot states compete through layered borders/fills; physical travel is an instant change.
- **Why it matters:** The strategic pause should communicate where the player is, what was achieved and where they can go next.
- **Exact fix:** Add a player token at the current room, one clear halo/arrow for reachable rooms, a plain completion check and a separate jackpot star badge. Move a small seed/light along the chosen connector in 180–250ms, then pulse the destination. Add sparse act landmarks and boss silhouettes, preserving route contrast and the current scroll position. Reduced effects use a destination highlight only.
- **Evidence:** `src/main.ts → mapMarkup()/render()`; `src/style.css` map rules; [27 mobile map](shots/27_map_mobile_390.png).

### P2-4. Make ambient motion support attention — M

- **What's wrong:** Wheel rotation, falling seeds, breathing and power aura can all run together. Continuous scaling/rotation of crisp-edged pixel art creates a shifting pixel grid. Non-combat vignettes are otherwise static.
- **Why it matters:** A quiet scene gives impacts more contrast. Sparse character idles can convey warmth more effectively than uniform movement everywhere.
- **Exact fix:** Reduce ambient contrast during aiming and impact. Use integer-pixel offsets/discrete pose changes for characters and integer scaling at key display sizes. Add one staggered idle per room: merchant blink/seed tap, sleeping chest rise/Z puff, wheel glint. Keep ambient nodes stable as in P1-1. Preserve both the existing user and OS reduced-motion behavior and provide meaningful static end states.
- **Evidence:** `src/style.css → wheel-turn/idle-breathe/seed-fall/aura-pulse`; `src/preferences.ts`; `src/art.ts` SVG group scales; [01 title](shots/01_title_desktop.png), [15 rest](shots/15_rest_desktop.png).

### P2-5. Spend shop, rest and leaderboard space on the player's next decision — M

- **What's wrong:** [Mobile shop](shots/48_shop_mobile_390_viewport.png) spends most of the first view on a banner, large heading, Leave button and wallet, then a second sticky Leave/wallet row overlaps the beginning of the offers. [Mobile rest](shots/47_rest_mobile_390_viewport.png) similarly emphasizes Continue twice. The leaderboard is nested among replay utilities and wallet controls. Full-page footer crossings do not mean the underlying controls are permanently unreachable.
- **Why it matters:** Purchase comparison, recovery choice and personal ranking should dominate their own screens. Repeated navigation consumes scarce space and can invite leaving before examining the room.
- **Exact fix:** Compress phone encounter art into a shallow banner and reduce heading margins. Keep one primary navigation location plus footer-safe scroll padding equal to the actual sticky rail height. Put prices and recovery/upgrade choices ahead of secondary copy. Give sold items a visible stamp/empty stand. On leaderboard emphasize the player's row, rank and score; keep mode/date clear and collapse replay utilities beneath the board. Treat sample score rows in this audit as layout fixtures, not real community data.
- **Evidence:** `src/main.ts → shop()/rest()/encounterFooter()/leaderboard()/modalMarkup()`; `src/shop-balance.css`; shots 14/15/22/33/34/37/47/48.

## Top 5 quick wins

1. **S — Stop desktop hover clipping.** Temporarily remove scale/lift where the hand cannot contain it, retaining an inset highlight. This immediately restores name/cost visibility; the full preview-layer solution can follow.
2. **S — Enlarge phone survival labels.** Raise intent numbers and HP/status sizes and remove redundant microcopy. Keep readable card rules. This is the first slice of P0-2, before its layout redesign.
3. **S — Draw one hamster per Sybil target.** Reuse the existing hamster motif; five targets should show five bodies.
4. **S — Reuse existing relic art consistently.** Show the wheel for Midnight Wheel on character select, and feature the existing acquired-relic icon/name/rule on treasure rewards. New pixel relic paintings can follow.
5. **S — Align the existing impact effects and let them finish.** Delay flash/number to the current lunge's 225ms contact, scale the delay with speed, and extend cleanup to the longest effect. This is a contained improvement before the full event sequence in P1-1.

## Review acceptance targets

- At 390×844, current threats, selected target and energy/End Turn remain legible together, including a five-enemy revealed-intent case. At ordinary desktop heights, hover/focus never clips the card identity.
- A viewer can name who acted, who was affected, damage versus absorption, and the source of score changes from one action at normal and fast speeds. Reduced effects retains that information without flashes or shake.
- One relic has one depiction everywhere; each act has a recognizable environment; defeat and victory have distinct compositions. Reward, purchase and upgrade feedback confirms acquisition without delaying the next choice.

No recommendations were implemented. Source integrity is recorded in [source_integrity.json](source_integrity.json); all created files are under `docs/art_audit/`.
