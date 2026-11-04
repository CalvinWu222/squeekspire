// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fallbackDay } from './game/data';
import { SCORE_VERSION } from './game/score';
import type { DayData } from './game/types';
import type { GlobalEntry, LeaderboardOverview } from './leaderboard';
import type { HamsterStatus } from './overlay-data';
import { mountOverlay } from './overlay';

const mocks = vi.hoisted(() => ({ status: vi.fn(), day: vi.fn(), board: vi.fn() }));
vi.mock('./overlay-data', async importOriginal => ({
  ...await importOriginal<typeof import('./overlay-data')>(),
  fetchHamsterStatus: mocks.status, fetchOverlayDay: mocks.day,
}));
vi.mock('./leaderboard', () => ({ fetchLeaderboardOverview: mocks.board }));

const address = '0x1234567890abcdef1234567890abcdef1234abcd';
const daily = (day = '2026-11-04'): DayData => ({ ...fallbackDay(day), source: 'live' });
function overview(count = 6, day = '2026-11-04'): LeaderboardOverview {
  const entries: GlobalEntry[] = Array.from({ length: count }, (_, index) => ({
    id: `run-${index}`, profile: index === 0 ? address : `guest${1000 + index}`,
    day, seed: daily(day).seed, mode: 'daily', scoreVersion: SCORE_VERSION,
    score: 9000 - index, bestHit: 100, floor: 24, won: true, hibernation: false, streak: 0,
  }));
  return { today: { day, seed: daily(day).seed, entries }, champions: [], allTime: [], storage: 'local', scoreVersion: SCORE_VERSION };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(deliver => { resolve = deliver; });
  return { promise, resolve };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const rows = () => document.querySelectorAll('.ov-rankings li');

describe('read-only OBS overlay', () => {
  let dispose: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    vi.clearAllMocks();
    mocks.status.mockReset().mockResolvedValue({ state: 'idle', rpm: 0, distanceMeters: 0 });
    mocks.day.mockReset().mockResolvedValue(daily());
    mocks.board.mockReset().mockResolvedValue(overview());
    window.history.replaceState(null, '', '/overlay');
    document.documentElement.className = 'existing-page';
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
  });
  afterEach(() => {
    dispose?.(); dispose = undefined;
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });
  async function mount(search = '') {
    window.history.replaceState(null, '', `/overlay${search}`);
    dispose = mountOverlay(); await settle();
  }

  it.each([['bar', 3], ['card', 5]] as const)('renders %s with %i real rows and escapes remote identities', async (layout, count) => {
    const data = overview();
    data.today.entries[1].profile = '<img src=x onerror="alert(1)">';
    mocks.board.mockResolvedValue(data);
    await mount(`?layout=${layout}`);
    expect(document.querySelector('.ov-shell')?.getAttribute('data-layout')).toBe(layout);
    expect(rows()).toHaveLength(count);
    expect(rows()[1].textContent).toContain('<img src=x onerror="alert(1)">');
    expect(document.querySelector('.ov-rankings img')).toBeNull();
    expect(rows()[0].textContent).toContain('0x1234');
    expect(rows()[0].textContent).toContain('abcd');
    expect(rows()[0].textContent).toContain('9,000');
    expect(document.querySelector('[data-section="boss"]')?.textContent).toContain('2026-11-04');
    expect(document.querySelector('[data-section="boss"]')?.textContent).toContain(daily().seed.toString(16).padStart(8, '0').toUpperCase());
  });

  it('shows an honest empty board with no fabricated climbers', async () => {
    mocks.board.mockResolvedValue(overview(0));
    await mount();
    expect(rows()).toHaveLength(0);
    expect(document.querySelector('.ov-board-empty')?.textContent).toContain('No verified daily runs');
  });

  it('refreshes each live panel every 15 seconds while a different request is pending', async () => {
    const pendingStatus = deferred<HamsterStatus>();
    mocks.status.mockResolvedValueOnce({ state: 'spinning', rpm: 18 }).mockReturnValueOnce(pendingStatus.promise);
    await mount();
    expect(mocks.board).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(mocks.board).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mocks.status).toHaveBeenCalledTimes(2);
    expect(mocks.board).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mocks.status).toHaveBeenCalledTimes(2);
    expect(mocks.board).toHaveBeenCalledTimes(3);
    expect(mocks.day).toHaveBeenCalledTimes(1);
    pendingStatus.resolve({ state: 'idle', rpm: 0 }); await settle();
    expect(document.querySelector('[data-section="status"]')?.getAttribute('data-state')).toBe('idle');
  });

  it('retains and labels the last loaded board after a failed refresh, then recovers', async () => {
    mocks.status.mockResolvedValueOnce({ state: 'spinning', rpm: 20 })
      .mockResolvedValueOnce({ state: 'unavailable', reason: 'Waiting for a fresh measurement' })
      .mockResolvedValueOnce({ state: 'idle', rpm: 0 });
    mocks.board.mockResolvedValueOnce(overview(4)).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(overview(1));
    await mount();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(rows()).toHaveLength(3);
    expect(document.querySelector('.ov-board-meta')?.textContent).toContain('LAST LOADED BOARD');
    expect(document.querySelector('[data-section="status"]')?.getAttribute('data-state')).toBe('unavailable');
    expect(document.querySelector('.ov-description')?.textContent).toContain('fresh measurement');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(rows()).toHaveLength(1);
    expect(document.querySelector('.ov-board-meta')?.textContent).not.toContain('LAST LOADED BOARD');
    expect(document.querySelector('[data-section="status"]')?.getAttribute('data-state')).toBe('idle');
  });

  it('recovers a failed status request on the next scheduled refresh', async () => {
    mocks.status.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ state: 'spinning', rpm: 12 });
    await mount('?show=status');
    expect(document.querySelector('[data-section="status"]')?.getAttribute('data-state')).toBe('unavailable');
    expect(document.querySelector('.ov-description')?.textContent).toContain('retrying');
    await vi.advanceTimersByTimeAsync(15_000);
    expect(document.querySelector('[data-section="status"]')?.getAttribute('data-state')).toBe('spinning');
    expect(document.querySelector('.ov-metrics')?.textContent).toContain('12');
  });

  it('labels historical daily fallback and retries it without interrupting live panels', async () => {
    mocks.day.mockResolvedValueOnce(fallbackDay('2026-11-04')).mockResolvedValueOnce(daily());
    await mount();
    expect(document.querySelector('.ov-fallback')?.textContent).toContain('Bundled fixture fallback');
    await vi.advanceTimersByTimeAsync(45_000);
    expect(mocks.day).toHaveBeenCalledTimes(1);
    expect(mocks.status).toHaveBeenCalledTimes(4);
    expect(mocks.board).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mocks.day).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.ov-fallback')).toBeNull();
  });

  it('clears yesterday’s board at the UTC rollover while the new response is pending', async () => {
    vi.setSystemTime(new Date('2026-11-04T23:59:50Z'));
    const newBoard = deferred<LeaderboardOverview>();
    mocks.board.mockResolvedValueOnce(overview(3)).mockReturnValueOnce(newBoard.promise);
    await mount('?show=board');
    expect(rows()).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(rows()).toHaveLength(0);
    expect(document.querySelector('.ov-board-empty')?.textContent).toContain('UTC reset');
    newBoard.resolve(overview(2, '2026-11-05')); await settle();
    expect(rows()).toHaveLength(2);
    expect(document.querySelector('.ov-board-meta')?.textContent).toContain(daily('2026-11-05').seed.toString(16).padStart(8, '0').toUpperCase());
  });

  it('renders selected sections and avoids requests for hidden panels', async () => {
    await mount('?layout=card&show=status&scale=1.5&bg=dark');
    expect(document.querySelector('.ov-stage')?.getAttribute('style')).toContain('--ov-scale:1.5');
    expect(document.documentElement.dataset.overlayBg).toBe('dark');
    expect(document.querySelectorAll('[data-section]')).toHaveLength(1);
    expect(mocks.day).not.toHaveBeenCalled();
    expect(mocks.board).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mocks.status).toHaveBeenCalledTimes(2);
    expect(mocks.day).not.toHaveBeenCalled();
    expect(mocks.board).not.toHaveBeenCalled();
  });

  it('makes no wallet, profile-storage or audio requests', async () => {
    const provider = { request: vi.fn(), on: vi.fn() };
    const audio = vi.fn();
    vi.stubGlobal('ethereum', provider); vi.stubGlobal('AudioContext', audio); vi.stubGlobal('webkitAudioContext', audio);
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    const storageRead = vi.spyOn(Storage.prototype, 'getItem');
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    await mount(); await vi.advanceTimersByTimeAsync(15_000);
    expect(provider.request).not.toHaveBeenCalled();
    expect(provider.on).not.toHaveBeenCalled();
    expect(dispatch.mock.calls.some(([event]) => event.type === 'eip6963:requestProvider')).toBe(false);
    expect(storageRead).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
    expect(audio).not.toHaveBeenCalled();
    expect(document.querySelector('button, audio, [data-action="wallet-connect"]')).toBeNull();
  });

  it('stops polling and ignores in-flight responses after disposal', async () => {
    const pending = deferred<HamsterStatus>();
    mocks.status.mockReturnValue(pending.promise);
    await mount('?show=status');
    const rendered = document.querySelector('#app')!.innerHTML;
    dispose!(); dispose = undefined;
    pending.resolve({ state: 'spinning', rpm: 25 }); await settle();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mocks.status).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#app')!.innerHTML).toBe(rendered);
    expect(document.documentElement.className).toBe('existing-page');
    expect(document.documentElement.dataset.overlayBg).toBeUndefined();
  });
});
