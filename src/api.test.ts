import { describe, expect, it, vi } from 'vitest';
import { createApi, GET_RATE_LIMIT, MAX_BODY_BYTES, POST_RATE_LIMIT, sanitizeName, type ApiRequest, type ApiResponse } from '../server/api';
import { createMemoryStore, createRedisStore, createStore, type ScoreEntry, type ScoreStore } from '../server/store';
import { MAX_ACTIONS, verifySubmission } from '../server/replay';
import { act, createRun, exportRun, replayRun, type RunAction, type RunExport } from './game/engine';
import { fallbackDay, getGameDay } from './game/data';
import { generateMap } from './game/map';
import { CARDS } from './game/catalog';
import { hashString } from './game/rng';
import type { RunMode } from './game/types';
import { SCORE_VERSION } from './game/score';
import { cardPlayDisabledReason } from './game/cardValues';

const day = fallbackDay('2026-11-04');
function finished(mode: RunMode = 'daily', spinning = false, gameDay = day): RunExport {
  const rules = { ...gameDay, spinning };
  let run = createRun(rules, generateMap(rules), mode);
  for (let i = 0; i < 24 && run.phase !== 'combat'; i++) {
    run = act(run, { type: 'enter', nodeId: run.reachable[0]! });
    if (run.phase !== 'combat') run = act(run, { type: 'leave' });
  }
  for (let i = 0; i < 200 && run.phase === 'combat'; i++) {
    const combat = run.combat!;
    const playable = combat.hand.filter(card => CARDS[card.id]!.cost !== 'X' && (CARDS[card.id]!.cost as number) <= combat.energy);
    const card = playable.find(card => CARDS[card.id]!.type === 'attack') ?? playable[0];
    run = act(run, card ? { type: 'play', uid: card.uid } : { type: 'endTurn' });
  }
  if (run.phase !== 'won' && run.phase !== 'lost') run = act(run, { type: 'abandon' });
  return exportRun(run);
}
const validRun = finished();
function resign(input: RunExport, updates: Partial<RunExport>): RunExport {
  const { checksum: _checksum, ...body } = { ...input, ...updates };
  return { ...body, checksum: hashString(JSON.stringify(body)).toString(16).padStart(8, '0') };
}
const payload = (run = validRun) => ({ seed: run.day.seed, run, identity: { guestId: 'guest1234' } });
async function call(handler: ReturnType<typeof createApi>, body?: unknown, overrides: Partial<ApiRequest> = {}) {
  const request: ApiRequest = { method: body === undefined ? 'GET' : 'POST', url: body === undefined ? `/api/leaderboard?mode=daily&seed=${day.seed}` : '/api/score', headers: { 'content-type': 'application/json' }, socket: { remoteAddress: '127.0.0.1' }, ...(body === undefined ? {} : { body }), ...overrides };
  const headers: Record<string, string> = {};
  let text = '';
  const response: ApiResponse = { statusCode: 0, setHeader(name, value) { headers[name] = value; }, end(value) { text = value ?? ''; } };
  await handler(request, response);
  return { status: response.statusCode, headers, body: JSON.parse(text) };
}
const api = () => createApi({ store: createMemoryStore() });

