import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/settlements.json';
import historyFixture from '../fixtures/history-30d.json';
// @ts-expect-error The dependency-free publishing script deliberately remains Node ESM.
import { buildSnapshot, mergeHourlyBuckets, refreshDaily, sumBuckets, validateArchive, validateDailySnapshot, validateSettlements, validateStatus } from '../scripts/refresh-daily.mjs';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (time: number) => new Date(time).toISOString();
const at = (time: string) => Date.parse(time);
const now = new Date('2026-11-04T11:15:00.000Z');
const metrics = { settlementCount: '6', activeRoundCount: '1', workAdded: '120', completedBlockCount: '12', sqkMintedBaseUnits: '100000000000000000000001' };
const bucket = (start: number, duration = HOUR) => ({ startAt: iso(start), endAt: iso(start + duration), ...metrics });
function response(range: '24h' | '30d', endAt = '2026-11-04T12:00:00.000Z') {
  const seconds = range === '24h' ? 3600 : 86400;
  const count = range === '24h' ? 24 : 30;
  const end = at(endAt);
  const start = end - count * seconds * 1000;
  return {
    ...structuredClone(range === '24h' ? fixture : historyFixture), range,
    recentSettlements: structuredClone(fixture.recentSettlements),
    window: { startAt: iso(start), endAt: iso(end), bucketSeconds: seconds },
    buckets: Array.from({ length: count }, (_, index) => bucket(start + index * seconds * 1000, seconds * 1000)),
    mining: {
      status: 'available', supplyCap: '2100000000000000000000000000', premintBaseUnits: '1',
      startRound: '13', startHeight: '0', miningMintedBaseUnits: '33547602104353572063931816',
      unmintedCapacityBaseUnits: '2066452397895646427936068183', processedThroughRound: '1279',
      rangeMintedBaseUnits: '3060273549021102837148703', rangeCheckpointCount: '137',
    },
  };
}
const status = () => ({
  schemaVersion: 1, generatedAt: now.toISOString(),
  measurement: { freshness: 'online', coreStatus: 'IDLE', observedAt: now.toISOString(), receivedAt: now.toISOString(), staleAfterSeconds: 120, cumulativeWorkUnits: '92730', rpmMilli: 0, speedMmPerSecond: 0, distanceMm: 7022244 },
  oracle: { state: 'accepted' },
});
const emptyArchive = () => ({ schemaVersion: 1, buckets: [] });
function archiveDays(...days: string[]) {
  return { schemaVersion: 1, buckets: days.flatMap(day => Array.from({ length: 24 }, (_, hour) => bucket(at(`${day}T00:00:00.000Z`) + hour * HOUR))) };
}
function makeSnapshot() {
  const hourly = response('24h');
  return buildSnapshot(mergeHourlyBuckets(emptyArchive(), hourly, now), hourly, response('30d'), status(), now);
}
function memoryIo() {
  const files = new Map<string, string>();
  const writes: string[] = [];
  return {
    files, writes,
    async readFile(filename: string) {
      if (!files.has(filename)) throw Object.assign(new Error('missing'), { code: 'ENOENT' });
      return files.get(filename)!;
    },
    async mkdir() {},
    async writeFile(filename: string, content: string) { writes.push(filename); files.set(filename, content); },
    async rename(from: string, to: string) { files.set(to, files.get(from)!); files.delete(from); },
  };
}
function api(hourly = response('24h'), daily = response('30d'), currentStatus = status()) {
  return async (url: string) => ({ ok: true, status: 200, json: async () => url.endsWith('range=24h') ? hourly : url.endsWith('range=30d') ? daily : currentStatus });
}

describe('daily publisher source validation', () => {
  it('accepts real endpoint shapes without needing custom date parameters', () => {
    expect(validateSettlements(response('24h'), '24h').buckets).toHaveLength(24);
    expect(validateSettlements(response('30d'), '30d').buckets).toHaveLength(30);
    expect(validateStatus(status()).measurement.rpmMilli).toBe(0);
  });

  it('accepts an endpoint publishing 24 complete rolling daily periods', () => {
    const history = response('30d');
    history.buckets = history.buckets.slice(-24);
    history.window.startAt = history.buckets[0].startAt;
    expect(validateSettlements(history, '30d').buckets).toHaveLength(24);
  });

  it.each(['-1', 'NaN', '1.1', 5, null])('rejects an invalid bucket amount %s', value => {
    const malformed = response('24h');
    Object.assign(malformed.buckets[0], { workAdded: value });
    expect(() => validateSettlements(malformed, '24h')).toThrow('workAdded');
  });

  it('rejects duplicate/missing hours and malformed status observations', () => {
    const malformed = response('24h');
    malformed.buckets[1] = malformed.buckets[0];
    expect(() => validateSettlements(malformed, '24h')).toThrow('Duplicate');
    expect(() => validateStatus({ ...status(), measurement: { ...status().measurement, rpmMilli: -1 } })).toThrow('rpmMilli');
    expect(() => validateArchive({ schemaVersion: 1, buckets: [bucket(at('2026-11-03T00:30:00Z'))] })).toThrow('boundaries');
  });

  it('rejects impossible ISO dates without rejecting API submillisecond timestamps', () => {
    const observation = status();
    observation.measurement.observedAt = '2026-02-30T12:00:00.000Z';
    expect(() => validateStatus(observation)).toThrow('observedAt');
    observation.measurement.observedAt = '2026-11-04T11:15:09.785505Z';
    expect(validateStatus(observation)).toBe(observation);
  });
});

