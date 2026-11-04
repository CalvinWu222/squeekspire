import { describe, expect, it } from 'vitest';
import { fallbackDay } from './data';
import { generateMap } from './map';
import { ENEMIES } from './catalog';
import { act, createRun, previewIntents, revealedIntents, type CardInstance } from './engine';

const card = (id: string, uid = id): CardInstance => ({ id, uid, level: 0, mergeLevel: 0 });
function fixture() {
  const day = { ...fallbackDay('2026-11-04'), hibernation: false, spinning: false, difficulty: 1 };
  const map = generateMap(day);
  map[0] = { ...map[0]!, kind: 'battle', enemyId: 'queue-snake', jackpot: false };
  const s = act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
  s.hp = s.maxHp = 1000;
  const c = s.combat!;
  c.hand = [card('sleep-cam')];
  c.draw = Array.from({ length: 30 }, (_, i) => card('cheek-pouch', `draw-${i}`));
  c.enemies.push({ ...c.enemies[0]!, uid: 'e1', id: 'seed-thief', name: ENEMIES['seed-thief']!.name, intent: { type: 'block', damage: 8, times: 1, label: 'Gain 8 Block' } });
  return s;
}
const reveal = (s: ReturnType<typeof fixture>, uid = 'sleep-cam') => act(s, { type: 'play', uid });

describe('Sleep Cam revealed intent queue', () => {
  it('reveals two numbered future turns for every living enemy without changing their predictions', () => {
    const s = fixture(), before = structuredClone(s);
    expect(revealedIntents(s)).toEqual([]);
    const predictions = previewIntents(s), after = reveal(s);
    const queued = revealedIntents(after);
    expect(s).toEqual(before);
    expect(queued.map(enemy => enemy.uid)).toEqual(['e0', 'e1']);
    expect(queued.map(enemy => enemy.intents.map(item => item.turn))).toEqual([[2, 3], [2, 3]]);
    expect(queued.map(enemy => enemy.intents.map(item => item.intent))).toEqual(predictions.map(enemy => enemy.intents));
    expect(queued[0]!.intents[1]!.intent).toMatchObject({ type: 'attack', damage: 11 });
    expect(queued[1]!.intents[0]!.intent).toMatchObject({ type: 'attack', damage: 8 });
  });

  it('keeps each revealed turn visible when it becomes current, then removes it only after acting', () => {
    let s = reveal(fixture());
    s = act(s, { type: 'endTurn' });
    expect(s.combat!.turn).toBe(2);
    expect(revealedIntents(s).map(enemy => enemy.intents.map(item => item.turn))).toEqual([[2, 3], [2, 3]]);
    expect(revealedIntents(s).map(enemy => enemy.intents[0]!.intent)).toEqual(s.combat!.enemies.map(enemy => enemy.intent));
    s = act(s, { type: 'endTurn' });
    expect(revealedIntents(s).map(enemy => enemy.intents.map(item => item.turn))).toEqual([[3], [3]]);
    s = act(s, { type: 'endTurn' });
    expect(s.combat!.turn).toBe(4);
    expect(revealedIntents(s)).toEqual([]);
  });

  it('extends the queue on replay without concealing an imminent revealed action, and restarts after expiry', () => {
    let s = act(reveal(fixture()), { type: 'endTurn' });
    s.combat!.hand.push(card('sleep-cam', 'second'));
    s = reveal(s, 'second');
    expect(revealedIntents(s).map(enemy => enemy.intents.map(item => item.turn))).toEqual([[2, 3, 4], [2, 3, 4]]);
    for (let i = 0; i < 3; i++) s = act(s, { type: 'endTurn' });
    expect(revealedIntents(s)).toEqual([]);
    s.combat!.hand.push(card('sleep-cam', 'third'));
    s = reveal(s, 'third');
    expect(revealedIntents(s).map(enemy => enemy.intents.map(item => item.turn))).toEqual([[6, 7], [6, 7]]);
  });

  it('omits defeated enemies while Live Camera continues revealing two future turns', () => {
    let s = reveal(fixture());
    s.combat!.enemies[1]!.hp = 0;
    expect(revealedIntents(s).map(enemy => enemy.uid)).toEqual(['e0']);
    s.relics.push('live-camera');
    for (let i = 0; i < 3; i++) s = act(s, { type: 'endTurn' });
    expect(revealedIntents(s).map(enemy => enemy.intents.map(item => item.turn))).toEqual([[5, 6]]);
  });
});
