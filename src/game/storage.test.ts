import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createRun } from './engine';
import { fallbackDay } from './data';
import { generateMap } from './map';
import type { RunMode } from './types';

const PREFIX = 'squeekspire:v1:';
let saved: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); },
    removeItem: (key: string) => { saved.delete(key); },
    clear: () => saved.clear(),
    get length() { return saved.size; },
    key: (index: number) => [...saved.keys()][index] ?? null,
  });
});

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

const newRun = (mode: RunMode = 'daily') => {
  const day = fallbackDay('2026-11-04');
  return createRun(day, generateMap(day), mode);
};

describe('local daily profile and attempt claims', () => {
  it('creates a guest+number profile once and preserves it on reload', async () => {
    const storage = await import('./storage');
    const profile = storage.getProfile();
    expect(profile).toMatch(/^guest\d{4}$/);
    expect(storage.getProfile()).toBe(profile);
    vi.resetModules();
    expect((await import('./storage')).getProfile()).toBe(profile);
  });

  it('claims an official attempt at start, including abandonment and browser reload', async () => {
    let storage = await import('./storage');
    expect(storage.dailyUsed('2026-11-04')).toBe(false);
    expect(storage.claimDaily('2026-11-04')).toBe(true);
    expect(storage.dailyUsed('2026-11-04')).toBe(true);
    expect(storage.claimDaily('2026-11-04')).toBe(false);
    storage.saveActive(act(newRun(), { type: 'abandon' }));
    vi.resetModules();
    storage = await import('./storage');
    expect(storage.claimDaily('2026-11-04')).toBe(false);
    expect(storage.claimDaily('2026-11-05')).toBe(true);
    expect(storage.currentStreak('2026-11-05')).toBe(2);
    expect(storage.currentStreak('2026-11-06')).toBe(2);
    expect(storage.currentStreak('2026-11-07')).toBe(0);
  });

  it('keeps the session playable and the daily claim consumed when browser storage is blocked', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage disabled'); },
      setItem: () => { throw new Error('storage disabled'); },
    });
    const storage = await import('./storage');
    const profile = storage.getProfile();
    expect(storage.getProfile()).toBe(profile);
    expect(storage.hasPersistentStorage()).toBe(false);
    expect(storage.claimDaily('2026-11-04')).toBe(true);
    expect(storage.claimDaily('2026-11-04')).toBe(false);
    const run = act(newRun(), { type: 'enter', nodeId: 0 });
    storage.saveActive(run);
    expect(storage.loadActive('daily')).toEqual(run);
  });

  it('keeps newer session progress when storage reads work but writes fail', async () => {
    saved.set(`${PREFIX}official-days`, JSON.stringify(['2026-11-03']));
    saved.set(`${PREFIX}active:daily`, JSON.stringify(null));
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: () => { throw new Error('quota exceeded'); },
    });
    const storage = await import('./storage');
    expect(storage.claimDaily('2026-11-04')).toBe(true);
    expect(storage.dailyUsed('2026-11-04')).toBe(true);
    expect(storage.claimDaily('2026-11-04')).toBe(false);
    const run = act(newRun(), { type: 'enter', nodeId: 0 });
    storage.saveActive(run);
    expect(storage.loadActive('daily')).toEqual(run);
    expect(storage.hasPersistentStorage()).toBe(false);
  });

  it('counts consecutive game dates through month and leap-year boundaries', async () => {
    const storage = await import('./storage');
    storage.claimDaily('2024-02-28');
    storage.claimDaily('2024-02-29');
    storage.claimDaily('2024-03-01');
    expect(storage.currentStreak('2024-03-01')).toBe(3);
    expect(storage.currentStreak('2024-03-02')).toBe(3);
    expect(storage.currentStreak('2024-03-03')).toBe(0);
  });

  it('recovers from valid JSON with the wrong shape in the official-day list', async () => {
    for (const malformed of [null, {}, 42, '2026-11-04']) {
      saved.set(`${PREFIX}official-days`, JSON.stringify(malformed));
      vi.resetModules();
      const storage = await import('./storage');
      expect(storage.dailyUsed('2026-11-04')).toBe(false);
      expect(storage.currentStreak('2026-11-04')).toBe(0);
      expect(storage.claimDaily('2026-11-04')).toBe(true);
      expect(storage.claimDaily('2026-11-04')).toBe(false);
    }
  });
});

