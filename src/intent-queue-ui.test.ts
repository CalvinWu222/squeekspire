// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fallbackDay } from './game/data';
import { generateMap } from './game/map';
import { act, createRun, type CardInstance } from './game/engine';

const card = (id: string, uid = id): CardInstance => ({ id, uid, level: 0, mergeLevel: 0 });
function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  expect(element, selector).not.toBeNull(); element!.click();
}
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
  localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
  localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ reduceEffects: true }));
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
});
afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('playing Sleep Cam shows a numbered queue above each enemy until the revealed turns have acted', async () => {
  const day = { ...fallbackDay('2026-11-04'), difficulty: 1, hibernation: false, spinning: false };
  const map = generateMap(day);
  map[0] = { ...map[0]!, kind: 'battle', enemyId: 'queue-snake', jackpot: false };
  const state = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
  state.hp = state.maxHp = 1000;
  state.combat!.hand = [card('sleep-cam')];
  state.combat!.draw = Array.from({ length: 30 }, (_, i) => card('cheek-pouch', `draw-${i}`));
  state.combat!.enemies.push({ ...state.combat!.enemies[0]!, uid: 'e1', id: 'seed-thief', name: 'Seed Thief', intent: { type: 'block', damage: 8, times: 1, label: 'Gain 8 Block' } });
  const data = await import('./game/data'), storage = await import('./game/storage');
  vi.spyOn(data, 'loadDay').mockResolvedValue(day);
  vi.spyOn(storage, 'loadActive').mockImplementation(mode => mode === 'practice' ? structuredClone(state) : null);
  vi.spyOn(storage, 'saveActive').mockImplementation(() => {});
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
  click('[data-action="resume"]');
  expect(document.querySelector('.enemy-intent-queue')).toBeNull();
  click('.hand [data-id="sleep-cam"]');
  expect(document.querySelectorAll('.enemy-intent-queue')).toHaveLength(2);
  for (const uid of ['e0', 'e1']) {
    const enemy = document.querySelector(`[data-enemy="${uid}"]`)!;
    const queue = enemy.querySelector('.enemy-intent-queue')!;
    expect(queue.textContent).toContain('Turn +1'); expect(queue.textContent).toContain('Turn +2');
    expect(queue.compareDocumentPosition(enemy.querySelector('.intent')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...queue.querySelectorAll<HTMLElement>('.queued-intent')].map(item => item.dataset.turn)).toEqual(['2', '3']);
  }
  expect(document.querySelector('[data-enemy="e0"] .enemy-intent-queue')!.textContent).toContain('Attack 11');
  expect(document.querySelector('[data-enemy="e1"] .enemy-intent-queue')!.textContent).toContain('Attack 8');
  click('[data-action="end-turn"]');
  expect(document.querySelectorAll('.queued-intent[data-turn="2"][data-offset="0"]')).toHaveLength(2);
  expect(document.querySelector('.enemy-intent-queue')!.textContent).toContain('This turn');
  click('[data-action="end-turn"]');
  expect(document.querySelectorAll('.queued-intent')).toHaveLength(2);
  expect(document.querySelector('.queued-intent[data-turn="2"]')).toBeNull();
  click('[data-action="end-turn"]');
  expect(document.querySelector('.enemy-intent-queue')).toBeNull();
  expect(vi.mocked(storage.saveActive).mock.calls.at(-1)![0].combat!.turn).toBe(4);
});
