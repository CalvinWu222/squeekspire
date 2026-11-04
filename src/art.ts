/** Original Squeekspire pixel illustrations. All art is inline SVG; no assets or fonts are fetched. */
const C = {
  ink: '#271f35', deep: '#352a46', plum: '#51405e', lilac: '#a494bd', pale: '#d6c7e6',
  cream: '#fff1cb', oat: '#ddbd8c', tan: '#bd865c', brown: '#795044', gold: '#f7c965',
  amber: '#e49754', mint: '#a6d3af', green: '#668d78', rose: '#e3a0a0', blue: '#8dbac8',
};
const r = (x: number, y: number, w: number, h: number, fill: string, opacity = 1): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" opacity="${opacity}"/>`;
const p = (d: string, fill: string): string => `<path d="${d}" fill="${fill}"/>`;
const g = (x: number, y: number, scale: number, body: string, extra = ''): string =>
  `<g transform="translate(${x} ${y}) scale(${scale})" ${extra}>${body}</g>`;
const svg = (w: number, h: number, body: string): string =>
  `<svg class="pixel-art" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${body}</svg>`;
const star = (x: number, y: number, size = 1, color = C.gold): string =>
  g(x, y, size, p('M4 0h2v4h4v2H6v4H4V6H0V4h4Z', color));
const seed = (x: number, y: number, scale = 1, color = C.oat): string =>
  g(x, y, scale, p('M6 0h4v4h4v8h-2v4H4v-4H2V6h2V2h2Z', C.ink) + p('M6 3h3v3h3v6H9v2H5v-3H4V7h2Z', color) + r(7, 6, 2, 5, C.cream));

/** Original striped sunflower seed. The broad shell leaves room for a resource count. */
export function seedArt(compact = false): string {
  return svg(32, 40,
    p('M14 0h4v3h3v3h3v4h3v6h2v12h-2v5h-3v3h-4v2H12v-2H8v-3H5v-5H3V16h2v-6h3V6h3V3h3Z', '#231f2c') +
    p('M14 3h4v3h3v4h3v6h2v12h-2v5h-4v3h-8v-3H8v-5H6V16h2v-6h3V6h3Z', '#d9bc8d') +
    p('M14 6h4v4h3v6h3v12h-3v5H11v-5H8V16h3v-6h3Z', '#41404d') +
    p('M14 6h2v6h-2v7h-2v10h-2V16h2v-6h2Z', '#fff1cb') +
    p('M20 12h2v6h2v10h-2v5h-3v-3h2V18h-1Z', '#a99678') +
    r(12, 34, 8, 2, '#9b8165') +
    (compact ? '' : r(13, 14, 2, 3, '#171b27') + r(20, 14, 2, 3, '#171b27') + r(13, 14, 1, 1, C.cream) + r(20, 14, 1, 1, C.cream) + r(11, 18, 3, 2, C.rose) + r(21, 18, 3, 2, C.rose) + p('M16 18h1v1h2v-1h1v2h-4Z', '#171b27')));
}
const moon = (x: number, y: number, scale = 1): string =>
  g(x, y, scale, p('M6 0h8v3H9v3H6v9h3v3h8v-3h3v5h-4v3H6v-3H2v-4H0V7h3V3h3Z', C.gold));
const bolt = (x: number, y: number, scale = 1, color = C.gold): string =>
  g(x, y, scale, p('M9 0h8l-4 9h7L5 28l4-13H2Z', C.ink) + p('M10 3h4l-5 9h6L8 22l3-10H6Z', color));
const shield = (x: number, y: number, scale = 1, color = C.mint): string =>
  g(x, y, scale, p('M3 0h18v3h3v16h-3v5h-5v4H8v-4H3v-5H0V3h3Z', C.ink) + p('M4 4h16v14h-3v4h-5v2H9v-3H6v-4H4Z', color) + r(7, 6, 3, 11, C.cream));
const paper = (x: number, y: number, scale = 1, color = C.cream): string =>
  g(x, y, scale, r(0, 0, 24, 30, C.ink) + r(2, 2, 20, 26, color) + r(6, 7, 12, 2, C.tan) + r(6, 13, 10, 2, C.tan) + r(6, 19, 12, 2, C.tan));
const sleepMark = (x: number, y: number, scale = 1): string =>
  g(x, y, scale, p('M0 0h9v3H6v3H3v3h6v3H0V9h3V6h3V3H0Z', C.pale));
const wheel = (x: number, y: number, scale = 1, color = C.mint): string =>
  g(x, y, scale,
    r(25, 50, 14, 12, C.brown) + r(15, 60, 34, 4, C.ink) +
    p('M20 0h24v4h8v4h8v12h4v24h-4v8h-8v8H40v4H24v-4H12v-8H4v-8H0V20h4V12h8V4h8Z', C.ink) +
    p('M20 4h24v4h8v8h8v28h-8v8h-8v8H20v-8h-8v-8H4V20h4v-8h12Z', color) +
    p('M24 10h16v4h8v6h6v24h-8v6h-8v4H24v-4h-8v-8h-6V24h4v-8h10Z', C.deep) +
    r(29, 10, 5, 44, color) + r(10, 29, 44, 5, color) +
    p('m16 13 35 35-4 4-35-35Z', color) + p('m48 13 4 4-35 35-4-4Z', color) +
    r(25, 25, 14, 14, C.ink) + r(29, 29, 6, 6, C.gold));

