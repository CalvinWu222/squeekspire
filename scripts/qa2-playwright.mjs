import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const baseURL = process.env.SQUEEKSPIRE_URL || process.env.QA_URL || 'http://127.0.0.1:5174/';
const report = { startedAt: new Date().toISOString(), browser: 'Playwright headless Chromium', runs: [], controlled: [], errors: [] };
const browser = await chromium.launch({ headless: true });
await mkdir('shots/qa2', { recursive: true });

async function openPage({ mobile = false, reduced = true, fixture } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage(); page.setDefaultTimeout(8000);
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(({ reduced, fixture }) => {
    localStorage.clear();
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ volume: 0, animationSpeed: 'normal', reduceEffects: reduced, language: 'en' }));
    if (fixture) window.__qaFixture = fixture;
  }, { reduced, fixture });
  await page.route('https://**/*', route => route.abort());
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ entries: [], accepted: true }) }));
  await page.route('**/src/game/storage.ts*', async route => {
    const response = await route.fetch(); let body = await response.text();
    assert(body.includes('export function saveActive(run) {'), 'Storage observation hook must attach');
    body = body.replace('export function saveActive(run) {', 'export function saveActive(run) { window.__qaSaved = structuredClone(run);');
    if (fixture) body = body.replace('export function loadActive(mode) {', 'export function loadActive(mode) { if (window.__qaFixture) return mode === "practice" ? structuredClone(window.__qaFixture) : null;');
    await route.fulfill({ response, body });
  });
  await page.goto(baseURL);
  await page.locator('.hero-title').waitFor();
  return { context, page };
}
const saved = page => page.evaluate(() => window.__qaSaved);
async function waitSaved(page, length) { await page.waitForFunction(length => window.__qaSaved?.log.length > length, length); return saved(page); }
async function completeDialog(page) {
  if (await page.locator('[data-action="preview-play"]').count()) await page.locator('[data-action="preview-play"]').click();
  if (await page.locator('.modal-card-choice').count()) {
    const candidates = page.locator('[data-action="choose-card"]:not(:disabled)');
    if (await candidates.count()) await candidates.first().click();
    await page.locator('[data-action="confirm-play"]').click();
  } else if (await page.locator('.modal-merge').count()) await page.locator('[data-action="confirm-play"]').click();
}
async function play(page, uid, path, result) {
  const before = await saved(page), card = before.combat.hand.find(card => card.uid === uid);
  const selector = `.hand [data-action="play"][data-uid="${uid}"]`;
  const metadata = await page.evaluate(async id => (await import('/src/game/catalog.ts')).CARDS[id], card.id);
  const alive = before.combat.enemies.filter(enemy => enemy.hp > 0).sort((a, b) => a.hp - b.hp);
  const chosen = alive[0], enemy = page.locator(`.enemy-card[data-enemy="${chosen.uid}"]`);
  if (path === 'drag') {
    const destination = metadata.type === 'attack' || card.id === 'exit-liquidity' ? enemy : page.locator('[data-action="player-target"]');
    await page.locator(selector).dragTo(destination);
  } else {
    if (path === 'tap') await page.locator(selector).tap();
    else await page.locator(selector).click();
    if (path === 'tap') {
      const target = page.locator('#preview-target');
      if (await target.count()) await target.selectOption(String(before.combat.enemies.findIndex(item => item.uid === chosen.uid)));
      assert(await page.locator('.modal-card-preview').count(), `Mobile ${card.id} must inspect before play`);
      assert.equal((await saved(page)).log.length, before.log.length, 'Inspect must not spend a card');
    } else if (metadata.type === 'attack') await enemy.click();
  }
  await completeDialog(page);
  const after = await waitSaved(page, before.log.length);
  assert.equal(after.log.length, before.log.length + 1, `${card.id}: exactly one UI play action`);
  assert.equal(after.log.at(-1).type, 'play'); assert.equal(after.log.at(-1).uid, uid);
  assert.notEqual(JSON.stringify(after.combat), JSON.stringify(before.combat), `${card.id}: combat state must change`);
  const persisted = await page.evaluate(mode => JSON.parse(localStorage.getItem(`squeekspire:v1:active:${mode}`)), after.mode);
  assert.equal(persisted.actions.length, after.log.length, 'UI play must persist to action log');
  result.plays.push({ card: card.id, path, turn: before.combat.turn, room: before.floor, target: after.log.at(-1).target, phase: after.phase });
  return after;
}
async function naturalRun(name, path, mobile, variant) {
  const { context, page } = await openPage({ mobile });
  const result = { name, path, viewport: mobile ? '390x844' : '1440x900', fixture: false, plays: [], roomKinds: [], turnsEnded: 0 };
  try {
    await page.locator('[data-action="start"]').click();
    await page.locator('[data-action="mode"][data-mode="practice"]').click();
    await page.locator('[data-action="begin"]').click();
    await page.waitForFunction(() => !!window.__qaSaved?.combat);
    let state = await saved(page), actions = 0;
    while (!['lost', 'won'].includes(state.phase) && actions++ < 260) {
      if (state.phase === 'combat') {
        const playable = await page.locator('.hand [data-action="play"]:not(:disabled)').evaluateAll(cards => cards.map(card => ({ uid: card.dataset.uid, id: card.dataset.id, type: card.classList.contains('attack') ? 'attack' : 'other' })));
        const incoming = state.combat.enemies.filter(e => e.hp > 0 && e.intent.type === 'attack').reduce((sum, e) => sum + e.intent.damage * e.intent.times, 0);
        const preferBlock = state.combat.block < incoming && state.combat.energy >= 1;
        const chosen = playable.find(c => c.id === 'seed-snack') || (preferBlock ? playable.find(c => ['cheek-pouch', 'bedding-fort', 'cage-climb', 'sunflower-stash'].includes(c.id)) : undefined) || playable.find(c => c.type === 'attack') || playable[0];
        if (chosen) state = await play(page, chosen.uid, path, result);
        else { const n = state.log.length; await page.locator('[data-action="end-turn"]').click(); state = await waitSaved(page, n); result.turnsEnded++; }
      } else if (state.phase === 'reward') {
        const rewards = page.locator('[data-action="pick-card"]');
        const options = state.reward.cards;
        const preferred = options.findIndex(id => ['tail-whip', 'burst-sprint', 'wood-chew', 'bedding-fort', 'water-bottle'].includes(id));
        const n = state.log.length; await rewards.nth(preferred >= 0 ? preferred : variant % options.length).click(); state = await waitSaved(page, n);
      } else if (state.phase === 'map') {
        if (state.log.filter(action => action.type === 'enter').length >= 6) break;
        const reachable = state.reachable.map(id => state.map[id]);
        const priority = state.hp < 45 ? ['rest', 'event', 'shop', 'battle', 'elite', 'boss'] : variant === 1 ? ['shop', 'event', 'rest', 'battle', 'elite', 'boss'] : ['rest', 'battle', 'event', 'shop', 'elite', 'boss'];
        reachable.sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind) || (variant === 2 ? b.id - a.id : a.id - b.id));
        const room = reachable[0], n = state.log.length;
        await page.locator(`[data-action="node"][data-id="${room.id}"]`).click(); state = await waitSaved(page, n); result.roomKinds.push(room.kind);
      } else if (state.phase === 'shop') {
        const offer = state.shop.offers.findIndex(offer => !offer.sold && offer.price <= state.gold && offer.kind === 'card');
        if (offer >= 0) { const n = state.log.length; await page.locator(`[data-action="buy"][data-index="${offer}"]`).click(); state = await waitSaved(page, n); }
        const n = state.log.length; await page.locator('.shop-footer [data-action="leave"]').click(); state = await waitSaved(page, n);
      } else if (state.phase === 'rest') {
        const n = state.log.length; await page.locator('[data-action="heal"]').click(); state = await waitSaved(page, n);
      } else if (state.phase === 'event') {
        const n = state.log.length; await page.locator(`[data-action="event"][data-index="${state.hp < 50 ? 1 : 0}"]`).click(); state = await waitSaved(page, n);
      } else throw new Error(`Unhandled phase ${state.phase}`);
    }
    assert(actions < 260, 'Natural run must finish within action budget');
    const roomsVisited = state.log.filter(action => action.type === 'enter').length;
    assert(['lost', 'won'].includes(state.phase) || roomsVisited >= 6, 'Run reaches terminal state or six rooms');
    assert(result.plays.length >= 10, 'Full-ish run plays at least ten cards');
    Object.assign(result, { phase: state.phase, floor: state.floor, roomsVisited, hp: state.hp, actions: state.log.length, cardsPlayed: result.plays.length });
    report.runs.push(result); console.log(`${name}: ${state.phase}, floor ${state.floor}, ${result.plays.length} cards, ${state.log.length} actions`);
  } finally { await context.close(); }
}

