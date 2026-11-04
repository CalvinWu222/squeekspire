# Squeekspire — complete art and motion inventory

Read-only audit of the current working tree, **2026-11-04**. Paths below are relative to the repository root. No source edits, implementation, commits or pushes were performed. Audit files and the isolated Vite cache are confined to `docs/art_audit/`. The local source was reviewed and rendered; this audit does not assert parity with the public deployment.

## At a glance

| Design family | Count | Main source |
|---|---:|---|
| Card art | 60 unique compositions; 60/60 catalog coverage | src/art.ts; src/game/catalog.ts |
| Card categories / rarity | 18 attack, 27 skill, 12 power, 3 curse; 29 common, 21 uncommon, 10 rare | src/game/catalog.ts; src/style.css |
| Actors | 13 = 1 player + 12 enemies | src/art.ts; src/game/catalog.ts |
| Relic symbols | 15; 15/15 coverage | src/main.ts → relicIcon() |
| Room / general UI symbols | 7 room + 6 UI | src/art.ts → nodeIcon(); src/main.ts → icon() |
| Encounter vignettes | 5 defined / 4 used; camp vignette is inactive | src/art.ts → scenes/sceneArt() |
| Title/arena wheel; tutorial diagrams | 1 articulated wheel + 5 diagrams | src/guide.ts |
| Energy seed | 1 family / 2 variants | src/art.ts → seedArt() |
| Shared drawing motifs | 22; reused, not additional catalog assets | src/art.ts |
| Runtime image files / sheets / custom font files | 0 / 0 / 0 | Active game is inline SVG + CSS + system fonts |
| Non-runtime authored PNGs | 2 marketing covers | docs/cover/ |
| Historical screenshot evidence | 149, excluded from game-asset counts | shots/ (139), .tmp/ (10) |
| CSS source files | 4, in explicit import order | src/style.css → hand-readability.css → shop-balance.css → intent-queue.css |
| Runtime/boot source hex values | 588 normalized values / 690 occurrences, including alpha; CSS subset 510 / 571 | Full table below; presentation-data.json |
| Fonts | 6 named system faces + 2 generic families; 60 CSS declarations incl --pixel | CSS, guide SVG labels, index fallback |
| CSS motion | 19 keyframes; 24 animation shorthands (21 active bindings + 3 disables); 16 longhands; 9 transition shorthands + 2 reduced-motion overrides | src/style.css and overrides |
| Explicit ambient seed particles | 12 per battle | src/main.ts → battle() |
| Offline cover hex values | 56 normalized values / 58 occurrences; separate from runtime | docs/cover/scene.html; cover-palette.md |
| Current audit screenshots | 48 PNGs: 27 desktop / 21 mobile at 390px | docs/art_audit/shots/ |

Counts distinguish **authored compositions**, reused motifs and rendered copies. They must not be summed into one total. Hex counts include old overridden CSS and alpha variants, not perceived screen colors. Assets are defined in code, so an empty image directory is not an absence of art. Physical-media counts exclude dependencies, browser/cache data, Git, bundled duplicates and this audit.

## Navigation and evidence

- **Assets:** every card, actor, relic and icon; card frames; every screen background; motif library; offline PNGs and historical media paths.
- **Presentation:** palette roles/hex values, effective typography, every keyframe and transition, particles/VFX, hit/damage/block/score feedback, UI motion and reduced effects.
- **Palette appendix:** all 588 normalized source hex values with usage counts and source locations.
- [48-shot index](shots.md), [plain shot list](shot-files.txt), [PNG verification](shot-validation.json), [raw browser measurements](capture-report.json).
- [Prioritized critique and Top 5 quick wins](critique.md). Machine-readable extraction: [assets](asset_counts.json), [presentation](presentation-data.json).
- [Source SHA-256 baseline](source_hashes.json) and [final source integrity check](source_integrity.json).

### Capture and scope notes

The audit uses an isolated local Vite server on port 5187, with its cache under this directory. Existing public engine exports construct map/combat/shop/rest/event/reward fixtures. A Playwright-only response hook returns those fixtures from loadActive in browser memory; disk source remains untouched. Menu screens and game over use natural UI flow. Network responses for leaderboard/score are intercepted; leaderboard names/scores are synthetic and no live submission occurs. Normal animation is enabled, audio is muted, external data is blocked for fallback consistency. Still images document composition; timing statements are sourced from code and browser diagnostics rather than inferred from a single frame.

Runtime DOM checks verify about 50px of desktop hover clipping, health/ambient element replacement on action, and no horizontal document overflow in the captured states. They do not establish that every possible seed, card combination, OS font fallback or device has been playtested. Full-page screenshots contain scrollable areas and may place fixed controls at the capture's current scroll position; mobile viewport shots 44, 46, 47 and 48 supplement them.

### Reproduction

PowerShell, from the repository root (use npm.cmd if invoking npm; scripts below use the installed packages directly):

```powershell
$env:PATH = 'C:\Users\Administrator\squeek-code\tools\node-v22.11.0-win-x64;' + $env:PATH
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
node docs/art_audit/serve.mjs
# In a second terminal with the same environment:
node docs/art_audit/capture.mjs
node docs/art_audit/capture.mjs --supplement
node docs/art_audit/extract_assets.mjs
node docs/art_audit/extract-motion.mjs
node docs/art_audit/build_report.mjs
node docs/art_audit/source_guard.mjs --verify
```

The SHA-256 baseline was recorded before captures and should not be overwritten when verifying this audit. All reproduction outputs remain under docs/art_audit/.

---

## Visual asset inventory

Read-only audit of the current working tree on 2026-11-04. Paths are relative to the repository root. Dependency folders, Git, npm cache, browser profile data, and this audit’s outputs are excluded from the media census. Runtime composition counts are separated from reused motifs and historical screenshots.

### Counts and provenance

| Family | Count | Source / use |
| --- | --- | --- |
| Catalog card illustrations | 60 / 60 covered | `src/art.ts:81`; renderer `src/art.ts:144`; catalog `src/game/catalog.ts:5` |
| Actor sprites | 13 | 1 playable Zoomie Gremlin + 12 catalog enemies; `src/art.ts:165` |
| Relic icons | 15 / 15 covered | 24 × 24 continuous stroke SVG; `src/main.ts:83` |
| Room / map icons | 7 | battle, elite, boss, rest, shop, event, treasure; `src/art.ts:232` |
| General UI icons | 6 | attack, block, cast, heart, coin, deck; `src/main.ts:103` |
| Encounter vignettes | 5 defined, 4 used by main.ts | camp (unused outside tests), shop, rest, results, event; `src/art.ts:208` |
| Title / arena wheel | 1 articulated SVG | 600 × 600 wheel with independent rotor and hamster groups; `src/guide.ts:18` |
| How to Play illustrations | 5 | 400 × 260 self-contained SVG compositions; `src/guide.ts:72` |
| Sunflower energy illustration | 1 family, 2 variants | 32 × 40: face for energy supply, compact faceless variant for card costs; `src/art.ts:20` |
| Shared illustration motifs | 22 | Reusable motif/composition functions, listed below; excluded from composition totals |
| Runtime file-backed art / sprite sheets / raster textures | 0 | No active image imports, image URLs, CSS url(), <img>, canvas, or sprite sheet loader in runtime source |
| Runtime custom font files / remote fonts | 0 | System font stacks only; no @font-face or font fetch |
| Standalone authored marketing PNGs | 2 | docs/cover/cover-1200x630.png and docs/cover/cover-512.png; not loaded by the game |
| Historical screenshot files | 149 | 139 under shots/ plus 10 temporary QA PNGs under .tmp/; not game assets |
| Other standalone image / SVG / icon / font files | 0 | Outside excluded dependency/browser data and audit outputs |

The source explicitly describes its illustration set as original (`src/art.ts:1`, `src/guide.ts:17`, `docs/cover/scene.html:13`). “Generated” here means composed at runtime from paths and rectangles; the repository provides no evidence of AI image generation or imported third-party art. No external image/font requests are made by these renderers. Shapes are decorative aria-hidden SVG except the guide diagrams, which carry an accessible image label.

The nine SVG render entry points are seedArt, cardArt, spriteArt, sceneArt, nodeIcon (`src/art.ts`), wheelArt and illustration (`src/guide.ts`), relicIcon and icon (`src/main.ts`). Unknown card IDs fall back to a sprout; unknown sprites to Dust Mite; unknown room kinds to a star; unknown relics to a circle. These safety fallbacks are not additional catalog assets.

### Cards, illustration panels, and frames

All 60 cards have distinct keyed compositions, with no missing art IDs. There are 18 attacks, 27 skills, 12 powers, and 3 curses; 29 common, 21 uncommon, and 10 rare cards. The 10-card starter deck has four unique art IDs: Wheel Kick ×4, Cheek Pouch ×4, 3AM Dash ×1, Seed Snack ×1 (`src/game/catalog.ts:70`).

Each art panel is 128 × 96 and shares the same deep-plum field, three small background marks, bottom ground strip, and three bedding flecks (`src/art.ts:144`). Every panel uses the common motif library below plus custom paths/rectangles. Art is identical in hand, rewards, shop, codex, deck/pile, upgrade, merge, and enlarged preview. Card upgrades/merge levels alter text labels and rule values, not illustration composition (`src/main.ts:201–217`).

There is one CSS card-frame construction rather than image frames: a rounded 2 px rarity border, inset dark border, gradient face, two square bottom-corner marks, type label, title, art border, description, optional flavor divider, and footer (`src/style.css:260–285`, markup `src/main.ts:217`). Four card-type treatments are combined with three rarity treatments; the later effective colors are attack #efb198 / #4a3538, skill #acd8c5 / #294144, power #cfb4e8 / #40364f, curse #b3b6ce / #2d3444; common border #9aaba5, uncommon #97c5b6, rare #e9bd72 (`src/style.css:378–379`). Curses retain a diagonal stripe texture from the earlier rule. The cost badge is compact seedArt rather than a gem sprite.

