# Art direction review notes

Read-only review, 2026-11-04. These recommendations combine source inspection with the current local-build screenshots in `docs/art_audit/shots/`. Screenshots are actual rendered UI; some encounters use deterministic audit fixtures as documented in `capture-report.json`. Timing/causality findings are source analysis, not conclusions from a still image. No implementation changes were made.

## Direction to preserve

The hamster cage gives the game a useful identity: sunflower seeds as energy, wheel equipment, bedding, sleeping creatures, affectionate copy, and a small palette of warm fur against cool night colors. The original inline pixel illustrations already give every catalog card a composition. Keep that authorship. The most valuable investment is making the decision, the action, and its consequence legible, then giving the climb more environmental variety.

Use **Slay the Spire** as a reference for readable combat actors, intention, and collectible identity, and **Balatro** as a reference for legible scoring and escalating payoff. These are art-director interpretations, not requirements to duplicate either game's style. Primary visual reference pages: [Mega Crit official games / trailers](https://www.megacrit.com/games/) and [Balatro official screenshots / GIFs](https://www.playbalatro.com/press-kit). Borrow the clear hierarchy and timing; retain Squeekspire's cage, seed, wheel, and sleep vocabulary.

Effort estimates are relative: **S** = a contained asset/style/timing pass; **M** = a coordinated component/VFX pass; **L** = a new content family or presentation sequence requiring substantial art and integration. No estimate includes changing game balance.

## P0 — decisions and action comprehension

### P0-0. Stop hover from removing the card's identity — S

- **What's wrong:** In [06_card_hover_desktop.png](shots/06_card_hover_desktop.png), hovering Wheel Kick lifts it into the hand's clipped upper edge. Its name, type and seed cost disappear while the art/rules remain visible. The unhovered card in [05_combat_desktop.png](shots/05_combat_desktop.png) shows those fields normally. The transform moves the card beyond an `overflow-y:hidden` scroll area.
- **Why it matters:** Hover is supposed to clarify the card at the exact point of decision. Hiding the name and cost reverses that benefit and makes cards feel physically broken.
- **Exact fix:** Give hover lift its own inner layer with reserved top space, inside an outer wrapper responsible for horizontal scrolling; alternatively use a separate enlarged preview that never intersects a clipping ancestor. Cap lift at the available inset. Verify first, middle and last card, keyboard focus, selected card and a long hand at 1440x1000 and 1366x768.
- **Evidence:** `src/style.css:231–234`, `src/hand-readability.css:2–3`; current screenshots 05 and 06.

### P0-1. Put survival information at a readable size on phones — M

- **What's wrong:** The 470px CSS breakpoint uses 7px intent numbers, 6px HP/block, 5px statuses and target labels. Later readability overrides improve the hand, but do not enlarge these combat actor labels. [28_combat_mobile_390.png](shots/28_combat_mobile_390.png) confirms the contrast between large card rules and tiny actor information. The normal mobile combat document is 1047px high in an 844px viewport. With revealed intents, [31_enemy_intents_mobile_390.png](shots/31_enemy_intents_mobile_390.png) grows to 1428px and stacks enemies, so the first threat and hand/end-turn action cannot be viewed together. These are scrolling/layout-budget issues, not document horizontal overflow (the capture reports none).
- **Why it matters:** Choosing a card is only useful when the player can read who will attack, for how much, and what defenses/statuses apply. Visual prominence must reflect risk, not decoration.
- **Exact fix:** Define a phone combat hierarchy: intent number >=14px, HP and active status >=12px, actor name >=12px, and secondary captions >=10px. Replace repeated TARGET and YOUR NIGHT CREW labels with a selected-target marker. Use compact icon+number status chips, with a touch detail view. Reserve an anchored action rail for energy, end turn and pile access; keep the chosen target and incoming damage visible while the hand scrolls. Validate 390x844 with three enemies, three revealed intents, a long debuff, and a 10-card hand.
- **Evidence:** `src/style.css:509–514`, `src/hand-readability.css`, `src/intent-queue.css`, `src/main.ts:242–255`; screenshots 28/31 and `capture-report.json` viewport/document metrics. The desktop normal combat also extends to 1102px inside a 1000px viewport, so the fix should budget the whole decision surface at ordinary laptop heights too.

