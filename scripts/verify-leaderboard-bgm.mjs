/** Local browser acceptance and screenshots for /leaderboard and procedural BGM.
 * Start the dev server with SQUEEKSPIRE_SCORE_FILE=.tmp/leaderboard-bgm.json.
 * To populate that isolated LOCAL store with replay-verified sample runs, opt in:
 * SQUEEKSPIRE_QA_SEED=1 SQUEEKSPIRE_SCORE_FILE=.tmp/leaderboard-bgm.json node <this file>.
 * The script refuses seeding outside loopback/local storage and never uses Redis.
 * Screenshot fixtures are labeled in-page and in report.json; they are not game data.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = new URL(process.env.SQUEEKSPIRE_URL || 'http://127.0.0.1:5173/');
assert(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname),
  'Acceptance script only supports an HTTP loopback development server.');
const output = resolve('docs/leaderboard_bgm');
const seeding = process.env.SQUEEKSPIRE_QA_SEED === '1';
if (seeding) assert.equal(resolve(process.env.SQUEEKSPIRE_SCORE_FILE || ''), resolve('.tmp/leaderboard-bgm.json'),
  'Sample seeding requires the explicitly isolated .tmp/leaderboard-bgm.json store.');
const report = { url: base.href, startedAt: new Date().toISOString(), browser: 'Playwright bundled Chromium',
  fixtureDisclosure: seeding ? 'Replay-verified sample runs submitted only to the isolated local .tmp/leaderboard-bgm.json development store; screenshots have a LOCAL QA label.' : 'No sample runs submitted.',
  checks: [], samples: [], screenshots: [], errors: [], externalRequestsBlocked: [] };
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
function checked(label, detail = {}) { report.checks.push({ label, passed: true, ...detail }); console.log(`[leaderboard-bgm] ${label}`); }

async function openPage({ width = 1440, height = 1000, mobile = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => {
    if (!request.url().startsWith(base.origin) && /^https?:/.test(request.url())) report.externalRequestsBlocked.push(request.url());
  });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return /^https?:$/.test(url.protocol) && url.origin !== base.origin ? route.abort() : route.continue();
  });
  await page.addInitScript(() => {
    const probe = window.__audioProbe = { contexts: 0, starts: 0, resumes: 0, gestures: 0, contextsBeforeGesture: 0, startsBeforeGesture: 0 };
    for (const name of ['pointerdown', 'keydown']) document.addEventListener(name, event => { if (event.isTrusted) probe.gestures++; }, true);
    const Native = window.AudioContext;
    if (!Native) return;
    window.AudioContext = class extends Native {
      constructor(...args) { super(...args); probe.contexts++; if (!probe.gestures) probe.contextsBeforeGesture++; }
      resume(...args) { probe.resumes++; return super.resume(...args); }
      createOscillator(...args) {
        const node = super.createOscillator(...args), original = node.start.bind(node);
        node.start = (...values) => { probe.starts++; if (!probe.gestures) probe.startsBeforeGesture++; return original(...values); };
        return node;
      }
    };
  });
  return { context, page };
}

async function overview(page) {
  const response = await page.request.get(new URL('/api/leaderboard?view=overview', base).href);
  assert.equal(response.status(), 200, 'Real same-origin overview endpoint must respond');
  const data = await response.json();
  assert(Array.isArray(data.today?.entries) && Array.isArray(data.champions) && Array.isArray(data.allTime));
  return data;
}

async function loaded(page) {
  await page.locator('.lb-page').waitFor();
  await page.waitForFunction(() => {
    const refresh = document.querySelector('[data-lb-refresh]');
    return refresh && !refresh.disabled;
  });
  await page.evaluate(() => document.fonts.ready);
}

async function screenshot(page, name, label) {
  if (label) await page.evaluate(text => {
    document.querySelector('[data-qa-fixture-label]')?.remove();
    const note = document.createElement('aside');
    note.dataset.qaFixtureLabel = '';
    note.textContent = text;
    note.style.cssText = 'position:relative;z-index:50;background:#29143e;color:#f4ddff;border-bottom:1px solid #a569e5;padding:9px 16px;text-align:center;font:700 11px/1.5 monospace;letter-spacing:1px;';
    document.body.prepend(note);
  }, label);
  await page.screenshot({ path: resolve(output, name), fullPage: true });
  report.screenshots.push({ file: name, viewport: page.viewportSize(), fullPage: true, fixtureLabel: label || null });
}

async function settingsDialog(page, layout) {
  await page.locator('[data-action="settings"]').click();
  await page.locator('[role="dialog"]').waitFor();
  const overlap = await page.evaluate(() => {
    const toggle = document.querySelector('#music-toggle').getBoundingClientRect();
    const close = document.querySelector('[data-action="close"]').getBoundingClientRect();
    return Math.max(0, Math.min(toggle.right, close.right) - Math.max(toggle.left, close.left))
      * Math.max(0, Math.min(toggle.bottom, close.bottom) - Math.max(toggle.top, close.top));
  });
  assert.equal(overlap, 0, `${layout}: music must not cover the dialog close button`);
  await page.locator('[data-action="close"]').click();
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' });
  checked(`${layout} settings dialog opens and closes without music-control overlap`);
}

// The bot only applies legal actions to the unmodified engine and submits its
// export to the real HTTP replay validator. No scores or deck metadata are forged.
async function seedSampleEntries() {
  const [data, map, engine, catalog] = await Promise.all([
    import('/src/game/data.ts'), import('/src/game/map.ts'), import('/src/game/engine.ts'), import('/src/game/catalog.ts'),
  ]);
  const today = data.getGameDay();
  const plans = [
    { offset: 0, battles: 1, profile: 'guest9201' }, { offset: 0, battles: 2, profile: 'guest9202' },
    { offset: 0, battles: 3, profile: 'guest9203' }, { offset: 0, battles: 4, profile: 'guest9204' },
    { offset: 0, battles: 5, profile: '0x7B30C6a91DF205E48b6203d97aF15cE80D429a31' },
    { offset: 1, battles: 2, profile: 'guest9211' }, { offset: 2, battles: 3, profile: 'guest9221' },
  ];
  const samples = [];
  const existingResponse = await fetch('/api/leaderboard?view=overview');
  const existing = await existingResponse.json();
  if (!existingResponse.ok || existing.storage !== 'local') throw new Error('Sample seeding only supports local leaderboard storage');
  const existingRows = [...existing.today.entries, ...existing.allTime,
    ...existing.champions.flatMap(champion => champion.entry ? [champion.entry] : [])];
  for (const plan of plans) {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - plan.offset);
    const day = await data.loadDay(date);
    const prior = existingRows.find(entry => entry.day === day.day && entry.seed === day.seed
      && entry.profile.toLowerCase() === plan.profile.toLowerCase());
    if (prior) {
      samples.push({ profile: plan.profile, day: day.day, seed: day.seed, score: prior.score, floor: prior.floor,
        actions: prior.actions, status: 'existing replay-verified local sample' });
      continue;
    }
    let run = engine.createRun(day, map.generateMap(day), 'daily');
    let decisions = 0;
    while (!['won', 'lost'].includes(run.phase) && decisions++ < 1500) {
      let action;
      if (run.battles >= plan.battles) action = { type: 'abandon' };
      else if (run.phase === 'map') action = { type: 'enter', nodeId: run.reachable[0] };
      else if (run.phase === 'rest') action = { type: 'rest', option: 'heal' };
      else if (['shop', 'event'].includes(run.phase)) action = { type: 'leave' };
      else if (run.phase === 'reward') action = { type: 'reward', cardId: null };
      else {
        const playable = run.combat.hand.filter(card => catalog.CARDS[card.id].cost !== 'X' && catalog.CARDS[card.id].cost <= run.combat.energy);
        const card = playable.find(card => catalog.CARDS[card.id].type === 'attack') || playable[0];
        action = card ? { type: 'play', uid: card.uid } : { type: 'endTurn' };
      }
      run = engine.act(run, action);
    }
    if (!['won', 'lost'].includes(run.phase)) run = engine.act(run, { type: 'abandon' });
    if (run.totalScore <= 0) throw new Error(`Sample ${plan.profile} did not earn a legal score`);
    const exported = engine.exportRun(run);
    engine.replayRun(exported, day);
    const response = await fetch('/api/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: day.seed, run: exported, identity: plan.profile.startsWith('0x')
        ? { walletAddress: plan.profile } : { guestId: plan.profile } }),
    });
    const result = await response.json();
    if (!response.ok || result.storage !== 'local' || !result.entry) throw new Error(`Sample rejected ${response.status}: ${JSON.stringify(result)}`);
    samples.push({ profile: plan.profile, day: day.day, seed: day.seed, score: run.totalScore, floor: run.floor,
      actions: run.log.length, battles: run.battles, status: response.status });
  }
  return samples;
}

try {
  const { context, page } = await openPage();
  await page.goto(new URL('/leaderboard', base).href);
  await loaded(page);
  let board = await overview(page);
  checked('Real overview endpoint loaded', { storage: board.storage, day: board.today.day, seed: board.today.seed });
  const silent = await page.evaluate(() => window.__audioProbe);
  assert.equal(silent.contexts, 0, 'No AudioContext before user interaction');
  assert.equal(silent.starts, 0, 'No oscillators before user interaction');
  checked('No audio autoplay on direct leaderboard load', silent);
  if (!board.today.entries.length) {
    await screenshot(page, 'empty.png', 'LOCAL QA · EMPTY LOCAL LEADERBOARD');
    checked('Real empty local leaderboard rendered');
  } else {
    // Keep the empty-state check reproducible after a previous successful seed.
    const empty = await openPage();
    const payload = { ...board, today: { ...board.today, entries: [] }, allTime: [],
      champions: board.champions.map(champion => ({ ...champion, entry: null })) };
    await empty.page.route('**/api/leaderboard*', route => route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify(payload) }));
    await empty.page.goto(new URL('/leaderboard', base).href);
    await loaded(empty.page);
    assert.equal(await empty.page.locator('.lb-empty').count(), 2);
    await screenshot(empty.page, 'empty.png', 'LOCAL QA · SIMULATED EMPTY API RESPONSE');
    checked('Empty API response rendered honestly without fabricated rankings');
    await empty.context.close();
  }
  if (seeding) {
    assert.equal(board.storage, 'local', 'Do not seed shared Redis storage');
    report.samples = await page.evaluate(seedSampleEntries);
    await page.locator('[data-lb-refresh]').click();
    await loaded(page);
    board = await overview(page);
    assert(board.today.entries.length >= 5);
    assert(board.champions.filter(champion => champion.entry).length >= 2);
    checked('Replay-verified local samples visible in real API', { today: board.today.entries.length, champions: board.champions.filter(champion => champion.entry).length });
  }

  for (const [name, width, height, mobile] of [['desktop', 1440, 1000, false], ['mobile', 390, 844, true], ['narrow-mobile', 320, 740, true]]) {
    const view = await openPage({ width, height, mobile });
    await view.page.goto(new URL('/leaderboard', base).href);
    await loaded(view.page);
    assert.equal(await view.page.locator('a[href="#today"]').count(), 1);
    assert.equal(await view.page.locator('a[href="#champions"]').count(), 1);
    assert.equal(await view.page.locator('a[href="#all-time"]').count(), 1);
    const layout = await view.page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth,
      sections: ['today', 'champions', 'all-time'].map(id => !!document.getElementById(id)),
      text: document.querySelector('.lb-page')?.textContent }));
    assert(layout.pageWidth <= width, `${name}: horizontal document overflow ${layout.pageWidth} > ${width}`);
    assert(layout.sections.every(Boolean));
    const headerOverlap = await view.page.evaluate(() => {
      const bounds = ['.lb-brand', '.lb-play-link', '#music-toggle'].map(selector => document.querySelector(selector).getBoundingClientRect());
      return bounds.some((a, i) => bounds.slice(i + 1).some(b => Math.min(a.right, b.right) > Math.max(a.left, b.left)
        && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top)));
    });
    assert.equal(headerOverlap, false, `${name}: header/music controls must not overlap`);
    if (seeding) {
      assert(layout.text.includes('guest9201'));
      assert(!layout.text.toLowerCase().includes('0x7b30c6a91df205e48b6203d97af15ce80d429a31'), 'Wallet label should be shortened');
      assert.equal(await view.page.locator('.lb-podium .lb-winner:not(.lb-unclaimed) .lb-portrait svg').count(), 3,
        'Top three must have special crowned hamster portraits');
      assert(await view.page.locator('.lb-theme').count() >= board.today.entries.length,
        'Verified run themes should appear in the rankings');
      assert.equal(await view.page.locator('.lb-champion:not(.lb-champion-empty)').count(),
        board.champions.filter(champion => champion.entry).length);
    }
    checked(`${name} route and responsive layout`, { width, pageWidth: layout.pageWidth });
    if (name !== 'narrow-mobile') await screenshot(view.page, `${name}.png`, seeding ? 'LOCAL QA · REPLAY-VERIFIED SAMPLE RUNS · LOCAL STORE ONLY' : null);
    await view.page.reload();
    await loaded(view.page);
    checked(`${name} direct route reload`);
    await view.context.close();
  }

  // A trusted navigation gesture unlocks quiet music without changing mute state.
  await page.bringToFront();
  await page.locator('a[href="#today"]').click();
  await page.waitForFunction(async () => {
    const resource = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/music.ts');
    return !document.hidden && window.__audioProbe.starts > 0 && (await import(resource?.name || '/src/music.ts')).music.started;
  });
  const playing = await page.evaluate(async () => {
    // Vite may timestamp an import after HMR; use the exact loaded module URL so
    // diagnostics observe the mounted singleton instead of creating a second one.
    const resource = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/music.ts');
    const { music, MUSIC_MAX_GAIN } = await import(resource?.name || '/src/music.ts');
    return { ...window.__audioProbe, scene: music.scene, muted: music.muted, volumePercent: music.volume,
      effectiveMasterGain: MUSIC_MAX_GAIN * music.volume / 100, started: music.started };
  });
  assert.equal(playing.contextsBeforeGesture, 0);
  assert.equal(playing.startsBeforeGesture, 0);
  assert.equal(playing.scene, 'menu');
  assert(playing.started && !playing.muted && playing.effectiveMasterGain > 0 && playing.effectiveMasterGain <= 0.10, JSON.stringify(playing));
  checked('Trusted interaction starts low-volume menu BGM', playing);
  await page.locator('#music-toggle').click();
  assert.equal(await page.locator('#music-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => localStorage.getItem('squeekspire:v1:music-muted')), 'true');
  await page.reload();
  await loaded(page);
  assert.equal(await page.locator('#music-toggle').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => window.__audioProbe.contexts), 0);
  await page.locator('a[href="#today"]').click();
  assert.equal(await page.evaluate(() => window.__audioProbe.starts), 0, 'Muted preference must prevent playback after gesture');
  await page.locator('#music-toggle').click();
  await page.waitForFunction(() => window.__audioProbe.starts > 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('squeekspire:v1:music-muted')), 'false');
  checked('Mute persisted across reload and unmute restarted BGM');

  await page.goto(base.href);
  await page.locator('a[href="/leaderboard"]').waitFor();
  await page.locator('a[href="/leaderboard"]').click();
  await loaded(page);
  assert.equal(new URL(page.url()).pathname, '/leaderboard');
  checked('Main menu leaderboard link works');

  await page.goto(base.href);
  await page.locator('[data-action="start"]').waitFor();
  const menuOverlap = await page.evaluate(() => {
    const music = document.querySelector('#music-toggle').getBoundingClientRect();
    const more = document.querySelector('[data-action="more"]').getBoundingClientRect();
    return Math.max(0, Math.min(music.right, more.right) - Math.max(music.left, more.left))
      * Math.max(0, Math.min(music.bottom, more.bottom) - Math.max(music.top, more.top));
  });
  assert.equal(menuOverlap, 0, 'Music control must not cover the menu More control');
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="mode"][data-mode="practice"]').click();
  await page.locator('[data-action="begin"]').click();
  await page.locator('.enemy-card').first().waitFor();
  const combat = await page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/music.ts');
    const { music } = await import(resource?.name || '/src/music.ts');
    const toggle = document.querySelector('#music-toggle').getBoundingClientRect();
    const end = document.querySelector('[data-action="end-turn"]').getBoundingClientRect();
    return { scene: music.scene, started: music.started,
      overlap: Math.max(0, Math.min(toggle.right, end.right) - Math.max(toggle.left, end.left))
        * Math.max(0, Math.min(toggle.bottom, end.bottom) - Math.max(toggle.top, end.top)) };
  });
  assert.equal(combat.scene, 'combat', 'Starting actual practice combat must switch the BGM track');
  assert(combat.started, 'Combat music must remain active');
  assert.equal(combat.overlap, 0, 'Music control must not cover End Turn');
  checked('Main menu controls remain usable and starting combat switches BGM', combat);
  await settingsDialog(page, 'Desktop');
  const mobileGame = await openPage({ width: 390, height: 844, mobile: true });
  await mobileGame.page.goto(base.href);
  await mobileGame.page.locator('[data-action="start"]').click();
  await mobileGame.page.locator('[data-action="mode"][data-mode="practice"]').click();
  await mobileGame.page.locator('[data-action="begin"]').click();
  await mobileGame.page.locator('.enemy-card').first().waitFor();
  const mobileCombat = await mobileGame.page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/music.ts');
    const { music } = await import(resource?.name || '/src/music.ts');
    const toggle = document.querySelector('#music-toggle').getBoundingClientRect();
    const end = document.querySelector('[data-action="end-turn"]').getBoundingClientRect();
    return { scene: music.scene, started: music.started,
      overlap: Math.max(0, Math.min(toggle.right, end.right) - Math.max(toggle.left, end.left))
        * Math.max(0, Math.min(toggle.bottom, end.bottom) - Math.max(toggle.top, end.top)),
      toggleInViewport: toggle.left >= 0 && toggle.right <= innerWidth };
  });
  assert.equal(mobileCombat.scene, 'combat');
  assert(mobileCombat.started && mobileCombat.toggleInViewport);
  assert.equal(mobileCombat.overlap, 0, 'Mobile music control must not cover End Turn');
  checked('Mobile combat music control remains usable without covering End Turn', mobileCombat);
  await settingsDialog(mobileGame.page, 'Mobile');
  await mobileGame.context.close();
  await page.goto(new URL('/leaderboard', base).href);
  await loaded(page);

  // Deliberate network failure is isolated to this browser context.
  await page.route('**/api/leaderboard*', route => route.abort());
  await page.locator('[data-lb-refresh]').click();
  await loaded(page);
  await page.waitForFunction(() => /unavailable|couldn.t|could not|try again|offline/i.test(document.querySelector('.lb-page')?.textContent || ''));
  await screenshot(page, 'error.png', 'LOCAL QA · SIMULATED API NETWORK FAILURE');
  checked('API error state rendered and refresh remains usable');
  await page.unroute('**/api/leaderboard*');
  await page.locator('[data-lb-refresh]').click();
  await loaded(page);
  checked('Refresh recovered after API failure');
  await context.close();
  assert.deepEqual(report.errors, [], 'No uncaught browser errors');
} catch (error) {
  report.errors.push(error.stack || String(error));
  console.error(error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
