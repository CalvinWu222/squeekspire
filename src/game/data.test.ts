import { afterEach, describe, expect, it, vi } from 'vitest';
import settlements from '../../fixtures/settlements.json';
import history from '../../fixtures/history-30d.json';
import { buildDayData, fallbackDay, getGameDay, loadDay, median, settlementSeed } from './data';

afterEach(() => vi.unstubAllGlobals());

describe('daily seed and settled-data conversion', () => {
  it('uses the noon Asia/Shanghai cutoff consistently across client timezones', () => {
    expect(getGameDay(new Date('2026-11-04T11:59:59+08:00'))).toBe('2026-11-03');
    expect(getGameDay(new Date('2026-11-04T12:00:00+08:00'))).toBe('2026-11-04');
    expect(getGameDay(new Date('2026-11-04T23:59:59+08:00'))).toBe('2026-11-04');
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