### P0-2. Make cause and impact happen in the same beat — M

- **What's wrong:** Dispatch renders the final HP, block and score immediately. Damage floats and hit flashes begin immediately, while the attack lunge reaches its strike at 45% of a 500ms animation. On enemy turns, only actor motion is staggered by 90ms; player HP loss becomes one aggregate float. Successive actions call `clearPresentation()`, cutting off the prior presentation.
- **Why it matters:** A player needs to associate an attacker, its exact result, and the target's response. Early numbers and overlapping actors make powerful attacks feel like UI refreshes and blur multi-enemy causality.
- **Exact fix:** Add a presentation-only ordered event sequence: ~70ms windup, 90–140ms travel, impact event, 30–50ms optional local hit stop, 120–180ms recoil. At impact, trigger the target flash, per-hit number, shield response, displayed HP change and score tick together. Sequence enemy attacks 250–350ms apart; keep fast mode proportional and offer skip/accelerate without changing simulation. Queue or merge rapid player effects instead of resetting all prior feedback. Reduced effects should show the final state and a compact result label immediately.
- **Evidence:** `src/main.ts:448–492`, `src/style.css:440–471`, `src/preferences.ts:65–73`.

### P0-3. Separate damage, block, score and non-damage effects — M

- **What's wrong:** `floatingEffect` reports only positive HP loss and block gain. A fully blocked attack has no damage number, power/skill/cast effects use broadly shared glows, statuses remain small text, and score gains appear in one total popup. Damage, Squeeks and multiplier increases lack distinct paths from cause to destination.
- **Why it matters:** This game combines enemy survival and a score economy. Without a visual grammar, a large combo can look like enemy damage and a blocked hit can look like no result.
- **Exact fix:** Establish a documented result language: warm red/orange impact+integer for HP damage; blue shield deflection + `BLOCKED` or absorbed amount; mint seed/squeek sparks entering Squeeks; lilac or rose multiplier notch/tick entering Mult; status icon+short label beside its recipient. Show multi-hit numbers separately or as a clearly marked `3 x 4` beat. For casts, draw a short trail toward the affected actor/card rather than an unexplained caster glow. Never use a color alone to distinguish these events.
- **Evidence:** `src/main.ts:220–225`, `src/main.ts:239–255`, `src/main.ts:470–485`, `src/style.css:173–185`, `src/style.css:447–450`.

## P1 — stronger identity and expressive feedback

### P1-1. Make a played card belong to the hand and target — M

- **What's wrong:** The played-card effect is a fixed 160px ghost at the center of the viewport (`left:calc(50% - 80px); top:40%`) with the same upward exit for every action. It does not originate from the actual played card or travel toward the chosen actor.
- **Why it matters:** Spatial continuity is a low-cost way to make the card feel held, spent, and responsible for the result. A center-screen copy can also compete with intent and impact information.
- **Exact fix:** Capture the card's presentation rectangle before dispatch. Animate a ghost from that rectangle; attacks tip toward the selected enemy, skills toward the player, powers into the persistent power/relic area. Shrink/resolve into a small type-specific burst, then show a short discard/exhaust route. Retain the existing rules and confirmation interactions. On phones, keep the flight in the arena, above the hand and below the intent band. Reduced effects use an outline fade at the origin and a target highlight.
- **Evidence:** `src/main.ts:451–459`, `src/main.ts:481`, `src/style.css:451`, `src/style.css:471`; [08_card_play_impact_desktop.png](shots/08_card_play_impact_desktop.png) shows the central ghost crossing the target/hand boundary while damage resolves.

### P1-2. Turn the score machine into a readable sequence — M

- **What's wrong:** The scoreboard has a useful Squeeks x Mult = Combo layout, but changes are presented as final values and a single gain popup. The global SQUEEK burst is triggered by absolute thresholds (new best hit >=100 or score gain >=1000), then uses the same large full-screen treatment.
- **Why it matters:** Balatro's useful lesson here is that score should explain its own construction and scale its emotional payoff. If every large result uses one overlay, spectacle loses meaning and can obscure the next decision.
- **Exact fix:** Give Squeeks and Mult separate short value ticks; animate chain pips only when they change; briefly pulse the triggering relic/power; then settle the result into Combo. Use three bounded tiers based on encounter-relative achievement: a local number bump, a stronger arena accent, and an exceptional clear/best burst. Preserve the target and next intent during ordinary plays. Keep a static event summary for reduced effects. Do not add casino imagery or copy Balatro's shaders.
- **Evidence:** `src/main.ts:239`, `src/main.ts:482–485`, `src/style.css:185`, `src/style.css:452–453`.