| Card ID / name | Type · rarity | Shared motifs in composition | Artwork / definition |
| --- | --- | --- | --- |
| `wheel-kick` — Wheel Kick | attack · common | star, wheel, hammy, speed | `src/art.ts:82`; `src/game/catalog.ts:6` |
| `cheek-pouch` — Cheek Pouch | skill · common | seed, shield, hammy | `src/art.ts:83`; `src/game/catalog.ts:7` |
| `3am-dash` — 3AM Dash | attack · common | moon, bolt, hammy, speed, clock | `src/art.ts:84`; `src/game/catalog.ts:8` |
| `seed-snack` — Seed Snack | skill · common | star, seed, hammy, heart | `src/art.ts:85`; `src/game/catalog.ts:9` |
| `burst-sprint` — Burst Sprint | attack · common | star, hammy, speed, flame | `src/art.ts:86`; `src/game/catalog.ts:10` |
| `double-lap` — Double Lap | attack · common | star, wheel, hammy | `src/art.ts:87`; `src/game/catalog.ts:11` |
| `tail-whip` — Tail Whip | attack · common | star, hammy | `src/art.ts:88`; `src/game/catalog.ts:12` |
| `wood-chew` — Wood Chew | attack · common | hammy | `src/art.ts:89`; `src/game/catalog.ts:13` |
| `wheel-spin` — Wheel Spin | attack · common | star, wheel, speed | `src/art.ts:90`; `src/game/catalog.ts:14` |
| `bedding-fort` — Bedding Fort | skill · common | shield, hammy | `src/art.ts:91`; `src/game/catalog.ts:15` |
| `ball-up` — Ball Up | skill · common | star, shield, hammy | `src/art.ts:92`; `src/game/catalog.ts:16` |
| `sniff` — Sniff | skill · common | star, seed, hammy | `src/art.ts:93`; `src/game/catalog.ts:17` |
| `sunflower-stash` — Sunflower Stash | skill · common | star, seed, sprout | `src/art.ts:94`; `src/game/catalog.ts:18` |
| `water-bottle` — Water Bottle | skill · common | heart | `src/art.ts:95`; `src/game/catalog.ts:19` |
| `squeek` — Squeek! | attack · common | star, hammy | `src/art.ts:96`; `src/game/catalog.ts:20` |
| `pellet-toss` — Pellet Toss | attack · common | seed, hammy | `src/art.ts:97`; `src/game/catalog.ts:21` |
| `wheel-brake` — Wheel Brake | skill · common | shield, wheel | `src/art.ts:98`; `src/game/catalog.ts:22` |
| `cage-climb` — Cage Climb | skill · common | star, hammy | `src/art.ts:99`; `src/game/catalog.ts:23` |
| `night-owl` — Night Owl | power · common | star, moon | `src/art.ts:100`; `src/game/catalog.ts:24` |
| `fluff-up` — Fluff Up | skill · common | star, hammy | `src/art.ts:101`; `src/game/catalog.ts:25` |
| `marathon` — Marathon | power · uncommon | wheel, hammy | `src/art.ts:102`; `src/game/catalog.ts:26` |
| `settlement` — Settlement | skill · uncommon | star, paper, clock | `src/art.ts:103`; `src/game/catalog.ts:27` |
| `oracle-ping` — Oracle Ping | skill · uncommon | cardBack | `src/art.ts:104`; `src/game/catalog.ts:28` |
| `block-reward` — Block Reward | attack · uncommon | star, seed, shield | `src/art.ts:105`; `src/game/catalog.ts:29` |
| `overrun` — Overrun | attack · uncommon | hammy, speed | `src/art.ts:106`; `src/game/catalog.ts:30` |
| `merge` — Merge | skill · uncommon | star, cardBack | `src/art.ts:107`; `src/game/catalog.ts:31` |
| `stake` — Stake | skill · uncommon | star, seed, bolt, sprout | `src/art.ts:108`; `src/game/catalog.ts:32` |
| `burrow` — Burrow | skill · uncommon | hammy, sprout | `src/art.ts:109`; `src/game/catalog.ts:33` |
| `rolling-median` — Rolling Median | power · uncommon | shield | `src/art.ts:110`; `src/game/catalog.ts:34` |
| `insomnia` — Insomnia | power · uncommon | star, moon, hammy, clock | `src/art.ts:111`; `src/game/catalog.ts:35` |
| `genesis-seed` — Genesis Seed | power · rare | star, sprout | `src/art.ts:112`; `src/game/catalog.ts:36` |
| `peak-rpm` — Peak RPM | attack · rare | star, bolt, wheel, speed | `src/art.ts:113`; `src/game/catalog.ts:37` |
| `nocturnal` — Nocturnal | power · rare | star, moon, hammy | `src/art.ts:114`; `src/game/catalog.ts:38` |
| `full-moon-run` — Full Moon Run | attack · rare | hammy, speed | `src/art.ts:115`; `src/game/catalog.ts:39` |
| `maus-mode` — maus Mode | power · uncommon | hammy | `src/art.ts:116`; `src/game/catalog.ts:40` |
| `freeze-for-mint` — Freeze for Mint | skill · uncommon | star, seed | `src/art.ts:117`; `src/game/catalog.ts:41` |
| `aura-farm` — Aura Farm | power · uncommon | star, hammy, sprout | `src/art.ts:118`; `src/game/catalog.ts:42` |
| `buildooooor` — Buildooooor | attack · common | star, hammy, bench | `src/art.ts:119`; `src/game/catalog.ts:43` |
| `squeektoshi-sleeping` — Squeektoshi Is Sleeping | skill · common | moon, sleepMark, hammy | `src/art.ts:120`; `src/game/catalog.ts:44` |
| `wheely-overclock` — WHEELY9000 Overclock | power · rare | star, bolt, wheel, gear | `src/art.ts:121`; `src/game/catalog.ts:45` |
| `gm` — gm | skill · common | hammy | `src/art.ts:122`; `src/game/catalog.ts:46` |
| `paper-hands` — Paper Hands | curse · common | paper | `src/art.ts:123`; `src/game/catalog.ts:47` |
| `wagmi` — WAGMI | power · rare | star, hammy | `src/art.ts:124`; `src/game/catalog.ts:48` |
| `ngmi` — NGMI | curse · common | hammy | `src/art.ts:125`; `src/game/catalog.ts:49` |
| `rug-pull` — Rug Pull | attack · uncommon | shield, hammy, speed | `src/art.ts:126`; `src/game/catalog.ts:50` |
| `gas-war` — Gas War | attack · rare | star, bolt, flame | `src/art.ts:127`; `src/game/catalog.ts:51` |
| `ser` — ser | skill · common | shield, hammy | `src/art.ts:128`; `src/game/catalog.ts:52` |
| `lfg` — LFG | skill · uncommon | star, flame | `src/art.ts:129`; `src/game/catalog.ts:53` |
| `wen-mint` — Wen Mint? | skill · uncommon | seed, sleepMark, clock | `src/art.ts:130`; `src/game/catalog.ts:54` |
| `ape-in` — Ape In | attack · rare | star, bolt | `src/art.ts:131`; `src/game/catalog.ts:55` |
| `exit-liquidity` — Exit Liquidity | skill · uncommon | star, hammy | `src/art.ts:132`; `src/game/catalog.ts:56` |
| `touch-grass` — Touch Grass | skill · rare | star, hammy, heart, sprout | `src/art.ts:133`; `src/game/catalog.ts:57` |
| `gsqueek` — gsqueek | skill · common | star, moon, hammy, heart | `src/art.ts:134`; `src/game/catalog.ts:58` |
| `hammy-gang` — Hammy Gang | power · uncommon | star, hammy | `src/art.ts:135`; `src/game/catalog.ts:59` |
| `gud-tek` — Gud Tek | skill · uncommon | star, cardBack, gear | `src/art.ts:136`; `src/game/catalog.ts:60` |
| `moar` — Moar | attack · uncommon | star, cardBack | `src/art.ts:137`; `src/game/catalog.ts:61` |
| `sleep-cam` — Sleep Cam | skill · common | sleepMark, hammy | `src/art.ts:138`; `src/game/catalog.ts:62` |
| `spacetime-fold` — Spacetime Fold | power · rare | star, cardBack | `src/art.ts:139`; `src/game/catalog.ts:63` |
| `nyn-sob` — NYN Sob | curse · common | hammy, heart | `src/art.ts:140`; `src/game/catalog.ts:64` |
| `firmware-upgrade` — WHEELY9000 Firmware Upgrade | skill · uncommon | star, gear | `src/art.ts:141`; `src/game/catalog.ts:65` |

### Player and enemy visuals

All actors are 96 × 96 inline SVG with a shared two-strip ground shadow (`src/art.ts:194`). They are still compositions; motion comes from CSS transforms/filters on the SVG or its wrapper. None has separate animation-frame artwork. Fur/scarf recolors and shared hamster, ghost, and oracle components create variants.

| Actor | Composition / distinction | Artwork / definition |
| --- | --- | --- |
| zoomie-gremlin — playable hero | Large oat hamster with mint scarf, head tuft, speed lines and star. Also reused for brand mark and character selection. | `src/art.ts:166` |
| dust-mite — Dust Mite | Lilac stepped dust body, short whisker-like flecks, eyes and cream mouth. | `src/art.ts:168`; `src/game/catalog.ts:91` |
| queue-snake — Settlement Queue Snake | Mint stepped snake with gold queue spots, tongue and paperwork. | `src/art.ts:170`; `src/game/catalog.ts:92` |
| seed-thief — Seed Thief | Tan hamster, lilac scarf, black eye mask, seed sack and seeds. | `src/art.ts:174`; `src/game/catalog.ts:93` |
| fud-moth — FUD Moth | Lilac symmetrical wings, rose wing marks, oat body and gold antennae. | `src/art.ts:176`; `src/game/catalog.ts:94` |
| sybil-swarm — Sybil Swarm | Five small hamster faces/bodies inside one sprite. Engine also spawns five separately targetable copies, each showing this composition (25 visible hamsters for 5 targets). | `src/art.ts:179`; `src/game/catalog.ts:95` |
| oracle-acolyte — Oracle Acolyte | Lilac hooded oracle, oat face, paper scroll and star. | `src/art.ts:180`; `src/game/catalog.ts:96` |
| liquidity-leech — Liquidity Leech | Blue stepped leech with mouth detail and stolen gold seed. | `src/art.ts:181`; `src/game/catalog.ts:97` |
| stale-sprite — Stale Data Sprite | Mint ghost with eyes, plum mouth and small clock near lower edge. | `src/art.ts:184`; `src/game/catalog.ts:98` |
| oracle-judge — Oracle Judge | Oracle variant with plum hood, gold gavel and crown band. | `src/art.ts:185`; `src/game/catalog.ts:99` |
| difficulty-adjuster — Difficulty Adjuster | Large gold gear-headed robot, blue face panel and side arms. | `src/art.ts:186`; `src/game/catalog.ts:100` |
| stale-ghost — Stale Data Ghost | Pale ghost variant, larger clock and lilac floating fragments. | `src/art.ts:188`; `src/game/catalog.ts:101` |
| squeektoshi — Sleepless Squeektoshi | Pale hamster with lilac scarf, gold crown, full gold wheel and flanking bolts. | `src/art.ts:189`; `src/game/catalog.ts:102` |

Locked Seed Hoarder and Professional Napper character tiles reuse the Zoomie Gremlin sprite under CSS silhouettes; they have no separate art or playable catalog entries (`src/main.ts:144`). The title-wheel hamster (`src/guide.ts:30`) and tutorial hamster (`src/guide.ts:75`) are separately drawn styles/poses, not the exact gameplay sprite. The Sybil display relationship is explicit in `src/game/engine.ts:184–187` and `src/main.ts:251`.

### Relic, map, and UI icons

Relics use a second visual language: thin rounded continuous lines rather than the crisp filled pixel silhouettes used by cards/actors/map rooms. All share viewBox 0 0 24 24, fill none, currentColor, stroke-width 1.6, and round joins (`src/main.ts:101`). They appear in the topbar, tooltip, relic detail modal, codex, and shop. There are no dedicated large relic illustrations. The character-select starter relic currently displays the rest-room moon rather than the Midnight Wheel relic SVG (`src/main.ts:144`).

