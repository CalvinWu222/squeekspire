import { afterEach, describe, expect, it, vi } from 'vitest';
import settlements from '../../fixtures/settlements.json';
import history from '../../fixtures/history-30d.json';
import {
  buildDayData, fallbackDay, getDailyResetTime, getGameDay, loadDay, median, settlementSeed,
  snapshotDay, validateDailySnapshot, type DailySnapshot,
} from './data';

afterEach(() => vi.unstubAllGlobals());

const DAY = 86_400_000;
function dailySnapshot(day = '2026-11-04'): DailySnapshot {
  const start = Date.parse(`${day}T00:00:00.000Z`) - DAY;
  const iso = (time: number) => new Date(time).toISOString();
  const buckets = settlements.buckets.map((bucket, hour) => ({
    ...bucket, startAt: iso(start + hour * 3_600_000), endAt: iso(start + (hour + 1) * 3_600_000),
  }));
  const oldBuckets = history.buckets.slice(-7).map((bucket, index) => ({
    ...bucket, startAt: iso(start - (7 - index) * DAY), endAt: iso(start - (6 - index) * DAY),
  }));
  const window = { startAt: iso(start), endAt: iso(start + DAY), bucketSeconds: 3600 };
  return {
    schemaVersion: 1, status: 'available', day, dataDate: iso(start).slice(0, 10),
    generatedAt: `${day}T00:10:00.000Z`, window, sourceWindow: { ...window },
    buckets, recentSettlements: [],
    history: {
      status: 'available',
      window: { startAt: oldBuckets[0].startAt, endAt: oldBuckets[6].endAt, bucketSeconds: 86400 },
      buckets: oldBuckets,
    },
    meta: { missingHours: [] },
  };
}

const onlineStatus = {
  oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'SPINNING' },
};

