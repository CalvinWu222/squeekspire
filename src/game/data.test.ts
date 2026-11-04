import { afterEach, describe, expect, it, vi } from 'vitest';
import settlements from '../../fixtures/settlements.json';
import history from '../../fixtures/history-30d.json';
import { buildDayData, fallbackDay, getDailyResetTime, getGameDay, loadDay, median, settlementSeed } from './data';

afterEach(() => vi.unstubAllGlobals());

describe('daily seed and settled-data conversion', () => {
  it.each([
    ['2026-11-03T23:59:59.999Z', '2026-11-03'],
    ['2026-11-04T00:00:00.000Z', '2026-11-04'],
    ['2026-11-04T00:00:00+08:00', '2026-11-03'],
    ['2026-11-04T07:59:59.999+08:00', '2026-11-03'],
    ['2026-11-04T08:00:00+08:00', '2026-11-04'],
    ['2026-11-03T16:00:00-08:00', '2026-11-04'],
    ['2026-12-01T00:00:00+08:00', '2026-11-30'],
    ['2027-01-01T07:59:59.999+08:00', '2026-12-31'],
    ['2027-01-01T08:00:00+08:00', '2027-01-01'],
  ])('uses the UTC calendar day for %s', (timestamp, day) => {
    expect(getGameDay(new Date(timestamp))).toBe(day);
  });

  it.each([
    ['2026-11-04T00:00:00.000Z', '2026-11-05T00:00:00.000Z', 86_400_000],
    ['2026-11-04T23:59:59.999Z', '2026-11-05T00:00:00.000Z', 1],
    ['2026-11-04T00:00:00+08:00', '2026-11-04T00:00:00.000Z', 8 * 3_600_000],
    ['2026-11-30T23:59:59.000Z', '2026-12-01T00:00:00.000Z', 1_000],
    ['2026-12-31T23:59:59.000Z', '2027-01-01T00:00:00.000Z', 1_000],
    ['2028-02-29T23:59:59.000Z', '2028-03-01T00:00:00.000Z', 1_000],
    ['2026-03-08T01:30:00-08:00', '2026-03-09T00:00:00.000Z', 14.5 * 3_600_000],
  ])('counts down from %s to the next UTC midnight', (timestamp, reset, remaining) => {
    const now = new Date(timestamp);
    expect(new Date(getDailyResetTime(now)).toISOString()).toBe(reset);
    expect(getDailyResetTime(now) - now.getTime()).toBe(remaining);
  });

  it('keeps one seed across Beijing midnight and changes it only at UTC midnight', () => {
    const seedAt = (timestamp: string) => fallbackDay(getGameDay(new Date(timestamp))).seed;
    expect(seedAt('2026-11-03T23:59:59+08:00')).toBe(seedAt('2026-11-04T00:00:00+08:00'));
    expect(seedAt('2026-11-04T07:59:59.999+08:00')).not.toBe(seedAt('2026-11-04T08:00:00+08:00'));
    expect(seedAt('2026-11-04T00:00:00Z')).toBe(seedAt('2026-11-03T16:00:00-08:00'));
    expect(seedAt('2026-11-04T00:00:00Z')).toBe(632631189);
  });

  it('recomputes the same public seed regardless of event or bucket arrival order', () => {
    const reordered = {
      ...settlements,
      buckets: [...settlements.buckets].reverse(),
      recentSettlements: [...settlements.recentSettlements].reverse(),
    };
    expect(settlementSeed('2026-11-04', reordered)).toBe(settlementSeed('2026-11-04', settlements));
    expect(settlementSeed('2026-11-05', settlements)).not.toBe(settlementSeed('2026-11-04', settlements));
  });

  it('changes the seed when an hourly work amount or settled round changes', () => {
    const changed = structuredClone(settlements);
    changed.buckets[0].workAdded = '1';
    expect(settlementSeed('2026-11-04', changed)).not.toBe(settlementSeed('2026-11-04', settlements));
    const changedEvent = structuredClone(settlements);
    changedEvent.recentSettlements[0].settledThroughRound = '9000';
    expect(settlementSeed('2026-11-04', changedEvent)).not.toBe(settlementSeed('2026-11-04', settlements));
  });

  it('uses seven complete historical periods for its actual fixture median', () => {
    const day = fallbackDay('2026-11-04');
    expect(day.totalWork).toBe(8725);
    expect(day.medianWork).toBe(10891);
    expect(day.difficulty).toBeCloseTo(8725 / 10891);
    expect(day.hours).toHaveLength(24);
    expect(day.hours.map((hour) => hour.label)).toEqual(settlements.buckets.map((bucket) => (
      `${bucket.startAt.slice(11, 13)}:00 UTC`
    )));
    expect(day.hours[0].label).toBe('18:00 UTC');
    expect(day.completedBlocks).toBe(853);
    expect(day.priceMultiplier).toBeGreaterThanOrEqual(0.8);
    expect(day.priceMultiplier).toBeLessThanOrEqual(1.2);
    expect(day).toEqual(fallbackDay('2026-11-04'));
  });

  it('clamps extremes and activates hibernation on a zero-work night', () => {
    const sleeping = structuredClone(settlements);
    sleeping.buckets.forEach((bucket) => { bucket.workAdded = '0'; });
    const quiet = buildDayData('2026-11-04', sleeping, history);
    expect(quiet.hibernation).toBe(true);
    expect(quiet.difficulty).toBe(0.8);
    const wild = structuredClone(settlements);
    wild.buckets.forEach((bucket) => { bucket.workAdded = '999999'; });
    expect(buildDayData('2026-11-04', wild, history).difficulty).toBe(1.3);
    expect(median([7, 1, 4, 2])).toBe(3);
  });

  it('rejects an incomplete hourly snapshot rather than inventing settled hours', () => {
    expect(() => buildDayData('2026-11-04', { ...settlements, buckets: settlements.buckets.slice(0, 23) }, history))
      .toThrow('24');
  });
});

