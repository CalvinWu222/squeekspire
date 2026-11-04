# Color, typography, motion, and feedback inventory

Source audit on 2026-11-04. Only files under `docs/art_audit/` were created by this audit. Counts cover source declarations, including later overrides, rather than a rendered-style census. The effective CSS load order is `style.css` → `hand-readability.css` → `shop-balance.css` → `intent-queue.css` (`src/main.ts:1–4`). No animation library, canvas particle engine, sprite animation sheet, external font request, or `@font-face` exists in the visual source inspected.

The exhaustive extraction is [presentation-data.json](presentation-data.json), including every literal color with selector/property/line, every font declaration, custom property, animation, transition, and each keyframe's exact frame declarations. [color-palette.md](color-palette.md) lists **all 588 normalized source hex values**, their occurrence counts, and file/line locations. The read-only extraction is reproducible with `node docs/art_audit/extract-motion.mjs`.

## Counts

| Item | Count | Scope |
|---|---:|---|
| Imported CSS files | 4 | `src/style.css`, `src/hand-readability.css`, `src/shop-balance.css`, `src/intent-queue.css` |
| CSS hex literal occurrences | 571 | 510 distinct normalized values: 357 opaque RGB and 153 RGBA values |
| All visual-source hex occurrences | 690 | 588 distinct values: 435 opaque RGB and 153 RGBA values; adds inline SVG and HTML fallback |
| `color-mix()` occurrences | 1 | `src/style.css:260`, card face mixed with 5% white |
| CSS `transparent` occurrences | 39 | All occurrences enumerated in JSON; `currentColor` CSS declarations: 0 (SVG icon attributes use `currentColor`) |
| rgb/rgba, hsl/hsla, hwb, lab/lch, oklab/oklch, color() values | 0 | No such notation in imported CSS |
| Keyframe definitions | 19 | All in `src/style.css:455–473`; all referenced |
| `animation` shorthand declarations | 24 | 21 enabled bindings plus 3 `none` rules |
| Animation longhand declarations | 16 | 4 duration overrides and 12 delays |
| `transition` shorthand declarations | 9 | All in `src/style.css` |
| Transition duration overrides | 2 | Global reduced-effects and system reduced-motion rules |
| Font declarations including `--pixel` | 60 | Full list in JSON; 6 named system typefaces plus 2 generic families |
| Explicit ambient seed particles | 12 | DOM `<i>` elements generated per battle, `src/main.ts:241` |

| File | Hex literal count | Distinct normalized values |
|---|---:|---:|
| `src/style.css` | 548 | 487 |
| `src/hand-readability.css` | 2 | 2 |
| `src/shop-balance.css` | 9 | 9 |
| `src/intent-queue.css` | 12 | 12 |
| `src/art.ts` | 24 | 21 |
| `src/guide.ts` | 92 | 60 |
| `src/main.ts` | 0 | 0 |
| `index.html` | 3 | 2 |

These distinct counts are not additive because files share colors. Shared `C` SVG palette references do not add hex literal occurrences each time they are used. Shorthand is expanded (`#0003` → `#00000033`); RGB and RGBA variants remain distinct. Tests, generated `dist/`, dependencies, API files, and previous screenshots are excluded.

## Palette roles

The 10 root UI color tokens (`src/style.css:5–6`) are the most coherent existing design system:

| Token | Hex | Role |
|---|---|---|
| `--ink` | `#0b171d` | Base night background and dark type |
| `--surface` | `#14262d` | Panels |
| `--surface-raised` | `#20363c` | Raised surfaces token |
| `--line` | `#38515a` | Panel boundaries |
| `--cream` | `#f5edd8` | Primary text |
| `--muted` | `#9bafb2` | Supporting text |
| `--gold` | `#efc37b` | Primary action, score, chain, focus |
| `--mint` | `#9cd6bb` | Squeeks and healthy/live accents |
| `--lilac` | `#c7b0e6` | Multiplier/magic-related accents |
| `--rose` | `#ec9d83` | Warm combat accent |

The 15 SVG illustration colors (`src/art.ts:2–6`) are `ink #271f35`, `deep #352a46`, `plum #51405e`, `lilac #a494bd`, `pale #d6c7e6`, `cream #fff1cb`, `oat #ddbd8c`, `tan #bd865c`, `brown #795044`, `gold #f7c965`, `amber #e49754`, `mint #a6d3af`, `green #668d78`, `rose #e3a0a0`, `blue #8dbac8`. Additional literal seed colors are listed in the exhaustive palette.