function mockRequests(responses: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string) => ({
    ok: Object.hasOwn(responses, url), status: Object.hasOwn(responses, url) ? 200 : 404,
    json: async () => responses[url],
  }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

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

describe('published snapshot validation', () => {
  it('accepts a complete UTC day with seven historical periods and independent metadata', () => {
    const snapshot = dailySnapshot();
    expect(validateDailySnapshot(snapshot)).toBe(true);
    const reordered = structuredClone(snapshot);
    reordered.buckets.reverse();
    reordered.history.buckets.reverse();
    reordered.generatedAt = '2026-11-04T12:10:00Z';
    reordered.meta.statusObservation = { coreStatus: 'SPINNING' };
    expect(validateDailySnapshot(reordered)).toBe(true);
    expect(snapshotDay(snapshot.day, reordered).seed).toBe(settlementSeed(snapshot.day, snapshot));
    expect(snapshotDay(snapshot.day, snapshot).seed).toBe(settlementSeed(snapshot.day, snapshot));
    expect(snapshotDay(snapshot.day, snapshot).hours[0].label).toBe('00:00 UTC');
  });

  it.each([
    ['schema version', (s: DailySnapshot) => { s.schemaVersion = 2 as 1; }],
    ['bad calendar date', (s: DailySnapshot) => { s.dataDate = '2026-02-30'; }],
    ['wrong play day', (s: DailySnapshot) => { s.day = '2026-11-05'; }],
    ['invalid generation timestamp', (s: DailySnapshot) => { s.generatedAt = 'tomorrow'; }],
    ['missing hour', (s: DailySnapshot) => { s.buckets.pop(); }],
    ['duplicate hour', (s: DailySnapshot) => { s.buckets[1] = { ...s.buckets[0] }; }],
    ['nonmidnight day', (s: DailySnapshot) => { s.window.startAt = '2026-11-03T01:00:00Z'; }],
    ['negative metric', (s: DailySnapshot) => { s.buckets[0].workAdded = '-1'; }],
    ['nonnumeric metric', (s: DailySnapshot) => { s.buckets[0].workAdded = ''; }],
    ['decimal metric', (s: DailySnapshot) => { s.buckets[0].activeRoundCount = '1.5'; }],
    ['infinite metric', (s: DailySnapshot) => { s.buckets[0].workAdded = '9'.repeat(309); }],
    ['overflowing sum', (s: DailySnapshot) => { s.buckets[0].workAdded = s.buckets[1].workAdded = `1${'0'.repeat(308)}`; }],
    ['invalid bucket timestamp', (s: DailySnapshot) => { s.buckets[0].startAt = 'not a time'; }],
    ['invalid source window', (s: DailySnapshot) => { s.sourceWindow.bucketSeconds = 21600; }],
    ['short history', (s: DailySnapshot) => { s.history.buckets.pop(); }],
    ['duplicate historical period', (s: DailySnapshot) => { s.history.buckets[1] = { ...s.history.buckets[0] }; }],
    ['negative historical work', (s: DailySnapshot) => { s.history.buckets[0].workAdded = '-5'; }],
    ['missing metadata', (s: DailySnapshot) => { delete (s as Partial<DailySnapshot>).meta; }],
    ['unaccounted missing-hour work', (s: DailySnapshot) => { s.meta.missingHours = [s.buckets.find((b) => Number(b.workAdded) > 0)!.startAt]; }],
    ['invalid missing-hour timestamp', (s: DailySnapshot) => { s.meta.missingHours = ['2026-11-02T00:00:00Z']; }],
    ['malformed safe event', (s: DailySnapshot) => { s.recentSettlements = [{ ...settlements.recentSettlements[0], cumulativeBlockUnits: 'not an integer' }]; }],
  ])('rejects %s', (_label, mutate) => {
    const snapshot = dailySnapshot();
    mutate(snapshot);
    expect(validateDailySnapshot(snapshot)).toBe(false);
    expect(() => snapshotDay(snapshot.day, snapshot)).toThrow('Invalid daily snapshot');
  });

  it('allows explicitly recorded missing hours only when they contain zeros', () => {
    const snapshot = dailySnapshot();
    const bucket = snapshot.buckets[0];
    Object.assign(bucket, { workAdded: '0', settlementCount: '0', activeRoundCount: '0', completedBlockCount: '0', sqkMintedBaseUnits: '0' });
    snapshot.meta.missingHours = [bucket.startAt];
    expect(validateDailySnapshot(snapshot)).toBe(true);
    snapshot.meta.missingHours.push(bucket.startAt);
    expect(validateDailySnapshot(snapshot)).toBe(false);
  });

  it('accepts mixed rolling historical periods and archived UTC days with a gap', () => {
    const snapshot = dailySnapshot();
    // Five rolling noon-to-noon periods precede two complete archived UTC days.
    snapshot.history.buckets.slice(0, 5).forEach((bucket) => {
      bucket.startAt = new Date(Date.parse(bucket.startAt) - 12 * 3_600_000).toISOString();
      bucket.endAt = new Date(Date.parse(bucket.endAt) - 12 * 3_600_000).toISOString();
    });
    snapshot.history.window.startAt = snapshot.history.buckets[0].startAt;
    expect(validateDailySnapshot(snapshot)).toBe(true);
    expect(snapshotDay(snapshot.day, snapshot).medianWork).toBeGreaterThanOrEqual(0);
    // Individual periods must still be exactly 24 hours and never overlap.
    snapshot.history.buckets[4].endAt = snapshot.history.buckets[5].endAt;
    expect(validateDailySnapshot(snapshot)).toBe(false);
  });

  it('rejects malformed events before a direct fixture conversion can reach BigInt', () => {
    const snapshot = structuredClone(settlements);
    snapshot.recentSettlements[0].cumulativeBlockUnits = '1e6';
    expect(() => buildDayData('2026-11-04', snapshot, history)).toThrow('24 available hourly');
  });
});

describe('published snapshot fallback chain and fairness', () => {
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

  it('uses the dated snapshot first, with the same seed as shared server conversion', async () => {
    const snapshot = dailySnapshot();
    const fetch = mockRequests({
      '/data/daily/2026-11-04.json': snapshot,
      'https://api.squeekchain.com/v1/status': onlineStatus,
    });
    const loaded = await loadDay(new Date('2026-11-04T05:00:00Z'));
    expect(loaded.seed).toBe(settlementSeed('2026-11-04', snapshot));
    expect(loaded.seed).toBe(snapshotDay('2026-11-04', snapshot).seed);
    expect(loaded.seed).not.toBe(fallbackDay('2026-11-04').seed);
    expect(loaded.source).toBe('live');
    expect(loaded.notice).toBe('Real hamster data from 2026-11-03 (UTC).');
    expect(loaded.spinning).toBe(true);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/data/daily/2026-11-04.json', 'https://api.squeekchain.com/v1/status',
    ]);
    expect(fetch).toHaveBeenCalledWith('/data/daily/2026-11-04.json', expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }));
  });

  it.each(['missing', 'invalid', 'wrong day', 'malformed JSON'])('uses latest when the dated snapshot is %s', async (failure) => {
    const previous = dailySnapshot('2026-11-03');
    const invalid = dailySnapshot();
    invalid.buckets[0].workAdded = '-1';
    const fetch = vi.fn(async (url: string) => ({
      ok: !(failure === 'missing' && url.endsWith('2026-11-04.json')), status: 404,
      json: async () => {
        if (url.endsWith('/status')) return onlineStatus;
        if (url.endsWith('/latest.json')) return previous;
        if (failure === 'malformed JSON') throw new SyntaxError('bad JSON');
        return failure === 'wrong day' ? previous : invalid;
      },
    }));
    vi.stubGlobal('fetch', fetch);
    const result = await loadDay(new Date('2026-11-04T05:00:00Z'));
    expect(result.day).toBe('2026-11-04');
    expect(result.source).toBe('cached');
    expect(result.seed).toBe(settlementSeed('2026-11-04', previous));
    expect(result.notice).toContain('data from 2026-11-02 (UTC)');
    expect(result.notice).toContain('fallback (published 2026-11-03)');
    expect(fetch).toHaveBeenCalledWith('/data/daily/latest.json', expect.anything());
  });

  it('rejects future latest data and falls back to the bundled fixture', async () => {
    mockRequests({ '/data/daily/latest.json': dailySnapshot('2026-11-05') });
    const result = await loadDay(new Date('2026-11-04T05:00:00Z'));
    expect(result.seed).toBe(fallbackDay('2026-11-04').seed);
    expect(result.source).toBe('fallback');
    expect(result.notice).toContain('data from 2026-11-02 (UTC), bundled fixture fallback');
  });

  it('uses the fixture when both static files are invalid', async () => {
    mockRequests({ '/data/daily/2026-11-04.json': { status: 'available' }, '/data/daily/latest.json': null });
    const result = await loadDay(new Date('2026-11-04T05:00:00Z'));
    expect(result.source).toBe('fallback');
    expect(result.seed).toBe(fallbackDay('2026-11-04').seed);
  });

  it('keeps published rules independent of practice-only live status', async () => {
    const now = new Date('2026-11-04T05:00:00Z');
    const snapshot = dailySnapshot();
    mockRequests({ '/data/daily/2026-11-04.json': snapshot, 'https://api.squeekchain.com/v1/status': onlineStatus });
    const online = await loadDay(now);
    mockRequests({ '/data/daily/2026-11-04.json': snapshot });
    const offline = await loadDay(now);
    const rules = (value: typeof online) => ({ ...value, notice: '', spinning: false });
    expect(rules(online)).toEqual(rules(offline));
    expect(online.spinning).toBe(true);
    expect(offline.spinning).toBe(false);
    expect(offline.notice).toContain('unavailable');
    expect(online.notice).toContain('2026-11-03 (UTC)');
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

  it('waits for the dated snapshot before resolving daily data', async () => {
    let deliver!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/status')) return { ok: true, json: async () => onlineStatus };
      return { ok: true, json: () => new Promise((resolve) => { deliver = resolve; }) };
    }));
    let resolved = false;
    const pending = loadDay(new Date('2026-11-04T05:00:00Z')).then((day) => { resolved = true; return day; });
    await vi.waitFor(() => expect(deliver).toBeTypeOf('function'));
    expect(resolved).toBe(false);
    deliver(dailySnapshot());
    expect((await pending).source).toBe('live');
  });
});
