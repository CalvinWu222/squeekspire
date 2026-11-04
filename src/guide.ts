import type { Language } from './preferences';
import { seedArt } from './art';

const menuText = {
  start: 'Start Game', continue: 'Continue', codex: 'Card Codex', help: 'How to Play',
  settings: 'Settings', more: 'More', back: 'Back', daily: 'Daily', practice: 'Practice',
  endless: 'Endless', chooseMode: 'Choose your challenge', chooseCharacter: 'Choose your hamster',
  begin: 'Enter the spire', volume: 'Volume', speed: 'Animation speed',
  reduceEffects: 'Reduce effects', language: 'Language', seeds: 'Seeds', needMoreSeeds: 'NEED MORE SEEDS',
  leaveShop: 'Leave shop →', continueRoute: 'Continue →',
} as const;

export type MenuKey = keyof typeof menuText;
export function t(_language: Language, key: MenuKey): string { return menuText[key]; }

/** Original, deliberately stepped pixel shapes. The rotor is separate for CSS motion. */
export function wheelArt(): string {
  return `<svg class="menu-wheel-art" viewBox="0 0 600 600" fill="none" aria-hidden="true" shape-rendering="crispEdges">
    <path d="M212 490h28v54h120v-54h28v80H212z" fill="#6e593f"/>
    <path d="M180 556h240v20H180z" fill="#b99759"/>
    <g class="wheel-rotor">
      <path d="M228 44h144v20h56v28h52v52h28v56h20v144h-20v56h-28v52h-52v28h-56v20H228v-20h-56v-28h-52v-52H92v-56H72V200h20v-56h28V92h52V64h56z" fill="#292b32" stroke="#9b784b" stroke-width="12"/>
      <path d="M240 80h120v20h52v28h40v40h28v52h20v104h-20v52h-28v40h-40v28h-52v20H240v-20h-52v-28h-40v-40h-28v-52h-20V220h20v-52h28v-40h40v-28h52z" fill="#171e26" stroke="#d3ad65" stroke-width="8"/>
      <path d="M292 84h16v376h-16zM112 264h376v16H112z" fill="#6f6149"/>
      <path d="m166 140 268 268-12 12-268-268zM154 408l268-268 12 12-268 268z" fill="#6f6149"/>
      <path d="M280 252h40v40h-40z" fill="#d3ad65"/>
      <path d="M244 52h16v20h-16zM340 52h16v20h-16zM244 472h16v20h-16zM340 472h16v20h-16zM80 224h20v16H80zM80 320h20v16H80zM500 224h20v16h-20zM500 320h20v16h-20z" fill="#e9cd86"/>
    </g>
    <g class="wheel-hamster">
      <path d="M249 372h20v-20h24v20h46v-16h24v20h20v54h-20v20h-94v-20h-20z" fill="#bd8654"/>
      <path d="M269 388h20v-12h50v12h24v42h-20v20h-54v-20h-20z" fill="#f0c790"/>
      <path d="M277 356h8v16h-8zM347 360h8v16h-8z" fill="#e4a48d"/>
      <path d="M293 396h8v12h-8zM337 396h8v12h-8z" fill="#20242b"/>
      <path d="M313 410h12v8h-12z" fill="#a85158"/>
      <path d="M269 442h24v12h-24zM339 442h24v12h-24z" fill="#b27e53"/>
      <path d="M366 398h12v8h-12zM256 398h12v8h-12z" fill="#e9a284"/>
    </g>
  </svg>`;
}

export const GUIDE_PAGE_COUNT = 5;

const guidePages = [
  {
    eyebrow: 'PLAY', title: 'Small Seeds. Big moves.',
    line: 'Spend sunflower Seeds to play the cards in your paw.',
    artLabel: 'Three sunflower Seeds supply the energy to play an attack card',
  },
  {
    eyebrow: 'DEFEND', title: 'Read. Then ready your shield.',
    line: 'Read enemy intent, then gain block to absorb incoming damage.',
    artLabel: 'An enemy intends to attack for eight; a blue shield supplies eight block',
  },
  {
    eyebrow: 'RESET', title: 'Empty paw? End Turn.',
    line: 'Let enemies act, then draw fresh cards and refill your Seeds.',
    artLabel: 'The End Turn button leads to a fresh hand and three refilled Seeds',
  },
  {
    eyebrow: 'EXPLORE', title: 'Pick your path upward.',
    line: 'After a win, choose a lit route on the map.',
    artLabel: 'The hamster chooses between two lit, connected routes on the spire map',
  },
  {
    eyebrow: 'REAL HAMSTER, REAL INFLUENCE', title: 'A real run shapes the spire.',
    line: 'Captured snapshot → routes, encounters, rewards & prices; daily refresh coming soon.',
    artLabel: 'A captured hamster wheel run feeds routes, encounters, rewards, and shop prices',
  },
] as const;

