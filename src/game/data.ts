import settlementsFixture from '../../fixtures/settlements.json' with { type: 'json' };
import historyFixture from '../../fixtures/history-30d.json' with { type: 'json' };
import { hashString } from './rng.js';
import type { DayData, HourData } from './types.js';

const API = 'https://api.squeekchain.com/v1';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SNAPSHOT_VERSION = 'squeekspire-settled-v1';
const METRICS = ['workAdded', 'settlementCount', 'activeRoundCount', 'completedBlockCount', 'sqkMintedBaseUnits'] as const;

interface Bucket {
  startAt: string;
  endAt: string;
  workAdded: string;
  settlementCount: string;
  activeRoundCount: string;
  completedBlockCount: string;
  sqkMintedBaseUnits: string;
}

interface Settlement {
  transactionHash: string;
  settledThroughRound: string;
  blockHeight: string;
  cumulativeBlockUnits?: string;
  confirmationStatus: string;
}

export interface SettlementSnapshot {
  window: { startAt: string; endAt: string; bucketSeconds: number };
  buckets: Bucket[];
  recentSettlements?: Settlement[];
  status: string;
}

/** A published snapshot is immutable for its UTC play day. */
export interface DailySnapshot extends SettlementSnapshot {
  schemaVersion: 1;
  status: 'available';
  day: string;
  dataDate: string;
  generatedAt: string;
  sourceWindow: SettlementSnapshot['window'];
  history: SettlementSnapshot;
  meta: { missingHours: string[]; [key: string]: unknown };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integerString = (value: unknown): value is string => typeof value === 'string'
  && value.length <= 309 && /^\d+$/.test(value) && Number.isFinite(Number(value));
const numeric = (value: unknown): number => {
  if (!integerString(value)) throw new Error('Invalid settlement number');
  return Number(value);
};

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return false;
  const normalized = `${value.slice(0, 19)}.${(value.split('.')[1]?.slice(0, -1) ?? '').padEnd(3, '0')}Z`;
  return new Date(time).toISOString() === normalized;
}

function calendarDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && timestamp(`${value}T00:00:00.000Z`);
}

function validWindow(value: unknown, seconds: number): value is SettlementSnapshot['window'] {
  return record(value) && timestamp(value.startAt) && timestamp(value.endAt)
    && value.bucketSeconds === seconds && Date.parse(value.startAt) < Date.parse(value.endAt)
    && Date.parse(value.startAt) % HOUR === 0 && Date.parse(value.endAt) % HOUR === 0;
}

function validEvents(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((event: unknown) => record(event)
    && typeof event.transactionHash === 'string' && /^0x[\da-fA-F]{64}$/.test(event.transactionHash)
    && integerString(event.settledThroughRound) && integerString(event.blockHeight)
    && (event.cumulativeBlockUnits === undefined || integerString(event.cumulativeBlockUnits))
    && typeof event.confirmationStatus === 'string' && event.confirmationStatus.length > 0));
}

function validSettlements(value: unknown, seconds: number, count?: number): value is SettlementSnapshot {
  if (!record(value) || value.status !== 'available' || !validWindow(value.window, seconds)
    || !Array.isArray(value.buckets) || (count !== undefined && value.buckets.length !== count)
    || !validEvents(value.recentSettlements)) return false;
  const windowStart = Date.parse(value.window.startAt);
  const windowEnd = Date.parse(value.window.endAt);
  const buckets: Bucket[] = [];
  for (const bucket of value.buckets) {
    if (!record(bucket) || !timestamp(bucket.startAt) || !timestamp(bucket.endAt)
      || Date.parse(bucket.endAt) - Date.parse(bucket.startAt) !== seconds * 1000
      || Date.parse(bucket.startAt) < windowStart || Date.parse(bucket.endAt) > windowEnd
      || !METRICS.every((metric) => integerString(bucket[metric]))) return false;
    buckets.push(bucket as unknown as Bucket);
  }
  buckets.sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  if (buckets.some((bucket, index) => index > 0 && Date.parse(bucket.startAt) < Date.parse(buckets[index - 1].endAt))) return false;
  return METRICS.every((metric) => Number.isFinite(buckets.reduce((sum, bucket) => sum + Number(bucket[metric]), 0)));
}

