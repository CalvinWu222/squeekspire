import './style.css';
import './leaderboard-page.css';
import { cardArt, nodeIcon, spriteArt } from './art';
import { fetchLeaderboardOverview, type GlobalEntry, type LeaderboardOverview } from './leaderboard';
import { loadPreferences } from './preferences';
import { mountMusicControls, music } from './music';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const points = (score: number) => score.toLocaleString('en-US', { maximumFractionDigits: 0 });
const shortName = (row: GlobalEntry) => row.profile.startsWith('0x') ? `${row.profile.slice(0, 6)}…${row.profile.slice(-4)}` : row.profile;
const seedLabel = (seed: number) => seed.toString(16).padStart(8, '0').toUpperCase();
const dateLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Original 32px hamster portraits; crowns and fur distinguish the three medals. */
function portrait(rank: number): string {
  const fur = ['#eccb91', '#c5b8e1', '#d69670'][rank - 1] ?? '#eccb91';
  const crown = ['#ffdb80', '#d2d1ee', '#dc9972'][rank - 1] ?? '#ffdb80';
  return `<svg viewBox="0 0 40 42" shape-rendering="crispEdges" aria-hidden="true"><path fill="${crown}" d="M10 2h3v4h5V0h4v6h5V2h3v10H10Z"/><path fill="#76502e" d="M10 10h20v3H10Z"/><path fill="#090715" d="M7 14h8v3h10v-3h8v3h3v10h-3v9h-4v3H11v-3H6v-9H3V17h4Z"/><path fill="${fur}" d="M7 17h7v5h12v-5h7v9h-3v3h3v6h-6v3H13v-3H7v-7h3v-3H7Z"/><path fill="#e39ba6" d="M9 18h3v5H9Zm19 0h3v5h-3Z"/><path fill="#fff0d5" d="M14 27h12v3h4v5h-5v3H15v-3h-5v-5h4Z"/><path fill="#161124" d="M12 24h3v4h-3Zm13 0h3v4h-3Zm-6 8h3v2h-3Z"/><path fill="#e7a1ab" d="M18 29h5v3h-5ZM8 29h4v2H8Zm20 0h4v2h-4Z"/><path fill="#baffc9" d="M11 37h18v3H11Z"/></svg>`;
}

function identity(row: GlobalEntry): string {
  const name = escape(shortName(row));
  return row.profile.startsWith('0x')
    ? `<a class="lb-player-name" href="https://sepolia.etherscan.io/address/${escape(row.profile)}" target="_blank" rel="noopener noreferrer" title="View ${escape(row.profile)} on Sepolia Etherscan">${name}<span aria-hidden="true"> ↗</span></a>`
    : `<span class="lb-player-name">${name}</span>`;
}

function theme(row: GlobalEntry): string {
  const value = row.deckTheme || 'Unrecorded';
  const tone = /attack|rush|zoomie/i.test(value) ? 'rose' : /skill|fort|block/i.test(value) ? 'mint' : 'lilac';
  return `<span class="lb-theme ${tone}"><span aria-hidden="true">▣</span> ${escape(value)}</span>`;
}

function podium(rows: GlobalEntry[]): string {
  return `<div class="lb-podium" aria-label="Today's top three">${[1, 2, 3].map(rank => {
    const row = rows[rank - 1];
    return `<article class="lb-winner lb-winner-${rank} ${row ? '' : 'lb-unclaimed'}"><span class="lb-medal">${['1ST / GOLD', '2ND / SILVER', '3RD / BRONZE'][rank - 1]}</span><div class="lb-portrait">${portrait(rank)}</div><div class="lb-winner-info">${row ? `${identity(row)}<strong>${points(row.score)} <small>SQK</small></strong><span class="lb-winner-floor">Floor ${row.floor}${row.won ? ' · Spire cleared' : ''}</span>` : '<span class="lb-player-name">Crown unclaimed</span><strong>— <small>SQK</small></strong><span class="lb-winner-floor">Your paws could be here</span>'}</div><span class="lb-rank-watermark" aria-hidden="true">0${rank}</span></article>`;
  }).join('')}</div>`;
}