### P1-3. Give relics collectible identity and one canonical icon — M

- **What's wrong:** All 15 relics use thin monochrome 24x24 line symbols, while cards, actors and room symbols use filled pixel silhouettes. The character screen labels a moon `nodeIcon('rest')` as Midnight Wheel; the actual relic uses a wheel symbol. Acquiring a treasure relic appears as text and a hint, without a hero relic image.
- **Why it matters:** Relics are the run's lasting build identity. Small interchangeable line symbols are harder to remember and the moon/wheel discrepancy weakens recognition across screens.
- **Exact fix:** First route the starter relic to the existing canonical wheel icon. Then make a 32x32 or 48x48 filled pixel relic family with a distinct silhouette, one material cue and one accent per item. Reuse those same assets in topbar, Codex, shop and modal. On acquisition, show icon + name + one-line rule, a 250–400ms reveal, then a brief settle toward its topbar slot. On activation, use a single bounded pulse and a small effect label.
- **Evidence:** `src/main.ts:83–102`, `src/main.ts:154`, `src/main.ts:264`, `src/main.ts:384`, `src/style.css:148`, `src/style.css:556–558`; [17_treasure_relic_reward_desktop.png](shots/17_treasure_relic_reward_desktop.png), [18_relic_detail_desktop.png](shots/18_relic_detail_desktop.png), [14_shop_desktop.png](shots/14_shop_desktop.png).

### P1-4. Make enemy behaviors visible in pose and silhouette — L

- **What's wrong:** There are distinct enemy compositions, but every actor shares a generic breathing transform and action categories share a single CSS lunge/cast animation. Oracle acolyte/judge and stale sprite/ghost have closely related silhouettes; most characters stare front-on. The player also uses the enemy-catalog Zoomie Gremlin sprite.
- **Why it matters:** A clear silhouette helps identify threats; pose anticipation teaches behavior and adds personality before the number resolves. Elite and boss encounters need more presence than a name change.
- **Exact fix:** Establish a player facing direction and three core poses (idle, attack, hurt) plus a defensive pose. Give each enemy family one behavior signature: snake coils before a queue action, thief clutches/throws a seed, moth wings tighten before FUD, oracle raises paper/gavel, ghost loses cohesion. Give elites stronger silhouette landmarks and bosses a larger footprint/entrance, while keeping the intent band stable. Use sparse 2–4 frame pose swaps or SVG group articulation rather than smooth stretching of the entire pixel image.
- **Evidence:** `src/art.ts` sprites, `src/main.ts:242`, `src/style.css:199–211`, `src/style.css:456–467`.

### P1-5. Make the three acts look like a climb — L

- **What's wrong:** Map act names promise Bedding Burrows, Cage After Dark and Midnight Wheel, yet combat uses one CSS cage arena and all five SVG room vignettes use the same `cageBackground()`. Fog is a pair of subtle radial gradients. The promise of height is mostly textual.
- **Why it matters:** Environmental progression makes repeated encounters feel like progress and gives a run memorable chapters. Art can communicate danger before an enemy attacks.
- **Exact fix:** Create three compact environment kits: low warm bedding and burrow holes; cool middle cage bars, bottle/pipes and moon shadows; high wheel supports, gears and stronger rim lighting. Keep the arena's gameplay-value area quiet. Change ground line, silhouette props and local accent, not just a global tint. Echo each kit on map edges and shop/rest vignettes; give boss gates a large wheel landmark. Add a short act transition with a clear name and silhouette before returning control.
- **Evidence:** `src/art.ts:cageBackground/scenes/sceneArt`, `src/main.ts:170–177`, `src/style.css:186–195`, `src/style.css:254`.

### P1-6. Treat rewards as a build decision and a payoff — M

