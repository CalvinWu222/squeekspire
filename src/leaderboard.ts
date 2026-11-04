import { exportRun, type RunState } from './game/engine';
import type { BoardEntry } from './game/storage';
import type { RunMode } from './game/types';
import { SCORE_VERSION } from './game/score';

export interface GlobalEntry extends BoardEntry { seed: number; name?: string; deckTheme?: string; }
export interface LeaderboardOverview {
  today: { day: string; seed: number; entries: GlobalEntry[] };
  champions: { day: string; seed: number; entry: GlobalEntry | null }[];
  allTime: GlobalEntry[];
  storage: 'local' | 'redis';
  scoreVersion: number;
}

/** Same-origin only: credentials and the Redis URL never enter the client bundle. */
async function request(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(path, { ...init, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Leaderboard API returned ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}

function isEntry(value: unknown): value is GlobalEntry {
  if (!value || typeof value !== 'object') return false;
  const row = value as GlobalEntry;
  return row.scoreVersion === SCORE_VERSION && typeof row.id === 'string' && typeof row.profile === 'string'
    && (/^guest\d{4,8}$/.test(row.profile) || /^0x[0-9a-fA-F]{40}$/.test(row.profile))
    && /^\d{4}-\d{2}-\d{2}$/.test(row.day) && ['daily', 'practice', 'endless'].includes(row.mode)
    && [row.seed, row.score, row.bestHit, row.floor].every(n => Number.isFinite(n) && n >= 0)
    && typeof row.won === 'boolean' && typeof row.hibernation === 'boolean'
    && (row.name === undefined || (typeof row.name === 'string' && row.name.length <= 80))
    && (row.deckTheme === undefined || (typeof row.deckTheme === 'string' && row.deckTheme.length <= 40));
}

export async function fetchLeaderboardOverview(): Promise<LeaderboardOverview> {
  const data = await request('/api/leaderboard?view=overview') as LeaderboardOverview | null;
  const validDay = (value: unknown): value is { day: string; seed: number } => !!value && typeof value === 'object'
    && /^\d{4}-\d{2}-\d{2}$/.test((value as { day: string }).day)
    && Number.isInteger((value as { seed: number }).seed) && (value as { seed: number }).seed >= 0 && (value as { seed: number }).seed <= 0xffff_ffff;
  const dailyEntry = (entry: GlobalEntry, day: { day: string; seed: number }) => isEntry(entry)
    && entry.mode === 'daily' && entry.day === day.day && entry.seed === day.seed;
  if (!data || data.scoreVersion !== SCORE_VERSION || !['local', 'redis'].includes(data.storage)
    || !validDay(data.today) || !Array.isArray(data.today.entries) || data.today.entries.length > 50
    || !data.today.entries.every(entry => dailyEntry(entry, data.today))
    || !Array.isArray(data.champions) || data.champions.length !== 7
    || !data.champions.every(day => validDay(day) && (day.entry === null || dailyEntry(day.entry, day)))
    || !Array.isArray(data.allTime) || data.allTime.length > 50 || !data.allTime.every(isEntry)) {
    throw new Error('Invalid leaderboard response');
  }
  return data;
}

export async function fetchLeaderboard(mode: RunMode, seed: number): Promise<GlobalEntry[]> {
  const params = new URLSearchParams({ mode: mode === 'endless' ? 'all' : 'daily', runMode: mode });
  if (mode !== 'endless') params.set('seed', String(seed));
  const data = await request(`/api/leaderboard?${params}`) as { entries?: unknown } | null;
  if (!data || !Array.isArray(data.entries)) throw new Error('Invalid leaderboard response');
  const entries = data.entries.filter(row => row && typeof row === 'object' && row.scoreVersion === SCORE_VERSION);
  if (!entries.every(isEntry)) throw new Error('Invalid leaderboard response');
  return entries.filter(row => row.mode === mode && (mode === 'endless' || row.seed === seed)).slice(0, 50);
}

export async function submitScore(run: RunState, profile: string): Promise<void> {
  await request('/api/score', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: run.day.seed, run: exportRun(run), identity: profile.startsWith('0x')
      ? { walletAddress: profile } : { guestId: profile } }),
  });
}
