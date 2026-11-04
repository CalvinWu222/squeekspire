import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const API = 'https://api.squeekchain.com/v1';
const METRICS = ['settlementCount', 'activeRoundCount', 'workAdded', 'completedBlockCount', 'sqkMintedBaseUnits'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}
function object(value, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), `Invalid ${label}`);
  return value;
}
function timestamp(value, label) {
  const parts = typeof value === 'string' && /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?Z$/.exec(value);
  const time = parts ? Date.parse(value) : Number.NaN;
  // Date.parse silently normalizes impossible dates such as February 30.
  // Preserve valid API submillisecond precision while checking every calendar field.
  requireThat(parts && Number.isFinite(time) && new Date(time).toISOString() === `${parts[1]}.${(parts[2] ?? '').padEnd(3, '0').slice(0, 3)}Z`, `Invalid ${label}`);
  return time;
}
function uint(value, label) {
  requireThat(typeof value === 'string' && value.length <= 309 && /^\d+$/.test(value) && Number.isFinite(Number(value)), `Invalid ${label}`);
}
function nonnegative(value, label) {
  requireThat(typeof value === 'number' && Number.isFinite(value) && value >= 0, `Invalid ${label}`);
}
function windowOf(value, seconds, label) {
  object(value, label);
  const start = timestamp(value.startAt, `${label}.startAt`);
  const end = timestamp(value.endAt, `${label}.endAt`);
  requireThat(value.bucketSeconds === seconds && start < end && start % HOUR === 0 && end % HOUR === 0, `Invalid ${label}`);
  return { start, end };
}
function bucketOf(value, seconds, label) {
  object(value, label);
  const start = timestamp(value.startAt, `${label}.startAt`);
  const end = timestamp(value.endAt, `${label}.endAt`);
  requireThat(end - start === seconds * 1000 && start % HOUR === 0, `Invalid ${label} boundaries`);
  for (const key of METRICS) uint(value[key], `${label}.${key}`);
  return value;
}
function bucketsOf(values, seconds, label) {
  requireThat(Array.isArray(values), `Invalid ${label}`);
  const seen = new Set();
  for (const [index, value] of values.entries()) {
    bucketOf(value, seconds, `${label}[${index}]`);
    const start = Date.parse(value.startAt);
    requireThat(!seen.has(start), `Duplicate ${label} hour`);
    seen.add(start);
  }
  return [...values].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}
function settlementsOf(values) {
  requireThat(Array.isArray(values), 'Invalid recentSettlements');
  for (const event of values) {
    object(event, 'settlement');
    requireThat(typeof event.transactionHash === 'string' && /^0x[\da-f]{64}$/i.test(event.transactionHash), 'Invalid transaction hash');
    requireThat(typeof event.confirmationStatus === 'string', 'Invalid confirmation status');
    for (const key of ['settledThroughRound', 'blockHeight', 'activeRoundCount', 'workAdded', 'completedBlockCount']) {
      uint(event[key], `settlement.${key}`);
    }
    for (const key of ['previousSettledThroughRound', 'cumulativeWork', 'cumulativeBlockUnits', 'firstCompletedBlock', 'lastCompletedBlock', 'ethereumBlockNumber', 'logIndex', 'sqkMintedBaseUnits']) {
      if (event[key] !== undefined && event[key] !== null) uint(event[key], `settlement.${key}`);
    }
    timestamp(event.blockTimestamp, 'settlement.blockTimestamp');
  }
}

/** Validate the complete source series before trusting any of its hours. */
export function validateSettlements(value, range) {
  object(value, `${range} response`);
  requireThat(Number.isInteger(value.schemaVersion) && value.schemaVersion >= 1 && value.status === 'available' && value.range === range, `Invalid ${range} response status/version/range`);
  timestamp(value.generatedAt, `${range}.generatedAt`);
  const seconds = range === '24h' ? 3600 : 86400;
  const { start, end } = windowOf(value.window, seconds, `${range}.window`);
  requireThat(range === '24h' ? end - start === DAY : end - start >= 24 * DAY && end - start <= 30 * DAY && (end - start) % DAY === 0, `Invalid ${range} window duration`);
  const buckets = bucketsOf(value.buckets, seconds, `${range}.buckets`);
  requireThat(buckets.length === (end - start) / (seconds * 1000), `Incomplete ${range} buckets`);
  for (const [index, bucket] of buckets.entries()) {
    requireThat(Date.parse(bucket.startAt) === start + index * seconds * 1000, `Noncontiguous ${range} buckets`);
  }
  object(value.summary, `${range}.summary`);
  for (const key of ['settlementCount', 'activeRoundCount', 'workAdded', 'completedBlockCount', 'archivedSettlementCount']) {
    uint(value.summary[key], `${range}.summary.${key}`);
  }
  settlementsOf(value.recentSettlements);
  object(value.mining, `${range}.mining`);
  requireThat(value.mining.status === 'available', `Invalid ${range}.mining.status`);
  for (const key of ['supplyCap', 'premintBaseUnits', 'startRound', 'startHeight', 'miningMintedBaseUnits', 'unmintedCapacityBaseUnits', 'processedThroughRound', 'rangeMintedBaseUnits', 'rangeCheckpointCount']) {
    uint(value.mining[key], `${range}.mining.${key}`);
  }
  if (value.previousPeriod !== null && value.previousPeriod !== undefined) {
    object(value.previousPeriod, 'previousPeriod');
    requireThat(timestamp(value.previousPeriod.startAt, 'previousPeriod.startAt') < timestamp(value.previousPeriod.endAt, 'previousPeriod.endAt'), 'Invalid previousPeriod');
    uint(value.previousPeriod.sqkMintedBaseUnits, 'previousPeriod.sqkMintedBaseUnits');
  }
  return value;
}

