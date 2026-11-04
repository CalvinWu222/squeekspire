// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fallbackDay } from './game/data';
import { act, createRun } from './game/engine';
import { generateMap } from './game/map';
import { fetchLeaderboard, submitScore } from './leaderboard';
import { SCORE_VERSION } from './game/score';

const day = fallbackDay('2026-11-04');
const address = '0x1234567890abcdef1234567890abcdef1234abcd';
const entry = { id: 'sample', profile: address, day: day.day, seed: day.seed, mode: 'daily',
  scoreVersion: SCORE_VERSION, score: 100, bestHit: 30, floor: 1, won: false, hibernation: false, streak: 0 };
const finished = act(createRun(day, generateMap(day), 'daily'), { type: 'abandon' });
const response = (data: unknown) => ({ ok: true, json: async () => data });

describe('shared leaderboard client', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('requests the shared daily seed and keeps endless on its all-days board', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ entries: [entry] }) as Response);
    expect(await fetchLeaderboard('daily', day.seed)).toEqual([entry]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`/api/leaderboard?mode=daily&runMode=daily&seed=${day.seed}`);
    await fetchLeaderboard('endless', day.seed);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/leaderboard?mode=all&runMode=endless');
  });

  it('submits the full replay and wallet identity without signing', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ entry }) as Response);
    await submitScore(finished, address);
    const [path, init] = vi.mocked(fetch).mock.calls[0];
    expect(path).toBe('/api/score');
    expect(init!.method).toBe('POST');
    expect(JSON.parse(String(init!.body))).toMatchObject({ seed: day.seed,
      identity: { walletAddress: address }, run: { scoreVersion: SCORE_VERSION, actions: [{ type: 'abandon' }], claimedScore: 0 } });
  });

  it('uses a guest identity when a wallet is absent', async () => {
    vi.mocked(fetch).mockResolvedValue(response({ entry }) as Response);
    await submitScore(finished, 'guest4321');
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]!.body)).identity).toEqual({ guestId: 'guest4321' });
  });

  it('rejects an unavailable or malformed API so the UI can fall back locally', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(fetchLeaderboard('daily', day.seed)).rejects.toThrow('503');
    vi.mocked(fetch).mockResolvedValue(response({ entries: [{ ...entry, score: 'tampered' }] }) as Response);
    await expect(fetchLeaderboard('daily', day.seed)).rejects.toThrow('Invalid leaderboard');
  });
  it('hides old and unversioned scores even if a stale API response includes them', async () => {
    const { scoreVersion: _version, ...legacy } = entry;
    vi.mocked(fetch).mockResolvedValue(response({ entries: [legacy,
      { ...entry, scoreVersion: SCORE_VERSION - 1, score: 1e100 }, entry] }) as Response);
    expect(await fetchLeaderboard('daily', day.seed)).toEqual([entry]);
  });

  it('bounds a stalled connection so offline scores become available', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(new Error('Connection timed out')));
    }));
    const pending = expect(fetchLeaderboard('daily', day.seed)).rejects.toThrow('Connection timed out');
    await vi.advanceTimersByTimeAsync(5000);
    await pending;
  });
});

describe('online leaderboard in the game', () => {
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('fetch', vi.fn(async input => {
      if (String(input).startsWith('/api/')) return response({ entries: [entry] }) as Response;
      throw new Error('No external network in tests');
    }));
  });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });
  const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();
  const boot = async () => {
    await import('./main');
    await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
  };

  it('shows global scores and shortens wallet labels', async () => {
    await boot(); click('[data-action="more"]');
    await vi.waitFor(() => expect(document.querySelector('.leaderboard h2')!.textContent).toBe('Global leaderboard'));
    expect(document.querySelector('.board-id')!.textContent).toContain('0x1234...abcd');
    expect(document.querySelector('.board-score')!.textContent).toBe('100');
  });

  it('labels offline local scores clearly and can reconnect using Refresh', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Offline'));
    await boot(); click('[data-action="more"]');
    await vi.waitFor(() => expect(document.querySelector('.leaderboard h2')!.textContent).toBe('Offline - local scores'));
    vi.mocked(fetch).mockResolvedValue(response({ entries: [entry] }) as Response);
    click('[data-action="board-refresh"]');
    await vi.waitFor(() => expect(document.querySelector('.leaderboard h2')!.textContent).toBe('Global leaderboard'));
  });

  it('submits a finished run and preserves the replay-verified local result', async () => {
    await boot(); click('[data-action="start"]'); click('[data-action="mode"][data-mode="practice"]');
    click('[data-action="begin"]'); click('[data-action="more"]'); click('[data-action="abandon"]');
    await vi.waitFor(() => expect(document.querySelector('.online-score-status')!.textContent).toContain('Score submitted'));
    const posts = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/score');
    expect(posts).toHaveLength(1);
    const payload = JSON.parse(String(posts[0][1]!.body));
    expect(payload.identity.guestId).toMatch(/^guest\d+$/);
    expect(payload.run.actions.at(-1)).toEqual({ type: 'abandon' });
    expect(JSON.parse(localStorage.getItem('squeekspire:v1:board')!)).toHaveLength(1);
  });

  it('ignores a late response after switching to a different mode', async () => {
    await boot();
    let finishDaily!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(input => String(input).includes('runMode=daily')
      ? new Promise<Response>(resolve => { finishDaily = resolve; })
      : Promise.resolve(response({ entries: [] }) as Response));
    click('[data-action="more"]'); click('[data-action="board"][data-mode="endless"]');
    await vi.waitFor(() => expect(document.querySelector('.leaderboard h2')!.textContent).toBe('Global leaderboard'));
    finishDaily(response({ entries: [entry] }) as Response);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(document.querySelectorAll('.leaderboard-row')).toHaveLength(0);
    expect(document.querySelector('.board-caption')!.textContent).toContain('All days');
  });
});