/** A small athlete, drawn on a 32-pixel grid. */
const hammy = (x: number, y: number, scale = 1, asleep = false, fur = C.oat, scarf = C.mint): string =>
  g(x, y, scale,
    p('M5 3h7v3h8V3h7v3h3v7h-2v4h3v10h-4v4H5v-3H1V18h3v-5H2V7h3Z', C.ink) +
    r(5, 6, 6, 7, fur) + r(21, 6, 6, 7, fur) + r(6, 7, 3, 4, C.rose) + r(23, 7, 3, 4, C.rose) +
    p('M9 10h14v3h4v8h2v6h-4v2H7v-2H3v-9h3v-5h3Z', fur) +
    p('M9 19h14v3h3v5h-5v2H10v-2H6v-5h3Z', C.cream) +
    (asleep ? r(8, 16, 5, 2, C.ink) + r(21, 16, 5, 2, C.ink) : r(10, 14, 3, 4, C.ink) + r(21, 14, 3, 4, C.ink) + r(10, 14, 1, 1, C.cream) + r(21, 14, 1, 1, C.cream)) +
    r(15, 19, 4, 3, C.rose) + r(16, 22, 2, 2, C.ink) + r(6, 20, 4, 3, C.rose) + r(24, 20, 4, 3, C.rose) +
    r(4, 27, 7, 3, C.tan) + r(21, 27, 7, 3, C.tan) +
    (scarf ? r(6, 25, 20, 3, scarf) + r(5, 27, 4, 5, scarf) : ''));

const speed = (x: number, y: number, color = C.gold): string =>
  r(x, y, 18, 3, color) + r(x - 7, y + 7, 21, 3, color) + r(x + 3, y + 14, 11, 3, color);
const heart = (x: number, y: number, scale = 1): string =>
  g(x, y, scale, p('M2 0h5v2h4V0h5v2h2v6h-2v3h-3v3h-3v3H8v-3H5v-3H2V8H0V2h2Z', C.rose));
const sprout = (x: number, y: number, scale = 1): string =>
  g(x, y, scale, r(11, 10, 3, 22, C.green) + p('M1 2h9v4h4v8H7v-4H3V7H1ZM25 0h-8v4h-4v9h7V9h4V6h1Z', C.mint) + seed(5, 25, 1.1));
const clock = (x: number, y: number, scale = 1): string =>
  g(x, y, scale, p('M8 0h16v4h4v4h4v16h-4v4h-4v4H8v-4H4v-4H0V8h4V4h4Z', C.ink) +
    p('M8 4h16v4h4v16h-4v4H8v-4H4V8h4Z', C.cream) + r(14, 7, 3, 11, C.plum) + r(17, 15, 8, 3, C.plum) + r(14, 15, 4, 4, C.amber));
const cardBack = (x: number, y: number, scale = 1, color = C.lilac): string =>
  g(x, y, scale, r(0, 0, 24, 32, C.ink) + r(2, 2, 20, 28, color) + r(5, 5, 14, 22, C.deep) + star(7, 11, 1, C.gold));
const gear = (x: number, y: number, scale = 1): string =>
  g(x, y, scale, p('M12 0h12v6h6v6h6v12h-6v6h-6v6H12v-6H6v-6H0V12h6V6h6Z', C.gold) + r(10, 10, 16, 16, C.ink) + r(14, 14, 8, 8, C.amber));
const flame = (x: number, y: number, scale = 1): string =>
  g(x, y, scale, p('M13 0h4v8h5v5h4v12h-4v5H5v-4H1V15h4V9h4v8h4Z', C.amber) + p('M13 12h4v8h5v7H7v-9h4v4h2Z', C.gold) + r(12, 24, 5, 5, C.cream));
const bench = (x: number, y: number, width: number): string =>
  r(x, y, width, 6, C.tan) + r(x, y + 6, width, 4, C.brown) + r(x + 5, y + 10, 5, 12, C.ink) + r(x + width - 10, y + 10, 5, 12, C.ink);