export function validateStatus(value) {
  object(value, 'status response');
  requireThat(Number.isInteger(value.schemaVersion) && value.schemaVersion >= 1, 'Invalid status.schemaVersion');
  timestamp(value.generatedAt, 'status.generatedAt');
  object(value.measurement, 'status.measurement');
  const measurement = value.measurement;
  requireThat(['online', 'stale', 'offline', 'unknown'].includes(measurement.freshness), 'Invalid measurement.freshness');
  requireThat(typeof measurement.coreStatus === 'string' && measurement.coreStatus.length > 0, 'Invalid measurement.coreStatus');
  timestamp(measurement.observedAt, 'measurement.observedAt');
  timestamp(measurement.receivedAt, 'measurement.receivedAt');
  for (const key of ['rpmMilli', 'speedMmPerSecond', 'distanceMm', 'staleAfterSeconds']) nonnegative(measurement[key], `measurement.${key}`);
  uint(measurement.cumulativeWorkUnits, 'measurement.cumulativeWorkUnits');
  object(value.oracle, 'status.oracle');
  requireThat(typeof value.oracle.state === 'string' && value.oracle.state.length > 0, 'Invalid oracle.state');
  return value;
}

export function validateArchive(value) {
  object(value, 'hourly archive');
  requireThat(value.schemaVersion === 1, 'Invalid archive.schemaVersion');
  bucketsOf(value.buckets, 3600, 'archive.buckets');
  return value;
}

function iso(time) { return new Date(time).toISOString(); }
function copyBucket(bucket) {
  return Object.fromEntries(['startAt', 'endAt', ...METRICS].map(key => [key, bucket[key]]));
}
function emptyBucket(start, duration = HOUR) {
  return { startAt: iso(start), endAt: iso(start + duration), ...Object.fromEntries(METRICS.map(key => [key, '0'])) };
}
export function sumBuckets(buckets, startAt, endAt) {
  const amounts = Object.fromEntries(METRICS.map(key => {
    const amount = buckets.reduce((sum, bucket) => sum + BigInt(bucket[key]), 0n).toString();
    uint(amount, `summed ${key}`);
    return [key, amount];
  }));
  return {
    startAt, endAt,
    ...amounts,
  };
}

/** The rolling response's current, unfinished hour is never persisted. */
export function mergeHourlyBuckets(archive, response, now = new Date()) {
  validateArchive(archive);
  validateSettlements(response, '24h');
  const time = new Date(now).getTime();
  requireThat(Number.isFinite(time), 'Invalid current time');
  const merged = new Map();
  for (const bucket of [...archive.buckets, ...response.buckets]) {
    requireThat(Date.parse(bucket.endAt) <= time || !archive.buckets.includes(bucket), 'Archive contains unfinished hours');
    if (Date.parse(bucket.endAt) <= time) merged.set(Date.parse(bucket.startAt), copyBucket(bucket));
  }
  return { schemaVersion: 1, buckets: [...merged.values()].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt)) };
}

