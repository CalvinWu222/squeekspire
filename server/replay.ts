import { replayRun, type RunExport } from '../src/game/engine';
import { fallbackDay } from '../src/game/data';

export const MAX_ACTIONS = 4_000;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
const uid = (value: unknown) => typeof value === 'string' && /^c\d{1,9}$/.test(value);
function requireValue(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

function validateAction(value: unknown) {
  requireValue(object(value) && typeof value.type === 'string', 'Invalid action');
  const fields: Record<string, string[]> = { enter: ['nodeId'], play: ['uid', 'target', 'choice', 'mergePair', 'prediction'], endTurn: [], reward: ['cardId'], buy: ['index'], remove: ['uid'], rest: ['option', 'uid'], event: ['option'], leave: [], elapsed: ['ms'], abandon: [] };
  requireValue(Object.hasOwn(fields, value.type) && Object.keys(value).every(key => key === 'type' || fields[value.type as string]!.includes(key)), 'Unknown action field');
  switch (value.type) {
    case 'enter': requireValue(integer(value.nodeId, 0, 23), 'Invalid node'); break;
    case 'play':
      requireValue(uid(value.uid), 'Invalid card identifier');
      requireValue(value.target === undefined || (typeof value.target === 'string' && /^e\d{1,3}$/.test(value.target)), 'Invalid target');
      requireValue(value.choice === undefined || integer(value.choice, 0, 9), 'Invalid card choice');
      requireValue(value.mergePair === undefined || (Array.isArray(value.mergePair) && value.mergePair.length === 2 && value.mergePair.every(uid)), 'Invalid merge pair');
      requireValue(value.prediction === undefined || ['attack', 'skill', 'power', 'curse'].includes(value.prediction as string), 'Invalid prediction'); break;
    case 'reward': requireValue(value.cardId === null || (typeof value.cardId === 'string' && /^[a-z0-9-]{1,60}$/.test(value.cardId)), 'Invalid reward'); break;
    case 'buy': requireValue(integer(value.index, 0, 3), 'Invalid shop index'); break;
    case 'remove': requireValue(uid(value.uid), 'Invalid card identifier'); break;
    case 'rest': requireValue((value.option === 'heal' || value.option === 'upgrade') && (value.uid === undefined || uid(value.uid)), 'Invalid rest choice'); break;
    case 'event': requireValue(value.option === 0 || value.option === 1, 'Invalid event choice'); break;
    case 'elapsed': requireValue(integer(value.ms, 0, 300_000), 'Invalid elapsed time'); break;
  }
}

/** Validate shape and bounded work before running the authoritative deterministic replay. */
export function verifySubmission(input: unknown, seed?: number) {
  requireValue(object(input) && input.version === 1 && object(input.day), 'Invalid replay format');
  requireValue(typeof input.day.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.day.day), 'Invalid game day');
  const date = new Date(`${input.day.day}T12:00:00Z`);
  requireValue(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === input.day.day, 'Invalid game day');
  requireValue(integer(input.day.seed, 0, 0xffff_ffff) && (seed === undefined || input.day.seed === seed), 'Seed mismatch');
  requireValue(typeof input.day.spinning === 'boolean', 'Invalid wheel flag');
  requireValue(['daily', 'practice', 'endless'].includes(input.mode as string), 'Invalid run mode');
  requireValue(Array.isArray(input.actions) && input.actions.length > 0 && input.actions.length <= MAX_ACTIONS, 'Invalid action log length');
  for (const action of input.actions) validateAction(action);
  requireValue(typeof input.claimedScore === 'number' && Number.isFinite(input.claimedScore) && input.claimedScore >= 0 && input.claimedScore <= 1e300, 'Invalid score claim');
  requireValue(typeof input.claimedBestHit === 'number' && Number.isFinite(input.claimedBestHit) && input.claimedBestHit >= 0 && input.claimedBestHit <= 1e300, 'Invalid best hit claim');
  requireValue(typeof input.checksum === 'string' && /^[a-f0-9]{8}$/.test(input.checksum), 'Invalid checksum');
  const payload = input as unknown as RunExport;
  const canonical = fallbackDay(payload.day.day);
  // Only practice uses the declared live spinning bonus; it has a separate board.
  // Every gameplay-relevant daily/endless rule must match the immutable fixture.
  const state = replayRun(payload, canonical);
  if (state.phase !== 'won' && state.phase !== 'lost') throw new Error('Only finished runs can be submitted');
  return { day: state.day.day, seed: canonical.seed, mode: state.mode, score: state.totalScore, bestHit: state.bestHit, floor: state.floor, floors: state.floor, actions: state.log.length, won: state.phase === 'won', hibernation: canonical.hibernation, spinning: state.mode === 'practice' && state.day.spinning };
}
