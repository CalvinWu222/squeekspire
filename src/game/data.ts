import settlementsFixture from '../../fixtures/settlements.json' with { type: 'json' };
import historyFixture from '../../fixtures/history-30d.json' with { type: 'json' };
import { hashString } from './rng.js';
import type { DayData, HourData } from './types.js';

const API = 'https://api.squeekchain.com/v1';
const HOUR = 3_600_000;
const SNAPSHOT_VERSION = 'squeekspire-settled-v1';

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const numeric = (value: unknown): number => {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0) throw new Error('Invalid settlement number');
  return result;
};

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

/** Public fixture data + date only. Arrival times, status and browser storage never enter this hash. */
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
  if (snapshot.status !== 'available' || snapshot.buckets.length !== 24 || snapshot.window.bucketSeconds !== 3600) {
    throw new Error('Expected 24 available hourly settlement buckets');
  }
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
    notice: 'Captured real hamster run snapshot (daily refresh coming soon). Public API has rolling windows, not a frozen historical UTC day. Same UTC day, same map for every profile.',
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

async function fetchPublic(path: string): Promise<unknown> {
  const response = await fetch(`${API}/${path}`, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`Public API returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function liveStatus(value: unknown): { accepted: boolean; spinning: boolean } {
  if (!value || typeof value !== 'object') return { accepted: false, spinning: false };
  const status = value as { oracle?: { state?: string }; measurement?: { coreStatus?: string; freshness?: string } };
  const accepted = status.oracle?.state === 'accepted';
  return { accepted, spinning: accepted && status.measurement?.freshness === 'online' && status.measurement.coreStatus === 'SPINNING' };
}

/**
 * Fetch the real public API for availability and the practice-only live energy flag.
 * Daily rules intentionally remain the published immutable fixture until the API offers
 * a frozen historical window/manifest. A first-visitor localStorage lock is not global fairness.
 */
export async function loadDay(now = new Date()): Promise<DayData> {
  const day = fallbackDay(getGameDay(now));
  const [settlements, status] = await Promise.allSettled([
    fetchPublic('settlements?range=24h'),
    fetchPublic('status'),
  ]);
  const live = status.status === 'fulfilled' ? liveStatus(status.value) : { accepted: false, spinning: false };
  day.spinning = live.spinning;
  const available = settlements.status === 'fulfilled'
    && !!settlements.value && typeof settlements.value === 'object'
    && (settlements.value as { status?: string }).status === 'available';
  if (!available || status.status === 'rejected') {
    day.notice = `Public API unavailable. ${day.notice}`;
  } else if (!live.accepted) {
    day.notice = `Oracle unavailable or unaccepted. ${day.notice}`;
  } else {
    day.notice = `Public API online. ${day.notice} Live wheel Seeds apply in practice only.`;
  }
  return day;
}
