import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'docs/art_audit');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const art = read('src/art.ts');
const catalog = read('src/game/catalog.ts');
const main = read('src/main.ts');
const guide = read('src/guide.ts');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const block = (text, from, to) => {
  const start = text.indexOf(from);
  return { text: text.slice(start, text.indexOf(to, start)), start };
};
const keys = (source, b) => [...b.text.matchAll(/^\s{2,4}(?:'([^']+)'|([a-zA-Z][\w-]*)):\s/gm)]
  .map(m => ({ id: m[1] || m[2], line: lineOf(source, b.start + m.index) }));
const pictures = keys(art, block(art, 'const cardPictures:', '\n};'));
const sprites = keys(art, block(art, 'const sprites:', '\n};'));
const scenes = keys(art, block(art, 'const scenes:', '\n};'));
const nodes = keys(art, block(art, '  const icons:', '\n  };'));
const relicIcons = keys(main, block(main, '  const paths:', '\n  };'));
const uiIcons = keys(main, block(main, '  const paths = {', '\n  };'));
const cards = [...catalog.matchAll(/card\('([^']+)', '([^']+)', '([^']+)', (\d+|'X'), '([^']+)'/g)]
  .map(m => ({id:m[1], name:m[2], type:m[3], cost:m[4], rarity:m[5], catalogLine:lineOf(catalog,m.index), artLine:pictures.find(p=>p.id===m[1])?.line}));
const relicBlock = block(catalog, 'export const RELICS:', 'export interface EnemyDefinition');
const relics = [...relicBlock.text.matchAll(/^  \['([^']+)', (?:'([^']+)'|"([^"]+)"), '([^']+)'/gm)]
  .map(m=>({id:m[1], name:m[2]||m[3], rarity:m[4],catalogLine:lineOf(catalog,relicBlock.start+m.index),artLine:relicIcons.find(p=>p.id===m[1])?.line}));
const enemyBlock = block(catalog, 'export const ENEMIES:', 'THIS_END_MARKER_IS_NOT_PRESENT');
const enemies = [...enemyBlock.text.matchAll(/^  \['([^']+)', '([^']+)'/gm)]
  .map(m=>({id:m[1],name:m[2],catalogLine:lineOf(catalog,enemyBlock.start+m.index),artLine:sprites.find(p=>p.id===m[1])?.line}));
const excluded = new Set(['.git', 'node_modules', '.npm-cache', 'art_audit']);
const mediaExt = /\.(?:png|webp|jpe?g|gif|svg|ico|avif|bmp|woff2?|ttf|otf)$/i;
const media = [];
const scan = dir => {
  for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
    if(excluded.has(entry.name))continue;
    const rel=path.join(dir,entry.name);
    if(rel.replaceAll('\\','/').startsWith('.tmp/edgecdp'))continue;
    if(entry.isSymbolicLink())continue;
    if(entry.isDirectory()){scan(rel); continue;}
    if(mediaExt.test(entry.name))media.push(rel.replaceAll('\\','/'));
  }
};
scan('');
const motifNames = ['star','seed','moon','bolt','shield','paper','sleepMark','wheel','hammy','speed','heart','sprout','clock','cardBack','gear','flame','bench','eyes','ghost','oracle','cageBackground','hut'];
const motifs=motifNames.map(name=>({name,line:lineOf(art,art.indexOf(`const ${name} =`))}));
const result = {cards,relics,enemies,pictures,sprites,scenes,nodes,relicIcons,uiIcons,motifs,media};
fs.writeFileSync(path.join(out,'asset_counts.json'),JSON.stringify(result,null,2)+'\n');
const table = (heads,rows) => [ '| '+heads.join(' | ')+' |', '| '+heads.map(()=> '---').join(' | ')+' |', ...rows.map(row=>'| '+row.join(' | ')+' |') ].join('\n');
const source = (file,line) => '`'+file+':'+line+'`';
const artLines = art.split('\n');
const report = [
'# Visual asset inventory',
'',
'Read-only audit of the current working tree on 2026-11-04. Paths are relative to the repository root. Dependency folders, Git, npm cache, browser profile data, and this audit’s outputs are excluded from the media census. Runtime composition counts are separated from reused motifs and historical screenshots.',
'',
'## Counts and provenance',
'',
table(['Family','Count','Source / use'],[
['Catalog card illustrations','60 / 60 covered',source('src/art.ts',81)+'; renderer '+source('src/art.ts',144)+'; catalog '+source('src/game/catalog.ts',5)],
['Actor sprites','13','1 playable Zoomie Gremlin + 12 catalog enemies; '+source('src/art.ts',165)],
['Relic icons','15 / 15 covered','24 × 24 continuous stroke SVG; '+source('src/main.ts',83)],
['Room / map icons','7','battle, elite, boss, rest, shop, event, treasure; '+source('src/art.ts',232)],
['General UI icons','6','attack, block, cast, heart, coin, deck; '+source('src/main.ts',103)],
['Encounter vignettes','5 defined, 4 used by main.ts','camp (unused outside tests), shop, rest, results, event; '+source('src/art.ts',208)],
['Title / arena wheel','1 articulated SVG','600 × 600 wheel with independent rotor and hamster groups; '+source('src/guide.ts',18)],
['How to Play illustrations','5','400 × 260 self-contained SVG compositions; '+source('src/guide.ts',72)],
['Sunflower energy illustration','1 family, 2 variants','32 × 40: face for energy supply, compact faceless variant for card costs; '+source('src/art.ts',20)],
['Shared illustration motifs','22','Reusable motif/composition functions, listed below; excluded from composition totals'],
['Runtime file-backed art / sprite sheets / raster textures','0','No active image imports, image URLs, CSS url(), <img>, canvas, or sprite sheet loader in runtime source'],
['Runtime custom font files / remote fonts','0','System font stacks only; no @font-face or font fetch'],
['Standalone authored marketing PNGs','2','docs/cover/cover-1200x630.png and docs/cover/cover-512.png; not loaded by the game'],
['Historical screenshot files','149','139 under shots/ plus 10 temporary QA PNGs under .tmp/; not game assets'],
['Other standalone image / SVG / icon / font files','0','Outside excluded dependency/browser data and audit outputs'],
]),
'',
'The source explicitly describes its illustration set as original (`src/art.ts:1`, `src/guide.ts:17`, `docs/cover/scene.html:13`). “Generated” here means composed at runtime from paths and rectangles; the repository provides no evidence of AI image generation or imported third-party art. No external image/font requests are made by these renderers. Shapes are decorative aria-hidden SVG except the guide diagrams, which carry an accessible image label.',
'',
'The nine SVG render entry points are seedArt, cardArt, spriteArt, sceneArt, nodeIcon (`src/art.ts`), wheelArt and illustration (`src/guide.ts`), relicIcon and icon (`src/main.ts`). Unknown card IDs fall back to a sprout; unknown sprites to Dust Mite; unknown room kinds to a star; unknown relics to a circle. These safety fallbacks are not additional catalog assets.',
'',
'## Cards, illustration panels, and frames',
'',
'All 60 cards have distinct keyed compositions, with no missing art IDs. There are 18 attacks, 27 skills, 12 powers, and 3 curses; 29 common, 21 uncommon, and 10 rare cards. The 10-card starter deck has four unique art IDs: Wheel Kick ×4, Cheek Pouch ×4, 3AM Dash ×1, Seed Snack ×1 (`src/game/catalog.ts:70`).',
'',
'Each art panel is 128 × 96 and shares the same deep-plum field, three small background marks, bottom ground strip, and three bedding flecks (`src/art.ts:144`). Every panel uses the common motif library below plus custom paths/rectangles. Art is identical in hand, rewards, shop, codex, deck/pile, upgrade, merge, and enlarged preview. Card upgrades/merge levels alter text labels and rule values, not illustration composition (`src/main.ts:201–217`).',
'',
'There is one CSS card-frame construction rather than image frames: a rounded 2 px rarity border, inset dark border, gradient face, two square bottom-corner marks, type label, title, art border, description, optional flavor divider, and footer (`src/style.css:260–285`, markup `src/main.ts:217`). Four card-type treatments are combined with three rarity treatments; the later effective colors are attack #efb198 / #4a3538, skill #acd8c5 / #294144, power #cfb4e8 / #40364f, curse #b3b6ce / #2d3444; common border #9aaba5, uncommon #97c5b6, rare #e9bd72 (`src/style.css:378–379`). Curses retain a diagonal stripe texture from the earlier rule. The cost badge is compact seedArt rather than a gem sprite.',
'',
table(['Card ID / name','Type · rarity','Shared motifs in composition','Artwork / definition'], cards.map(c=>{
 const line=artLines[c.artLine-1]; const used=motifNames.filter(n=>new RegExp('\\b'+n+'\\(').test(line));
 return ['`'+c.id+'` — '+c.name,c.type+' · '+c.rarity,used.join(', ')||'custom shapes',source('src/art.ts',c.artLine)+'; '+source('src/game/catalog.ts',c.catalogLine)];
})),
'',
'## Player and enemy visuals',
'',
'All actors are 96 × 96 inline SVG with a shared two-strip ground shadow (`src/art.ts:194`). They are still compositions; motion comes from CSS transforms/filters on the SVG or its wrapper. None has separate animation-frame artwork. Fur/scarf recolors and shared hamster, ghost, and oracle components create variants.',
'',
table(['Actor','Composition / distinction','Artwork / definition'],[
['zoomie-gremlin — playable hero','Large oat hamster with mint scarf, head tuft, speed lines and star. Also reused for brand mark and character selection.',source('src/art.ts',sprites.find(s=>s.id==='zoomie-gremlin').line)],
...enemies.map(e=>[e.id+' — '+e.name,({
'dust-mite':'Lilac stepped dust body, short whisker-like flecks, eyes and cream mouth.',
'queue-snake':'Mint stepped snake with gold queue spots, tongue and paperwork.',
'seed-thief':'Tan hamster, lilac scarf, black eye mask, seed sack and seeds.',
'fud-moth':'Lilac symmetrical wings, rose wing marks, oat body and gold antennae.',
'sybil-swarm':'Five small hamster faces/bodies inside one sprite. Engine also spawns five separately targetable copies, each showing this composition (25 visible hamsters for 5 targets).',
'oracle-acolyte':'Lilac hooded oracle, oat face, paper scroll and star.',
'liquidity-leech':'Blue stepped leech with mouth detail and stolen gold seed.',
'stale-sprite':'Mint ghost with eyes, plum mouth and small clock near lower edge.',
'oracle-judge':'Oracle variant with plum hood, gold gavel and crown band.',
'difficulty-adjuster':'Large gold gear-headed robot, blue face panel and side arms.',
'stale-ghost':'Pale ghost variant, larger clock and lilac floating fragments.',
'squeektoshi':'Pale hamster with lilac scarf, gold crown, full gold wheel and flanking bolts.',
})[e.id],source('src/art.ts',e.artLine)+'; '+source('src/game/catalog.ts',e.catalogLine)])]),
'',
'Locked Seed Hoarder and Professional Napper character tiles reuse the Zoomie Gremlin sprite under CSS silhouettes; they have no separate art or playable catalog entries (`src/main.ts:144`). The title-wheel hamster (`src/guide.ts:30`) and tutorial hamster (`src/guide.ts:75`) are separately drawn styles/poses, not the exact gameplay sprite. The Sybil display relationship is explicit in `src/game/engine.ts:184–187` and `src/main.ts:251`.',
'',
'## Relic, map, and UI icons',
'',
'Relics use a second visual language: thin rounded continuous lines rather than the crisp filled pixel silhouettes used by cards/actors/map rooms. All share viewBox 0 0 24 24, fill none, currentColor, stroke-width 1.6, and round joins (`src/main.ts:101`). They appear in the topbar, tooltip, relic detail modal, codex, and shop. There are no dedicated large relic illustrations. The character-select starter relic currently displays the rest-room moon rather than the Midnight Wheel relic SVG (`src/main.ts:144`).',
'',
table(['Relic ID / name','Rarity','Pictogram','Icon / definition'],relics.map(r=>[r.id+' — '+r.name,r.rarity,({
'midnight-wheel':'Wheel circle with spokes',wheely9000:'Gear',genesis:'Leaf / seed',
'live-camera':'Video camera',aura:'Halo and rays','name-tag':'Tag',wheelpaper:'Torn paper',pillhead:'Capsule',
'diamond-hands':'Diamond','airdrop-farmer':'Parachute and parcel','probably-nothing':'Question mark circle',
'stay-squeeky':'Zigzag hamster-like mark','sunflower-wheel':'Sunflower',hamsterfi:'Bank facade','early-buildooooor':'Hard hat',
})[r.id],source('src/main.ts',r.artLine)+'; '+source('src/game/catalog.ts',r.catalogLine)])),
'',
table(['Map room icon','Silhouette','Source'],nodes.map(n=>[n.id,({battle:'Pixel sword',elite:'Lightning bolt',boss:'Crown',rest:'Crescent moon',shop:'Striped shop facade',event:'Question mark',treasure:'Chest'})[n.id],source('src/art.ts',n.line)])),
'',
'Map nodes are 24 × 24 crisp SVG; the same symbols also decorate mode selection and the map legend. Paths between map rooms are generated cubic SVG curves in a 600 × 1700 viewBox (`src/main.ts:149–160`). There are 24 room nodes per run, not 24 separate room illustrations. Act labels change text, not map architecture art.',
'',
table(['UI icon','Pictogram','Source'],uiIcons.map(n=>[n.id,({attack:'Sword',block:'Shield',cast:'Four-point spark',heart:'Heart',coin:'Coin with currency mark',deck:'Overlapped cards'})[n.id],source('src/main.ts',n.line)])),
'',
'The six general UI icons use 24 × 24 SVG, fill none, currentColor, stroke-width 1.7 (`src/main.ts:112`). They appear in resources, enemy intentions, block, deck/piles, and combat overlays. Current intent mappings are attack → sword, block → shield, all buff/FUD/reject actions → the same spark/cast icon (`src/main.ts:245–251`); future intent queues are text badges rather than new icon art.',
'',
'Native font glyphs also serve as art/UI marks: ✦ (title/star/jackpot/hints), ⚙ (settings), ••• (more), ◇ (locked characters), ⌖ (target), ⓘ (chain help), ↵ (end turn), →/←/↗ (navigation), ♜ (empty leaderboard), ♛ (win), and ☾ (loss/hibernation). These are text glyphs with platform-dependent font rendering, not standalone icon assets (`src/main.ts:117,131,144,158,195,240,251,254,315`).',
'',
'## Scene backgrounds and diagrams',
'',
table(['Asset / screen','Visual elements','Source / status'],[
['Shared cage vignette background','480 × 192, plum wall, 9 vertical cage bars, 2 crossbars, tan/brown bedding, 12 bedding flecks and 3 stars.',source('src/art.ts',198)],
['camp vignette','Moon, hut, large mint wheel, hamster, seed dish and star.',source('src/art.ts',scenes.find(s=>s.id==='camp').line)+' — defined but unused by main.ts'],
['shop vignette','Pink striped awning, counter, shopkeeper hamster, cards, seeds, gear and stars.',source('src/art.ts',scenes.find(s=>s.id==='shop').line)+'; mounted '+source('src/main.ts',276)],
['rest vignette','Moon, hut, lilac bed and pale blanket, sleeping hamster, Z marks and sprout.',source('src/art.ts',scenes.find(s=>s.id==='rest').line)+'; mounted '+source('src/main.ts',287)],
['results vignette','Lilac wheel, crowned hamster on bench, gold trophy and stars; same illustration on win and loss.',source('src/art.ts',scenes.find(s=>s.id==='results').line)+'; mounted '+source('src/main.ts',315)],
['event vignette','Hut, giant paper, bench, hamster, question bubble and seed.',source('src/art.ts',scenes.find(s=>s.id==='event').line)+'; mounted '+source('src/main.ts',293)],
['Title wheel / arena wheel','600 × 600 separate wheel rotor and hamster groups; arena hides wheel hamster with CSS.',source('src/guide.ts',18)+'; title '+source('src/main.ts',131)+'; arena '+source('src/main.ts',241)+'; hide '+source('src/style.css',524)],
['Guide 1 — Play','Three seeds lead to an angled attack card with seed cost and sword.',source('src/guide.ts',77)],
['Guide 2 — Defend','Enemy sword / 8 intent points to hamster behind blue 8-block shield.',source('src/guide.ts',78)],
['Guide 3 — Reset','End Turn button, curved arrow, refreshed cards and three seed icons.',source('src/guide.ts',79)],
['Guide 4 — Explore','Branching route with fight, chest, arrow nodes and hamster position.',source('src/guide.ts',80)],
['Guide 5 — Real hamster','Wheel/telemetry diagram points to route, combat, reward and shop symbols.',source('src/guide.ts',81)],
]),
'',
table(['Screen/state','Background art actually used','Source'],[
['Title','CSS teal radial/linear atmosphere, cage bars/mask, bedding stripes, star dot texture; animated title wheel; no camp vignette.',source('src/style.css',52)+'–56; '+source('src/main.ts',131)],
['Mode selection / characters','Shared body gradient plus faint green radial CSS field. Room icons and Zoomie sprite decorate tiles.',source('src/style.css',94)+'; '+source('src/main.ts',135)+'–144'],
['Route map / hibernation','CSS green-teal radial field and tiny dot grid; SVG connecting routes and room symbols; dream mist via fog treatment.',source('src/style.css',243)+'–258; '+source('src/main.ts',147)+'–163'],
['Combat / elite / boss','One CSS cage-bar/bedding stage, faded wheel and 12 falling seed elements. All three acts use the same Bedding Burrows caption and setting. Jackpot/golden room adds gold styling.',source('src/main.ts',229)+'–255; '+source('src/style.css',187)+'–192'],
['Reward / treasure','Shared panel and illustrated reward cards; relic discovery is a text hint. No bespoke reward/chest vignette.',source('src/main.ts',260)+'–262'],
['Shop','Shared panel plus shop sceneArt vignette.',source('src/main.ts',274)+'–282'],
['Rest','Shared panel plus rest sceneArt vignette and card before/after preview.',source('src/main.ts',285)+'–287'],
['Event','Shared panel plus event sceneArt vignette.',source('src/main.ts',290)+'–293'],
['Game over / victory','Shared results vignette and large native moon/crown glyph; same crowned hero/trophy painting for either outcome.',source('src/main.ts',312)+'–315'],
['Relic / collection / deck / preview / settings / help / more','Shared modal shell/backdrop over current screen. Content reuses icons, actors and card art; help adds five diagrams.',source('src/main.ts',319)+'–390'],
['Leaderboard','Panel inside More modal; text rows, wallet strip and chess-rook empty glyph. No unique background illustration.',source('src/main.ts',194)+'–196'],
['390 px mobile','Responsive layout and scale/spacing changes; no separate mobile art files.',source('src/style.css',430)+' onward plus src/hand-readability.css, src/intent-queue.css, src/shop-balance.css'],
]),
'',
'## Shared motifs and source-generated geometry',
'',
table(['Motif helper','Visual','Source'],motifs.map(m=>[m.name,({star:'Stepped plus-shaped glint',seed:'Small outlined sunflower seed',moon:'Stepped crescent',bolt:'Stepped lightning bolt',shield:'Filled pixel shield',paper:'Paper with rule lines',sleepMark:'Pixel Z',wheel:'Mint/gold recolorable wheel with stand',hammy:'32-grid hamster with open/closed eyes, fur and scarf variants',speed:'Three horizontal speed streaks',heart:'Stepped rose heart',sprout:'Two leaves and seed root',clock:'Pixel clock face',cardBack:'Card back with star',gear:'Pixel cog',flame:'Amber/gold flame',bench:'Wooden bench / countertop',eyes:'Two highlighted square eyes',ghost:'Clock-carrying ghost',oracle:'Hooded oracle acolyte / judge',cageBackground:'Common vignette cage and bedding',hut:'Stepped hut'})[m.name],source('src/art.ts',m.line)])),
'',
'Four lower-level SVG helpers (`src/art.ts:7–13`) emit rectangles, filled paths, transformed groups, and the SVG wrapper. Pixel art is requested with shape-rendering="crispEdges". Scene pieces use fractional scales (for example 0.9, 1.1, 1.7), and CSS scales their viewBoxes to various widths; this means the visual pixel grid is not a single integer display grid. Reuse is deliberate: hamster, wheel, seed, shield, moon and star appear across cards, actors, menus and scenes. Decorative CSS textures and combat VFX are inventoried separately from these authored composition IDs.',
'',
'## Offline marketing art and file-backed media census',
'',
'The only authored file-backed art is the separate cover project. `docs/cover/scene.html` is a Canvas 2D source composition with original running-hamster pose, copper wheel, distant cage spire, bedding, stars and five fanned cards. Wide and square arrangements are independently positioned. Its 16-color palette and system-font treatment are separate from runtime art. `scripts/render-cover.mjs` exports them with Edge; it was read, not run, because that would write outside the authorized audit directory.',
'',
table(['File','Dimensions','Usage / provenance'],media.filter(p=>p.startsWith('docs/cover/')).map(p=>{const b=fs.readFileSync(path.join(root,p));return ['`'+p+'`',b.readUInt32BE(16)+' × '+b.readUInt32BE(20),'Original Canvas export; promotional document asset; not imported by runtime'];})),
'',
'The remaining 149 images are captured evidence, not authored art assets: 139 historical images under `shots/` (including deployment/admin screens) and 10 temporary QA captures under `.tmp/`. They are enumerated below so screenshots cannot be mistaken for source textures. None is loaded by the game. This count excludes newly captured `docs/art_audit/shots/*` and browser-profile extension icons.',
'',
...Object.entries(Object.groupBy(media.filter(p=>!p.startsWith('docs/cover/')),p=>p.startsWith('.tmp/')?'.tmp':p.split('/').slice(0,p.split('/').length>2?2:1).join('/'))).flatMap(([group,files])=>['### '+group+' ('+files.length+')','','```text',...files,'```','']),
'## Coverage checks',
'',
'`asset_counts.json` contains every keyed card, actor, relic, room and UI icon with source line numbers, plus the file-backed media census. `extract_assets.mjs` regenerates these read-only counts using portable Node and writes only beneath `docs/art_audit/`. Checks: 60 catalog cards / 60 art keys / 0 missing; 12 catalog enemies / 12 enemy art keys + 1 player / 0 missing; 15 relic definitions / 15 icon keys / 0 missing. Existing `src/art.test.ts` already asserts unique card art, unique actor sprites and self-contained SVG; tests were read, not altered.',
''
];
fs.writeFileSync(path.join(out,'assets_inventory.md'),report.join('\n'));
console.log(JSON.stringify({cards:cards.length,pictures:pictures.length,sprites:sprites.length,enemies:enemies.length,relics:relics.length,relicIcons:relicIcons.length,nodes:nodes.length,scenes:scenes.length,uiIcons:uiIcons.length,mediaCount:media.length,mediaByRoot:Object.groupBy(media,p=>p.split('/')[0]),types:Object.fromEntries([...new Set(cards.map(c=>c.type))].map(t=>[t,cards.filter(c=>c.type===t).length])),rarities:Object.fromEntries([...new Set(cards.map(c=>c.rarity))].map(t=>[t,cards.filter(c=>c.rarity===t).length])),missingCards:cards.filter(c=>!c.artLine),missingEnemies:enemies.filter(c=>!c.artLine)}));