describe('shared score API boundary', () => {
  it('accepts a completed replay and returns its recomputed score on the seed leaderboard', async () => {
    const handler = api();
    const accepted = await call(handler, payload());
    expect(accepted.status).toBe(201);
    expect(accepted.body.entry).toMatchObject({ profile: 'guest1234', scoreVersion: SCORE_VERSION, score: validRun.claimedScore, bestHit: validRun.claimedBestHit, seed: day.seed, mode: 'daily' });
    expect(accepted.body.scoreVersion).toBe(SCORE_VERSION);
    expect(accepted.body.entry.score).toBeGreaterThan(0);
    expect((await call(handler)).body.entries).toEqual([accepted.body.entry]);
    expect((await call(handler)).body.scoreVersion).toBe(SCORE_VERSION);
    expect((await call(handler, undefined, { url: `/api/leaderboard?mode=daily&seed=${day.seed + 1}` })).body.entries).toEqual([]);
  });
  it.each([
    ['2026-11-04T00:00:00+08:00', '2026-11-03'],
    ['2026-11-03T23:59:59.999Z', '2026-11-03'],
    ['2026-11-04T00:00:00.000Z', '2026-11-04'],
    ['2026-11-04T03:59:59.999Z', '2026-11-04'],
    ['2026-11-04T04:00:00.000Z', '2026-11-04'],
  ])('uses the UTC run day and seed in the API at %s', async (instant, expectedDay) => {
    const now = new Date(instant);
    const expected = fallbackDay(expectedDay);
    const run = finished('daily', false, fallbackDay(getGameDay(now)));
    const handler = createApi({ store: createMemoryStore(), now: () => now.getTime() });
    const accepted = await call(handler, payload(run));
    expect(accepted.status).toBe(201);
    expect(accepted.body.entry).toMatchObject({ day: expectedDay, seed: expected.seed, createdAt: now.toISOString() });
    const board = await call(handler, undefined, { url: `/api/leaderboard?mode=daily&seed=${expected.seed}` });
    expect(board.body.entries).toEqual([accepted.body.entry]);
    const otherDay = fallbackDay(expectedDay === '2026-11-03' ? '2026-11-04' : '2026-11-03');
    expect((await call(handler, undefined, { url: `/api/leaderboard?mode=daily&seed=${otherDay.seed}` })).body.entries).toEqual([]);
  });
  it('keeps equivalent UTC instants on the same daily board and accepts a run after UTC rollover', async () => {
    const instants = ['2026-11-04T01:00:00Z', '2026-11-04T09:00:00+08:00', '2026-11-03T18:00:00-07:00'];
    const rules = instants.map(instant => fallbackDay(getGameDay(new Date(instant))));
    expect(rules.every(rule => rule.day === '2026-11-04' && rule.seed === day.seed)).toBe(true);
    const handler = createApi({ store: createMemoryStore(), now: () => Date.parse('2026-11-05T00:00:01Z') });
    const accepted = await call(handler, payload(finished('daily', false, rules[0]!)));
    expect(accepted.status).toBe(201);
    expect(accepted.body.entry).toMatchObject({ day: '2026-11-04', seed: day.seed });
    expect((await call(handler)).body.entries).toEqual([accepted.body.entry]);
    const nextDay = fallbackDay('2026-11-05');
    expect((await call(handler, undefined, { url: `/api/leaderboard?mode=daily&seed=${nextDay.seed}` })).body.entries).toEqual([]);
  });
  it('deduplicates retries and derives wallet display identity from the address', async () => {
    const handler = api();
    const submission = { ...payload(), identity: { walletAddress: '0x' + 'Ab'.repeat(20) }, name: '<script>fake</script>' };
    const first = await call(handler, submission), second = await call(handler, submission);
    expect(first.body.entry).toEqual(second.body.entry);
    expect(first.body.entry.profile).toBe('0x' + 'ab'.repeat(20));
    expect(first.body.entry.name).toBe('0xabab…abab');
    expect((await call(handler)).body.entries).toHaveLength(1);
  });
  it('deduplicates equivalent replays despite changed metadata or action property order', async () => {
    const handler = api();
    const reordered = validRun.actions.map(action => Object.fromEntries(Object.entries(action).reverse())) as RunExport['actions'];
    const equivalent = resign(validRun, { day: { ...day, source: 'live', notice: 'Different public availability text' }, actions: reordered });
    const first = await call(handler, payload()), second = await call(handler, payload(equivalent));
    expect(second.status).toBe(201);
    expect(second.body.entry.id).toBe(first.body.entry.id);
    expect((await call(handler)).body.entries).toHaveLength(1);
  });
  it.each(['daily', 'practice', 'endless'] as const)('accepts signed pre-UTC hour labels for archived %s runs', async mode => {
    const legacyDay = { ...day, hours: day.hours.map(hour => ({
      ...hour, label: `${String((parseInt(hour.label, 10) + 8) % 24).padStart(2, '0')}:00`,
    })) };
    const legacyRun = finished(mode, mode === 'practice', legacyDay);
    const handler = api();
    const accepted = await call(handler, payload(legacyRun));
    expect(accepted.status).toBe(201);
    expect(accepted.body.entry).toMatchObject({ day: day.day, seed: day.seed, mode, score: legacyRun.claimedScore });
    const canonical = await call(handler, payload(finished(mode, mode === 'practice')));
    expect(canonical.status).toBe(201);
    expect(canonical.body.entry).toEqual(accepted.body.entry);
  });
  it.each(['hour', 'work', 'settlements', 'activeRounds', 'blocks'] as const)('still rejects changed hourly %s with valid checksums', async field => {
    const hours = day.hours.map(hour => ({ ...hour }));
    hours[0]![field]++;
    const changed = resign(validRun, { day: { ...day, hours } });
    const rejected = await call(api(), payload(changed));
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toContain('authoritative daily snapshot');
  });
  it('still checks the original checksum before accepting display label changes', async () => {
    const changed = { ...validRun, day: { ...day, hours: day.hours.map(hour => ({ ...hour, label: 'changed' })) } };
    const rejected = await call(api(), payload(changed));
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toContain('checksum');
  });
  it('sanitizes guest names and rejects malformed explicit wallet addresses', async () => {
    expect(sanitizeName('<b>guest1234</b>\u202e\n')).toBe('guest1234');
    const handler = api();
    const accepted = await call(handler, { ...payload(), identity: { guestId: '<b>guest1234</b>' } });
    expect(accepted.body.entry.name).toBe('guest1234');
    expect((await call(handler, { ...payload(), identity: { walletAddress: 'bad' } })).status).toBe(400);
  });
  it('keeps live practice results separate from daily and supports all-time endless queries', async () => {
    const handler = api();
    await call(handler, payload(finished('practice', true)));
    await call(handler, payload(finished('endless')));
    expect((await call(handler)).body.entries).toHaveLength(0);
    const practice = await call(handler, undefined, { url: `/api/leaderboard?mode=daily&seed=${day.seed}&runMode=practice` });
    expect(practice.body.entries).toHaveLength(1);
    expect(practice.body.entries[0]).toMatchObject({ mode: 'practice', spinning: true });
    expect((await call(handler, undefined, { url: '/api/leaderboard?mode=all&runMode=endless' })).body.entries[0].mode).toBe('endless');
  });
  it('serves the all-time leaderboard at the bare endpoint while explicit daily queries require a seed', async () => {
    const handler = api();
    await call(handler, payload());
    await call(handler, payload(finished('practice', true)));
    const result = await call(handler, undefined, { url: '/api/leaderboard' });
    expect(result.status).toBe(200);
    expect(result.body.mode).toBe('all');
    expect(result.body.entries).toHaveLength(2);
    expect(result.body.entries.map((entry: ScoreEntry) => entry.mode).sort()).toEqual(['daily', 'practice']);
    expect((await call(handler, undefined, { url: '/api/leaderboard?mode=daily' })).status).toBe(400);
  });
  it('rejects tampered claims even with a newly computed transport checksum', async () => {
    const tampered = resign(validRun, { claimedScore: validRun.claimedScore + 1 });
    const result = await call(api(), payload(tampered));
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: 'invalid_replay' });
    expect(result.body.message).toContain('Recomputed score');
  });
  it.each([undefined, SCORE_VERSION - 1, SCORE_VERSION + 1])('rejects old or unknown score version %s before storing it', async scoreVersion => {
    const handler = api();
    const old = resign(validRun, { scoreVersion } as Partial<RunExport>);
    const rejected = await call(handler, payload(old));
    expect(rejected.status).toBe(400);
    expect(rejected.body).toMatchObject({ error: 'invalid_replay' });
    expect(rejected.body.message).toContain('score version');
    expect((await call(handler)).body.entries).toEqual([]);
  });
  it.each(['daily', 'practice', 'endless'] as const)('shares the client score, best hit and finish state for %s replay', async mode => {
    const exported = finished(mode, mode === 'practice');
    const client = replayRun(exported);
    const server = verifySubmission(exported, exported.day.seed);
    expect(server).toMatchObject({ scoreVersion: SCORE_VERSION, score: client.totalScore,
      bestHit: client.bestHit, floor: client.floor, won: client.phase === 'won' });
    expect(server.score).toBe(exported.claimedScore);
  });
  it('accepts the client replay after buying the fifth shop offer', async () => {
    // Use an unmodified canonical run, retain Gold in the first shop, and buy
    // the second relic when a later shop becomes affordable.
    const rules = fallbackDay('2026-01-01');
    let client = createRun(rules, generateMap(rules), 'daily');
    let purchased = false;
    for (let step = 0; step < 400 && !['won', 'lost'].includes(client.phase); step++) {
      let action: RunAction;
      if (client.phase === 'map') action = { type: 'enter', nodeId: client.reachable[0]! };
      else if (client.phase === 'combat') {
        const available = client.combat!.hand.filter(card => !cardPlayDisabledReason(client, card));
        const card = available.find(card => CARDS[card.id]!.type === 'attack') ?? available[0];
        action = card ? { type: 'play', uid: card.uid } : { type: 'endTurn' };
      } else if (client.phase === 'reward') action = { type: 'reward', cardId: null };
      else if (client.phase === 'event') action = { type: 'event', option: 1 };
      else if (client.phase === 'rest') action = { type: 'rest', option: 'heal' };
      else {
        const offer = client.shop!.offers[4];
        if (offer && offer.price <= client.gold) {
          expect(offer.kind).toBe('relic');
          const bought = act(client, { type: 'buy', index: 4 });
          expect(bought.relics).toContain(offer.id);
          expect(bought.gold).toBe(client.gold - offer.price);
          client = act(bought, { type: 'abandon' });
          purchased = true;
          break;
        }
        action = { type: 'leave' };
      }
      client = act(client, action);
    }
    expect(purchased).toBe(true);
    const exported = exportRun(client);
    expect(exported.actions.at(-2)).toEqual({ type: 'buy', index: 4 });
    const accepted = await call(api(), payload(exported));
    expect(accepted.status).toBe(201);
    expect(accepted.body.entry).toMatchObject({ scoreVersion: SCORE_VERSION,
      score: client.totalScore, bestHit: client.bestHit, floor: client.floor });
  });
  it('filters old-version rows at the API boundary even for a mixed backing store', async () => {
    const store = createMemoryStore();
    const old = { ...sampleEntry('old', 1e100), scoreVersion: SCORE_VERSION - 1 };
    const current = sampleEntry('current');
    store.list = async () => [old, current];
    const result = await call(createApi({ store }));
    expect(result.status).toBe(200);
    expect(result.body.entries).toEqual([current]);
  });
  it('rejects forged canonical rules, mismatched seed, and illegal action logs', async () => {
    const handler = api();
    const changed = resign(validRun, { day: { ...validRun.day, difficulty: 0.8 } });
    expect((await call(handler, payload(changed))).status).toBe(400);
    expect((await call(handler, { ...payload(), seed: day.seed + 1 })).status).toBe(400);
    const illegal = resign(validRun, { actions: [{ type: 'enter', nodeId: 23 }, { type: 'abandon' }] });
    expect((await call(handler, payload(illegal))).status).toBe(400);
  });
  it('limits expensive POSTs per IP, provides Retry-After, and opens the next window', async () => {
    let now = 0;
    const handler = createApi({ store: createMemoryStore(), now: () => now });
    for (let i = 0; i < POST_RATE_LIMIT; i++) expect((await call(handler, payload())).status).toBe(201);
    const denied = await call(handler, payload());
    expect(denied.status).toBe(429);
    expect(denied.headers['Retry-After']).toBe('60');
    expect((await call(handler, payload(), { headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.1', 'x-real-ip': '203.0.113.2' } })).status).toBe(429);
    expect((await call(handler)).status).toBe(200);
    expect((await call(handler, payload(), { socket: { remoteAddress: '127.0.0.2' } })).status).toBe(201);
    now = 60_001;
    expect((await call(handler, payload())).status).toBe(201);
  });
  it('also rate limits public GET requests', async () => {
    const handler = api();
    for (let i = 0; i < GET_RATE_LIMIT; i++) expect((await call(handler)).status).toBe(200);
    expect((await call(handler)).status).toBe(429);
  });
  it('enforces payload byte limits for declared, parsed, and streaming request bodies', async () => {
    const large = 'x'.repeat(MAX_BODY_BYTES + 1);
    expect((await call(api(), payload(), { headers: { 'content-type': 'application/json', 'content-length': String(MAX_BODY_BYTES + 1) } })).status).toBe(413);
    expect((await call(api(), { extra: large })).status).toBe(413);
    const streaming: Partial<ApiRequest> = { body: undefined, async *[Symbol.asyncIterator]() { yield new TextEncoder().encode(large); } };
    expect((await call(api(), payload(), streaming)).status).toBe(413);
  });
  it('returns clear errors for malformed JSON, wrong methods, media types and invalid queries', async () => {
    const handler = api();
    expect((await call(handler, '{')).status).toBe(400);
    expect((await call(handler, payload(), { headers: { 'content-type': 'text/plain' } })).status).toBe(415);
    const wrong = await call(handler, undefined, { url: '/api/score' });
    expect(wrong.status).toBe(405); expect(wrong.headers.Allow).toBe('POST');
    for (const url of ['/api/leaderboard?mode=bad', '/api/leaderboard?mode=daily', '/api/leaderboard?mode=all&runMode=bad', '/api/leaderboard?mode=daily&seed=-1']) expect((await call(handler, undefined, { url })).status).toBe(400);
  });
  it('fails closed when Redis is configured but unavailable or missing in production', async () => {
    expect((await call(createApi({ env: { VERCEL: '1' } }))).status).toBe(503);
    const store = createMemoryStore();
    store.list = async () => { throw new Error('private connection detail'); };
    const result = await call(createApi({ store }));
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain('private connection');
  });
});

describe('server replay limits', () => {
  it('requires a finished run and bounded, typed action fields before replay', () => {
    const ongoing = exportRun(createRun(day, generateMap(day), 'daily'));
    expect(() => verifySubmission(ongoing)).toThrow('log length');
    const afterEnter = resign(ongoing, { actions: [{ type: 'enter', nodeId: 0 }] });
    expect(() => verifySubmission(afterEnter)).toThrow('finished');
    expect(() => verifySubmission(resign(validRun, { actions: Array.from({ length: MAX_ACTIONS + 1 }, () => ({ type: 'endTurn' as const })) }))).toThrow('log length');
    expect(() => verifySubmission(resign(validRun, { actions: [{ type: 'buy', index: 1.5 }] }))).toThrow('shop index');
    expect(() => verifySubmission(resign(validRun, { actions: [{ type: 'buy', index: 5 }] }))).toThrow('shop index');
    expect(() => verifySubmission(resign(validRun, { actions: [{ type: 'abandon', extra: true } as never] }))).toThrow('Unknown action field');
  });
  it('rejects invalid dates, wheel flag types, and nonfinite score claims', () => {
    expect(() => verifySubmission({ ...validRun, day: { ...day, day: '2026-02-30' } })).toThrow('game day');
    expect(() => verifySubmission({ ...validRun, day: { ...day, spinning: 'false' } })).toThrow('wheel flag');
    expect(() => verifySubmission({ ...validRun, claimedScore: Infinity })).toThrow('score claim');
  });
});

const sampleEntry = (id: string, score = 100, bestHit = 20, mode: RunMode = 'daily'): ScoreEntry => ({ id, profile: 'guest1234', name: 'guest1234', guestId: 'guest1234', day: day.day, seed: day.seed, mode, scoreVersion: SCORE_VERSION, score, bestHit, floor: 2, floors: 2, actions: 10, won: false, hibernation: false, spinning: false, streak: 0, createdAt: '2026-11-04T00:00:00Z' });
describe('leaderboard persistence contracts', () => {
  it.each([
    ['2026-11-04T00:00:00+08:00', '2026-11-03'],
    ['2026-11-04T00:00:00Z', '2026-11-04'],
  ])('writes and reads the same UTC daily Redis key at %s', async (instant, expectedDay) => {
    const commands: unknown[][] = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(init!.body as string) as unknown[];
      commands.push(command);
      const result = command[0] === 'ZREVRANGE' ? []
        : (command[1] as string).includes("redis.call('INCR'") ? [1, 60_000] : command[8];
      return new Response(JSON.stringify({ result }));
    });
    const now = new Date(instant);
    const expected = fallbackDay(expectedDay);
    const handler = createApi({ store: createRedisStore('https://redis.example', 'secret', fetcher as typeof fetch), now: () => now.getTime() });
    const accepted = await call(handler, payload(finished('daily', false, fallbackDay(getGameDay(now)))));
    expect(accepted.status).toBe(201);
    expect(accepted.body.entry).toMatchObject({ day: expectedDay, seed: expected.seed });
    const write = commands.find(command => command[0] === 'EVAL' && command[2] === 5)!;
    expect(write.slice(6, 8)).toEqual([`squeekspire:score-v${SCORE_VERSION}:seed:${expected.seed}`, `squeekspire:score-v${SCORE_VERSION}:seed:${expected.seed}:daily`]);
    expect((await call(handler, undefined, { url: `/api/leaderboard?mode=daily&seed=${expected.seed}` })).status).toBe(200);
    expect(commands.at(-1)).toEqual(['ZREVRANGE', `squeekspire:score-v${SCORE_VERSION}:seed:${expected.seed}:daily`, 0, 49]);
  });
  it('sorts every mode by final score even when a lower score has a larger raw hit', async () => {
    const store = createMemoryStore();
    await store.add(sampleEntry('a', 500, 2, 'endless'));
    await store.add(sampleEntry('b', 100, 50, 'endless'));
    expect((await store.list({ mode: 'all', runMode: 'endless' })).map(row => row.id)).toEqual(['a', 'b']);
    expect((await store.list({ mode: 'all' })).map(row => row.id)).toEqual(['a', 'b']);
  });
  it('loads persisted local rows and serializes concurrent writes', async () => {
    let saved: unknown[] = [sampleEntry('saved')];
    const file = { async read() { return saved; }, async write(rows: unknown[]) { saved = structuredClone(rows); } };
    const store = createMemoryStore(file);
    await Promise.all([store.add(sampleEntry('new-a')), store.add(sampleEntry('new-b'))]);
    expect(await createMemoryStore(file).list({ mode: 'all' })).toHaveLength(3);
  });
  it('hides unversioned and previous-version local rows and only persists current scores', async () => {
    const { scoreVersion: _oldVersion, ...unversioned } = sampleEntry('legacy', 1e100);
    let saved: unknown[] = [unversioned, { ...sampleEntry('old', 1e99), scoreVersion: SCORE_VERSION - 1 }, sampleEntry('current')];
    const file = { async read() { return saved; }, async write(rows: unknown[]) { saved = structuredClone(rows); } };
    const store = createMemoryStore(file);
    expect((await store.list({ mode: 'all' })).map(row => row.id)).toEqual(['current']);
    await expect(store.add({ ...sampleEntry('rejected'), scoreVersion: SCORE_VERSION - 1 })).rejects.toThrow('score version');
    await store.add(sampleEntry('new'));
    expect(saved.map(row => (row as ScoreEntry).id).sort()).toEqual(['current', 'new']);
  });
  it('supports both server credential pairs and rejects partial configuration', () => {
    expect(createStore({ UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'secret' }).kind).toBe('redis');
    expect(createStore({ KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'secret' }).kind).toBe('redis');
    expect(() => createStore({ KV_REST_API_URL: 'https://redis.example' })).toThrow('incomplete');
    expect(() => createStore({ UPSTASH_REDIS_REST_URL: 'https://redis.example', KV_REST_API_TOKEN: 'secret' })).toThrow('incomplete');
    expect(() => createRedisStore('http://redis.example', 'secret')).toThrow('HTTPS');
  });
  it('uses atomic Redis writes, final score for every mode, and atomic expiring rate counters', async () => {
    const commands: unknown[][] = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(init!.body as string) as unknown[]; commands.push(command);
      const result = (command[1] as string).includes("redis.call('INCR'") ? [POST_RATE_LIMIT + 1, 30_000] : command[8];
      return new Response(JSON.stringify({ result }));
    });
    const store = createRedisStore('https://redis.example', 'secret', fetcher as typeof fetch);
    const daily = sampleEntry('daily', 500, 2), endless = sampleEntry('endless', 10, 80, 'endless');
    expect(await store.add(daily)).toEqual(daily);
    expect(await store.add(endless)).toEqual(endless);
    expect(commands[0]!.at(-2)).toBe(500);
    expect(commands[1]!.at(-2)).toBe(10);
    expect(commands[0]![1]).toContain('ZREMRANGEBYRANK');
    expect(await store.rateLimit('ip', POST_RATE_LIMIT, 60_000, 0)).toEqual({ allowed: false, retryAfter: 30 });
    expect(commands[2]![1]).toContain('PEXPIRE');
    expect(fetcher.mock.calls[0]![1]!.headers).toMatchObject({ Authorization: 'Bearer secret' });
  });
  it('reads the top fifty Redis entries with one MGET and propagates service failures', async () => {
    const entry = sampleEntry('one');
    const commands: unknown[][] = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(init!.body as string) as unknown[]; commands.push(command);
      return new Response(JSON.stringify({ result: command[0] === 'MGET' ? [JSON.stringify(entry), null] : ['one', 'missing'] }));
    });
    const store = createRedisStore('https://redis.example', 'secret', fetcher as typeof fetch);
    expect(await store.list({ mode: 'daily', seed: day.seed, runMode: 'daily' })).toEqual([entry]);
    expect(commands[0]).toEqual(['ZREVRANGE', `squeekspire:score-v${SCORE_VERSION}:seed:${day.seed}:daily`, 0, 49]);
    expect(commands[1]).toEqual(['MGET', `squeekspire:score-v${SCORE_VERSION}:entry:one`, `squeekspire:score-v${SCORE_VERSION}:entry:missing`]);
    const failing = createRedisStore('https://redis.example', 'secret', (async () => new Response('', { status: 503 })) as typeof fetch);
    await expect(failing.list({ mode: 'all' })).rejects.toThrow('unavailable');
  });
  it('defensively hides stale Redis entry versions and refuses to index old scores', async () => {
    const current = sampleEntry('current');
    const { scoreVersion: _version, ...unversioned } = sampleEntry('legacy', 1e100);
    const entries = [unversioned, { ...sampleEntry('old'), scoreVersion: SCORE_VERSION - 1 },
      { ...sampleEntry('future'), scoreVersion: SCORE_VERSION + 1 }, current];
    const commands: unknown[][] = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const command = JSON.parse(init!.body as string) as unknown[]; commands.push(command);
      return new Response(JSON.stringify({ result: command[0] === 'MGET'
        ? entries.map(entry => JSON.stringify(entry)) : entries.map(entry => entry.id) }));
    });
    const store = createRedisStore('https://redis.example', 'secret', fetcher as typeof fetch);
    expect(await store.list({ mode: 'all' })).toEqual([current]);
    expect(commands[0]).toEqual(['ZREVRANGE', `squeekspire:score-v${SCORE_VERSION}:all`, 0, 49]);
    await expect(store.add({ ...current, scoreVersion: SCORE_VERSION - 1 })).rejects.toThrow('score version');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
