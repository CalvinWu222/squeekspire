/** Read-only browser acceptance and screenshots for the OBS overlay.
 * Run against the loopback dev server. Network fixtures live only in Playwright;
 * no scores are submitted and no production or local leaderboard data is changed.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = new URL(process.env.SQUEEKSPIRE_URL || 'http://127.0.0.1:5173/');
assert(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname),
  'Overlay acceptance only supports an HTTP loopback development server.');
const output = resolve(process.env.SQUEEKSPIRE_OVERLAY_OUTPUT || 'docs/overlay');
await mkdir(output, { recursive: true });
const report = { url: base.href, startedAt: new Date().toISOString(), browser: 'Playwright bundled Chromium',
  fixtureDisclosure: 'Screenshot filenames containing sample use explicitly intercepted browser-only leaderboard and status fixtures. Real filenames use the real same-origin leaderboard and public status endpoints. No data was seeded or submitted.',
  checks: [], screenshots: [], errors: [], requests: [] };
const browser = await chromium.launch({ headless: true });
const checked = (label, detail = {}) => { report.checks.push({ label, passed: true, ...detail }); console.log(`[overlay] ${label}`); };
const href = path => new URL(path, base).href;
const section = name => `[data-section="${name}"]`;
const spinningStatus = { oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'SPINNING', rpmMilli: 178400, distanceMm: 263700, observedAt: new Date().toISOString(), staleAfterSeconds: 120 } };
const idleStatus = { oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'IDLE', rpmMilli: 0, distanceMm: 263700, observedAt: new Date().toISOString(), staleAfterSeconds: 120 } };
const json = (route, data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

async function openPage({ width = 1440, height = 900, mobile = false, status } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => report.requests.push({ method: request.method(), url: request.url() }));
  await context.addInitScript(() => {
    const probe = window.__overlayProbe = { providerReads: 0, providerCalls: 0, audioContexts: 0, mediaPlays: 0, storageWrites: [] };
    Object.defineProperty(window, 'ethereum', { configurable: true, get() { probe.providerReads++; return { request() { probe.providerCalls++; throw new Error('Overlay requested a wallet'); } }; } });
    for (const name of ['AudioContext', 'webkitAudioContext']) {
      const Native = window[name];
      if (Native) window[name] = class extends Native { constructor(...args) { super(...args); probe.audioContexts++; } };
    }
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) { probe.mediaPlays++; return play.apply(this, args); };
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { probe.storageWrites.push(String(key)); return setItem.call(this, key, value); };
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) { probe.storageWrites.push(`remove:${String(key)}`); return removeItem.call(this, key); };
    const clear = Storage.prototype.clear;
    Storage.prototype.clear = function () { probe.storageWrites.push('clear'); return clear.call(this); };
  });
  if (status) await context.route('https://api.squeekchain.com/v1/status', route => json(route, status));
  return { context, page };
}

async function loaded(page) {
  await page.locator('.ov-shell').waitFor();
  await page.waitForFunction(() => document.querySelector('.ov-shell')
    && document.querySelector('[data-section="status"]')?.dataset.state !== 'loading'
    && !document.querySelector('.ov-waiting')
    && !/Reading today/i.test(document.querySelector('[data-section="board"]')?.textContent || ''));
  await page.evaluate(() => document.fonts.ready);
}

async function noSideEffects(page, label) {
  const probe = await page.evaluate(() => window.__overlayProbe);
  assert.deepEqual(probe, { providerReads: 0, providerCalls: 0, audioContexts: 0, mediaPlays: 0, storageWrites: [] }, label);
  assert.equal(await page.locator('#music-toggle, [data-action="wallet-connect"], .wallet-panel').count(), 0);
  const loadedModules = await page.evaluate(() => performance.getEntriesByType('resource').map(resource => new URL(resource.name).pathname));
  assert(!loadedModules.some(path => /\/src\/(main|wallet|music)\.ts$/.test(path)), `${label}: overlay must avoid game, wallet and music boot`);
  checked(label, { probe });
}

async function shot(page, name, disclosure, { transparent = false, fullPage = true } = {}) {
  await page.screenshot({ path: resolve(output, name), fullPage, omitBackground: transparent });
  report.screenshots.push({ file: name, url: page.url(), viewport: page.viewportSize(), fullPage, data: disclosure });
}

async function realDaily(page) {
  return page.evaluate(async () => {
    const { loadDay } = await import('/src/game/data.ts');
    const { generateMap } = await import('/src/game/map.ts');
    const { ENEMIES } = await import('/src/game/catalog.ts');
    const day = await loadDay();
    const map = generateMap(day), boss = map.find(node => node.kind === 'boss');
    return { day: day.day, seed: day.seed, difficulty: day.difficulty, source: day.source, boss: ENEMIES[boss.enemyId].name, mapSize: map.length };
  });
}

function sampleBoard(board) {
  return { ...board, today: { ...board.today, entries: [
    ['guest8451', 36750, 24, true], ['guest8462', 29800, 24, true], ['guest8473', 18750, 22, false],
    ['0x7B30C6a91DF205E48b6203d97aF15cE80D429a31', 14650, 18, false], ['guest8495', 12100, 16, false],
    ['guest8406', 10500, 15, false],
  ].map(([profile, score, floor, won], i) => ({ id: `browser-fixture-${i}`, profile, score, floor, won,
    mode: 'daily', day: board.today.day, seed: board.today.seed, bestHit: 180, hibernation: false,
    scoreVersion: board.scoreVersion, createdAt: new Date().toISOString(), deckTheme: 'Fixture sample' })) } };
}

// A browser source stays truly transparent. This compositing host makes its
// alpha visible against a checkerboard and a small original game-like scene.
async function composition(context, layout, filename, fixture) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const url = href(`/overlay?layout=${layout}&scale=1&show=status,boss,board&bg=transparent`);
  const sourceWidth = layout === 'bar' ? 1200 : 440, sourceHeight = layout === 'bar' ? 284 : 716;
  const hostHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#0d0a18;color:#f1e9ff;font:14px/1.5 Consolas,monospace;overflow:hidden}
    .scene{height:1000px;position:relative;background:radial-gradient(ellipse at 52% 44%,#33234c55,transparent 60%),linear-gradient(0deg,#0f0a1be8,#100b1b66),repeating-conic-gradient(#21172e 0% 25%,#160f22 0% 50%) 0/48px 48px}
    header{position:absolute;inset:36px 48px auto;display:flex;justify-content:space-between;font-size:11px;letter-spacing:2px;color:#aa90be}h1{font-size:26px;letter-spacing:4px;margin:0;color:#f4ddff}header span{color:#cba8e7}
    .tower{position:absolute;right:220px;bottom:0;width:320px;height:570px;opacity:.22;background:repeating-linear-gradient(0deg,transparent 0 68px,#b978e2 68px 72px),repeating-linear-gradient(90deg,#321b4c 0 76px,#aa6ad6 76px 80px);clip-path:polygon(15% 100%,15% 8%,30% 8%,30% 0,45% 0,45% 8%,60% 8%,60% 0,75% 0,75% 8%,85% 8%,85% 100%)}
    .platform{position:absolute;left:0;right:0;bottom:142px;height:10px;background:#392646;box-shadow:0 10px #100b1a,0 -3px #553368}.moon{position:absolute;left:23%;top:27%;width:98px;height:98px;border:10px solid #9778bd2f;box-shadow:0 0 80px #9264b31a}
    .tag{position:absolute;bottom:46px;left:48px;color:#b79ac9;font-size:11px;letter-spacing:2px}.tag b{color:#e8d0fb}
    iframe{position:absolute;border:0;background:transparent;width:${sourceWidth}px;height:${sourceHeight}px;${layout === 'bar' ? 'left:120px;bottom:168px' : 'left:66px;top:130px'};filter:drop-shadow(0 12px 30px #0008)}
  </style></head><body><main class="scene"><header><div><h1>SQUEEKSPIRE</h1><span>OBS BROWSER SOURCE / ${layout.toUpperCase()} LAYOUT</span></div><div>${fixture ? 'BROWSER-ONLY SAMPLE DATA' : 'REAL LOCAL API DATA'}<br>TRANSPARENT SOURCE · CHECKERBOARD GAME SCENE</div></header><div class="moon"></div><div class="tower"></div><div class="platform"></div><iframe title="Squeekspire OBS source preview" src="${url}"></iframe><div class="tag"><b>${fixture ? 'FIXTURE PREVIEW' : 'LIVE PREVIEW'}</b> / ${fixture ? 'Sample board + hamster status intercepted in this browser only. No scores submitted.' : 'Real same-origin leaderboard, including an honest empty board when no runs exist.'}</div></main></body></html>`;
  await page.route('**/__overlay-composition__', route => route.fulfill({ contentType: 'text/html', body: hostHtml }));
  await page.goto(href('/__overlay-composition__'));
  const frame = page.frameLocator('iframe');
  await frame.locator('.ov-shell').waitFor();
  await page.waitForFunction(() => {
    const doc = document.querySelector('iframe')?.contentDocument;
    return doc?.querySelector('.ov-shell') && doc.querySelector('[data-section="status"]')?.dataset.state !== 'loading'
      && !doc.querySelector('.ov-waiting') && !/Reading today/i.test(doc.querySelector('[data-section="board"]')?.textContent || '');
  });
  await page.evaluate(() => document.querySelector('iframe').contentDocument.fonts.ready);
  const bounds = await frame.locator('.ov-shell').boundingBox();
  assert(bounds.width <= sourceWidth + 1 && bounds.height <= sourceHeight + 1, `${layout} must fit recommended browser source ${sourceWidth}×${sourceHeight}: ${JSON.stringify(bounds)}`);
  await shot(page, filename, fixture ? 'Explicit browser-only sample leaderboard/status fixtures, visibly labelled in composition.' : 'Real same-origin leaderboard and public hamster status; no fixture interception.');
  await page.close();
}