describe('public API failure and fairness', () => {
  it('loads each UTC day and seed across midnight even when the public API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const beijingMidnight = await loadDay(new Date('2026-11-04T00:00:00+08:00'));
    const beforeReset = await loadDay(new Date('2026-11-04T07:59:59.999+08:00'));
    const afterReset = await loadDay(new Date('2026-11-04T08:00:00+08:00'));
    expect(beijingMidnight.day).toBe('2026-11-03');
    expect(beforeReset.seed).toBe(beijingMidnight.seed);
    expect(afterReset.day).toBe('2026-11-04');
    expect(afterReset.seed).toBe(632631189);
    expect(afterReset.seed).not.toBe(beforeReset.seed);
  });

  it('keeps daily map rules equal online and offline; spinning is a practice-only flag', async () => {
    const now = new Date('2026-11-04T05:00:00Z');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      json: async () => url.endsWith('/status')
        ? { oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'SPINNING' } }
        : { ...settlements, generatedAt: '2099-01-01T00:00:00Z' },
    })));
    const online = await loadDay(now);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const offline = await loadDay(now);
    const rules = (value: typeof online) => ({ ...value, notice: '', spinning: false });
    expect(rules(online)).toEqual(rules(offline));
    expect(online.spinning).toBe(true);
    expect(offline.spinning).toBe(false);
    expect(offline.notice).toContain('unavailable');
    expect(online.notice).toContain('rolling windows');
  });

  it('disables the practice energy bonus for an unaccepted oracle', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ status: 'available', oracle: { state: 'rejected' }, measurement: { coreStatus: 'SPINNING', freshness: 'online' } }),
    })));
    const result = await loadDay(new Date('2026-11-04T05:00:00Z'));
    expect(result.spinning).toBe(false);
    expect(result.notice).toContain('Oracle');
  });
});
