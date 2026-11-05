import { afterEach, describe, expect, it, vi } from 'vitest';
import { fallbackDay, type DailySnapshot } from './game/data';
import settlements from '../fixtures/settlements.json';
import history from '../fixtures/history-30d.json';
import { fetchHamsterStatus, fetchOverlayDay, parseHamsterStatus, parseOverlayOptions } from './overlay-data';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function mockStatus(value: unknown, ok = true) {
  const fetch = vi.fn(async () => ({ ok, json: async () => value }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('OBS overlay URL options', () => {
  it('provides a transparent bar with every section by default', () => {
    expect(parseOverlayOptions('')).toEqual({ layout: 'bar', scale: 1, show: ['status', 'boss', 'board'], bg: 'transparent', pos: 'top-left', opacity: 1, density: 'full', safe: 'none', motion: 'normal' });
  });

  it('accepts card layout, scale, dark background and deduplicated sections', () => {
    expect(parseOverlayOptions('?layout=card&scale=1.25&show=board,status,board,nope&bg=dark')).toMatchObject({
      layout: 'card', scale: 1.25, show: ['board', 'status'], bg: 'dark',
    });
  });

  it.each([
    ['?layout=evil&scale=NaN&show=nope&bg=red', 1],
    ['?scale=Infinity', 1], ['?scale=', 1], ['?scale=0.01', 0.5], ['?scale=99', 2],
  ])('keeps malformed or extreme options usable: %s', (search, scale) => {
    expect(parseOverlayOptions(search)).toMatchObject({ layout: 'bar', scale, show: ['status', 'boss', 'board'], bg: 'transparent' });
  });

  it('accepts anchored compact overlays, HUD guides and low motion aliases', () => {
    expect(parseOverlayOptions('?pos=bottom-right&opacity=.45&density=compact&safe=moba&motion=low')).toMatchObject({ pos: 'bottom-right', opacity: .45, density: 'compact', safe: 'moba', motion: 'low' });
    expect(parseOverlayOptions('?density=min&safe=fps&low-motion=1')).toMatchObject({ density: 'min', safe: 'fps', motion: 'low' });
  });

  it.each([['', 1], ['0', .25], ['-.1', .25], ['5', 1], ['NaN', 1], ['Infinity', 1]])('keeps panel opacity usable: %s', (opacity, expected) => {
    expect(parseOverlayOptions(`?opacity=${opacity}`).opacity).toBe(expected);
  });

  it('ignores unsupported anchors, density, safety and motion values', () => {
    expect(parseOverlayOptions('?pos=bogus&density=huge&safe=custom&motion=fast')).toMatchObject({ pos: 'top-left', density: 'full', safe: 'none', motion: 'normal' });
  });
});

describe('public hamster status', () => {
  it('converts hardware units and fetches with a cancelable, uncached request', async () => {
    const observedAt = new Date().toISOString();
    const fetch = mockStatus({ oracle: { state: 'accepted' }, measurement: {
      freshness: 'online', coreStatus: 'SPINNING', rpmMilli: 12345, distanceMm: 123456,
      observedAt, staleAfterSeconds: 120,
    } });
    expect(await fetchHamsterStatus()).toEqual({ state: 'spinning', rpm: 12.345, distanceMeters: 123.456, observedAt });
    expect(fetch).toHaveBeenCalledWith('https://api.squeekchain.com/v1/status', {
      signal: expect.any(AbortSignal), cache: 'no-store',
    });
  });

  it('preserves genuine idle and zero metrics', async () => {
    mockStatus({ oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'IDLE', rpmMilli: 0, distanceMm: 0 } });
    expect(await fetchHamsterStatus()).toEqual({ state: 'idle', rpm: 0, distanceMeters: 0 });
  });

  it('uses observed age even when the server still labels a measurement online', () => {
    const measurement = { freshness: 'online', coreStatus: 'IDLE', observedAt: '2026-11-04T12:00:00Z', staleAfterSeconds: 120 };
    expect(parseHamsterStatus({ oracle: { state: 'accepted' }, measurement }, Date.parse('2026-11-04T12:01:59Z')).state).toBe('idle');
    expect(parseHamsterStatus({ oracle: { state: 'accepted' }, measurement }, Date.parse('2026-11-04T12:02:01Z')).state).toBe('unavailable');
  });

  it.each([
    null,
    { oracle: { state: 'rejected' }, measurement: { freshness: 'online', coreStatus: 'SPINNING' } },
    { oracle: { state: 'accepted' }, measurement: { freshness: 'stale', coreStatus: 'IDLE' } },
    { oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'unknown' } },
    { oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'IDLE', observedAt: '2000-01-01T00:00:00Z', staleAfterSeconds: 120 } },
  ])('reports an unavailable state for untrusted or stale data', async (value) => {
    mockStatus(value);
    expect(await fetchHamsterStatus()).toEqual({ state: 'unavailable', reason: expect.any(String) });
  });

  it('omits invalid optional telemetry instead of displaying invented values', async () => {
    mockStatus({ oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'IDLE', rpmMilli: -1, distanceMm: '1000', observedAt: 'invalid' } });
    expect(await fetchHamsterStatus()).toEqual({ state: 'idle' });
    mockStatus({ oracle: { state: 'accepted' }, measurement: { freshness: 'online', coreStatus: 'SPINNING', rpmMilli: Infinity, distanceMm: NaN } });
    expect(await fetchHamsterStatus()).toEqual({ state: 'spinning' });
  });

  it.each(['HTTP', 'network', 'JSON'])('gracefully handles %s errors', async failure => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (failure === 'network') throw new Error('Offline');
      return { ok: failure !== 'HTTP', json: async () => { throw new SyntaxError('Bad JSON'); } };
    }));
    expect((await fetchHamsterStatus()).state).toBe('unavailable');
  });

  it('aborts a status request after five seconds', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('Aborted')));
    })));
    const pending = fetchHamsterStatus();
    await vi.advanceTimersByTimeAsync(5000);
    expect((await pending).state).toBe('unavailable');
  });
});