// Each catalog card has its own composition; shared motifs form a coherent illustrated deck.
const cardPictures: Record<string, string> = {
  'wheel-kick': wheel(62, 15, 0.9) + hammy(20, 34, 1.2) + speed(7, 34) + star(88, 21, 1.3),
  'cheek-pouch': hammy(35, 18, 1.7, false, C.oat, '') + seed(20, 50, 1) + seed(92, 54, 1) + shield(97, 12, 0.6),
  '3am-dash': moon(13, 9, 1.1) + clock(85, 8, 0.8) + speed(13, 48) + hammy(49, 39, 1.2) + bolt(97, 48, 0.7),
  'seed-snack': hammy(18, 24, 1.6) + seed(80, 26, 2.6) + star(98, 14, 0.8) + heart(67, 13, 0.5),
  'burst-sprint': speed(7, 30, C.rose) + hammy(38, 29, 1.5) + flame(87, 28, 1.1) + star(45, 12, 0.7),
  'double-lap': wheel(12, 20, 0.75) + wheel(69, 12, 0.75, C.gold) + hammy(42, 45, 0.9) + star(64, 5, 0.7),
  'tail-whip': hammy(22, 21, 1.6) + p('M69 61h17V48h11V35h10v5h-6v14H90v13H69Z', C.rose) + star(99, 22, 1),
  'wood-chew': r(66, 20, 41, 43, C.ink) + r(69, 23, 35, 37, C.tan) + r(75, 27, 4, 28, C.oat) + r(89, 25, 3, 22, C.brown) + hammy(23, 30, 1.3) + r(66, 39, 9, 7, C.deep) + r(91, 68, 7, 3, C.oat),
  'wheel-spin': wheel(33, 8, 1.06, C.gold) + speed(4, 29, C.mint) + star(108, 27, 1.1) + star(13, 64, 0.7),
  'bedding-fort': p('M10 67V43h18V28h19v15h17V30h21v14h19v24Z', C.oat) + r(17, 49, 80, 20, C.tan) + r(50, 47, 24, 24, C.ink) + hammy(49, 43, 0.8) + shield(91, 19, 0.8) + r(11, 72, 101, 5, C.cream),
  'ball-up': shield(70, 10, 1.5) + hammy(21, 33, 1.4, true, C.oat, '') + r(22, 72, 57, 5, C.tan) + star(12, 19, 0.8),
  'sniff': hammy(16, 23, 1.7) + p('M76 39h12v-5h11v3H89v6H76Zm7 14h17v-4h13v4h-11v4H83Z', C.pale) + seed(94, 65, 1) + star(97, 21, 0.5),
  'sunflower-stash': p('M22 34h19v36H18V39h4Z', C.tan) + seed(19, 30, 1.7) + seed(46, 44, 1.5) + seed(67, 34, 2) + sprout(90, 24, 0.8) + star(41, 13, 1),
  'water-bottle': r(53, 11, 31, 10, C.lilac) + r(49, 21, 39, 43, C.ink) + r(53, 24, 31, 34, C.blue) + r(57, 27, 7, 21, C.pale) + r(62, 64, 10, 8, C.lilac) + r(55, 72, 12, 5, C.lilac) + heart(21, 32, 1),
  'squeek': hammy(16, 30, 1.5) + p('M67 17h42v27H88l-9 9V44H67Z', C.cream) + r(83, 22, 6, 12, C.amber) + r(83, 37, 6, 4, C.amber) + star(102, 58, 1),
  'pellet-toss': hammy(10, 34, 1.3) + seed(61, 22, 0.8) + seed(83, 37, 1) + seed(105, 57, 0.7) + p('M54 28h5v-6h10v-4h15v3H71v4H60v7h-6Z', C.pale),
  'wheel-brake': wheel(24, 10, 1) + r(75, 48, 31, 10, C.ink) + r(78, 50, 26, 5, C.rose) + r(100, 33, 6, 22, C.rose) + shield(8, 48, 0.8),
  'cage-climb': [24, 48, 72, 96].map(x => r(x, 8, 4, 74, C.plum)).join('') + [21, 45, 69].map(y => r(12, y, 102, 3, C.lilac)).join('') + hammy(46, 27, 1.2) + star(94, 9, 0.8),
  'night-owl': moon(85, 9, 1) + p('M39 26h9v8h27v-8h9v38h-7v9H45v-9h-6Z', C.lilac) + r(45, 40, 14, 15, C.cream) + r(64, 40, 14, 15, C.cream) + r(51, 44, 5, 7, C.ink) + r(67, 44, 5, 7, C.ink) + r(58, 56, 7, 5, C.gold) + star(17, 18, 0.7),
  'fluff-up': p('M34 20h47v7h14v14h9v24H89v10H38V66H23V44h9V30h2Z', C.cream) + hammy(38, 29, 1.5, false, C.cream, '') + star(12, 28, 1) + star(104, 30, 0.7),
  'marathon': wheel(68, 20, 0.8) + hammy(25, 38, 1.2) + r(17, 12, 3, 61, C.tan) + p('M20 12h37v23H20Z', C.rose) + r(20, 12, 9, 9, C.cream) + r(38, 12, 9, 9, C.cream) + r(29, 21, 9, 9, C.cream) + r(47, 21, 9, 9, C.cream),
  'settlement': paper(22, 25, 1.2) + clock(75, 20, 1) + r(62, 63, 35, 4, C.mint) + r(64, 71, 31, 4, C.gold) + star(15, 14, 0.7),
  'oracle-ping': cardBack(12, 30, 1, C.mint) + cardBack(49, 20, 1) + cardBack(86, 30, 1, C.gold) + p('M50 7h24v3h5v5h-5v3H50v-3h-5v-5h5Z', C.cream) + r(60, 9, 6, 7, C.ink),
  'block-reward': shield(22, 14, 1.5, C.gold) + seed(75, 42, 1.8, C.gold) + seed(95, 51, 1.5, C.gold) + star(85, 13, 1.3),
  'overrun': hammy(11, 41, 1.1) + hammy(45, 29, 1.2) + hammy(82, 17, 1.3) + speed(2, 23, C.rose),
  'merge': cardBack(14, 33, 1, C.mint) + cardBack(89, 33, 1, C.mint) + cardBack(51, 13, 1, C.gold) + p('M40 52h9v-7h5v7h7v5H40Zm35 0h9v5H68v-5h3v-7h4Z', C.cream) + star(61, 4, 0.6),
  'stake': sprout(52, 14, 1.5) + seed(18, 54, 1.5) + r(40, 71, 57, 7, C.tan) + bolt(98, 28, 0.7, C.mint) + star(31, 18, 0.7),
  'burrow': p('M11 77V56h8V43h16V31h51v12h16v15h12v19Z', C.tan) + p('M36 77V58h6V45h37v10h8v22Z', C.ink) + hammy(44, 43, 1.1, true) + sprout(13, 17, 0.7) + r(20, 71, 12, 4, C.oat),
  'rolling-median': shield(14, 37, 1) + shield(48, 24, 1.3) + shield(88, 36, 1) + r(11, 20, 22, 3, C.gold) + r(47, 13, 36, 3, C.gold) + r(92, 19, 20, 3, C.gold),
  'insomnia': moon(17, 11, 1.2) + hammy(43, 27, 1.6, false, C.pale, C.lilac) + r(58, 60, 6, 2, C.rose) + r(75, 60, 6, 2, C.rose) + clock(93, 13, 0.6) + star(44, 12, 0.6),
  'genesis-seed': star(58, 2, 1.4) + sprout(43, 19, 1.7) + star(18, 36, 1.3) + star(97, 30, 1.1) + r(30, 78, 68, 4, C.gold),
  'peak-rpm': wheel(20, 9, 1.1, C.gold) + bolt(87, 16, 1.5) + speed(6, 48, C.rose) + star(105, 66, 0.6),
  'nocturnal': moon(75, 7, 1.6) + hammy(24, 34, 1.4, false, C.lilac, C.gold) + star(19, 14, 0.8) + star(63, 8, 0.5) + star(109, 52, 0.6),
  'full-moon-run': p('M50 4h28v5h10v10h5v28h-5v10H78v5H50v-5H40V47h-5V19h5V9h10Z', C.cream) + r(72, 15, 9, 9, C.oat) + r(44, 27, 9, 5, C.oat) + hammy(39, 42, 1.3) + speed(6, 51),
  'maus-mode': r(25, 15, 79, 43, C.ink) + r(29, 19, 71, 35, C.green) + r(35, 25, 21, 3, C.mint) + r(35, 32, 32, 3, C.mint) + r(35, 39, 17, 3, C.mint) + r(18, 61, 92, 9, C.lilac) + hammy(60, 31, 1.4, false, C.pale, C.mint),
  'freeze-for-mint': p('M38 8h51v9h9v49h-9v10H38v-9H28V18h10Z', C.blue) + p('M40 13h45v7h8v43h-8v8H39v-9h-6V21h7Z', C.pale) + seed(47, 27, 2.1) + r(36, 21, 7, 24, C.cream) + star(13, 24, 1) + star(103, 51, 1),
  'aura-farm': sprout(13, 44, 0.7) + sprout(93, 42, 0.7) + p('M39 16h47v5h8v9h-8v5H39v-5h-8v-9h8Z', C.gold) + r(44, 21, 37, 9, C.deep) + hammy(39, 36, 1.4) + star(17, 20, 0.7),
  'buildooooor': bench(28, 60, 76) + r(36, 38, 20, 20, C.oat) + r(60, 38, 20, 20, C.tan) + r(48, 16, 20, 20, C.oat) + hammy(4, 38, 1) + r(46, 23, 37, 6, C.gold) + star(94, 18, 1),
  'squeektoshi-sleeping': r(20, 58, 90, 14, C.lilac) + r(24, 72, 82, 7, C.plum) + hammy(42, 27, 1.4, true, C.oat, '') + sleepMark(85, 18) + sleepMark(102, 7, 0.7) + moon(11, 14, 1),
  'wheely-overclock': wheel(20, 9, 1.1, C.amber) + bolt(87, 15, 1.3, C.mint) + gear(79, 55, 0.8) + r(12, 27, 5, 26, C.rose) + star(7, 12, 0.6),
  'gm': p('M46 35V22h8v-7h20v7h8v13Z', C.gold) + [22, 44, 66, 88].map(x => r(x, 36, 14, 3, C.amber)).join('') + hammy(17, 36, 1.3) + r(77, 47, 24, 24, C.cream) + r(101, 51, 8, 13, C.oat) + r(80, 43, 18, 4, C.brown),
  'paper-hands': paper(14, 17, 1.3) + p('M67 54V37h7v10h5V29h7v18h5V34h7v24h-6v15H72V61Z', C.cream) + r(71, 57, 19, 3, C.tan) + r(91, 12, 17, 4, C.rose),
  'wagmi': hammy(8, 39, 1.1, false, C.oat, C.gold) + hammy(46, 30, 1.1, false, C.pale, C.rose) + hammy(84, 39, 1.1, false, C.tan, C.mint) + p('M18 17h8v-5h8V8h57v4h8v5h8v7h-8v-5h-8v-4H34v4h-8v5h-8Z', C.gold) + star(59, 17, 1),
  'ngmi': hammy(18, 33, 1.3, true, C.pale, C.lilac) + p('M76 16h8v24h13v-8h7v20H84v-7h8v-1H76Z', C.rose) + r(81, 65, 24, 4, C.plum) + r(16, 21, 17, 3, C.lilac),
  'rug-pull': p('M14 66V46h67v5h13v17H35v7H14Z', C.rose) + r(21, 51, 55, 4, C.cream) + r(25, 60, 53, 3, C.plum) + hammy(73, 24, 1.1) + shield(19, 9, 1) + speed(79, 69, C.gold),
  'gas-war': flame(16, 27, 1.4) + flame(73, 16, 1.8) + bolt(51, 25, 1.1, C.cream) + star(14, 10, 0.7) + r(57, 72, 14, 5, C.amber),
  'ser': hammy(11, 29, 1.5) + p('M66 9h45v28H91v9l-9-9H66Z', C.cream) + r(74, 20, 22, 3, C.plum) + shield(88, 47, 1, C.lilac),
  'lfg': p('M63 8h10v7h8v12h6v29H51V27h6V15h6Z', C.cream) + r(60, 28, 16, 15, C.blue) + p('M51 41H41v21h10Zm36 0h10v21H87Z', C.rose) + flame(54, 56, 1.1) + star(19, 19, 0.9) + star(106, 38, 0.7),
  'wen-mint': clock(17, 26, 1.3) + seed(79, 28, 2) + p('M80 9h21v5h4v10h-5v4h-8v8h-6V25h9v-6h-9v-5h-6Z', C.gold) + r(86, 39, 6, 5, C.gold) + sleepMark(7, 8, 0.6),
  'ape-in': p('M37 13h48v7h13v37H85v14H38V59H25V24h12Z', C.brown) + r(39, 28, 46, 29, C.oat) + r(46, 29, 10, 9, C.ink) + r(69, 29, 10, 9, C.ink) + r(52, 47, 23, 7, C.cream) + bolt(4, 22, 1.1) + star(105, 17, 0.7),
  'exit-liquidity': hammy(11, 35, 1.2, true, C.pale) + p('M59 32h35v-8l20 15-20 15v-9H59Z', C.mint) + r(93, 57, 17, 15, C.plum) + r(98, 61, 4, 4, C.rose) + star(41, 14, 0.6),
  'touch-grass': [7, 25, 44, 76, 99].map((x, i) => sprout(x, 43 + i % 2 * 6, 0.65)).join('') + hammy(42, 23, 1.4, true, C.oat, '') + heart(18, 12, 0.7) + star(92, 16, 0.8),
  'gsqueek': moon(15, 8, 1) + hammy(44, 32, 1.4) + p('M83 11h31v23H97l-7 8v-8h-7Z', C.pale) + heart(91, 15, 0.7) + star(46, 12, 0.6),
  'hammy-gang': hammy(7, 35, 1.1, false, C.pale, C.rose) + hammy(44, 23, 1.3, false, C.oat, C.gold) + hammy(89, 36, 1.05, false, C.tan, C.mint) + star(17, 13, 0.8) + star(99, 9, 0.8),
  'gud-tek': cardBack(15, 25, 1.4, C.mint) + gear(74, 27, 1.1) + p('M80 16V6h7v10h6l-10 10-10-10Z', C.gold) + star(59, 9, 0.7),
  'moar': cardBack(14, 27, 1.2, C.rose) + cardBack(77, 27, 1.2, C.rose) + p('M45 36h20v-8l15 15-15 15v-9H45Z', C.gold) + star(57, 12, 1),
  'sleep-cam': r(22, 17, 80, 49, C.ink) + r(26, 21, 72, 41, C.plum) + hammy(42, 25, 1.1, true, C.oat, '') + r(30, 25, 5, 5, C.rose) + r(52, 67, 20, 7, C.lilac) + r(40, 74, 45, 4, C.lilac) + sleepMark(80, 25, 0.7),
  'spacetime-fold': p('M9 24h30V13h42v10h32v31H92v21H48V65H23V49H9Z', C.lilac) + p('M15 28h29V19h33v9h30v20H86v21H53V59H29V44H15Z', C.deep) + cardBack(51, 23, 1.1, C.gold) + star(20, 14, 0.8) + star(91, 58, 1),
  'nyn-sob': hammy(35, 20, 1.8, true, C.pale, C.lilac) + r(51, 52, 6, 19, C.blue) + r(75, 52, 6, 19, C.blue) + r(28, 76, 75, 5, C.blue) + heart(12, 18, 0.6),
  'firmware-upgrade': gear(16, 27, 1.2) + r(73, 24, 30, 37, C.ink) + r(77, 28, 22, 29, C.mint) + p('M84 48V38h-6l10-11 10 11h-6v10Z', C.ink) + r(68, 66, 40, 6, C.lilac) + star(56, 9, 0.8),
};

