import { describe, expect, it } from 'vitest';
import { fallbackDay } from './data';
import { generateMap } from './map';

describe('daily map generation', () => {
  it('produces exactly 24 deterministic nodes with the three required gates', () => {
    const day = fallbackDay('2026-11-04');
    const first = generateMap(day);
    expect(first).toHaveLength(24);
    expect(first).toEqual(generateMap(structuredClone(day)));
    expect(first[7]).toMatchObject({ act: 1, kind: 'elite', enemyId: 'oracle-judge' });
    expect(first[15]).toMatchObject({ act: 2, kind: 'elite', enemyId: 'difficulty-adjuster' });
    expect(first[23]).toMatchObject({ act: 3, kind: 'boss', enemyId: 'squeektoshi', connections: [] });
  });

  it('binds 1–3 gold jackpot nodes to the highest actual work hours', () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    const jackpots = map.filter((node) => node.jackpot);
    expect(jackpots.length).toBeGreaterThanOrEqual(1);
    expect(jackpots.length).toBeLessThanOrEqual(3);
    const topHours = [...day.hours].sort((a, b) => b.work - a.work || a.hour - b.hour)
      .slice(0, jackpots.length).map((hour) => hour.hour).sort();
    expect(jackpots.map((node) => node.hour).sort()).toEqual(topHours);
    jackpots.forEach((node) => expect(['battle', 'elite', 'boss']).toContain(node.kind));
  });

  it('has forward branch choices and no route that can bypass an act gate', () => {
    const map = generateMap(fallbackDay('2026-11-04'));
    expect(map.some((node) => node.connections.length === 2)).toBe(true);
    for (const node of map) {
      if (node.id < 23) expect(node.connections).toContain(node.id + 1);
      for (const target of node.connections) {
        expect(target).toBeGreaterThan(node.id);
        expect(target).toBeLessThan(24);
        for (const gate of [7, 15, 23]) {
          expect(node.id < gate && target > gate).toBe(false);
        }
      }
    }
  });

  it('starts at a real battle and distributes shop/rest recovery within every act', () => {
    const day = fallbackDay('2026-11-04');
    const map = generateMap(day);
    expect(map[0]!.kind).toBe('battle');
    for (let act = 1; act <= 3; act++) {
      const rooms = map.filter(node => node.act === act);
      const rest = rooms.filter(node => node.kind === 'rest');
      const shop = rooms.filter(node => node.kind === 'shop');
      expect(rest).toHaveLength(1);
      expect(shop).toHaveLength(1);
      expect(Math.abs(rest[0]!.id - shop[0]!.id)).toBeGreaterThanOrEqual(2);
    }
    for (const node of map) {
      expect(node.work).toBe(day.hours[node.id]!.work);
      expect(node.hour).toBe(day.hours[node.id]!.hour);
    }
  });

  it('caps consecutive elites on every route and offers a combat/recovery fork per act', () => {
    const base = fallbackDay('2026-11-04');
    // Cover dense activity, a quiet night, alternating bursts and normal work.
    for (let sample = 0; sample < 80; sample++) {
      const day = structuredClone(base);
      day.seed = sample * 7919;
      if (sample % 4 === 0) day.hours.forEach(hour => { hour.work = 100; });
      if (sample % 4 === 1) day.hours.forEach(hour => { hour.work = 0; });
      if (sample % 4 === 2) day.hours.forEach((hour, i) => { hour.work = i % 2 ? 1000 : 0; });
      const map = generateMap(day);
      const longest = new Map<number, number>();
      for (const node of map) {
        const elite = node.kind === 'elite' || node.kind === 'boss';
        const streak = elite ? (longest.get(node.id) ?? 0) + 1 : 0;
        expect(streak).toBeLessThanOrEqual(2);
        for (const target of node.connections) longest.set(target, Math.max(longest.get(target) ?? 0, streak));
      }
      for (let act = 1; act <= 3; act++) {
        expect(map.some(node => node.act === act && node.connections.length === 2
          && node.connections.some(id => ['battle', 'elite'].includes(map[id]!.kind))
          && node.connections.some(id => map[id]!.kind === 'rest'))).toBe(true);
      }
    }
  });

  it('varies routes and enemy choices with the public daily seed', () => {
    expect(generateMap(fallbackDay('2026-11-04'))).not.toEqual(generateMap(fallbackDay('2026-11-05')));
  });

  it('has no fake jackpot hours when the hamster hibernates all night', () => {
    const day = fallbackDay('2026-11-04');
    day.hours.forEach((hour) => { hour.work = 0; });
    day.hibernation = true;
    expect(generateMap(day).some((node) => node.jackpot)).toBe(false);
  });
});