| Relic ID / name | Rarity | Pictogram | Icon / definition |
| --- | --- | --- | --- |
| midnight-wheel — Midnight Wheel | common | Wheel circle with spokes | `src/main.ts:85`; `src/game/catalog.ts:73` |
| wheely9000 — WHEELY9000 Gear | uncommon | Gear | `src/main.ts:86`; `src/game/catalog.ts:74` |
| genesis — Genesis Seed | rare | Leaf / seed | `src/main.ts:87`; `src/game/catalog.ts:75` |
| live-camera — Live Camera | common | Video camera | `src/main.ts:88`; `src/game/catalog.ts:76` |
| aura — Aura Halo | uncommon | Halo and rays | `src/main.ts:89`; `src/game/catalog.ts:77` |
| name-tag — Name Tag | common | Tag | `src/main.ts:90`; `src/game/catalog.ts:78` |
| wheelpaper — Wheelpaper Fragment | common | Torn paper | `src/main.ts:91`; `src/game/catalog.ts:79` |
| pillhead — Pillhead’s Blessing | rare | Capsule | `src/main.ts:92`; `src/game/catalog.ts:80` |
| diamond-hands — Diamond Hands | uncommon | Diamond | `src/main.ts:93`; `src/game/catalog.ts:81` |
| airdrop-farmer — Airdrop Farmer | uncommon | Parachute and parcel | `src/main.ts:94`; `src/game/catalog.ts:82` |
| probably-nothing — Probably Nothing | common | Question mark circle | `src/main.ts:95`; `src/game/catalog.ts:83` |
| stay-squeeky — Stay Squeeky | common | Zigzag hamster-like mark | `src/main.ts:96`; `src/game/catalog.ts:84` |
| sunflower-wheel — Sunflower Seeds on the Wheel | uncommon | Sunflower | `src/main.ts:97`; `src/game/catalog.ts:85` |
| hamsterfi — HamsterFi | uncommon | Bank facade | `src/main.ts:98`; `src/game/catalog.ts:86` |
| early-buildooooor — Early Buildooooor | rare | Hard hat | `src/main.ts:99`; `src/game/catalog.ts:87` |

| Map room icon | Silhouette | Source |
| --- | --- | --- |
| battle | Pixel sword | `src/art.ts:234` |
| elite | Lightning bolt | `src/art.ts:235` |
| boss | Crown | `src/art.ts:236` |
| rest | Crescent moon | `src/art.ts:237` |
| shop | Striped shop facade | `src/art.ts:238` |
| event | Question mark | `src/art.ts:239` |
| treasure | Chest | `src/art.ts:240` |

Map nodes are 24 × 24 crisp SVG; the same symbols also decorate mode selection and the map legend. Paths between map rooms are generated cubic SVG curves in a 600 × 1700 viewBox (`src/main.ts:149–160`). There are 24 room nodes per run, not 24 separate room illustrations. Act labels change text, not map architecture art.

| UI icon | Pictogram | Source |
| --- | --- | --- |
| attack | Sword | `src/main.ts:105` |
| block | Shield | `src/main.ts:106` |
| cast | Four-point spark | `src/main.ts:107` |
| heart | Heart | `src/main.ts:108` |
| coin | Coin with currency mark | `src/main.ts:109` |
| deck | Overlapped cards | `src/main.ts:110` |

The six general UI icons use 24 × 24 SVG, fill none, currentColor, stroke-width 1.7 (`src/main.ts:112`). They appear in resources, enemy intentions, block, deck/piles, and combat overlays. Current intent mappings are attack → sword, block → shield, all buff/FUD/reject actions → the same spark/cast icon (`src/main.ts:245–251`); future intent queues are text badges rather than new icon art.

Native font glyphs also serve as art/UI marks: ✦ (title/star/jackpot/hints), ⚙ (settings), ••• (more), ◇ (locked characters), ⌖ (target), ⓘ (chain help), ↵ (end turn), →/←/↗ (navigation), ♜ (empty leaderboard), ♛ (win), and ☾ (loss/hibernation). These are text glyphs with platform-dependent font rendering, not standalone icon assets (`src/main.ts:117,131,144,158,195,240,251,254,315`).

### Scene backgrounds and diagrams

| Asset / screen | Visual elements | Source / status |
| --- | --- | --- |
| Shared cage vignette background | 480 × 192, plum wall, 9 vertical cage bars, 2 crossbars, tan/brown bedding, 12 bedding flecks and 3 stars. | `src/art.ts:198` |
| camp vignette | Moon, hut, large mint wheel, hamster, seed dish and star. | `src/art.ts:209` — defined but unused by main.ts |
| shop vignette | Pink striped awning, counter, shopkeeper hamster, cards, seeds, gear and stars. | `src/art.ts:211`; mounted `src/main.ts:276` |
| rest vignette | Moon, hut, lilac bed and pale blanket, sleeping hamster, Z marks and sprout. | `src/art.ts:215`; mounted `src/main.ts:287` |
| results vignette | Lilac wheel, crowned hamster on bench, gold trophy and stars; same illustration on win and loss. | `src/art.ts:218`; mounted `src/main.ts:315` |
| event vignette | Hut, giant paper, bench, hamster, question bubble and seed. | `src/art.ts:222`; mounted `src/main.ts:293` |
| Title wheel / arena wheel | 600 × 600 separate wheel rotor and hamster groups; arena hides wheel hamster with CSS. | `src/guide.ts:18`; title `src/main.ts:131`; arena `src/main.ts:241`; hide `src/style.css:524` |
| Guide 1 — Play | Three seeds lead to an angled attack card with seed cost and sword. | `src/guide.ts:77` |
| Guide 2 — Defend | Enemy sword / 8 intent points to hamster behind blue 8-block shield. | `src/guide.ts:78` |
| Guide 3 — Reset | End Turn button, curved arrow, refreshed cards and three seed icons. | `src/guide.ts:79` |
| Guide 4 — Explore | Branching route with fight, chest, arrow nodes and hamster position. | `src/guide.ts:80` |
| Guide 5 — Real hamster | Wheel/telemetry diagram points to route, combat, reward and shop symbols. | `src/guide.ts:81` |

| Screen/state | Background art actually used | Source |
| --- | --- | --- |
| Title | CSS teal radial/linear atmosphere, cage bars/mask, bedding stripes, star dot texture; animated title wheel; no camp vignette. | `src/style.css:52`–56; `src/main.ts:131` |
| Mode selection / characters | Shared body gradient plus faint green radial CSS field. Room icons and Zoomie sprite decorate tiles. | `src/style.css:94`; `src/main.ts:135`–144 |
| Route map / hibernation | CSS green-teal radial field and tiny dot grid; SVG connecting routes and room symbols; dream mist via fog treatment. | `src/style.css:243`–258; `src/main.ts:147`–163 |
| Combat / elite / boss | One CSS cage-bar/bedding stage, faded wheel and 12 falling seed elements. All three acts use the same Bedding Burrows caption and setting. Jackpot/golden room adds gold styling. | `src/main.ts:229`–255; `src/style.css:187`–192 |
| Reward / treasure | Shared panel and illustrated reward cards; relic discovery is a text hint. No bespoke reward/chest vignette. | `src/main.ts:260`–262 |
| Shop | Shared panel plus shop sceneArt vignette. | `src/main.ts:274`–282 |
| Rest | Shared panel plus rest sceneArt vignette and card before/after preview. | `src/main.ts:285`–287 |
| Event | Shared panel plus event sceneArt vignette. | `src/main.ts:290`–293 |
| Game over / victory | Shared results vignette and large native moon/crown glyph; same crowned hero/trophy painting for either outcome. | `src/main.ts:312`–315 |
| Relic / collection / deck / preview / settings / help / more | Shared modal shell/backdrop over current screen. Content reuses icons, actors and card art; help adds five diagrams. | `src/main.ts:319`–390 |
| Leaderboard | Panel inside More modal; text rows, wallet strip and chess-rook empty glyph. No unique background illustration. | `src/main.ts:194`–196 |
| 390 px mobile | Responsive layout and scale/spacing changes; no separate mobile art files. | `src/style.css:430` onward plus src/hand-readability.css, src/intent-queue.css, src/shop-balance.css |

### Shared motifs and source-generated geometry

| Motif helper | Visual | Source |
| --- | --- | --- |
| star | Stepped plus-shaped glint | `src/art.ts:14` |
| seed | Small outlined sunflower seed | `src/art.ts:16` |
| moon | Stepped crescent | `src/art.ts:30` |
| bolt | Stepped lightning bolt | `src/art.ts:32` |
| shield | Filled pixel shield | `src/art.ts:34` |
| paper | Paper with rule lines | `src/art.ts:36` |
| sleepMark | Pixel Z | `src/art.ts:38` |
| wheel | Mint/gold recolorable wheel with stand | `src/art.ts:40` |
| hammy | 32-grid hamster with open/closed eyes, fur and scarf variants | `src/art.ts:51` |
| speed | Three horizontal speed streaks | `src/art.ts:62` |
| heart | Stepped rose heart | `src/art.ts:64` |
| sprout | Two leaves and seed root | `src/art.ts:66` |
| clock | Pixel clock face | `src/art.ts:68` |
| cardBack | Card back with star | `src/art.ts:71` |
| gear | Pixel cog | `src/art.ts:73` |
| flame | Amber/gold flame | `src/art.ts:75` |
| bench | Wooden bench / countertop | `src/art.ts:77` |
| eyes | Two highlighted square eyes | `src/art.ts:151` |
| ghost | Clock-carrying ghost | `src/art.ts:153` |
| oracle | Hooded oracle acolyte / judge | `src/art.ts:157` |
| cageBackground | Common vignette cage and bedding | `src/art.ts:198` |
| hut | Stepped hut | `src/art.ts:204` |

Four lower-level SVG helpers (`src/art.ts:7–13`) emit rectangles, filled paths, transformed groups, and the SVG wrapper. Pixel art is requested with shape-rendering="crispEdges". Scene pieces use fractional scales (for example 0.9, 1.1, 1.7), and CSS scales their viewBoxes to various widths; this means the visual pixel grid is not a single integer display grid. Reuse is deliberate: hamster, wheel, seed, shield, moon and star appear across cards, actors, menus and scenes. Decorative CSS textures and combat VFX are inventoried separately from these authored composition IDs.

### Offline marketing art and file-backed media census

The only authored file-backed art is the separate cover project. `docs/cover/scene.html` is a Canvas 2D source composition with original running-hamster pose, copper wheel, distant cage spire, bedding, stars and five fanned cards. Wide and square arrangements are independently positioned. Its 16-color palette and system-font treatment are separate from runtime art. `scripts/render-cover.mjs` exports them with Edge; it was read, not run, because that would write outside the authorized audit directory.

| File | Dimensions | Usage / provenance |
| --- | --- | --- |
| `docs/cover/cover-1200x630.png` | 1200 × 630 | Original Canvas export; promotional document asset; not imported by runtime |
| `docs/cover/cover-512.png` | 512 × 512 | Original Canvas export; promotional document asset; not imported by runtime |

The remaining 149 images are captured evidence, not authored art assets: 139 historical images under `shots/` (including deployment/admin screens) and 10 temporary QA captures under `.tmp/`. They are enumerated below so screenshots cannot be mistaken for source textures. None is loaded by the game. This count excludes newly captured `docs/art_audit/shots/*` and browser-profile extension icons.

#### .tmp (10)

```text
.tmp/score-qa/desktop-combat.png
.tmp/score-qa/desktop-result.png
.tmp/score-qa/mobile-combat.png
.tmp/score-qa/mobile-result.png
.tmp/shop-fixed-mobile-bottom.png
.tmp/shop-fixed-mobile-scrolled.png
.tmp/shop-fixed-mobile.png
.tmp/shop-fixed-scrolled.png
.tmp/shop-fixed-zh.png
.tmp/shop-fixed.png
```

#### shots (5)

```text
shots/battle.png
shots/battle_play.png
shots/camp.png
shots/gallery.png
shots/map.png
```

#### shots/deploy (21)

