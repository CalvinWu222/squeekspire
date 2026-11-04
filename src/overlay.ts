import './overlay.css';
import { spriteArt } from './art';
import { ENEMIES } from './game/catalog';
import { getGameDay } from './game/data';
import { generateMap } from './game/map';
import type { DayData } from './game/types';
import { fetchLeaderboardOverview, type LeaderboardOverview } from './leaderboard';
import { fetchHamsterStatus, fetchOverlayDay, parseOverlayOptions, type HamsterStatus } from './overlay-data';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const number = (value: number, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits });
const seed = (value: number) => value.toString(16).padStart(8, '0').toUpperCase();
const clock = (value: Date) => value.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** A display-only OBS source. No game boot, profile storage, audio or wallet discovery. */
export function mountOverlay(root: HTMLElement = document.querySelector('#app')!): () => void {
  const options = parseOverlayOptions(window.location.search);
  const previousClass = document.documentElement.className;
  document.documentElement.classList.add('ov-document');
  document.documentElement.dataset.overlayBg = options.bg;
  document.title = 'Stream overlay · Squeekspire';
  let disposed = false;
  let day: DayData | undefined;
  let status: HamsterStatus | undefined;
  let board: LeaderboardOverview | undefined;
  let boardFailed = false;
  let statusFailed = false;
  let boardUpdated = '';
  let dayLoading = false, statusLoading = false, boardLoading = false;
  let lastDayAttempt = 0;

  function statusPanel(): string {
    const state = statusFailed || !status ? (statusFailed ? 'unavailable' : 'loading') : status.state;
    const label = { spinning: 'SPINNING', idle: 'IDLE', unavailable: 'SIGNAL LOST', loading: 'CONNECTING' }[state];
    const description = statusFailed ? 'Status unavailable · retrying in 15s' : state === 'loading' ? 'Reading the wheel…' : state === 'unavailable' ? status?.reason || 'Live signal unavailable · retrying' : state === 'spinning' ? 'Little paws. Full power.' : 'A little breather between zoomies.';
    return `<section class="ov-status ov-section" data-section="status" data-state="${state}" aria-label="Live hamster status"><div class="ov-label"><i class="ov-led ${state}"></i> THE HAMSTER / LIVE</div><div class="ov-status-main"><div class="ov-hamster" aria-hidden="true">${spriteArt('zoomie-gremlin')}</div><div><strong class="ov-state">${label}</strong><p class="ov-description">${escape(description)}</p></div></div><div class="ov-metrics"><span><b>${state === 'idle' || state === 'spinning' ? status?.rpm !== undefined ? number(status.rpm, 1) : '—' : '—'}</b> RPM</span><span><b>${state === 'idle' || state === 'spinning' ? status?.distanceMeters !== undefined ? number(status.distanceMeters, 1) : '—' : '—'}</b> M</span><span class="ov-telemetry-note">${state === 'idle' || state === 'spinning' ? 'WHEEL TELEMETRY' : 'AWAITING SIGNAL'}</span></div></section>`;
  }

  function bossPanel(): string {
    if (!day || day.day !== getGameDay()) return '<section class="ov-boss ov-section" data-section="boss"><div class="ov-label">TODAY’S CLIMB / UTC</div><strong class="ov-waiting">Reading the daily seed…</strong></section>';
    const map = generateMap(day);
    const finalBoss = ENEMIES[map.find(node => node.kind === 'boss')?.enemyId || 'squeektoshi'];
    const elites = map.filter(node => node.kind === 'elite').length;
    const difficulty = day.difficulty >= 1.15 ? 'FIERCE' : day.difficulty > 0.95 ? 'STEADY' : 'MELLOW';
    return `<section class="ov-boss ov-section" data-section="boss"><div class="ov-label">TODAY’S CLIMB <span>${escape(day.day)} UTC</span></div><div class="ov-boss-main"><div class="ov-boss-art" aria-hidden="true">${spriteArt(finalBoss.id)}</div><div><small class="ov-mini-label">FINAL BOSS / FLOOR 24</small><strong class="ov-boss-name">${escape(finalBoss.name)}</strong><div class="ov-difficulty"><span>${difficulty}</span><b>×${day.difficulty.toFixed(2)}</b> MAP DIFFICULTY</div></div></div><div class="ov-seed-line"><span>SEED <b>${seed(day.seed)}</b></span><span>24 ROOMS · ${elites} ELITES</span></div>${day.source !== 'live' ? `<p class="ov-fallback">${day.source === 'cached' ? 'Latest snapshot fallback' : 'Bundled fixture fallback'} · ${escape(day.notice.match(/data from ([\d-]+)/)?.[1] || 'historical data')}</p>` : ''}</section>`;
  }

  function boardPanel(): string {
    const today = getGameDay();
    const current = board?.today.day === today;
    const matching = !day || day.day !== today || board?.today.seed === day.seed;
    const rows = current && matching ? board!.today.entries.slice(0, options.layout === 'bar' ? 3 : 5) : [];
    let message = 'Reading today’s climbers…';
    if (board && !current) message = 'UTC reset · waiting for today’s board';
    else if (board && !matching) message = 'Seed differs · waiting for matching map data';
    else if (boardFailed && !board) message = 'Board unavailable · retrying in 15s';
    else if (current && matching && !rows.length) message = 'No verified daily runs yet. The crown awaits.';
    return `<section class="ov-board ov-section" data-section="board"><div class="ov-label">TODAY’S TOP ${options.layout === 'bar' ? '3' : '5'} <span>${board?.storage === 'local' ? 'LOCAL DEV BOARD' : 'DAILY / VERIFIED'}</span></div>${rows.length ? `<ol class="ov-rankings">${rows.map((row, index) => `<li><span class="ov-rank">${String(index + 1).padStart(2, '0')}</span><span class="ov-player">${escape(row.profile.startsWith('0x') ? `${row.profile.slice(0, 6)}…${row.profile.slice(-4)}` : row.profile)}</span><strong>${number(row.score)}<small> SQK</small></strong></li>`).join('')}</ol>` : `<p class="ov-board-empty">${escape(message)}</p>`}<div class="ov-board-meta">${boardFailed && current ? 'REFRESH MISSED · LAST LOADED BOARD' : current && matching ? `SEED ${seed(board!.today.seed)}${boardUpdated ? ` · ${boardUpdated} UTC` : ''}` : `${today} · RESETS 00:00 UTC`}</div></section>`;
  }

  function render() {
    if (disposed) return;
    const panels = { status: statusPanel, boss: bossPanel, board: boardPanel };
    root.innerHTML = `<main class="ov-stage" style="--ov-scale:${options.scale}"><div class="ov-shell ov-${options.layout}" data-layout="${options.layout}" data-bg="${options.bg}" data-panels="${options.show.length}"><header class="ov-header"><span class="ov-brand">SQUEEK<span>SPIRE</span><i>_</i></span><span class="ov-broadcast">THE WHEELCAST <i></i> <span>15s AUTO REFRESH</span></span></header><div class="ov-panels">${options.show.map(part => panels[part]()).join('')}</div><footer class="ov-footer"><span>SMALL PAWS. BIG CLIMBS.</span><span>POWERED BY REAL HAMSTER DATA <i>◆</i></span></footer></div></main>`;
  }

  async function refreshStatus() {
    if (!options.show.includes('status') || statusLoading || disposed) return;
    statusLoading = true;
    try { const incoming = await fetchHamsterStatus(); if (!disposed) { status = incoming; statusFailed = false; } }
    catch { if (!disposed) statusFailed = true; }
    finally { statusLoading = false; render(); }
  }
  async function refreshBoard() {
    if (!options.show.includes('board') || boardLoading || disposed) return;
    boardLoading = true;
    try {
      const incoming = await fetchLeaderboardOverview();
      if (!disposed) { board = incoming; boardFailed = false; boardUpdated = clock(new Date()); }
    } catch { if (!disposed) boardFailed = true; }
    finally { boardLoading = false; render(); }
  }
  async function refreshDay() {
    if (!options.show.includes('boss') || dayLoading || disposed) return;
    if (day?.day === getGameDay() && (day.source === 'live' || Date.now() - lastDayAttempt < 60_000)) return;
    dayLoading = true; lastDayAttempt = Date.now();
    try { const incoming = await fetchOverlayDay(); if (!disposed) day = incoming; }
    finally { dayLoading = false; render(); }
  }
  // Re-evaluate the UTC day before requests settle, so yesterday's ranks disappear
  // immediately on the next refresh even while today's board is still loading.
  const refresh = () => { render(); void refreshStatus(); void refreshDay(); void refreshBoard(); };
  render(); refresh();
  const timer = window.setInterval(refresh, 15_000);
  return () => {
    disposed = true; window.clearInterval(timer);
    document.documentElement.className = previousClass;
    delete document.documentElement.dataset.overlayBg;
  };
}
