# Visual asset inventory

Read-only audit of the current working tree on 2026-11-04. Paths are relative to the repository root. Dependency folders, Git, npm cache, browser profile data, and this audit’s outputs are excluded from the media census. Runtime composition counts are separated from reused motifs and historical screenshots.

## Counts and provenance

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

## Cards, illustration panels, and frames

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

## Player and enemy visuals

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

## Relic, map, and UI icons

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

## Scene backgrounds and diagrams

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

## Shared motifs and source-generated geometry

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

## Offline marketing art and file-backed media census

The only authored file-backed art is the separate cover project. `docs/cover/scene.html` is a Canvas 2D source composition with original running-hamster pose, copper wheel, distant cage spire, bedding, stars and five fanned cards. Wide and square arrangements are independently positioned. Its 16-color palette and system-font treatment are separate from runtime art. `scripts/render-cover.mjs` exports them with Edge; it was read, not run, because that would write outside the authorized audit directory.

| File | Dimensions | Usage / provenance |
| --- | --- | --- |
| `docs/cover/cover-1200x630.png` | 1200 × 630 | Original Canvas export; promotional document asset; not imported by runtime |
| `docs/cover/cover-512.png` | 512 × 512 | Original Canvas export; promotional document asset; not imported by runtime |

The remaining 149 images are captured evidence, not authored art assets: 139 historical images under `shots/` (including deployment/admin screens) and 10 temporary QA captures under `.tmp/`. They are enumerated below so screenshots cannot be mistaken for source textures. None is loaded by the game. This count excludes newly captured `docs/art_audit/shots/*` and browser-profile extension icons.

### .tmp (10)

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

### shots (5)

```text
shots/battle.png
shots/battle_play.png
shots/camp.png
shots/gallery.png
shots/map.png
```

### shots/deploy (21)

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

### shots/fixes (12)

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

### shots/intent-queue (5)

```text
shots/intent-queue/desktop.png
shots/intent-queue/menu-1280.png
shots/intent-queue/menu-1440.png
shots/intent-queue/menu-390.png
shots/intent-queue/mobile.png
```

### shots/online (2)

```text
shots/online/leaderboard-offline.png
shots/online/leaderboard.png
```

### shots/playtest (43)

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

### shots/qa2 (13)

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

### shots/tips (9)

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

### shots/v2 (12)

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

### shots/wallet (17)

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

## Coverage checks

`asset_counts.json` contains every keyed card, actor, relic, room and UI icon with source line numbers, plus the file-backed media census. `extract_assets.mjs` regenerates these read-only counts using portable Node and writes only beneath `docs/art_audit/`. Checks: 60 catalog cards / 60 art keys / 0 missing; 12 catalog enemies / 12 enemy art keys + 1 player / 0 missing; 15 relic definitions / 15 icon keys / 0 missing. Existing `src/art.test.ts` already asserts unique card art, unique actor sprites and self-contained SVG; tests were read, not altered.