export function cardArt(id: string): string {
  const stars = r(8, 10, 3, 3, C.plum) + r(116, 19, 3, 3, C.plum) + r(108, 77, 3, 3, C.plum);
  return svg(128, 96, r(0, 0, 128, 96, C.deep) + stars + r(0, 83, 128, 13, C.ink) +
    r(9, 86, 19, 2, C.plum) + r(48, 91, 35, 2, C.plum) + r(97, 86, 20, 2, C.plum) +
    (cardPictures[id] ?? sprout(45, 20, 1.5)));
}

const eyes = (x: number, y: number, gap = 17): string =>
  r(x, y, 5, 6, C.ink) + r(x + gap, y, 5, 6, C.ink) + r(x, y, 2, 2, C.cream) + r(x + gap, y, 2, 2, C.cream);
const ghost = (color: string, big = false): string =>
  p('M29 17h38v7h10v12h6v45H71v-8H60v8H47v-8H36v8H23V37h6Z', C.ink) +
  p('M32 22h32v7h9v10h5v34h-6v-7H58v8H48v-8H34v7h-6V39h4Z', color) +
  eyes(37, 40, 18) + r(44, 57, 14, 5, C.plum) + clock(big ? 34 : 58, big ? 7 : 63, big ? 0.8 : 0.6);
