import { describe, expect, it } from 'vitest';
import { RELICS } from './catalog';
import { fallbackDay } from './data';
import { act, createRun, type RunState } from './engine';
import { generateMap } from './map';
import { relicHowToGet } from './relicSources';
import type { MapNode } from './types';

const day = fallbackDay('2026-11-04');
function room(kind: MapNode['kind'], id = 0, owned = ['midnight-wheel']): RunState {
  const map = generateMap(day);
  map[id] = { ...map[id]!, kind, enemyId: kind === 'boss' ? 'squeektoshi' : 'oracle-judge' };
  const state = createRun(day, map, 'daily');
  state.reachable = [id]; state.relics = [...owned];
  return act(state, { type: 'enter', nodeId: id });
}
function win(state: RunState): RunState {
  state.combat!.enemies.forEach(enemy => { enemy.hp = 1; enemy.block = 0; });
  state.combat!.hand = [{ id: 'pellet-toss', uid: 'survey-attack', level: 0, mergeLevel: 0 }];
  state.combat!.energy = 3;
  return act(state, { type: 'play', uid: 'survey-attack' });
}

describe('relic acquisition and discovery', () => {
  it('guarantees one treasure per act without replacing gates, recovery or jackpots across varied activity', () => {
    for (let seed = 0; seed < 200; seed++) {
      const sample = structuredClone(day); sample.seed = seed * 7919;
      if (seed % 4 === 0) sample.hours.forEach(hour => { hour.work = 100; });
      if (seed % 4 === 1) sample.hours.forEach(hour => { hour.work = 0; });
      if (seed % 4 === 2) sample.hours.forEach((hour, i) => { hour.work = i % 2 ? 1000 : 0; });
      const map = generateMap(sample);
      for (const act of [1, 2, 3]) {
        const rooms = map.filter(node => node.act === act);
        for (const kind of ['treasure', 'shop', 'rest']) expect(rooms.filter(node => node.kind === kind)).toHaveLength(1);
        expect(rooms[0]!.kind).toBe('battle');
      }
      expect(map[7]!.kind).toBe('elite'); expect(map[15]!.kind).toBe('elite'); expect(map[23]!.kind).toBe('boss');
      for (const node of map.filter(node => node.jackpot)) expect(['battle', 'elite', 'boss']).toContain(node.kind);
    }
  });

  it.each(['elite', 'boss'] as const)('awards a relic on every %s win, including the final floor', kind => {
    for (const id of [0, 23]) {
      const state = win(room(kind, id));
      expect(state.relics).toHaveLength(2);
      expect(state.history.some(message => message.startsWith('Relic found:'))).toBe(true);
      expect(state.phase).toBe(id === 23 ? 'won' : 'reward');
    }
  });

  it('handles every three-jackpot hour combination, including a fully crowded act', () => {
    for (let a = 0; a < 22; a++) for (let b = a + 1; b < 23; b++) for (let c = b + 1; c < 24; c++) {
      const sample = structuredClone(day); sample.seed = 2;
      sample.hours.forEach((hour, i) => { hour.work = [a, b, c].includes(i) ? 100 : 0; });
      const map = generateMap(sample);
      expect(map.filter(node => node.jackpot)).toHaveLength(3);
      for (const act of [1, 2, 3]) {
        const rooms = map.filter(node => node.act === act);
        for (const kind of ['treasure', 'shop', 'rest']) expect(rooms.filter(node => node.kind === kind)).toHaveLength(1);
        expect(rooms[0]!.kind).toBe('battle');
      }
      expect(map[7]!.kind).toBe('elite'); expect(map[15]!.kind).toBe('elite'); expect(map[23]!.kind).toBe('boss');
      for (const node of map.filter(node => node.jackpot)) expect(['battle', 'elite', 'boss']).toContain(node.kind);
    }
  });

  it('opens treasure immediately, makes the relic owned, and continues without a card choice', () => {
    let state = room('treasure');
    expect(state.phase).toBe('reward');
    expect(state.reward?.cards).toEqual([]);
    expect(state.relics).toContain(state.reward?.relic);
    state = act(state, { type: 'reward', cardId: null });
    expect(state.phase).toBe('map');
  });

  it('puts every nonstarter relic in elite, boss, treasure and shop pools with pickup effects', () => {
    const ids = Object.keys(RELICS);
    for (const id of ids.filter(id => id !== 'midnight-wheel')) {
      const owned = ids.filter(key => key !== id);
      for (const kind of ['elite', 'boss', 'treasure', 'shop'] as const) {
        let state = room(kind, kind === 'boss' ? 23 : 0, owned);
        if (kind === 'elite' || kind === 'boss') state = win(state);
        if (kind === 'shop') {
          const offers = state.shop!.offers.filter(offer => offer.kind === 'relic');
          expect(offers.map(offer => offer.id)).toEqual([id]);
          state.gold = 1000;
          state = act(state, { type: 'buy', index: state.shop!.offers.findIndex(offer => offer.kind === 'relic') });
        }
        expect(state.relics).toContain(id);
        expect(new Set(state.relics).size).toBe(ids.length);
        if (id === 'genesis') expect(state.deck.length).toBeGreaterThanOrEqual(11);
        if (id === 'name-tag' || id === 'probably-nothing') expect(state.deck.some(card => card.level === 1)).toBe(true);
      }
    }
  });

  it('always stocks two distinct unowned relics, then one or zero only as the pool runs out', () => {
    const ids = Object.keys(RELICS);
    for (let owned = 1; owned <= ids.length; owned++) {
      const state = room('shop', 0, ids.slice(0, owned));
      const offers = state.shop!.offers.filter(offer => offer.kind === 'relic');
      expect(offers).toHaveLength(Math.min(2, ids.length - owned));
      expect(new Set(offers.map(offer => offer.id)).size).toBe(offers.length);
      expect(offers.every(offer => !state.relics.includes(offer.id))).toBe(true);
    }
  });

  it('handles a completed collection without duplicate rewards or a dead end', () => {
    const ids = Object.keys(RELICS);
    let state = room('treasure', 0, ids);
    expect(state.relics).toEqual(ids); expect(state.reward?.relic).toBeUndefined();
    state = act(state, { type: 'reward', cardId: null });
    expect(state.phase).toBe('map');
    expect(win(room('boss', 23, ids)).phase).toBe('won');
  });

  it('documents how to obtain every relic for the gallery', () => {
    for (const id of Object.keys(RELICS)) expect(relicHowToGet(id)).toMatch(id === 'midnight-wheel' ? /Starting relic/ : /elite or boss.*Treasure.*Shops/);
  });
});