/** Reject malformed static files before they can affect maps, seeds or BigInt conversion. */
export function validateDailySnapshot(value: unknown): value is DailySnapshot {
  if (!record(value) || value.schemaVersion !== 1 || !calendarDate(value.day) || !calendarDate(value.dataDate)
    || !timestamp(value.generatedAt) || !validSettlements(value, 3600, 24)
    || !validWindow(value.sourceWindow, 3600) || !validSettlements(value.history, 86400, 7)
    || !record(value.meta) || !Array.isArray(value.meta.missingHours)) return false;
  const start = Date.parse(`${value.dataDate}T00:00:00.000Z`);
  const end = start + DAY;
  if (value.day !== new Date(end).toISOString().slice(0, 10)
    || Date.parse(value.window.startAt) !== start || Date.parse(value.window.endAt) !== end
    || Date.parse(value.sourceWindow.endAt) - Date.parse(value.sourceWindow.startAt) !== DAY
    || Date.parse(value.sourceWindow.startAt) % HOUR !== 0
    || value.history.buckets.some((bucket) => Date.parse(bucket.endAt) > start)) return false;
  const ordered = [...value.buckets].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  if (ordered.some((bucket, hour) => Date.parse(bucket.startAt) !== start + hour * HOUR)) return false;
  const missing = value.meta.missingHours;
  return new Set(missing).size === missing.length && missing.every((hour: unknown) => timestamp(hour)
    && Date.parse(hour) >= start && Date.parse(hour) < end && Date.parse(hour) % HOUR === 0
    && METRICS.every((metric) => Number(ordered[(Date.parse(hour) - start) / HOUR][metric]) === 0));
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

/** Daily challenges use the UTC calendar date in every client timezone. */
export function getGameDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Epoch milliseconds of the next 00:00 UTC reset, independent of local time or DST. */
export function getDailyResetTime(now = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

/** Public settled buckets + play date only. Arrival times and status never enter this hash. */
export function settlementSeed(day: string, snapshot: SettlementSnapshot): number {
  const buckets = [...snapshot.buckets].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const events = (snapshot.recentSettlements ?? [])
    .filter((event) => event.confirmationStatus === 'safe')
    .map((event) => `${event.transactionHash}:${event.settledThroughRound}`)
    .sort();
  const canonical = buckets.map((bucket) => [
    bucket.startAt, bucket.endAt, bucket.workAdded, bucket.settlementCount,
    bucket.activeRoundCount, bucket.completedBlockCount, bucket.sqkMintedBaseUnits,
  ]);
  return hashString(JSON.stringify([SNAPSHOT_VERSION, day, canonical, events]));
}

/** Pure conversion shared by fixtures and tests; all daily rule inputs are settled data. */
export function buildDayData(day: string, snapshot: SettlementSnapshot, history: SettlementSnapshot): DayData {
  if (!validSettlements(snapshot, 3600, 24)) {
    throw new Error('Expected 24 available hourly settlement buckets');
  }
  if (!validSettlements(history, 86400)) throw new Error('Invalid historical settlement buckets');
  const ordered = [...snapshot.buckets].sort((a, b) => a.startAt.localeCompare(b.startAt));
  const hours: HourData[] = ordered.map((bucket, hour) => ({
    hour,
    label: `${String(new Date(bucket.startAt).getUTCHours()).padStart(2, '0')}:00 UTC`,
    work: numeric(bucket.workAdded),
    settlements: numeric(bucket.settlementCount),
    activeRounds: numeric(bucket.activeRoundCount),
    blocks: numeric(bucket.completedBlockCount),
  }));

  // The 30d endpoint supplies daily buckets. Use seven complete periods BEFORE the map window.
  // These captured historical periods do not define the daily challenge's UTC reset.
  const previousNights = [...history.buckets]
    .filter((bucket) => new Date(bucket.endAt).getTime() <= new Date(snapshot.window.startAt).getTime()
      && new Date(bucket.endAt).getTime() - new Date(bucket.startAt).getTime() === 24 * HOUR)
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(-7);
  if (previousNights.length !== 7) throw new Error('Seven complete historical periods are required');
  const totalWork = hours.reduce((sum, hour) => sum + hour.work, 0);
  const medianWork = median(previousNights.map((bucket) => numeric(bucket.workAdded)));
  const ratio = medianWork > 0 ? totalWork / medianWork : totalWork > 0 ? 1.3 : 0;
  const completedBlocks = hours.reduce((sum, hour) => sum + hour.blocks, 0);
  const minted = ordered.reduce((sum, bucket) => sum + numeric(bucket.sqkMintedBaseUnits), 0);
  const medianMinted = median(previousNights.map((bucket) => numeric(bucket.sqkMintedBaseUnits)));
  const lastSafe = [...(snapshot.recentSettlements ?? [])]
    .filter((event) => event.confirmationStatus === 'safe')
    .sort((a, b) => Number(b.settledThroughRound) - Number(a.settledThroughRound))[0];
  const blockUnits = lastSafe?.cumulativeBlockUnits ? BigInt(lastSafe.cumulativeBlockUnits) : 0n;

  return {
    day,
    seed: settlementSeed(day, snapshot),
    source: 'fallback',
    notice: `Real hamster data from ${snapshot.window.startAt.slice(0, 10)} (UTC), bundled fixture fallback.`,
    hours,
    totalWork,
    medianWork,
    difficulty: clamp(ratio, 0.8, 1.3),
    hibernation: totalWork < Math.max(1, medianWork * 0.25),
    // No historical RPM series is exposed. This deterministic hourly work/minute proxy is disclosed.
    peakRpm: Math.max(...hours.map((hour) => hour.work)) / 60,
    blockHeight: lastSafe ? numeric(lastSafe.blockHeight) : completedBlocks,
    blockProgress: Number(blockUnits % 1_000_000_000n),
    completedBlocks,
    activeRounds: hours.reduce((sum, hour) => sum + hour.activeRounds, 0),
    priceMultiplier: clamp(medianMinted > 0 ? minted / medianMinted : 1, 0.8, 1.2),
    rareBonus: clamp(completedBlocks / 10_000, 0, 0.08),
    spinning: false,
  };
}

export function fallbackDay(day: string): DayData {
  return buildDayData(day, settlementsFixture, historyFixture);
}

/** Shared client/server conversion keeps published map rules and accepted seeds identical. */
export function snapshotDay(day: string, snapshot: DailySnapshot, source: DayData['source'] = 'live'): DayData {
  if (!validateDailySnapshot(snapshot)) throw new Error('Invalid daily snapshot');
  const result = buildDayData(day, snapshot, snapshot.history);
  result.source = source;
  result.notice = `Real hamster data from ${snapshot.dataDate} (UTC).`;
  if (source === 'cached') result.notice += ` Latest snapshot fallback (published ${snapshot.day}).`;
  return result;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
  if (!response.ok) throw new Error(`Data request returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function loadPublishedDay(day: string): Promise<DayData> {
  for (const [filename, source] of [[`${day}.json`, 'live'], ['latest.json', 'cached']] as const) {
    try {
      const snapshot = await fetchJson(`/data/daily/${filename}`);
      if (validateDailySnapshot(snapshot) && (source === 'live' ? snapshot.day === day : snapshot.day <= day)) {
        return snapshotDay(day, snapshot, source);
      }
    } catch {
      // Missing files, malformed JSON and unavailable networks all continue down the fallback chain.
    }
  }
  return fallbackDay(day);
}

function liveStatus(value: unknown): { accepted: boolean; spinning: boolean } {
  if (!value || typeof value !== 'object') return { accepted: false, spinning: false };
  const status = value as { oracle?: { state?: string }; measurement?: { coreStatus?: string; freshness?: string } };
  const accepted = status.oracle?.state === 'accepted';
  return { accepted, spinning: accepted && status.measurement?.freshness === 'online' && status.measurement.coreStatus === 'SPINNING' };
}

/**
 * Resolve the immutable UTC snapshot before exposing daily rules. Public live status only
 * supplies the practice energy flag; rolling API buckets never change a published map.
 */
export async function loadDay(now = new Date()): Promise<DayData> {
  const [day, status] = await Promise.all([
    loadPublishedDay(getGameDay(now)),
    fetchJson(`${API}/status`).then(liveStatus, () => ({ accepted: false, spinning: false })),
  ]);
  day.spinning = status.spinning;
  if (!status.accepted) day.notice += ' Oracle unavailable or unaccepted; live practice bonus is off.';
  return day;
}
