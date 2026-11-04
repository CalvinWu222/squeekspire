import { describe, expect, it } from 'vitest';
import settlementsFixture from '../fixtures/settlements.json';
import { createApi, type ApiResponse } from '../server/api';
import { createDailyFiles, type DailyFiles } from '../server/daily-files.mjs';
import { resolveLeaderboardDay, resolveSnapshotDay } from '../server/daily';
import { verifySubmission } from '../server/replay';
import { createMemoryStore } from '../server/store';
import { fallbackDay, loadDay, settlementSeed, snapshotDay, validateDailySnapshot, type DailySnapshot } from './game/data';
import { act, createRun, exportRun, type RunExport } from './game/engine';
import { generateMap } from './game/map';
import { hashString } from './game/rng';

const HOUR = 3_600_000;
const iso = (time: number) => new Date(time).toISOString();
function snapshot(day = '2026-11-04', work = '41'): DailySnapshot {
  const end = Date.parse(`${day}T00:00:00Z`), start = end - 24 * HOUR;
  const historyStart = start - 7 * 24 * HOUR;
  const bucket = settlementsFixture.buckets[0]!;
  return {
    schemaVersion: 1, status: 'available', day, dataDate: iso(start).slice(0, 10), generatedAt: iso(end + HOUR),
    sourceWindow: { startAt: iso(start), endAt: iso(end), bucketSeconds: 3600 },
    window: { startAt: iso(start), endAt: iso(end), bucketSeconds: 3600 },
    buckets: Array.from({ length: 24 }, (_, index) => ({ ...bucket, startAt: iso(start + index * HOUR), endAt: iso(start + (index + 1) * HOUR), workAdded: work })),
    recentSettlements: [],
    history: {
      status: 'available', window: { startAt: iso(historyStart), endAt: iso(start), bucketSeconds: 86400 },
      buckets: Array.from({ length: 7 }, (_, index) => ({ ...bucket, startAt: iso(historyStart + index * 24 * HOUR), endAt: iso(historyStart + (index + 1) * 24 * HOUR), workAdded: '1200' })),
    },
    meta: { missingHours: [] },
  };
}
function files(values: Record<string, unknown>): DailyFiles {
  return { read: name => values[name], datedFiles: () => Object.keys(values).filter(name => name !== 'latest.json').sort().reverse() };
}
function finished(rules = fallbackDay('2026-11-04')) {
  return exportRun(act(createRun(rules, generateMap(rules), 'daily'), { type: 'abandon' }));
}
function resign(run: RunExport, updates: Partial<RunExport>): RunExport {
  const { checksum: _checksum, ...body } = { ...run, ...updates };
  return { ...body, checksum: hashString(JSON.stringify(body)).toString(16).padStart(8, '0') };
}