function dailySnapshot(day: string): DailySnapshot {
  const start = Date.parse(`${day}T00:00:00Z`) - 86_400_000;
  const iso = (time: number) => new Date(time).toISOString();
  const buckets = settlements.buckets.map((bucket, hour) => ({ ...bucket,
    startAt: iso(start + hour * 3_600_000), endAt: iso(start + (hour + 1) * 3_600_000),
  }));
  const oldBuckets = history.buckets.slice(-7).map((bucket, index) => ({ ...bucket,
    startAt: iso(start - (7 - index) * 86_400_000), endAt: iso(start - (6 - index) * 86_400_000),
  }));
  const window = { startAt: iso(start), endAt: iso(start + 86_400_000), bucketSeconds: 3600 };
  return {
    schemaVersion: 1, status: 'available', day, dataDate: iso(start).slice(0, 10), generatedAt: `${day}T00:10:00.000Z`,
    window, sourceWindow: window, buckets, recentSettlements: [],
    history: { status: 'available', window: { startAt: oldBuckets[0].startAt, endAt: oldBuckets[6].endAt, bucketSeconds: 86400 }, buckets: oldBuckets },
    meta: { missingHours: [] },
  };
}

describe('overlay daily challenge fallback', () => {
  it('loads the dated UTC snapshot without a redundant status request', async () => {
    const fetch = vi.fn(async (_url: string) => ({ ok: true, json: async () => dailySnapshot('2026-11-04') }));
    vi.stubGlobal('fetch', fetch);
    const result = await fetchOverlayDay(new Date('2026-11-05T07:59:00+08:00'));
    expect(result.day).toBe('2026-11-04');
    expect(result.source).toBe('live');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe('/data/daily/2026-11-04.json');
  });

  it('uses a validated previous latest snapshot when the dated file is missing', async () => {
    const fetch = vi.fn(async (url: string) => ({ ok: url.endsWith('latest.json'), json: async () => dailySnapshot('2026-11-03') }));
    vi.stubGlobal('fetch', fetch);
    const result = await fetchOverlayDay(new Date('2026-11-04T12:00:00Z'));
    expect(result.day).toBe('2026-11-04');
    expect(result.source).toBe('cached');
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/data/daily/2026-11-04.json', '/data/daily/latest.json']);
  });

  it('uses the same fixture rules as the game when snapshots are unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Offline'); }));
    expect(await fetchOverlayDay(new Date('2026-11-04T12:00:00Z'))).toEqual(fallbackDay('2026-11-04'));
  });
});