const oracle = (judge: boolean): string =>
  p('M27 27V17h10V9h25v8h10v10h9v50H16V39h11Z', C.ink) +
  p('M30 29V20h11v-6h18v6h10v11h7v41H23V40h7Z', judge ? C.plum : C.lilac) +
  p('M36 28h26v6h6v24h-6v8H35v-8h-5V36h6Z', C.oat) + eyes(35, 40, 20) +
  r(44, 51, 10, 5, C.rose) + r(34, 62, 29, 6, C.cream) +
  (judge ? r(17, 69, 63, 9, C.brown) + r(68, 49, 5, 23, C.gold) + r(61, 42, 21, 10, C.gold) + p('M34 17h30v6H34Z', C.gold) : paper(65, 55, 0.7)) +
  star(10, 18, 0.7, C.pale);

const sprites: Record<string, string> = {
  'zoomie-gremlin': speed(3, 35, C.gold) + hammy(19, 22, 2, false, C.oat, C.mint) +
    p('M33 25V12h7v8h7V10h7v15Z', C.oat) + r(32, 24, 23, 6, C.oat) + star(78, 17, 0.7),
  'dust-mite': p('M20 35h8V24h13v-8h19v8h13v11h8v31h-9v12H26V66h-6Z', C.ink) +
    p('M26 37h8V29h13v-7h10v9h10v9h8v23h-9v9H32v-9h-6Z', C.lilac) + eyes(35, 45, 18) + r(44, 60, 14, 4, C.cream) + r(10, 45, 12, 4, C.lilac) + r(77, 35, 12, 4, C.lilac) + r(12, 71, 17, 4, C.lilac),
  'queue-snake': p('M18 66h40V55H35V44h31V31H48V17h31v7h9v28H73v14H61v15H18Z', C.ink) +
    p('M21 70h36V58H32V48h36V29H52v-8h25v8h6v19H69v17H58v11H21Z', C.mint) +
    r(56, 22, 19, 16, C.mint) + eyes(58, 27, 13) + r(67, 42, 17, 3, C.rose) + r(81, 39, 3, 8, C.rose) +
    [0, 1, 2].map(i => r(25 + i * 11, 67, 5, 5, C.gold)).join('') + paper(8, 32, 0.65),
  'seed-thief': hammy(19, 23, 1.8, false, C.tan, C.lilac) + r(30, 45, 47, 10, C.ink) + r(40, 48, 5, 3, C.cream) + r(61, 48, 5, 3, C.cream) +
    p('M58 61h21v8h7v15H53V68h5Z', C.brown) + seed(61, 56, 1.2) + seed(71, 65, 1),
  'fud-moth': p('M10 22h17v9h12v13h17V31h12v-9h17v35H73v14H60V59H39v12H24V57H10Z', C.ink) +
    p('M15 28h9v9h14v17H25v9h-7V52h-3Zm66 0h-9v9H59v17h13v9h7V52h2Z', C.lilac) +
    r(42, 31, 13, 42, C.oat) + r(39, 27, 19, 15, C.oat) + eyes(40, 31, 10) + r(36, 20, 4, 10, C.gold) + r(58, 20, 4, 10, C.gold) + r(20, 36, 9, 9, C.rose) + r(66, 36, 9, 9, C.rose),
  'sybil-swarm': hammy(6, 37, 0.9, false, C.pale, C.rose) + hammy(37, 12, 0.9, false, C.lilac, C.mint) + hammy(67, 37, 0.9, false, C.pale, C.gold) + hammy(25, 59, 0.8, false, C.lilac, C.mint) + hammy(53, 59, 0.8, false, C.pale, C.rose),
  'oracle-acolyte': oracle(false),
  'liquidity-leech': p('M14 64V49h12V34h13V22h26v9h14v18h-9v15H57v17H25V73H14Z', C.ink) +
    p('M20 62V52h12V37h12V28h17v9h12v9H64v15H51v14H29V67H20Z', C.blue) +
    eyes(44, 35, 15) + r(35, 65, 13, 5, C.cream) + r(32, 59, 4, 14, C.cream) + seed(10, 61, 1.3, C.gold) + r(60, 52, 7, 5, C.rose),
  'stale-sprite': ghost(C.mint),
  'oracle-judge': oracle(true),
  'difficulty-adjuster': gear(17, 14, 1.75) + r(25, 34, 48, 33, C.ink) + r(29, 38, 40, 25, C.blue) + eyes(35, 43, 20) +
    r(43, 56, 15, 3, C.ink) + r(13, 48, 12, 10, C.tan) + r(73, 48, 12, 10, C.tan) + r(29, 74, 11, 9, C.brown) + r(59, 74, 11, 9, C.brown) + bolt(76, 17, 0.65),
  'stale-ghost': ghost(C.pale, true) + r(12, 35, 11, 4, C.lilac) + r(76, 21, 11, 4, C.lilac) + r(13, 58, 6, 6, C.lilac) + r(81, 62, 7, 7, C.lilac),
  'squeektoshi': wheel(1, 3, 1.45, C.gold) + hammy(16, 25, 2, false, C.pale, C.lilac) +
    p('M29 32V14h8v8h9V10h9v12h9v-8h8v18Z', C.gold) + r(34, 54, 7, 3, C.rose) + r(60, 54, 7, 3, C.rose) +
    r(31, 60, 12, 2, C.plum) + r(59, 60, 12, 2, C.plum) + bolt(2, 43, 0.7) + bolt(80, 41, 0.7),
};

