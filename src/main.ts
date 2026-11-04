import './style.css';
import './hand-readability.css';
import './shop-balance.css';
import './intent-queue.css';
import { fallbackDay, loadDay, getGameDay, getDailyResetTime } from './game/data';
import { generateMap } from './game/map';
import { act, createRun, effectiveMult, exportRun, formatNumber, replayRun, scoreBattle, revealedIntents, oracleDrawOptions,
  type RunAction, type RunState, type CardInstance } from './game/engine';
import { CARDS, RELICS, ENEMIES, type CardType, type Rarity } from './game/catalog';
import { relicHowToGet } from './game/relicSources';
import { getCardPresentation, isCardUpgradable, cardPlayDisabledReason, mergeCandidates } from './game/cardValues';
import { battleScoreBreakdown, runScoreSummary, BOSS_POINTS, CLEAR_BONUS, ELITE_POINTS, FLOOR_POINTS, NON_CLEAR_CEILING, BATTLE_CAPS, BATTLE_TURN_LIMITS } from './game/score';
import { cardArt, cardFlavor, nodeIcon, sceneArt, seedArt, spriteArt } from './art';
import { claimDaily, currentStreak, dailyUsed, getBoard, getProfile, hasPersistentStorage,
  loadActive, recordResult, saveActive, startEndlessClock, endlessElapsed } from './game/storage';
import type { DayData, RunMode } from './game/types';
import { loadPreferences, savePreferences, motionDuration, type Preferences } from './preferences';
import { GUIDE_PAGE_COUNT, guideMarkup, t, wheelArt } from './guide';
import { WalletController, SEPOLIA_CHAIN_ID, isWalletAddress, shortenAddress, type Eip1193Provider } from './wallet';
import { fetchLeaderboard, submitScore, type GlobalEntry } from './leaderboard';

const root = document.querySelector<HTMLDivElement>('#app')!;
let day: DayData;
let profile = '';
let guestProfile = '';
const wallet = new WalletController(() => (window as Window & { ethereum?: Eip1193Provider }).ethereum);
let mode: RunMode = 'daily';
let boardMode: RunMode = 'daily';
let boardStatus: 'loading' | 'online' | 'offline' = 'loading';
let globalRows: GlobalEntry[] = [];
let boardRequest = 0;
let scoreStatus = '';
const submittedRuns = new Set<string>();
let run: RunState | null = null;
let screen: 'camp' | 'modes' | 'characters' | 'run' = 'camp';
let modal: 'help' | 'collection' | 'deck' | 'settings' | 'more' | 'pile' | 'card-preview' | 'card-choice' | 'merge' | 'relic' | null = null;
let pendingPlay: { uid: string; target: number; choice?: number; mergePair?: [string, string] } | null = null;
let inspectedRelic = '';
let restUpgradeUid = '';
let settings = loadPreferences();
let guidePage = 0;
let guideDetailsOpen = false;
let guideGesture: { pointerId: number; x: number; y: number; page: number } | null = null;
let selectedCard = '';
let draggingCard = '';
let pile: 'draw' | 'discard' = 'draw';
type ActorEffect = { kind: string; damage?: number; block?: number; dead?: boolean; delay?: number };
let sceneEffect: { player?: ActorEffect; enemies: Record<string, ActorEffect>; until: number } | null = null;
let pendingBattle: RunState | null = null;
let collectionTab: 'cards' | 'relics' | 'enemies' = 'cards';
let galleryType: CardType | 'all' = 'all';
let galleryRarity: Rarity | 'all' = 'all';
let gallerySearch = '';
let modalOpener = 'collection';
let modalOpenerPile: string | null = null;
let toast = '';
let toastTimer = 0;
let target = 0;
let audioContext: AudioContext | null = null;
let burstUntil = 0;
let burstScore = 0;
let playEffect: { markup: string; until: number } | null = null;
let scorePop: { value: number; until: number } | null = null;
let effectTimer = 0;
let effectRenderDeferred = false;
let runViewVersion = 0;
let renderedScene = '';

const esc = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const fmt = formatNumber;
const fmtPoints = (value: number): string => value.toLocaleString('en-US', { maximumFractionDigits: 0 });
const titleCase = (s: string) => s[0].toUpperCase() + s.slice(1);
const done = () => run && ['won', 'lost'].includes(run.phase);

function notify(message: string): void {
  toast = message;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast = ''; render(); }, 5500);
  render();
}

