// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fallbackDay } from './game/data';

const prefix = 'squeekspire:v1:';
const today = fallbackDay('2026-11-04');
const tomorrow = fallbackDay('2026-11-05');
const response = (entries: unknown[] = []) => ({ ok: true, json: async () => ({ entries }) }) as Response;
const click = (selector: string) => {
  const button = document.querySelector<HTMLButtonElement>(selector);
  expect(button, selector).not.toBeNull();
  button!.click();
};
const countdown = () => document.querySelector('[data-daily-countdown]')!.textContent;
const dailyButton = () => document.querySelector<HTMLButtonElement>('[data-action="mode"][data-mode="daily"]')!;
const boot = async () => {
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
};

describe('UTC daily labels, countdown and rollover', () => {
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T00:00:00+08:00'));
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('fetch', vi.fn(async input => {
      if (String(input).startsWith('/api/')) return response();
      throw new Error('Offline fixture');
    }));
  });
  afterEach(() => {
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  });

  it('uses the UTC date for labels, seeds, daily claims and leaderboard requests at Beijing midnight', async () => {
    await boot();
    expect(document.querySelector('.daily-label')!.textContent).toBe('Daily · 2026-11-04 UTC');
    expect(countdown()).toBe('08:00:00');
    expect(document.querySelector('.title-corner code')!.textContent).toBe(today.seed.toString(16).padStart(8, '0').toUpperCase());
    click('[data-action="start"]');
    expect(dailyButton().textContent).toContain('RESETS 00:00 UTC');
    expect(document.querySelector('.selection-note')!.textContent).toContain('Daily · 2026-11-04 UTC');
    click('[data-action="mode"][data-mode="daily"]');
    expect(document.querySelector('.selection-note')!.textContent).toContain('Daily · 2026-11-04 UTC');
    click('[data-action="begin"]');
    expect(document.querySelector('.run-day')!.textContent).toBe('Daily · 2026-11-04 UTC');
    expect(JSON.parse(localStorage.getItem(`${prefix}official-days`)!)).toEqual(['2026-11-04']);
    expect(JSON.parse(localStorage.getItem(`${prefix}active:daily`)!)).toMatchObject({ day: { day: today.day, seed: today.seed } });
    click('[data-action="more"]');
    await vi.waitFor(() => expect(document.querySelector('.leaderboard h2')!.textContent).toBe('Global leaderboard'));
    expect(document.querySelector('.board-caption')!.textContent).toBe('Daily · 2026-11-04 UTC · Ranked by total score');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === `/api/leaderboard?mode=daily&runMode=daily&seed=${today.seed}`)).toBe(true);
  });

  it.each([
    ['Beijing midnight', '2026-11-04T23:59:59+08:00', '07:59:59'],
    ['the former noon-Beijing cutoff', '2026-11-04T03:59:59Z', '19:59:59'],
  ])('keeps the daily attempt and seed unchanged across %s', async (_boundary, time, remaining) => {
    vi.setSystemTime(new Date(time));
    localStorage.setItem(`${prefix}official-days`, JSON.stringify([today.day]));
    await boot(); click('[data-action="start"]');
    expect(dailyButton().disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(dailyButton().disabled).toBe(true);
    expect(countdown()).toBe(remaining);
    expect(document.querySelector('.selection-note')!.textContent).toContain('Daily · 2026-11-04 UTC');
    click('[data-action="home"]');
    expect(document.querySelector('.title-corner code')!.textContent).toBe(today.seed.toString(16).padStart(8, '0').toUpperCase());
  });

  it('unlocks the next attempt and changes its seed exactly at 00:00 UTC without reloading', async () => {
    vi.setSystemTime(new Date('2026-11-04T23:59:59Z'));
    localStorage.setItem(`${prefix}official-days`, JSON.stringify([today.day]));
    await boot(); click('[data-action="start"]');
    expect(dailyButton().disabled).toBe(true);
    expect(countdown()).toBe('00:00:01');
    await vi.advanceTimersByTimeAsync(1000);
    expect(dailyButton().disabled).toBe(false);
    expect(countdown()).toBe('24:00:00');
    expect(document.querySelector('.selection-note')!.textContent).toContain('Daily · 2026-11-05 UTC');
    click('[data-action="mode"][data-mode="daily"]'); click('[data-action="begin"]');
    expect(JSON.parse(localStorage.getItem(`${prefix}official-days`)!)).toEqual([today.day, tomorrow.day]);
    expect(JSON.parse(localStorage.getItem(`${prefix}active:daily`)!)).toMatchObject({ day: { day: tomorrow.day, seed: tomorrow.seed } });
  });

  it('starts with the new UTC seed even if a background tab missed the rollover timer', async () => {
    vi.setSystemTime(new Date('2026-11-04T23:59:59Z'));
    await boot(); click('[data-action="start"]'); click('[data-action="mode"][data-mode="daily"]');
    vi.setSystemTime(new Date('2026-11-05T00:00:01Z'));
    click('[data-action="begin"]');
    expect(document.querySelector('.run-day')!.textContent).toBe('Daily · 2026-11-05 UTC');
    expect(JSON.parse(localStorage.getItem(`${prefix}official-days`)!)).toEqual([tomorrow.day]);
    expect(JSON.parse(localStorage.getItem(`${prefix}active:daily`)!)).toMatchObject({ day: { day: tomorrow.day, seed: tomorrow.seed } });
  });

  it('keeps a run and its score on its original UTC day when completed after midnight', async () => {
    vi.setSystemTime(new Date('2026-11-04T23:59:59Z'));
    await boot(); click('[data-action="start"]'); click('[data-action="mode"][data-mode="daily"]'); click('[data-action="begin"]');
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.querySelector('.run-day')!.textContent).toBe('Daily · 2026-11-04 UTC');
    click('[data-action="more"]');
    expect(document.querySelector('.board-caption')!.textContent).toContain('Daily · 2026-11-05 UTC');
    click('[data-action="abandon"]');
    await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => url === '/api/score')).toBe(true));
    const post = vi.mocked(fetch).mock.calls.find(([url]) => url === '/api/score')!;
    expect(JSON.parse(String(post[1]!.body))).toMatchObject({ seed: today.seed, run: { day: { day: today.day, seed: today.seed } } });
    expect(JSON.parse(localStorage.getItem(`${prefix}board`)!)[0].day).toBe(today.day);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url) === `/api/leaderboard?mode=daily&runMode=daily&seed=${tomorrow.seed}`)).toBe(true);
  });

  it('continues the original run after going home across UTC midnight without consuming the next attempt', async () => {
    vi.setSystemTime(new Date('2026-11-04T23:59:59Z'));
    await boot(); click('[data-action="start"]'); click('[data-action="mode"][data-mode="daily"]'); click('[data-action="begin"]');
    const saved = localStorage.getItem(`${prefix}active:daily`);
    await vi.advanceTimersByTimeAsync(1000);
    click('[data-action="home"]');
    expect(document.querySelector('.daily-label')!.textContent).toBe('Daily · 2026-11-05 UTC');
    click('[data-action="resume"]');
    expect(document.querySelector('.run-day')!.textContent).toBe('Daily · 2026-11-04 UTC');
    expect(localStorage.getItem(`${prefix}active:daily`)).toBe(saved);
    expect(JSON.parse(localStorage.getItem(`${prefix}official-days`)!)).toEqual([today.day]);
  });

  it('refreshes an open leaderboard at UTC midnight and ignores the previous day’s late response', async () => {
    vi.setSystemTime(new Date('2026-11-04T23:59:59Z'));
    await boot();
    let finishOld!: (value: Response) => void;
    vi.mocked(fetch).mockImplementation(input => String(input).endsWith(`seed=${today.seed}`)
      ? new Promise<Response>(resolve => { finishOld = resolve; })
      : Promise.resolve(response()));
    click('[data-action="more"]');
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(document.querySelector('.leaderboard h2')!.textContent).toBe('Global leaderboard'));
    expect(document.querySelector('.board-caption')!.textContent).toContain('Daily · 2026-11-05 UTC');
    finishOld(response([{ id: 'yesterday', profile: 'guest1234', day: today.day, seed: today.seed, mode: 'daily',
      score: 999, bestHit: 30, floor: 1, won: false, hibernation: false, streak: 0 }]));
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(document.querySelectorAll('.leaderboard-row')).toHaveLength(0);
  });
});
