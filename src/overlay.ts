import './overlay.css';
import { spriteArt } from './art';
import { ENEMIES } from './game/catalog';
import { getGameDay } from './game/data';
import { generateMap } from './game/map';
import type { DayData } from './game/types';
import { fetchLeaderboardOverview, type LeaderboardOverview } from './leaderboard';
import { fetchHamsterStatus, fetchOverlayDay, parseOverlayOptions, type HamsterStatus } from './overlay-data';
import { fitOverlay, getOverlayGeometry } from './overlay-geometry';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const number = (value: number, digits = 0) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
const compactNumber = (value: number, digits = 0) => {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1_000_000) return number(value, digits);
  if (Math.abs(value) >= 1e15) return value.toExponential(1);
  let magnitude = Math.min(4, Math.floor(Math.log10(Math.abs(value)) / 3));
  if (magnitude < 4 && Math.abs(value) / 1000 ** magnitude >= 999.95) magnitude++;
  return `${number(value / 1000 ** magnitude, 1)}${['', 'K', 'M', 'B', 'T'][magnitude]}`;
};
const metric = (value: number | undefined, digits = 0) => value === undefined ? '<b>—</b>' : `<b title="${escape(number(value, digits))}">${compactNumber(value, digits)}</b>`;
const seed = (value: number) => value.toString(16).padStart(8, '0').toUpperCase();
const clock = (value: Date) => value.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** A display-only OBS source. No game boot, profile storage, audio or wallet discovery. */
export function mountOverlay(root: HTMLElement = document.querySelector('#app')!): () => void {
  const options = parseOverlayOptions(window.location.search);
  const geometry = getOverlayGeometry(options);
  const previousClass = document.documentElement.className;
  const previousBg = document.documentElement.dataset.overlayBg;
  const previousTitle = document.title;
  document.documentElement.classList.add('ov-document');
  document.documentElement.dataset.overlayBg = options.bg;
  document.title = 'Stream overlay · Squeekspire';
  let disposed = false;
  let sourceVisible = true;
  let day: DayData | undefined;
  let status: HamsterStatus | undefined;
  let board: LeaderboardOverview | undefined;
  let boardFailed = false;
  let statusFailed = false;
  let boardUpdated = '';
  let dayLoading = false, statusLoading = false, boardLoading = false;
  let lastDayAttempt = 0;
  let timer: number | undefined;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const hidden = () => document.hidden || !sourceVisible;
  const rowCount = options.density === 'min' ? 1 : options.density === 'compact' || options.layout === 'bar' ? 3 : 5;

  function statusPanel(): string {
    const state = statusFailed || !status ? (statusFailed ? 'unavailable' : 'loading') : status.state;
    const label = { spinning: 'SPINNING', idle: 'IDLE', unavailable: 'SIGNAL LOST', loading: 'CONNECTING' }[state];
    const description = statusFailed ? 'Status unavailable · retrying in 15s' : state === 'loading' ? 'Reading the wheel…' : state === 'unavailable' ? status?.reason || 'Live signal unavailable · retrying' : state === 'spinning' ? 'Little paws. Full power.' : 'A little breather between zoomies.';
    const live = state === 'idle' || state === 'spinning';
    return `<section class="ov-status ov-section" data-section="status" data-state="${state}" aria-label="Live hamster status"><div class="ov-label"><i class="ov-led ${state}"></i> THE HAMSTER / LIVE</div><div class="ov-status-main"><div class="ov-hamster" aria-hidden="true">${spriteArt('zoomie-gremlin')}</div><div class="ov-copy"><strong class="ov-state">${label}</strong><p class="ov-description" title="${escape(description)}">${escape(description)}</p></div></div><div class="ov-metrics"><span>${metric(live ? status?.rpm : undefined, 1)} RPM</span><span>${metric(live ? status?.distanceMeters : undefined, 1)} M</span><span class="ov-telemetry-note">${live ? 'WHEEL DATA' : 'NO SIGNAL'}</span></div></section>`;
  }

  function bossPanel(): string {
    if (!day || day.day !== getGameDay()) return '<section class="ov-boss ov-section" data-section="boss"><div class="ov-label">TODAY’S CLIMB / UTC</div><strong class="ov-waiting">Reading the daily seed…</strong></section>';
    const map = generateMap(day);
    const finalBoss = ENEMIES[map.find(node => node.kind === 'boss')?.enemyId || 'squeektoshi'];
    const elites = map.filter(node => node.kind === 'elite').length;
    const difficulty = day.difficulty >= 1.15 ? 'FIERCE' : day.difficulty > 0.95 ? 'STEADY' : 'MELLOW';
    const fallback = day.source === 'cached' ? 'Latest snapshot fallback' : 'Bundled fixture fallback';
    return `<section class="ov-boss ov-section" data-section="boss"><div class="ov-label">TODAY’S CLIMB <span>${escape(day.day)} UTC</span></div><div class="ov-boss-main"><div class="ov-boss-art" aria-hidden="true">${spriteArt(finalBoss.id)}</div><div class="ov-copy"><small class="ov-mini-label">FINAL BOSS / FLOOR 24</small><strong class="ov-boss-name" title="${escape(finalBoss.name)}">${escape(finalBoss.name)}</strong><div class="ov-difficulty"><span>${difficulty}</span><b>×${day.difficulty.toFixed(2)}</b><span class="ov-difficulty-caption">MAP DIFFICULTY</span></div></div></div><div class="ov-seed-line"><span>SEED <b>${seed(day.seed)}</b></span><span>24 ROOMS · ${elites} ELITES</span></div>${day.source !== 'live' ? `<p class="ov-fallback" title="${escape(day.notice)}">${fallback} · ${escape(day.notice.match(/data from ([\d-]+)/)?.[1] || 'historical data')}</p>` : ''}</section>`;
  }

  function boardPanel(): string {
    const today = getGameDay();
    const current = board?.today.day === today;
    const matching = !day || day.day !== today || board?.today.seed === day.seed;
    const rows = current && matching ? board!.today.entries.slice(0, rowCount) : [];
    let message = 'Reading today’s climbers…';
    if (board && !current) message = 'UTC reset · waiting for today’s board';
    else if (board && !matching) message = 'Seed differs · waiting for matching map data';
    else if (boardFailed && !board) message = 'Board unavailable · retrying in 15s';
    else if (current && matching && !rows.length) message = 'No verified daily runs yet. The crown awaits.';
    return `<section class="ov-board ov-section" data-section="board"><div class="ov-label">TODAY’S TOP ${rowCount} <span>${board?.storage === 'local' ? 'LOCAL DEV BOARD' : 'DAILY / VERIFIED'}</span></div>${rows.length ? `<ol class="ov-rankings">${rows.map((row, index) => {
      const identity = row.name?.trim() || (row.profile.startsWith('0x') ? `${row.profile.slice(0, 6)}…${row.profile.slice(-4)}` : row.profile);
      return `<li><span class="ov-rank">${String(index + 1).padStart(2, '0')}</span><span class="ov-player" title="${escape(row.name ? `${row.name} · ${row.profile}` : row.profile)}">${escape(identity)}</span><strong title="${escape(number(row.score))} SQK">${compactNumber(row.score)}<small> SQK</small></strong></li>`;
    }).join('')}</ol>` : `<p class="ov-board-empty" title="${escape(message)}">${escape(message)}</p>`}<div class="ov-board-meta">${boardFailed && current ? 'REFRESH MISSED · LAST LOADED BOARD' : current && matching ? `SEED ${seed(board!.today.seed)}${boardUpdated ? ` · ${boardUpdated} UTC` : ''}` : `${today} · RESETS 00:00 UTC`}</div></section>`;
  }

  function fit() {
    if (disposed || hidden()) return;
    const stage = root.querySelector<HTMLElement>('.ov-stage');
    if (!stage) return;
    const placement = fitOverlay(options, root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight);
    stage.style.setProperty('--ov-scale', String(placement.scale));
    stage.style.left = `${placement.left}px`;
    stage.style.top = `${placement.top}px`;
    stage.dataset.effectiveScale = String(placement.scale);
  }

  function motion() {
    if (disposed || hidden()) return;
    const stage = root.querySelector<HTMLElement>('.ov-stage');
    if (stage) stage.dataset.motion = options.motion === 'low' || reducedMotion?.matches ? 'low' : 'normal';
  }

  function render() {
    if (disposed || hidden()) return;
    const panels = { status: statusPanel, boss: bossPanel, board: boardPanel };
    const styles = `--ov-scale:${options.scale};--ov-opacity:${options.opacity};--ov-width:${geometry.width}px;--ov-height:${geometry.height}px;--ov-header:${geometry.header}px;--ov-footer:${geometry.footer}px;--ov-status-height:${geometry.panelHeights.status}px;--ov-boss-height:${geometry.panelHeights.boss}px;--ov-board-height:${geometry.panelHeights.board}px;width:${geometry.stageWidth}px;height:${geometry.stageHeight}px`;
    root.innerHTML = `<main class="ov-stage" data-density="${options.density}" data-position="${options.pos}" data-safe="${options.safe}" style="${styles}"><div class="ov-shell ov-${options.layout}" data-layout="${options.layout}" data-bg="${options.bg}" data-panels="${options.show.length}"><div class="ov-surface" aria-hidden="true"></div><header class="ov-header"><span class="ov-brand">SQUEEK<span>SPIRE</span><i>_</i></span><span class="ov-broadcast">THE WHEELCAST <i></i> <span>15s AUTO REFRESH</span></span></header><div class="ov-panels">${options.show.map(part => panels[part]()).join('')}</div><footer class="ov-footer"><span>SMALL PAWS. BIG CLIMBS.</span><span>REAL HAMSTER DATA <i>◆</i></span></footer></div></main>`;
    fit(); motion();
  }

  async function refreshStatus() {
    if (!options.show.includes('status') || statusLoading || disposed || hidden()) return;
    statusLoading = true;
    try { const incoming = await fetchHamsterStatus(); if (!disposed) { status = incoming; statusFailed = false; } }
    catch { if (!disposed) statusFailed = true; }
    finally { statusLoading = false; render(); }
  }
  async function refreshBoard() {
    if (!options.show.includes('board') || boardLoading || disposed || hidden()) return;
    boardLoading = true;
    try {
      const incoming = await fetchLeaderboardOverview();
      if (!disposed) { board = incoming; boardFailed = false; boardUpdated = clock(new Date()); }
    } catch { if (!disposed) boardFailed = true; }
    finally { boardLoading = false; render(); }
  }
  async function refreshDay() {
    if (!options.show.includes('boss') || dayLoading || disposed || hidden()) return;
    if (day?.day === getGameDay() && (day.source === 'live' || Date.now() - lastDayAttempt < 60_000)) return;
    dayLoading = true; lastDayAttempt = Date.now();
    try { const incoming = await fetchOverlayDay(); if (!disposed) day = incoming; }
    catch { /* Keep the last valid snapshot while its loader recovers. */ }
    finally { dayLoading = false; render(); }
  }
  // Re-evaluate the UTC day before responses settle, so yesterday's ranks disappear immediately.
  const refresh = () => { if (disposed || hidden()) return; render(); void refreshStatus(); void refreshDay(); void refreshBoard(); };
  const onVisibility = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = undefined;
    if (!disposed && !hidden()) { refresh(); timer = window.setInterval(refresh, 15_000); }
  };
  const onSourceVisibility = (event: Event) => {
    const visible = (event as CustomEvent<{ visible?: unknown }>).detail?.visible;
    if (typeof visible === 'boolean' && visible !== sourceVisible) { sourceVisible = visible; onVisibility(); }
  };
  window.addEventListener('resize', fit);
  window.addEventListener('obsSourceVisibleChanged', onSourceVisibility);
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion?.addEventListener?.('change', motion);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : undefined;
  observer?.observe(root);
  onVisibility();
  return () => {
    disposed = true;
    if (timer !== undefined) window.clearInterval(timer);
    observer?.disconnect();
    window.removeEventListener('resize', fit);
    window.removeEventListener('obsSourceVisibleChanged', onSourceVisibility);
    document.removeEventListener('visibilitychange', onVisibility);
    reducedMotion?.removeEventListener?.('change', motion);
    document.documentElement.className = previousClass;
    if (previousBg === undefined) delete document.documentElement.dataset.overlayBg;
    else document.documentElement.dataset.overlayBg = previousBg;
    document.title = previousTitle;
  };
}
