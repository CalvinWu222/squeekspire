// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountLeaderboard } from './leaderboard-page';
import type { GlobalEntry, LeaderboardOverview } from './leaderboard';
import { SCORE_VERSION } from './game/score';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(), mountMusicControls: vi.fn(), setScene: vi.fn(), setVolume: vi.fn(),
}));
vi.mock('./leaderboard', () => ({ fetchLeaderboardOverview: mocks.fetch }));
vi.mock('./music', () => ({
  mountMusicControls: mocks.mountMusicControls,
  music: { setScene: mocks.setScene, setVolume: mocks.setVolume },
}));

const address = '0x1234567890abcdef1234567890abcdef1234abcd';
const entry = (index = 0, day = '2026-11-04'): GlobalEntry => ({
  id: `run-${index}`, profile: index ? `guest${1000 + index}` : address,
  day, seed: 1234, mode: 'daily', scoreVersion: SCORE_VERSION,
  score: 9000 - index, bestHit: 100, floor: 7, won: false, hibernation: false, streak: 0,
});
function overview(count = 0, day = '2026-11-04'): LeaderboardOverview {
  const rows = Array.from({ length: count }, (_, index) => entry(index, day));
  return {
    today: { day, seed: 1234, entries: rows }, allTime: rows,
    champions: Array.from({ length: 7 }, (_, index) => ({
      day: new Date(Date.parse(`${day}T00:00:00Z`) - (index + 1) * 86_400_000).toISOString().slice(0, 10), seed: 1234 + index, entry: null,
    })), storage: 'local', scoreVersion: SCORE_VERSION,
  };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
const click = (selector: string) => {
  const button = document.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull(); button!.click();
};

describe('standalone leaderboard behavior', () => {
  let dispose: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T12:00:00Z'));
    vi.clearAllMocks(); localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
  });
  afterEach(() => {
    dispose?.(); dispose = undefined;
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });
  const mount = async (data = overview()) => {
    mocks.fetch.mockResolvedValue(data); dispose = mountLeaderboard(); await settle();
  };

  it('shows honest empty states for today, past days, and all-time without fabricated winners', async () => {
    await mount();
    expect(document.querySelectorAll('.lb-empty')).toHaveLength(2);
    expect(document.querySelectorAll('.lb-unclaimed')).toHaveLength(3);
    expect(document.querySelectorAll('.lb-champion-empty')).toHaveLength(7);
    expect(document.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(document.querySelector('#today')!.textContent).toContain('No verified runs');
    expect(document.querySelector('#all-time')!.textContent).toContain('Completed runs will appear here');
    expect(document.body.textContent).toContain('LOCAL DEVELOPMENT BOARD');
    expect(document.querySelector('[data-lb-content]')!.getAttribute('aria-busy')).toBe('false');
  });

  it('renders public Sepolia identities with no provider, connection, or signing request', async () => {
    const provider = { request: vi.fn(), on: vi.fn() };
    vi.stubGlobal('ethereum', provider);
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    await mount(overview(1));
    const link = document.querySelector<HTMLAnchorElement>('.lb-player-name[href]')!;
    expect(link.href).toBe(`https://sepolia.etherscan.io/address/${address}`);
    expect(link.rel).toContain('noopener');
    expect(link.textContent).toContain('0x1234');
    expect(link.textContent).toContain('abcd');
    click('[data-lb-refresh]'); await settle();
    expect(provider.request).not.toHaveBeenCalled();
    expect(provider.on).not.toHaveBeenCalled();
    expect(dispatch.mock.calls.some(([event]) => event.type === 'eip6963:requestProvider')).toBe(false);
    expect(document.querySelector('[data-action="wallet-connect"]')).toBeNull();
  });

  it('escapes optional deck theme metadata and labels legacy runs as unrecorded', async () => {
    const data = overview(2);
    data.today.entries[0]!.deckTheme = '<img src=x onerror="alert(1)">';
    await mount(data);
    expect(document.querySelector('.lb-table-deck .lb-theme')!.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(document.querySelector('.lb-table-deck img')).toBeNull();
    expect(document.querySelector('#today')!.textContent).toContain('Unrecorded');
  });

  it('recovers from an API failure using the retry control', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('temporarily offline')).mockResolvedValueOnce(overview(1));
    dispose = mountLeaderboard(); await settle();
    expect(document.querySelector('.lb-error')).not.toBeNull();
    expect(document.querySelector('#today')).toBeNull();
    click('[data-lb-refresh]'); await settle();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.lb-error')).toBeNull();
    expect(document.querySelectorAll('#today tbody tr')).toHaveLength(1);
  });

  it('expands and collapses boards independently while keeping the control focused', async () => {
    await mount(overview(12));
    expect(document.querySelectorAll('#today tbody tr')).toHaveLength(10);
    expect(document.querySelectorAll('#all-time tbody tr')).toHaveLength(10);
    click('[data-lb-expand="today"]');
    expect(document.querySelectorAll('#today tbody tr')).toHaveLength(12);
    expect(document.querySelectorAll('#all-time tbody tr')).toHaveLength(10);
    expect(document.activeElement?.getAttribute('data-lb-expand')).toBe('today');
    expect(document.activeElement?.getAttribute('aria-expanded')).toBe('true');
    click('[data-lb-expand="all-time"]');
    expect(document.querySelectorAll('#all-time tbody tr')).toHaveLength(12);
    click('[data-lb-expand="today"]');
    expect(document.querySelectorAll('#today tbody tr')).toHaveLength(10);
    expect(document.querySelectorAll('#all-time tbody tr')).toHaveLength(12);
  });

  it('retries a failed UTC midnight refresh after 30 seconds and clears its timer on disposal', async () => {
    vi.setSystemTime(new Date('2026-11-04T23:59:30Z'));
    mocks.fetch.mockResolvedValueOnce(overview(1))
      .mockRejectedValueOnce(new Error('midnight outage'))
      .mockResolvedValueOnce(overview(2, '2026-11-05'));
    dispose = mountLeaderboard(); await settle();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(document.querySelector('[data-lb-countdown]')!.textContent).toBe('00:00:01');
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.lb-stale')).not.toBeNull();
    expect(document.querySelectorAll('#today tbody tr')).toHaveLength(1);
    expect(document.querySelector('[data-lb-countdown]')!.textContent).toBe('24:00:00');
    await vi.advanceTimersByTimeAsync(29_000);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
    expect(document.querySelector('.lb-stale')).toBeNull();
    expect(document.querySelectorAll('#today tbody tr')).toHaveLength(2);
    expect(document.querySelector('[data-lb-countdown]')!.textContent).toBe('23:59:30');
    dispose(); dispose = undefined;
    await vi.advanceTimersByTimeAsync(86_400_000);
    expect(mocks.fetch).toHaveBeenCalledTimes(3);
  });
});
