import { verifySubmission } from './replay.js';
import { createStore, type BoardQuery, type Environment, type ScoreEntry, type ScoreStore } from './store.js';
import type { DayData, RunMode } from '../src/game/types.js';
import { SCORE_VERSION } from '../src/game/score.js';
import { resolveLeaderboardDay, type DayResolver } from './daily.js';
import { getGameDay } from '../src/game/data.js';

export const MAX_BODY_BYTES = 256 * 1024;
export const POST_RATE_LIMIT = 12;
export const GET_RATE_LIMIT = 120;
export interface ApiRequest {
  method?: string; url?: string; headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string }; body?: unknown;
  [Symbol.asyncIterator]?: () => AsyncIterator<Uint8Array | string>;
}
export interface ApiResponse { statusCode: number; setHeader(name: string, value: string): unknown; end(body?: string): unknown; }
class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const header = (request: ApiRequest, key: string) => { const value = request.headers[key]; return Array.isArray(value) ? value[0] : value; };
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;
const seedValue = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffff_ffff;

export function sanitizeName(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/<[^>]*>/g, '').replace(/[^a-zA-Z0-9 ._'-]/g, '').trim().slice(0, 24) : '';
}
async function digest(value: string) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(data)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function identity(payload: Record<string, unknown>, ipHash: string) {
  const input = object(payload.identity) ? payload.identity : {};
  const provided = input.walletAddress ?? payload.walletAddress;
  const profile = typeof payload.profile === 'string' ? payload.profile : '';
  const address = provided ?? (/^0x[0-9a-fA-F]{40}$/.test(profile) ? profile : undefined);
  if (address !== undefined) {
    if (typeof address !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(address)) throw new ApiError(400, 'invalid_identity', 'Invalid wallet address');
    const walletAddress = address.toLowerCase();
    return { profile: walletAddress, walletAddress, name: `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` };
  }
  const guest = sanitizeName(input.guestId ?? payload.guestId ?? (profile || payload.name));
  const guestId = /^guest\d{4,8}$/.test(guest) ? guest : `guest${1000 + parseInt(ipHash.slice(0, 8), 16) % 9000}`;
  return { profile: guestId, guestId, name: guestId };
}
async function readBody(request: ApiRequest): Promise<unknown> {
  const length = Number(header(request, 'content-length') ?? 0);
  if (!Number.isFinite(length) || length < 0) throw new ApiError(400, 'invalid_payload', 'Invalid content length');
  if (length > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Score payload exceeds 256 KiB');
  if (!/^application\/json(?:\s*;|$)/i.test(header(request, 'content-type') ?? '')) throw new ApiError(415, 'unsupported_media_type', 'Use application/json');
  let raw: string;
  if (request.body !== undefined) {
    try { raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body); }
    catch { throw new ApiError(400, 'invalid_payload', 'Invalid JSON payload'); }
    if (typeof raw !== 'string' || bytes(raw) > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Score payload exceeds 256 KiB');
  } else {
    raw = ''; let size = 0;
    const iterator = request[Symbol.asyncIterator];
    if (!iterator) throw new ApiError(400, 'invalid_payload', 'Missing JSON payload');
    const decoder = new TextDecoder();
    for await (const chunk of { [Symbol.asyncIterator]: () => iterator.call(request) }) {
      const encoded = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
      size += encoded.byteLength;
      if (size > MAX_BODY_BYTES) throw new ApiError(413, 'payload_too_large', 'Score payload exceeds 256 KiB');
      raw += decoder.decode(encoded, { stream: true });
    }
    raw += decoder.decode();
  }
  try { return JSON.parse(raw); } catch { throw new ApiError(400, 'invalid_payload', 'Invalid JSON payload'); }
}
function queryFrom(url: URL): BoardQuery {
  const mode = url.searchParams.get('mode') ?? 'all';
  if (mode !== 'daily' && mode !== 'all') throw new ApiError(400, 'invalid_query', 'mode must be daily or all');
  const modeInput = url.searchParams.get('runMode');
  if (modeInput !== null && !['daily', 'practice', 'endless'].includes(modeInput)) throw new ApiError(400, 'invalid_query', 'Invalid runMode');
  const runMode = (modeInput ?? (mode === 'daily' ? 'daily' : undefined)) as RunMode | undefined;
  const seedInput = url.searchParams.get('seed');
  const seed = seedInput !== null && /^\d{1,10}$/.test(seedInput) ? Number(seedInput) : undefined;
  if ((seedInput !== null && !seedValue(seed)) || (mode === 'daily' && seed === undefined)) throw new ApiError(400, 'invalid_query', 'daily leaderboard requires a valid seed');
  return { mode, ...(mode === 'daily' ? { seed } : {}), ...(runMode ? { runMode } : {}) };
}

/** Vercel and local Vite middleware use this same handler. */
export function createApi(options: { store?: ScoreStore; env?: Environment; now?: () => number; resolveDay?: DayResolver; resolveBoardDay?: (day: string) => DayData } = {}) {
  let store = options.store;
  const now = options.now ?? Date.now;
  return async function handler(request: ApiRequest, response: ApiResponse) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status: number, value: unknown) => { response.statusCode = status; response.end(JSON.stringify(value)); };
    try {
      if ((request.url ?? '').length > 2048) throw new ApiError(414, 'invalid_query', 'URL too long');
      const url = new URL(request.url ?? '/', 'http://localhost');
      const isScore = url.pathname === '/api/score';
      if (!isScore && url.pathname !== '/api/leaderboard') throw new ApiError(404, 'not_found', 'API endpoint not found');
      const method = isScore ? 'POST' : 'GET';
      if (request.method !== method) { response.setHeader('Allow', method); throw new ApiError(405, 'method_not_allowed', `Use ${method}`); }
      const runtimeEnv = (globalThis as typeof globalThis & { process?: { env: Environment } }).process?.env ?? {};
      const env = options.env ?? runtimeEnv;
      store ??= createStore(env);
      // Only trust forwarding headers behind Vercel's proxy. Dev clients cannot spoof
      // an IP through headers to bypass the limiter. Only hashed IPs enter Redis.
      const forwarded = env.VERCEL === '1' ? header(request, 'x-vercel-forwarded-for') ?? header(request, 'x-forwarded-for') : undefined;
      const ip = (forwarded ?? request.socket?.remoteAddress ?? 'unknown').split(',')[0]!.trim().slice(0, 128);
      const ipHash = await digest(ip);
      const allowed = await store.rateLimit(`${isScore ? 'score' : 'board'}:${ipHash}`, isScore ? POST_RATE_LIMIT : GET_RATE_LIMIT, 60_000, now());
      if (!allowed.allowed) { response.setHeader('Retry-After', String(allowed.retryAfter)); throw new ApiError(429, 'rate_limited', 'Too many requests; try again shortly'); }
      if (!isScore) {
        const view = url.searchParams.get('view');
        if (view !== null && view !== 'overview') throw new ApiError(400, 'invalid_query', 'Unknown leaderboard view');
        if (view === 'overview') {
          const instant = now();
          const resolveDay = options.resolveBoardDay ?? resolveLeaderboardDay;
          const days = Array.from({ length: 8 }, (_, offset) => resolveDay(getGameDay(new Date(instant - offset * 86_400_000))));
          // Query each seed index directly: an old champion may be far below the
          // all-time top fifty. Daily indexes expire after 90 days; this bounded
          // seven-day archive honestly returns null when no retained result exists.
          const [boards, allTime] = await Promise.all([
            Promise.all(days.map(async day => (await store!.list({ mode: 'daily', runMode: 'daily', seed: day.seed }))
              .filter(entry => entry.scoreVersion === SCORE_VERSION && entry.mode === 'daily' && entry.seed === day.seed && entry.day === day.day))),
            store.list({ mode: 'all' }).then(entries => entries.filter(entry => entry.scoreVersion === SCORE_VERSION)),
          ]);
          send(200, {
            today: { day: days[0]!.day, seed: days[0]!.seed, entries: boards[0] },
            champions: days.slice(1).map((day, index) => ({ day: day.day, seed: day.seed, entry: boards[index + 1]![0] ?? null })),
            allTime, scoreVersion: SCORE_VERSION, storage: store.kind,
          }); return;
        }
        const query = queryFrom(url);
        const entries = (await store.list(query)).filter(entry => entry.scoreVersion === SCORE_VERSION);
        send(200, { entries, scoreVersion: SCORE_VERSION, ...query, storage: store.kind }); return;
      }
      const payload = await readBody(request);
      if (!object(payload) || !seedValue(payload.seed)) throw new ApiError(400, 'invalid_payload', 'Submit a seed and run export');
      let verified: ReturnType<typeof verifySubmission>;
      const run = payload.run ?? { version: payload.version, scoreVersion: payload.scoreVersion, day: payload.day, mode: payload.mode, actions: payload.actions, claimedScore: payload.claimedScore, claimedBestHit: payload.claimedBestHit, checksum: payload.checksum };
      try { verified = verifySubmission(run, payload.seed, options.resolveDay); }
      catch (error) { throw new ApiError(400, 'invalid_replay', error instanceof Error ? error.message : 'Invalid replay'); }
      const who = identity(payload, ipHash);
      const actions = JSON.stringify((run as { actions: unknown }).actions, ['type', 'nodeId', 'uid', 'target', 'choice', 'mergePair', 'prediction', 'cardId', 'index', 'option', 'ms']);
      const id = await digest(JSON.stringify([verified.scoreVersion, who.profile, verified.day, verified.seed, verified.mode, verified.spinning, actions]));
      const entry: ScoreEntry = { id, ...who, ...verified, streak: 0, createdAt: new Date(now()).toISOString() };
      send(201, { entry: await store.add(entry), scoreVersion: SCORE_VERSION, storage: store.kind });
    } catch (error) {
      if (error instanceof ApiError) send(error.status, { error: error.code, message: error.message });
      else send(503, { error: 'leaderboard_unavailable', message: 'Shared leaderboard unavailable; local scores are still available' });
    }
  };
}

export default createApi();
