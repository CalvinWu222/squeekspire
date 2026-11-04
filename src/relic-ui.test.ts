// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals();
});

it('shows a treasure pickup and continues without offering a card or losing the relic', async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
  localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
  const data = await import('./game/data'), storage = await import('./game/storage');
  const { act, createRun } = await import('./game/engine');
  const { generateMap } = await import('./game/map');
  const day = data.fallbackDay('2026-11-04'), map = generateMap(day);
  map[0] = { ...map[0]!, kind: 'treasure', enemyId: '' };
  const state = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
  const relic = state.reward!.relic!;
  vi.spyOn(data, 'loadDay').mockResolvedValue(day);
  vi.spyOn(storage, 'loadActive').mockImplementation(mode => mode === 'practice' ? structuredClone(state) : null);
  vi.spyOn(storage, 'saveActive').mockImplementation(() => {});
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
  document.querySelector<HTMLButtonElement>('[data-action="resume"]')!.click();
  expect(document.querySelector('.encounter-panel')!.textContent).toContain('TREASURE ROOM');
  expect(document.querySelector('[data-action="pick-card"]')).toBeNull();
  const next = document.querySelector<HTMLButtonElement>('[data-action="skip-reward"]')!;
  expect(next.textContent).toContain('Continue'); next.click();
  expect(document.querySelector('.map-panel')).not.toBeNull();
  const saved = vi.mocked(storage.saveActive).mock.calls.at(-1)![0];
  expect(saved.phase).toBe('map'); expect(saved.relics).toContain(relic);
  expect(document.querySelectorAll('.map-node.treasure')).toHaveLength(4);
});
