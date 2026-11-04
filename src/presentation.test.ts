// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARDS, STARTER_DECK } from './game/catalog';
import { fallbackDay } from './game/data';
import { generateMap } from './game/map';
import { act, createRun, type RunState } from './game/engine';

function click(selector: string): void {
  const control = document.querySelector<HTMLElement>(selector);
  expect(control, `Expected UI control ${selector}`).not.toBeNull();
  control!.click();
}

function shownCardIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.catalog-grid .card'), card => card.dataset.id!).sort();
}

function search(value: string): void {
  const input = document.querySelector<HTMLInputElement>('#gallery-search');
  expect(input).not.toBeNull();
  input!.value = value;
  input!.dispatchEvent(new Event('input', { bubbles: true }));
}

async function boot(): Promise<void> {
  const data = await import('./game/data');
  vi.spyOn(data, 'loadDay').mockResolvedValue(data.fallbackDay('2026-11-04'));
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
}

async function resumeFixture(activeRun: RunState): Promise<typeof import('./game/storage')> {
  const storage = await import('./game/storage');
  vi.spyOn(storage, 'loadActive').mockImplementation(mode => mode === activeRun.mode ? structuredClone(activeRun) : null);
  vi.spyOn(storage, 'saveActive').mockImplementation(() => {});
  await boot();
  click('[data-action="resume"]');
  return storage;
}