function illustration(page: number, label: string): string {
  const seedShape = seedArt().replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const costSeed = seedArt(true).replace(/^<svg[^>]*>|<\/svg>$/g, '');
  const hamster = `<path d="M-30 3v-24h18v12h24v-12h18V3h10v47H-40V3z" fill="#d6a271"/><path d="M-28 15h56v35h-56z" fill="#f0d2a5"/><path d="M-18 17h5v7h-5zm31 0h5v7h-5z" fill="#212632"/><path d="M-5 29H5v5H-5z" fill="#c27e83"/><path d="M-30 52h17v7h-17zm43 0h17v7H13z" fill="#b7815c"/>`;
  const art = [
    `<g transform="translate(51 88) scale(1.35)" shape-rendering="crispEdges">${seedShape}</g><g transform="translate(80 109) scale(1.35)" shape-rendering="crispEdges">${seedShape}</g><g transform="translate(108 88) scale(1.35)" shape-rendering="crispEdges">${seedShape}</g><path d="M168 127h34m-12-12 13 12-13 12" stroke="#efc37b" stroke-width="4"/><g transform="rotate(9 269 135)"><rect x="221" y="60" width="98" height="142" rx="9" fill="#e8cf9d" stroke="#f6dfb0" stroke-width="3"/><g transform="translate(229 68) scale(.55)" shape-rendering="crispEdges">${costSeed}</g><text x="238" y="84" text-anchor="middle" fill="#fff1cb" font-size="12" font-family="monospace">1</text><path d="m252 147 36-42 11 10-36 42-16 3zM252 154l-9 11m-5-22 24 22" stroke="#514553" stroke-width="6"/><path d="M240 180h57" stroke="#af8a5b" stroke-width="4"/></g><path d="M56 215h280" stroke="#a68a5a" stroke-opacity=".4" stroke-width="2"/><circle cx="344" cy="68" r="4" fill="#c7b0e6"/><path d="M176 57v14m-7-7h14" stroke="#c7b0e6" stroke-width="3"/>`,
    `<rect x="55" y="40" width="96" height="46" rx="8" fill="#45303d" stroke="#ec9d83" stroke-width="2"/><path d="m72 69 14-16m-11 0 13 14" stroke="#ec9d83" stroke-width="3"/><text x="124" y="71" text-anchor="middle" fill="#ffd1b9" font-size="23" font-family="monospace">8</text><path d="m96 86 7 9 7-9" fill="#ec9d83"/><path d="M74 136v-23h15v13h34v-13h15v23h12v54H62v-54z" fill="#a58ebf"/><path d="M83 149h6m34 0h6" stroke="#222732" stroke-width="6"/><path d="m187 131 18 0m-8-9 9 9-9 9" stroke="#ec9d83" stroke-width="3" stroke-dasharray="3 3"/><g transform="translate(293 151)">${hamster}</g><path d="m230 116 31-13 31 13v43l-31 24-31-24z" fill="#254d72" stroke="#8ecdf5" stroke-width="4"/><text x="261" y="151" text-anchor="middle" fill="#d2efff" font-size="26" font-family="monospace">8</text><path d="M57 219h290" stroke="#849ab6" stroke-opacity=".35" stroke-width="2"/>`,
    `<rect x="42" y="104" width="126" height="49" rx="8" fill="#46395a" stroke="#c7b0e6" stroke-width="2"/><text x="105" y="134" text-anchor="middle" fill="#e9daf8" font-size="16" font-family="monospace">End Turn</text><path d="M190 129h26m-10-11 12 11-12 11" stroke="#c7b0e6" stroke-width="4"/><g transform="rotate(-12 263 124)"><rect x="244" y="77" width="58" height="85" rx="5" fill="#4c425f" stroke="#c7b0e6" stroke-width="2"/></g><rect x="263" y="81" width="58" height="85" rx="5" fill="#ead6b1" stroke="#f2dca8" stroke-width="2"/><path d="M277 110h30m-30 14h30m-30 14h20" stroke="#b38e5c" stroke-width="4"/><g transform="translate(249 189) scale(.65)" shape-rendering="crispEdges">${costSeed}</g><g transform="translate(278 189) scale(.65)" shape-rendering="crispEdges">${costSeed}</g><g transform="translate(307 189) scale(.65)" shape-rendering="crispEdges">${costSeed}</g><path d="M256 49a69 69 0 0 1 88 91m-10-14 12 16 10-17" stroke="#8595b1" stroke-width="3" stroke-dasharray="5 6"/><path d="M58 199h113" stroke="#8e7fa8" stroke-opacity=".45" stroke-width="2"/>`,
    `<path d="m200 207-76-67 76-72m0 139 76-67-76-72" stroke="#efc37b" stroke-width="4"/><path d="m124 140-57-58m209 58 57-58" stroke="#596076" stroke-width="3" stroke-dasharray="5 6"/><circle cx="67" cy="82" r="14" fill="#252f41" stroke="#6d778c" stroke-width="2"/><circle cx="333" cy="82" r="14" fill="#252f41" stroke="#6d778c" stroke-width="2"/><circle cx="124" cy="140" r="23" fill="#4f435a" stroke="#c7b0e6" stroke-width="3"/><path d="m113 145 22-18m-18 0 18 18" stroke="#e3d3f5" stroke-width="3"/><circle cx="276" cy="140" r="23" fill="#564936" stroke="#efc37b" stroke-width="3"/><path d="M264 132h24v19h-24zm4-5h16" stroke="#f5d9a7" stroke-width="3"/><circle cx="200" cy="68" r="18" fill="#2d3448" stroke="#c7b0e6" stroke-width="3"/><path d="m195 73 10-10m-10 0h10v10" stroke="#c7b0e6" stroke-width="3"/><circle cx="200" cy="207" r="15" fill="#efc37b"/><g transform="translate(200 179) scale(.55)">${hamster}</g><path d="M102 236h196" stroke="#8e7fa8" stroke-opacity=".35" stroke-width="2"/>`,
    `<rect x="43" y="48" width="152" height="161" rx="11" fill="#242e3d" stroke="#8f8ba5" stroke-width="2"/><circle cx="119" cy="116" r="49" stroke="#efc37b" stroke-width="4"/><path d="M70 116h98m-49-49v98m-35-84 70 70m-70 0 70-70" stroke="#a5875a" stroke-width="2"/><g transform="translate(119 122) scale(.6)">${hamster}</g><path d="M65 186h18l8-10 13 12 17-16 17 7 16-12h19" stroke="#c7b0e6" stroke-width="3"/><path d="M212 129h19m-10-10 11 10-11 10" stroke="#efc37b" stroke-width="3"/><rect x="248" y="52" width="49" height="58" rx="7" fill="#343047" stroke="#c7b0e6" stroke-width="2"/><path d="m260 94 12-26 12 26m-12-26v38" stroke="#c7b0e6" stroke-width="3"/><rect x="311" y="52" width="49" height="58" rx="7" fill="#45303d" stroke="#ec9d83" stroke-width="2"/><path d="m323 92 23-24m-18 0 17 24" stroke="#ec9d83" stroke-width="3"/><rect x="248" y="129" width="49" height="58" rx="7" fill="#3d3545" stroke="#c7b0e6" stroke-width="2"/><path d="M260 150h25v22h-25zm12-9v32m-16-19h33" stroke="#e0cef0" stroke-width="3"/><rect x="311" y="129" width="49" height="58" rx="7" fill="#4b4032" stroke="#efc37b" stroke-width="2"/><path d="m322 144 19 1 9 14-19 14-9-15z" stroke="#efc37b" stroke-width="3"/><circle cx="329" cy="151" r="2" fill="#efc37b"/><path d="M260 221h85" stroke="#8f8ba5" stroke-opacity=".45" stroke-width="2"/>`,
  ][page];
  return `<svg viewBox="0 0 400 260" role="img" aria-label="${label}" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="200" cy="130" r="117" fill="#c7b0e6" fill-opacity=".045"/>${art}</svg>`;
}

