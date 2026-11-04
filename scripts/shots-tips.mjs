/** Capture and exercise the five-card guide with installed headless Edge.
 * Start npm.cmd run preview, then run node scripts/shots-tips.mjs.
 * SQUEEKSPIRE_URL optionally overrides http://127.0.0.1:4173/.
 * Uses a dedicated browser profile; never touches a normal Edge profile.
 * Pass --wallet to capture the wallet menu and all English tips in shots/wallet/.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.SQUEEKSPIRE_URL || 'http://127.0.0.1:4173/';
const debugPort = Number(process.env.SQUEEKSPIRE_CDP_PORT || 9346);
const captureWallet = process.argv.includes('--wallet');
const outputDir = resolve(captureWallet ? 'shots/wallet' : 'shots/tips');
const profileDir = resolve(captureWallet ? '.tmp/wallet-edge' : '.tmp/tips-edge');
const edge = `${process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'}\\Microsoft\\Edge\\Application\\msedge.exe`;
const sleep = ms => new Promise(done => setTimeout(done, ms));
const report = { url: baseUrl, startedAt: new Date().toISOString(), screenshots: [], checks: [], errors: [] };
let browser;
let socket;
let nextId = 0;
const pending = new Map();
const log = (message, value) => console.log(`[tips] ${message}${value === undefined ? '' : ` ${JSON.stringify(value)}`}`);

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
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}
const exists = selector => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`);
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
  await sleep(100);
}
async function expectPage(index) {
  await until(`tip ${index + 1}`, () => exists(`.guide-page[data-guide-page="${index}"]`));
}
async function check(label, expression) {
  const result = await evaluate(expression);
  report.checks.push({ label, ...result });
  log(label, result);
  if (!result.passed) throw new Error(`Guide check failed: ${label}`);
  return result;
}
async function viewport(width, height, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 1 });
  await sleep(150);
}
async function screenshot(name) {
  await evaluate('document.fonts.ready.then(() => true)');
  await sleep(150);
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const data = Buffer.from(result.data, 'base64');
  await writeFile(resolve(outputDir, `${name}.png`), data);
  const state = await evaluate(`(() => {
    const modal = document.querySelector('.modal');
    const details = document.querySelector('.guide-details');
    return { viewport: { width: innerWidth, height: innerHeight },
      card: Number(document.querySelector('.guide-page')?.dataset.guidePage),
      title: document.querySelector('.guide-copy h2')?.textContent,
      detailsExpanded: Boolean(details?.open),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      modalHorizontalOverflow: Boolean(modal && modal.scrollWidth > modal.clientWidth + 1),
      modalScrollTop: modal?.scrollTop, modalScrollHeight: modal?.scrollHeight,
      modalClientHeight: modal?.clientHeight };
  })()`);
  const item = { file: `${name}.png`, width: data.readUInt32BE(16), height: data.readUInt32BE(20), ...state };
  report.screenshots.push(item);
  log('Captured', item);
  if (item.horizontalOverflow || item.modalHorizontalOverflow) throw new Error(`${name}: horizontal overflow`);
}
async function guideLayout(label, page) {
  return check(label, `(() => {
    const article = document.querySelector('.guide-page');
    const controls = [...document.querySelectorAll('.guide-nav button,.guide-details summary')].map(element => {
      const rect = element.getBoundingClientRect();
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { text: element.textContent.trim(), disabled: Boolean(element.disabled),
        width: rect.width, height: rect.height,
        inViewport: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        uncovered: Boolean(hit && (hit === element || element.contains(hit))) };
    });
    const dots = [...document.querySelectorAll('.guide-dot')];
    const nav = document.querySelectorAll('.guide-nav > button');
    const art = article?.querySelector('.guide-art svg[role="img"][aria-label]');
    const horizontalOverflow = document.documentElement.scrollWidth > innerWidth;
    return { page: article?.dataset.guidePage, dots: dots.length, controls, horizontalOverflow,
      passed: !/[\u3400-\u9fff]/u.test(document.querySelector('#app').textContent)
        && document.documentElement.lang === 'en'
        && article?.dataset.guidePage === '${page}' && dots.length === 5
        && dots[${page}]?.getAttribute('aria-current') === 'page'
        && Boolean(art) && Boolean(document.querySelector('.guide-details summary'))
        && nav[0]?.disabled === ${page === 0} && nav[1]?.disabled === ${page === 4}
        && controls.every(control => control.inViewport && control.uncovered)
        && !horizontalOverflow };
  })()`);
}
async function showPage(page) {
  await click(`.guide-dot[data-action="guide-page"][data-page="${page}"]`);
  await expectPage(page);
}
async function swipe(direction) {
  const geometry = await evaluate(`(() => {
    const rect = document.querySelector('.guide-page').getBoundingClientRect();
    return { left: Math.max(24, rect.left + 30), right: Math.min(innerWidth - 24, rect.right - 30),
      y: Math.max(80, Math.min(innerHeight - 150, rect.top + Math.min(rect.height / 3, 140))) };
  })()`);
  const startX = direction === 'left' ? geometry.right : geometry.left;
  const endX = direction === 'left' ? geometry.left : geometry.right;
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: geometry.y, id: 1 }] });
  for (let step = 1; step <= 8; step++) {
    await sleep(22);
    await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
      { x: startX + (endX - startX) * step / 8, y: geometry.y, id: 1 },
    ] });
  }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(150);
}
async function captureDetails(label) {
  await click('.guide-details summary');
  await until('expanded More details', () => evaluate('document.querySelector(".guide-details").open'));
  await check(`${label}-details-expanded`, `(() => {
    const details = document.querySelector('.guide-details');
    return { open: details.open, ruleTextLength: details.textContent.trim().length,
      passed: details.open && details.textContent.trim().length > 250 };
  })()`);
  await screenshot(`tips-${label}-details`);
  const scroll = await evaluate(`(() => {
    const details = document.querySelector('.guide-details');
    for (let element = details.parentElement; element; element = element.parentElement) {
      if (element.scrollHeight > element.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(element).overflowY)) {
        const before = element.scrollTop;
        element.scrollTop = element.scrollHeight;
        return { scrollable: true, before, after: element.scrollTop, className: element.className,
          viewportHeight: element.clientHeight };
      }
    }
    return { scrollable: false };
  })()`);
  report.checks.push({ label: `${label}-details-scroll`, ...scroll, passed: !scroll.scrollable || scroll.after > 0 });
  if (scroll.scrollable && scroll.after <= 0) throw new Error(`${label}: expanded details cannot scroll`);
  if (scroll.scrollable && scroll.after > scroll.viewportHeight) {
    await evaluate(`(() => {
      for (let element = document.querySelector('.guide-details').parentElement; element; element = element.parentElement) {
        if (element.scrollHeight > element.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(element).overflowY)) {
          element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
          return;
        }
      }
    })()`);
    await screenshot(`tips-${label}-details-middle`);
    await evaluate(`(() => {
      for (let element = document.querySelector('.guide-details').parentElement; element; element = element.parentElement) element.scrollTop = element.scrollHeight;
    })()`);
  }
  if (scroll.scrollable) await screenshot(`tips-${label}-details-bottom`);
  await evaluate(`(() => {
    document.querySelector('.guide-details').open = false;
    for (let element = document.querySelector('.guide-details').parentElement; element; element = element.parentElement) element.scrollTop = 0;
  })()`);
}

try {
  await mkdir(outputDir, { recursive: true });
  await mkdir(profileDir, { recursive: true });
  await until('preview server', async () => (await fetch(baseUrl, { signal: AbortSignal.timeout(1500) })).ok);
  browser = spawn(edge, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-gpu-sandbox',
    '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`,
    '--window-size=1280,800', 'about:blank',
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
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      report.errors.push(details.exception?.description || details.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      report.errors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
    }
  };
  await send('Page.enable');
  await send('Runtime.enable');
  await viewport(1280, 800);
  await send('Page.navigate', { url: baseUrl });
  await until('main menu', () => exists('[data-action="help"]'));
  await evaluate('localStorage.clear()');
  await send('Page.reload');
  await until('fresh main menu', () => exists('[data-action="help"]'));
  if (captureWallet) {
    await check('desktop-wallet-menu', `({ passed: Boolean(document.querySelector('.wallet-menu [data-action="wallet-connect"]')) && document.documentElement.lang === 'en' })`);
    await screenshot('menu-desktop');
    await click('[data-action="wallet-connect"]');
    await until('missing-wallet message', () => evaluate('document.querySelector(".wallet-message").textContent.includes("wallet")'));
    await check('guest-play-without-wallet', `({ passed: !document.querySelector('[data-action="start"]').disabled && Boolean(document.querySelector('[data-action="wallet-connect"]:not(:disabled)')) })`);
  }
  await click('[data-action="help"]');
  await expectPage(0);
  await guideLayout('desktop-first-layout', 0);
  await screenshot('tips-desktop-first');
  if (captureWallet) {
    for (let page = 1; page < 4; page++) {
      await showPage(page);
      await guideLayout(`desktop-tip-${page + 1}-english`, page);
      await screenshot(`tips-desktop-${page + 1}`);
    }
    await showPage(0);
  }
  await click('.guide-nav > button:last-child');
  await expectPage(1);
  report.checks.push({ label: 'desktop-next-button', passed: true });
  await click('.guide-nav > button:first-child');
  await expectPage(0);
  report.checks.push({ label: 'desktop-previous-button', passed: true });
  await showPage(4);
  await guideLayout('desktop-last-layout', 4);
  await screenshot('tips-desktop-last');
  await captureDetails('desktop');

  await viewport(390, 844, true);
  if (captureWallet) {
    await click('[data-action="close"]');
    await screenshot('menu-mobile');
    await check('mobile-wallet-menu', `({ passed: Boolean(document.querySelector('.wallet-menu [data-action="wallet-connect"]')) && document.documentElement.lang === 'en' })`);
    await click('[data-action="help"]');
  }
  await showPage(0);
  await guideLayout('mobile-first-layout', 0);
  await screenshot('tips-mobile-first');
  if (captureWallet) {
    for (let page = 1; page < 4; page++) {
      await showPage(page);
      await guideLayout(`mobile-tip-${page + 1}-english`, page);
      await screenshot(`tips-mobile-${page + 1}`);
    }
    await showPage(0);
  }
  await swipe('left');
  await expectPage(1);
  report.checks.push({ label: 'mobile-touch-swipe-left', passed: true });
  await swipe('right');
  await expectPage(0);
  report.checks.push({ label: 'mobile-touch-swipe-right', passed: true });
  await showPage(4);
  await guideLayout('mobile-last-layout', 4);
  await screenshot('tips-mobile-last');
  await captureDetails('mobile');
  if (report.errors.length) throw new Error(`${report.errors.length} page/browser error(s) recorded`);
  log('Complete', { screenshots: report.screenshots.length, checks: report.checks.length, errors: report.errors.length });
} catch (error) {
  report.errors.push(error.stack || error.message || String(error));
  console.error('[tips] Failed:', error);
  process.exitCode = 1;
  try { if (socket?.readyState === WebSocket.OPEN) await screenshot('tips-capture-failure'); }
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