Effective card type overrides at `src/style.css:378–379` supersede the original definitions at `260–270`:

| Card type | Accent | Face |
|---|---|---|
| Attack | `#efb198` | `#4a3538` |
| Skill | `#acd8c5` | `#294144` |
| Power | `#cfb4e8` | `#40364f` |
| Curse | `#b3b6ce` | `#2d3444` |

Rarity trim is common `#9aaba5`, uncommon `#97c5b6`, rare `#e9bd72`. Card disabled states use saturation/opacity rather than a separate palette. Buffed card values use `#b3f0ab`, reduced values `#ff9a91` (`src/style.css:550`). Queued intents add attack `#533837` / text `#ffd0b7`, block `#203f56` / text `#c5eaff`, neutral `#364158`, current-turn outline `#e2c684` (`src/intent-queue.css:14–20`). Affordability adds `#ffb2b5`, `#ff9fa6`, and disabled purchase surface `#253337` (`src/shop-balance.css:23–33`).

The source contains hundreds of near-duplicate teal, cream, and translucent gold literals. That count includes superseded card colors and many shadow/gradient alphas; it does not mean 510 perceptually distinct screen colors. A future token cleanup should preserve the warm hamster/cool-night identity while reducing role drift.

## Typography

No font binaries are shipped; these are installed-system stacks. Six named typefaces are referenced: Trebuchet MS, Segoe UI, Lucida Console, Courier New, Impact, Arial Black. Generic families are `sans-serif` and `monospace`.

| Role | Family / source | Sizes and use |
|---|---|---|
| Body/UI | `"Trebuchet MS", "Segoe UI", sans-serif`, `src/style.css:3` | Body, buttons, card titles/descriptions; general h1 32–54 px, h2 23 px, h3 16 px |
| Pixel/accent | `"Lucida Console", "Courier New", monospace` via `--pixel`, `src/style.css:7` | Eyebrows, numbers, metadata, intents, map labels, piles, chain, scores; commonly 6–13 px, score 26–30 px |
| Main title | `Impact, "Arial Black", "Trebuchet MS", sans-serif`, `src/style.css:61` | 64–128 px clamp, 900 weight, uppercase, stacked text-shadow, negative tracking |
| Relic tooltip text | `"Trebuchet MS", sans-serif`, `src/style.css:151` | 11 px / 1.6 |
| Wallet address | `monospace`, `src/style.css:85` | 12 px |
| Final combat card labels | Trebuchet/Segoe, `src/hand-readability.css:10–12` | Bottom action 10 px; pile label 11 px; pile footnote 12 px |
| Guide SVG labels | `font-family="monospace"`, `src/guide.ts:77–79` | 12, 23, 26, 16 px SVG coordinate units; physical size follows SVG scaling |
| HTML boot fallback | `monospace`, `index.html:11` | Inline loading copy |

The imported readability sheet is authoritative for combat cards: desktop title 16 px, rules 12 px; mobile ≤760 px title 18 px, rules 14 px (`src/hand-readability.css:5–7,25–26`). Smaller general card/codex labels and 5–8 px metadata remain elsewhere. Font appearance is platform-dependent; the “pixel” role uses console fonts rather than an authored pixel font.

## Complete keyframe and animation bindings

Unless listed otherwise, every duration is multiplied by `--motion-factor` (slow 1.5, normal 1, fast 0.6). All effects have one iteration and `both` fill except infinite ambience and screen shake. The exact keyframe property values are in JSON.

