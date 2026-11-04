/** npm.cmd run dev, then node scripts/qa2-layout.mjs. Uses Playwright's own headless Chromium. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const url = process.env.SQUEEKSPIRE_URL || 'http://127.0.0.1:5174/';
const output = 'shots/qa2';
await mkdir(output, { recursive: true });
const report = { url, browser: 'Playwright headless Chromium', screenshots: [], layouts: [], errors: [] };
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => report.errors.push(e.message));
  await page.route('https://**/*', r => r.abort());
  await page.goto(url);
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="mode"][data-mode="practice"]').click();
  await page.locator('[data-action="begin"]').click();
  await page.locator('.hand .card').first().waitFor();
  await page.mouse.move(0, 0);
  async function capture(name) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/${name}.png` });
    report.screenshots.push(name);
  }
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(220);
    await capture(`after_${name}`);
    const metrics = await page.evaluate(() => ({ width: innerWidth,
      fonts: Object.fromEntries(['.hand .card-name', '.hand .card-description', '.hand .card-bottom', '.pile span', '.piles > small'].map(selector => [selector, getComputedStyle(document.querySelector(selector)).fontSize])),
      overflow: document.documentElement.scrollWidth > innerWidth,
      controls: [...document.querySelectorAll('.piles, .piles > small, .end-turn')].map(e => ({ text: e.textContent.trim(), bottom: e.getBoundingClientRect().bottom })) }));
    assert.equal(metrics.overflow, false);
    assert(metrics.controls.every(e => e.bottom <= height), `Battle controls clipped: ${JSON.stringify(metrics)}`);
    report.layouts.push(metrics);
  }
  const fixtures = await page.evaluate(async () => {
    const { fallbackDay } = await import('/src/game/data.ts');
    const { generateMap } = await import('/src/game/map.ts');
    const { act, createRun } = await import('/src/game/engine.ts');
    const { CARDS } = await import('/src/game/catalog.ts');
    const day = fallbackDay(new Date().toISOString().slice(0, 10)), map = generateMap(day);
    const battle = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
    const shopMap = structuredClone(map); shopMap[0].kind = 'shop';
    const shop = act(createRun(day, shopMap, 'practice'), { type: 'enter', nodeId: 0 });
    const restMap = structuredClone(map); restMap[0].kind = 'rest';
    const rest = act(createRun(day, restMap, 'practice'), { type: 'enter', nodeId: 0 });
    return { battle, shop, rest, map: createRun(day, map, 'practice'), ids: Object.keys(CARDS) };
  });
  // Test-only network fixture injection; production exposes no mutable QA state.
  await page.route('**/src/game/storage.ts*', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('export function loadActive(mode) {', 'export function loadActive(mode) { if (window.__qaFixture) return mode === "practice" ? structuredClone(window.__qaFixture) : null;');
    await route.fulfill({ response, body });
  });
  async function boot(state) {
    await page.evaluate(s => { sessionStorage.setItem('qa2-fixture', JSON.stringify(s)); }, state);
    await page.reload();
    await page.locator('[data-action="resume"]').click();
  }
  await page.addInitScript(() => {
    const saved = sessionStorage.getItem('qa2-fixture');
    if (saved) window.__qaFixture = JSON.parse(saved);
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ volume: 0, animationSpeed: 'fast', reduceEffects: true, language: 'en' }));
  });
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    for (const level of [0, 1]) {
      for (let offset = 0; offset < fixtures.ids.length; offset += 10) {
        const state = structuredClone(fixtures.battle);
        state.combat.hand = fixtures.ids.slice(offset, offset + 10).map((id, i) => ({ id, uid: `qa${i}`, level, mergeLevel: 0 }));
        state.combat.energy = 99;
        await boot(state);
        const layout = await page.evaluate(() => ({ width: innerWidth,
          overflow: document.documentElement.scrollWidth > innerWidth,
          cards: [...document.querySelectorAll('.hand .card')].map(card => {
            const r = card.getBoundingClientRect();
            return { id: card.dataset.id, height: card.clientHeight,
              clipped: card.scrollHeight > card.clientHeight + 1,
              textOverflow: [...card.querySelectorAll('.card-name,.card-description,.card-unavailable,.card-bottom')].some(e => {
                const t = e.getBoundingClientRect();
                return e.scrollWidth > e.clientWidth + 1 || t.bottom > r.bottom + 1 || t.right > r.right + 1;
              }) };
          }) }));
        assert.equal(layout.overflow, false);
        assert(layout.cards.length > 0);
        assert(layout.cards.every(c => !c.clipped && !c.textOverflow), `Card text clipped: ${JSON.stringify(layout)}`);
        report.layouts.push({ level, ...layout });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(fixtures.shop);
  await capture('shop_after');
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('.encounter-footer').scrollIntoViewIfNeeded();
    const balance = page.locator('.encounter-footer [data-coin-balance]');
    assert.equal(await balance.count(), 1);
    await capture(`shop_after_${width}`);
  }
  await page.locator('.shop-item.unaffordable').first().scrollIntoViewIfNeeded();
  const unaffordable = await page.locator('.shop-item.unaffordable').first().evaluate(e => ({
    disabled: e.querySelector('button').disabled,
    opacity: getComputedStyle(e.querySelector('button')).opacity,
    color: getComputedStyle(e.querySelector('.shop-price')).color,
    filter: getComputedStyle(e.querySelector('.card,.relic-shop-art')).filter,
  }));
  assert.equal(unaffordable.disabled, true);
  assert.equal(unaffordable.opacity, '1');
  assert.equal(unaffordable.color, 'rgb(255, 159, 166)');
  assert.equal(unaffordable.filter, 'grayscale(1)');
  await capture('shop_after_prices_mobile');
  const buy = page.locator('[data-action="buy"]:not(:disabled)').first();
  const offerIndex = Number(await buy.getAttribute('data-index'));
  await buy.click();
  const newGold = fixtures.shop.gold - fixtures.shop.shop.offers[offerIndex].price;
  for (const selector of ['[data-coin-balance="shop-top"] strong', '[data-coin-balance="shop-footer"] strong']) {
    assert.equal((await page.locator(selector).textContent()).trim(), `${newGold} SQK`);
  }
  report.layouts.push({ shopPurchaseBalance: newGold, unaffordable });
  for (const kind of ['map', 'rest']) for (const [width, height] of [[1440, 900], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await boot(fixtures[kind]);
    assert.equal(await page.locator(`[data-coin-balance="${kind}"]`).count(), 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await capture(`${kind}_after_${width}`);
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify({ screenshots: report.screenshots.length, cardLayouts: fixtures.ids.length * 4, errors: report.errors }));
} finally {
  await writeFile(`${output}/layout_report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
