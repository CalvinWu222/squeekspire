import { exportRun, type RunState } from './game/engine';
import type { BoardEntry } from './game/storage';
import type { RunMode } from './game/types';

export interface GlobalEntry extends BoardEntry { seed: number; }

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
  return typeof row.id === 'string' && typeof row.profile === 'string'
    && (/^guest\d{4,8}$/.test(row.profile) || /^0x[0-9a-fA-F]{40}$/.test(row.profile))
    && /^\d{4}-\d{2}-\d{2}$/.test(row.day) && ['daily', 'practice', 'endless'].includes(row.mode)
    && [row.seed, row.score, row.bestHit, row.floor].every(n => Number.isFinite(n) && n >= 0)
    && typeof row.won === 'boolean' && typeof row.hibernation === 'boolean';
}

export async function fetchLeaderboard(mode: RunMode, seed: number): Promise<GlobalEntry[]> {
  const params = new URLSearchParams({ mode: mode === 'endless' ? 'all' : 'daily', runMode: mode });
  if (mode !== 'endless') params.set('seed', String(seed));
  const data = await request(`/api/leaderboard?${params}`) as { entries?: unknown } | null;
  if (!data || !Array.isArray(data.entries) || !data.entries.every(isEntry)) throw new Error('Invalid leaderboard response');
  return data.entries.filter(row => row.mode === mode && (mode === 'endless' || row.seed === seed)).slice(0, 50);
}

export async function submitScore(run: RunState, profile: string): Promise<void> {
  await request('/api/score', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed: run.day.seed, run: exportRun(run), identity: profile.startsWith('0x')
      ? { walletAddress: profile } : { guestId: profile } }),
  });
}