| Keyframe; definition | Selector / trigger | Duration, easing, loop | Visual movement |
|---|---|---|---|
| `wheel-turn`; `style.css:455` | `.wheel-rotor` title wheel; `.arena-wheel .wheel-rotor` battle (`57,190`) | 100 s title / 55 s combat; linear; infinite | Rotates 360° |
| `idle-breathe`; `456` | `.wheel-hamster` (`58`), `.character-art svg` (`117`), `.player-sprite > svg,.enemy-sprite > svg` (`198–209`) | 3.5 s / 3.6 s / 3 s player / 3.7 s enemy; ease-in-out; infinite; alternate enemies −1.3 s delay | At midpoint −3 px Y and scale 1.015 × 1.025; bottom-origin squash/stretch |
| `seed-fall`; `457` | `.falling-seeds i`, 12 DOM particles (`192`; `main.ts:241`) | 12 s; even children 17 s; multiples of 3 use 14 s; linear infinite; index × −2.3 s delay | From Y −15 to 400 px, X −70 px, rotation 190°, opacity fades to/from .3 |
| `aura-pulse`; `458` | `.power-aura` when any power >0 or power card effect (`219`; `main.ts:242`) | 3 s ease-in-out infinite | Midpoint opacity .35, scale 1.06; lilac border/glow |
| `player-lunge`; `459` | `.acting-attack .player-sprite` after attack card (`440`) | .5 s ease-in-out | Anticipation −12 px/−7°, impact +88 px/+8°/scale 1.05 at 45%, recovery |
| `enemy-lunge`; `460` | `.acting-enemy-attack .enemy-sprite` on end turn for each attacking enemy (`441`) | .5 s ease-in-out; index ×90 ms stagger | Anticipation +10 px/+5°, impact −70 px/−8°/scale 1.06 at 45%, recovery |
| `skill-charge`; `461` | `.acting-skill .player-sprite` for non-power/non-attack play that does not gain block (`442`) | .6 s ease-out | Scale 1.08, mint glow, brightness 1.5 at 45% |
| `power-rise`; `462` | `.acting-power .player-sprite` after power play (`443`) | .65 s ease-out | Lift −18 px, lilac glow 25 px, brightness 1.4 |
| `defend-charge`; `463` | `.acting-defend .enemy-sprite,.acting-defend .player-sprite` when block increases / enemy blocks (`444`) | .55 s ease-out | Blue glow 20 px, brightness 1.3, scale .95 ×1.04 |
| `cast-charge`; `464` | `.acting-cast .enemy-sprite` for enemy buff/FUD/reject (`445`) | .6 s ease-out; index ×90 ms stagger | Lift −10 px, lilac glow 22 px, brightness 1.5 |
| `receive-hit`; `465` | `.acting-receive .player-sprite` on every end-turn presentation (`446`) | .4 s ease-out | Recoil −13 px/−4° at 35%; emitted even if no HP damage |
| `hit-flash`; `466` | `.hit-flash .enemy-sprite > svg,.hit-flash .player-sprite > svg` when aggregate HP delta >0 (`447`) | .4 s steps(1) | White silhouette for first 45%, reset, brightness 2 at 66–85% |
| `death-fade`; `467` | `.enemy-card.dying` when enemy HP crosses to zero (`448`) | .7 s ease-in; action delay +150 ms | Fade, grayscale .5→1, drop +30 px, scale .8; disables pointer events |
| `damage-rise`; `468` | `.damage-float`; also `.block-float` for net block gain (`449–450`) | .85 s ease-out | Start opacity 0 / scale .6 / Y18, peak scale1.15 / Y−12 at17%, rise to Y−75 / fade |
| `live-pulse`; `469` | `.live-dot.spinning` market/day live status (`154`) | 2 s ease-in-out infinite; **not speed-scaled** | Opacity .4 at midpoint |
| `score-float`; `470` | `.score-pop` after positive aggregate battle-score gain (`185`; `main.ts:483`) | 1 s ease-out | +score pops from Y12 /scale .8 to Y−3 /scale1.08, then Y−55 and fade |
| `card-play`; `471` | `.card-play-effect` after card play (`451`; `main.ts:481`) | .65 s ease-out | Fixed center-screen card clone: rises from Y100/−8°/scale .85, peaks +4°/1.05, flies to Y−180/+10°/.4 and fades |
| `squeek-pop`; `472` | `.squeek-burst` on new best hit ≥100 or score gain ≥1000 (`452`; `main.ts:484`) | 1.2 s ease-out | Full-screen radial gold wash and SQUEEK/score; scale .5→1.08→1→1.06, fade |
| `screen-shake`; `473` | `.squeek-shake` on app shell during the same burst (`454`) | .45 s steps(2,end), **2 iterations** | Whole app ±3–4 px X/Y, including UI |

Every combat actor animation, flash, and float shares `--action-delay` (`style.css:440–449`). Enemy delay is generated only on end turn and is `motionDuration(settings, index * 90)`. Death's extra 150 ms and ambient −1.3 s / seed −2.3 s delays are fixed, so those offsets do not scale with the speed setting. A locked character explicitly disables the idle binding (`style.css:130`).

## Complete CSS transition inventory