function detailedRules(): string {
  const sections = [
    ['Cards & turns', 'Drag an attack card onto an enemy, or click the card and then its target. Click a skill or power to play it. Sunflower Seeds are your card energy: your base supply is 3 Seeds per turn. The bottom-left seed shows your supply; the small seed on a card shows its cost.', 'Blue block absorbs incoming damage for this turn. Read the intent above each enemy. When ready, choose End Turn: enemies act, then you draw a fresh hand and refill Seeds.'],
    ['Routes & real run data', 'Your first battle starts immediately after character selection. After winning, climb upward on the map and choose the next encounter along a lit connection. Everyone in the daily challenge shares the same seed and route.', 'The game uses a captured real hamster run snapshot: 24 hours of settled activity, rest, and wheel movement, together with the challenge date, shape routes, encounters, rewards, and shop prices. Daily refresh coming soon. This snapshot is not live or automatically replaced by last night’s run.'],
    ['Chains & scoring', 'At settlement, Squeeks × Mult becomes your battle score. The first card sets a type at 0 Chain. Matching that type builds a ×1.1 chain, capped at 20. Changing type resets it to 0; End Turn resets the count and type. Enemy damage does not break it. Wheel Brake keeps the count and type only while playing that card.', 'Gold Zoomies hours double multiplicative triggers. Freeze for Mint saves your pre-play scoring bonus for the battle; your live Chain can still reset. Open the Zoomie Chain rules in battle for card exceptions. Score does not multiply the damage you deal to an enemy. Staying alive keeps the points coming.'],
    ['Modes & records', 'Daily: one official attempt each UTC day, resetting at 00:00 UTC. This resets the attempt allowance, not the captured data snapshot. Starting the run uses your attempt, even if you abandon it.', 'Practice: unlimited attempts. Endless: a five-minute challenge with escalating encounters. Each mode keeps its own results. The online global leaderboard shares results across players. If the API is unavailable, Offline - local scores shows results saved on this device.'],
  ];
  return `<details class="guide-details"><summary>More details</summary><div class="guide-details-body">${sections.map(([title, ...paragraphs]) => `<section><h3>${title}</h3>${paragraphs.map(paragraph => `<p>${paragraph}</p>`).join('')}</section>`).join('')}</div></details>`;
}

