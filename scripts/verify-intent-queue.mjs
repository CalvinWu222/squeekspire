/** Run against npm.cmd run dev. Uses Playwright's bundled headless Chromium. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const url = process.env.SQUEEKSPIRE_URL || 'http://127.0.0.1:5173/';
const output = 'shots/intent-queue';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { browser: 'Playwright bundled headless Chromium', url, layouts: [], errors: [] };
try {
  const setup = await browser.newPage();
  await setup.route('https://**/*', route => route.abort());
  await setup.goto(url);
  const fixture = await setup.evaluate(async () => {
    const { fallbackDay } = await import('/src/game/data.ts');
    const { generateMap } = await import('/src/game/map.ts');
    const { act, createRun } = await import('/src/game/engine.ts');
    const { ENEMIES } = await import('/src/game/catalog.ts');
    const day = { ...fallbackDay('2026-11-04'), difficulty: 1, hibernation: false, spinning: false, peakRpm: 225 };
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'battle', enemyId: 'queue-snake', jackpot: false };
    const s = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
    s.hp = s.maxHp = 1000;
    s.combat.hand = [{ id: 'sleep-cam', uid: 'cam', level: 0, mergeLevel: 0 }];
    s.combat.draw = Array.from({ length: 30 }, (_, i) => ({ id: 'cheek-pouch', uid: `draw-${i}`, level: 0, mergeLevel: 0 }));
    s.combat.enemies = ['queue-snake', 'seed-thief', 'dust-mite', 'squeektoshi', 'oracle-acolyte'].map((id, i) => {
      const e = ENEMIES[id];
      return { ...s.combat.enemies[0], uid: `e${i}`, id, name: e.name, hp: 1000, maxHp: 1000, intent: { type: e.pattern[0], damage: e.attack, times: id === 'squeektoshi' ? 3 : 1, label: e.pattern[0] } };
    });
    return s;
  });
  await setup.close();
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: name === 'mobile', hasTouch: name === 'mobile' });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.addInitScript(state => {
      window.__intentFixture = state;
      localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ volume: 0, reduceEffects: true }));
    }, fixture);
    await page.route('https://**/*', route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [] }) }));
    await page.route('**/src/game/storage.ts*', async route => {
      const response = await route.fetch();
      let body = await response.text();
      assert(body.includes('export function loadActive(mode) {'));
      body = body.replace('export function loadActive(mode) {', 'export function loadActive(mode) { if (window.__intentFixture) return mode === "practice" ? structuredClone(window.__intentFixture) : null;');
      await route.fulfill({ response, body });
    });
    await page.goto(url);
    await page.locator('[data-action="resume"]').click();
    assert.equal(await page.locator('.enemy-intent-queue').count(), 0);
    await page.locator('.hand [data-id="sleep-cam"]').click();
    if (await page.locator('[data-action="preview-play"]').count()) await page.locator('[data-action="preview-play"]').click();
    await page.locator('.enemy-intent-queue').first().waitFor();
    assert.equal(await page.locator('.enemy-intent-queue').count(), 5);
    assert.equal(await page.locator('.queued-intent').count(), 10);
    const layout = await page.evaluate(() => ({
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      queues: [...document.querySelectorAll('.enemy-intent-queue')].map(queue => {
        const bounds = queue.getBoundingClientRect(), enemy = queue.closest('.enemy-card');
        const sprite = enemy.querySelector('.enemy-sprite').getBoundingClientRect();
        return { enemy: enemy.dataset.enemy, text: queue.textContent, left: bounds.left, right: bounds.right, bottom: bounds.bottom, spriteTop: sprite.top,
          clipped: [...queue.querySelectorAll('.queued-intent, .queued-intent strong')].some(item => item.scrollWidth > item.clientWidth + 1) };
      }),
    }));
    assert.equal(layout.overflow, false);
    assert(layout.queues.every(queue => queue.left >= 0 && queue.right <= width && queue.bottom <= queue.spriteTop && !queue.clipped), JSON.stringify(layout));
    report.layouts.push({ name, ...layout });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
    for (const turns of [2, 1, 0]) {
      await page.locator('[data-action="end-turn"]').click();
      assert.equal(await page.locator('.queued-intent').count(), turns * 5);
    }
    await context.close();
  }
  assert.deepEqual(report.errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