describe('hourly archives and frozen UTC daily transforms', () => {
  it('combines 12:10 and 00:10 runs into every hour of the previous UTC day', () => {
    const noon = new Date('2026-11-03T12:10:00.000Z');
    const midnight = new Date('2026-11-04T00:10:00.000Z');
    const initial = mergeHourlyBuckets(emptyArchive(), response('24h', '2026-11-03T13:00:00.000Z'), noon);
    const merged = mergeHourlyBuckets(initial, response('24h', '2026-11-04T01:00:00.000Z'), midnight);
    const result = buildSnapshot(merged, response('24h', '2026-11-04T01:00:00.000Z'), response('30d', '2026-11-04T01:00:00.000Z'), status(), midnight);
    expect(result.day).toBe('2026-11-04');
    expect(result.dataDate).toBe('2026-11-03');
    expect(result.meta.missingHours).toEqual([]);
    expect(result.buckets.map((value: { startAt: string }) => value.startAt)).toEqual(Array.from({ length: 24 }, (_, hour) => iso(at('2026-11-03T00:00:00.000Z') + hour * HOUR)));
    expect(merged.buckets.some((value: { endAt: string }) => at(value.endAt) > midnight.getTime())).toBe(false);
    expect(new Set(merged.buckets.map((value: { startAt: string }) => value.startAt)).size).toBe(merged.buckets.length);
  });

  it('records and fills unavailable hours with zeroes without inventing archive entries', () => {
    const result = makeSnapshot();
    expect(result.meta.missingHours).toHaveLength(12);
    expect(result.meta.archivedHours).toBe(12);
    expect(result.meta.completeness).toBe('partial');
    expect(result.buckets[0]).toMatchObject({ workAdded: '0', settlementCount: '0', sqkMintedBaseUnits: '0' });
    expect(result.buckets[12].workAdded).toBe('120');
    expect(result.recentSettlements).toEqual([]);
    expect(mergeHourlyBuckets(emptyArchive(), response('24h'), now).buckets).toHaveLength(23);
  });

  it('preserves rolling historical boundaries and records API provenance', () => {
    const result = makeSnapshot();
    expect(result.history.buckets).toHaveLength(7);
    expect(result.history.buckets.every((value: { startAt: string; endAt: string }) => at(value.endAt) <= at(result.window.startAt) && at(value.endAt) - at(value.startAt) === DAY && new Date(value.startAt).getUTCHours() === 12)).toBe(true);
    expect(result.meta.historySources.every((value: { source: string }) => value.source === 'api-30d')).toBe(true);
  });

  it('prefers complete archived UTC days and never overlaps history periods', () => {
    const archive = archiveDays('2026-11-01', '2026-11-02', '2026-11-03');
    const result = buildSnapshot(archive, response('24h'), response('30d'), status(), now);
    const archived = result.meta.historySources.filter((value: { source: string }) => value.source === 'hourly-archive');
    expect(archived.map((value: { startAt: string }) => value.startAt)).toEqual(['2026-11-01T00:00:00.000Z', '2026-11-02T00:00:00.000Z']);
    expect(result.history.buckets.at(-1).workAdded).toBe('2880');
    expect(validateDailySnapshot(result)).toBe(result);
  });

  it('sums token base units exactly above the JavaScript safe integer limit', () => {
    const result = sumBuckets([bucket(0), bucket(HOUR), bucket(2 * HOUR)], iso(0), iso(DAY));
    expect(result.sqkMintedBaseUnits).toBe('300000000000000000000003');
    expect(result.workAdded).toBe('360');
  });

  it('rejects aggregated amounts which overflow the client numeric range', () => {
    const value = { ...bucket(0), workAdded: `1${'0'.repeat(308)}` };
    expect(() => sumBuckets([value, value], iso(0), iso(DAY))).toThrow('summed workAdded');
  });

  it('validates aggregate history numeric bounds before publishing', () => {
    const hourly = response('24h');
    const history = response('30d');
    for (const value of history.buckets) value.workAdded = `1${'0'.repeat(308)}`;
    expect(() => buildSnapshot(mergeHourlyBuckets(emptyArchive(), hourly, now), hourly, history, status(), now)).toThrow('summed workAdded');
  });

  it('rejects a daily file whose missing hour contains a fabricated amount', () => {
    const result = makeSnapshot();
    result.buckets[0].sqkMintedBaseUnits = '1';
    expect(() => validateDailySnapshot(result)).toThrow();
  });
});