```text
shots/deploy/api-leaderboard-200.jpg
shots/deploy/api-runtime-error.jpg
shots/deploy/domain-api-leaderboard-200.jpg
shots/deploy/dynadot-dns-persisted.jpg
shots/deploy/dynadot-dns-records.jpg
shots/deploy/dynadot-dns-saved.jpg
shots/deploy/github-auth-stop.jpg
shots/deploy/github-repo.jpg
shots/deploy/github-vercel-permissions.jpg
shots/deploy/squeekspire-com-live.jpg
shots/deploy/upstash-connected.jpg
shots/deploy/upstash-free-plan.jpg
shots/deploy/vercel-dns-records.jpg
shots/deploy/vercel-domains-valid.jpg
shots/deploy/vercel-final-deployment.jpg
shots/deploy/vercel-first-deployment.jpg
shots/deploy/vercel-game.jpg
shots/deploy/vercel-login-stop.jpg
shots/deploy/vercel-reauth-stop.jpg
shots/deploy/vercel-redis-redeployment.jpg
shots/deploy/www-redirect-verified.jpg
```

#### shots/fixes (12)

```text
shots/fixes/choice_dialog.png
shots/fixes/exit_liquidity_fud.png
shots/fixes/gud_tek_choice.png
shots/fixes/merge_preview.png
shots/fixes/mobile_card_preview.png
shots/fixes/opening_battle.png
shots/fixes/relic_tooltip_mobile.png
shots/fixes/results_breakdown.png
shots/fixes/results_breakdown_detail.png
shots/fixes/results_breakdown_mobile.png
shots/fixes/touch_grass_disabled.png
shots/fixes/upgrade_preview.png
```

#### shots/intent-queue (5)

```text
shots/intent-queue/desktop.png
shots/intent-queue/menu-1280.png
shots/intent-queue/menu-1440.png
shots/intent-queue/menu-390.png
shots/intent-queue/mobile.png
```

#### shots/online (2)

```text
shots/online/leaderboard-offline.png
shots/online/leaderboard.png
```

#### shots/playtest (43)

```text
shots/playtest/battle_seeds_zh.png
shots/playtest/best1_battle_seeds_en.png
shots/playtest/best2_battle_seeds_mobile_zh.png
shots/playtest/best3_route_choices.png
shots/playtest/best4_event_choice.png
shots/playtest/best5_run2_victory.png
shots/playtest/card_codex.png
shots/playtest/character_select.png
shots/playtest/draw_pile.png
shots/playtest/how_to_intro_en.png
shots/playtest/how_to_settled_data_en.png
shots/playtest/how_to_settled_data_zh.png
shots/playtest/main_menu.png
shots/playtest/mode_select.png
shots/playtest/playtest_failure.png
shots/playtest/run1_combat.png
shots/playtest/run1_rest.png
shots/playtest/run1_result.png
shots/playtest/run1_reward.png
shots/playtest/run1_shop.png
shots/playtest/run1_shop_purchase_1.png
shots/playtest/run1_shop_purchase_2.png
shots/playtest/run1_shop_purchase_3.png
shots/playtest/run1_shop_purchase_4.png
shots/playtest/run1_shop_purchase_5.png
shots/playtest/run1_shop_purchase_6.png
shots/playtest/run1_touch_grass_unavailable.png
shots/playtest/run2_combat.png
shots/playtest/run2_map.png
shots/playtest/run2_rest.png
shots/playtest/run2_reward.png
shots/playtest/run2_shop.png
shots/playtest/run2_shop_purchase_1.png
shots/playtest/run2_shop_purchase_3.png
shots/playtest/run2_shop_purchase_4.png
shots/playtest/run3_character_select_controlled_date.png
shots/playtest/run3_combat.png
shots/playtest/run3_map.png
shots/playtest/run3_rest.png
shots/playtest/run3_result.png
shots/playtest/run3_reward.png
shots/playtest/run3_shop.png
shots/playtest/run3_shop_purchase_4.png
```

#### shots/qa2 (13)

```text
shots/qa2/after_desktop.png
shots/qa2/after_mobile.png
shots/qa2/before_desktop.png
shots/qa2/before_mobile.png
shots/qa2/map_after_1440.png
shots/qa2/map_after_390.png
shots/qa2/rest_after_1440.png
shots/qa2/rest_after_390.png
shots/qa2/shop_after.png
shots/qa2/shop_after_1440.png
shots/qa2/shop_after_390.png
shots/qa2/shop_after_prices_mobile.png
shots/qa2/shop_before.png
```

#### shots/tips (9)

```text
shots/tips/tips-desktop-details-bottom.png
shots/tips/tips-desktop-details.png
shots/tips/tips-desktop-first.png
shots/tips/tips-desktop-last.png
shots/tips/tips-mobile-details-bottom.png
shots/tips/tips-mobile-details-middle.png
shots/tips/tips-mobile-details.png
shots/tips/tips-mobile-first.png
shots/tips/tips-mobile-last.png
```

#### shots/v2 (12)

```text
shots/v2/battle-attack.png
shots/v2/battle-mobile.png
shots/v2/battle-victory.png
shots/v2/battle.png
shots/v2/character-select.png
shots/v2/how-to-zh.png
shots/v2/how-to.png
shots/v2/main-menu-mobile.png
shots/v2/main-menu.png
shots/v2/map-mobile.png
shots/v2/map.png
shots/v2/settings.png
```

#### shots/wallet (17)

```text
shots/wallet/menu-desktop.png
shots/wallet/menu-mobile.png
shots/wallet/tips-desktop-2.png
shots/wallet/tips-desktop-3.png
shots/wallet/tips-desktop-4.png
shots/wallet/tips-desktop-details-bottom.png
shots/wallet/tips-desktop-details.png
shots/wallet/tips-desktop-first.png
shots/wallet/tips-desktop-last.png
shots/wallet/tips-mobile-2.png
shots/wallet/tips-mobile-3.png
shots/wallet/tips-mobile-4.png
shots/wallet/tips-mobile-details-bottom.png
shots/wallet/tips-mobile-details-middle.png
shots/wallet/tips-mobile-details.png
shots/wallet/tips-mobile-first.png
shots/wallet/tips-mobile-last.png
```

### Coverage checks

`asset_counts.json` contains every keyed card, actor, relic, room and UI icon with source line numbers, plus the file-backed media census. `extract_assets.mjs` regenerates these read-only counts using portable Node and writes only beneath `docs/art_audit/`. Checks: 60 catalog cards / 60 art keys / 0 missing; 12 catalog enemies / 12 enemy art keys + 1 player / 0 missing; 15 relic definitions / 15 icon keys / 0 missing. Existing `src/art.test.ts` already asserts unique card art, unique actor sprites and self-contained SVG; tests were read, not altered.

---

## Color, typography, motion, and feedback inventory

Source audit on 2026-11-04. Only files under `docs/art_audit/` were created by this audit. Counts cover source declarations, including later overrides, rather than a rendered-style census. The effective CSS load order is `style.css` → `hand-readability.css` → `shop-balance.css` → `intent-queue.css` (`src/main.ts:1–4`). No animation library, canvas particle engine, sprite animation sheet, external font request, or `@font-face` exists in the visual source inspected.

The exhaustive extraction is [presentation-data.json](presentation-data.json), including every literal color with selector/property/line, every font declaration, custom property, animation, transition, and each keyframe's exact frame declarations. [color-palette.md](color-palette.md) lists **all 588 normalized source hex values**, their occurrence counts, and file/line locations. The read-only extraction is reproducible with `node docs/art_audit/extract-motion.mjs`.

### Counts

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

### Palette roles

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

### Typography

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

### Complete keyframe and animation bindings

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

### Complete CSS transition inventory

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

### Feedback, particle, and screen-motion behavior

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

### Timing and accessibility

Preferences expose slow/normal/fast and “Pause ambient motion, flashes, and action effects” (`main.ts:348`). `applyPreferences()` puts the effect/speed state on `<html>` and sets `--motion-factor` to 1.5/1/.6 (`main.ts:397–403`). `motionDuration()` uses the same factor, returns 0 for Reduce Effects or system `prefers-reduced-motion`, and is presentation-only (`preferences.ts:59–74`). Changing to reduced effects clears transient presentation (`main.ts:666–674`).

Both manual and OS reduced-motion rules disable all animations with `!important`, shorten transitions to .01 ms, force scroll behavior auto, hide falling seeds and power aura, and remove the burst background (`style.css:544–545,610–612`). The OS rule also positions hypothetical static card-play/score elements, but JS normally avoids creating them because duration is 0. No separate screen-shake setting exists, although the global reduced-effects option handles it.

Action lifetime is normally **1050 ms**, while the played-card lifetime is 650 ms (`main.ts:467,481,485–491`). Big-combo CSS lasts **1200 ms**, so cleanup removes it 150 ms before its final keyframe; this mismatch scales with speed. Fifth-enemy damage floats can last `.36 + .85 = 1.21 s` and outlive the 1.05 s cleanup. Death has an additional fixed 150 ms delay. These are source-derived timing mismatches, not measured frame captures.

### Art-direction findings for the critique

1. **Impact sequencing is the biggest motion issue.** Player lunge reaches contact around225 ms while target flash/number begins immediately. All HP values already show final state. Aggregate turn damage makes multi-hit intent unreadable in motion. Queue one short presentation event per hit, align flash/number/HP update to contact, and retain stable actor/HP nodes so the authored .3 s bar transition can run. Enemy hit reaction needs its own directional recoil.
2. **Score spectacle lacks a causal sequence.** The score +pop and full-screen threshold celebration exist, but multiplier/chain/relic contributions jump at once. A restrained Balatro-inspired sequence should highlight each contributing source, then the total, with bounded short pauses and progressively brighter/accented feedback; reduced-effects mode should still summarize contributions clearly.
3. **Presentation lifetime is not tied to animation completion.** The1050 ms reset clips the1200 ms burst and late staggered float effects. Tie cleanup to the longest scheduled event or animation completion, and normalize all fixed delays to speed.
4. **The whole DOM is replaced on normal updates.** Browser diagnostics confirm health-fill and ambient-wheel nodes are replaced on action (capture-report.json → domReplacementDiagnostics). This loses the old element width needed for the authored HP transition and recreates ambient animation nodes; preserving actor/UI identity is the prerequisite for reliable animation polish.
5. **The quiet, warm nocturnal identity works, but hierarchy is muted.** Source has510 CSS hex values and overlapping older/later palettes. Consolidate semantic accents and brighten only interactable/action-critical elements. The six system font choices and tiny console labels weaken consistency; preserve the enlarged14 px mobile hand rules while simplifying metadata elsewhere.
6. **Transitions between game beats are absent.** Reward reveal, shop purchase, rest heal/upgrade, relic acquisition, node arrival, player death, and run clear have no distinct bespoke motion. Add short scene-specific gestures and directional object travel after impact clarity is fixed.
7. **Reduced-motion support is already substantive.** Preserve it while adding effects. It should remove shake/flash/travel without removing important state/cause feedback.

No source changes, implementation, commits, pushes, or new external art assets are part of this audit.

---

## Exhaustive source color palette

Generated from the four imported CSS files plus art SVGs, guide SVGs, UI markup, and index fallback. Counts are literal occurrences, not rendered pixels. Shorthand hex is expanded and lowercased; alpha remains as an eighth byte. Variants with different alpha are distinct. CSS declarations overridden later are included because this is a source inventory. SVG uses of the shared `C` palette are indirect and do not add repeated literal counts. See [presentation-data.json](presentation-data.json) for each occurrence, selector, property, line, and context.