function historyFor(archive, daily, cutoff) {
  const grouped = new Map();
  for (const bucket of archive.buckets) {
    const start = Date.parse(bucket.startAt);
    const day = Math.floor(start / DAY) * DAY;
    if (day + DAY > cutoff) continue;
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day).push(bucket);
  }
  const archived = [...grouped.entries()]
    .filter(([, buckets]) => buckets.length === 24)
    .map(([day, buckets]) => ({ bucket: sumBuckets(buckets, iso(day), iso(day + DAY)), source: 'hourly-archive' }));
  // Keep the endpoint's true rolling boundaries. Relabelling noon-to-noon totals
  // as UTC calendar days would falsely imply knowledge of their hourly split.
  const rolling = daily.buckets
    .filter(bucket => Date.parse(bucket.endAt) <= cutoff)
    .filter(bucket => !archived.some(({ bucket: full }) => Date.parse(bucket.startAt) < Date.parse(full.endAt) && Date.parse(bucket.endAt) > Date.parse(full.startAt)))
    .map(bucket => ({ bucket: copyBucket(bucket), source: 'api-30d' }));
  const chosen = [...archived, ...rolling].sort((a, b) => Date.parse(a.bucket.startAt) - Date.parse(b.bucket.startAt)).slice(-7);
  requireThat(chosen.length === 7, 'Seven complete historical periods are required');
  return {
    history: {
      status: 'available',
      window: { startAt: chosen[0].bucket.startAt, endAt: chosen.at(-1).bucket.endAt, bucketSeconds: 86400 },
      buckets: chosen.map(item => item.bucket),
    },
    sources: chosen.map(({ bucket, source }) => ({ startAt: bucket.startAt, endAt: bucket.endAt, source })),
  };
}

export function buildSnapshot(archive, hourly, daily, status, now = new Date()) {
  validateArchive(archive);
  validateSettlements(hourly, '24h');
  validateSettlements(daily, '30d');
  validateStatus(status);
  const time = new Date(now).getTime();
  requireThat(Number.isFinite(time), 'Invalid current time');
  const end = Math.floor(time / DAY) * DAY;
  const start = end - DAY;
  const byStart = new Map(archive.buckets.map(bucket => [Date.parse(bucket.startAt), bucket]));
  const missingHours = [];
  const buckets = Array.from({ length: 24 }, (_, hour) => {
    const hourStart = start + hour * HOUR;
    const archived = byStart.get(hourStart);
    if (archived) return copyBucket(archived);
    missingHours.push(iso(hourStart));
    return emptyBucket(hourStart);
  });
  const { history, sources } = historyFor(archive, daily, start);
  const snapshot = {
    schemaVersion: 1,
    status: 'available',
    day: iso(end).slice(0, 10),
    dataDate: iso(start).slice(0, 10),
    generatedAt: iso(time),
    sourceWindow: { ...hourly.window },
    window: { startAt: iso(start), endAt: iso(end), bucketSeconds: 3600 },
    summary: { ...sumBuckets(buckets, iso(start), iso(end)), archivedSettlementCount: '0' },
    buckets,
    // Rolling recent events can fall outside this UTC day. They must not enter
    // the frozen seed or imply a historical end-of-day chain height.
    recentSettlements: [],
    history,
    meta: {
      missingHours,
      completeness: missingHours.length === 0 ? 'complete' : 'partial',
      archivedHours: 24 - missingHours.length,
      historySources: sources,
      statusObservation: {
        observedAt: status.measurement.observedAt,
        freshness: status.measurement.freshness,
        coreStatus: status.measurement.coreStatus,
        rpmMilli: status.measurement.rpmMilli,
      },
    },
  };
  validateDailySnapshot(snapshot);
  return snapshot;
}

/** Independent publisher validation also protects already-frozen dated files. */
export function validateDailySnapshot(value) {
  object(value, 'daily snapshot');
  requireThat(value.schemaVersion === 1 && value.status === 'available', 'Invalid daily snapshot version/status');
  requireThat(typeof value.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.day) && typeof value.dataDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.dataDate), 'Invalid snapshot day/dataDate');
  timestamp(value.generatedAt, 'snapshot.generatedAt');
  const { start, end } = windowOf(value.window, 3600, 'snapshot.window');
  requireThat(end - start === DAY && start % DAY === 0 && value.dataDate === iso(start).slice(0, 10) && value.day === iso(end).slice(0, 10), 'Invalid snapshot UTC day');
  const source = windowOf(value.sourceWindow, 3600, 'snapshot.sourceWindow');
  requireThat(source.end - source.start === DAY, 'Invalid snapshot sourceWindow duration');
  const buckets = bucketsOf(value.buckets, 3600, 'snapshot.buckets');
  requireThat(buckets.length === 24 && buckets.every((bucket, index) => Date.parse(bucket.startAt) === start + index * HOUR), 'Invalid snapshot hourly series');
  object(value.summary, 'snapshot.summary');
  const sums = sumBuckets(buckets, value.window.startAt, value.window.endAt);
  for (const key of METRICS) {
    uint(value.summary[key], `snapshot.summary.${key}`);
    requireThat(value.summary[key] === sums[key], `Invalid snapshot summed ${key}`);
  }
  uint(value.summary.archivedSettlementCount, 'snapshot.summary.archivedSettlementCount');
  requireThat(Array.isArray(value.recentSettlements) && value.recentSettlements.length === 0, 'Published snapshots must exclude rolling recent settlements');
  object(value.history, 'snapshot.history');
  requireThat(value.history.status === 'available', 'Invalid history status');
  const historyWindow = windowOf(value.history.window, 86400, 'snapshot.history.window');
  const history = bucketsOf(value.history.buckets, 86400, 'snapshot.history.buckets');
  requireThat(history.length === 7 && history.every((bucket, index) => Date.parse(bucket.endAt) <= start && (index === 0 || Date.parse(history[index - 1].endAt) <= Date.parse(bucket.startAt))), 'Invalid complete historical periods');
  requireThat(historyWindow.start <= Date.parse(history[0].startAt) && historyWindow.end >= Date.parse(history.at(-1).endAt), 'Invalid history window');
  sumBuckets(history, value.history.window.startAt, value.history.window.endAt);
  object(value.meta, 'snapshot.meta');
  requireThat(Array.isArray(value.meta.missingHours), 'Invalid missingHours');
  const missing = new Set();
  for (const hour of value.meta.missingHours) {
    const time = timestamp(hour, 'missing hour');
    requireThat(time >= start && time < end && time % HOUR === 0 && !missing.has(time), 'Invalid or duplicate missing hour');
    requireThat(METRICS.every(key => BigInt(buckets[(time - start) / HOUR][key]) === 0n), 'Missing hours must have zero metrics');
    missing.add(time);
  }
  requireThat(value.meta.archivedHours === 24 - missing.size && value.meta.completeness === (missing.size ? 'partial' : 'complete'), 'Invalid snapshot completeness');
  return value;
}

