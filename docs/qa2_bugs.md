# QA2 bugs and verification

Baseline: pulled `main` with rebase/autostash before changes; existing unrelated local files were preserved. Captured the original battle hand at 1440×900 and 390×844 and the original shop before modifying game code. All browser checks use Playwright's own headless Chromium.

## Card text / behavior mismatches fixed

| Card | Problem | Fix |
| --- | --- | --- |
| Wheel Kick | Its explicit bonus Squeeks were missing; only damage contributed Squeeks. | Add the displayed, upgrade/merge-scaled bonus separately from damage scoring. |
| LFG | Only later cards counted; earlier cards and LFG itself did not. Multiple copies did not stack. | Award +0.3 Mult for every card already played this turn, including itself, and stack later triggers per copy. |
| NGMI | Two attack-free turns exhausted only copies currently held, leaving copies cycling through draw/discard. | Exhaust all copies in hand, draw, and discard after two consecutive attack-free turns; an attack resets the count. |
| Peak RPM | Rounded X × RPM before applying upgrade/merge scaling, producing incorrect damage. | Round the complete formula once. At X=3, RPM=225, upgraded damage is 10 instead of 11. |
| Paper Hands | Ranked printed attack damage instead of current scoring effects; multiple held curses discarded only one card. | Project each card's immediate score, including dynamic attacks, multipliers and choices, and discard once per held copy. Fixed-cost cards still rank at zero remaining Seeds. |
| Touch Grass | Exhausted curses survived the promised curse cleanse. | Remove curses from the run deck and every battle pile, including exhaust. |
| WHEELY9000 Firmware Upgrade | Exhausted WHEELY copies and already-active Overclock powers stayed unupgraded. | Upgrade all battle zones and the run deck, and update active Overclock triggers immediately. |
| Oracle Ping | With fewer than three draw cards, the choice dialog omitted cards available from the next discard reshuffle. | Share a pure, deterministic three-draw preview between UI and resolver; confirmed choices include reshuffled cards. Cancellation remains free. |
| Sleep Cam / Spacetime Fold | Future intent previews applied enemy buffs, queue growth and status decay during a turn that Fold would skip. | Simulate the skipped enemy action and the once-per-battle Fold use when forecasting intents. |

## Readability and coin UI defects fixed

| Surface | Problem | Fix |
| --- | --- | --- |
| Battle hand | Tiny names/rules and overlapping cards hid neighboring text. | Enlarge names/rules, allow wrapping and flexible card height, compact artwork, remove overlapping hand cards, and keep horizontal scrolling within the hand. |
| Battle labels | Pile labels, exhausted count and play footer were too small to read. | Use readable sizes/contrast and wrap the play footer. Keep the complete normal mobile battle controls inside the requested viewport. |
| Shop balance | Balance was buried in muted copy and absent from the sticky leave bar. | Prominent live YOUR COINS counters at the shop top and sticky footer. Both update after purchases and removals. |
| Unaffordable shop items | Only the buy button was disabled; items lacked clear unaffordable styling. A generic disabled-button opacity rule also dimmed prices. | Grey card/relic items, disable buying/removal, and show full-contrast red prices plus an explanation. Exact-balance purchases remain enabled. |
| Last-card removal | Shop offered removal of the final deck card, which the engine rejected. | Disable removal/select controls and explain the minimum deck size. |
| Route map / rest | No explicit screen-level balance. | Add visible coin balances to both screens, retaining the shared run header. |

## Measured text sizes

| Text | Desktop old → new | Mobile old → new |
| --- | --- | --- |
| Hand card name | 12 → 16 px (+33%) | 14 → 18 px (+29%) |
| Hand effect text | 9 → 12 px (+33%) | 11 → 14 px (+27%) |
| Tap/drag footer | 5 → 10 px | 7 → 10 px |
| Draw/discard labels | 7 → 11 px | 5 → 11 px |
| Exhausted count | 6 → 12 px | 5 → 11 px |

Dynamic highlighted values inherit the effect text size. Cards grow for longer rules rather than clipping their text.

## Automated and browser verification

- Vitest: **415 tests passed in 20 files**. New QA2 tests: **151 card-effect tests** (120 independent base/upgraded contracts covering all 60 cards, plus 31 condition, boundary, choice, status and delayed-trigger regressions), **11 shop/map/rest UI tests**, and **1 Oracle reshuffle UI regression**. Every contract actually plays the card and checks its effects, cost, and destination pile. Expected values are handwritten rather than read back from the resolver.
- Production build: TypeScript and Vite pass.
- Layout: **240 card layouts** (60 cards × base/upgraded × desktop/mobile), with no clipped card text or page-width overflow. Additional Chromium checks verify visible battle controls, shop red prices/grey items, live purchase balances, and map/rest balances.
- Playwright: three natural six-room runs from the start menu, using desktop clicks, native drag-to-play and mobile tap/preview/play. **109 natural card plays**, plus **7 controlled plays** covering Oracle, Gud Tek, Merge, a second enemy target and normal-animation drags. A native drag held for 1150 ms across the prior animation timer still drops successfully and gains Block. No page errors. These are partial runs through six rooms, not claims of complete 24-room victories.
- No new UI interaction defect was reproduced in these exercised play paths.

Reproduce after starting `npm.cmd run dev` (set `SQUEEKSPIRE_URL` if the Vite port differs; this session used `http://127.0.0.1:5174/`):

```powershell
npm.cmd test
npm.cmd run build
node scripts/qa2-layout.mjs
node scripts/qa2-playwright.mjs
```

Install Playwright's own Chromium with `node node_modules/playwright/cli.js install chromium` if needed. Browser fixture setup observes or supplies state through test-only network interception; production has no mutable QA hooks.

Evidence lives in `shots/qa2/`: requested `before_desktop.png`, `before_mobile.png`, `after_desktop.png`, `after_mobile.png`, `shop_before.png`, and `shop_after.png`; supplemental mobile/shop/map/rest screenshots; `before_metrics.json`, `layout_report.json`, and `playtest_report.json`.