describe('the illustrated card codex and daily route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
    localStorage.clear();
    window.location.hash = '';
    document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline presentation test')));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows every actual card, including the starters and curses, as inspectable art', async () => {
    await boot();
    click('[data-action="collection"]');
    const expectedIds = Object.keys(CARDS).sort();
    expect(shownCardIds()).toEqual(expectedIds);
    expect(document.querySelector('.gallery-count')!.textContent).toContain(String(expectedIds.length));
    for (const id of new Set([...STARTER_DECK, ...Object.values(CARDS).filter(card => card.type === 'curse').map(card => card.id)])) {
      const card = document.querySelector<HTMLElement>(`.catalog-grid .card[data-id="${id}"]`);
      expect(card).not.toBeNull();
      expect(card!.tagName).toBe('ARTICLE');
      expect(card!.tabIndex).toBe(0);
      expect(card!.querySelector('svg')).not.toBeNull();
    }
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
  });

  it('intersects type, rarity, and search filters and recovers from an empty result', async () => {
    await boot();
    click('[data-action="collection"]');
    click('[data-action="filter-type"][data-value="attack"]');
    click('[data-action="filter-rarity"][data-value="rare"]');
    const expected = Object.values(CARDS).filter(card => card.type === 'attack' && card.rarity === 'rare');
    expect(shownCardIds()).toEqual(expected.map(card => card.id).sort());
    search('  aPe IN  ');
    expect(shownCardIds()).toEqual(['ape-in']);
    search('no card could possibly have this name');
    expect(shownCardIds()).toEqual([]);
    expect(document.querySelector('.gallery-count')!.textContent).toContain('0');
    search('');
    click('[data-action="filter-type"][data-value="all"]');
    click('[data-action="filter-rarity"][data-value="all"]');
    expect(shownCardIds()).toEqual(Object.keys(CARDS).sort());
  });

  it('draws exactly the generated daily connections across all 24 hourly rooms', async () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    await resumeFixture(createRun(day, map, 'daily'));
    const expectedPaths = map.flatMap(node => node.connections.map(to => `${node.id}:${to}`)).sort();
    const drawnPaths = Array.from(document.querySelectorAll<SVGPathElement>('.map-paths path'), path => `${path.dataset.from}:${path.dataset.to}`).sort();
    expect(document.querySelectorAll('.map-node')).toHaveLength(24);
    expect(drawnPaths).toEqual(expectedPaths);
    expect(document.querySelectorAll('.map-node.jackpot')).toHaveLength(map.filter(node => node.jackpot).length);
  });

  it.each(['daily', 'practice', 'endless'] as const)('continues the current saved %s run from the title', async mode => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'battle', enemyId: 'dust-mite' };
    const active = act(createRun(day, map, mode), { type: 'enter', nodeId: 0 });
    await resumeFixture(active);
    expect(document.querySelector('.combat-panel')).not.toBeNull();
    expect(document.querySelector('.combat-header .chip')!.textContent).toBe('TURN 1');
    expect(document.querySelector('.energy-display strong')!.textContent).toBe(String(active.combat!.energy));
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
  });

  it.each(['en', 'zh'] as const)('uses English Seeds in the character intro, battle counter, and card costs with saved %s preferences', async language => {
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ language }));
    const label = 'Seeds';
    await boot();
    click('[data-action="start"]');
    click('[data-action="mode"][data-mode="practice"]');
    expect(document.querySelector('.character-stats')!.textContent).toContain(`3 ${label}`);
    expect(document.querySelector('.character-stats')!.textContent).not.toMatch(/energy/i);
    expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
    click('[data-action="begin"]');
    const supply = document.querySelector('.energy-display')!;
    expect(supply.getAttribute('aria-label')).toBe(`3 ${label}`);
    expect(supply.querySelector('strong')!.textContent).toBe('3');
    expect(supply.querySelector('span')!.textContent).toBe(label);
    expect(supply.querySelector('svg[shape-rendering="crispEdges"]')).not.toBeNull();
    for (const cost of document.querySelectorAll('.hand .card-cost')) {
      expect(cost.getAttribute('aria-label')).toBe(`${cost.textContent} ${label}`);
      expect(cost.querySelector('svg[shape-rendering="crispEdges"]')).not.toBeNull();
    }
    expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
  });

  it('shows hibernation fog on the resumed route without changing the day or its generated rooms', async () => {
    const day = { ...fallbackDay('2026-11-04'), hibernation: true };
    const active = createRun(day, generateMap(day), 'practice');
    const storage = await resumeFixture(active);
    expect(document.querySelector('.map-panel.fog')).not.toBeNull();
    expect(document.querySelectorAll('.map-node')).toHaveLength(24);
    expect(document.querySelector('.map-legend')).not.toBeNull();
    expect(storage.saveActive).not.toHaveBeenCalled();
  });

  it('lets a player inspect and filter cards without changing an active battle or using a daily attempt', async () => {
    await boot();
    click('[data-action="start"]');
    click('[data-action="mode"][data-mode="practice"]');
    click('[data-action="begin"]');
    expect(document.querySelector('.combat-panel')).not.toBeNull();
    const savedBattle = localStorage.getItem('squeekspire:v1:active:practice');
    const hand = Array.from(document.querySelectorAll<HTMLElement>('.hand .card'), card => card.dataset.uid);
    const energy = document.querySelector('.energy-display strong')!.textContent;
    const turn = document.querySelector('.combat-header .chip')!.textContent;
    click('[data-action="collection"]');
    click('[data-action="filter-type"][data-value="curse"]');
    expect(shownCardIds()).toEqual(Object.values(CARDS).filter(card => card.type === 'curse').map(card => card.id).sort());
    document.querySelector<HTMLInputElement>('#gallery-search')!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    click('[data-action="close"]');
    expect(localStorage.getItem('squeekspire:v1:active:practice')).toBe(savedBattle);
    expect(Array.from(document.querySelectorAll<HTMLElement>('.hand .card'), card => card.dataset.uid)).toEqual(hand);
    expect(document.querySelector('.energy-display strong')!.textContent).toBe(energy);
    expect(document.querySelector('.combat-header .chip')!.textContent).toBe(turn);
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
  });

  it.each(['en', 'zh'] as const)('allows zero-Seed X plays and explains fixed costs in English with saved %s preferences', async language => {
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ language }));
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'elite', enemyId: 'oracle-judge', jackpot: true };
    const active = act(createRun(day, map, 'daily'), { type: 'enter', nodeId: 0 });
    active.combat!.energy = 0;
    active.combat!.hand = [
      { uid: 'test-gas-war', id: 'gas-war', level: 0, mergeLevel: 0 },
      { uid: 'test-wheel-kick', id: 'wheel-kick', level: 0, mergeLevel: 0 },
    ];
    const storage = await resumeFixture(active);
    expect(document.querySelector<HTMLButtonElement>('.hand [data-id="gas-war"]')!.disabled).toBe(false);
    expect(document.querySelector<HTMLButtonElement>('.hand [data-id="wheel-kick"]')!.disabled).toBe(true);
    expect(document.querySelector('.hand [data-id="wheel-kick"] .card-bottom')!.textContent).toBe('NEED MORE SEEDS');
    expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
    const expected = act(active, { type: 'play', uid: 'test-gas-war', target: active.combat!.enemies[0].uid });
    click('.hand [data-id="gas-war"]');
    expect(storage.saveActive).not.toHaveBeenCalled();
    click('.enemy-card');
    expect(storage.saveActive).toHaveBeenLastCalledWith(expected);
    expect(document.querySelector('.enemy-card .enemy-hp')!.textContent).toBe(`${expected.combat!.enemies[0].hp} / ${expected.combat!.enemies[0].maxHp} HP`);
  });

  it('clears million-squeek play effects without taking another action or changing saved state', async () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'elite', enemyId: 'oracle-judge', jackpot: false };
    const active = act(createRun(day, map, 'daily'), { type: 'enter', nodeId: 0 });
    active.combat!.multiply = 1e6;
    active.combat!.hand = [{ uid: 'test-million-kick', id: 'wheel-kick', level: 0, mergeLevel: 0 }];
    const storage = await resumeFixture(active);
    const engine = await import('./game/engine');
    const actionSpy = vi.spyOn(engine, 'act');
    const expected = act(active, { type: 'play', uid: 'test-million-kick', target: active.combat!.enemies[0].uid });
    click('.hand [data-id="wheel-kick"]');
    expect(storage.saveActive).not.toHaveBeenCalled();
    click('.enemy-card');
    expect(expected.bestHit).toBeGreaterThanOrEqual(1e6);
    expect(storage.saveActive).toHaveBeenCalledTimes(1);
    expect(storage.saveActive).toHaveBeenLastCalledWith(expected);
    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.squeek-burst')!.textContent).toContain('SQUEEK!');
    expect(document.querySelector('.app-shell.squeek-shake')).not.toBeNull();
    expect(document.querySelector('.card-play-effect [data-id="wheel-kick"]')).not.toBeNull();
    expect(document.querySelector('.score-pop')).not.toBeNull();
    const savedState = JSON.stringify(vi.mocked(storage.saveActive).mock.calls[0][0]);
    const persistentState = Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)];
    });
    await vi.advanceTimersByTimeAsync(1251);
    expect(document.querySelector('.squeek-burst, .squeek-shake, .card-play-effect, .score-pop')).toBeNull();
    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(storage.saveActive).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(storage.saveActive).mock.calls[0][0])).toBe(savedState);
    expect(Array.from({ length: localStorage.length }, (_, index) => {
      const key = localStorage.key(index)!;
      return [key, localStorage.getItem(key)];
    })).toEqual(persistentState);
    expect(document.querySelector('.energy-display strong')!.textContent).toBe(String(expected.combat!.energy));
    expect(document.querySelector('.enemy-card .enemy-hp')!.textContent).toBe(`${expected.combat!.enemies[0].hp} / ${expected.combat!.enemies[0].maxHp} HP`);
    expect(document.querySelector('.combat-header .chip')!.textContent).toBe(`TURN ${expected.combat!.turn}`);
  });

  it('uses the dropped enemy as the attack target and dispatches exactly the corresponding reducer action', async () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'elite', enemyId: 'oracle-judge', jackpot: false };
    const active = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
    active.combat!.enemies.push({ ...active.combat!.enemies[0], uid: 'e1' });
    active.combat!.hand = [{ uid: 'drop-kick', id: 'wheel-kick', level: 0, mergeLevel: 0 }];
    const storage = await resumeFixture(active);
    const expected = act(active, { type: 'play', uid: 'drop-kick', target: 'e1' });
    const payload = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => payload.set(type, value),
      getData: (type: string) => payload.get(type) ?? '',
      effectAllowed: 'uninitialized', dropEffect: 'none',
    };
    const drag = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(drag, 'dataTransfer', { value: dataTransfer });
    document.querySelector('.hand [data-id="wheel-kick"]')!.dispatchEvent(drag);
    expect(storage.saveActive).not.toHaveBeenCalled();
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
    document.querySelectorAll('.enemy-card')[1].dispatchEvent(drop);
    expect(storage.saveActive).toHaveBeenCalledTimes(1);
    expect(storage.saveActive).toHaveBeenLastCalledWith(expected);
    expect(expected.combat!.enemies[0].hp).toBe(active.combat!.enemies[0].hp);
    expect(expected.combat!.enemies[1].hp).toBeLessThan(active.combat!.enemies[1].hp);
  });

  it('preserves the next selected attack when the previous card animation expires', async () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'battle', enemyId: 'dust-mite' };
    const active = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
    active.combat!.hand = [
      { uid: 'animation-pouch', id: 'cheek-pouch', level: 0, mergeLevel: 0 },
      { uid: 'next-kick', id: 'wheel-kick', level: 0, mergeLevel: 0 },
    ];
    const storage = await resumeFixture(active);
    click('.hand [data-id="cheek-pouch"]');
    click('.hand [data-id="wheel-kick"]');
    expect(document.querySelector('.hand [data-id="wheel-kick"]')!.getAttribute('aria-pressed')).toBe('true');
    await vi.advanceTimersByTimeAsync(1051);
    expect(document.querySelector('.hand [data-id="wheel-kick"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(storage.saveActive).toHaveBeenCalledTimes(1);
    click('.enemy-card');
    const afterSkill = act(active, { type: 'play', uid: 'animation-pouch', target: 'e0' });
    expect(storage.saveActive).toHaveBeenCalledTimes(2);
    expect(storage.saveActive).toHaveBeenLastCalledWith(act(afterSkill, { type: 'play', uid: 'next-kick', target: 'e0' }));
  });

  it('keeps the native drag source mounted when a previous animation expires', async () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'battle', enemyId: 'dust-mite' };
    const active = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
    active.combat!.hand = [
      { uid: 'animation-pouch', id: 'cheek-pouch', level: 0, mergeLevel: 0 },
      { uid: 'drag-kick', id: 'wheel-kick', level: 0, mergeLevel: 0 },
    ];
    const storage = await resumeFixture(active);
    click('.hand [data-id="cheek-pouch"]');
    const card = document.querySelector('.hand [data-id="wheel-kick"]')!;
    card.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
    await vi.advanceTimersByTimeAsync(1051);
    expect(card.isConnected).toBe(true);
    expect(document.querySelector('.hand [data-id="wheel-kick"]')).toBe(card);
    expect(storage.saveActive).toHaveBeenCalledTimes(1);
    card.dispatchEvent(new Event('dragend', { bubbles: true }));
    expect(document.querySelector('.card-play-effect')).toBeNull();
    expect(document.querySelector('.hand [data-id="wheel-kick"]')!.getAttribute('aria-pressed')).toBe('true');
    click('.enemy-card');
    expect(storage.saveActive).toHaveBeenCalledTimes(2);
  });

  it('plays a defensive skill directly and applies presentation settings without changing the run', async () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'battle', enemyId: 'dust-mite' };
    const active = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
    active.combat!.hand = [{ uid: 'test-pouch', id: 'cheek-pouch', level: 0, mergeLevel: 0 }];
    const storage = await resumeFixture(active);
    click('[data-action="settings"]');
    const effects = document.querySelector<HTMLInputElement>('[data-setting="reduceEffects"]')!;
    expect(effects).not.toBeNull();
    effects.checked = true;
    effects.dispatchEvent(new Event('change', { bubbles: true }));
    const speed = document.querySelector<HTMLSelectElement>('[data-setting="animationSpeed"]')!;
    speed.value = 'fast';
    speed.dispatchEvent(new Event('change', { bubbles: true }));
    expect(storage.saveActive).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('squeekspire:v2:preferences')!)).toMatchObject({ reduceEffects: true, animationSpeed: 'fast' });
    click('[data-action="close"]');
    click('.hand [data-id="cheek-pouch"]');
    const saved = vi.mocked(storage.saveActive).mock.calls[0][0];
    expect(saved).toEqual(act(active, { type: 'play', uid: 'test-pouch', target: active.combat!.enemies[0].uid }));
    expect(saved.combat!.block).toBe(5);
    expect(document.querySelector('.squeek-burst, .squeek-shake')).toBeNull();
    expect(storage.saveActive).toHaveBeenCalledTimes(1);
  });

  it('migrates legacy Chinese preferences to English without a language selector and keeps all five illustrated tips', async () => {
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ language: 'zh' }));
    await boot();
    expect(document.documentElement.lang).toBe('en');
    expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
    click('[data-action="settings"]');
    expect(document.querySelector('[data-setting="language"]')).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
    const effects = document.querySelector<HTMLInputElement>('[data-setting="reduceEffects"]')!;
    effects.checked = true;
    effects.dispatchEvent(new Event('change', { bubbles: true }));
    click('[data-action="close"]');
    const { t } = await import('./guide');
    expect(document.querySelector('[data-action="start"]')!.textContent).toContain(t('en', 'start'));
    expect(JSON.parse(localStorage.getItem('squeekspire:v2:preferences')!)).toMatchObject({ language: 'en' });
    click('[data-action="help"]');
    for (let page = 0; page < 5; page++) {
      click(`[data-action="guide-page"][data-page="${page}"]`);
      expect(document.querySelector(`.guide-page[data-guide-page="${page}"]`)).not.toBeNull();
      expect(document.querySelector('.guide-art svg[role="img"][aria-label]')).not.toBeNull();
      expect(document.querySelector('.guide-copy')!.textContent!.trim().length).toBeGreaterThan(10);
      expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
    }
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
  });

  it('swipes tips horizontally while leaving short taps, vertical scrolling and cancelled gestures alone', async () => {
    await boot();
    click('[data-action="help"]');
    const swipe = (dx: number, dy = 0, cancel = false) => {
      const art = document.querySelector('.guide-art')!;
      art.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientX: 220, clientY: 250 }));
      art.dispatchEvent(new PointerEvent(cancel ? 'pointercancel' : 'pointerup', { bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientX: 220 + dx, clientY: 250 + dy }));
    };
    const page = () => document.querySelector<HTMLElement>('.guide-page')!.dataset.guidePage;
    swipe(-100);
    expect(page()).toBe('1');
    swipe(-10);
    swipe(-60, 160);
    swipe(-120, 0, true);
    expect(page()).toBe('1');
    swipe(100);
    expect(page()).toBe('0');
    swipe(100);
    expect(page()).toBe('0');
    click('[data-action="guide-page"][data-page="4"]');
    swipe(-100);
    expect(page()).toBe('4');
    expect(document.querySelector('.guide-dot[aria-current="page"]')?.getAttribute('data-page')).toBe('4');
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
  });

  it('supports keyboard tips and optional rules without losing focus, changing the run or trapping the summary', async () => {
    const active = createRun(fallbackDay('2026-11-04'), generateMap(fallbackDay('2026-11-04')), 'practice');
    const storage = await resumeFixture(active);
    const savesBefore = vi.mocked(storage.saveActive).mock.calls.length;
    click('[data-action="help"]');
    expect(document.querySelector<HTMLDetailsElement>('.guide-details')!.open).toBe(false);
    const key = (value: string, target: EventTarget = document) => target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    key('End');
    expect(document.querySelector<HTMLElement>('.guide-page')!.dataset.guidePage).toBe('4');
    expect(document.activeElement).toBe(document.querySelector('.guide-dot[aria-current="page"]'));
    key('ArrowLeft');
    expect(document.querySelector<HTMLElement>('.guide-page')!.dataset.guidePage).toBe('3');
    document.querySelector<HTMLDetailsElement>('.guide-details')!.open = true;
    key('ArrowRight');
    expect(document.querySelector<HTMLDetailsElement>('.guide-details')!.open).toBe(true);
    key('Home', document.querySelector('.guide-details summary')!);
    expect(document.querySelector<HTMLElement>('.guide-page')!.dataset.guidePage).toBe('4');
    const close = document.querySelector<HTMLElement>('[data-action="close"]')!;
    close.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(document.querySelector('.guide-details summary'));
    key('Tab');
    expect(document.activeElement).toBe(close);
    click('[data-action="close"]');
    click('[data-action="help"]');
    expect(document.querySelector<HTMLElement>('.guide-page')!.dataset.guidePage).toBe('0');
    expect(document.querySelector<HTMLDetailsElement>('.guide-details')!.open).toBe(false);
    expect(vi.mocked(storage.saveActive).mock.calls.length).toBe(savesBefore);
  });

  it('labels the offline fallback and discloses the captured snapshot', async () => {
    await boot();
    click('[data-action="more"]');
    await vi.waitFor(() => expect(document.querySelector('.leaderboard h2')!.textContent).toBe('Offline - local scores'));
    expect(document.querySelector('.data-notice')!.textContent).toMatch(/captured real hamster run snapshot/i);
    expect(document.querySelector('.data-notice')!.textContent).toMatch(/daily refresh coming soon/i);
  });

  it.each((['rest', 'shop', 'event'] as const).flatMap(kind =>
    (['en', 'zh'] as const).flatMap(language =>
      (['header', 'footer'] as const).map(placement => ({ kind, language, placement }))),
  ))('leaves a $kind room through its English $placement button with saved $language preferences without taking an encounter option', async ({ kind, language, placement }) => {
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ language }));
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind };
    const active = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
    active.hp = 40;
    const storage = await resumeFixture(active);
    const label = kind === 'shop' ? 'Leave shop →' : 'Continue →';
    const panel = document.querySelector('.encounter-panel')!;
    expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
    expect(document.querySelector('.room-back')).toBeNull();
    expect(document.querySelectorAll('[data-action="leave"]')).toHaveLength(2);
    expect(panel.querySelector('.encounter-header h1')).not.toBeNull();
    expect(panel.lastElementChild).toBe(panel.querySelector('.encounter-footer'));
    for (const location of ['header', 'footer']) {
      const button = panel.querySelector<HTMLButtonElement>(`.encounter-${location} .encounter-continue[data-action="leave"]`);
      expect(button).not.toBeNull();
      expect(button!.textContent!.trim()).toBe(label);
      expect(button!.classList.contains('primary-button')).toBe(true);
      expect(button!.disabled).toBe(false);
    }
    expect(panel.querySelector('.encounter-footer .encounter-continue.full-width')).not.toBeNull();
    click(`.encounter-${placement} .encounter-continue[data-action="leave"]`);
    expect(storage.saveActive).toHaveBeenCalledTimes(1);
    expect(storage.saveActive).toHaveBeenLastCalledWith(act(active, { type: 'leave' }));
    const saved = vi.mocked(storage.saveActive).mock.calls[0][0];
    expect(saved).toMatchObject({ hp: active.hp, gold: active.gold, deck: active.deck });
    expect(saved.log.at(-1)).toEqual({ type: 'leave' });
    expect(document.querySelector('.map-panel')).not.toBeNull();
    expect(document.querySelectorAll('.map-node.reachable').length).toBeGreaterThan(0);
  });

  it('keeps a rest selection through a modal and resets it after entering another room', async () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    map[0] = { ...map[0], kind: 'rest' };
    map[1] = { ...map[1], kind: 'rest' };
    const storage = await resumeFixture(act(createRun(day, map, 'daily'), { type: 'enter', nodeId: 0 }));
    const select = document.querySelector<HTMLSelectElement>('#upgrade-card')!;
    select.value = select.options[3].value;
    const chosen = select.value;
    click('[data-action="collection"]');
    for (const background of document.querySelectorAll('.app-shell > .topbar, .app-shell > .layout, .app-shell > .footer')) {
      expect(background.hasAttribute('inert')).toBe(true);
    }
    click('[data-action="heal"]');
    expect(storage.saveActive).not.toHaveBeenCalled();
    const close = document.querySelector<HTMLElement>('[data-action="close"]')!;
    const lastCard = Array.from(document.querySelectorAll<HTMLElement>('.modal .card')).at(-1)!;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(lastCard);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    document.body.tabIndex = -1;
    document.body.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    document.body.removeAttribute('tabindex');
    click('[data-action="close"]');
    expect(document.querySelector<HTMLSelectElement>('#upgrade-card')!.value).toBe(chosen);
    expect(document.querySelector('.topbar')!.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(document.querySelector('[data-action="collection"]'));
    click('[data-action="heal"]');
    click('[data-action="node"][data-id="1"]');
    const nextSelect = document.querySelector<HTMLSelectElement>('#upgrade-card')!;
    expect(nextSelect.value).toBe(nextSelect.options[0].value);
    expect(nextSelect.value).not.toBe(chosen);
  });
});