| Source | Selector | Properties / duration | Trigger / visible response |
|---|---|---|---|
| `style.css:39` | `.primary-button,.start-button,.secondary-button,.danger-button` | background, transform, box-shadow; .18 s each; default ease | Hover/press: primary rises −2 px then presses +2 px, shadow height changes; secondary rises −2 px; danger changes background |
| `style.css:47` | `.ghost-button` | background, color; .18 s ease | Hover changes fill/text; border-color changes instantly because it is not transitioned |
| `style.css:66` | `.menu-button` | border-color, background, transform, box-shadow; .2 s ease | Hover raises −2 px, gold border/text, taller shadow |
| `style.css:100` | `.mode-choice,.character-choice` | transform, border-color, box-shadow; .22 s ease | Eligible hover raises −7 px and brightens border/glow |
| `style.css:201` | `.enemy-card` | border-color, background; .2 s ease | Hover and target selection tint; drag-over style exists, but no listener adds `drag-over` |
| `style.css:212` | `.health-fill` | width; .3 s ease | Intended HP depletion interpolation; each render recreates element, so source alone does not establish a previous width for the transition |
| `style.css:229` | `.hand .card` | transform, box-shadow, filter; .18 s ease | Hover/focus/selection elevation; more specific than base `.card` |
| `style.css:249` | `.map-node` | border-color, background, box-shadow; .18 s ease | Reachable-node hover fill/glow; no path traversal animation |
| `style.css:260` | `.card` | transform, box-shadow, filter; .18 s ease-out | Generic hover −8 px/−.5°, active −3 px/scale .98; disabled desaturates |

Speed preferences scale CSS keyframes and JS cleanup timers, but not these transition durations. Two global reduced-motion rules replace all transition durations with .01 ms (`style.css:544,611`).

Hand layout/motion is overridden by the imported readability sheet: base transform is `none`; desktop height ≤950 px uses a −12 px hover lift (`hand-readability.css:3,13–17`); desktop height >950 px retains the more specific original hover −35 px/scale1.07 (`style.css:231`). At mobile ≤760 px, hover, focus, and selected cards all retain `transform:none` (`hand-readability.css:19–24`). The hand scrolls horizontally; mobile scroll snapping is `x proximity` (`style.css:594–597`). Native drag starts a browser drag ghost and dims the source to .3, adds dashed enemy targeting outlines, and removes them at drag end (`main.ts:631–662`). There is no authored curved targeting line or card-to-target projectile.

## Feedback, particle, and screen-motion behavior

| System | Implementation / source | Current visual coverage |
|---|---|---|
| Combat ambience | 12 seed `<i>`s, wheel, breathing, lilac aura; `main.ts:241–242`; `style.css:190–219` | CSS/DOM only; no dynamic hit particle pool |
| Block | Static blue shield bubble around player while block >0; static small shield on enemies; `main.ts:242,251`; `style.css:217–218` | Gain uses blue float/glow; absorbed damage has no block-break fragment/burst or “blocked” feedback |
| Damage | Computes `before.hp − after.hp`; `main.ts:469–479` | One aggregate damage float per actor per action; no per-hit sequence, enemy recoil, damage-type trail, impact spark, or damage-tier variant |
| Multi-hit | Engine repeats hits (`engine.ts:278,348–349`); presentation only inspects final HP deltas (`main.ts:469–479`) | Double Lap / repeated enemy attacks collapse into a single visible hit/number |
| Enemy turns | Index ×90 ms actor delay (`main.ts:475`) | All actions substantially overlap; damage to player is aggregated and starts at delay 0, independently of the enemy's impact pose |
| Card flight | Recreates played card at fixed `left:calc(50% - 80px);top:40%`, width160; `style.css:451` | No origin at hand slot; no arrival at enemy, discard, exhaust, or power area |
| Score and chain | Score jumps to final engine values plus one +score float; 20 static pips turn gold (`main.ts:239,483`) | No count-up, sequential multiplier trigger emphasis, ping per chain link, coin/relic acquisition flight, or cause-to-score trail |
| Big combo | Threshold full-screen SQUEEK text/score + radial wash + whole-app shake; `main.ts:419,484`; `style.css:452–454` | One celebration tier; ordinary first new hit ≥100 can trigger it; no rarity/boss/run-clear sequence |
| Death / defeat | Enemy fade and grayscale; player receives same hit recoil/flash, then results (`main.ts:479–488`) | No separate player death keyframe; `dying` animation selector only matches enemies |
| Shop states | Sold/unaﬀordable art turns grayscale + .6 opacity; `shop-balance.css:24–30` | Immediate changes; no purchase transaction/acquisition motion |
| Tooltips and modal previews | `display:none`→`block` relic tooltip; conditional modal markup (`style.css:150–152`; `main.ts:379–393`) | Instant appearance/disappearance; no entry/exit/fade/stagger |
| Screen changes | `render()` assigns `root.innerHTML`; `main.ts:405–438` | Title→mode→character→map, encounter changes, rewards, shop, rest, result, codex, guide pages all replace instantly |
| Toast | Conditional fixed box; removed after 5.5 s (`main.ts:75–79`; `style.css:371`) | No enter/exit animation |
| Map camera | Sets `.map-scroll.scrollTop` on render; `main.ts:415,430` | Preserves scroll in scene; otherwise jumps to current floor; no camera pan, node arrival pulse, or animated path |
| Guide gestures | Changes guide page through render; `main.ts` guide-page/swipe handlers | No page slide/drag tracking animation |
| Audio companion | One 120 ms triangle oscillator after every play, pitch rises with chain; `main.ts:744–758` | Supports card play; no discrete hit/block/death/relic/coin UI audio event layers |

