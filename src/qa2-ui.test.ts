// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fallbackDay } from './game/data';
import { generateMap } from './game/map';
import { act, createRun, type CardInstance } from './game/engine';

const card = (id: string, uid: string): CardInstance => ({ id, uid, level: 0, mergeLevel: 0 });
const click = (selector: string) => {
  const element = document.querySelector<HTMLButtonElement>(selector);
  expect(element, selector).not.toBeNull();
  element!.click();
};
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
  localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
});
afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('Oracle choices include the next discard reshuffle; cancellation is free and confirmation uses the selected copy', async () => {
  const day = fallbackDay('2026-11-04'), map = generateMap(day);
  const state = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
  state.combat!.hand = [card('oracle-ping', 'oracle')];
  state.combat!.draw = [card('wheel-kick', 'top')];
  state.combat!.discard = [card('cheek-pouch', 'discard-a'), card('seed-snack', 'discard-b')];
  const data = await import('./game/data'), storage = await import('./game/storage');
  vi.spyOn(data, 'loadDay').mockResolvedValue(day);
  vi.spyOn(storage, 'loadActive').mockImplementation(mode => mode === 'practice' ? structuredClone(state) : null);
  vi.spyOn(storage, 'saveActive').mockImplementation(() => {});
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
  click('[data-action="resume"]'); click('.hand [data-id="oracle-ping"]');
  const options = [...document.querySelectorAll<HTMLElement>('[data-action="choose-card"]')];
  expect(options.map(e => e.dataset.uid).sort()).toEqual(['discard-a', 'discard-b', 'top']);
  const chosenUid = options[1]!.dataset.uid;
  click('[data-action="choose-card"][data-index="1"]'); click('[data-action="cancel-play"]');
  expect(storage.saveActive).not.toHaveBeenCalled();
  click('.hand [data-id="oracle-ping"]'); click('[data-action="choose-card"][data-index="1"]');
  click('[data-action="confirm-play"]');
  const saved = vi.mocked(storage.saveActive).mock.calls.at(-1)![0];
  expect(saved.combat!.draw.at(-1)!.uid).toBe(chosenUid);
  expect(saved.log.at(-1)).toMatchObject({ type: 'play', uid: 'oracle', choice: 1 });
});
