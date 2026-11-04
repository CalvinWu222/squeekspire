import { exportRun, replayRun, type RunState, type RunExport } from './engine';
import type { RunMode } from './types';
import { SCORE_VERSION } from './score';

const PREFIX = 'squeekspire:v1:';
const memory = new Map<string, string>();
const dirty = new Set<string>();
let storageAvailable = true;

function read(key: string): string | null {
  if (dirty.has(key)) return memory.get(key) ?? null;
  try { return localStorage.getItem(PREFIX + key) ?? memory.get(key) ?? null; }
  catch { storageAvailable = false; return memory.get(key) ?? null; }
}

function write(key: string, value: unknown): void {
  const json = JSON.stringify(value);
  memory.set(key, json);
  try { localStorage.setItem(PREFIX + key, json); dirty.delete(key); }
  catch { storageAvailable = false; dirty.add(key); }
}

function parse<T>(key: string, fallback: T): T {
  try { const value = read(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}

function array<T>(key: string): T[] {
  const value = parse<unknown>(key, []);
  return Array.isArray(value) ? value as T[] : [];
}

export function hasPersistentStorage(): boolean { return storageAvailable; }

export function getProfile(): string {
  const saved = parse<string>('profile', '');
  if (/^guest\d{4,8}$/.test(saved)) return saved;
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const profile = `guest${1000 + random[0] % 9000}`;
  write('profile', profile);
  return profile;
}

export function dailyUsed(day: string): boolean {
  return array<string>('official-days').includes(day);
}

/** Claim at START: a loss, abandonment or reload does not grant another attempt. */
export function claimDaily(day: string): boolean {
  if (dailyUsed(day)) return false;
  const days = array<string>('official-days');
  write('official-days', [...new Set([...days, day])].sort());
  return true;
}

export function currentStreak(day: string): number {
  const days = new Set(array<string>('official-days'));
  let count = 0;
  const cursor = new Date(`${day}T00:00:00Z`);
  if (!days.has(day)) cursor.setUTCDate(cursor.getUTCDate() - 1);
  for (let i = 0; i < 3660; i++) {
    if (!days.has(cursor.toISOString().slice(0, 10))) break;
    count++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return count;
}

export function saveActive(run: RunState): void {
  write(`active:${run.mode}`, exportRun(run));
}

export function startEndlessClock(): void { write('endless-started', Date.now()); }

export function endlessElapsed(): number {
  const start = parse<unknown>('endless-started', Date.now());
  if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) return 0;
  return Math.min(300_000, Math.max(0, Date.now() - start));
}

export function loadActive(mode: RunMode): RunState | null {
  const exported = parse<RunExport | null>(`active:${mode}`, null);
  if (!exported) return null;
  try { return replayRun(exported); } catch { return null; }
}

export interface BoardEntry {
  id: string;
  profile: string;
  day: string;
  mode: RunMode;
  scoreVersion: number;
  score: number;
  bestHit: number;
  floor: number;
  won: boolean;
  hibernation: boolean;
  streak: number;
}

export function getBoard(mode: RunMode, day?: string): BoardEntry[] {
  const rows = array<BoardEntry>('board');
  return rows.filter(row => row && row.scoreVersion === SCORE_VERSION && row.mode === mode && (!day || row.day === day)
    && Number.isFinite(row.score) && Number.isFinite(row.bestHit)
    && typeof row.profile === 'string' && (/^guest\d+$/.test(row.profile) || /^0x[0-9a-fA-F]{40}$/.test(row.profile)))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

/** Recompute from choices before admitting a result to this browser's board. */
export function recordResult(run: RunState, profile: string): BoardEntry {
  const verified = replayRun(exportRun(run));
  if (!['won', 'lost'].includes(verified.phase)) throw new Error('Finish the run before recording it.');
  const id = `${profile}:${verified.day.day}:${verified.mode}:v${SCORE_VERSION}:${JSON.stringify(verified.log)}`;
  const rows = array<BoardEntry>('board').filter(row => row && row.scoreVersion === SCORE_VERSION);
  const entry: BoardEntry = {
    id, profile, day: verified.day.day, mode: verified.mode, scoreVersion: SCORE_VERSION,
    score: verified.totalScore, bestHit: verified.bestHit, floor: verified.floor,
    won: verified.phase === 'won', hibernation: verified.day.hibernation,
    streak: currentStreak(verified.day.day),
  };
  const retained = rows.filter(row => row.id !== id);
  if (entry.mode === 'daily') {
    const existing = retained.find(row => row.mode === 'daily' && row.day === entry.day && row.profile === profile);
    if (existing) return existing;
  }
  write('board', [...retained, entry].slice(-200));
  return entry;
}
