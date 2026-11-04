/** Seed legal sample runs through the local HTTP API and capture the real board.
 * Start npm.cmd run dev, then run node scripts/shots-online.mjs.
 * Only loopback URLs are allowed. No credentials or external network are needed.
 * Sample entries live in the local development store, never in shipped game data.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.SQUEEKSPIRE_URL || 'http://127.0.0.1:5173/';
const origin = new URL(baseUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) {
  throw new Error('This sample-data screenshot script only supports a local development server.');
}
const debugPort = Number(process.env.SQUEEKSPIRE_CDP_PORT || 9348);
const outputDir = resolve('shots/online');
const profileDir = resolve('.tmp/online-edge');
const edge = `${process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'}\\Microsoft\\Edge\\Application\\msedge.exe`;
const sleep = ms => new Promise(done => setTimeout(done, ms));
const report = { url: baseUrl, startedAt: new Date().toISOString(), samples: [], screenshots: [], checks: [], blockedExternalRequests: [], errors: [] };
let browser, socket;
let offlineApi = false;
let nextId = 0;
const pending = new Map();
const log = (label, value) => console.log(`[online] ${label}${value === undefined ? '' : ` ${JSON.stringify(value)}`}`);

async function until(description, check, timeoutMs = 15000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try { const result = await check(); if (result) return result; }
    catch (error) { lastError = error; }
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}
function send(method, params = {}, timeoutMs = 15000) {
  return new Promise((done, fail) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`CDP timeout: ${method}`)); }, timeoutMs);
    pending.set(id, { done, fail, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, 30000);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}
async function click(selector) {
  const point = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element || element.disabled) return null;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return hit && (hit === element || element.contains(hit)) ? { x, y } : null;
  })()`);
  if (!point) throw new Error(`Control unavailable or covered: ${selector}`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
}
async function check(label, expression) {
  const result = await evaluate(expression);
  report.checks.push({ label, ...result });
  log(label, result);
  if (!result.passed) throw new Error(`Smoke check failed: ${label}`);
  return result;
}
async function screenshot(name) {
  await evaluate('document.fonts.ready.then(() => true)');
  await sleep(150);
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = Buffer.from(result.data, 'base64');
  await writeFile(resolve(outputDir, `${name}.png`), data);
  const item = { file: `${name}.png`, width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  report.screenshots.push(item);
  log('Captured', item);
}

// Runs unchanged deterministic rules. The bot chooses only legal starter cards,
// skips reward cards, and retires after different battle counts for varied scores.
async function seedSampleEntries() {
  const [{ fallbackDay, getGameDay }, { generateMap }, engine, { CARDS }, storage] = await Promise.all([
    import('/src/game/data.ts'), import('/src/game/map.ts'), import('/src/game/engine.ts'),
    import('/src/game/catalog.ts'), import('/src/game/storage.ts'),
  ]);
  const day = fallbackDay(getGameDay());
  const profiles = ['guest9101', 'guest9102', 'guest9103', 'guest9104', '0x7B30C6a91DF205E48b6203d97aF15cE80D429a31'];
  const samples = [];
  for (let sample = 0; sample < profiles.length; sample++) {
    let run = engine.createRun(day, generateMap(day), 'daily');
    let decisions = 0;
    while (!['won', 'lost'].includes(run.phase) && decisions++ < 1500) {
      let action;
      if (run.battles >= sample + 1) action = { type: 'abandon' };
      else if (run.phase === 'map') action = { type: 'enter', nodeId: run.reachable[0] };
      else if (run.phase === 'rest') action = { type: 'rest', option: 'heal' };
      else if (run.phase === 'shop' || run.phase === 'event') action = { type: 'leave' };
      else if (run.phase === 'reward') action = { type: 'reward', cardId: null };
      else {
        const playable = run.combat.hand.filter(card => CARDS[card.id].cost !== 'X' && CARDS[card.id].cost <= run.combat.energy);
        const card = playable.find(card => CARDS[card.id].type === 'attack') || playable[0];
        action = card ? { type: 'play', uid: card.uid } : { type: 'endTurn' };
      }
      run = engine.act(run, action);
    }
    if (!['won', 'lost'].includes(run.phase)) run = engine.act(run, { type: 'abandon' });
    if (run.totalScore <= 0) throw new Error(`Sample ${sample + 1} did not earn a legal battle score`);
    const exported = engine.exportRun(run);
    engine.replayRun(exported, day);
    if (sample === 0) storage.recordResult(run, profiles[sample]);
    const response = await fetch('/api/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: day.seed, run: exported, identity: profiles[sample].startsWith('0x')
        ? { walletAddress: profiles[sample] } : { guestId: profiles[sample] } }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(`Sample submission rejected (${response.status}): ${JSON.stringify(result)}`);
    samples.push({ profile: profiles[sample], day: day.day, seed: day.seed, actions: run.log.length,
      battles: run.battles, score: run.totalScore, bestHit: run.bestHit, floor: run.floor, status: response.status });
  }
  const params = new URLSearchParams({ mode: 'daily', seed: String(day.seed), runMode: 'daily' });
  const response = await fetch(`/api/leaderboard?${params}`);
  const board = await response.json();
  if (!response.ok || !Array.isArray(board.entries)
    || !profiles.every(profile => board.entries.some(entry => entry.profile.toLowerCase() === profile.toLowerCase()))) {
    throw new Error(`Local API did not return all submitted sample entries: ${JSON.stringify(board)}`);
  }
  return { samples, entries: board.entries.length };
}

try {
  await mkdir(outputDir, { recursive: true });
  await mkdir(profileDir, { recursive: true });
  await until('local development server', async () => (await fetch(baseUrl, { signal: AbortSignal.timeout(1500) })).ok);
  browser = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-gpu-sandbox',
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-default-apps', '--metrics-recording-only',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`,
    '--window-size=1440,1200', 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  browser.on('error', error => report.errors.push(error.message));
  const target = await until('Edge CDP page', async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json`, { signal: AbortSignal.timeout(1500) });
    return (await response.json()).find(item => item.type === 'page' && item.webSocketDebuggerUrl);
  }, 40000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const command = pending.get(message.id);
    if (command) {
      clearTimeout(command.timer); pending.delete(message.id);
      if (message.error) command.fail(new Error(JSON.stringify(message.error)));
      else command.done(message.result);
    }
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params;
      const url = new URL(request.url);
      const external = url.origin !== origin.origin;
      const blocked = external || (offlineApi && url.pathname.startsWith('/api/'));
      if (external) report.blockedExternalRequests.push(request.url);
      void send(blocked ? 'Fetch.failRequest' : 'Fetch.continueRequest', blocked
        ? { requestId, errorReason: 'BlockedByClient' } : { requestId })
        .catch(error => report.errors.push(error.message));
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      report.errors.push(details.exception?.description || details.text);
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://*'] });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1200, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: baseUrl });
  await until('main menu', () => evaluate('Boolean(document.querySelector("[data-action=more]"))'));
  await evaluate('localStorage.clear()');
  await send('Page.reload');
  await until('fresh main menu', () => evaluate('Boolean(document.querySelector("[data-action=more]"))'));
  const seeded = await evaluate(`(${seedSampleEntries.toString()})()`);
  report.samples = seeded.samples;
  report.checks.push({ label: 'actual-http-api-replay-accepted', passed: true, entries: seeded.entries });
  log('Submitted replay-verified samples', seeded.samples);
  await click('[data-action="more"]');
  await until('global leaderboard', () => evaluate('document.querySelector(".leaderboard h2")?.textContent === "Global leaderboard"'));
  await check('global-rows-and-wallet-label', `(() => {
    const board = document.querySelector('.leaderboard');
    const rows = [...board.querySelectorAll('.leaderboard-row')];
    const text = board.textContent;
    const rect = board.getBoundingClientRect();
    return { rows: rows.length, title: board.querySelector('h2').textContent,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      fullyVisible: rect.top >= 0 && rect.bottom <= innerHeight,
      passed: rows.length >= 5 && text.includes('guest9101') && /0x7B30.{1,5}9a31/i.test(text)
        && !text.includes('0x7B30C6a91DF205E48b6203d97aF15cE80D429a31')
        && rect.top >= 0 && rect.bottom <= innerHeight
        && document.documentElement.scrollWidth <= innerWidth };
  })()`);
  await screenshot('leaderboard');

  offlineApi = true;
  await click('[data-action="board-refresh"]');
  await until('offline local fallback', () => evaluate('document.querySelector(".leaderboard h2")?.textContent === "Offline - local scores"'));
  await check('offline-local-results', `(() => {
    const board = document.querySelector('.leaderboard');
    const rows = [...board.querySelectorAll('.leaderboard-row')];
    return { title: board.querySelector('h2').textContent, rows: rows.length,
      passed: rows.length === 1 && rows[0].textContent.includes('guest9101')
        && board.textContent.includes('Showing scores saved on this device') };
  })()`);
  await screenshot('leaderboard-offline');
  offlineApi = false;
  await click('[data-action="board-refresh"]');
  await until('global board recovery', () => evaluate('document.querySelector(".leaderboard h2")?.textContent === "Global leaderboard"'));
  await check('global-recovery', `({ rows: document.querySelectorAll('.leaderboard-row').length,
    passed: document.querySelectorAll('.leaderboard-row').length >= 5 })`);
  if (report.errors.length) throw new Error(`${report.errors.length} unexpected page/browser error(s)`);
  log('Complete', { screenshots: report.screenshots.length, checks: report.checks.length, errors: report.errors.length });
} catch (error) {
  report.errors.push(error.stack || error.message || String(error));
  console.error('[online] Failed:', error);
  process.exitCode = 1;
  try { if (socket?.readyState === WebSocket.OPEN) await screenshot('capture-failure'); }
  catch { /* Preserve the original failure. */ }
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close', {}, 2000); } catch { /* Edge may close before replying. */ }
    socket.close();
  }
  for (const command of pending.values()) clearTimeout(command.timer);
  if (browser && browser.exitCode === null) browser.kill();
}
