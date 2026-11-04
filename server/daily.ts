import { fallbackDay, snapshotDay, validateDailySnapshot } from '../src/game/data.js';
import type { DayData } from '../src/game/types.js';
import { createDailyFiles, type DailyFiles } from './daily-files.mjs';

export type DayResolver = (day: string, seed: number) => DayData;
const published = createDailyFiles();

/** Same dated / latest / bundled fallback order used by the read-only client. */
export function resolveLeaderboardDay(day: string, files: DailyFiles = published): DayData {
  for (const name of [`${day}.json`, 'latest.json']) {
    const snapshot = files.read(name);
    if (validateDailySnapshot(snapshot) && (name === 'latest.json' ? snapshot.day <= day : snapshot.day === day)) {
      return snapshotDay(day, snapshot, name === 'latest.json' ? 'cached' : 'live');
    }
  }
  return fallbackDay(day);
}

/**
 * Match only rules built from our published immutable data or the bundled fallback.
 * A client can have used an older latest.json during an outage, then submit after
 * the next deploy. Its original dated file remains an authoritative replay source.
 */
export function resolveSnapshotDay(day: string, seed: number, files: DailyFiles = published): DayData {
  let preferred: DayData | undefined;
  const tried = new Set<string>();
  const attempt = (name: string): DayData | undefined => {
    if (tried.has(name)) return undefined;
    tried.add(name);
    const snapshot = files.read(name);
    if (!validateDailySnapshot(snapshot) || snapshot.day > day) return undefined;
    if (name !== 'latest.json' && name !== `${snapshot.day}.json`) return undefined;
    const rules = snapshotDay(day, snapshot);
    preferred ??= rules;
    return rules.seed === seed ? rules : undefined;
  };
  for (const name of [`${day}.json`, 'latest.json']) {
    const rules = attempt(name);
    if (rules) return rules;
  }
  // The fixture is an explicit client fallback, including when static requests fail.
  const fallback = fallbackDay(day);
  if (fallback.seed === seed) return fallback;
  for (const name of files.datedFiles()) {
    if (name > `${day}.json`) continue;
    const rules = attempt(name);
    if (rules) return rules;
  }
  // Unknown seeds still pass through replay's complete authoritative-rule check.
  return preferred ?? fallback;
}