describe('published daily replay sources', () => {
  it('resolves overview seeds with the same dated, latest and fallback priority as the client', () => {
    const current = snapshot();
    const previous = snapshot('2026-11-03', '18');
    expect(resolveLeaderboardDay(current.day, files({ '2026-11-04.json': current, 'latest.json': previous })).seed).toBe(snapshotDay(current.day, current).seed);
    expect(resolveLeaderboardDay(current.day, files({ 'latest.json': previous })).seed).toBe(snapshotDay(current.day, previous).seed);
    expect(resolveLeaderboardDay(previous.day, files({ 'latest.json': current })).seed).toBe(fallbackDay(previous.day).seed);
    expect(resolveLeaderboardDay(current.day, files({ '2026-11-04.json': previous })).seed).toBe(fallbackDay(current.day).seed);
  });

  it('shares the dated client seed, map and server rules', async () => {
    const published = snapshot();
    expect(validateDailySnapshot(published)).toBe(true);
    const fetcher = async (input: string | URL | Request) => new Response(JSON.stringify(String(input).endsWith('/status') ? {} : published));
    // Exercise the actual client static-loading path, then replay that exact run.
    const original = globalThis.fetch;
    globalThis.fetch = fetcher as typeof fetch;
    try {
      const client = await loadDay(new Date('2026-11-04T12:10:00Z'));
      const authoritative = resolveSnapshotDay(client.day, client.seed, files({ '2026-11-04.json': published }));
      expect(client.seed).toBe(settlementSeed(client.day, published));
      expect(authoritative.seed).toBe(client.seed);
      expect(generateMap(authoritative)).toEqual(generateMap(client));
      expect(verifySubmission(finished(client), client.seed, (day, seed) => resolveSnapshotDay(day, seed, files({ '2026-11-04.json': published })))).toMatchObject({ day: client.day, seed: client.seed });
    } finally { globalThis.fetch = original; }
  });

  it('resolves latest fallback on the played UTC date and preserves it after a newer deployment', () => {
    const stale = snapshot('2026-11-03');
    const current = snapshot('2026-11-04', '65');
    const rules = snapshotDay('2026-11-04', stale);
    const initial = files({ 'latest.json': stale });
    expect(resolveSnapshotDay(rules.day, rules.seed, initial)).toEqual(rules);
    const afterDeploy = files({ '2026-11-03.json': stale, '2026-11-04.json': current, 'latest.json': current });
    expect(resolveSnapshotDay(rules.day, rules.seed, afterDeploy)).toEqual(rules);
    expect(verifySubmission(finished(rules), rules.seed, (day, seed) => resolveSnapshotDay(day, seed, afterDeploy))).toMatchObject({ day: rules.day, seed: rules.seed });
  });

  it('keeps a completed dated run on its original seed after UTC rollover', () => {
    const archived = snapshot();
    const later = snapshot('2026-11-05', '70');
    const rules = snapshotDay(archived.day, archived);
    const deployed = files({ '2026-11-04.json': archived, '2026-11-05.json': later, 'latest.json': later });
    expect(verifySubmission(finished(rules), rules.seed, (day, seed) => resolveSnapshotDay(day, seed, deployed))).toMatchObject({ day: archived.day, seed: rules.seed });
  });

  it('supports fixture fallback even with a published snapshot and rejects forged gameplay', () => {
    const published = snapshot();
    const deployed = files({ '2026-11-04.json': published, 'latest.json': published });
    const resolve = (day: string, seed: number) => resolveSnapshotDay(day, seed, deployed);
    const fallback = fallbackDay(published.day);
    expect(verifySubmission(finished(fallback), fallback.seed, resolve)).toMatchObject({ seed: fallback.seed });
    const rules = snapshotDay(published.day, published);
    const run = finished(rules);
    const forged = resign(run, { day: { ...rules, totalWork: rules.totalWork + 1 } });
    expect(() => verifySubmission(forged, rules.seed, resolve)).toThrow('authoritative daily snapshot');
    const forgedSeed = resign(run, { day: { ...rules, seed: rules.seed ^ 123 } });
    expect(() => verifySubmission(forgedSeed, forgedSeed.day.seed, resolve)).toThrow('authoritative daily snapshot');
  });

  it('ignores invalid, misnamed and future snapshots and missing local files', () => {
    const future = snapshot('2026-11-05');
    const expected = fallbackDay('2026-11-04');
    const invalid = { ...snapshot(), buckets: [] };
    const sources = files({ '2026-11-04.json': invalid, '2026-11-02.json': snapshot(), 'latest.json': future });
    expect(resolveSnapshotDay(expected.day, expected.seed, sources)).toEqual(expected);
    const absent = createDailyFiles('a-daily-snapshot-directory-that-does-not-exist');
    expect(absent.datedFiles()).toEqual([]);
    expect(absent.read('2026-11-04.json')).toBeUndefined();
    expect(createDailyFiles().read('../../../fixtures/settlements.json')).toBeUndefined();
    expect(resolveSnapshotDay(expected.day, expected.seed, absent)).toEqual(expected);
  });

  it('accepts published snapshot seeds through the score API and serves their seed board', async () => {
    const published = snapshot();
    const rules = snapshotDay(published.day, published);
    const run = finished(rules);
    const handler = createApi({ store: createMemoryStore(), resolveDay: (day, seed) => resolveSnapshotDay(day, seed, files({ '2026-11-04.json': published })) });
    async function call(method: 'GET' | 'POST', url: string, body?: unknown) {
      let text = '';
      const response: ApiResponse = { statusCode: 0, setHeader() {}, end(value) { text = value ?? ''; } };
      await handler({ method, url, headers: { 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' }, body }, response);
      return { status: response.statusCode, body: JSON.parse(text) };
    }
    const accepted = await call('POST', '/api/score', { seed: rules.seed, run, identity: { guestId: 'guest1234' } });
    expect(accepted.status).toBe(201);
    expect(accepted.body.entry).toMatchObject({ day: rules.day, seed: rules.seed });
    const board = await call('GET', `/api/leaderboard?mode=daily&seed=${rules.seed}`);
    expect(board.body.entries).toEqual([accepted.body.entry]);
    const rejected = await call('POST', '/api/score', { seed: rules.seed + 1, run, identity: { guestId: 'guest1234' } });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toBe('invalid_replay');
  });
});