function table(rows: GlobalEntry[], kind: 'today' | 'all-time', expanded: boolean): string {
  if (!rows.length) return `<div class="lb-empty"><span aria-hidden="true">${nodeIcon('treasure')}</span><div><h3>${kind === 'today' ? 'The first crown is still up for grabs.' : 'Every legend starts with one run.'}</h3><p>${kind === 'today' ? 'No verified runs on today’s seed yet. Finish a daily climb to join the board.' : 'Completed runs will appear here after the server verifies their replay.'}</p><a href="/">Take a little climb <span aria-hidden="true">↗</span></a></div></div>`;
  const visible = expanded ? rows : rows.slice(0, 10);
  return `<div class="lb-table-wrap"><table class="lb-table"><caption class="lb-sr-only">${kind === 'today' ? 'Today’s daily seed rankings' : 'All-time rankings across all run modes'}</caption><thead><tr><th scope="col">RANK</th><th scope="col">CLIMBER</th><th scope="col" class="lb-number">SCORE / SQK</th><th scope="col">FLOOR</th><th scope="col">RUN DECK</th></tr></thead><tbody>${visible.map((row, index) => `<tr><td class="lb-table-rank ${index < 3 ? `lb-metal-${index + 1}` : ''}"><span>${String(index + 1).padStart(2, '0')}</span></td><td class="lb-table-player">${identity(row)}<small>${row.profile.startsWith('0x') ? 'SEPOLIA' : 'GUEST'}${kind === 'all-time' ? ` · ${escape(row.mode.toUpperCase())} · ${escape(dateLabel(row.day))}` : row.won ? ' · SPIRE CLEARED' : ' · DAILY RUN'}</small></td><td class="lb-table-score lb-number">${points(row.score)}</td><td class="lb-table-floor"><span class="lb-mobile-label">FLOOR </span>${row.floor}<span class="lb-floor-clear" aria-label="${row.won ? 'Spire cleared' : 'Run ended'}">${row.won ? ' ◆' : ''}</span></td><td class="lb-table-deck">${theme(row)}</td></tr>`).join('')}</tbody></table></div>${rows.length > 10 ? `<button class="lb-expand" data-lb-expand="${kind}" aria-expanded="${expanded}">${expanded ? 'Show top 10' : `Show all ${rows.length} runs`} <span aria-hidden="true">${expanded ? '−' : '+'}</span></button>` : ''}`;
}

function champions(data: LeaderboardOverview): string {
  return `<div class="lb-champions">${data.champions.map(({ day, entry }) => `<article class="lb-champion ${entry ? '' : 'lb-champion-empty'}"><div class="lb-champion-date"><span>${escape(dateLabel(day))}</span><small>UTC</small></div><div class="lb-champion-portrait">${portrait(1)}</div>${entry ? `${identity(entry)}<strong>${points(entry.score)} <small>SQK</small></strong><span class="lb-winner-floor">Floor ${entry.floor}</span>${theme(entry)}` : '<span class="lb-player-name">No champion</span><p>No ranked run for this seed</p>'}</article>`).join('')}</div>`;
}

const initialShell = () => `<div class="lb-page"><header class="lb-header"><a class="lb-brand" href="/" aria-label="Squeekspire home"><span>${spriteArt('zoomie-gremlin')}</span><strong>SQUEEK<span>SPIRE</span><i>.</i></strong></a><nav aria-label="Leaderboard navigation"><a class="lb-play-link" href="/">Play<span class="lb-desktop-word"> the game</span> <span aria-hidden="true">↗</span></a></nav></header><main class="lb-main"><section class="lb-hero"><div class="lb-hero-copy"><span class="lb-eyebrow"><i></i> THE MIDNIGHT WHEEL / HALL OF SQUEEKS</span><h1>Small paws.<br><em>Big legends.</em></h1><p>One shared seed. A thousand ways to climb.<br>Meet the little legends who made every card count.</p><div class="lb-hero-note"><span aria-hidden="true">◆</span> REPLAY VERIFIED <span class="lb-dot">·</span> RESETS 00:00 UTC</div></div><div class="lb-hero-art" aria-hidden="true"><div class="lb-orbit"></div><span class="lb-spark lb-spark-a">✦</span><span class="lb-spark lb-spark-b">+</span><span class="lb-art-card lb-art-card-a">${cardArt('wheel-kick')}</span><span class="lb-art-card lb-art-card-b">${cardArt('bedding-fort')}</span><div class="lb-hero-hamster">${portrait(1)}</div><div class="lb-art-plinth">THE NIGHT CREW<small>ONE MORE FLOOR.</small></div><span class="lb-art-relic">${nodeIcon('treasure')}</span></div></section><nav class="lb-section-nav" aria-label="Board sections"><a href="#today"><span>01</span> Today</a><a href="#champions"><span>02</span> Past champions</a><a href="#all-time"><span>03</span> All-time</a><span class="lb-readonly">ADDRESS ONLY <i>◆</i> NO SIGNING</span></nav><div data-lb-content aria-live="polite" aria-busy="true"><div class="lb-loading" role="status"><span class="lb-loading-dot"></span>Reading the little legends…</div></div><footer class="lb-footer"><span>SQUEEKSPIRE <i>✦</i> MADE OF CARDS & COURAGE</span><p>Unofficial fan-made game. Not affiliated with Squeekchain.</p><a href="/overlay/setup">Stream overlay / OBS</a><a href="/">Back to the wheel ↗</a></footer></main></div>`;