- **What's wrong:** Reward panels are mostly a title, small instruction and three cards. Treasure and battle rewards share the same title. Relic collection is reported as already added. [32_reward_mobile_390.png](shots/32_reward_mobile_390.png) presents the three choices as a long full-card vertical list, forcing memory-based comparison. [23_game_over_desktop.png](shots/23_game_over_desktop.png) and [36_game_over_mobile_390.png](shots/36_game_over_mobile_390.png) show the same crown/trophy vignette despite defeat, and retry follows the long score explanation/table.
- **Why it matters:** The reward beat is the emotional release after a fight and the moment the player evaluates a build. A defeat needs a different emotional resolution from victory.
- **Exact fix:** Use a brief distinct reward entrance and a clear `CHOOSE 1 CARD` or `RELIC FOUND` header. Feature the relic using the canonical icon and rule. At 390px show three compact choice summaries together (cost, name, main effect and small art), then expand one for full inspection. On selecting a card, animate it toward a small deck counter without delaying navigation. For results, make separate victory and defeat compositions: upright crowned hamster/wheel momentum versus a curled hamster, resting wheel and softened moonlight. Keep retry and the headline score visible before the optional detailed score audit.
- **Evidence:** `src/main.ts:264`, `src/main.ts:309–317`, `src/art.ts:scenes.results`, `src/style.css:303`, `src/style.css:325–335`.

### P1-7. Tighten card recognition without sacrificing rules — M

- **What's wrong:** Card art is complete and cohesive, but many wheel/hamster/seed compositions are similarly weighted on the same dark background. Type and rarity rely heavily on colored faces/trim and a very small text strip. Upgrade identity is principally a suffix/value change.
- **Why it matters:** Frequent cards should be recognized before the player reads a paragraph; rare finds should feel materially different while remaining part of one deck. Color-only frame differences are fragile at phone size.
- **Exact fix:** Define a simple framing grammar: a small attack/skill/power silhouette badge, one card-type edge treatment, and rarity corner marks (one/two/three pips or etched stars). Keep rarity out of the energy seed and keep cost in one stable spot. Redraw the closest compositions around a dominant action line: Wheel Kick diagonal contact; Double Lap two concentric trails; Wheel Spin central circular force; Peak RPM a bright speed fan. Give upgrades a small stable `+` seal and highlighted changed values, not pervasive glow.
- **Evidence:** `src/art.ts:cardPictures/cardArt`, `src/main.ts:cardMarkup`, `src/style.css:263–284`, `src/hand-readability.css`.

## P2 — polish and content variety

### P2-1. Rebalance typography and the visual-language mix — S/M

- **What's wrong:** Impact title type, system sans, tiny console type, smooth outlined UI/relic icons, pixel sprites, round pills and gradients coexist. Both art and CSS palettes use different ink/cream/gold definitions, producing a warm-plum illustration layer inside teal UI chrome.
- **Why it matters:** The identity is currently coherent at the theme level but less coherent at the object/material level. Fine console labels are used where readable hierarchy would be more useful.
- **Exact fix:** Write a one-page visual style guide: 3 text roles, minimum sizes by breakpoint, 4px spacing rhythm, UI line weights, one corner treatment, and semantic token roles. Keep a large display title, use readable sans for rules and values, reserve console text for short labels at >=10px. Either bridge plum illustrations to teal chrome with one shared shadow/highlight pair or deliberately define them as stage and interface materials. Use a canonical icon per meaning.
- **Evidence:** `src/style.css:2–7`, `src/style.css:61`, `src/art.ts:C`, `src/main.ts:icon/relicIcon`, `src/intent-queue.css`.

### P2-2. Make the map feel traversed — M

- **What's wrong:** A long dotted path on a repeating grid supports navigation but has little change in density, scale or scenery. Available, completed, current and jackpot nodes all depend on overlapping border/fill/outline treatments.
- **Why it matters:** The map is a strategic pause and should give the player a sense of location, route history and a next destination at a glance.
- **Exact fix:** Add a small player token at the current node, a bright arrow/halo only on reachable destinations, a plain check state for completed rooms, and a distinct star badge for jackpots. Move a seed/light along the selected connector on travel. Add restrained act-edge landmarks and a prominent boss silhouette at each gate. Keep upcoming routes readable without forcing whole-map zooming.
- **Evidence:** `src/main.ts:mapMarkup`, `src/style.css:241–257`.