| Normalized hex | All occurrences | CSS occurrences | Source locations |
|---|---:|---:|---|
| `#000000` | 1 | 1 | src/style.css:53 |
| `#00000022` | 1 | 1 | src/style.css:137 |
| `#00000033` | 3 | 3 | src/style.css:40, src/style.css:166, src/style.css:271 |
| `#00000044` | 1 | 1 | src/style.css:41 |
| `#00000055` | 2 | 2 | src/style.css:61, src/style.css:391 |
| `#00000066` | 1 | 1 | src/style.css:372 |
| `#00000088` | 4 | 4 | src/style.css:150, src/style.css:231, src/style.css:232, src/style.css:341 |
| `#00000099` | 1 | 1 | src/style.css:182 |
| `#020b1033` | 1 | 1 | src/style.css:56 |
| `#020b1444` | 1 | 1 | src/style.css:116 |
| `#020c1244` | 1 | 1 | src/style.css:53 |
| `#040e16d9` | 1 | 1 | src/style.css:340 |
| `#050e13d9` | 1 | 1 | src/style.css:53 |
| `#05101966` | 2 | 2 | src/style.css:66, src/style.css:71 |
| `#05141c77` | 1 | 1 | src/intent-queue.css:10 |
| `#06141b44` | 1 | 1 | src/style.css:205 |
| `#06192366` | 1 | 1 | src/style.css:394 |
| `#07121855` | 2 | 2 | src/style.css:100, src/style.css:102 |
| `#071219` | 2 | 2 | src/style.css:260, src/style.css:270 |
| `#07121977` | 1 | 1 | src/style.css:271 |
| `#07141d` | 1 | 1 | src/style.css:61 |
| `#07171b` | 1 | 1 | src/style.css:224 |
| `#07171e33` | 1 | 1 | src/style.css:159 |
| `#07172266` | 1 | 1 | src/style.css:188 |
| `#07182055` | 1 | 1 | src/style.css:118 |
| `#071a2244` | 4 | 4 | src/style.css:197, src/style.css:208, src/style.css:461, src/style.css:462 |
| `#071a2444` | 1 | 1 | src/style.css:188 |
| `#08141b` | 1 | 1 | src/style.css:211 |
| `#08171fd9` | 1 | 1 | src/style.css:222 |
| `#081920d9` | 1 | 1 | src/style.css:169 |
| `#081a2288` | 1 | 1 | src/style.css:222 |
| `#081b23` | 4 | 4 | src/style.css:249, src/style.css:251, src/style.css:253 |
| `#09191f33` | 1 | 1 | src/style.css:100 |
| `#091e29` | 5 | 5 | src/style.css:453, src/style.css:521 |
| `#0a171c55` | 1 | 1 | src/style.css:66 |
| `#0a1b22` | 1 | 1 | src/style.css:239 |
| `#0b171d` | 2 | 2 | src/style.css:3, src/style.css:5 |
| `#0b171d66` | 1 | 1 | src/style.css:279 |
| `#0b1720` | 1 | 1 | src/style.css:275 |
| `#0b1c2466` | 1 | 1 | src/style.css:189 |
| `#0b2029` | 1 | 1 | src/style.css:317 |
| `#0b202933` | 1 | 1 | src/style.css:249 |
| `#0c1720` | 2 | 0 | index.html:6, index.html:11 |
| `#0c1b22` | 1 | 1 | src/style.css:43 |
| `#0c1b23` | 1 | 1 | src/style.css:52 |
| `#0c1b2380` | 1 | 1 | src/style.css:81 |
| `#0d1e25f5` | 1 | 1 | src/style.css:137 |
| `#0d2027` | 1 | 1 | src/style.css:52 |
| `#0d222bcc` | 1 | 1 | src/style.css:216 |
| `#100b16bb` | 1 | 1 | src/style.css:372 |
| `#101c2e66` | 1 | 1 | src/style.css:415 |
| `#102027` | 1 | 1 | src/style.css:54 |
| `#10202a` | 2 | 2 | src/style.css:449, src/style.css:450 |
| `#10232a` | 1 | 1 | src/style.css:593 |
| `#10232b` | 2 | 2 | src/style.css:128, src/style.css:166 |
| `#10242c` | 1 | 1 | src/style.css:539 |
| `#10252b` | 1 | 1 | src/style.css:245 |
| `#10252d` | 1 | 1 | src/style.css:391 |
| `#10282e` | 1 | 1 | src/style.css:582 |
| `#11202a` | 1 | 1 | src/style.css:211 |
| `#11232a` | 1 | 1 | src/style.css:10 |
| `#11252b` | 2 | 2 | src/style.css:585, src/style.css:589 |
| `#11252e` | 1 | 1 | src/style.css:191 |
| `#11262c` | 1 | 1 | src/style.css:235 |
| `#11272e` | 1 | 1 | src/style.css:243 |
| `#12212c` | 1 | 1 | src/style.css:185 |
| `#14191a` | 1 | 1 | src/style.css:69 |
| `#14242e` | 1 | 1 | src/style.css:279 |
| `#14262d` | 1 | 1 | src/style.css:5 |
| `#14262df5` | 1 | 1 | src/style.css:137 |
| `#14262e` | 1 | 1 | src/style.css:100 |
| `#14282f` | 3 | 3 | src/style.css:182, src/style.css:380, src/style.css:392 |
| `#14292e` | 1 | 1 | src/style.css:52 |
| `#142a31` | 1 | 1 | src/style.css:368 |
| `#142a32` | 1 | 1 | src/style.css:167 |
| `#15111d66` | 1 | 1 | src/style.css:260 |
| `#151f2d66` | 1 | 1 | src/style.css:431 |
| `#152930` | 2 | 2 | src/style.css:341 |
| `#162d30` | 1 | 1 | src/style.css:566 |
| `#162d32` | 1 | 1 | src/shop-balance.css:9 |
| `#162e36` | 1 | 1 | src/style.css:243 |
| `#171b27` | 7 | 4 | src/style.css:226, src/style.css:277, src/art.ts:28 |
| `#171e26` | 1 | 0 | src/guide.ts:24 |
| `#17323b` | 1 | 1 | src/style.css:186 |
| `#182631f5` | 1 | 1 | src/intent-queue.css:8 |
| `#182e30aa` | 1 | 1 | src/style.css:114 |
| `#183138` | 1 | 1 | src/style.css:250 |
| `#19313b` | 1 | 1 | src/style.css:186 |
| `#1a3036e6` | 2 | 2 | src/style.css:66 |
| `#1b2533` | 2 | 2 | src/style.css:412 |
| `#1e323b` | 1 | 1 | src/style.css:128 |
| `#20242b` | 1 | 0 | src/guide.ts:34 |
| `#20353c` | 1 | 1 | src/style.css:365 |
| `#20363c` | 1 | 1 | src/style.css:5 |
| `#203b3e` | 1 | 1 | src/style.css:235 |
| `#203b51e6` | 1 | 1 | src/style.css:207 |
| `#203f56` | 1 | 1 | src/intent-queue.css:19 |
| `#212632` | 1 | 0 | src/guide.ts:75 |
| `#21373b` | 1 | 1 | src/style.css:167 |
| `#21373c` | 1 | 1 | src/style.css:36 |
| `#213b3e` | 2 | 2 | src/style.css:249, src/style.css:355 |
| `#222732` | 1 | 0 | src/guide.ts:78 |
| `#231f2c` | 1 | 0 | src/art.ts:22 |
| `#23393e` | 1 | 1 | src/style.css:380 |
| `#233b42` | 1 | 1 | src/style.css:341 |
| `#242333` | 1 | 1 | src/style.css:428 |
| `#242e3d` | 1 | 0 | src/guide.ts:81 |
| `#245c79` | 1 | 1 | src/style.css:450 |
| `#252f41` | 2 | 0 | src/guide.ts:80 |
| `#253337` | 1 | 1 | src/shop-balance.css:31 |
| `#254d72` | 1 | 0 | src/guide.ts:78 |
| `#263e40` | 1 | 1 | src/style.css:312 |
| `#263e43` | 1 | 1 | src/style.css:392 |
| `#271f35` | 1 | 0 | src/art.ts:3 |
| `#273c35` | 1 | 1 | src/style.css:186 |
| `#29271f` | 1 | 1 | src/style.css:40 |
| `#292b32` | 1 | 0 | src/guide.ts:23 |
| `#292d47e6` | 1 | 1 | src/style.css:205 |
| `#293340` | 1 | 1 | src/style.css:412 |
| `#294039cc` | 1 | 1 | src/style.css:66 |
| `#294144` | 1 | 1 | src/style.css:378 |
| `#294145` | 1 | 1 | src/style.css:150 |
| `#294149` | 1 | 1 | src/style.css:100 |
| `#29434a` | 2 | 2 | src/style.css:43, src/style.css:344 |
| `#2b3447` | 1 | 1 | src/style.css:427 |
| `#2b4b50` | 1 | 1 | src/style.css:251 |
| `#2c4845` | 1 | 1 | src/style.css:404 |
| `#2d3444` | 1 | 1 | src/style.css:378 |
| `#2d3448` | 1 | 0 | src/guide.ts:80 |
| `#2d4141` | 1 | 1 | src/style.css:265 |
| `#2e484b` | 1 | 1 | src/style.css:396 |
| `#303044` | 1 | 1 | src/style.css:267 |
| `#30384c` | 1 | 1 | src/style.css:413 |
| `#303a4d` | 1 | 1 | src/style.css:423 |
| `#31534c52` | 1 | 1 | src/style.css:52 |
| `#33505233` | 1 | 1 | src/style.css:12 |
| `#343047` | 1 | 0 | src/guide.ts:81 |
| `#352a46` | 1 | 0 | src/art.ts:3 |
| `#35444e` | 1 | 1 | src/style.css:251 |
| `#35463c` | 1 | 1 | src/style.css:186 |
| `#35545b` | 1 | 1 | src/style.css:44 |
| `#364158` | 1 | 1 | src/intent-queue.css:14 |
| `#38514f` | 1 | 1 | src/style.css:177 |
| `#38515a` | 1 | 1 | src/style.css:5 |
| `#38564726` | 1 | 1 | src/style.css:94 |
| `#3b3c3c` | 1 | 1 | src/style.css:235 |
| `#3c493b` | 1 | 1 | src/style.css:254 |
| `#3d3545` | 1 | 0 | src/guide.ts:81 |
| `#3d565566` | 1 | 1 | src/style.css:239 |
| `#3e2c50e6` | 1 | 1 | src/style.css:207 |
| `#3e565966` | 2 | 2 | src/style.css:169, src/style.css:582 |
| `#3f5459` | 1 | 1 | src/style.css:128 |
| `#3f5a50` | 1 | 1 | src/style.css:356 |
| `#40364f` | 1 | 1 | src/style.css:378 |
| `#41324f` | 1 | 1 | src/style.css:372 |
| `#41404d` | 1 | 0 | src/art.ts:24 |
| `#41604d` | 1 | 1 | src/style.css:253 |
| `#436c53` | 1 | 1 | src/style.css:255 |
| `#443351` | 1 | 1 | src/style.css:266 |
| `#45303d` | 2 | 0 | src/guide.ts:78, src/guide.ts:81 |
| `#454c3b` | 1 | 1 | src/style.css:251 |
| `#462f2c55` | 1 | 1 | src/style.css:45 |
| `#46395a` | 1 | 0 | src/guide.ts:79 |
| `#483b2b66` | 1 | 1 | src/style.css:328 |
| `#4a3538` | 1 | 1 | src/style.css:378 |
| `#4a6061` | 1 | 1 | src/style.css:36 |
| `#4a615d66` | 1 | 1 | src/style.css:167 |
| `#4a6358` | 1 | 1 | src/style.css:396 |
| `#4b2e3b` | 1 | 1 | src/style.css:260 |
| `#4b3e3b` | 1 | 1 | src/style.css:251 |
| `#4b4032` | 1 | 0 | src/guide.ts:81 |
| `#4b6460` | 1 | 1 | src/style.css:177 |
| `#4c303b` | 1 | 1 | src/style.css:264 |
| `#4c425f` | 1 | 0 | src/guide.ts:79 |
| `#4c6667` | 1 | 1 | src/style.css:166 |
| `#4c69652c` | 1 | 1 | src/style.css:186 |
| `#4d615326` | 1 | 1 | src/style.css:243 |
| `#4e6562` | 1 | 1 | src/style.css:159 |
| `#4f3232e6` | 1 | 1 | src/style.css:207 |
| `#4f435a` | 1 | 0 | src/guide.ts:80 |
| `#51405e` | 1 | 0 | src/art.ts:3 |
| `#514553` | 1 | 0 | src/guide.ts:77 |
| `#514b37` | 1 | 1 | src/style.css:251 |
| `#52665c77` | 1 | 1 | src/style.css:222 |
| `#526968` | 1 | 1 | src/style.css:100 |
| `#533837` | 1 | 1 | src/intent-queue.css:18 |
| `#536e54` | 1 | 1 | src/style.css:357 |
| `#537066` | 1 | 1 | src/style.css:394 |
| `#554734` | 1 | 1 | src/style.css:61 |
| `#55716e` | 1 | 1 | src/style.css:174 |
| `#564936` | 1 | 0 | src/guide.ts:80 |
| `#566d60` | 2 | 2 | src/style.css:585, src/style.css:589 |
| `#566d6055` | 1 | 1 | src/style.css:592 |
| `#574a32e6` | 2 | 2 | src/style.css:69 |
| `#57655b66` | 1 | 1 | src/style.css:137 |
| `#579bc311` | 1 | 1 | src/style.css:217 |
| `#583a34` | 1 | 1 | src/style.css:46 |
| `#584e34` | 1 | 1 | src/style.css:252 |
| `#586047aa` | 1 | 1 | src/style.css:71 |
| `#587278` | 1 | 1 | src/style.css:10 |
| `#596076` | 1 | 0 | src/guide.ts:80 |
| `#59765f44` | 1 | 1 | src/style.css:401 |
| `#59767a` | 1 | 1 | src/style.css:43 |
| `#597769` | 1 | 1 | src/style.css:355 |
| `#597b7517` | 1 | 1 | src/style.css:129 |
| `#5a402f` | 1 | 1 | src/style.css:312 |
| `#5a746b` | 1 | 1 | src/style.css:247 |
| `#5b7354` | 1 | 1 | src/style.css:253 |
| `#5b7567` | 1 | 1 | src/style.css:313 |
| `#5c6970` | 1 | 1 | src/style.css:37 |
| `#5e786e` | 1 | 1 | src/style.css:235 |
| `#5e7a6644` | 1 | 1 | src/style.css:400 |
| `#5f786044` | 1 | 1 | src/style.css:175 |
| `#607a6d44` | 1 | 1 | src/style.css:216 |
| `#61776e` | 1 | 1 | src/style.css:365 |
| `#627a68` | 1 | 1 | src/style.css:348 |
| `#637e72` | 1 | 1 | src/style.css:245 |
| `#647c6a44` | 1 | 1 | src/style.css:256 |
| `#65827044` | 1 | 1 | src/style.css:408 |
| `#668d78` | 1 | 0 | src/art.ts:5 |
| `#67715d44` | 1 | 1 | src/style.css:54 |
| `#67807522` | 1 | 1 | src/style.css:54 |
| `#678475` | 1 | 1 | src/style.css:341 |
| `#685046` | 1 | 1 | src/style.css:300 |
| `#68847718` | 1 | 1 | src/style.css:54 |
| `#688c7b` | 1 | 1 | src/style.css:248 |
| `#697176` | 1 | 1 | src/shop-balance.css:31 |
| `#6b817c55` | 1 | 1 | src/style.css:48 |
| `#6b947c` | 1 | 1 | src/style.css:212 |
| `#6c583be6` | 1 | 1 | src/style.css:69 |
| `#6c8471` | 1 | 1 | src/style.css:361 |
| `#6d4e3f` | 1 | 1 | src/style.css:331 |
| `#6d778c` | 2 | 0 | src/guide.ts:80 |
| `#6d846444` | 1 | 1 | src/style.css:147 |
| `#6d887a` | 1 | 1 | src/style.css:249 |
| `#6d8c79` | 1 | 1 | src/style.css:399 |
| `#6e593f` | 1 | 0 | src/guide.ts:20 |
| `#6f5038` | 2 | 2 | src/style.css:453, src/style.css:521 |
| `#6f6149` | 2 | 0 | src/guide.ts:25, src/guide.ts:26 |
| `#6f897c` | 1 | 1 | src/style.css:317 |
| `#70b8db88` | 1 | 1 | src/style.css:218 |
| `#718e8d` | 1 | 1 | src/style.css:236 |
| `#728d8d` | 1 | 1 | src/style.css:78 |
| `#739b9444` | 1 | 1 | src/style.css:130 |
| `#748f91` | 1 | 1 | src/style.css:214 |
| `#758c8e` | 1 | 1 | src/style.css:132 |
| `#75b6d377` | 1 | 1 | src/style.css:207 |
| `#76768e` | 1 | 1 | src/style.css:412 |
| `#77788e` | 2 | 2 | src/style.css:413, src/style.css:423 |
| `#77877b` | 1 | 1 | src/style.css:66 |
| `#77877b66` | 1 | 1 | src/style.css:81 |
| `#778e85` | 1 | 1 | src/style.css:235 |
| `#77918a` | 1 | 1 | src/style.css:133 |
| `#78928a1a` | 1 | 1 | src/style.css:131 |
| `#78948e` | 1 | 1 | src/style.css:239 |
| `#795044` | 1 | 0 | src/art.ts:4 |
| `#7aabb0` | 1 | 1 | src/style.css:251 |
| `#7cbce333` | 1 | 1 | src/style.css:217 |
| `#7f8d6622` | 1 | 1 | src/style.css:191 |
| `#7f9485` | 1 | 1 | src/style.css:341 |
| `#809482` | 1 | 1 | src/style.css:344 |
| `#809c94` | 1 | 1 | src/style.css:110 |
| `#809d99` | 1 | 1 | src/style.css:193 |
| `#81574e` | 1 | 1 | src/style.css:45 |
| `#817a99` | 1 | 1 | src/style.css:412 |
| `#817c95` | 1 | 1 | src/style.css:427 |
| `#81907866` | 1 | 1 | src/style.css:581 |
| `#82643f` | 3 | 3 | src/style.css:40, src/style.css:41, src/style.css:42 |
| `#82967d` | 1 | 1 | src/style.css:150 |
| `#829779` | 1 | 1 | src/style.css:566 |
| `#829d91` | 2 | 2 | src/style.css:184, src/style.css:586 |
| `#829e9e` | 1 | 1 | src/style.css:239 |
| `#83947a` | 1 | 1 | src/style.css:396 |
| `#84926e44` | 1 | 1 | src/style.css:125 |
| `#84947b` | 1 | 1 | src/style.css:539 |
| `#849688` | 1 | 1 | src/style.css:392 |
| `#849ab6` | 1 | 0 | src/guide.ts:78 |
| `#849d90` | 1 | 1 | src/style.css:352 |
| `#8595b1` | 1 | 0 | src/guide.ts:79 |
| `#86a08d` | 1 | 1 | src/style.css:400 |
| `#88a293` | 1 | 1 | src/style.css:403 |
| `#88a58c` | 1 | 1 | src/style.css:402 |
| `#8a7143` | 1 | 1 | src/style.css:328 |
| `#8aaba208` | 1 | 1 | src/style.css:53 |
| `#8b7853` | 1 | 1 | src/style.css:162 |
| `#8b9e9e` | 1 | 1 | src/style.css:131 |
| `#8b9eaf` | 1 | 1 | src/style.css:251 |
| `#8bc4e4` | 1 | 1 | src/style.css:218 |
| `#8bcbef` | 1 | 1 | src/style.css:463 |
| `#8c7a5355` | 1 | 1 | src/style.css:168 |
| `#8ca38c22` | 1 | 1 | src/style.css:189 |
| `#8ca69c` | 1 | 1 | src/style.css:145 |
| `#8ca8a514` | 1 | 1 | src/style.css:103 |
| `#8d807b` | 1 | 1 | src/style.css:235 |
| `#8dbac8` | 1 | 0 | src/art.ts:5 |
| `#8e6759` | 1 | 1 | src/style.css:211 |
| `#8e7fa8` | 2 | 0 | src/guide.ts:79, src/guide.ts:80 |
| `#8e8055` | 1 | 1 | src/style.css:312 |
| `#8e85a144` | 2 | 2 | src/style.css:431, src/style.css:433 |
| `#8ecdf5` | 1 | 0 | src/guide.ts:78 |
| `#8f493c` | 1 | 1 | src/style.css:449 |
| `#8f8ba5` | 2 | 0 | src/guide.ts:81 |
| `#8fa8a6` | 1 | 1 | src/style.css:172 |
| `#8fa8a8` | 1 | 1 | src/style.css:74 |
| `#8fae98` | 1 | 1 | src/style.css:399 |
| `#8fc1df` | 1 | 1 | src/style.css:213 |
| `#91a89e` | 1 | 1 | src/style.css:104 |
| `#91aaab` | 1 | 1 | src/style.css:238 |
| `#91ab9c` | 1 | 1 | src/style.css:409 |
| `#91aca5` | 1 | 1 | src/style.css:196 |
| `#92aaa1` | 1 | 1 | src/style.css:124 |
| `#93cdf522` | 1 | 1 | src/style.css:217 |
| `#95859f` | 1 | 1 | src/style.css:260 |
| `#96b3a6` | 1 | 1 | src/style.css:250 |
| `#97b09b` | 1 | 1 | src/style.css:248 |
| `#97c5b6` | 1 | 1 | src/style.css:379 |
| `#9a89b044` | 1 | 1 | src/style.css:415 |
| `#9a8b5c` | 1 | 1 | src/style.css:182 |
| `#9a8b5c77` | 1 | 1 | src/style.css:381 |
| `#9a8ba5` | 1 | 1 | src/style.css:268 |
| `#9a8c64` | 1 | 1 | src/style.css:254 |
| `#9aaba5` | 1 | 1 | src/style.css:379 |
| `#9ab2ac` | 1 | 1 | src/style.css:395 |
| `#9b784b` | 1 | 0 | src/guide.ts:23 |
| `#9b8165` | 1 | 0 | src/art.ts:27 |
| `#9bafb2` | 1 | 1 | src/style.css:6 |
| `#9bb48f` | 1 | 1 | src/style.css:402 |
| `#9bc6a2` | 1 | 1 | src/style.css:212 |
| `#9c875444` | 1 | 1 | src/style.css:240 |
| `#9c8b5b33` | 1 | 1 | src/style.css:118 |
| `#9caa92` | 1 | 1 | src/style.css:240 |
| `#9cb5a7` | 1 | 1 | src/style.css:593 |
| `#9cbea20b` | 1 | 1 | src/style.css:235 |
| `#9cd6bb` | 1 | 1 | src/style.css:6 |
| `#9cd6bb0b` | 1 | 1 | src/style.css:154 |
| `#9d80511b` | 1 | 1 | src/style.css:54 |
| `#9debc5` | 1 | 1 | src/style.css:461 |
| `#9ed6edaa` | 1 | 1 | src/style.css:217 |
| `#9fb4a5` | 1 | 1 | src/style.css:215 |
| `#9fb6a4` | 1 | 1 | src/style.css:343 |
| `#a19eb6` | 1 | 1 | src/style.css:430 |
| `#a1b9b6` | 2 | 2 | src/style.css:76, src/style.css:79 |
| `#a2b6a1` | 1 | 1 | src/style.css:363 |
| `#a2baa9` | 1 | 1 | src/style.css:256 |
| `#a38d5b33` | 2 | 2 | src/style.css:495, src/style.css:508 |
| `#a3b4a9` | 3 | 3 | src/style.css:73, src/style.css:84, src/style.css:90 |
| `#a3c9af` | 1 | 1 | src/style.css:86 |
| `#a494bd` | 1 | 0 | src/art.ts:3 |
| `#a4bda8` | 2 | 2 | src/style.css:350, src/style.css:354 |
| `#a5875a` | 1 | 0 | src/guide.ts:81 |
| `#a58ebf` | 1 | 0 | src/guide.ts:78 |
| `#a68a5a` | 1 | 0 | src/guide.ts:77 |
| `#a68b4412` | 1 | 1 | src/style.css:240 |
| `#a6d3af` | 1 | 0 | src/art.ts:5 |
| `#a6d6c1` | 1 | 1 | src/style.css:269 |
| `#a85158` | 1 | 0 | src/guide.ts:35 |
| `#a8ac8a` | 1 | 1 | src/style.css:67 |
| `#a8bfc318` | 1 | 1 | src/style.css:257 |
| `#a8bfc320` | 1 | 1 | src/style.css:257 |
| `#a8c2b3` | 3 | 3 | src/style.css:582, src/style.css:585, src/style.css:589 |
| `#a8c5ac0a` | 1 | 1 | src/style.css:246 |
| `#a8d4ed` | 1 | 1 | src/style.css:207 |
| `#a99678` | 1 | 0 | src/art.ts:26 |
| `#a9bfb9` | 1 | 1 | src/style.css:121 |
| `#a9d9ca0a` | 1 | 1 | src/style.css:48 |
| `#aa9f6b` | 1 | 1 | src/style.css:193 |
| `#aaa0be33` | 1 | 1 | src/style.css:422 |
| `#aaa7bb` | 1 | 1 | src/style.css:426 |
| `#aadeff` | 1 | 1 | src/style.css:450 |
| `#ab9b74` | 1 | 1 | src/style.css:251 |
| `#acbdae` | 1 | 1 | src/style.css:168 |
| `#acbfbb` | 1 | 1 | src/style.css:107 |
| `#acc0a00d` | 1 | 1 | src/style.css:191 |
| `#acd8c5` | 1 | 1 | src/style.css:378 |
| `#ad8070` | 1 | 1 | src/style.css:251 |
| `#ad8b4c4d` | 1 | 1 | src/style.css:270 |
| `#ad95534d` | 1 | 1 | src/style.css:244 |
| `#ae914710` | 1 | 1 | src/style.css:244 |
| `#aeb8ba` | 1 | 1 | src/shop-balance.css:31 |
| `#af7c49` | 1 | 1 | src/style.css:61 |
| `#af8a5b` | 1 | 0 | src/guide.ts:77 |
| `#af8bd277` | 1 | 1 | src/style.css:207 |
| `#af914b14` | 1 | 1 | src/style.css:162 |
| `#afafdb05` | 2 | 2 | src/style.css:267 |
| `#b19b78` | 1 | 1 | src/style.css:332 |
| `#b1c3b4` | 1 | 1 | src/style.css:334 |
| `#b27e53` | 1 | 0 | src/guide.ts:36 |
| `#b2c3b4` | 1 | 1 | src/style.css:310 |
| `#b2d4b2` | 1 | 1 | src/style.css:247 |
| `#b38e5c` | 1 | 0 | src/guide.ts:79 |
| `#b3b4d4` | 1 | 1 | src/style.css:267 |
| `#b3b6ce` | 1 | 1 | src/style.css:378 |
| `#b3f0ab` | 1 | 1 | src/style.css:550 |
| `#b4944d22` | 1 | 1 | src/style.css:312 |
| `#b4c4b7` | 1 | 1 | src/style.css:216 |
| `#b4c5af0a` | 1 | 1 | src/style.css:188 |
| `#b4cbc1` | 1 | 1 | src/style.css:60 |
| `#b4dec7` | 1 | 1 | src/style.css:265 |
| `#b5c3b9` | 1 | 1 | src/style.css:64 |
| `#b7815c` | 1 | 0 | src/guide.ts:75 |
| `#b7c7c6` | 1 | 1 | src/style.css:47 |
| `#b89ad877` | 1 | 1 | src/style.css:205 |
| `#b8a467` | 1 | 1 | src/style.css:192 |
| `#b8c9b9` | 2 | 2 | src/style.css:359, src/style.css:371 |
| `#b8cebf` | 1 | 1 | src/hand-readability.css:12 |
| `#b99759` | 1 | 0 | src/guide.ts:21 |
| `#b9c8b8` | 1 | 1 | src/style.css:151 |
| `#b9c9ad` | 1 | 1 | src/style.css:250 |
| `#ba9fbc` | 1 | 1 | src/style.css:286 |
| `#bab88b` | 1 | 1 | src/style.css:108 |
| `#bacbbb` | 1 | 1 | src/style.css:355 |
| `#badbd008` | 1 | 1 | src/style.css:12 |
| `#bc99cf` | 1 | 1 | src/style.css:372 |
| `#bca5d9` | 1 | 1 | src/intent-queue.css:6 |
| `#bcc9b9` | 1 | 1 | src/style.css:239 |
| `#bd8654` | 1 | 0 | src/guide.ts:31 |
| `#bd865c` | 1 | 0 | src/art.ts:4 |
| `#bdc3d1` | 1 | 1 | src/style.css:436 |
| `#bdd0a00a` | 1 | 1 | src/style.css:401 |
| `#bde9ff22` | 1 | 1 | src/style.css:217 |
| `#be9a61` | 1 | 1 | src/style.css:113 |
| `#bed4a533` | 1 | 1 | src/style.css:253 |
| `#c0aa6c12` | 1 | 1 | src/style.css:191 |
| `#c1c9d5` | 1 | 1 | src/intent-queue.css:16 |
| `#c27e83` | 1 | 0 | src/guide.ts:75 |
| `#c29d520c` | 1 | 1 | src/style.css:102 |
| `#c2b16b66` | 1 | 1 | src/style.css:114 |
| `#c2bd8b` | 1 | 1 | src/style.css:404 |
| `#c2d2cd` | 1 | 1 | src/style.css:36 |
| `#c3d0bf` | 1 | 1 | src/style.css:249 |
| `#c4d4a4` | 1 | 1 | src/style.css:255 |
| `#c5a7ff11` | 1 | 1 | src/style.css:219 |
| `#c5a7ff22` | 1 | 1 | src/style.css:219 |
| `#c5cb9b` | 1 | 1 | src/style.css:357 |
| `#c5eaff` | 1 | 1 | src/intent-queue.css:19 |
| `#c6a4610a` | 1 | 1 | src/style.css:69 |
| `#c6bc7820` | 1 | 1 | src/style.css:56 |
| `#c7b0e6` | 15 | 2 | src/style.css:6, src/style.css:421, src/guide.ts:77, src/guide.ts:79, src/guide.ts:80, src/guide.ts:81, src/guide.ts:83 |
| `#c7b0e611` | 1 | 1 | src/style.css:415 |
| `#c898fa` | 1 | 1 | src/style.css:464 |
| `#c8a3f333` | 1 | 1 | src/style.css:219 |
| `#c8b887` | 1 | 1 | src/style.css:122 |
| `#c8d6a817` | 1 | 1 | src/style.css:253 |
| `#c99e5f` | 1 | 1 | src/style.css:63 |
| `#c9ae64` | 1 | 1 | src/shop-balance.css:7 |
| `#ca8a6777` | 1 | 1 | src/style.css:207 |
| `#caad6b0d` | 1 | 1 | src/style.css:251 |
| `#cbb1f1` | 1 | 1 | src/style.css:462 |
| `#cdb27a` | 1 | 1 | src/style.css:72 |
| `#cfb4e8` | 1 | 1 | src/style.css:378 |
| `#d0ad69` | 1 | 1 | src/style.css:251 |
| `#d0b2ee` | 1 | 1 | src/style.css:266 |
| `#d0b575` | 1 | 1 | src/style.css:252 |
| `#d0d5e0` | 1 | 1 | src/style.css:420 |
| `#d1ac5f0a` | 1 | 1 | src/style.css:168 |
| `#d1b17b` | 1 | 1 | src/style.css:247 |
| `#d1c89d` | 1 | 1 | src/style.css:75 |
| `#d2c897` | 1 | 1 | src/style.css:410 |
| `#d2d7bd` | 1 | 1 | src/style.css:143 |
| `#d2d8a8` | 1 | 1 | src/style.css:253 |
| `#d2efff` | 1 | 0 | src/guide.ts:78 |
| `#d3ad65` | 2 | 0 | src/guide.ts:24, src/guide.ts:27 |
| `#d3b6f4` | 1 | 1 | src/style.css:207 |
| `#d4886e` | 1 | 1 | src/style.css:212 |
| `#d4b2e408` | 1 | 1 | src/style.css:341 |
| `#d4b2e411` | 1 | 1 | src/style.css:357 |
| `#d4b8d025` | 2 | 2 | src/style.css:283, src/style.css:284 |
| `#d4c797` | 1 | 1 | src/shop-balance.css:14 |
| `#d4d7ad` | 1 | 1 | src/style.css:127 |
| `#d4dec7` | 1 | 1 | src/style.css:362 |
| `#d4ded1` | 1 | 1 | src/style.css:210 |
| `#d5b181` | 1 | 1 | src/style.css:214 |
| `#d5bd82` | 1 | 1 | src/style.css:77 |
| `#d6a271` | 1 | 0 | src/guide.ts:75 |
| `#d6c17c88` | 1 | 1 | src/style.css:204 |
| `#d6c7e6` | 1 | 0 | src/art.ts:3 |
| `#d6c8ec` | 1 | 1 | src/style.css:432 |
| `#d6d4a4` | 1 | 1 | src/style.css:114 |
| `#d8bd79` | 1 | 1 | src/style.css:214 |
| `#d8e0cc` | 1 | 1 | src/style.css:210 |
| `#d8eac2` | 1 | 1 | src/style.css:212 |
| `#d9bc8d` | 1 | 0 | src/art.ts:23 |
| `#d9bf7620` | 1 | 1 | src/style.css:224 |
| `#d9c4ef` | 1 | 1 | src/style.css:205 |
| `#dae2c9` | 1 | 1 | src/style.css:235 |
| `#dbbd6c99` | 1 | 1 | src/style.css:202 |
| `#dd937a` | 1 | 1 | src/style.css:146 |
| `#ddbd8c` | 1 | 0 | src/art.ts:4 |
| `#dfbd72` | 1 | 1 | src/style.css:252 |
| `#e0aa99` | 1 | 1 | src/style.css:45 |
| `#e0c995` | 1 | 1 | src/style.css:227 |
| `#e0cef0` | 1 | 0 | src/guide.ts:81 |
| `#e0e7ce` | 1 | 1 | src/style.css:409 |
| `#e1d89a08` | 1 | 1 | src/style.css:202 |
| `#e1e2bc` | 1 | 1 | src/style.css:253 |
| `#e1e5ce` | 1 | 1 | src/style.css:344 |
| `#e1e7cc` | 2 | 2 | src/style.css:182, src/style.css:366 |
| `#e2c684` | 1 | 1 | src/intent-queue.css:20 |
| `#e2dced` | 1 | 1 | src/style.css:413 |
| `#e2eac7` | 1 | 1 | src/style.css:255 |
| `#e3a0a0` | 1 | 0 | src/art.ts:5 |
| `#e3d2a02e` | 1 | 1 | src/style.css:55 |
| `#e3d3f5` | 1 | 0 | src/guide.ts:80 |
| `#e3dced` | 1 | 1 | src/style.css:423 |
| `#e49754` | 1 | 0 | src/art.ts:5 |
| `#e4a48d` | 1 | 0 | src/guide.ts:33 |
| `#e4be5e0a` | 1 | 1 | src/style.css:270 |
| `#e4cc8b` | 1 | 1 | src/style.css:192 |
| `#e6bd7115` | 1 | 1 | src/style.css:562 |
| `#e6be78` | 1 | 1 | src/style.css:69 |
| `#e6c380` | 1 | 1 | src/style.css:240 |
| `#e6c689` | 1 | 1 | src/style.css:148 |
| `#e7e9d5` | 1 | 1 | src/style.css:199 |
| `#e8ca7c33` | 1 | 1 | src/style.css:253 |
| `#e8cf9d` | 1 | 0 | src/guide.ts:77 |
| `#e8dcd9` | 1 | 1 | src/style.css:281 |
| `#e8e8cc` | 1 | 1 | src/style.css:123 |
| `#e9a284` | 1 | 0 | src/guide.ts:37 |
| `#e9bd72` | 1 | 1 | src/style.css:379 |
| `#e9c0782e` | 1 | 1 | src/style.css:115 |
| `#e9cd86` | 1 | 0 | src/guide.ts:28 |
| `#e9daf8` | 1 | 0 | src/guide.ts:79 |
| `#e9dfc8` | 1 | 1 | src/hand-readability.css:10 |
| `#e9e8d3` | 1 | 1 | src/style.css:66 |
| `#e9ebc9` | 1 | 1 | src/style.css:253 |
| `#e9ebd2` | 1 | 1 | src/style.css:317 |
| `#ead6b1` | 1 | 0 | src/guide.ts:79 |
| `#ec9d83` | 7 | 1 | src/style.css:6, src/guide.ts:78, src/guide.ts:81 |
| `#eca092` | 1 | 1 | src/style.css:260 |
| `#edab90` | 1 | 1 | src/style.css:146 |
| `#eee3ff` | 1 | 1 | src/intent-queue.css:9 |
| `#efad9f` | 1 | 1 | src/style.css:264 |
| `#efb198` | 1 | 1 | src/style.css:378 |
| `#efc37b` | 13 | 4 | src/style.css:6, src/style.css:232, src/style.css:428, src/style.css:429, src/guide.ts:77, src/guide.ts:80, src/guide.ts:81 |
| `#efc37b0a` | 1 | 1 | src/style.css:69 |
| `#efc37b0c` | 1 | 1 | src/style.css:71 |
| `#efc37b17` | 1 | 1 | src/style.css:452 |
| `#efc37b22` | 2 | 2 | src/style.css:177, src/style.css:428 |
| `#efc37b33` | 1 | 1 | src/style.css:203 |
| `#efc37b66` | 1 | 1 | src/style.css:451 |
| `#efd09d` | 1 | 1 | src/style.css:435 |
| `#f0c790` | 1 | 0 | src/guide.ts:32 |
| `#f0d2a5` | 1 | 0 | src/guide.ts:75 |
| `#f0dfb5` | 1 | 1 | src/style.css:150 |
| `#f0e7c6` | 1 | 1 | src/style.css:404 |
| `#f0eace` | 1 | 1 | src/style.css:396 |
| `#f1d48a11` | 1 | 1 | src/style.css:202 |
| `#f1d69c` | 1 | 1 | src/style.css:418 |
| `#f2ce7a` | 1 | 1 | src/style.css:270 |
| `#f2dbad` | 1 | 0 | index.html:11 |
| `#f2dca8` | 1 | 0 | src/guide.ts:79 |
| `#f3e4fb` | 1 | 1 | src/style.css:372 |
| `#f5a99f` | 1 | 1 | src/style.css:566 |
| `#f5d18e` | 1 | 1 | src/style.css:252 |
| `#f5d987` | 1 | 1 | src/shop-balance.css:10 |
| `#f5d9a7` | 1 | 0 | src/guide.ts:80 |
| `#f5edd8` | 3 | 3 | src/style.css:3, src/style.css:6, src/style.css:356 |
| `#f6dfb0` | 1 | 0 | src/guide.ts:77 |
| `#f7b4a2` | 1 | 1 | src/style.css:551 |
| `#f7c965` | 1 | 0 | src/art.ts:4 |
| `#f7d59a` | 2 | 2 | src/style.css:61, src/style.css:85 |
| `#f8d59f` | 1 | 1 | src/style.css:120 |
| `#f8dbab` | 1 | 1 | src/style.css:106 |
| `#f9d49b` | 1 | 1 | src/style.css:40 |
| `#f9ecdc` | 1 | 1 | src/style.css:278 |
| `#ff9a91` | 1 | 1 | src/style.css:550 |
| `#ff9fa6` | 1 | 1 | src/shop-balance.css:32 |
| `#ffb2b5` | 1 | 1 | src/shop-balance.css:23 |
| `#ffb79a` | 1 | 1 | src/style.css:207 |
| `#ffd0a9` | 1 | 1 | src/style.css:212 |
| `#ffd0b7` | 1 | 1 | src/intent-queue.css:18 |
| `#ffd1b9` | 1 | 0 | src/guide.ts:78 |
| `#ffdaa2` | 1 | 1 | src/style.css:41 |
| `#ffe0a8` | 1 | 1 | src/style.css:428 |
| `#ffe2a3` | 1 | 1 | src/intent-queue.css:15 |
| `#ffe2ad` | 1 | 1 | src/style.css:69 |
| `#ffe4ad` | 1 | 1 | src/style.css:177 |
| `#ffe5a7` | 1 | 1 | src/style.css:453 |
| `#fff0bc` | 1 | 1 | src/style.css:185 |
| `#fff0cf` | 1 | 1 | src/style.css:71 |
| `#fff0d0` | 1 | 1 | src/style.css:357 |
| `#fff1c2` | 1 | 1 | src/style.css:453 |
| `#fff1cb` | 3 | 0 | src/art.ts:4, src/art.ts:25, src/guide.ts:77 |
| `#fff2c6` | 1 | 1 | src/style.css:224 |
| `#fff2c8` | 1 | 1 | src/style.css:275 |
| `#fff2d6` | 1 | 1 | src/style.css:449 |
| `#ffffff` | 1 | 1 | src/style.css:260 |
| `#ffffff88` | 1 | 1 | src/style.css:466 |