function countdown(): string {
  const now = Date.now();
  const next = new Date(now); next.setUTCHours(24, 0, 0, 0);
  const seconds = Math.max(0, Math.ceil((next.getTime() - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

export function mountLeaderboard(root: HTMLElement = document.querySelector('#app')!): () => void {
  document.title = 'Hall of Squeeks · Squeekspire';
  root.innerHTML = initialShell();
  mountMusicControls(); music.setScene('menu'); music.setVolume(loadPreferences().volume);
  const musicButton = document.querySelector('#music-toggle');
  if (musicButton) root.querySelector('.lb-header nav')?.append(musicButton);
  let data: LeaderboardOverview | undefined;
  let loading = false, failed = false, disposed = false;
  let nextAutoRefreshAt = 0;
  let refreshedAt = '';
  const expanded = new Set<string>();
  const content = root.querySelector<HTMLElement>('[data-lb-content]')!;
  function render() {
    content.setAttribute('aria-busy', String(loading));
    if (!data) {
      content.innerHTML = failed ? `<section class="lb-error" role="status"><span class="lb-eyebrow">THE WHEEL NEEDS A MOMENT</span><h2>The board is taking a breather.</h2><p>Scores couldn’t be loaded. Give it another squeek in a moment.</p><button class="lb-refresh" data-lb-refresh ${loading ? 'disabled' : ''}>${loading ? 'Reading…' : 'Try again ↻'}</button></section>` : '<div class="lb-loading" role="status"><span class="lb-loading-dot"></span>Reading the little legends…</div>';
      return;
    }
    content.innerHTML = `${failed ? '<p class="lb-stale" role="status">Refresh missed a step. Showing the last loaded board. Try again shortly.</p>' : ''}<section id="today" class="lb-section"><div class="lb-section-heading"><div><span class="lb-eyebrow">01 / THE DAILY CHALLENGE</span><h2>Today’s climb<span>.</span></h2></div><div class="lb-daily-meta"><strong>${escape(dateLabel(data.today.day))}, ${escape(data.today.day.slice(0, 4))} <small>UTC</small></strong><span>SEED <code>${seedLabel(data.today.seed)}</code></span></div></div><div class="lb-daily-strip"><span><i class="lb-live-dot"></i>${data.storage === 'local' ? 'LOCAL DEVELOPMENT BOARD' : 'GLOBAL LEADERBOARD'}</span><span>NEXT SEED IN <strong data-lb-countdown>${countdown()}</strong></span></div>${podium(data.today.entries)}<div class="lb-board"><div class="lb-board-heading"><span>THE CLIMBERS <small>${data.today.entries.length ? `TOP ${data.today.entries.length} RUN${data.today.entries.length === 1 ? '' : 'S'}` : 'CROWNS AWAIT'}</small></span><button class="lb-refresh" data-lb-refresh aria-label="Refresh leaderboard" ${loading ? 'disabled' : ''}>${loading ? 'Reading…' : 'Refresh ↻'}</button></div>${table(data.today.entries, 'today', expanded.has('today'))}<div class="lb-board-foot"><span>Same seed. One official daily attempt.</span><span>UPDATED ${refreshedAt} UTC</span></div></div></section><section id="champions" class="lb-section"><div class="lb-section-heading"><div><span class="lb-eyebrow">02 / A LITTLE HALL OF FAME</span><h2>Yesterday’s paws. <span>Today’s legends.</span></h2></div><span class="lb-section-aside">THE PAST 7 UTC DAYS</span></div>${champions(data)}<p class="lb-fine-print">Each crown belongs to the highest verified score on that day’s official seed.</p></section><section id="all-time" class="lb-section"><div class="lb-section-heading"><div><span class="lb-eyebrow">03 / THE BIG LITTLE NUMBERS</span><h2>All-time squeeks<span>.</span></h2></div><span class="lb-section-aside">ALL MODES · CURRENT SCORE RULES</span></div><div class="lb-board">${table(data.allTime, 'all-time', expanded.has('all-time'))}<div class="lb-board-foot"><span>Daily, practice & endless. Run modes shown per climber.</span><span>TOP ${data.allTime.length} RUNS</span></div></div><p class="lb-fine-print">Deck themes come from the final verified deck. Older runs may have no recorded theme. Addresses are public Sepolia identities; viewing requires no wallet connection.</p></section>`;
  }
  async function refresh() {
    if (loading || disposed) return;
    loading = true; render();
    try {
      const incoming = await fetchLeaderboardOverview();
      if (disposed) return;
      data = incoming; failed = false;
      nextAutoRefreshAt = incoming.today.day === new Date().toISOString().slice(0, 10) ? 0 : Date.now() + 30_000;
      refreshedAt = new Date().toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' });
    } catch { if (!disposed) { failed = true; nextAutoRefreshAt = Date.now() + 30_000; } }
    finally { loading = false; if (!disposed) render(); }
  }
  const click = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-lb-refresh]')) void refresh();
    const button = event.target.closest<HTMLElement>('[data-lb-expand]');
    if (button) {
      const key = button.dataset.lbExpand!;
      expanded.has(key) ? expanded.delete(key) : expanded.add(key); render();
      root.querySelector<HTMLElement>(`[data-lb-expand="${key}"]`)?.focus({ preventScroll: true });
    }
  };
  root.addEventListener('click', click);
  const timer = window.setInterval(() => {
    if (!root.isConnected) return;
    root.querySelectorAll('[data-lb-countdown]').forEach(element => { element.textContent = countdown(); });
    if (data && Date.now() >= nextAutoRefreshAt && data.today.day !== new Date().toISOString().slice(0, 10)) void refresh();
  }, 1000);
  void refresh();
  return () => { disposed = true; window.clearInterval(timer); root.removeEventListener('click', click); };
}
