/** Streamer acceptance: local-only, browser fixtures, no submitted scores.
 * NODE_OPTIONS='--preserve-symlinks --preserve-symlinks-main' node scripts/qa-overlay.mjs
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = new URL(process.env.SQUEEKSPIRE_URL || 'http://127.0.0.1:5175/');
assert(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname));
const out = resolve('docs/overlay/qa');
await mkdir(out, { recursive: true });
const image = (await readFile(resolve(out, 'moba-webcam-backdrop.png'))).toString('base64');
const imageUrl = `data:image/png;base64,${image}`;
const index = await readFile('index.html', 'utf8');
const browser = await chromium.launch({ headless: true });
const report = { startedAt: new Date().toISOString(), browser: browser.version(),
  disclosure: 'Original AI-generated MOBA/webcam backdrop; synthetic browser-only valid API fixtures. No match, person, leaderboard submission or OBS execution is claimed. Matrix mounts the real overlay module with lifecycle cleanup; separate checks use the real entry HTML.',
  checks: [], cases: [], screenshots: [], errors: [] };
const check = (name, detail = {}) => { report.checks.push({ name, passed: true, ...detail }); console.log(`[qa] ${name}`); };
const url = path => new URL(path, base).href;
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
context.on('page', p => p.on('pageerror', e => report.errors.push(e.message)));
const requests = [];
context.on('request', r => requests.push({ method: r.method(), url: r.url() }));
const real = await context.request.get(url('/api/leaderboard?view=overview'));
assert(real.ok(), 'The local leaderboard overview must be available');
const board = await real.json();
const identities = [
  ['guest12345678', 'A very long streamer name '.repeat(4).slice(0, 80), 1e100],
  ['0x1234567890abcdef1234567890abcdef1234abcd', undefined, Number.MAX_SAFE_INTEGER],
  ['guest4444', '夜猫仓鼠直播间超长昵称'.repeat(5).slice(0, 80), 999999999],
  ['guest5555', 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW', 99999],
  ['guest6666', '<Streamer & friends>', 0],
];
const fixture = { ...board, today: { ...board.today, entries: identities.map(([profile, name, score], i) => ({
  id: `qa-browser-only-${i}`, profile, ...(name ? { name } : {}), day: board.today.day, seed: board.today.seed,
  mode: 'daily', scoreVersion: board.scoreVersion, score, bestHit: 100, floor: 24, won: true, hibernation: false, streak: 0,
})) } };
let offline = false;
await context.route('**/api/leaderboard?view=overview', r => offline ? r.abort() : r.fulfill({ json: fixture }));
await context.route('https://api.squeekchain.com/v1/status', r => offline ? r.abort() : r.fulfill({ json: {
  oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'SPINNING', rpmMilli: 1e103,
    distanceMm: 1e103, observedAt: new Date().toISOString(), staleAfterSeconds: 999999 },
} }));