describe('saved action replays', () => {
  it('resumes the recomputed run after a module reload and isolates the selected mode', async () => {
    let storage = await import('./storage');
    const run = act(newRun(), { type: 'enter', nodeId: 0 });
    storage.saveActive(run);
    expect(storage.loadActive('practice')).toBeNull();
    const payload = JSON.parse(saved.get(`${PREFIX}active:daily`)!);
    expect(payload.actions).toEqual(run.log);
    expect(payload).not.toHaveProperty('combat');
    vi.resetModules();
    storage = await import('./storage');
    expect(storage.loadActive('daily')).toEqual(run);
  });

  it('rejects a corrupted score export instead of restoring client state', async () => {
    const storage = await import('./storage');
    storage.saveActive(act(newRun(), { type: 'enter', nodeId: 0 }));
    const payload = JSON.parse(saved.get(`${PREFIX}active:daily`)!);
    payload.claimedScore = 999999;
    saved.set(`${PREFIX}active:daily`, JSON.stringify(payload));
    expect(storage.loadActive('daily')).toBeNull();
    saved.set(`${PREFIX}active:daily`, '{broken-json');
    expect(storage.loadActive('daily')).toBeNull();
  });

  it('preserves an endless wall clock across reload and caps elapsed time at five minutes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
    let storage = await import('./storage');
    storage.startEndlessClock();
    vi.advanceTimersByTime(123000);
    expect(storage.endlessElapsed()).toBe(123000);
    vi.resetModules();
    storage = await import('./storage');
    expect(storage.endlessElapsed()).toBe(123000);
    vi.advanceTimersByTime(200000);
    expect(storage.endlessElapsed()).toBe(300000);
  });

  it('recovers a finite elapsed clock from malformed saved timestamps', async () => {
    const storage = await import('./storage');
    for (const malformed of ['bad timestamp', {}, null]) {
      saved.set(`${PREFIX}endless-started`, JSON.stringify(malformed));
      expect(storage.endlessElapsed()).toBe(0);
    }
  });
});

describe('local replay-verified leaderboards', () => {
  it('preserves full wallet identities alongside guest results after reload', async () => {
    const address = '0x1234567890aBcDEF1234567890abcdef1234ABcD';
    let storage = await import('./storage');
    const run = act(newRun('practice'), { type: 'abandon' });
    storage.recordResult(run, 'guest4821');
    const walletResult = storage.recordResult(run, address);
    expect(walletResult.profile).toBe(address);
    expect(walletResult.id.startsWith(`${address}:`)).toBe(true);
    vi.resetModules();
    storage = await import('./storage');
    expect(storage.getBoard('practice').map(row => row.profile)).toEqual(['guest4821', address]);
    expect(storage.getBoard('practice').find(row => row.profile === address)).toEqual(walletResult);
    expect(storage.getProfile()).toMatch(/^guest\d{4}$/);
  });

  it('filters malformed wallet identities without losing existing guests or valid addresses', async () => {
    const storage = await import('./storage');
    const run = act(newRun('practice'), { type: 'abandon' });
    const address = '0xabcdefABCDEF1234567890abcdef1234567890AB';
    for (const profile of ['guest4821', address, '0x1234...abcd', `0x${'a'.repeat(39)}`, `0x${'g'.repeat(40)}`]) {
      storage.recordResult(run, profile);
    }
    expect(storage.getBoard('practice').map(row => row.profile)).toEqual(['guest4821', address]);
  });

  it('keeps the daily claim browser-wide across guest and wallet identities', async () => {
    const storage = await import('./storage');
    const profile = storage.getProfile();
    expect(storage.claimDaily('2026-11-04')).toBe(true);
    storage.recordResult(act(newRun(), { type: 'abandon' }), profile);
    storage.recordResult(act(newRun('practice'), { type: 'abandon' }), '0x1234567890abcdef1234567890abcdef12345678');
    vi.resetModules();
    expect((await import('./storage')).claimDaily('2026-11-04')).toBe(false);
  });

  it('rejects unfinished runs and stores finished results on separate mode boards', async () => {
    const storage = await import('./storage');
    expect(() => storage.recordResult(newRun(), 'guest4821')).toThrow('Finish the run');
    expect(storage.getBoard('daily')).toEqual([]);
    for (const mode of ['daily', 'practice', 'endless'] as const) {
      storage.recordResult(act(newRun(mode), { type: 'abandon' }), 'guest4821');
    }
    for (const mode of ['daily', 'practice', 'endless'] as const) {
      const board = storage.getBoard(mode, '2026-11-04');
      expect(board).toHaveLength(1);
      expect(board[0]).toMatchObject({ profile: 'guest4821', mode, score: 0, won: false });
    }
    expect(storage.getBoard('daily', '2026-11-05')).toEqual([]);
  });

  it('keeps the first daily result for a profile and deduplicates identical practice replays', async () => {
    const storage = await import('./storage');
    const first = storage.recordResult(act(newRun(), { type: 'abandon' }), 'guest4821');
    const secondRun = act(act(newRun(), { type: 'enter', nodeId: 0 }), { type: 'abandon' });
    expect(storage.recordResult(secondRun, 'guest4821')).toEqual(first);
    expect(storage.getBoard('daily')).toHaveLength(1);
    const practice = act(newRun('practice'), { type: 'abandon' });
    storage.recordResult(practice, 'guest4821');
    storage.recordResult(practice, 'guest4821');
    expect(storage.getBoard('practice')).toHaveLength(1);
  });

  it('recovers the board when stored JSON is not an array', async () => {
    const storage = await import('./storage');
    for (const malformed of [null, {}, 42, 'board']) {
      saved.set(`${PREFIX}board`, JSON.stringify(malformed));
      expect(storage.getBoard('daily')).toEqual([]);
      storage.recordResult(act(newRun(), { type: 'abandon' }), 'guest4821');
      expect(storage.getBoard('daily')).toHaveLength(1);
    }
  });
});