export function spriteArt(id: string): string {
  return svg(96, 96, r(17, 84, 63, 5, C.ink, 0.55) + r(27, 89, 45, 3, C.ink, 0.3) + (sprites[id] ?? sprites['dust-mite']));
}

const cageBackground = (): string => r(0, 0, 480, 192, C.deep) +
  [20, 76, 132, 188, 244, 300, 356, 412, 468].map(x => r(x, 0, 4, 159, C.plum)).join('') +
  r(0, 29, 480, 4, C.plum) + r(0, 134, 480, 4, C.plum) +
  r(0, 158, 480, 34, C.tan) + r(0, 166, 480, 26, C.brown) +
  [8, 49, 85, 125, 168, 211, 250, 292, 332, 378, 422, 459].map((x, i) => r(x, 174 + i % 3 * 5, 18, 3, C.oat)).join('') +
  star(39, 43, 0.8, C.lilac) + star(341, 19, 0.7, C.lilac) + star(451, 81, 0.6, C.lilac);
const hut = (x: number, y: number, scale = 1): string => g(x, y, scale,
  p('M0 36h9V25h12V13h15V0h22v13h15v12h12v11h9v66H0Z', C.ink) +
  p('M6 39h12V28h12V16h13V6h10v10h13v12h12v11h10v56H6Z', C.oat) +
  p('M34 95V63h6v-9h17v9h7v32Z', C.ink) + r(15, 51, 13, 16, C.brown) + r(71, 51, 10, 16, C.brown) + r(15, 70, 13, 3, C.tan));