function sceneCSS(width, height) {
  if (height > width) return `html.ov-document{background:#0d1320!important}html.ov-document body{background:transparent!important}
    body::before{display:block!important;content:"";position:fixed;left:0;right:0;top:30%;height:${width * 9 / 16}px;background:url(${imageUrl}) center/100% 100% no-repeat;z-index:-1}
    body::after{display:block!important;content:"PORTRAIT STREAM • GAME + WEBCAM / QA FIXTURES";position:fixed;left:4%;right:4%;top:66%;height:27%;background:url(${imageUrl}) 0 100%/430% auto no-repeat;color:#fff;font:18px monospace;padding:16px;z-index:-1}`;
  return `html.ov-document{background:url(${imageUrl}) center/100% 100% no-repeat!important}html.ov-document body{background:transparent!important}`;
}
const positions = ['top-left', 'top', 'top-right', 'left', 'right', 'bottom-left', 'bottom', 'bottom-right', 'center'];
const canvases = [[1920, 1080], [1280, 720], [2560, 1440], [1080, 1920]];
const scales = [.5, 1, 1.5, 2];
const intersects = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
function hud(width, height) {
  if (height > width) {
    const y = height * .3, gameHeight = width * 9 / 16;
    return [{ name: 'game strip', x: 0, y, width, height: gameHeight }, { name: 'webcam', x: width * .04, y: height * .66, width: width * .92, height: height * .27 }];
  }
  return [{ name: 'minimap', x: width * .82, y: height * .67, width: width * .18, height: height * .33 },
    { name: 'abilities', x: width * .25, y: height * .84, width: width * .52, height: height * .16 },
    { name: 'webcam', x: 0, y: height * .73, width: width * .235, height: height * .27 },
    { name: 'scoreboard', x: width * .32, y: 0, width: width * .36, height: height * .08 }];
}
async function ready(page) {
  await page.locator('.ov-shell').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.ov-rankings li').length > 0 && !document.querySelector('.ov-waiting') && document.querySelector('[data-section="status"]')?.dataset.state !== 'loading');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
async function bounds(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.ov-shell'), rect = shell.getBoundingClientRect();
    const scaleX = rect.width / shell.offsetWidth, scaleY = rect.height / shell.offsetHeight;
    const text = [...shell.querySelectorAll('.ov-state,.ov-player,.ov-rankings strong,.ov-boss-name')].filter(el => el.getBoundingClientRect().height > 0);
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scaleX, scaleY,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      minCriticalFont: Math.min(...text.map(el => parseFloat(getComputedStyle(el).fontSize) * scaleY)),
      escapedText: !!shell.querySelector('img'),
      escapedChildren: [...shell.querySelectorAll('.ov-section *')].filter(el => {
        const r = el.getBoundingClientRect(), s = el.closest('.ov-section').getBoundingClientRect();
        return r.height && r.width && (r.left < s.left - 1 || r.right > s.right + 1);
      }).map(el => el.className).filter(name => typeof name === 'string').slice(0, 12),
    };
  });
}
async function shot(page, filename) {
  const buffer = await page.screenshot({ path: resolve(out, filename), omitBackground: true });
  report.screenshots.push(filename);
  return buffer;
}
try {
  // Real entry HTML with a deliberately stalled module: no opaque loading card.
  const startup = await context.newPage();
  let release;
  const gate = new Promise(r => { release = r; });
  let intercepted;
  const blocked = new Promise(r => { intercepted = r; });
  // Vite appends ?t= cache-busting query strings after a source edit.
  await startup.route(/\/src\/entry\.ts(?:\?.*)?$/, async r => { intercepted(); await gate; await r.continue(); });
  await startup.goto(url('/overlay'), { waitUntil: 'commit' });
  await blocked;
  await startup.locator('html.ov-boot').waitFor({ state: 'attached' });
  assert.equal(await startup.locator('.ov-shell').count(),0,'The entry module must still be blocked');
  assert.equal(await startup.locator('#app > p').evaluate(el => getComputedStyle(el).display), 'none');
  assert.equal(await startup.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
  const initialPNG = await shot(startup, 'startup-delayed-module-transparent.png');
  const transparent = await startup.evaluate(async src => {
    const image = new Image(); image.src = src; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width=image.width; canvas.height=image.height;
    const context = canvas.getContext('2d'); context.drawImage(image,0,0);
    const pixels = context.getImageData(0,0,image.width,image.height).data;
    for(let i=3;i<pixels.length;i+=4) if(pixels[i]!==0) return false;
    return true;
  },`data:image/png;base64,${initialPNG.toString('base64')}`);
  assert(transparent,'Every pixel of the pre-module screenshot must have zero alpha');
  release(); await ready(startup);
  assert.equal(await startup.locator('html').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.equal(await startup.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
  await shot(startup, 'source-alpha.png');
  check('Transparent initial HTML and loaded body; delayed module never shows game loader');
  await startup.close();

  // Matrix uses the exact app HTML/module but captures the disposer for fast, clean remounts.
  const page = await context.newPage();
  await page.route('**/overlay?qa-matrix=1', r => r.fulfill({ contentType: 'text/html', body: index.replace('<script type="module" src="/src/entry.ts"></script>', '<script type="module">import {mountOverlay} from "/src/overlay.ts";window.__qaMount=mountOverlay;window.__qaDispose=mountOverlay();</script>') }));
  await page.goto(url('/overlay?qa-matrix=1')); await ready(page);
  const sheetPage = await context.newPage();
  for (const [width, height] of canvases) {
    await page.setViewportSize({ width, height });
    const style = await page.addStyleTag({ content: sceneCSS(width, height) });
    for (const layout of ['bar', 'card']) {
      const thumbs = [];
      for (const density of ['full', 'compact', 'min']) for (const pos of positions) for (const scale of scales) {
        const params = new URLSearchParams({ layout, density, pos, scale: String(scale), motion: 'low', opacity: '1', safe: 'none' });
        await page.evaluate(query => { window.__qaDispose(); history.replaceState({}, '', `/overlay?${query}`); window.__qaDispose = window.__qaMount(); }, params.toString());
        await ready(page);
        const box = await bounds(page);
        assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `Clipping ${width}x${height} ${params}: ${JSON.stringify(box)}`);
        assert(Math.abs(box.scaleX - box.scaleY) < .002, `Nonuniform source fit: ${params}`);
        assert(box.scrollWidth <= width && box.scrollHeight <= height, `Source scrollbars: ${params}`);
        assert(!box.escapedText && !box.escapedChildren.length, `Panel overflow ${params}: ${JSON.stringify(box)}`);
        const collisions = hud(width, height).filter(r => intersects(box, r) > 0).map(r => r.name);
        report.cases.push({ canvas: `${width}x${height}`, layout, density, pos, scale, ...box, collisions });
        if (density === 'full' && pos !== 'center') {
          const buffer = await page.screenshot({ type: 'jpeg', quality: 65 });
          thumbs.push({ label: `${pos} · scale ${scale}`, data: buffer.toString('base64') });
        }
      }
      const thumbWidth = height > width ? 220 : 360, thumbHeight = thumbWidth * height / width;
      await sheetPage.setViewportSize({ width: thumbWidth * 4, height: Math.ceil((thumbHeight + 28) * 8 + 76) });
      await sheetPage.setContent(`<body style="margin:0;background:#10131d;color:#fff;font:13px monospace"><header style="height:76px;padding:14px;box-sizing:border-box">${width}×${height} / ${layout} full / synthetic scene + browser fixtures<br>Columns: scale 0.5 / 1 / 1.5 / 2. HUD collisions are deliberately shown. Safe preset off.</header><main style="display:grid;grid-template-columns:repeat(4,${thumbWidth}px)">${thumbs.map(t => `<div><div style="height:28px;padding:5px;box-sizing:border-box">${t.label}</div><img style="display:block;width:${thumbWidth}px;height:${thumbHeight}px" src="data:image/jpeg;base64,${t.data}"></div>`).join('')}</main></body>`);
      await sheetPage.evaluate(() => Promise.all([...document.images].map(im => im.decode())));
      await shot(sheetPage, `matrix-${width}x${height}-${layout}.png`);
      for (const density of ['compact', 'min']) {
        const params = new URLSearchParams({ layout, density, pos: 'top-left', scale: '1', safe: height > width ? 'none' : 'moba', motion: 'low' });
        await page.evaluate(query => { window.__qaDispose(); history.replaceState({}, '', `/overlay?${query}`); window.__qaDispose = window.__qaMount(); }, params.toString());
        await ready(page);
        const box = await bounds(page), collisions = hud(width, height).filter(r => intersects(box, r) > 0).map(r => r.name);
        report.cases.push({ recommendedCandidate: true, canvas: `${width}x${height}`, layout, density, ...box, collisions });
        await shot(page, `placement-${width}x${height}-${layout}-${density}.png`);
      }
      check(`${width}x${height} ${layout}: 108 anchor/scale/density fits without stretch, clipping or panel overflow`);
    }
    await style.evaluate(el => el.remove());
  }
  await sheetPage.close(); await page.close();

  // OBS 1080p canvas -> 720p output: resample the complete composition, not a new viewport.
  const downscale = await context.newPage();
  await downscale.setViewportSize({ width:1920, height:1080 });
  for (const density of ['full','compact','min']) {
    await downscale.goto(url(`/overlay?layout=bar&density=${density}&pos=top-left&safe=moba&scale=1.5&motion=low`));
    await ready(downscale); await downscale.addStyleTag({content:sceneCSS(1920,1080)});
    const box = await bounds(downscale);
    const buffer = await downscale.screenshot();
    const outputPage = await context.newPage(); await outputPage.setViewportSize({width:1280,height:720});
    await outputPage.setContent(`<body style="margin:0"><img style="display:block;width:1280px;height:720px" src="data:image/png;base64,${buffer.toString('base64')}"></body>`);
    await outputPage.evaluate(() => document.images[0].decode());
    await shot(outputPage,`downscale-1080-to-720-${density}.png`);
    report.cases.push({ downscale:true, canvas:'1920x1080', output:'1280x720', density, scale:1.5, criticalFontAt720:box.minCriticalFont*2/3, ...box });
    await outputPage.close();
  }
  check('1080p compositions resampled to actual 720p output for full/compact/min text review');
  await downscale.close();

  // Mismatched tight source dimensions and live viewport resize.
  const mismatch = await context.newPage();
  for (const [width, height] of [[1200,260], [440,800], [400,120], [300,1000], [1500,150], [800,300]]) {
    await mismatch.setViewportSize({ width, height });
    for (const layout of ['bar', 'card']) {
      await mismatch.goto(url(`/overlay?layout=${layout}&scale=2`)); await ready(mismatch);
      const box = await bounds(mismatch);
      assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1);
      assert(Math.abs(box.scaleX - box.scaleY) < .002);
      assert(box.scrollWidth <= width && box.scrollHeight <= height);
      report.cases.push({ mismatch: true, canvas: `${width}x${height}`, layout, ...box });
    }
  }
  await mismatch.setViewportSize({ width: 1920, height: 1080 });
  await mismatch.waitForTimeout(100);
  const resized = await bounds(mismatch);
  assert(resized.height > 500 && resized.y + resized.height <= 1081);
  check('12 mismatched source sizes fit with equal X/Y scale and resize recovers larger dimensions');
  await mismatch.close();

  const opacityPage = await context.newPage();
  await opacityPage.setViewportSize({width:1280,height:720});
  for (const [pos,opacity] of [['top-left',1],['top-right',.25]]) {
    await opacityPage.goto(url(`/overlay?layout=card&show=status,boss&density=compact&safe=moba&pos=${pos}&opacity=${opacity}`));
    await opacityPage.locator('.ov-state').waitFor();
    await opacityPage.waitForFunction(() => document.querySelector('[data-section="status"]')?.dataset.state === 'spinning' && !document.querySelector('.ov-waiting'));
    const styles = await opacityPage.evaluate(() => ({
      surface:getComputedStyle(document.querySelector('.ov-surface')).opacity,
      shell:getComputedStyle(document.querySelector('.ov-shell')).opacity,
      text:getComputedStyle(document.querySelector('.ov-state')).opacity,
      shadow:getComputedStyle(document.querySelector('.ov-state')).textShadow,
    }));
    assert.equal(Number(styles.surface),opacity); assert.equal(styles.shell,'1'); assert.equal(styles.text,'1'); assert.notEqual(styles.shadow,'none');
    await opacityPage.addStyleTag({content:sceneCSS(1280,720)});
    await shot(opacityPage,`contrast-${pos}-opacity-${opacity}.png`);
  }
  check('Opacity affects the panel fill only; opaque text retains its dark outline on bright and dark scenes');
  await opacityPage.close();

  const life = await context.newPage();
  await life.addInitScript(() => {
    window.__qaHidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__qaHidden });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__qaHidden ? 'hidden' : 'visible' });
  });
  await life.clock.install();
  await life.goto(url('/overlay?motion=low&density=compact')); await ready(life);
  const feeds = () => requests.filter(r => /v1\/status|api\/leaderboard/.test(r.url)).length;
  for (const mode of ['document', 'OBS']) {
    await life.evaluate(mode => { window.__qaChanges = 0; window.__qaObserver?.disconnect(); window.__qaObserver = new MutationObserver(() => window.__qaChanges++); window.__qaObserver.observe(document.querySelector('#app'), { subtree:true, childList:true, attributes:true }); if(mode==='document'){window.__qaHidden=true;document.dispatchEvent(new Event('visibilitychange'));}else window.dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:false}})); }, mode);
    await life.waitForTimeout(25);
    const n = feeds();
    await life.clock.runFor(45_000);
    assert.equal(feeds(), n, `${mode} hidden should stop feed requests`);
    assert.equal(await life.evaluate(() => window.__qaChanges), 0, `${mode} hidden should avoid DOM renders`);
    await life.evaluate(mode => { if(mode==='document'){window.__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'));}else window.dispatchEvent(new CustomEvent('obsSourceVisibleChanged',{detail:{visible:true}})); }, mode);
    await life.waitForTimeout(75);
    assert(feeds() > n, `${mode} visible should immediately refresh`);
  }
  check('Document and OBS visibility each stop requests and DOM renders for 45s; resume refreshes immediately');
  await life.close();

  const perf = await context.newPage();
  await perf.goto(url('/overlay?low-motion=1&density=compact')); await ready(perf);
  assert.equal(await perf.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
  const cdp = await context.newCDPSession(perf); await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name,m.value]));
  const start = await metrics(); await perf.waitForTimeout(5000); const end = await metrics();
  check('Low-motion has zero running animations and no frame loop', { idleSeconds: 5, mainThreadTaskSeconds: end.TaskDuration-start.TaskDuration, note: 'Chromium main-thread estimate, not measured OBS CPU/GPU usage.' });
  await perf.close();

  offline = true;
  const fallback = await context.newPage(); await fallback.setViewportSize({ width: 1280, height: 720 });
  await fallback.goto(url('/overlay?layout=card&pos=top-right&density=compact&safe=moba&opacity=.85'));
  await fallback.waitForFunction(() => document.querySelector('[data-section="status"]')?.dataset.state === 'unavailable' && /unavailable/i.test(document.querySelector('.ov-board-empty')?.textContent || ''));
  await fallback.addStyleTag({ content: sceneCSS(1280,720) });
  await shot(fallback,'offline-bright-dark-720p.png');
  const loaded = await fallback.evaluate(() => performance.getEntriesByType('resource').map(r => ({ name:r.name, type:r.initiatorType })));
  assert(!loaded.some(r => /\.(woff2?|ttf|otf)(\?|$)/i.test(r.name) || /fonts\.(googleapis|gstatic)/.test(r.name)));
  assert(!loaded.some(r => /\/src\/(main|wallet|music)\.ts/.test(r.name)));
  check('Offline APIs show honest unavailable state; no external fonts, game/audio/wallet boot');
  await fallback.close(); offline = false;

  const setup = await context.newPage();
  for (const [width,height] of [[1440,1100],[390,844]]) {
    await setup.setViewportSize({width,height}); await setup.goto(url('/overlay/setup'));
    await setup.locator('[data-os-url]').waitFor();
    assert(await setup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Setup must not scroll horizontally');
    await setup.screenshot({ path:resolve(out,`setup-${width}.png`),fullPage:true });
    report.screenshots.push(`setup-${width}.png`);
  }
  check('Setup at desktop and mobile widths has no horizontal overflow');
  await setup.close();
  assert.equal(requests.filter(r => r.method !== 'GET').length, 0, 'Read-only QA must never submit a score');
  assert.deepEqual(report.errors, []);
  check('All QA requests are GET and browser has zero uncaught errors');
} finally {
  report.finishedAt = new Date().toISOString();
  report.requestCount = requests.length;
  await writeFile(resolve(out,'results.json'), JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
