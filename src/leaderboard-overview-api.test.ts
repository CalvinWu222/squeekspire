import { describe, expect, it, vi } from 'vitest';
import { createApi, type ApiResponse } from '../server/api';
import { createMemoryStore, createRedisStore, type ScoreEntry } from '../server/store';
import { fallbackDay } from './game/data';
import { SCORE_VERSION } from './game/score';
import { act, createRun, exportRun } from './game/engine';
import { generateMap } from './game/map';
import { deckTheme } from './game/deckTheme';

const today = fallbackDay('2026-11-04');
const yesterday = fallbackDay('2026-11-03');
const row = (id: string, score: number, day = today): ScoreEntry => ({
  id, profile: 'guest1234', name: 'guest1234', day: day.day, seed: day.seed, mode: 'daily', scoreVersion: SCORE_VERSION,
  score, bestHit: score, floor: 2, floors: 2, actions: 10, won: false, hibernation: false, spinning: false,
  streak: 0, createdAt: `${day.day}T00:00:00.000Z`,
});
async function call(handler: ReturnType<typeof createApi>, url = '/api/leaderboard?view=overview', body?: unknown) {
  let text = '';
  const response: ApiResponse = { statusCode: 0, setHeader() {}, end(value) { text = value ?? ''; } };
  await handler({ method: body ? 'POST' : 'GET', url, headers: { 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' }, ...(body ? { body } : {}) }, response);
  return { status: response.statusCode, body: JSON.parse(text) };
}

describe('read-only leaderboard overview', () => {
  it('finds daily champions outside all-time top fifty and reports empty days without inventing scores', async () => {
    const store = createMemoryStore();
    for (let i = 0; i < 60; i++) await store.add(row(`today-${i}`, 1000 + i));
    const champion = row('yesterday', 5, yesterday);
    await store.add(champion);
    const handler = createApi({ store, now: () => Date.parse('2026-11-04T12:00:00Z'), resolveBoardDay: fallbackDay });
    const result = await call(handler);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ scoreVersion: SCORE_VERSION, storage: 'local', today: { day: today.day, seed: today.seed } });
    expect(result.body.today.entries).toHaveLength(50);
    expect(result.body.champions).toHaveLength(7);
    expect(result.body.champions[0]).toEqual({ day: yesterday.day, seed: yesterday.seed, entry: champion });
    expect(result.body.champions[1].entry).toBeNull();
    expect(result.body.allTime).toHaveLength(50);
    expect(result.body.allTime.some((entry: ScoreEntry) => entry.id === champion.id)).toBe(false);
    expect(result.body.champions[0].entry.deckTheme).toBeUndefined();
  });

  it('keeps practice and other dates off daily ranks, while all-time retains every existing mode', async () => {
    const store = createMemoryStore();
    await store.add({ ...row('practice', 10000), mode: 'practice' });
    await store.add({ ...row('endless', 5000), mode: 'endless' });
    await store.add({ ...row('wrong-date', 9000), day: yesterday.day });
    await store.add(row('today', 10));
    const result = await call(createApi({ store, now: () => Date.parse('2026-11-04T00:00:00Z'), resolveBoardDay: fallbackDay }));
    expect(result.body.today.entries.map((entry: ScoreEntry) => entry.id)).toEqual(['today']);
    expect(result.body.allTime.map((entry: ScoreEntry) => entry.mode)).toContain('practice');
    expect(result.body.allTime.map((entry: ScoreEntry) => entry.mode)).toContain('endless');
  });

  it('uses UTC rollover and bounded individual seed queries in Redis, including empty historic indexes', async () => {
    const commands: unknown[][] = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(String(init?.body)) as unknown[];
      commands.push(command);
      return new Response(JSON.stringify({ result: command[0] === 'EVAL' ? [1, 60_000] : [] }));
    });
    const store = createRedisStore('https://redis.example', 'test-secret', fetcher as typeof fetch);
    const result = await call(createApi({ store, now: () => Date.parse('2026-11-04T00:00:00+08:00'), resolveBoardDay: fallbackDay }));
    expect(result.status).toBe(200);
    expect(result.body.today.day).toBe('2026-11-03');
    expect(result.body.storage).toBe('redis');
    const reads = commands.filter(command => command[0] === 'ZREVRANGE');
    expect(reads).toHaveLength(9);
    expect(reads).toContainEqual(['ZREVRANGE', `squeekspire:score-v${SCORE_VERSION}:seed:${yesterday.seed}:daily`, 0, 49]);
    expect(reads).toContainEqual(['ZREVRANGE', `squeekspire:score-v${SCORE_VERSION}:all`, 0, 49]);
  });

  it('ignores claimed theme metadata and derives a new score theme from the authoritative replay deck', async () => {
    const store = createMemoryStore();
    const run = exportRun(act(createRun(today, generateMap(today), 'daily'), { type: 'abandon' }));
    const result = await call(createApi({ store }), '/api/score', {
      seed: today.seed, run, identity: { guestId: 'guest1234' }, deckTheme: '<script>fake power deck</script>',
    });
    expect(result.status).toBe(201);
    expect(result.body.entry.deckTheme).toBe('Starter Wheel');
  });

  it('rejects unknown overview views and fails closed when a board query fails', async () => {
    const store = createMemoryStore();
    const handler = createApi({ store });
    expect((await call(handler, '/api/leaderboard?view=private')).status).toBe(400);
    store.list = async () => { throw new Error('secret connection detail'); };
    const unavailable = await call(handler);
    expect(unavailable.status).toBe(503);
    expect(JSON.stringify(unavailable.body)).not.toContain('secret');
  });
});

describe('final deck themes', () => {
  it('recognizes the deck additions and has a stable fallback for uncategorized cards', () => {
    expect(deckTheme([{ id: 'wheel-kick' }, { id: 'maus-mode' }, { id: 'tail-whip' }])).toBe('Zero-Cost Zoomies');
    expect(deckTheme([{ id: 'rolling-median' }, { id: 'burrow' }])).toBe('Burrow Guard');
    expect(deckTheme([{ id: 'buildooooor' }])).toBe('Mixed Seeds');
  });
});