### Other color notation

No rgb/rgba, hsl/hsla, hwb, lab/lch, oklab/oklch, or CSS color() values were found. `transparent` and `currentColor` (case-insensitive) occurrences are enumerated in the JSON. CSS has one `color-mix(in srgb, var(--card-face), #fff 5%)` occurrence. Many colors are referenced by CSS custom properties; see JSON `tokens`.

---

## Offline marketing cover palette

This separate Canvas illustration is not loaded by the game. Its source, docs/cover/scene.html, contains **56 normalized hex values / 58 literal occurrences**, including the 16 named base-palette entries, CSS background and additional lighting/shadow colors. These are excluded from the runtime/boot total of 588. It uses system monospace/Courier New, Trebuchet MS, Arial Black and Impact treatments; it has no external font or raster input. The scene draws once, with no runtime animation loop. Wide and square exports are docs/cover/cover-1200x630.png and docs/cover/cover-512.png.

| Normalized hex | Occurrences | Source locations |
|---|---:|---|
| `#080e1cad` | 1 | docs/cover/scene.html:140 |
| `#0c14232f` | 1 | docs/cover/scene.html:84 |
| `#0e1525` | 1 | docs/cover/scene.html:180 |
| `#0e192a59` | 1 | docs/cover/scene.html:88 |
| `#101522` | 1 | docs/cover/scene.html:174 |
| `#101723` | 1 | docs/cover/scene.html:113 |
| `#151e2b` | 1 | docs/cover/scene.html:79 |
| `#171b2b` | 1 | docs/cover/scene.html:22 |
| `#191a29` | 1 | docs/cover/scene.html:8 |
| `#222234` | 1 | docs/cover/scene.html:146 |
| `#242a3a` | 1 | docs/cover/scene.html:79 |
| `#252338` | 1 | docs/cover/scene.html:79 |
| `#25233800` | 1 | docs/cover/scene.html:81 |
| `#272838` | 1 | docs/cover/scene.html:114 |
| `#29273b` | 1 | docs/cover/scene.html:22 |
| `#2e2a3d` | 1 | docs/cover/scene.html:150 |
| `#34425128` | 1 | docs/cover/scene.html:89 |
| `#362e40` | 1 | docs/cover/scene.html:145 |
| `#3c3349` | 1 | docs/cover/scene.html:149 |
| `#3c3944` | 1 | docs/cover/scene.html:113 |
| `#41354d` | 1 | docs/cover/scene.html:22 |
| `#4b3b52` | 1 | docs/cover/scene.html:148 |
| `#5a4a5100` | 1 | docs/cover/scene.html:100 |
| `#5f8b84` | 1 | docs/cover/scene.html:25 |
| `#63506618` | 1 | docs/cover/scene.html:81 |
| `#68504a55` | 1 | docs/cover/scene.html:100 |
| `#695569` | 1 | docs/cover/scene.html:22 |
| `#81736a48` | 1 | docs/cover/scene.html:81 |
| `#855d57` | 1 | docs/cover/scene.html:24 |
| `#8d7e8c` | 2 | docs/cover/scene.html:159 |
| `#8e99855b` | 1 | docs/cover/scene.html:118 |
| `#8eabbd` | 1 | docs/cover/scene.html:25 |
| `#9ac6b8` | 1 | docs/cover/scene.html:25 |
| `#aa9fad` | 1 | docs/cover/scene.html:184 |
| `#ac8d6d43` | 1 | docs/cover/scene.html:177 |
| `#b09bbd` | 1 | docs/cover/scene.html:23 |
| `#b9a3af0c` | 1 | docs/cover/scene.html:84 |
| `#c4a98b38` | 1 | docs/cover/scene.html:189 |
| `#c4a98b88` | 2 | docs/cover/scene.html:191 |
| `#c58161` | 1 | docs/cover/scene.html:24 |
| `#c5b7ba` | 1 | docs/cover/scene.html:176 |
| `#c78d6f` | 1 | docs/cover/scene.html:24 |
| `#c8996b26` | 1 | docs/cover/scene.html:103 |
| `#c9b7b2` | 1 | docs/cover/scene.html:159 |
| `#c9d1af2b` | 1 | docs/cover/scene.html:118 |
| `#ceb18618` | 1 | docs/cover/scene.html:90 |
| `#d7c9b334` | 1 | docs/cover/scene.html:95 |
| `#e1a6a2` | 1 | docs/cover/scene.html:25 |
| `#e2d3cd` | 1 | docs/cover/scene.html:183 |
| `#e3d7e2` | 1 | docs/cover/scene.html:23 |
| `#e7c49a` | 1 | docs/cover/scene.html:23 |
| `#eac6923f` | 1 | docs/cover/scene.html:103 |
| `#efbd78` | 1 | docs/cover/scene.html:24 |
| `#efbd7866` | 1 | docs/cover/scene.html:95 |
| `#ffe1a4` | 1 | docs/cover/scene.html:127 |
| `#fff0ce` | 1 | docs/cover/scene.html:23 |