async function controlledFixture() {
  const { context, page } = await openPage();
  try {
    return await page.evaluate(async () => {
      const { fallbackDay } = await import('/src/game/data.ts'); const { generateMap } = await import('/src/game/map.ts');
      const { createRun, act } = await import('/src/game/engine.ts');
      const day = fallbackDay(new Date().toISOString().slice(0, 10)), map = generateMap(day); map[0] = { ...map[0], kind: 'battle', enemyId: 'dust-mite', jackpot: false };
      const s = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
      const card = (id, uid = id) => ({ id, uid, level: 0, mergeLevel: 0 });
      s.combat.hand = [card('oracle-ping'), card('gud-tek'), card('merge'), card('wheel-kick', 'kick1'), card('cheek-pouch', 'pouch'), card('tail-whip')];
      s.combat.draw = [card('seed-snack', 'draw3'), card('burst-sprint', 'draw2'), card('water-bottle', 'draw1')];
      s.deck = [...structuredClone(s.combat.hand), ...structuredClone(s.combat.draw), card('wheel-kick', 'kick2')];
      s.combat.energy = 15; s.combat.enemies = ['e0', 'e1'].map(uid => ({ ...structuredClone(s.combat.enemies[0]), uid, hp: 500, maxHp: 500 }));
      return s;
    });
  } finally { await context.close(); }
}
async function controlledChecks(fixture) {
  const { context, page } = await openPage({ fixture });
  const result = { name: 'controlled choices and targeting', plays: [] };
  try {
    await page.locator('[data-action="resume"]').click();
    // Observation begins at the first save; fixture is deliberately supplemental to menu-started runs.
    await page.evaluate(s => { window.__qaSaved = structuredClone(s); }, fixture);
    let before = await saved(page);
    await page.locator('.hand [data-id="oracle-ping"]').click();
    assert(await page.locator('.modal-card-choice').count());
    await page.locator('[data-action="choose-card"][data-index="1"]').click();
    assert.equal((await saved(page)).log.length, before.log.length);
    await page.locator('[data-action="confirm-play"]').click();
    let state = await waitSaved(page, before.log.length);
    assert.equal(state.log.at(-1).choice, 1); assert.equal(state.combat.draw.at(-1).uid, 'draw2');
    result.plays.push({ card: 'oracle-ping', choice: 1, asserted: 'chosen second draw becomes next draw, confirmation only' });
    before = state;
    await page.locator('.hand [data-id="gud-tek"]').click();
    await page.locator('[data-action="choose-card"][data-uid="pouch"]').click();
    await page.locator('[data-action="confirm-play"]').click(); state = await waitSaved(page, before.log.length);
    assert.equal(state.combat.hand.find(c => c.uid === 'pouch').level, 1);
    result.plays.push({ card: 'gud-tek', asserted: 'chosen Cheek Pouch upgraded to level 1' });
    before = state;
    await page.locator('.hand [data-id="merge"]').click();
    assert(await page.locator('.merge-result [data-id="wheel-kick"]').count());
    await page.locator('[data-action="confirm-play"]').click(); state = await waitSaved(page, before.log.length);
    assert.deepEqual(state.log.at(-1).mergePair, ['kick1', 'kick2']);
    assert.equal(state.deck.find(c => c.uid === 'kick1').mergeLevel, 1); assert(!state.deck.some(c => c.uid === 'kick2'));
    result.plays.push({ card: 'merge', asserted: 'confirmed pair merged in deck and hand' });
    before = state;
    await page.locator('.hand [data-uid="kick1"]').click(); await page.locator('.enemy-card[data-enemy="e1"]').click();
    state = await waitSaved(page, before.log.length);
    assert.equal(state.log.at(-1).target, 'e1'); assert.equal(state.combat.enemies[0].hp, 500); assert(state.combat.enemies[1].hp < 500);
    result.plays.push({ card: 'wheel-kick', asserted: 'second enemy loses HP, first unchanged' });
    report.controlled.push(result); console.log('Controlled Oracle/Gud Tek/Merge/second-enemy targeting passed');
  } finally { await context.close(); }
}
async function rapidAnimationDrag(fixture) {
  const { context, page } = await openPage({ fixture, reduced: false });
  const result = { name: 'normal-animation rapid native drag', plays: [] };
  try {
    await page.locator('[data-action="resume"]').click(); await page.evaluate(s => { window.__qaSaved = structuredClone(s); }, fixture);
    await play(page, 'tail-whip', 'drag', result);
    // Start the next native drag before the previous card's 1050ms effect expires.
    const started = Date.now(); await play(page, 'kick1', 'drag', result);
    assert.equal(result.plays.length, 2); result.secondDragElapsedMs = Date.now() - started;
    assert.equal((await saved(page)).log.filter(a => a.type === 'play').length, 2);
    // Hold a third native drag across the previous animation's expiry. Replacing
    // its source during the hold would cancel the browser drag before drop.
    const before = await saved(page), source = page.locator('.hand [data-uid="pouch"]');
    await source.scrollIntoViewIfNeeded();
    const sourceBox = await source.boundingBox(), targetBox = await page.locator('[data-action="player-target"]').boundingBox();
    assert(sourceBox && targetBox);
    const sourceX = sourceBox.x + sourceBox.width / 2, sourceY = sourceBox.y + sourceBox.height / 2;
    await page.mouse.move(sourceX, sourceY); await page.mouse.down();
    await page.mouse.move(sourceX + 15, sourceY - 15, { steps: 5 });
    await page.waitForTimeout(1150);
    assert(await source.evaluate(el => el.classList.contains('dragging')), 'Native drag source survives the previous card animation');
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
    await page.mouse.up();
    const after = await waitSaved(page, before.log.length);
    assert.equal(after.log.at(-1).uid, 'pouch'); assert(after.combat.block > before.combat.block);
    result.plays.push({ card: 'cheek-pouch', path: 'native drag held for 1150ms', asserted: 'drop survives previous animation expiry and gains Block' });
    report.controlled.push(result); console.log(`Rapid normal-animation drag passed (${result.secondDragElapsedMs}ms)`);
  } finally { await context.close(); }
}

try {
  await naturalRun('desktop click route', 'click', false, 0);
  await naturalRun('desktop native drag route', 'drag', false, 1);
  await naturalRun('mobile tap preview route', 'tap', true, 2);
  const fixture = await controlledFixture();
  await controlledChecks(fixture); await rapidAnimationDrag(fixture);
  assert.deepEqual(report.errors, [], 'No uncaught browser errors'); report.passed = true;
} catch (error) {
  report.passed = false; report.failure = error.stack || String(error); console.error(report.failure); process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile('shots/qa2/playtest_report.json', JSON.stringify(report, null, 2));
  await browser.close();
}