const scenes: Record<'camp' | 'shop' | 'rest' | 'results' | 'event', string> = {
  camp: moon(407, 18, 1.6) + hut(22, 56, 1) + wheel(192, 15, 2.2, C.mint) + hammy(224, 83, 2.1) +
    p('M372 143v-8h63v8h6v12h-75v-12Z', C.ink) + r(374, 136, 59, 10, C.oat) + seed(382, 123, 1.2) + seed(401, 127, 1.1) + seed(421, 126, 1) + star(164, 40, 1.4),
  shop: r(54, 45, 372, 13, C.ink) + r(60, 57, 6, 101, C.tan) + r(413, 57, 6, 101, C.tan) +
    p('M59 42h362v36H59Z', C.oat) + [0, 1, 2, 3, 4, 5].map(i => r(61 + i * 60, 42, 30, 36, C.rose)).join('') +
    bench(61, 122, 356) + hammy(204, 72, 1.8, false, C.tan, C.gold) + cardBack(88, 89, 1) + cardBack(121, 89, 1, C.mint) +
    seed(309, 93, 1.9) + seed(341, 99, 1.5) + gear(363, 92, 0.75) + star(37, 78, 1.2) + star(439, 52, 0.9),
  rest: moon(361, 19, 1.7) + hut(35, 57, 1) + r(171, 128, 181, 24, C.lilac) + r(181, 152, 162, 9, C.plum) +
    r(179, 118, 42, 15, C.cream) + hammy(215, 79, 2.2, true, C.oat, '') + p('M220 128h112v24H220Z', C.pale) +
    r(232, 130, 13, 20, C.lilac) + r(260, 130, 13, 20, C.lilac) + r(288, 130, 13, 20, C.lilac) + sleepMark(299, 73, 1.5) + sleepMark(327, 54, 1) + sprout(402, 101, 1.3),
  results: wheel(24, 46, 1.65, C.lilac) + bench(183, 135, 129) + hammy(213, 66, 2.1) +
    p('M221 67V51h9v8h10V45h10v14h10v-8h9v16Z', C.gold) +
    r(365, 90, 44, 13, C.gold) + r(370, 103, 34, 17, C.gold) + r(380, 120, 13, 21, C.gold) + r(365, 141, 44, 10, C.gold) +
    r(354, 94, 11, 27, C.amber) + r(409, 94, 11, 27, C.amber) + star(159, 47, 1.4) + star(326, 30, 1.6) + star(435, 48, 1),
  event: hut(18, 55, 1) + paper(184, 53, 3) + bench(160, 143, 125) + hammy(321, 94, 1.9) +
    p('M332 60h44v29h-15v12l-12-12h-17Z', C.cream) + r(348, 65, 10, 4, C.plum) + r(355, 69, 4, 8, C.plum) + r(349, 78, 6, 4, C.plum) +
    star(143, 31, 1) + star(286, 73, 1.2) + seed(403, 141, 1.2),
};

