import type { RunMode } from '../src/game/types.js';
import { SCORE_VERSION } from '../src/game/score.js';
import { localFile } from './local-file.mjs';

export interface ScoreEntry {
  id: string; profile: string; name: string; walletAddress?: string; guestId?: string;
  day: string; seed: number; mode: RunMode; scoreVersion: number; score: number; bestHit: number;
  floor: number; floors: number; actions: number; won: boolean; hibernation: boolean;
  spinning: boolean; streak: number; createdAt: string; deckTheme?: string;
}
export interface BoardQuery { mode: 'daily' | 'all'; seed?: number; runMode?: RunMode; }
export interface ScoreStore {
  kind: 'local' | 'redis';
  add(entry: ScoreEntry): Promise<ScoreEntry>;
  list(query: BoardQuery): Promise<ScoreEntry[]>;
  rateLimit(key: string, limit: number, windowMs: number, now: number): Promise<{ allowed: boolean; retryAfter: number }>;
}
export type Environment = Record<string, string | undefined>;
// Separate indices and entries make the scoring reset atomic: an old high score
// can never occupy a current-version rank or deduplicate a new submission.
const PREFIX = `squeekspire:score-v${SCORE_VERSION}:`;
const EXPIRY = 90 * 24 * 60 * 60;

export function createMemoryStore(file?: ReturnType<typeof localFile>): ScoreStore {
  const entries = new Map<string, ScoreEntry>();
  const buckets = new Map<string, { count: number; expires: number }>();
  let loaded: Promise<void> | undefined;
  let writing = Promise.resolve();
  function load() {
    return loaded ??= (async () => {
      if (!file) return;
      const rows = await file.read();
      if (!Array.isArray(rows)) throw new Error('Invalid local leaderboard store');
      for (const row of rows.slice(-5_000)) if (row && row.scoreVersion === SCORE_VERSION && typeof row.id === 'string' && Number.isFinite(row.score)) entries.set(row.id, row as ScoreEntry);
    })();
  }
  return {
    kind: 'local',
    async add(entry) {
      if (entry.scoreVersion !== SCORE_VERSION) throw new Error('Unsupported score version');
      await load();
      const previous = entries.get(entry.id);
      if (previous) return previous;
      entries.set(entry.id, structuredClone(entry));
      if (entries.size > 5_000) entries.delete(entries.keys().next().value!);
      if (file) {
        const snapshot = [...entries.values()];
        writing = writing.catch(() => {}).then(() => file.write(snapshot));
        try { await writing; } catch (error) { entries.delete(entry.id); throw error; }
      }
      return entry;
    },
    async list(query) {
      await load();
      return [...entries.values()]
        .filter(entry => entry.scoreVersion === SCORE_VERSION && (query.mode !== 'daily' || entry.seed === query.seed) && (!query.runMode || entry.mode === query.runMode))
        .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .slice(0, 50).map(entry => structuredClone(entry));
    },
    async rateLimit(key, limit, windowMs, now) {
      if (buckets.size >= 10_000) for (const [id, bucket] of buckets) if (bucket.expires <= now) buckets.delete(id);
      if (buckets.size >= 10_000 && !buckets.has(key)) buckets.delete(buckets.keys().next().value!);
      let bucket = buckets.get(key);
      if (!bucket || bucket.expires <= now) { bucket = { count: 0, expires: now + windowMs }; buckets.set(key, bucket); }
      bucket.count++;
      return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.expires - now) / 1000)) };
    },
  };
}

const ADD_SCRIPT = `
local previous = redis.call('GET', KEYS[1])
if previous then return previous end
redis.call('SET', KEYS[1], ARGV[1])
for i = 2, #KEYS do
  redis.call('ZADD', KEYS[i], ARGV[3], ARGV[2])
  redis.call('ZREMRANGEBYRANK', KEYS[i], 0, -501)
  if i >= 4 then redis.call('EXPIRE', KEYS[i], ARGV[4]) end
end
return ARGV[1]`;
const RATE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('PTTL', KEYS[1])}`;

export function createRedisStore(url: string, token: string, fetcher: typeof fetch = fetch): ScoreStore {
  const base = new URL(url);
  if (base.protocol !== 'https:') throw new Error('Redis REST URL must use HTTPS');
  base.search = ''; base.hash = '';
  const endpoint = base.toString().replace(/\/$/, '');
  async function request(command: unknown[]): Promise<unknown> {
    const response = await fetcher(endpoint, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command), signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error('Redis REST unavailable');
    const json: unknown = await response.json();
    if (!json || typeof json !== 'object' || 'error' in json || !('result' in json)) throw new Error('Invalid Redis REST response');
    return (json as { result: unknown }).result;
  }
  function boardKey(query: BoardQuery) { return PREFIX + (query.mode === 'daily' ? `seed:${query.seed}` : 'all') + (query.runMode ? `:${query.runMode}` : ''); }
  return {
    kind: 'redis',
    async add(entry) {
      if (entry.scoreVersion !== SCORE_VERSION) throw new Error('Unsupported score version');
      const keys = [PREFIX + `entry:${entry.id}`, PREFIX + 'all', PREFIX + `all:${entry.mode}`, PREFIX + `seed:${entry.seed}`, PREFIX + `seed:${entry.seed}:${entry.mode}`];
      const saved = await request(['EVAL', ADD_SCRIPT, keys.length, ...keys, JSON.stringify(entry), entry.id, entry.score, EXPIRY]);
      if (typeof saved !== 'string') throw new Error('Invalid stored score');
      return JSON.parse(saved) as ScoreEntry;
    },
    async list(query) {
      const ids = await request(['ZREVRANGE', boardKey(query), 0, 49]);
      if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) throw new Error('Invalid leaderboard index');
      if (!ids.length) return [];
      // Entry metadata has no expiry. Fetch the top fifty in one Redis command.
      const values = await request(['MGET', ...ids.map(id => PREFIX + `entry:${id}`)]);
      if (!Array.isArray(values)) throw new Error('Invalid leaderboard entries');
      return values.filter(value => typeof value === 'string').map(value => JSON.parse(value as string) as ScoreEntry)
        .filter(entry => entry?.scoreVersion === SCORE_VERSION).slice(0, 50);
    },
    async rateLimit(key, limit, windowMs) {
      const result = await request(['EVAL', RATE_SCRIPT, 1, PREFIX + `rate:${key}`, windowMs]);
      if (!Array.isArray(result) || result.length !== 2 || !result.every(value => typeof value === 'number')) throw new Error('Invalid rate limit response');
      return { allowed: result[0] <= limit, retryAfter: Math.max(1, Math.ceil(result[1] / 1000)) };
    },
  };
}

export function createStore(env: Environment): ScoreStore {
  // A credential pair must come entirely from one provider.
  const primary = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN;
  const url = primary ? env.UPSTASH_REDIS_REST_URL : env.KV_REST_API_URL;
  const token = primary ? env.UPSTASH_REDIS_REST_TOKEN : env.KV_REST_API_TOKEN;
  if (url && token) return createRedisStore(url, token);
  if (env.UPSTASH_REDIS_REST_URL || env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_URL || env.KV_REST_API_TOKEN || env.VERCEL === '1') throw new Error('Shared leaderboard Redis credentials are missing or incomplete');
  return createMemoryStore(localFile(env.SQUEEKSPIRE_SCORE_FILE ?? '.tmp/leaderboard.json'));
}
