# Art changes

- Finished the interrupted upgrade and restored the missing `src/style.css` import target.
- Added a consistent cozy cage-world presentation for camp, the connected 24-hour map, battles, shops, rest stops, events, rewards, and results. Golden Zoomies rooms glow; hibernation adds dream mist.
- Original inline pixel SVG illustrates all 60 cards, Zoomie Gremlin, and all 12 enemies. Cards have type frames, rarity borders, cost gems, meme flavor text, and hover/play effects. Combat includes health/block bars, intents, an energy orb, and SQUEEK score bursts.
- The Card codex menu shows every card, including starters and curses, with combined type, rarity, and text filters; relics and enemies have their own tabs.
- Added responsive layouts, keyboard focus handling, inert modal backgrounds, persistent shop/rest selections during redraws, and reduced-motion overrides. X-cost controls now match the existing reducer at zero energy.
- Game engine, catalog, seeded map generation, and replay/storage rules are unchanged. Visuals and font fallbacks are self-contained; no external assets or fonts are fetched.

Validation: `npm.cmd run build` succeeds; `npm.cmd test` passes all 60 tests in 8 files. Browser checks covered desktop and 390px layouts, all-card text fit, filters, swarm targeting, card play/turns, shops/rest, fog, rewards, events, and results. Reduced-motion overrides were checked in the browser's parsed stylesheet. Modal screenshots timed out in the browser tooling; those layouts were checked through rendered DOM measurements and UI interactions.