export function sceneArt(scene: 'camp' | 'shop' | 'rest' | 'results' | 'event'): string {
  return svg(480, 192, cageBackground() + scenes[scene]);
}

/** Compact room symbols use the same silhouettes as the full illustrations. */
export function nodeIcon(kind: string): string {
  const icons: Record<string, string> = {
    battle: p('M4 2h5v5h4v4h4v4h3v5h-5v-3h-4v-4H7V9H2V4h2Z', C.cream) + r(3, 16, 5, 5, C.rose) + r(7, 12, 5, 5, C.rose),
    elite: bolt(3, 0, 0.78),
    boss: p('M2 6h4v4h4V3h4v7h4V6h4v14H2Z', C.gold) + r(4, 17, 16, 3, C.amber),
    rest: g(2, 0, 0.9, moon(0, 0, 1)),
    shop: p('M3 4h18v5h2v4h-2v9H3v-9H1V9h2Z', C.oat) + r(1, 8, 22, 5, C.rose) + r(10, 15, 5, 7, C.ink) + r(4, 15, 4, 3, C.ink),
    event: p('M5 2h14v3h3v8h-4v3h-4v3h-4v-7h6V6H8v3H3V5h2Z', C.pale) + r(10, 21, 4, 3, C.pale),
  };
  return svg(24, 24, icons[kind] ?? star(2, 2, 2));
}

const flavors: Record<string, string> = {
  'freeze-for-mint': 'Hold that thought. And that multiplier.',
  'aura-farm': 'A very respectable kind of farming.',
  'squeektoshi-sleeping': 'Shhh. The founder is mining dreams.',
  'wheely-overclock': 'The wheel never tires. The hamster does.',
  'paper-hands': 'Down two percent. Already in the bedding.',
  wagmi: 'One wheel. A whole lot of hammies.',
  ngmi: 'Every gremlin deserves a comeback arc.',
  'rug-pull': 'Please return the floor when finished.',
  'gas-war': 'Priority fee: one entire sunflower.',
  ser: 'Ser, this is a hamster cage.',
  lfg: 'Small paws. Absolutely no brakes.',
  'wen-mint': 'Soon. The extremely hamster kind of soon.',
  'ape-in': 'The wheelpaper remains unread.',
  'exit-liquidity': 'Your problem has left the chat.',
  'touch-grass': 'Even the wheel is taking a minute.',
  gsqueek: 'gsqueek, hammies.',
  'hammy-gang': 'Same cage. Same questionable sleep schedule.',
  'gud-tek': 'Tiny paws. Surprisingly sound engineering.',
  moar: 'One more lap. Then one more lap.',
  'sleep-cam': 'The most uneventful stream in the cage.',
  'spacetime-fold': 'Nobody watched. An extra lap happened.',
  'nyn-sob': 'Turning tiny tears into very large numbers.',
  'firmware-upgrade': 'Please keep your hamster connected.',
};

export function cardFlavor(id: string): string | undefined {
  return flavors[id];
}