function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
async function readOptional(io, filename) {
  try { return await io.readFile(filename, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}
async function fetchJson(fetchImpl, resource) {
  const response = await fetchImpl(`${API}/${resource}`, { signal: AbortSignal.timeout(20_000), headers: { accept: 'application/json' } });
  requireThat(response.ok, `Public API ${resource} returned ${response.status}`);
  return response.json();
}

/** All reads and validations finish before the first directory/file is written. */
export async function refreshDaily({ now = new Date(), force = false, rootDir = ROOT, fetchImpl = globalThis.fetch, io = fs } = {}) {
  const day = new Date(now).toISOString().slice(0, 10);
  const dataDir = path.join(rootDir, 'public', 'data');
  const archiveFile = path.join(dataDir, 'hourly-buckets.json');
  const datedFile = path.join(dataDir, 'daily', `${day}.json`);
  const latestFile = path.join(dataDir, 'daily', 'latest.json');
  const [hourly, daily, status, archiveText, datedText, latestText] = await Promise.all([
    fetchJson(fetchImpl, 'settlements?range=24h'), fetchJson(fetchImpl, 'settlements?range=30d'), fetchJson(fetchImpl, 'status'),
    readOptional(io, archiveFile), readOptional(io, datedFile), readOptional(io, latestFile),
  ]);
  validateSettlements(hourly, '24h');
  validateSettlements(daily, '30d');
  validateStatus(status);
  const archive = archiveText === undefined ? { schemaVersion: 1, buckets: [] } : JSON.parse(archiveText);
  validateArchive(archive);
  const existing = datedText === undefined ? undefined : validateDailySnapshot(JSON.parse(datedText));
  requireThat(!existing || existing.day === day, 'Dated snapshot filename/day mismatch');
  const merged = mergeHourlyBuckets(archive, hourly, now);
  const snapshot = existing && !force ? existing : buildSnapshot(merged, hourly, daily, status, now);
  // Preserve the exact published bytes, including generatedAt, on normal reruns.
  const snapshotText = existing && !force ? datedText : json(snapshot);
  const planned = [[archiveFile, json(merged), archiveText], [datedFile, snapshotText, datedText], [latestFile, snapshotText, latestText]]
    .filter(([, content, previous]) => content !== previous);
  for (const [filename, content] of planned) {
    await io.mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.tmp`;
    await io.writeFile(temporary, content, 'utf8');
    await io.rename(temporary, filename);
  }
  return { snapshot, archive: merged, datedFile, changedFiles: planned.map(([filename]) => filename), preserved: !!existing && !force };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const unknown = process.argv.slice(2).filter(arg => arg !== '--force');
  if (unknown.length) {
    console.error(`Unknown arguments: ${unknown.join(', ')}`);
    process.exitCode = 1;
  } else {
    try {
      const result = await refreshDaily({ force: process.argv.includes('--force') });
      console.log(`${result.preserved ? 'Preserved' : 'Published'} ${path.relative(ROOT, result.datedFile)} (dataDate ${result.snapshot.dataDate}; ${result.snapshot.meta.missingHours.length} missing hours); ${result.changedFiles.length} files changed.`);
    } catch (error) {
      console.error(`Daily refresh failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