function text(key: Parameters<typeof t>[1]): string { return t(settings.language, key); }
function relicIcon(id: string): string {
  const paths: Record<string, string> = {
    'midnight-wheel': '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M6 6l12 12M6 18 18 6"/>',
    wheely9000: '<path d="m9 2 6 0 1 4 4 2 2 5-4 3-1 5H7l-1-5-4-3 2-5 4-2Z"/><circle cx="12" cy="12" r="4"/>',
    genesis: '<path d="M12 21C1 15 5 3 12 2c7 1 11 13 0 19ZM12 7v14m0-8 4-4"/>',
    'live-camera': '<rect x="2" y="6" width="14" height="13" rx="2"/><path d="m16 10 6-4v13l-6-4"/><circle cx="9" cy="12" r="3"/>',
    aura: '<ellipse cx="12" cy="8" rx="10" ry="4"/><path d="M6 14v5m6-6v9m6-8v5"/>',
    'name-tag': '<path d="M3 3h9l10 10-9 9L3 12Z"/><circle cx="8" cy="8" r="2"/>',
    wheelpaper: '<path d="M5 2h14v20l-4-3-3 3-3-3-4 3Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    pillhead: '<path d="M5 19a6 6 0 0 1 0-8l6-6a6 6 0 0 1 8 8l-6 6a6 6 0 0 1-8 0ZM8 8l8 8"/>',
    'diamond-hands': '<path d="m2 8 5-5h10l5 5-10 14ZM2 8h20M7 3l5 19 5-19"/>',
    'airdrop-farmer': '<path d="M2 10a10 10 0 0 1 20 0H2Zm0 0 6 7m14-7-6 7M12 2v15"/><rect x="8" y="17" width="8" height="5"/>',
    'probably-nothing': '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 3-3 2-3 5m0 3v1"/>',
    'stay-squeeky': '<path d="M4 18V6l6 5 4-5 6 5v7Z"/><path d="m7 21 3-3m7 3-3-3"/>',
    'sunflower-wheel': '<circle cx="12" cy="12" r="4"/><path d="m12 1 2 6 5-3-2 6 6 2-6 2 2 6-5-3-2 6-2-6-5 3 2-6-6-2 6-2-2-6 5 3Z"/>',
    hamsterfi: '<path d="m2 10 10-8 10 8ZM4 10v10m5-10v10m6-10v10m5-10v10M2 22h20"/>',
    'early-buildooooor': '<path d="M3 18h18M5 18v-6a7 7 0 0 1 14 0v6M10 5v8m4-8v8M2 21h20"/>',
  };
  return `<svg class="relic-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">${paths[id] ?? '<circle cx="12" cy="12" r="8"/>'}</svg>`;
}
function icon(name: 'attack' | 'block' | 'cast' | 'heart' | 'coin' | 'deck'): string {
  const paths = {
    attack: '<path d="m5 3 13 13-2 2L3 5V3h2Zm5 11-5 5m-2-4 6 6M4 20l-1 1"/>',
    block: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="M12 7v10"/>',
    cast: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
    heart: '<path d="M12 20 3 11C-2 3 8 0 12 7 16 0 26 3 21 11l-9 9Z"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14 7h-4v5h4v5h-4m2-12v14"/>',
    deck: '<rect x="7" y="3" width="13" height="17" rx="2"/><path d="M3 7v15h13m-2-15v9m-3-5 3-4 3 4"/>',
  };
  return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${paths[name]}</svg>`;
}

function header(): string {
  if (screen !== 'run' || !run) return '';
  return `<header class="topbar"><button class="brand" data-action="home" aria-label="Squeekspire home"><span class="brand-mark">${spriteArt('zoomie-gremlin')}</span><span class="brand-name">squeekspire<span class="brand-period">.</span></span></button><div class="run-topstats"><span class="top-hp" title="Health">${icon('heart')} <strong>${run.hp}</strong><small>/${run.maxHp}</small></span><span title="Gold">${icon('coin')} <strong>${run.gold}</strong></span><span class="top-relics" aria-label="Relics">${run.relics.map(id => `<button class="top-relic" data-action="relic" data-id="${esc(id)}" aria-label="${esc(RELICS[id]?.name)}: ${esc(RELICS[id]?.text)}" title="${esc(RELICS[id]?.name)}">${relicIcon(id)}<span class="relic-tooltip">${esc(RELICS[id]?.name)}<small>${esc(RELICS[id]?.text)}</small></span></button>`).join('')}</span><button class="ghost-button" data-action="deck">${icon('deck')} ${run.deck.length}<span class="stat-word"> Deck</span></button></div><nav class="topnav" aria-label="Run navigation"><button class="ghost-button" data-action="collection">${text('codex')}</button><button class="ghost-button" data-action="help" aria-label="${text('help')}">?</button><button class="ghost-button" data-action="settings" aria-label="${text('settings')}">⚙</button><button class="ghost-button" data-action="more" aria-label="${text('more')}">•••</button></nav></header>`;
}

function playerName(identity: string): string {
  return isWalletAddress(identity) ? shortenAddress(identity) : identity;
}

function walletMarkup(location: 'menu' | 'board'): string {
  const { address, chainId, pending, message } = wallet.state;
  return `<section class="wallet-panel wallet-${location}" aria-label="Player wallet"><div class="wallet-identity"><span>PLAYING AS</span><strong>${esc(playerName(profile))}</strong>${address ? `<small class="wallet-network">${chainId === SEPOLIA_CHAIN_ID ? 'Sepolia' : 'Sepolia available'}</small>` : ''}</div><div class="wallet-actions">${address ? `<button class="secondary-button" data-action="wallet-disconnect">Disconnect</button>${chainId !== SEPOLIA_CHAIN_ID ? `<button class="secondary-button" data-action="wallet-switch" ${pending ? 'disabled' : ''}>${pending ? 'Switching…' : 'Switch to Sepolia'}</button>` : ''}` : `<button class="secondary-button wallet-connect" data-action="wallet-connect" ${pending ? 'disabled' : ''}>${pending ? 'Connecting…' : 'Connect Wallet'}</button>`}</div><p class="wallet-message" role="status" aria-live="polite">${esc(message || (address ? 'Address only · No signing required.' : 'Optional · Guest play is always available.'))}</p></section>`;
}

function camp(): string {
  const saved = run && !done();
  return `<main class="title-screen"><div class="title-stars" aria-hidden="true"></div><div class="title-wheel" aria-hidden="true">${wheelArt()}</div><div class="title-content"><span class="eyebrow">A VERY SMALL HERO. A VERY TALL SPIRE.</span><h1 class="hero-title">SQUEEK<span>SPIRE</span><i>✦</i></h1><p class="title-tagline">One more card. One more floor. One less hour of sleep.</p><div class="menu-buttons"><button class="menu-button primary" data-action="start">${text('start')}<span>→</span></button>${saved ? `<button class="menu-button" data-action="resume">${text('continue')}<small>${titleCase(run!.mode)} · ${run!.phase === 'combat' ? 'Battle' : 'Hour ' + Math.max(1, run!.floor)}</small></button>` : ''}<button class="menu-button" data-action="collection">${text('codex')}</button><button class="menu-button" data-action="help">${text('help')}</button><button class="menu-button" data-action="settings">${text('settings')}</button></div>${walletMarkup('menu')}<footer class="site-footer">Unofficial fan-made game, not affiliated with Squeekchain.</footer></div><div class="title-corner"><span class="daily-label">Daily · ${esc(day.day)} UTC</span><span>Resets 00:00 UTC · <span data-daily-countdown>${dailyCountdown()}</span></span><span>TODAY’S SEED <code>${day.seed.toString(16).padStart(8, '0').toUpperCase()}</code></span><span><i class="live-dot ${day.spinning ? 'spinning' : ''}"></i>${day.spinning ? 'HAMSTER: SPINNING' : 'HAMSTER: RESTING'} ${day.hibernation ? ' · Hibernation ×1.2' : ''}</span></div><button class="ghost-button menu-more" data-action="more">${text('more')} <span>•••</span></button><span class="title-version">THE MIDNIGHT WHEEL / v0.2</span></main>`;
}

function modeSelect(): string {
  const descriptions = ['One shared seed. One official attempt. Make it count.', 'Unlimited runs. Find your rhythm and build a better deck.', 'Five minutes. Stronger rooms. Chase your biggest score.'];
  return `<main class="selection-screen"><button class="ghost-button selection-back" data-action="home">← ${text('back')}</button><div class="selection-heading"><span class="eyebrow">01 / YOUR KIND OF NIGHT</span><h1>${text('chooseMode')}</h1><p class="muted">Every great climb starts with a little courage.</p></div><div class="mode-grid">${(['daily', 'practice', 'endless'] as RunMode[]).map((m, i) => {
    const saved = loadActive(m); const resumable = saved && saved.day.day === day.day && !['won', 'lost'].includes(saved.phase);
    const used = m === 'daily' && dailyUsed(day.day) && !resumable;
    return `<button class="mode-choice ${used ? 'locked' : ''}" data-action="mode" data-mode="${m}" ${used ? 'disabled' : ''}><span class="mode-index">0${i + 1}</span><span class="mode-art" aria-hidden="true">${nodeIcon(m === 'daily' ? 'boss' : m === 'practice' ? 'rest' : 'elite')}</span><h2>${text(m)}</h2><p>${descriptions[i]}</p><span class="mode-detail">${m === 'daily' ? `${used ? 'Daily attempt used · ' : ''}RESETS 00:00 UTC · <span data-daily-countdown>${dailyCountdown()}</span>` : m === 'practice' ? 'NO DAILY ATTEMPT USED' : '5:00 · ×1.15 PER ROOM'}</span><span class="mode-arrow">→</span></button>`;
  }).join('')}</div><p class="selection-note">Daily · ${esc(day.day)} UTC · ${day.hibernation ? 'Hibernation · ×1.2' : 'The midnight wheel'}</p></main>`;
}

function characterSelect(): string {
  return `<main class="selection-screen character-screen"><button class="ghost-button selection-back" data-action="start">← ${text('back')}</button><div class="selection-heading"><span class="eyebrow">02 / ${text(mode).toUpperCase()}</span><h1>${text('chooseCharacter')}</h1><p class="muted">Meet the night crew. Sleep is somebody else’s problem.</p></div><div class="character-grid"><article class="character-choice selected"><span class="chip">SELECTED</span><div class="character-art" aria-hidden="true">${spriteArt('zoomie-gremlin')}</div><div class="character-info"><span class="eyebrow">THE ONE WITH THE ZOOMIES</span><h2>Zoomie Gremlin</h2><p>“gm, I have not slept”</p><div class="character-stats"><span>72 <small>HP</small></span><span>3 <small>${text('seeds')}</small></span><span>10 <small>CARDS</small></span></div><p class="muted">Chain the same card type. Build your multiplier. Make the numbers squeek.</p><div class="starter-relic">${nodeIcon('rest')}<div><strong>Midnight Wheel</strong><p>First turn: +1 Mult.</p></div></div></div></article>${['Seed Hoarder', 'Professional Napper'].map((name, i) => `<button class="character-choice locked" disabled aria-label="${name}, locked"><span class="chip">LOCKED</span><div class="character-art silhouette silhouette-${i}" aria-hidden="true">${spriteArt('zoomie-gremlin')}</div><div class="character-info"><span class="lock-mark">◇</span><h2>${name}</h2><p class="muted">Still dreaming. Coming in a future chapter.</p></div></button>`).join('')}</div><button class="start-button character-begin" data-action="begin">${text('begin')} <span>→</span></button><p class="selection-note">${mode === 'daily' ? `Daily · ${esc(day.day)} UTC · Beginning uses today’s official attempt, including abandonment.` : 'Your daily attempt stays available.'}</p></main>`;
}

function mapMarkup(): string {
  if (!run) return '';
  const nodes = run.map, current = run.currentNode;
  const fog = run.day.hibernation && !run.relics.includes('wheelpaper');
  const position = (id: number) => ({ x: 300 + Math.sin(id * 1.2) * 145, y: 1630 - id * 68 });
  const entered = run.log.filter(a => a.type === 'enter').map(a => a.nodeId);
  const visited = new Set(entered), edges = new Set(entered.slice(1).map((id, i) => `${entered[i]}:${id}`));
  const paths = nodes.flatMap(n => n.connections.map(id => {
    const a = position(n.id), b = position(id);
    return `<path class="map-path ${id - n.id > 1 ? 'fork' : ''} ${run!.reachable.includes(id) && n.id === current ? 'available' : ''} ${edges.has(`${n.id}:${id}`) ? 'visited' : ''}" data-from="${n.id}" data-to="${id}" d="M${a.x},${a.y} C${a.x},${(a.y + b.y) / 2} ${b.x},${(a.y + b.y) / 2} ${b.x},${b.y}"/>`;
  })).join('');
  return `<section class="panel map-panel ${fog ? 'fog' : ''}"><div class="map-header"><div><span class="eyebrow">THE ONLY WAY IS UP</span><h1>The midnight climb.</h1><p class="muted">Choose a lit room. Every little step gets you closer to dawn.</p></div><div class="map-heading-meta">${coinBalance('map')}<span class="chip">${run.day.hibernation ? 'Hibernation · ×1.2' : '24 HOURS / 3 ACTS'}</span></div></div><div class="map-legend">${['battle', 'elite', 'boss', 'rest', 'shop', 'treasure', 'event'].map(kind => `<span>${nodeIcon(kind)} ${titleCase(kind)}</span>`).join('')}<span class="gold-text">✦ Zoomies</span></div><div class="map-scroll" tabindex="0" role="region" aria-label="Route map. Climb upward; choose a highlighted room."><div class="map-grid"><svg class="map-paths" viewBox="0 0 600 1700" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>${[0, 8, 16].map((id, i) => `<span class="map-act-label" style="top:${(1630 - (id + 3) * 68) / 17}%">ACT ${i + 1}<small>${['BEDDING BURROWS', 'CAGE AFTER DARK', 'MIDNIGHT WHEEL'][i]}</small></span>`).join('')}${nodes.map(n => {
    const pos = position(n.id), reachable = run!.phase === 'map' && run!.reachable.includes(n.id);
    return `<button class="map-node ${n.kind} ${n.jackpot ? 'jackpot' : ''} ${current === n.id ? 'current' : ''} ${visited.has(n.id) ? 'completed' : ''} ${reachable ? 'reachable' : 'locked'}" style="left:${pos.x / 6}%;top:${pos.y / 17}%" data-action="node" data-id="${n.id}" ${!reachable ? 'disabled' : ''} ${current === n.id ? 'aria-current="step"' : ''} aria-label="Hour ${n.id + 1}, ${n.kind}${n.jackpot ? ', Zoomies jackpot' : ''}${visited.has(n.id) ? ', visited' : ''}${reachable ? ', reachable' : ''}" title="Hour ${n.id + 1}: ${n.kind}, ${n.work} work"><span class="node-number">${String(n.id + 1).padStart(2, '0')}</span><span class="node-icon">${nodeIcon(n.kind)}</span><span class="node-label">${n.jackpot ? 'ZOOMIES' : titleCase(n.kind)}</span>${visited.has(n.id) ? '<span class="node-check">✓</span>' : ''}</button>`;
  }).join('')}</div></div><p class="route-note muted">${fog ? 'Dream mist fills the cage. ' : ''}Forks can skip one hour. Every act gate is mandatory. ↑ Climb toward dawn.</p></section>`;
}

async function refreshLeaderboard(): Promise<void> {
  const request = ++boardRequest;
  boardStatus = 'loading'; globalRows = [];
  if (root.isConnected) render();
  try {
    const rows = await fetchLeaderboard(boardMode, day.seed);
    if (request !== boardRequest) return;
    globalRows = rows; boardStatus = 'online';
  } catch {
    if (request !== boardRequest) return;
    boardStatus = 'offline';
  }
  if (root.isConnected) render();
}

function finishRun(finished: RunState): void {
  recordResult(finished, profile);
  const identity = profile;
  const key = `${identity}:${exportRun(finished).checksum}`;
  if (submittedRuns.has(key)) return;
  submittedRuns.add(key);
  scoreStatus = 'Saved on this device. Submitting for server replay verification…';
  void submitScore(finished, identity).then(() => {
    if (run === finished) scoreStatus = 'Score submitted · Server replay verified.';
    if (modal === 'more') return refreshLeaderboard();
  }).catch(() => {
    submittedRuns.delete(key);
    if (run === finished) scoreStatus = 'Global submission unavailable. Score saved on this device.';
  }).finally(() => { if (root.isConnected) render(); });
}

function leaderboard(): string {
  const rows = boardStatus === 'online' ? globalRows : getBoard(boardMode, boardMode === 'endless' ? undefined : day.day);
  return `<section class="panel leaderboard"><div class="panel-heading"><div><span class="eyebrow">THE SQUEEK SHEET</span><h2>${boardStatus === 'online' ? 'Global leaderboard' : boardStatus === 'offline' ? 'Offline - local scores' : 'Leaderboard'}</h2></div><span class="chip">${currentStreak(day.day)} DAY STREAK</span></div>${walletMarkup('board')}<div class="board-tabs">${(['daily', 'practice', 'endless'] as RunMode[]).map(m => `<button class="mode-tab ${boardMode === m ? 'active' : ''}" data-action="board" data-mode="${m}">${titleCase(m)}</button>`).join('')}</div><p class="muted board-caption">${boardMode === 'endless' ? 'All days · Ranked by total score' : `${titleCase(boardMode)} · ${esc(day.day)} UTC · Ranked by total score`}</p>${rows.length ? rows.slice(0, 8).map((r, i) => `<div class="leaderboard-row ${r.profile.toLowerCase() === profile.toLowerCase() ? 'you' : ''}"><span class="board-rank">${String(i + 1).padStart(2, '0')}</span><div class="board-id">${esc(playerName(r.profile))}${r.profile.toLowerCase() === profile.toLowerCase() ? '<small> YOU</small>' : ''}<span>${r.won ? 'Cleared' : 'Hour ' + r.floor}${r.hibernation ? ' · ☾' : ''}${r.streak ? ' · ' + r.streak + 'd' : ''}</span></div><strong class="board-score">${fmtPoints(r.score)}</strong></div>`).join('') : '<div class="board-empty"><span>♜</span><strong>A quiet spire.</strong><p>Your first finished run<br/>starts the story.</p></div>'}<div class="board-connection"><p class="board-footnote" role="status">${boardStatus === 'online' ? 'Shared scores. Server replay verified. Wallet names are unverified labels.' : boardStatus === 'offline' ? 'API unavailable. Showing scores saved on this device.' : 'Connecting to the shared leaderboard...'}</p><button class="ghost-button" data-action="board-refresh" ${boardStatus === 'loading' ? 'disabled' : ''}>Refresh</button></div></section>`;
}

function cardMarkup(id: string, instance?: CardInstance, action = 'play', index?: number): string {
  const c = CARDS[id];
  if (!c) return '';
  const upgraded = instance && instance.level > 0;
  const energy = run?.combat?.energy ?? 99;
  const discount = (action === 'play' || action === 'preview') && run?.combat?.powers.nocturnal && run.map[run.currentNode]?.jackpot ? 1 : 0;
  const cost = c.cost === 'X' ? 'X' : Math.max(0, c.cost - discount);
  const choiceUnavailable = action === 'choose-card' && !!instance && !!run?.combat?.hand.some(item => item.uid === pendingPlay?.uid && item.id === 'gud-tek') && !instance.level && !isCardUpgradable(instance);
  const rawReason = choiceUnavailable ? 'Cannot be upgraded' : action === 'play' && instance && run ? cardPlayDisabledReason(run, instance) : undefined;
  const reason = rawReason === 'Not enough Seeds' ? text('needMoreSeeds') : rawReason ? rawReason : undefined;
  const disabled = choiceUnavailable || (action === 'play' && (!!reason || (cost !== 'X' && energy < cost)));
  const shown = instance ?? { uid: 'preview', id, level: 0, mergeLevel: 0 };
  const live = (action === 'play' || action === 'preview') && run?.phase === 'combat' ? run : null;
  const computed = getCardPresentation(live, shown, { target: live?.combat?.enemies[target] });
  const rules = computed.parts.map(part => part.value !== undefined && part.base !== undefined && part.value !== part.base ? `<strong class="card-value ${part.value > part.base ? 'buffed' : 'reduced'}">${esc(part.text)}</strong>` : esc(part.text)).join('');
  const flavor = c.flavor ?? cardFlavor(id);
  const tag = action === 'none' || action === 'preview' ? 'article' : 'button';
  return `<${tag} class="card ${c.type} ${c.rarity} ${disabled ? 'disabled' : ''} ${action === 'none' ? 'inspectable' : ''} ${instance?.uid === selectedCard ? 'selected-card' : ''}" data-action="${action}" ${action === 'play' ? `draggable="${!disabled}" style="--fan:${((index ?? 0) - ((run?.combat?.hand.length ?? 1) - 1) / 2) * 3.8}deg;--lift:${Math.abs((index ?? 0) - ((run?.combat?.hand.length ?? 1) - 1) / 2) * 4}px" aria-pressed="${instance?.uid === selectedCard}"` : ''} ${instance ? `data-uid="${esc(instance.uid)}"` : ''} data-id="${esc(id)}" ${index !== undefined ? `data-index="${index}"` : ''} ${action === 'none' ? 'tabindex="0"' : disabled ? 'disabled' : ''} aria-label="${esc(c.name)}${upgraded ? ' upgraded' : ''}: ${esc(computed.text)}${reason ? '. ' + esc(reason) : ''}"><div class="card-top"><span class="card-type">${c.type.toUpperCase()} · ${c.rarity.toUpperCase()}</span><span class="card-cost" aria-label="${cost} ${text('seeds')}">${seedArt(true)}<span class="seed-value">${cost}</span></span></div><h3 class="card-name">${esc(c.name)}${upgraded ? ' +' : ''}${instance && instance.mergeLevel > 0 ? ` · Lv${instance.mergeLevel}` : ''}</h3><div class="card-art" aria-hidden="true">${cardArt(id)}</div><p class="card-description">${rules}</p>${reason ? `<p class="card-unavailable">${esc(reason)}</p>` : ''}${flavor ? `<p class="card-flavor">${esc(flavor)}</p>` : ''}<span class="card-bottom">${action === 'play' ? disabled ? esc(reason ?? text('needMoreSeeds')) : 'TAP TO INSPECT · DRAG TO PLAY' : action === 'pick-card' ? 'ADD TO DECK' : 'SQUEEKSPIRE'}</span></${tag}>`;
}

function effectClasses(effect?: ActorEffect): string {
  return effect ? `acting-${effect.kind} ${effect.damage ? 'hit-flash' : ''} ${effect.dead ? 'dying' : ''}` : '';
}
function floatingEffect(effect?: ActorEffect): string {
  return effect ? `${effect.damage ? `<span class="damage-float">−${effect.damage}</span>` : ''}${effect.block ? `<span class="damage-float block-float">+${effect.block} BLOCK</span>` : ''}` : '';
}

function battle(): string {
  const state = pendingBattle ?? run!;
  const c = state.combat!;
  const node = state.map[state.currentNode % 24];
  const future = revealedIntents(state);
  const golden = node?.jackpot;
  const effects = sceneEffect && Date.now() < sceneEffect.until ? sceneEffect : null;
  const pe = effects?.player;
  const selected = c.hand.find(card => card.uid === selectedCard);
  const projectedScore = battleScoreBreakdown(state, true);
  return `<section class="combat-panel ${golden ? 'golden-battle' : ''}" aria-label="Battle">
    <div class="combat-header"><div><span class="eyebrow">${text(state.mode).toUpperCase()} / HOUR ${String(state.currentNode + 1).padStart(2, '0')} / ${node?.kind.toUpperCase()} ${golden ? ' / ZOOMIES' : ''}</span><h2>${golden ? 'A golden hour for a little chaos.' : 'Trouble in the bedding.'}</h2></div><span class="chip">TURN ${c.turn}</span>${state.mode === 'endless' ? `<span id="endless-clock" class="chip">${clockText()}</span>` : ''}</div>
    <div class="battle-scoreboard"><div class="score-machine"><div class="score-cell squeeks"><span>SQUEEKS</span><strong>${fmt(c.squeeks)}</strong></div><b class="score-symbol">×</b><div class="score-cell mult"><span>MULTIPLIER</span><strong>${fmt(effectiveMult(state))}</strong></div><b class="score-symbol">=</b><div class="score-total"><span>COMBO</span><strong>${fmt(scoreBattle(state))}</strong></div>${scorePop && Date.now() < scorePop.until ? `<div class="score-pop" aria-hidden="true">+${fmt(scorePop.value)}<small>SQUEEK!</small></div>` : ''}</div><div class="chain-meter"><details class="chain-help"><summary class="eyebrow" aria-label="Zoomie Chain rules">ZOOMIE CHAIN ⓘ</summary><div class="chain-rules" role="tooltip"><p>The first card sets a type at 0 Chain. Play that type again: +1, up to 20. Change type: reset to 0 and match the new type. Each link gives ×1.1 Mult (×2.2 in gold Zoomies rooms).</p><p>Ending your turn resets the count and type, even when enemies do no damage. Taking enemy damage does not break Chain.</p><p>Wheel Brake keeps the count and matched type when played; it does not carry them into the next turn. Seed Snack, Double Lap, and turn-1 gm add +1 after the normal match or reset. After WAGMI, every ordinary card adds +1 regardless of type for the rest of that turn; Wheel Brake still keeps the count unchanged.</p><p>Freeze for Mint saves your pre-play Chain bonus and full Mult as battle minimums. It does not stop the live Chain from resetting.</p></div></details><div class="chain-pips">${Array.from({ length: 20 }, (_, i) => `<i class="chain-pip ${i < c.chain ? 'active' : ''}"></i>`).join('')}</div><strong>${c.chain}<small> / 20</small></strong><span class="muted">${c.chainType ? esc(c.chainType) : 'Match card types'}</span></div></div>
    <div class="battle-scoring-note" aria-label="Combat points if won now"><span>IF WON NOW <strong>${fmtPoints(projectedScore.score)}</strong> / ${fmtPoints(projectedScore.scoreCap)} combat points</span><span class="${projectedScore.turnPenalty < 1 ? 'late-battle' : ''}">${projectedScore.turnPenalty < 1 ? `${Math.round(projectedScore.turnPenalty * 100)}% pace award` : `Full award through turn ${projectedScore.turnLimit}`} · 0 at turn ${projectedScore.turnLimit * 2}</span></div>
    <div class="combat-arena battle-stage"><div class="battle-backdrop" aria-hidden="true"><div class="cage-bars"></div><div class="arena-wheel">${wheelArt()}</div><div class="falling-seeds">${Array.from({ length: 12 }, (_, i) => `<i style="--seed:${i};left:${5 + i * 8}%"></i>`).join('')}</div><div class="bedding-ground"></div></div><span class="arena-caption">THE BEDDING BURROWS <i>✦</i> MIDNIGHT</span><div class="combatants combatant-line">
      <div class="player-combatant ${effectClasses(pe)}" data-action="player-target" aria-label="Zoomie Gremlin" style="--action-delay:${pe?.delay ?? 0}ms"><span class="combatant-tag">YOUR NIGHT CREW</span><div class="player-sprite" aria-hidden="true">${spriteArt('zoomie-gremlin')}${c.block > 0 || pe?.kind === 'defend' ? `<span class="shield-bubble">${icon('block')}</span>` : ''}${Object.values(c.powers).some(v => v > 0) || pe?.kind === 'power' ? '<span class="power-aura"></span>' : ''}</div>${floatingEffect(pe)}<strong>Zoomie Gremlin</strong><span class="enemy-hp">${state.hp} / ${state.maxHp} HP</span><div class="health-track" role="meter" aria-label="Player health" aria-valuenow="${state.hp}" aria-valuemin="0" aria-valuemax="${state.maxHp}"><div class="health-fill" style="width:${state.hp / state.maxHp * 100}%"></div></div><span class="block-label">${icon('block')} ${c.block} BLOCK</span><span class="enemy-status">${c.weak ? 'Weak ' + c.weak : ''}${c.fud ? ' · FUD' : ''}</span></div>
      <div class="enemy-row enemy-line">${c.enemies.map((enemy, i) => {
        const effect = effects?.enemies[enemy.uid];
        const intent = enemy.intent.type === 'attack' ? 'attack' : enemy.intent.type === 'block' ? 'defend' : 'cast';
        const queue = future.find(item => item.uid === enemy.uid)?.intents ?? [];
        const queueMarkup = queue.length ? `<span class="enemy-intent-queue" role="group" aria-label="Revealed intents for ${esc(enemy.name)}" aria-live="polite"><span class="intent-queue-heading">REVEALED INTENTS</span><span class="intent-queue-strip">${queue.map(({ turn, intent }) => {
          const action = intent.type === 'attack' ? `Attack ${intent.damage}${intent.times > 1 ? ` × ${intent.times}` : ''}` : intent.type === 'block' ? 'Gain 8 Block' : intent.type === 'buff' ? 'Gain 2 Strength' : intent.type === 'fud' ? 'FUD: next first card ×0.5' : 'Reject highest-cost card';
          return `<span class="queued-intent queued-${esc(intent.type)}" data-turn="${turn}" data-offset="${turn - c.turn}"><b>${turn === c.turn ? 'This turn' : `Turn +${turn - c.turn}`}</b><small>Turn ${turn}</small><strong>${esc(action)}</strong></span>`;
        }).join('')}</span></span>` : '';
        return `<button class="enemy-card ${i === target ? 'targeted' : ''} ${selected ? 'awaiting-target' : ''} ${enemy.hp <= 0 ? 'defeated' : ''} ${effectClasses(effect)}" data-action="target" data-index="${i}" data-enemy="${esc(enemy.uid)}" aria-pressed="${i === target}" aria-label="Target ${esc(enemy.name)}, ${enemy.hp} HP. Intent: ${esc(enemy.intent.label)}" ${enemy.hp <= 0 ? 'disabled' : ''} style="--action-delay:${effect?.delay ?? 0}ms">${queueMarkup}<span class="intent intent-${intent}" title="${esc(enemy.intent.label)}">${icon(intent === 'defend' ? 'block' : intent)}<strong>${intent === 'attack' ? enemy.intent.damage + (enemy.intent.times > 1 ? ' ×' + enemy.intent.times : '') : intent === 'defend' ? '8' : esc(enemy.intent.label)}</strong><small>${intent === 'attack' ? 'ATTACK' : intent === 'defend' ? 'DEFEND' : 'CAST'}</small></span><span class="enemy-sprite enemy-art ${esc(enemy.id)}" aria-hidden="true">${spriteArt(enemy.id)}${enemy.block > 0 ? `<span class="enemy-shield">${icon('block')}</span>` : ''}</span>${floatingEffect(effect)}<strong class="enemy-name">${esc(enemy.name)}</strong><span class="enemy-hp">${enemy.hp} / ${enemy.maxHp} HP</span><span class="health-track"><span class="health-fill" style="width:${Math.max(0, enemy.hp) / enemy.maxHp * 100}%"></span></span>${enemy.block ? `<span class="block-label">${icon('block')} ${enemy.block} BLOCK</span>` : ''}<span class="enemy-status">${enemy.vulnerable ? 'Vulnerable ' + enemy.vulnerable + ' ' : ''}${enemy.weak ? 'Weak ' + enemy.weak : ''}${enemy.fud ? ' · FUD ×0.5 next attack' : ''}</span><span class="target-label">${enemy.hp <= 0 ? 'DEFEATED' : selected ? 'CLICK TO ATTACK' : '⌖ TARGET'}</span></button>`;
      }).join('')}</div>
    </div><div class="stage-caption" role="status">${pendingBattle ? state.hp <= 0 ? 'The wheel grows quiet…' : 'Victory! A little stronger.' : selected ? `${esc(CARDS[selected.id].name)} ready. Choose an enemy, or press Escape to cancel.` : 'Drag a card onto an enemy · or click a card, then its target'}</div></div>
    <div class="battle-controls"><div class="energy-display" aria-label="${c.energy} ${text('seeds')}"><strong>${seedArt()}<b class="seed-count">${c.energy}</b></strong><span>${text('seeds')}</span></div><div class="hand" aria-label="Your hand">${c.hand.length ? c.hand.map((card, i) => cardMarkup(card.id, card, 'play', i)).join('') : '<div class="empty-hand">Empty paws.<br/>End your turn to draw again.</div>'}</div><div class="piles"><button class="pile draw-pile" data-action="pile" data-pile="draw" aria-label="Draw pile, ${c.draw.length} cards">${icon('deck')}<strong>${c.draw.length}</strong><span>DRAW</span></button><button class="pile discard-pile" data-action="pile" data-pile="discard" aria-label="Discard pile, ${c.discard.length} cards">${icon('deck')}<strong>${c.discard.length}</strong><span>DISCARD</span></button><small>${c.exhaust.length} EXHAUSTED</small></div><button class="primary-button end-turn" data-action="end-turn" ${pendingBattle ? 'disabled' : ''}>End Turn <span>↵</span></button></div>${state.hints.length ? `<div class="hint">✦ ${esc(state.hints.at(-1))}</div>` : ''}<details class="combat-log"><summary>Battle log</summary>${state.history.slice(-5).map(s => `<p>${esc(s)}</p>`).join('')}</details></section>`;
}

function reward(): string {
  const treasure = run!.map[run!.currentNode % 24]?.kind === 'treasure';
  return `<section class="panel encounter-panel"><span class="eyebrow">${treasure ? 'TREASURE ROOM' : 'HOUR SETTLED'}</span><h1>A little stronger.<br/><em>A little squeekier.</em></h1><p class="muted">${treasure ? run!.reward?.relic ? 'Your relic is already added to this run.' : 'You already own every relic. Your collection is complete.' : 'Choose one card for your deck, or keep your deck lean.'}</p>${run!.reward?.relic ? `<div class="hint">✦ Relic found: ${esc(RELICS[run!.reward.relic]?.name ?? run!.reward.relic)}</div><p class="muted">${esc(RELICS[run!.reward.relic]?.text)}</p>` : ''}<div class="reward-grid">${run!.reward?.cards.map(id => cardMarkup(id, undefined, 'pick-card')).join('')}</div><button class="secondary-button" data-action="skip-reward">${treasure ? 'Continue' : 'Skip card reward'} →</button></section>`;
}

function encounterContinue(shop = false, fullWidth = false): string {
  return `<button class="primary-button encounter-continue ${fullWidth ? 'full-width' : ''}" data-action="leave">${text(shop ? 'leaveShop' : 'continueRoute')}</button>`;
}

function encounterFooter(shop = false): string {
  return `<footer class="encounter-footer ${shop ? 'shop-footer' : ''}">${shop ? coinBalance('shop-footer') : ''}${encounterContinue(shop, true)}</footer>`;
}

function coinBalance(location: 'shop-top' | 'shop-footer' | 'map' | 'rest'): string {
  return `<div class="screen-coins" data-coin-balance="${location}" role="status" aria-live="polite" aria-atomic="true">${icon('coin')}<span><small>YOUR COINS</small><strong>${fmt(run!.gold)} <span>SQK</span></strong></span></div>`;
}

function shop(): string {
  const s = run!, shop = s.shop!, cannotRemove = s.gold < shop.removePrice || s.deck.length <= 1;
  return `<section class="panel encounter-panel encounter-navigation shop-scene"><div class="encounter-vignette" aria-hidden="true">${sceneArt('shop')}</div><div class="encounter-header"><div><span class="eyebrow">THE SEED EXCHANGE</span><h1>Small paws.<br/><em>Big purchases.</em></h1></div>${encounterContinue(true)}</div><div class="shop-wallet-row">${coinBalance('shop-top')}<p class="muted">In-game SQK coins · Prices reflect settled mint volume.</p></div><div class="shop-grid">${shop.offers.map((offer, i) => {
    const unaffordable = !offer.sold && s.gold < offer.price;
    return `<div class="shop-item ${unaffordable ? 'unaffordable' : ''} ${offer.sold ? 'sold' : ''}">${offer.kind === 'card' ? cardMarkup(offer.id, undefined, 'none') : `<div class="relic-shop-art">${relicIcon(offer.id)}</div><h3>${esc(RELICS[offer.id]?.name ?? offer.id)}</h3><p>${esc(RELICS[offer.id]?.text ?? '')}</p>`}<button class="primary-button full-width" data-action="buy" data-index="${i}" ${offer.sold || unaffordable ? 'disabled' : ''}>${offer.sold ? 'Sold · ' : ''}<span class="shop-price ${unaffordable ? 'unaffordable-price' : ''}">${offer.price} coins</span>${unaffordable ? '<small class="shop-affordability">Not enough coins</small>' : ''}</button></div>`;
  }).join('')}</div><div class="shop-remove ${s.gold < shop.removePrice ? 'unaffordable' : ''}"><h3>Make a little room</h3><p class="muted">Remove a card for <span class="shop-price ${s.gold < shop.removePrice ? 'unaffordable-price' : ''}">${shop.removePrice} coins</span>. The next removal costs 25 more.</p><select id="remove-card" aria-label="Card to remove" ${cannotRemove ? 'disabled' : ''}>${s.deck.map(c => `<option value="${esc(c.uid)}">${esc(CARDS[c.id]?.name)}${c.level ? ' +' : ''}</option>`).join('')}</select><button class="secondary-button" data-action="remove" ${cannotRemove ? 'disabled' : ''}>Remove card · <span class="shop-price ${s.gold < shop.removePrice ? 'unaffordable-price' : ''}">${shop.removePrice} coins</span></button>${s.deck.length <= 1 ? '<p class="muted">Keep at least one card in your deck.</p>' : ''}</div>${encounterFooter(true)}</section>`;
}

function rest(): string {
  const s = run!, eligible = s.deck.filter(isCardUpgradable);
  const chosen = eligible.find(card => card.uid === restUpgradeUid) ?? eligible[0];
  restUpgradeUid = chosen?.uid ?? '';
  const healed = Math.min(s.maxHp - s.hp, Math.round(s.maxHp * 0.3));
  return `<section class="panel encounter-panel encounter-navigation"><div class="encounter-vignette" aria-hidden="true">${sceneArt('rest')}</div><div class="encounter-header"><div><span class="eyebrow">A SLEEPY HOUR</span><h1>Even gremlins<br/><em>need a minute.</em></h1></div>${encounterContinue()}</div><div class="encounter-wallet-row">${coinBalance('rest')}</div><p class="muted">Rest to heal, or spend the quiet upgrading a card.</p><div class="rest-options"><button class="primary-button" data-action="heal">${`Seed nap · Heal ${healed}${s.hp + healed === s.maxHp ? ' (to full)' : ''} · ${s.hp} → ${s.hp + healed}/${s.maxHp} HP`}</button><div><select id="upgrade-card" aria-label="Card to upgrade" ${eligible.length ? '' : 'disabled'}>${eligible.map(c => `<option value="${esc(c.uid)}" ${c.uid === chosen?.uid ? 'selected' : ''}>${esc(CARDS[c.id]?.name)}</option>`).join('')}</select><button class="secondary-button" data-action="upgrade" ${!chosen ? 'disabled' : ''}>Tune the wheel · Upgrade</button></div></div>${chosen ? `<div class="upgrade-preview" aria-label="Upgrade preview"><div><h3>Before</h3>${cardMarkup(chosen.id, chosen, 'none')}</div><span aria-hidden="true">→</span><div><h3>After</h3>${cardMarkup(chosen.id, { ...chosen, level: 1 }, 'none')}</div></div>` : `<p class="muted">No cards with an available upgrade.</p>`}${encounterFooter()}</section>`;
}

function event(): string {
  const coins = 25 + Math.max(0, run!.map[run!.currentNode].tier) * 5;
  const s = run!, lost = Math.min(6, Math.max(0, s.hp - 1)), healed = Math.min(10, s.maxHp - s.hp);
  return `<section class="panel encounter-panel encounter-navigation"><div class="encounter-vignette" aria-hidden="true">${sceneArt('event')}</div><div class="encounter-header"><div><span class="eyebrow">A STRANGE LITTLE DETOUR</span><h1>The wheelpaper<br/><em>has a footnote.</em></h1></div>${encounterContinue()}</div><p class="muted">A scrap of paper promises a shortcut. The squeeks in the margins are suspicious.</p><div class="event-options"><button class="primary-button" data-action="event" data-index="0">${`Follow the footnote · Gain ${coins} coins (${s.gold} → ${s.gold + coins}), lose ${lost} HP (${s.hp} → ${s.hp - lost})`}</button><button class="secondary-button" data-action="event" data-index="1">${`Take it slow · Heal ${healed}${s.hp + healed === s.maxHp ? ' (to full)' : ''} (${s.hp} → ${s.hp + healed}/${s.maxHp} HP)`}<small>Gain one card from: gm, gsqueek, Sleep Cam, Squeektoshi Is Sleeping.</small></button></div>${encounterFooter()}</section>`;
}

function scoreBreakdown(): string {
  const s = run!, summary = runScoreSummary(s);
  return `<section class="score-breakdown" aria-label="Score breakdown"><h2>Every floor counts.</h2>
    <div class="score-equation" aria-label="Final score components"><span>Progression<strong>${fmtPoints(summary.progressionScore)}</strong></span><b>+</b><span>Clear bonus<strong>${fmtPoints(summary.clearBonus)}</strong></span><b>+</b><span>Combat points<strong>${fmtPoints(summary.combatScore)}</strong></span><b>=</b><span>Final score<strong>${fmtPoints(summary.totalScore)}</strong></span></div>
    <p class="muted">${summary.floorsCleared} floors completed × ${fmtPoints(FLOOR_POINTS)} + ${summary.eliteKills} elites defeated × ${fmtPoints(ELITE_POINTS)} + ${summary.bossKills} bosses defeated × ${fmtPoints(BOSS_POINTS)}. Completing the spire adds ${fmtPoints(CLEAR_BONUS)}: every clear beats every unfinished run. Entering a room alone awards no progression.</p>
    <div class="score-summary"><span>Base Squeeks<strong>${fmt(summary.baseSqueeks)}</strong></span><span>Damage taken<strong>${summary.damageTaken} HP</strong></span><span>Battle turns<strong>${summary.turns}</strong></span><span>Battles<strong>${summary.battles}</strong></span></div>
    <p class="muted">Combos keep their full Squeeks × Mult display. Combat points use square-root returns: quality = min(100%, √(Squeeks / 200) × √Mult / 10). The room cap × quality × difficulty × hibernation is capped, then reduced for late turns. Normal / elite / boss caps: ${BATTLE_CAPS.normal.toLocaleString('en-US')} / ${BATTLE_CAPS.elite.toLocaleString('en-US')} / ${BATTLE_CAPS.boss.toLocaleString('en-US')}. Defeats award 0 combat points.</p>
    <p class="muted">Finish within ${BATTLE_TURN_LIMITS.normal} / ${BATTLE_TURN_LIMITS.elite} / ${BATTLE_TURN_LIMITS.boss} turns for the full pace award. Beyond that, it falls each turn and reaches 0 at ${BATTLE_TURN_LIMITS.normal * 2} / ${BATTLE_TURN_LIMITS.elite * 2} / ${BATTLE_TURN_LIMITS.boss * 2}. Unfinished runs are capped at ${NON_CLEAR_CEILING.toLocaleString('en-US')} total points.${s.phase !== 'won' && summary.totalScore === NON_CLEAR_CEILING ? ' The ceiling reduced the combat or progression points counted above.' : ''}</p>
    <div class="score-table-scroll"><table class="score-table"><thead><tr><th>Battle / hour</th><th>Raw combo</th><th>Quality</th><th>Room cap / modifiers</th><th>Pace award</th><th>Combat points</th><th>Damage</th></tr></thead><tbody>${s.battleScores.map(b => `<tr><th scope="row">${b.number}. ${esc(b.enemyName)}<small>Hour ${b.hour + 1} · ${b.turns} turns${b.won ? '' : ' · Defeat'}</small></th><td>${fmt(b.combatScore)}<small>${fmt(b.baseSqueeks)} Squeeks × ${fmtFactor(b.multiplier)} Mult</small><small>Add ${fmtFactor(b.additiveMult)} × triggers ${fmtFactor(b.triggerMult)} × chain ${fmtFactor(b.chainMult)}${b.frozenMult ? ` · frozen ${fmtFactor(b.frozenMult)}` : ''}${b.minimumMult > 1 || b.minimumMult > b.additiveMult * b.triggerMult * b.chainMult ? ` · floor ${fmtFactor(b.minimumMult)}` : ''}</small></td><td>${fmtFactor(b.scoringQuality * 100)}%<small>√Mult ${fmtFactor(b.softMultiplier)}</small></td><td>${fmtPoints(b.scoreCap)}<small>Difficulty ×${fmtFactor(b.difficultyMult)} · Hibernation ×${fmtFactor(b.hibernationMult)}</small></td><td>${Math.round(b.turnPenalty * 100)}%<small>Full through turn ${b.turnLimit}; 0 at ${b.turnLimit * 2}</small></td><td class="battle-final-score">${fmtPoints(b.score)}</td><td>${b.damageTaken} HP</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="5">Awarded combat total</th><td>${fmtPoints(summary.combatScore)}</td><td>${summary.damageTaken} HP</td></tr><tr><th colspan="5">Progression + clear bonus + combat = final score</th><td>${fmtPoints(summary.totalScore)}</td><td></td></tr></tfoot></table></div>${s.mode === 'practice' ? `<p class="muted practice-seed-note">Practice again today to compare turns and damage on the same seeded route.</p>` : ''}</section>`;
}

function fmtFactor(value: number): string { return value > 0 && value < 0.01 ? value.toExponential(2) : value >= 10000 ? fmt(value) : String(Number(value.toFixed(2))); }

function result(): string {
  const rows = getBoard(run!.mode, run!.mode === 'endless' ? undefined : run!.day.day);
  const metric = run!.totalScore;
  const above = [...rows].reverse().find(row => row.score > metric);
  const gap = above ? above.score - metric : 0;
  const livingBoss = run!.combat?.enemies.find(e => e.hp > 0);
  return `<section class="panel run-result"><span class="eyebrow">${esc(run!.mode.toUpperCase())} RUN / REPLAY VERIFIED</span><div class="encounter-vignette result-vignette" aria-hidden="true">${sceneArt('results')}</div><div class="result-emblem">${run!.phase === 'won' ? '♛' : '☾'}</div><h1>${run!.phase === 'won' ? 'The spire squeeked.' : 'The wheel rests.'}</h1><p class="muted">${run!.phase === 'won' ? 'Twenty-four hours. One very awake gremlin.' : `You made it through ${runScoreSummary(run!).floorsCleared} completed room${runScoreSummary(run!).floorsCleared === 1 ? '' : 's'}. The next night is another chance.`}</p><div class="result-score">${fmtPoints(run!.totalScore)}<span>TOTAL SCORE</span></div><div class="overview-cards"><div class="overview-card"><strong>${fmt(run!.bestHit)}</strong><span>BIGGEST COMBO</span></div><div class="overview-card"><strong>${run!.bossKills}</strong><span>ACT GATES</span></div><div class="overview-card"><strong>×${run!.day.difficulty.toFixed(2)}</strong><span>DIFFICULTY</span></div></div>${scoreBreakdown()}<p class="online-score-status muted" role="status">${esc(scoreStatus)}</p><p class="near-miss">${gap ? `${fmtPoints(gap)} points from the next local legend.` : 'A new story for the local squeek sheet.'}${livingBoss ? ` ${esc(livingBoss.name)} had ${livingBoss.hp} HP left.` : ''}</p><div class="result-actions"><button class="primary-button" data-action="again" data-mode="practice">Run it back · Practice ↗</button><button class="secondary-button" data-action="again" data-mode="endless">Go endless</button></div></section>`;
}

function collectionMarkup(): string {
  const allCards = Object.values(CARDS);
  const query = gallerySearch.trim().toLocaleLowerCase();
  const cards = allCards.filter(c => (galleryType === 'all' || c.type === galleryType)
    && (galleryRarity === 'all' || c.rarity === galleryRarity)
    && `${c.name} ${c.text} ${c.flavor ?? cardFlavor(c.id) ?? ''}`.toLocaleLowerCase().includes(query));
  const tabs = `<div class="board-tabs" role="tablist" aria-label="Codex category">${(['cards', 'relics', 'enemies'] as const).map(t => `<button class="mode-tab ${collectionTab === t ? 'active' : ''}" role="tab" aria-selected="${collectionTab === t}" data-action="collection-tab" data-tab="${t}">${titleCase(t)} <span>${t === 'cards' ? allCards.length : t === 'relics' ? Object.keys(RELICS).length : Object.keys(ENEMIES).length}</span></button>`).join('')}</div>`;
  let entries: string;
  if (collectionTab === 'cards') {
    entries = `<div class="gallery-filters"><label class="gallery-search" for="gallery-search"><span>FIND A SMALL OBSESSION</span><input type="search" id="gallery-search" placeholder="Search cards, effects, or flavor…" maxlength="100" autocomplete="off" value="${esc(gallerySearch)}" aria-describedby="gallery-count"/></label><div class="filter-chips" role="group" aria-label="Filter cards by type"><span>TYPE</span>${(['all', 'attack', 'skill', 'power', 'curse'] as const).map(type => `<button class="filter-chip ${galleryType === type ? 'active' : ''}" data-action="filter-type" data-value="${type}" aria-pressed="${galleryType === type}">${titleCase(type)}</button>`).join('')}</div><div class="filter-chips" role="group" aria-label="Filter cards by rarity"><span>RARITY</span>${(['all', 'common', 'uncommon', 'rare'] as const).map(rarity => `<button class="filter-chip ${galleryRarity === rarity ? 'active' : ''}" data-action="filter-rarity" data-value="${rarity}" aria-pressed="${galleryRarity === rarity}">${titleCase(rarity)}</button>`).join('')}</div></div><div class="gallery-summary"><p class="gallery-count" id="gallery-count" role="status">${cards.length} / ${allCards.length} cards · Starters, finds, and little curses.</p><button class="ghost-button" data-action="reset-filters">Reset filters ↺</button></div><div class="catalog-grid">${cards.map(c => cardMarkup(c.id, undefined, 'none')).join('')}</div>${cards.length ? '' : '<div class="gallery-empty"><strong>No squeeks in this corner.</strong><p>Try another search or reset your filters.</p></div>'}`;
  } else {
    entries = `<div class="collection-list">${Object.values(collectionTab === 'relics' ? RELICS : ENEMIES).map(item => `<div class="collection-entry"><span class="${collectionTab === 'enemies' ? 'codex-sprite' : 'relic-icon'}" aria-hidden="true">${collectionTab === 'enemies' ? spriteArt(item.id) : relicIcon(item.id)}</span><div><h3>${esc(item.name)}</h3><p class="muted">${esc(item.text)}</p>${collectionTab === 'relics' ? `<p class="relic-source"><strong>How to get:</strong> ${esc(relicHowToGet(item.id))}</p>` : ''}</div></div>`).join('')}</div>`;
  }
  return `<span class="eyebrow">THE NIGHT CREW'S ENCYCLOPEDIA</span><h1>The card codex.</h1><p class="muted codex-intro">Every small trick in the cage. Big potential in every paw.</p>${tabs}${entries}`;
}

function runScreen(): string {
  if (!run) return camp();
  let content = '';
  if (run.phase === 'combat' || pendingBattle) content = battle();
  else if (run.phase === 'map') content = mapMarkup();
  else if (run.phase === 'reward') content = reward();
  else if (run.phase === 'shop') content = shop();
  else if (run.phase === 'rest') content = rest();
  else if (run.phase === 'event') content = event();
  else content = result();
  return `<div class="layout run-layout ${run.phase === 'combat' || pendingBattle ? 'in-battle' : ''}"><main class="main-panel"><p class="muted run-day">${titleCase(run.mode)} · ${esc(run.day.day)} UTC</p>${content}</main></div>`;
}

function settingsMarkup(): string {
  return `<span class="eyebrow">MAKE YOURSELF AT HOME</span><h1>${text('settings')}</h1><p class="muted">A little comfort for the climb. Changes save automatically.</p><div class="settings-grid"><label class="settings-row"><span><strong>${text('volume')}</strong><small>Soft synthesized squeeks</small></span><input data-setting="volume" aria-label="${text('volume')}" type="range" min="0" max="100" value="${settings.volume}"/><output id="volume-value">${settings.volume}%</output></label><label class="settings-row"><span><strong>${text('speed')}</strong><small>Set the pace of action animations</small></span><select data-setting="animationSpeed" aria-label="${text('speed')}">${(['slow', 'normal', 'fast'] as const).map(speed => `<option value="${speed}" ${settings.animationSpeed === speed ? 'selected' : ''}>${titleCase(speed)}</option>`).join('')}</select></label><label class="settings-row"><span><strong>${text('reduceEffects')}</strong><small>Pause ambient motion, flashes, and action effects</small></span><input data-setting="reduceEffects" type="checkbox" ${settings.reduceEffects ? 'checked' : ''}/></label></div><p class="muted settings-note">Your system’s reduced-motion preference is always respected.</p>`;
}

function playDialogMarkup(): string {
  const c = run?.combat, pending = pendingPlay;
  const card = c?.hand.find(item => item.uid === pending?.uid);
  if (!card || !pending || !run || !c) return '';
  const cancel = `<button class="secondary-button" data-action="cancel-play">Cancel · costs nothing</button>`;
  const confirm = (disabled = false) => `<button class="primary-button" data-action="confirm-play" ${disabled ? 'disabled' : ''}>Confirm & play</button>`;
  if (modal === 'card-preview') {
    const targets = CARDS[card.id].type === 'attack' || card.id === 'exit-liquidity';
    return `<span class="eyebrow">TAKE A CLOSER LOOK</span><h1>${esc(CARDS[card.id].name)}</h1><div class="large-card-preview">${cardMarkup(card.id, card, 'preview')}</div>${targets ? `<label class="preview-target-label">Target<select id="preview-target">${c.enemies.map((enemy, i) => enemy.hp > 0 ? `<option value="${i}" ${i === pending.target ? 'selected' : ''}>${esc(enemy.name)} · ${enemy.hp} HP</option>` : '').join('')}</select></label>` : ''}<div class="dialog-actions"><button class="primary-button" data-action="preview-play">Play card</button>${cancel}</div>`;
  }
  if (modal === 'merge') {
    const pairs = mergeCandidates(run);
    const chosen = pairs.find(pair => pair.pair.join(':') === pending.mergePair?.join(':')) ?? pairs[0];
    if (chosen) pending.mergePair = chosen.pair;
    return `<span class="eyebrow">TWO COPIES, ONE STRONGER CARD</span><h1>Merge preview</h1><p class="muted">These two copies leave your deck and become the result shown. Once per act.</p><label class="merge-pair-label">Choose copies<select id="merge-pair">${pairs.map((pair, i) => `<option value="${i}" ${pair.pair.join(':') === chosen?.pair.join(':') ? 'selected' : ''}>${esc(CARDS[pair.first.id].name)}${pair.first.level ? ' +' : ''} · Lv${pair.first.mergeLevel} · Deck copies ${pair.pair.map(uid => run!.deck.findIndex(item => item.uid === uid) + 1).join(' + ')}</option>`).join('')}</select></label>${chosen ? `<div class="merge-preview"><div><h3>First copy</h3>${cardMarkup(chosen.first.id, chosen.first, 'none')}</div><span aria-hidden="true">+</span><div><h3>Second copy</h3>${cardMarkup(chosen.second.id, chosen.second, 'none')}</div><span aria-hidden="true">→</span><div class="merge-result"><h3>Result</h3>${cardMarkup(chosen.result.id, chosen.result, 'none')}</div></div>` : ''}<div class="dialog-actions">${confirm(!chosen)}${cancel}</div>`;
  }
  const oracle = card.id === 'oracle-ping';
  const candidates = oracle ? oracleDrawOptions(run) : c.hand.filter(item => item.uid !== card.uid);
  const chosen = pending.choice === undefined ? undefined : candidates[pending.choice];
  let upgradedRules = '';
  if (!oracle && chosen && !chosen.level && isCardUpgradable(chosen)) {
    // Preview the same pure reducer action as confirmation, including its Seed cost and turn count.
    const projected = act(run, { type: 'play', uid: card.uid, target: c.enemies[pending.target]?.uid, choice: pending.choice });
    const upgraded = projected.combat?.hand.find(item => item.uid === chosen.uid);
    if (upgraded) upgradedRules = getCardPresentation(projected, upgraded, { target: projected.combat?.enemies[pending.target] }).text;
  }
  return `<span class="eyebrow">YOUR CHOICE, THEN CONFIRM</span><h1>${esc(CARDS[card.id].name)}</h1><p class="muted">${oracle ? 'Next draws, from left to right. Choose which card is drawn first; the others keep their order.' : 'Choose a card to upgrade for this battle. An upgraded card instead gives ×1.5 Squeeks.'}</p>${!candidates.length ? `<p class="muted">No cards in the draw pile. Oracle effects still apply.</p>` : ''}<div class="choice-grid">${candidates.map((item, i) => `<div class="choice-option ${i === pending.choice ? 'chosen' : ''}">${cardMarkup(item.id, item, 'choose-card', i)}${!oracle && !item.level && !isCardUpgradable(item) ? `<span class="choice-unavailable">Cannot be upgraded</span>` : ''}<span class="choice-position">${oracle ? `Draw ${i + 1}` : item.level ? '×1.5 Squeeks' : 'Upgrade this card'}</span></div>`).join('')}</div>${chosen ? `<div class="choice-outcome" role="status">${oracle ? `Draw first: ${CARDS[chosen.id].name}. Then: ${candidates.filter((_, i) => i !== pending.choice).map(item => CARDS[item.id].name).join(' → ') || '—'}` : chosen.level ? 'Current Squeeks ×1.5' : `<strong>After upgrade</strong><p>${esc(upgradedRules)}</p>`}</div>` : ''}<div class="dialog-actions">${confirm((candidates.length > 0 && pending.choice === undefined) || (!oracle && !!chosen && !chosen.level && !isCardUpgradable(chosen)))}${cancel}</div>`;
}

function modalMarkup(): string {
  if (!modal) return '';
  let content = '';
  if (modal === 'card-preview' || modal === 'card-choice' || modal === 'merge') content = playDialogMarkup();
  else if (modal === 'relic') content = `<div class="relic-detail-icon">${relicIcon(inspectedRelic)}</div><span class="eyebrow">YOUR RELIC</span><h1>${esc(RELICS[inspectedRelic]?.name)}</h1><p class="relic-detail-text">${esc(RELICS[inspectedRelic]?.text)}</p><p class="relic-source"><strong>How to get:</strong> ${esc(relicHowToGet(inspectedRelic))}</p>`;
  else if (modal === 'help') content = guideMarkup(settings.language, guidePage);
  else if (modal === 'settings') content = settingsMarkup();
  else if (modal === 'more') content = `<span class="eyebrow">THE LITTLE EXTRAS</span><h1>${text('more')}</h1><div class="more-actions">${run ? `<button class="secondary-button" data-action="export">Export action log ↓</button>${!done() ? '<button class="danger-button" data-action="abandon">Abandon run</button>' : ''}` : ''}<button class="secondary-button" data-action="import">Verify replay JSON ↑</button><input id="replay-input" type="file" accept=".json,application/json" hidden/></div>${leaderboard()}<p class="data-notice">${esc(day.notice)}</p><p class="muted">${day.hibernation ? 'The big sleep. Hibernation · ×1.2' : 'Follow the golden hours.'} ${esc(playerName(profile))} · One small hero among many.</p>`;
  else if (modal === 'deck') content = `<span class="eyebrow">WHAT’S IN YOUR PAWS</span><h1>Your deck <small>${run?.deck.length ?? 0}</small></h1><div class="catalog-grid">${run?.deck.map(c => cardMarkup(c.id, c, 'none')).join('')}</div>`;
  else if (modal === 'pile') {
    // Draw order is intentionally hidden: inspecting a pile grants no extra rule information.
    const cards = [...(run?.combat?.[pile] ?? [])].sort((a, b) => CARDS[a.id].name.localeCompare(CARDS[b.id].name));
    content = `<span class="eyebrow">${pile === 'draw' ? 'SHUFFLED POSSIBILITIES' : 'THE TURN’S LITTLE HISTORY'}</span><h1>${titleCase(pile)} pile <small>${cards.length}</small></h1><p class="muted">Cards are shown alphabetically.</p><div class="catalog-grid">${cards.map(c => cardMarkup(c.id, c, 'none')).join('')}</div>${!cards.length ? '<p class="muted">Nothing here. Yet.</p>' : ''}`;
  } else content = collectionMarkup();
  return `<div class="modal-backdrop"><section class="modal modal-${modal}" role="dialog" aria-modal="true" aria-label="${modal === 'collection' ? text('codex') : modal === 'help' ? text('help') : titleCase(modal)}"><button class="close-button" data-action="close" aria-label="Close dialog">×</button>${content}</section></div>`;
}

function applyPreferences(): void {
  const html = document.documentElement;
  html.lang = 'en';
  html.dataset.effects = settings.reduceEffects ? 'reduced' : 'full';
  html.dataset.speed = settings.animationSpeed;
  html.style.setProperty('--motion-factor', String(settings.animationSpeed === 'slow' ? 1.5 : settings.animationSpeed === 'fast' ? 0.6 : 1));
}

function render(): void {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusId = active?.id;
  const focusData = active ? { ...active.dataset } : {};
  const selection = active instanceof HTMLInputElement ? [active.selectionStart, active.selectionEnd] : null;
  const dialogScroll = root.querySelector('.modal')?.scrollTop ?? 0;
  const oldGuideDetails = root.querySelector<HTMLDetailsElement>('.guide-details');
  if (oldGuideDetails) guideDetailsOpen = oldGuideDetails.open;
  const scene = [screen, mode, runViewVersion, run?.day.day, run?.mode, run?.phase, run?.currentNode].join(':');
  const selectedValues = scene === renderedScene ? Array.from(root.querySelectorAll<HTMLSelectElement>('select[id]'), select => [select.id, select.value] as const) : [];
  const mapScroll = scene === renderedScene ? root.querySelector('.map-scroll')?.scrollTop : undefined;
  applyPreferences();
  const burst = Date.now() < burstUntil && motionDuration(settings, 1) > 0;
  const content = screen === 'run' && run ? runScreen() : screen === 'modes' ? modeSelect() : screen === 'characters' ? characterSelect() : camp();
  root.innerHTML = `<div class="app-shell ${burst ? 'squeek-shake' : ''}" data-screen="${screen}">${header()}${content}${burst ? `<div class="squeek-burst" aria-hidden="true"><span>SQUEEK!</span><strong>${fmt(burstScore)}</strong><small>THAT’S ONE VERY AWAKE HAMSTER.</small></div>` : ''}${playEffect && Date.now() < playEffect.until ? `<div class="card-play-effect" aria-hidden="true" inert>${playEffect.markup}</div>` : ''}${toast ? `<div class="toast" role="status">${esc(toast)}</div>` : ''}${modalMarkup()}</div>`;
  const guideDetails = root.querySelector<HTMLDetailsElement>('.guide-details');
  if (guideDetails) guideDetails.open = guideDetailsOpen;
  document.body.classList.toggle('modal-open', !!modal);
  root.querySelectorAll<HTMLElement>('.app-shell > .topbar, .app-shell > .layout, .app-shell > main').forEach(element => element.toggleAttribute('inert', !!modal));
  for (const [id, value] of selectedValues) {
    const select = document.getElementById(id);
    if (select instanceof HTMLSelectElement && Array.from(select.options).some(option => option.value === value)) select.value = value;
  }
  const map = root.querySelector<HTMLElement>('.map-scroll');
  if (map) map.scrollTop = mapScroll ?? Math.max(0, (1630 - Math.max(0, run?.currentNode ?? 0) * 68) - 300);
  renderedScene = scene;
  const dialog = root.querySelector('.modal');
  if (dialog) dialog.scrollTop = dialogScroll;
  const focusScope = dialog ?? root;
  const idTarget = focusId ? document.getElementById(focusId) : null;
  const focusTarget = idTarget && focusScope.contains(idTarget) ? idTarget : Object.keys(focusData).length
    ? Array.from(focusScope.querySelectorAll<HTMLElement>('[data-action],[data-setting]')).find(el => !el.closest('[inert]') && Object.entries(focusData).every(([key, value]) => el.dataset[key] === value)) : null;
  if (focusTarget instanceof HTMLElement) {
    focusTarget.focus({ preventScroll: true });
    if (selection && focusTarget instanceof HTMLInputElement && ['text', 'search'].includes(focusTarget.type)) focusTarget.setSelectionRange(selection[0], selection[1]);
  } else if (dialog) dialog.querySelector<HTMLButtonElement>('[data-action="close"]')?.focus({ preventScroll: true });
}

function clearPresentation(): void {
  selectedCard = ''; draggingCard = ''; playEffect = null; scorePop = null; sceneEffect = null; pendingBattle = null; burstUntil = 0;
  restUpgradeUid = '';
  effectRenderDeferred = false;
  window.clearTimeout(effectTimer);
}

function dispatch(action: RunAction): void {
  if (!run) return;
  try {
    const before = run;
    const previousBattleScore = scoreBattle(before);
    const played = action.type === 'play' ? before.combat?.hand.find(c => c.uid === action.uid) : undefined;
    const playedMarkup = played ? cardMarkup(played.id, played, 'none') : '';
    if (run.mode === 'endless' && action.type !== 'elapsed' && endlessElapsed() >= 300000 && !done()) {
      clearPresentation(); run = act(run, { type: 'elapsed', ms: 300000 });
      saveActive(run); finishRun(run); render(); return;
    }
    const next = act(run, action);
    run = next;
    saveActive(run);
    if (done()) finishRun(run);
    clearPresentation();
    target = Math.max(0, run.combat?.enemies.findIndex(e => e.hp > 0) ?? 0);
    const duration = motionDuration(settings, 1050);
    if (before.phase === 'combat' && before.combat && run.combat && duration > 0 && (action.type === 'play' || action.type === 'endTurn')) {
      const enemies: Record<string, ActorEffect> = {};
      before.combat.enemies.forEach((enemy, i) => {
        const now = run!.combat!.enemies.find(e => e.uid === enemy.uid);
        const damage = Math.max(0, enemy.hp - (now?.hp ?? 0));
        const block = Math.max(0, (now?.block ?? 0) - enemy.block);
        const kind = action.type === 'endTurn' && enemy.hp > 0 ? enemy.intent.type === 'attack' ? 'enemy-attack' : enemy.intent.type === 'block' ? 'defend' : 'cast' : 'hit';
        if (damage || block || action.type === 'endTurn') enemies[enemy.uid] = { kind, damage, block, dead: enemy.hp > 0 && (now?.hp ?? 0) <= 0, delay: action.type === 'endTurn' ? motionDuration(settings, i * 90) : 0 };
      });
      const definition = played ? CARDS[played.id] : undefined;
      const kind = definition?.type === 'attack' ? 'attack' : definition?.type === 'power' ? 'power' : (run.combat.block > before.combat.block) ? 'defend' : 'skill';
      sceneEffect = { player: { kind: action.type === 'play' ? kind : 'receive', damage: Math.max(0, before.hp - run.hp), block: Math.max(0, run.combat.block - before.combat.block), dead: run.hp <= 0 }, enemies, until: Date.now() + duration };
      if (run.phase !== 'combat') pendingBattle = run;
      if (playedMarkup) playEffect = { markup: playedMarkup, until: Date.now() + motionDuration(settings, 650) };
      const scoreGained = Math.max(0, scoreBattle(run) - previousBattleScore);
      if (scoreGained > 0) scorePop = { value: scoreGained, until: Date.now() + duration };
      if ((run.bestHit >= 100 && run.bestHit > before.bestHit) || scoreGained >= 1000) { burstUntil = Date.now() + duration; burstScore = Math.max(run.bestHit, scoreGained); }
      effectTimer = window.setTimeout(() => {
        // An earlier card's animation must not cancel the player's next choice.
        playEffect = null; scorePop = null; sceneEffect = null; pendingBattle = null; burstUntil = 0;
        // Replacing a native drag's source element cancels the drag in browsers.
        effectRenderDeferred = !!draggingCard;
        if (!effectRenderDeferred) render();
      }, duration);
    }
    if (action.type === 'play') squeekSound(run.combat?.chain ?? 0);
    if (action.type === 'abandon') modal = null;
    render();
  } catch (error) { notify(error instanceof Error ? error.message : 'That move is not available.'); }
}

function resumeRun(saved: RunState): void {
  syncGameDay();
  clearPresentation();
  runViewVersion++; run = saved; mode = saved.mode; screen = 'run';
  if (saved.mode === 'endless') dispatch({ type: 'elapsed', ms: Math.max(saved.elapsedMs, endlessElapsed()) });
  else render();
}

function startRun(selected: RunMode, fresh = false): void {
  syncGameDay();
  clearPresentation();
  const saved = !fresh ? loadActive(selected) : null;
  if (saved && !['won', 'lost'].includes(saved.phase) && saved.day.day === day.day) {
    resumeRun(saved);
    return;
  }
  if (selected === 'daily' && !claimDaily(day.day)) { notify('Today’s official attempt is used. Practice and endless are open.'); return; }
  runViewVersion++; run = createRun(day, generateMap(day), selected);
  mode = selected; boardMode = selected; screen = 'run'; target = 0; scoreStatus = '';
  boardRequest++; globalRows = []; boardStatus = 'loading';
  if (selected === 'endless') startEndlessClock();
  // Generated routes begin at a battle. Enter it once, preserving every later room choice.
  run = act(run, { type: 'enter', nodeId: run.reachable[0] });
  saveActive(run); render();
}

function exportJson(): void {
  if (!run) { notify('Start a run to create an action log.'); return; }
  const blob = new Blob([JSON.stringify(exportRun(run), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `squeekspire-${run.day.day}-${run.mode}.json`; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function playCard(uid: string, index = target): void {
  if (pendingBattle || !run?.combat?.hand.some(c => c.uid === uid)) return;
  const card = run.combat.hand.find(item => item.uid === uid)!;
  if (['oracle-ping', 'gud-tek', 'merge'].includes(card.id)) {
    pendingPlay = { uid, target: index };
    modalOpener = 'play'; modalOpenerPile = null;
    modal = card.id === 'merge' ? 'merge' : 'card-choice';
    render(); return;
  }
  dispatch({ type: 'play', uid, target: run.combat.enemies[index]?.uid });
}

function showGuidePage(page: number): void {
  const next = Number.isFinite(page) ? Math.max(0, Math.min(GUIDE_PAGE_COUNT - 1, Math.trunc(page))) : 0;
  if (next === guidePage) return;
  guidePage = next;
  render();
  // Keep keyboard focus in the carousel even when the pressed arrow becomes disabled.
  root.querySelector<HTMLButtonElement>('.guide-dot[aria-current="page"]')?.focus({ preventScroll: true });
}

root.addEventListener('pointerdown', event => {
  if (modal !== 'help' || !(event.target instanceof Element)) return;
  if (!event.target.closest('.guide-page') || event.target.closest('button,a,summary') || event.button !== 0) return;
  if (event.isPrimary === false) { guideGesture = null; return; }
  guideGesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, page: guidePage };
});
root.addEventListener('pointerup', event => {
  const gesture = guideGesture;
  guideGesture = null;
  if (!gesture || modal !== 'help' || gesture.pointerId !== event.pointerId || gesture.page !== guidePage) return;
  const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
  if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.35) showGuidePage(guidePage + (dx < 0 ? 1 : -1));
});
root.addEventListener('pointercancel', () => { guideGesture = null; });

root.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>('[data-action]');
  if (!button || (button instanceof HTMLButtonElement && button.disabled) || (modal && !button.closest('.modal'))) return;
  const action = button.dataset.action;
  if (action === 'wallet-connect') { void wallet.connect(); }
  else if (action === 'wallet-disconnect') wallet.disconnect();
  else if (action === 'wallet-switch') { void wallet.switchToSepolia(); }
  else if (action === 'home') { clearPresentation(); screen = 'camp'; render(); }
  else if (action === 'start') { screen = 'modes'; render(); }
  else if (action === 'mode') { mode = button.dataset.mode as RunMode; screen = 'characters'; render(); }
  else if (action === 'begin') startRun(mode);
  else if (action === 'resume') { if (run && !done()) resumeRun(run); }
  else if (action === 'again') startRun(button.dataset.mode as RunMode, true);
  else if (action === 'collection' || action === 'help' || action === 'deck' || action === 'settings' || action === 'more') { modalOpener = action; modalOpenerPile = null; modal = action; if (action === 'help') { guidePage = 0; guideDetailsOpen = false; guideGesture = null; } render(); if (action === 'more') void refreshLeaderboard(); }
  else if (action === 'pile') { pile = button.dataset.pile as typeof pile; modalOpener = 'pile'; modalOpenerPile = pile; modal = 'pile'; render(); }
  else if (action === 'relic') { inspectedRelic = button.dataset.id!; modalOpener = 'relic'; modal = 'relic'; render(); }
  else if (action === 'guide-page') showGuidePage(Number(button.dataset.page));
  else if (action === 'close') closeModal();
  else if (action === 'board') { boardMode = button.dataset.mode as RunMode; void refreshLeaderboard(); }
  else if (action === 'board-refresh') void refreshLeaderboard();
  else if (action === 'collection-tab') { collectionTab = button.dataset.tab as typeof collectionTab; render(); }
  else if (action === 'filter-type') { galleryType = button.dataset.value as typeof galleryType; render(); }
  else if (action === 'filter-rarity') { galleryRarity = button.dataset.value as typeof galleryRarity; render(); }
  else if (action === 'reset-filters') { galleryType = 'all'; galleryRarity = 'all'; gallerySearch = ''; render(); }
  else if (action === 'node') dispatch({ type: 'enter', nodeId: Number(button.dataset.id) });
  else if (action === 'target') { target = Number(button.dataset.index); if (selectedCard) playCard(selectedCard, target); else render(); }
  else if (action === 'play') {
    const card = run?.combat?.hand.find(c => c.uid === button.dataset.uid);
    if (!card || pendingBattle) return;
    if (window.matchMedia('(max-width: 760px), (pointer: coarse)').matches) { pendingPlay = { uid: card.uid, target }; modalOpener = 'play'; modal = 'card-preview'; render(); }
    else if (CARDS[card.id].type === 'attack') { selectedCard = selectedCard === card.uid ? '' : card.uid; render(); }
    else playCard(card.uid);
  }
  else if (action === 'cancel-play') closeModal();
  else if (action === 'preview-play' && pendingPlay) { const pending = pendingPlay; modal = null; pendingPlay = null; playCard(pending.uid, pending.target); }
  else if (action === 'choose-card' && pendingPlay && run?.combat) {
    const played = run.combat.hand.find(item => item.uid === pendingPlay!.uid);
    const choice = Number(button.dataset.index);
    const candidate = played?.id === 'oracle-ping' ? oracleDrawOptions(run)[choice] : run.combat.hand.filter(item => item.uid !== pendingPlay!.uid)[choice];
    if (!candidate || (played?.id === 'gud-tek' && !candidate.level && !isCardUpgradable(candidate))) return;
    pendingPlay.choice = choice; render();
  }
  else if (action === 'confirm-play' && pendingPlay && run?.combat) {
    const pending = pendingPlay;
    modal = null; pendingPlay = null;
    dispatch({ type: 'play', uid: pending.uid, target: run.combat.enemies[pending.target]?.uid, ...(pending.choice !== undefined ? { choice: pending.choice } : {}), ...(pending.mergePair ? { mergePair: pending.mergePair } : {}) });
  }
  else if (action === 'end-turn') dispatch({ type: 'endTurn' });
  else if (action === 'pick-card') dispatch({ type: 'reward', cardId: button.dataset.id! });
  else if (action === 'skip-reward') dispatch({ type: 'reward', cardId: null });
  else if (action === 'buy') dispatch({ type: 'buy', index: Number(button.dataset.index) });
  else if (action === 'remove') { const uid = root.querySelector<HTMLSelectElement>('#remove-card')?.value; if (uid) dispatch({ type: 'remove', uid }); }
  else if (action === 'heal') dispatch({ type: 'rest', option: 'heal' });
  else if (action === 'upgrade') { const uid = root.querySelector<HTMLSelectElement>('#upgrade-card')?.value; if (uid) dispatch({ type: 'rest', option: 'upgrade', uid }); }
  else if (action === 'event') dispatch({ type: 'event', option: Number(button.dataset.index) as 0 | 1 });
  else if (action === 'leave') dispatch({ type: 'leave' });
  else if (action === 'abandon') dispatch({ type: 'abandon' });
  else if (action === 'export') exportJson();
  else if (action === 'import') root.querySelector<HTMLInputElement>('#replay-input')?.click();
});

root.addEventListener('dragstart', event => {
  if (modal || !(event.target instanceof Element)) return;
  const card = event.target.closest<HTMLButtonElement>('.hand [data-action="play"]');
  if (!card || card.disabled) return;
  draggingCard = card.dataset.uid!;
  selectedCard = draggingCard;
  event.dataTransfer?.setData('text/plain', draggingCard);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
  root.querySelectorAll('.enemy-card:not(:disabled)').forEach(e => e.classList.add('awaiting-target'));
});
root.addEventListener('dragover', event => {
  if (draggingCard && !modal && event.target instanceof Element && event.target.closest('[data-action="target"], [data-action="player-target"]')) {
    event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }
});
root.addEventListener('drop', event => {
  if (modal || !(event.target instanceof Element)) return;
  const actor = event.target.closest<HTMLElement>('[data-action="target"], [data-action="player-target"]');
  if (!actor || (actor instanceof HTMLButtonElement && actor.disabled)) return;
  event.preventDefault();
  const uid = draggingCard || event.dataTransfer?.getData('text/plain');
  const card = run?.combat?.hand.find(c => c.uid === uid);
  if (!card || (actor.dataset.action === 'player-target' && CARDS[card.id].type === 'attack')) return;
  playCard(card.uid, actor.dataset.index === undefined ? target : Number(actor.dataset.index));
  draggingCard = '';
});
root.addEventListener('dragend', () => {
  draggingCard = '';
  root.querySelectorAll('.dragging, .awaiting-target').forEach(el => el.classList.remove('dragging', 'awaiting-target'));
  if (effectRenderDeferred) { effectRenderDeferred = false; render(); }
});

function closeModal(): void { const uid = pendingPlay?.uid; modal = null; pendingPlay = null; render(); root.querySelector<HTMLButtonElement>(`[data-action="${modalOpener}"]${uid ? `[data-uid="${uid}"]` : modalOpenerPile ? `[data-pile="${modalOpenerPile}"]` : ''}`)?.focus({ preventScroll: true }); }

function updateSetting(input: HTMLInputElement | HTMLSelectElement): void {
  const key = input.dataset.setting as keyof Preferences;
  if (!key) return;
  const value = key === 'volume' ? Number(input.value) : key === 'reduceEffects' ? (input as HTMLInputElement).checked : input.value;
  settings = savePreferences({ ...settings, [key]: value });
  if (motionDuration(settings, 1) === 0) clearPresentation();
  applyPreferences();
  if (key === 'volume') { const output = root.querySelector('#volume-value'); if (output) output.textContent = `${settings.volume}%`; }
  else render();
}
root.addEventListener('input', event => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.setting === 'volume') updateSetting(input);
  if (input.id === 'gallery-search') { gallerySearch = input.value; render(); }
});
root.addEventListener('change', async event => {
  const input = event.target as HTMLInputElement;
  if (input.dataset.setting) { updateSetting(input); return; }
  if (input.id === 'upgrade-card') { restUpgradeUid = input.value; render(); return; }
  if (input.id === 'preview-target' && pendingPlay) { pendingPlay.target = Number(input.value); target = pendingPlay.target; render(); return; }
  if (input.id === 'merge-pair' && pendingPlay && run) { pendingPlay.mergePair = mergeCandidates(run)[Number(input.value)]?.pair; render(); return; }
  if (input.id !== 'replay-input' || !input.files?.[0]) return;
  try {
    if (input.files[0].size > 2_000_000) throw new Error('Replay is too large (2 MB maximum).');
    const verified = replayRun(JSON.parse(await input.files[0].text()));
    notify(`Replay verified: ${fmt(verified.totalScore)} squeeks · ${verified.log.length} actions · ${verified.phase}. Imported runs do not enter your board.`);
  } catch (error) { notify(`Replay rejected: ${error instanceof Error ? error.message : 'Invalid file.'}`); }
});