try {
  const real = await openPage();
  const response = await real.page.request.get(href('/api/leaderboard?view=overview'));
  assert.equal(response.status(), 200, 'Real same-origin leaderboard overview must respond');
  const board = await response.json();
  assert(Array.isArray(board.today?.entries));
  report.realOverview = { day: board.today.day, seed: board.today.seed, entries: board.today.entries.length, storage: board.storage };
  await real.page.goto(href('/overlay'));
  await loaded(real.page);
  const daily = await realDaily(real.page);
  report.daily = daily;
  assert.equal(board.today.day, daily.day);
  assert.equal(board.today.seed, daily.seed, 'Board and overlay must use the same published daily seed');
  const text = await real.page.locator('.ov-shell').innerText();
  assert(text.includes(daily.day));
  assert(text.toUpperCase().includes(daily.seed.toString(16).padStart(8, '0').toUpperCase()));
  assert(text.includes(daily.boss));
  const alpha = await real.page.evaluate(() => ({ html: getComputedStyle(document.documentElement).backgroundColor, body: getComputedStyle(document.body).backgroundColor }));
  assert.equal(alpha.html, 'rgba(0, 0, 0, 0)');
  assert.equal(alpha.body, 'rgba(0, 0, 0, 0)');
  checked('Real overview and shared daily seed, boss, UTC day and transparent HTML/body', { daily, alpha, realEntryCount: board.today.entries.length });
  await noSideEffects(real.page, 'Overlay opens without wallet access, music, storage writes or game boot');
  await shot(real.page, 'source-transparent.png', 'Real same-origin leaderboard and public status.', { transparent: true });
  await composition(real.context, 'bar', 'bar-real.png', false);
  await composition(real.context, 'card', 'card-real.png', false);

  const fixture = await openPage({ status: spinningStatus });
  const fixtureBoard = sampleBoard(board);
  await fixture.context.route('**/api/leaderboard?view=overview', route => json(route, fixtureBoard));
  for (const layout of ['bar', 'card']) {
    await fixture.page.goto(href(`/overlay?layout=${layout}&scale=1&show=status,boss,board&bg=transparent`));
    await loaded(fixture.page);
    assert.equal(await fixture.page.locator('.ov-shell').getAttribute('data-layout'), layout);
    assert.match(await fixture.page.locator(section('status')).innerText(), /SPINNING/);
    assert.equal(await fixture.page.locator(`${section('board')} .ov-rankings li`).count(), layout === 'bar' ? 3 : 5);
    assert(!(await fixture.page.locator(section('board')).innerText()).includes('guest8406'), 'Only top 3–5 rows appear');
    checked(`${layout} layout renders live SPINNING status and top ${layout === 'bar' ? 3 : 5} rows`);
    await composition(fixture.context, layout, `${layout}-sample.png`, true);
  }
  await fixture.page.goto(href('/overlay?layout=card&scale=1.5&show=status&bg=dark'));
  await loaded(fixture.page);
  assert.equal(await fixture.page.locator(section('status')).count(), 1);
  assert.equal(await fixture.page.locator(section('boss')).count(), 0);
  assert.equal(await fixture.page.locator(section('board')).count(), 0);
  const scaled = await fixture.page.locator('.ov-stage').evaluate(el => ({ transform: getComputedStyle(el).transform, zoom: getComputedStyle(el).zoom }));
  assert(scaled.transform.includes('1.5') || Number(scaled.zoom) === 1.5, `Scale must affect the source: ${JSON.stringify(scaled)}`);
  const dark = await fixture.page.evaluate(() => [getComputedStyle(document.documentElement).backgroundColor, getComputedStyle(document.body).backgroundColor]);
  assert(dark.some(color => color !== 'rgba(0, 0, 0, 0)'));
  checked('URL show, scale and dark background parameters', { scaled, dark });
  await noSideEffects(fixture.page, 'Configured overlay remains read-only without wallet, audio or saved-data writes');
  await fixture.page.goto(href('/overlay?layout=unknown&scale=invalid&show=wallet&bg=unknown'));
  await loaded(fixture.page);
  assert.equal(await fixture.page.locator('.ov-shell').getAttribute('data-layout'), 'bar');
  assert.equal(await fixture.page.locator('.ov-shell').getAttribute('data-bg'), 'transparent');
  assert.equal(await fixture.page.locator('[data-section]').count(), 3);
  assert.equal(await fixture.page.locator('.ov-stage').evaluate(el => getComputedStyle(el).getPropertyValue('--ov-scale')), '1');
  checked('Invalid URL parameters fall back to a complete visible transparent overlay');
  await fixture.context.close();

  // The browser clock advances the real 15-second scheduler; requests are
  // intercepted to exercise errors and recovery without modifying any service.
  const resilience = await openPage();
  await resilience.page.clock.install();
  let state = 'spinning', statusRequests = 0, boardRequests = 0;
  await resilience.context.route('https://api.squeekchain.com/v1/status', route => { statusRequests++; return state === 'error' ? json(route, { error: 'qa_simulated' }, 503) : json(route, state === 'idle' ? idleStatus : spinningStatus); });
  await resilience.context.route('**/api/leaderboard?view=overview', route => { boardRequests++; return state === 'error' ? json(route, { error: 'qa_simulated' }, 503) : json(route, fixtureBoard); });
  await resilience.page.goto(href('/overlay?layout=card'));
  await loaded(resilience.page);
  const counts = { status: statusRequests, board: boardRequests };
  state = 'error';
  await resilience.page.clock.fastForward(16000);
  await resilience.page.waitForFunction(() => /unavailable|offline|stale|retry|refresh missed/i.test(document.querySelector('.ov-shell')?.textContent || ''));
  assert(statusRequests > counts.status && boardRequests > counts.board, 'Both APIs must poll after about 15 seconds');
  checked('Both sources automatically refresh around 15 seconds and API errors degrade visibly', { statusRequests, boardRequests });
  await shot(resilience.page, 'error-simulated.png', 'Explicit browser-only HTTP 503 status and overview responses after successful fixture load.');
  state = 'idle';
  await resilience.page.clock.fastForward(16000);
  await resilience.page.waitForFunction(() => /IDLE/i.test(document.querySelector('[data-section="status"]')?.textContent || '') && !/unavailable|offline|stale|retry|refresh missed/i.test(document.querySelector('.ov-shell')?.textContent || ''));
  checked('Automatic refresh recovers after an outage and displays idle with zero RPM');
  await noSideEffects(resilience.page, 'Polling and recovery introduce no wallet, audio or storage side effects');
  await resilience.context.close();

  const rollover = await openPage();
  await rollover.page.clock.install({ time: new Date(`${board.today.day}T23:59:50.000Z`) });
  let rolloverBoard = fixtureBoard;
  await rollover.context.route('**/api/leaderboard?view=overview', route => json(route, rolloverBoard));
  await rollover.page.goto(href('/overlay?layout=card&show=boss,board'));
  await loaded(rollover.page);
  const nextDay = new Date(Date.parse(`${board.today.day}T00:00:00.000Z`) + 86400000).toISOString().slice(0, 10);
  const nextDaily = await rollover.page.evaluate(async date => {
    const { loadPublishedDay } = await import('/src/game/data.ts');
    const day = await loadPublishedDay(date);
    return { day: day.day, seed: day.seed };
  }, nextDay);
  rolloverBoard = { ...fixtureBoard, today: { ...fixtureBoard.today, ...nextDaily,
    entries: fixtureBoard.today.entries.map(row => ({ ...row, day: nextDaily.day, seed: nextDaily.seed })) } };
  await rollover.page.clock.fastForward(16000);
  await rollover.page.waitForFunction(({ day, seed }) => {
    const boss = document.querySelector('[data-section="boss"]')?.textContent || '';
    const board = document.querySelector('[data-section="board"]')?.textContent || '';
    return boss.includes(day) && boss.toUpperCase().includes(seed) && board.toUpperCase().includes(seed) && !!document.querySelector('.ov-rankings li');
  }, { day: nextDaily.day, seed: nextDaily.seed.toString(16).padStart(8, '0').toUpperCase() });
  checked('UTC midnight polling updates both the daily map and matching leaderboard seed', { before: board.today, after: nextDaily });
  await rollover.context.close();

  for (const [name, width, height, mobile] of [['setup-desktop.png', 1440, 1100, false], ['setup-mobile.png', 390, 844, true]]) {
    const setup = await openPage({ width, height, mobile, status: spinningStatus });
    await setup.context.route('**/api/leaderboard?view=overview', route => json(route, board));
    await setup.page.goto(href('/overlay/setup'));
    await setup.page.locator('iframe').first().waitFor();
    await setup.page.frameLocator('iframe').first().locator('.ov-shell').waitFor();
    assert.match(await setup.page.locator('body').innerText(), /OBS/);
    const urls = await setup.page.locator('input').evaluateAll(inputs => inputs.map(input => input.value).filter(value => value.includes('/overlay?')));
    assert(urls.length >= 1, 'Setup must provide a copyable overlay URL');
    assert(urls.every(url => new URL(url).origin === base.origin));
    assert(await setup.page.locator('button').filter({ hasText: /copy/i }).count() >= 1, 'Setup has copy controls');
    const widthCheck = await setup.page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert(widthCheck.document <= widthCheck.viewport, `${name} has horizontal overflow`);
    await setup.page.evaluate(() => document.fonts.ready);
    await shot(setup.page, name, 'Setup uses real same-origin leaderboard. Hamster status is a browser-only SPINNING fixture for stable preview.');
    checked(`${name} copyable same-origin URL, live iframe preview and responsive page`, widthCheck);
    if (!mobile) {
      await setup.context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await setup.page.locator('[data-os-copy]').click();
      await setup.page.waitForFunction(() => /copied/i.test(document.querySelector('[data-os-copy-status]')?.textContent || ''));
      assert.equal(await setup.page.evaluate(() => navigator.clipboard.readText()), await setup.page.locator('[data-os-url]').inputValue());
      await setup.page.locator('label').filter({ has: setup.page.locator('input[name="layout"][value="card"]') }).click();
      await setup.page.locator('#os-scale').fill('1.5');
      await setup.page.locator('#os-scale').dispatchEvent('input');
      await setup.page.locator('label').filter({ has: setup.page.locator('input[name="show"][value="board"]') }).click();
      await setup.page.locator('label').filter({ has: setup.page.locator('input[name="bg"][value="dark"]') }).click();
      const configured = new URL(await setup.page.locator('[data-os-url]').inputValue());
      assert.equal(configured.searchParams.get('layout'), 'card');
      assert.equal(configured.searchParams.get('scale'), '1.5');
      assert.equal(configured.searchParams.get('show'), 'status,boss');
      assert.equal(configured.searchParams.get('bg'), 'dark');
      assert.equal(await setup.page.locator('iframe').getAttribute('src'), configured.href);
      assert.equal(await setup.page.locator('[data-os-width]').innerText(), '1920');
      assert.equal(await setup.page.locator('[data-os-height]').innerText(), '1080');
      checked('Setup copies the exact URL and configuration updates the live preview and OBS source dimensions');
    }
    await noSideEffects(setup.page, `${name} setup introduces no wallet, audio or storage side effects`);
    await setup.context.close();
  }

  await real.page.goto(href('/leaderboard'));
  const setupLink = real.page.locator('footer a[href="/overlay/setup"]');
  await setupLink.waitFor();
  await setupLink.click();
  await real.page.locator('iframe').first().waitFor();
  assert.equal(new URL(real.page.url()).pathname, '/overlay/setup');
  checked('Leaderboard footer links to the directly reloadable OBS setup route');
  await real.context.close();
  const writes = report.requests.filter(request => !['GET', 'HEAD', 'OPTIONS'].includes(request.method));
  assert.deepEqual(writes, [], 'Browser acceptance never sends write requests');
  checked('All observed HTTP requests are read-only', { requestCount: report.requests.length });
  assert.deepEqual(report.errors, [], 'No uncaught browser errors');
} catch (error) {
  report.errors.push(error.stack || String(error));
  console.error(error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'verification.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