/** Five compact tips with optional rules. Out-of-range requests clamp safely. */
export function guideMarkup(_language: Language, page: number): string {
  const index = Number.isFinite(page) ? Math.max(0, Math.min(GUIDE_PAGE_COUNT - 1, Math.trunc(page))) : 0;
  const content = guidePages[index];
  return `<article class="guide-page" data-guide-page="${index}" role="group" aria-roledescription="slide" aria-label="Tip ${index + 1} / ${GUIDE_PAGE_COUNT}">
    <div class="guide-art">${illustration(index, content.artLabel)}</div>
    <div class="guide-copy"><span class="eyebrow">${content.eyebrow} · 0${index + 1} / 05</span><h2 tabindex="-1">${content.title}</h2><p>${content.line}</p></div>
    <nav class="guide-nav" aria-label="How to Play tips">
      <button data-action="guide-page" data-page="${Math.max(0, index - 1)}" aria-label="Previous tip" ${index === 0 ? 'disabled' : ''}><span aria-hidden="true">←</span> Prev</button>
      <div class="guide-dots">${Array.from({ length: GUIDE_PAGE_COUNT }, (_, number) => `<button data-action="guide-page" data-page="${number}" class="guide-dot ${number === index ? 'active' : ''}" aria-label="Tip ${number + 1}: ${guidePages[number].title}" ${number === index ? 'aria-current="page"' : ''}><span aria-hidden="true">${number + 1}</span></button>`).join('')}</div>
      <button data-action="guide-page" data-page="${Math.min(GUIDE_PAGE_COUNT - 1, index + 1)}" aria-label="Next tip" ${index === GUIDE_PAGE_COUNT - 1 ? 'disabled' : ''}>Next <span aria-hidden="true">→</span></button>
    </nav>
  </article><p class="guide-gesture" aria-hidden="true">Swipe or use ← → to explore</p>${detailedRules()}`;
}