document.addEventListener('keydown', event => {
  if (!root.isConnected) return;
  if (event.key === 'Escape') {
    if (modal) { event.preventDefault(); closeModal(); }
    else if (selectedCard) { selectedCard = ''; render(); }
    else if (screen === 'characters') { screen = 'modes'; render(); }
    else if (screen === 'modes') { screen = 'camp'; render(); }
    return;
  }
  if (modal === 'help' && !(event.target instanceof Element && event.target.closest('.guide-details'))) {
    const page = event.key === 'ArrowLeft' ? guidePage - 1 : event.key === 'ArrowRight' ? guidePage + 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? GUIDE_PAGE_COUNT - 1 : undefined;
    if (page !== undefined) { event.preventDefault(); showGuidePage(page); return; }
  }
  if (event.key === 'Tab' && modal) {
    const dialog = root.querySelector('.modal');
    const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),select,input,a[href],summary,[tabindex="0"]');
    if (focusable?.length) {
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (!dialog?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }
  if (event.key === 'Enter' && !modal && !pendingBattle && screen === 'run' && run?.phase === 'combat'
    && !(event.target instanceof HTMLButtonElement) && !(event.target instanceof HTMLSelectElement) && !(event.target instanceof HTMLInputElement)) dispatch({ type: 'endTurn' });
});

function dailyCountdown(): string {
  const now = new Date();
  const seconds = Math.max(0, Math.ceil((getDailyResetTime(now) - now.getTime()) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

/** Roll the challenge and board together; an ongoing run retains its original UTC day. */
function syncGameDay(): void {
  const currentDay = getGameDay();
  if (!day || currentDay === day.day) return;
  day = { ...fallbackDay(currentDay), spinning: day.spinning, notice: day.notice };
  boardRequest++; globalRows = []; boardStatus = 'loading';
  render();
  if (modal === 'more') void refreshLeaderboard();
}

function clockText(): string {
  const seconds = Math.max(0, Math.ceil((300000 - (run?.elapsedMs ?? 0)) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function squeekSound(chain: number): void {
  if (!settings.volume) return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') void audioContext.resume();
    const oscillator = audioContext.createOscillator(), volume = audioContext.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(320 + chain * 55, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(720 + chain * 80, audioContext.currentTime + 0.07);
    volume.gain.setValueAtTime(0.07 * settings.volume / 100, audioContext.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.11);
    oscillator.connect(volume); volume.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + 0.12);
  } catch { /* Sound is optional on browsers without Web Audio. */ }
}

window.setInterval(() => {
  if (!root.isConnected) return;
  syncGameDay();
  root.querySelectorAll('[data-daily-countdown]').forEach(clock => { clock.textContent = dailyCountdown(); });
  if (run?.mode === 'endless' && !done()) {
    try {
      run = act(run, { type: 'elapsed', ms: Math.max(run.elapsedMs, endlessElapsed()) }); saveActive(run);
      if (done()) { clearPresentation(); finishRun(run); render(); }
      else { const clock = root.querySelector('#endless-clock'); if (clock) clock.textContent = clockText(); }
    } catch (error) { notify(error instanceof Error ? error.message : 'Clock paused.'); }
  }
}, 1000);

async function boot(): Promise<void> {
  day = await loadDay(); guestProfile = getProfile(); profile = guestProfile;
  run = (['daily', 'practice', 'endless'] as RunMode[]).map(m => loadActive(m)).find(saved => saved && saved.day.day === day.day && !['won', 'lost'].includes(saved.phase)) ?? null;
  if (run) mode = run.mode;
  wallet.subscribe(state => {
    profile = state.address ?? guestProfile;
    if (root.isConnected) render();
  });
  if (!hasPersistentStorage()) notify('Browser storage is unavailable. Progress and the daily limit last only for this session.');
}
boot().catch(error => {
  root.innerHTML = `<main class="boot-error"><h1>The wheel needs a moment.</h1><p>${esc(error instanceof Error ? error.message : error)}</p><button onclick="location.reload()">Try again</button></main>`;
});
