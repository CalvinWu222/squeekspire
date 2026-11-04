# Squeekspire UX v2

## Experience

- Replaced the dashboard landing page with a full-screen title, original pixel wheel and hamster, animated background, amber Squeekspire wordmark, and focused menu. Continue appears only for a current, unfinished save, including Practice and Endless. Seed and hamster status sit in the corner.
- Start Game → Daily / Practice / Endless → character selection → first battle. Zoomie Gremlin is playable; Seed Hoarder and Professional Napper are locked silhouettes. Daily is claimed only when entering the spire.
- Rebuilt battle around a hamster on the left and enemies on the right, a moving cage/wheel/seed backdrop, breathing sprites, explicit sword/shield/cast intents, and top score/multiplier/chain bars. Cards fan across the bottom with energy, draw/discard counts, pile inspection, and End Turn. Narrow portrait screens use a readable, horizontally scrollable hand.
- Attacks support drag-and-drop or card-then-target clicks. Skills and powers play on click. Selection alone spends no energy and records no action. Damage, shields, charges, powers, enemy actions, and death have distinct visual feedback; large scores trigger SQUEEK! Motion settings affect presentation only.
- The route climbs upward, retains all 24 real rooms and their actual branches, highlights reachable nodes, and includes a legend. Shop, rest, and event screens have a fixed Back to route control. The run header concentrates HP, gold, relics, and deck access.
- Moved local leaderboards, replay export/verification, and abandonment into More.
- Added four original SVG-illustrated How to Play pages in English and Simplified Chinese. Settings persist language, volume, animation speed, and reduced effects in localStorage. System reduced-motion preferences are also respected. Volume controls short synthesized squeeks.
- Kept the illustrated searchable/filterable card codex and original encounter art. All visuals are local CSS and original inline SVG; no external art, fonts, or runtime visual dependencies were added.

## Rules and replay boundary

`src/game/` and the replay format are unchanged. UI choices call the existing reducer and saves still contain verifiable action logs. To guarantee a battle as the first visible encounter without altering the seeded map, any quiet opening rooms are traversed using existing logged `enter` and `leave` actions, with no room benefit granted. Later room exits use the same legal `leave` action.

Settings, card selection, pile inspection, codex filters, and animation timers do not advance the engine. Animation cleanup preserves a newly selected card and defers DOM replacement during an active drag.

## Verification

- `npm.cmd run build`: passed (TypeScript and Vite production build).
- `npm.cmd test`: 82 tests passed across 10 test files.
- Added launch/daily-claim, replay equivalence, all-mode Continue, click/drop target, room exit, settings persistence/validation, bilingual guide, modal focus, and animation/drag regression coverage.
- Test discovery is scoped to `src`, where all repository test files live, to avoid traversing restricted Edge profile directories under `.tmp`.
- `.tmp/shots.mjs` uses installed headless Edge and CDP. It clicks through the real menus, captures an attack in progress, wins the opening battle using normal controls, and captures the route without modifying engine state. Outputs are in `shots/v2/`, including desktop/mobile screens, `report.json`, and the capture's logged action summary.
- Final capture produced 12 screenshots at desktop 1440×900 and portrait 390×844, with no page overflow in any captured screen. All five opening hand cards have exposed pointer targets on desktop, End Turn is inside the viewport and directly clickable, and the capture reports zero application errors or gaps. English and Chinese illustrated guide screens are included.

Screenshots: [main menu](shots/v2/main-menu.png), [character selection](shots/v2/character-select.png), [battle](shots/v2/battle.png), [attack in progress](shots/v2/battle-attack.png), [route after winning](shots/v2/map.png), [portrait battle](shots/v2/battle-mobile.png), [Chinese guide](shots/v2/how-to-zh.png), [capture report](shots/v2/report.json).

## Known gaps

- The two additional characters are intentionally locked. Card rules, encounter copy, and most combat labels remain English; menu and all four guide pages support both requested languages.
- Audio is limited to synthesized feedback; there is no music or recorded soundtrack.
- The existing bundled settled-data snapshot/date-based daily seed remains in use. The redesign does not introduce a live daily snapshot publisher or an online leaderboard.
- Multi-hit damage feedback shows the aggregate actual HP change for each action. Opening noncombat rooms are automatically passed as described above.

No push, deployment, Discord messaging, or wallet actions were performed.