### P2-3. Make ambient motion serve the scene — S/M

- **What's wrong:** Constant seed fall, slow wheel rotation, all-character breathing and a power aura can run simultaneously. Pixel characters scale continuously, which can soften the intended grid. Non-combat vignettes are static.
- **Why it matters:** Uniform background activity reduces the contrast of important action. Character-specific small movement can add warmth with less visual noise.
- **Exact fix:** Lower ambient activity during aiming and impact. Prefer integer-pixel breathing offsets and discrete pose changes to continuously scaling the pixel artwork. Add one purposeful idle per room: merchant blink/seed tap, sleeping chest rise/Z puff, rest curtain/moon glint. Stagger those idles; avoid animating every prop. Preserve the existing reduced-motion handling and use a still pose for every loop.
- **Evidence:** `src/style.css:57–58`, `src/style.css:193`, `src/style.css:199–211`, `src/style.css:456–458`, `src/style.css:544–545`, `src/style.css:610–612`.

### P2-4. Give shop and leaderboard a stronger emotional focus — S/M

- **What's wrong:** The shop mixes a large decorative vignette, headline, duplicate wallet presentations, card offers and removal controls. Initial-viewport sticky Continue/Leave rails cover part of the card/upgrade preview area in [14_shop_desktop.png](shots/14_shop_desktop.png), [15_rest_desktop.png](shots/15_rest_desktop.png), [33_shop_mobile_390.png](shots/33_shop_mobile_390.png) and [34_rest_mobile_390.png](shots/34_rest_mobile_390.png). Content can be scrolled above the rails; this is an avoidable overlap and prioritization cost, not proof that content is permanently inaccessible. The leaderboard lives in a generic extras modal beside replay utilities and wallet information, using the same panel language as settings; [37_leaderboard_mobile_390.png](shots/37_leaderboard_mobile_390.png) places the first ranked row below a substantial block of those utilities.
- **Why it matters:** Shop art should help compare purchases, and the leaderboard should celebrate a run's place in the community instead of feeling like administration.
- **Exact fix:** Keep offers and prices near the first view at phone widths; let the merchant vignette compress into a shallow banner. Reserve safe inset and scroll padding equal to sticky rail height, and make navigation secondary until the choice content is visible. Rest needs one Continue location and a compact before/after delta above it. Give sold items a physical sold stamp and a small empty stand rather than only grayscale. On leaderboard, promote the player's row and a small rank/medal identity, keep mode/date tabs explicit, and collapse ancillary utilities below the board. Use restrained rank distinctions so score remains the primary comparison.
- **Evidence:** `src/main.ts:shop/leaderboard/modalMarkup`, `src/shop-balance.css`, `src/style.css:306–316`, `src/style.css:378–400`.

## Top five quick wins

1. **S:** Fix hover clipping so Wheel Kick retains its name, type and cost when lifted (shot 06).
2. **S:** Enlarge phone intent/HP/status text and remove redundant target microcopy; validate at 390px with three enemies and revealed queues (shots 28/31).
3. **S:** Delay hit flash/damage popup to the lunge impact beat, and add a readable `BLOCKED` response for zero-HP-loss attacks.
4. **S:** Use the canonical relic icon in both character select and the treasure reward panel; one item should have one visual identity, and acquisition should show the item (shot 17).
5. **S:** Move retry above the expanded score explanation and add footer-safe insets on encounter screens. These are hierarchy/layout wins without new illustration work.

## Verification cautions for the parent audit

- Do not claim there is no animation: the implementation already has action lunges, charges, hurt flash, floats, death, card play, score popup and screen burst, plus ambient loops.
- Do not claim card rules are currently 6px on mobile: `hand-readability.css` is imported last and raises hand descriptions to 14px. Actor-side HP/status microtype remains a separate issue.
- Do not use old root `shots/` as current evidence. The files there show a former three-column purple UI and differ materially from the current teal fullscreen presentation.
- Still screenshots can verify composition and text size, not animation timing. The timing findings above come from source, and should be labelled accordingly.
- Keep any screenshots produced via state hooks labelled as deterministic audit states rather than implying an uninterrupted public live run.
