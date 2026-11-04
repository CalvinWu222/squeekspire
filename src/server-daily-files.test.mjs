import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createDailyFiles } from '../server/daily-files.mjs';
import { resolveSnapshotDay } from '../server/daily';
import { fallbackDay, snapshotDay, validateDailySnapshot } from './game/data';

const temporary = [];
afterEach(async () => {
  for (const directory of temporary.splice(0)) {
    if (dirname(directory) !== tmpdir() || !basename(directory).startsWith('squeekspire-daily-')) throw new Error('Unexpected temporary directory');
    await rm(directory, { recursive: true, force: true });
  }
});

function publishedSnapshot() {
  const hour = 3_600_000, end = Date.parse('2026-11-04T00:00:00Z'), start = end - 24 * hour;
  const iso = value => new Date(value).toISOString();
  const window = { startAt: iso(start), endAt: iso(end), bucketSeconds: 3600 };
  const bucket = (startAt, endAt) => ({ startAt: iso(startAt), endAt: iso(endAt), settlementCount: '1', activeRoundCount: '1', workAdded: '50', completedBlockCount: '2', sqkMintedBaseUnits: '100' });
  return {
    schemaVersion: 1, status: 'available', day: '2026-11-04', dataDate: '2026-11-03', generatedAt: iso(end + hour), sourceWindow: window, window,
    buckets: Array.from({ length: 24 }, (_, i) => bucket(start + i * hour, start + (i + 1) * hour)), recentSettlements: [], meta: { missingHours: [] },
    history: { status: 'available', window: { startAt: iso(start - 7 * 24 * hour), endAt: iso(start), bucketSeconds: 86400 }, buckets: Array.from({ length: 7 }, (_, i) => bucket(start - (7 - i) * 24 * hour, start - (6 - i) * 24 * hour)) },
  };
}

describe('bundled daily snapshot file reader', () => {
  it('reads deployed JSON and resolves its seed while ignoring unrelated or corrupt files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'squeekspire-daily-'));
    temporary.push(directory);
    const snapshot = publishedSnapshot();
    expect(validateDailySnapshot(snapshot)).toBe(true);
    await Promise.all([
      writeFile(join(directory, '2026-11-04.json'), JSON.stringify(snapshot)),
      writeFile(join(directory, 'latest.json'), JSON.stringify(snapshot)),
      writeFile(join(directory, '2026-11-03.json'), '{broken json'),
      writeFile(join(directory, 'readme.txt'), 'not a snapshot'),
      writeFile(join(directory, 'other.json'), '{}'),
    ]);
    const reader = createDailyFiles(directory);
    expect(reader.datedFiles()).toEqual(['2026-11-04.json', '2026-11-03.json']);
    expect(reader.read('2026-11-04.json')).toEqual(snapshot);
    expect(reader.read('latest.json')).toEqual(snapshot);
    expect(reader.read('2026-11-03.json')).toBeUndefined();
    expect(reader.read('2026-11-02.json')).toBeUndefined();
    const rules = snapshotDay(snapshot.day, snapshot);
    expect(resolveSnapshotDay(rules.day, rules.seed, reader)).toEqual(rules);
    const fixture = fallbackDay('2026-11-02');
    expect(resolveSnapshotDay(fixture.day, fixture.seed, reader)).toEqual(fixture);
  });
});