## Timing and accessibility

Preferences expose slow/normal/fast and “Pause ambient motion, flashes, and action effects” (`main.ts:348`). `applyPreferences()` puts the effect/speed state on `<html>` and sets `--motion-factor` to 1.5/1/.6 (`main.ts:397–403`). `motionDuration()` uses the same factor, returns 0 for Reduce Effects or system `prefers-reduced-motion`, and is presentation-only (`preferences.ts:59–74`). Changing to reduced effects clears transient presentation (`main.ts:666–674`).

Both manual and OS reduced-motion rules disable all animations with `!important`, shorten transitions to .01 ms, force scroll behavior auto, hide falling seeds and power aura, and remove the burst background (`style.css:544–545,610–612`). The OS rule also positions hypothetical static card-play/score elements, but JS normally avoids creating them because duration is 0. No separate screen-shake setting exists, although the global reduced-effects option handles it.

Action lifetime is normally **1050 ms**, while the played-card lifetime is 650 ms (`main.ts:467,481,485–491`). Big-combo CSS lasts **1200 ms**, so cleanup removes it 150 ms before its final keyframe; this mismatch scales with speed. Fifth-enemy damage floats can last `.36 + .85 = 1.21 s` and outlive the 1.05 s cleanup. Death has an additional fixed 150 ms delay. These are source-derived timing mismatches, not measured frame captures.

## Art-direction findings for the critique

1. **Impact sequencing is the biggest motion issue.** Player lunge reaches contact around225 ms while target flash/number begins immediately. All HP values already show final state. Aggregate turn damage makes multi-hit intent unreadable in motion. Queue one short presentation event per hit, align flash/number/HP update to contact, and retain stable actor/HP nodes so the authored .3 s bar transition can run. Enemy hit reaction needs its own directional recoil.
2. **Score spectacle lacks a causal sequence.** The score +pop and full-screen threshold celebration exist, but multiplier/chain/relic contributions jump at once. A restrained Balatro-inspired sequence should highlight each contributing source, then the total, with bounded short pauses and progressively brighter/accented feedback; reduced-effects mode should still summarize contributions clearly.
3. **Presentation lifetime is not tied to animation completion.** The1050 ms reset clips the1200 ms burst and late staggered float effects. Tie cleanup to the longest scheduled event or animation completion, and normalize all fixed delays to speed.
4. **The whole DOM is replaced on normal updates.** This likely restarts wheel/breathing and action animations, cancels in-progress interpolation, and turns declared HP transitions into jumps. Verify in browser; preserving actor/UI identity is the prerequisite for reliable animation polish.
5. **The quiet, warm nocturnal identity works, but hierarchy is muted.** Source has510 CSS hex values and overlapping older/later palettes. Consolidate semantic accents and brighten only interactable/action-critical elements. The six system font choices and tiny console labels weaken consistency; preserve the enlarged14 px mobile hand rules while simplifying metadata elsewhere.
6. **Transitions between game beats are absent.** Reward reveal, shop purchase, rest heal/upgrade, relic acquisition, node arrival, player death, and run clear have no distinct bespoke motion. Add short scene-specific gestures and directional object travel after impact clarity is fixed.
7. **Reduced-motion support is already substantive.** Preserve it while adding effects. It should remove shake/flash/travel without removing important state/cause feedback.

No source changes, implementation, commits, pushes, or new external art assets are part of this audit.