describe('daily publisher I/O and immutability', () => {
  it('makes identical runs byte-idempotent and pins latest to the dated file', async () => {
    const io = memoryIo();
    const options = { now, rootDir: '/publisher-test', fetchImpl: api(), io };
    const first = await refreshDaily(options);
    expect(first.changedFiles).toHaveLength(3);
    const second = await refreshDaily(options);
    expect(second.changedFiles).toEqual([]);
    expect(second.preserved).toBe(true);
    const latest = [...io.files.entries()].find(([key]) => key.endsWith('latest.json'))![1];
    expect(latest).toBe(io.files.get(first.datedFile));
  });

  it('updates only the archive at noon while preserving the first daily snapshot', async () => {
    const io = memoryIo();
    const midnight = new Date('2026-11-04T00:10:00.000Z');
    const first = await refreshDaily({ now: midnight, rootDir: '/publisher-test', fetchImpl: api(response('24h', '2026-11-04T01:00:00.000Z')), io });
    const bytes = io.files.get(first.datedFile);
    const later = await refreshDaily({ now, rootDir: '/publisher-test', fetchImpl: api(), io });
    expect(later.changedFiles).toHaveLength(1);
    expect(later.changedFiles[0]).toContain('hourly-buckets.json');
    expect(later.snapshot.generatedAt).toBe(midnight.toISOString());
    expect(io.files.get(first.datedFile)).toBe(bytes);
  });

  it('only replaces an existing daily file when force is explicit', async () => {
    const io = memoryIo();
    const options = { now, rootDir: '/publisher-test', fetchImpl: api(), io };
    const first = await refreshDaily(options);
    const changed = response('24h');
    changed.buckets[0].workAdded = '9876';
    const second = await refreshDaily({ ...options, force: true, now: new Date('2026-11-04T11:16:00.000Z'), fetchImpl: api(changed) });
    expect(second.snapshot.generatedAt).not.toBe(first.snapshot.generatedAt);
    expect(second.snapshot.buckets[12].workAdded).toBe('9876');
    expect(second.preserved).toBe(false);
  });

  it.each(['hourly', 'history', 'status', 'http'])('performs no writes on malformed %s input', async kind => {
    const io = memoryIo();
    const hourly = response('24h');
    const history = response('30d');
    const measurement = status();
    if (kind === 'hourly') hourly.buckets.pop();
    if (kind === 'history') history.buckets[0].sqkMintedBaseUnits = '-1';
    if (kind === 'status') measurement.measurement.rpmMilli = Number.NaN;
    const fetchImpl = kind === 'http' ? async () => ({ ok: false, status: 503 }) : api(hourly, history, measurement);
    await expect(refreshDaily({ now, rootDir: '/publisher-test', fetchImpl, io })).rejects.toThrow();
    expect(io.writes).toEqual([]);
    expect(io.files.size).toBe(0);
  });

  it('validates stored archives and dated snapshots before any mutation', async () => {
    const io = memoryIo();
    const options = { now, rootDir: '/publisher-test', fetchImpl: api(), io };
    const first = await refreshDaily(options);
    const existing = JSON.parse(io.files.get(first.datedFile)!);
    existing.dataDate = '2026-11-01';
    io.files.set(first.datedFile, JSON.stringify(existing));
    io.writes.length = 0;
    await expect(refreshDaily(options)).rejects.toThrow('UTC day');
    expect(io.writes).toEqual([]);
    const archiveFile = [...io.files.keys()].find(key => key.endsWith('hourly-buckets.json'))!;
    io.files.delete(first.datedFile);
    io.files.set(archiveFile, '{"schemaVersion":1,"buckets":[{}]}');
    await expect(refreshDaily(options)).rejects.toThrow('startAt');
    expect(io.writes).toEqual([]);
  });
});
