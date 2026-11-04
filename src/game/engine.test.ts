import { describe, expect, it } from 'vitest';
import { act, createRun, effectiveMult, exportRun, formatNumber, previewIntents, replayRun, scoreBattle, type RunState, type RunExport } from './engine';
import { CARDS, CORE_CARD_POOL, STARTER_DECK } from './catalog';
import { fallbackDay } from './data';
import { generateMap } from './map';
import { hashString } from './rng';
import { verifySubmission } from '../../server/replay';
import { cardPlayDisabledReason, cardValues, getCardPresentation, isCardUpgradable, mergeCandidates } from './cardValues';

const day = fallbackDay('2026-11-04');
const start = () => createRun(day, generateMap(day), 'daily');
function enterFirstCombat(state = start()): RunState {
  for (let i = 0; i < 24; i++) {
    state = act(state, { type: 'enter', nodeId: state.reachable[0]! });
    if (state.phase === 'combat') return state;
    state = act(state, { type: 'leave' });
  }
  throw new Error('No combat on generated map');
}
function firstBattle(): RunState {
  let state = enterFirstCombat();
  for (let i = 0; i < 200 && state.phase === 'combat'; i++) {
    const c = state.combat!;
    const playable = c.hand.filter(k => CARDS[k.id]!.cost !== 'X' && (CARDS[k.id]!.cost as number) <= c.energy);
    // Deal damage first, then spend the remaining energy on defensive cards.
    const card = playable.find(k => CARDS[k.id]!.type === 'attack') ?? playable[0];
    state = act(state, card ? { type: 'play', uid: card.uid } : { type: 'endTurn' });
  }
  return state;
}
function combatFixture(jackpot = false): RunState {
  const state = enterFirstCombat();
  state.map[state.currentNode]!.jackpot = jackpot;
  state.combat!.enemies[0]!.hp = 500;
  state.combat!.enemies[0]!.maxHp = 500;
  state.combat!.enemies = [state.combat!.enemies[0]!];
  state.combat!.energy = 20;
  state.combat!.hand = ['wheel-kick', 'wheel-kick', 'cheek-pouch', 'freeze-for-mint', 'full-moon-run'].map((id, i) => ({ id, uid: `test${i}`, level: 0, mergeLevel: 0 }));
  return state;
}
function resign(body: Omit<RunExport, 'checksum'>): RunExport { return { ...body, checksum: hashString(JSON.stringify(body)).toString(16).padStart(8, '0') }; }

describe('the section 13 rules', () => {
  it('uses exactly the ten-card Zoomie Gremlin starter and all 30 core cards', () => {
    const state = start();
    expect(state.deck.map(c => c.id)).toEqual(STARTER_DECK);
    expect(state.hp).toBe(72);
    expect(state.relics).toEqual(['midnight-wheel']);
    expect(CORE_CARD_POOL).toHaveLength(30);
    expect(CORE_CARD_POOL.filter(id => CARDS[id]!.rarity === 'common')).toHaveLength(16);
    expect(CORE_CARD_POOL.filter(id => CARDS[id]!.rarity === 'uncommon')).toHaveLength(10);
    expect(CORE_CARD_POOL.filter(id => CARDS[id]!.rarity === 'rare')).toHaveLength(4);
  });
  it('adds Mult before multiplying, and keeps damage independent of scoring', () => {
    const base = combatFixture();
    const scored = structuredClone(base);
    scored.combat!.addMult = 3;
    scored.combat!.turnMult = 0.5;
    scored.combat!.multiply = 2;
    scored.combat!.chain = 2;
    scored.combat!.chainType = 'attack';
    scored.combat!.squeeks = 100;
    expect(effectiveMult(scored)).toBeCloseTo(3.5 * 2 * 1.1 ** 2);
    expect(scoreBattle(scored)).toBe(Math.round(100 * 3.5 * 2 * 1.1 ** 2));
    const a = act(base, { type: 'play', uid: 'test0' });
    const b = act(scored, { type: 'play', uid: 'test0' });
    expect(a.combat!.enemies[0]!.hp).toBe(b.combat!.enemies[0]!.hp);
    expect(base.combat!.hand).toHaveLength(5); // Reducer does not mutate its input.
  });
  it('resets chains across card types and retains the frozen chain', () => {
    let state = combatFixture();
    state = act(state, { type: 'play', uid: 'test0' });
    state = act(state, { type: 'play', uid: 'test1' });
    expect(state.combat!.chain).toBe(1);
    state = act(state, { type: 'play', uid: 'test3' });
    expect(state.combat!.chain).toBe(0);
    expect(state.combat!.frozenChain).toBeCloseTo(1.1);
    state = act(state, { type: 'endTurn' });
    expect(state.combat!.chain).toBe(0);
    expect(state.combat!.frozenChain).toBeCloseTo(1.1);
  });
  it('doubles multiplicative triggers on golden Zoomies nodes', () => {
    const plain = act(combatFixture(false), { type: 'play', uid: 'test4' });
    const gold = act(combatFixture(true), { type: 'play', uid: 'test4' });
    expect(plain.combat!.multiply).toBe(2);
    expect(gold.combat!.multiply).toBe(4);
    expect(plain.combat!.enemies[0]!.hp).toBe(gold.combat!.enemies[0]!.hp);
  });
  it('keeps live SPINNING energy out of the official daily run', () => {
    const spinning = { ...day, spinning: true };
    const daily = enterFirstCombat(createRun(spinning, generateMap(spinning), 'daily'));
    const practice = enterFirstCombat(createRun(spinning, generateMap(spinning), 'practice'));
    expect(daily.combat!.energy).toBe(3);
    expect(practice.combat!.energy).toBe(4);
  });
  it('applies Weak before the cached enemy intent acts and preserves a braked attack chain', () => {
    let state = combatFixture();
    state.combat!.hand.push({ uid: 'weak', id: 'tail-whip', level: 0, mergeLevel: 0 }, { uid: 'brake', id: 'wheel-brake', level: 0, mergeLevel: 0 });
    // Use an attacking enemy rather than an Oracle's rejection turn.
    state.combat!.enemies[0]!.id = 'dust-mite';
    state.combat!.enemies[0]!.intent = { type: 'attack', damage: Math.round(6 * day.difficulty), times: 1, label: 'Attack' };
    const before = state.combat!.enemies[0]!.intent.damage;
    state = act(state, { type: 'play', uid: 'weak' });
    expect(state.combat!.enemies[0]!.intent.damage).toBeLessThan(before);
    state = act(state, { type: 'play', uid: 'test0' });
    const chain = state.combat!.chain;
    state = act(state, { type: 'play', uid: 'brake' });
    expect(state.combat!.chainType).toBe('attack');
    state = act(state, { type: 'play', uid: 'test1' });
    expect(state.combat!.chain).toBe(chain + 1);
  });
  it('freezes the whole current multiplier across turns and starts Buildooooor at 7', () => {
    let state = combatFixture();
    state.combat!.turnMult = 5;
    state.combat!.hand.push({ uid: 'build', id: 'buildooooor', level: 0, mergeLevel: 0 });
    state = act(state, { type: 'play', uid: 'test3' });
    const frozen = effectiveMult(state);
    const hp = state.combat!.enemies[0]!.hp;
    state = act(state, { type: 'play', uid: 'build' });
    expect(hp - state.combat!.enemies[0]!.hp).toBe(7);
    state = act(state, { type: 'endTurn' });
    expect(effectiveMult(state)).toBeGreaterThanOrEqual(frozen);
  });
  it('grants the greeting synergy in either card order without broadcasting it', () => {
    const greet = (ids: string[]) => {
      let state = combatFixture();
      state.combat!.hand = ids.map((id, i) => ({ id, uid: `g${i}`, level: 0, mergeLevel: 0 }));
      state = act(state, { type: 'play', uid: 'g0' });
      return act(state, { type: 'play', uid: 'g1' });
    };
    const a = greet(['gm', 'gsqueek']), b = greet(['gsqueek', 'gm']);
    expect(a.combat!.turnMult).toBe(b.combat!.turnMult);
    expect(a.hints).toContain('Good Squeeking: gm and gsqueek greet the same night.');
  });
  it('previews the next two enemy intents without advancing the deterministic state', () => {
    const state = combatFixture(), original = structuredClone(state);
    const future = previewIntents(state);
    expect(future).toHaveLength(1);
    expect(future[0]!.intents).toHaveLength(2);
    expect(state).toEqual(original);
    const next = act(state, { type: 'endTurn' });
    expect(future[0]!.intents[0]).toEqual(next.combat!.enemies[0]!.intent);
  });
});

describe('deterministic score and action replay', () => {
  it('recomputes the same battle result and deck from the logged choices', () => {
    const state = firstBattle();
    expect(state.totalScore).toBeGreaterThan(0);
    expect(state.phase).toBe('reward');
    const replay = replayRun(JSON.parse(JSON.stringify(exportRun(state))));
    expect(replay).toEqual(state);
    expect(firstBattle()).toEqual(state);
  });
  it('rejects modified score claims even when their transport checksum is recomputed', () => {
    const { checksum: _checksum, ...body } = exportRun(firstBattle());
    expect(() => replayRun(resign({ ...body, claimedScore: body.claimedScore + 1 }))).toThrow('Recomputed score');
  });
  it('rejects unreachable nodes, illegal cards, and altered authoritative day data', () => {
    expect(() => act(start(), { type: 'enter', nodeId: 23 })).toThrow('not reachable');
    const battle = enterFirstCombat();
    expect(() => act(battle, { type: 'play', uid: 'invented-card' })).toThrow('not in hand');
    const exported = exportRun(firstBattle());
    expect(() => replayRun(exported, { ...day, seed: day.seed + 1 })).toThrow('authoritative');
    const { checksum: _checksum, ...body } = exported;
    expect(() => replayRun(resign({ ...body, actions: [{ type: 'enter', nodeId: 23 }] }))).toThrow('not reachable');
  });
  it('logs an absolute monotonic endless timer and ends at exactly five minutes', () => {
    let state = createRun(day, generateMap(day), 'endless');
    state = act(state, { type: 'elapsed', ms: 120_000 });
    expect(() => act(state, { type: 'elapsed', ms: 100 })).toThrow('monotonic');
    state = act(state, { type: 'elapsed', ms: 300_000 });
    expect(state.phase).toBe('lost');
    expect(replayRun(exportRun(state))).toEqual(state);
  });
  it('verifies completed browser exports against an authoritative snapshot despite live status text', () => {
    let state = createRun({ ...day, source: 'live', spinning: true, notice: 'Public API online.' }, generateMap(day), 'daily');
    state = act(state, { type: 'abandon' });
    expect(verifySubmission(exportRun(state)).score).toBe(0);
    expect(replayRun(exportRun(state), day).log).toEqual(state.log);
  });
  it('replays a complete run through route, shop, rest, event, reward, and combat choices', () => {
    let state = start();
    let decisions = 0;
    const visited = new Set<string>();
    while (state.phase !== 'won' && state.phase !== 'lost' && decisions++ < 2_000) {
      visited.add(state.phase);
      if (state.phase === 'map') state = act(state, { type: 'enter', nodeId: state.reachable[0]! });
      else if (state.phase === 'rest') state = act(state, { type: 'rest', option: 'heal' });
      else if (state.phase === 'event') state = act(state, { type: 'event', option: 1 });
      else if (state.phase === 'shop') {
        const offer = state.shop!.offers.findIndex(o => !o.sold && o.price <= state.gold && o.kind === 'card');
        state = act(state, offer >= 0 ? { type: 'buy', index: offer } : { type: 'leave' });
      } else if (state.phase === 'reward') state = act(state, { type: 'reward', cardId: state.reward!.cards[0]! });
      else {
        const card = state.combat!.hand.find(k => {
          const definition = CARDS[k.id]!;
          return (definition.cost === 'X' || definition.cost <= state.combat!.energy) && !['merge', 'touch-grass'].includes(k.id);
        });
        state = act(state, card ? { type: 'play', uid: card.uid } : { type: 'endTurn' });
      }
    }
    expect(['won', 'lost']).toContain(state.phase);
    expect(state.log.length).toBeGreaterThan(20);
    for (const phase of ['map', 'rest', 'shop', 'combat', 'reward']) expect(visited.has(phase)).toBe(true);
    expect(replayRun(exportRun(state))).toEqual(state);
  });
  it('formats big scores without losing the K/M/B/T and exponent scale', () => {
    expect(formatNumber(1_250)).toBe('1.25K');
    expect(formatNumber(2_000_000)).toBe('2M');
    expect(formatNumber(3e9)).toBe('3B');
    expect(formatNumber(4e12)).toBe('4T');
    expect(formatNumber(5e18)).toBe('5.00e18');
  });
});

describe('playtest card regressions', () => {
  const card = (id: string, uid = id, level = 0) => ({ id, uid, level, mergeLevel: 0 });
  function attackingFixture() {
    const state = combatFixture();
    const enemy = state.combat!.enemies[0]!;
    enemy.id = 'dust-mite'; enemy.strength = 0; enemy.weak = 0;
    enemy.intent = { type: 'attack', damage: Math.round(6 * day.difficulty), times: 1, label: 'Attack' };
    state.combat!.hand = [];
    state.combat!.draw = Array.from({ length: 15 }, (_, i) => card('wheel-kick', `draw${i}`));
    return state;
  }
  it.each([0, 1])('transfers FUD before first-card clearing, including after %i prior cards', before => {
    let state = attackingFixture();
    state.combat!.hand = [card('exit-liquidity')];
    state.combat!.fud = true; state.combat!.weak = 1;
    state.combat!.turnCards = before ? ['gm'] : [];
    const multiply = state.combat!.multiply;
    state = act(state, { type: 'play', uid: 'exit-liquidity', target: 'e0' });
    const enemy = state.combat!.enemies[0]!;
    expect(state.combat!.fud).toBe(false);
    expect(state.combat!.weak).toBe(0);
    expect(enemy.fud).toBe(true);
    expect(enemy.weak).toBe(1);
    expect(enemy.intent.damage).toBe(Math.round(6 * 0.75 * 0.5 * day.difficulty));
    expect(state.combat!.multiply).toBe(multiply);
    state.combat!.block = 1;
    const hp = state.hp;
    const after = act(state, { type: 'endTurn' });
    expect(hp - after.hp).toBe(Math.max(0, enemy.intent.damage - 1));
    expect(after.combat!.enemies[0]!.fud).toBe(false);
  });
  it('transfers Weak without inventing FUD and keeps FUD until the enemy attacks', () => {
    let state = attackingFixture();
    state.combat!.hand = [card('exit-liquidity')]; state.combat!.weak = 2;
    state = act(state, { type: 'play', uid: 'exit-liquidity' });
    expect(state.combat!.enemies[0]!.weak).toBe(2);
    expect(state.combat!.enemies[0]!.fud).toBe(false);
    state = attackingFixture(); state.combat!.hand = [card('exit-liquidity')];
    state.combat!.fud = true;
    state.combat!.enemies[0]!.intent.type = 'block';
    state = act(state, { type: 'play', uid: 'exit-liquidity' });
    state = act(state, { type: 'endTurn' });
    expect(state.combat!.enemies[0]!.fud).toBe(true);
    expect(state.combat!.enemies[0]!.intent.type).toBe('attack');
    expect(state.combat!.enemies[0]!.intent.damage).toBe(Math.round(6 * 0.5 * day.difficulty));
  });
  it('uses the same Weak, Strength and Fluff reduction for multi-hit preview and HP loss', () => {
    let state = attackingFixture();
    const enemy = state.combat!.enemies[0]!;
    enemy.id = 'squeektoshi'; enemy.strength = 4; enemy.weak = 2;
    state.combat!.hand = [card('fluff-up')];
    state = act(state, { type: 'play', uid: 'fluff-up' });
    const shown = state.combat!.enemies[0]!.intent;
    expect(shown.damage).toBe(Math.max(0, Math.round(19 * 0.75 * day.difficulty) - 2));
    state.combat!.block = 5;
    const hp = state.hp, prediction = previewIntents(state)[0]!.intents[0]!;
    const after = act(state, { type: 'endTurn' });
    expect(hp - after.hp).toBe(Math.min(hp, Math.max(0, shown.damage * shown.times - 5)));
    expect(after.combat!.enemies[0]!.intent).toEqual(prediction);
    expect(after.combat!.powers['fluff-up']).toBeUndefined();
  });
  it('preserves ser’s explicit Block intent when another card refreshes enemy values', () => {
    let state = attackingFixture();
    state.combat!.enemies.push({ ...state.combat!.enemies[0]!, uid: 'e1' });
    state.combat!.hand = [card('ser', 'ser', 1), card('fluff-up')];
    state = act(state, { type: 'play', uid: 'ser' });
    state = act(state, { type: 'play', uid: 'fluff-up' });
    expect(state.combat!.enemies.map(e => e.intent.type)).toEqual(['block', 'block']);
  });
  it('requires a real Oracle choice, puts the second candidate first, and records it', () => {
    const state = attackingFixture(); state.combat!.hand = [card('oracle-ping')];
    state.combat!.draw = [card('wheel-kick', 'bottom'), card('cheek-pouch', 'third'), card('seed-snack', 'second'), card('3am-dash', 'first')];
    const untouched = structuredClone(state);
    expect(() => act(state, { type: 'play', uid: 'oracle-ping' })).toThrow('Choose');
    expect(() => act(state, { type: 'play', uid: 'oracle-ping', choice: 3 })).toThrow('Choose');
    expect(state).toEqual(untouched);
    const action = { type: 'play' as const, uid: 'oracle-ping', choice: 1 };
    const after = act(state, action);
    expect(after.combat!.draw.map(k => k.uid)).toEqual(['bottom', 'third', 'first', 'second']);
    expect(after.log.at(-1)).toEqual(action);
    expect(act(state, action)).toEqual(after);
  });
  it('Gud Tek validates its exact candidate and upgrades the selected second card only', () => {
    const state = attackingFixture();
    state.combat!.hand = [card('gud-tek'), card('wheel-kick', 'first'), card('cheek-pouch', 'second'), card('touch-grass', 'unsupported')];
    const original = structuredClone(state);
    expect(() => act(state, { type: 'play', uid: 'gud-tek' })).toThrow('Choose');
    expect(() => act(state, { type: 'play', uid: 'gud-tek', choice: 3 })).toThrow('Choose');
    expect(() => act(state, { type: 'play', uid: 'gud-tek', choice: 2 })).toThrow('Choose');
    expect(state).toEqual(original);
    const after = act(state, { type: 'play', uid: 'gud-tek', choice: 1 });
    expect(after.combat!.hand.find(k => k.uid === 'second')!.level).toBe(1);
    expect(after.combat!.hand.find(k => k.uid === 'first')!.level).toBe(0);
    expect(after.combat!.energy).toBe(state.combat!.energy - 1);
    expect(after.log.at(-1)).toMatchObject({ choice: 1 });
  });
  it('requires a confirmed Merge pair and leaves other duplicates untouched', () => {
    const state = attackingFixture(); state.combat!.hand = [card('merge')];
    state.deck = [card('wheel-kick', 'a'), card('wheel-kick', 'b'), card('cheek-pouch', 'c'), card('cheek-pouch', 'd'), card('oracle-ping', 'o1'), card('oracle-ping', 'o2')];
    const candidates = mergeCandidates(state);
    expect(candidates.map(candidate => candidate.pair)).toEqual([['a', 'b'], ['c', 'd']]);
    expect(() => act(state, { type: 'play', uid: 'merge' })).toThrow('Choose');
    expect(() => act(state, { type: 'play', uid: 'merge', mergePair: ['a', 'a'] })).toThrow('Choose');
    const after = act(state, { type: 'play', uid: 'merge', mergePair: ['c', 'd'] });
    expect(after.deck.map(k => [k.uid, k.mergeLevel])).toEqual([['a', 0], ['b', 0], ['c', 1], ['o1', 0], ['o2', 0]]);
    expect(after.log.at(-1)).toMatchObject({ mergePair: ['c', 'd'] });
    expect(after.mergeActs).toContain(state.map[state.currentNode]!.act);
  });
  it('every offered upgrade changes actual combat behavior, including ser, Insomnia and Genesis', () => {
    for (const id of Object.keys(CARDS)) {
      if (!isCardUpgradable(card(id))) continue;
      const resolve = (level: number) => {
        let state = attackingFixture(); state.hp = 40;
        state.map[state.currentNode]!.tier = 2;
        state.combat!.enemies[0]!.hp = 10_000;
        state.combat!.enemies.push({ ...state.combat!.enemies[0]!, uid: 'e1' });
        state.combat!.hand = [card(id, id, level)];
        state.combat!.turnCards = ['gm']; state.combat!.lastAttackDamage = 10;
        state = act(state, { type: 'play', uid: id });
        if (CARDS[id]!.type === 'power') state = act(state, { type: 'endTurn' });
        const c = state.combat!;
        return { hp: state.hp, enemies: c.enemies.map(e => [e.hp, e.vulnerable, e.intent.type, e.intent.damage]), block: c.block, handCount: c.hand.length, squeeks: c.squeeks, multiply: c.multiply };
      };
      expect(resolve(1), `Upgrade must change ${id}`).not.toEqual(resolve(0));
    }
  });
  it('rejects unsupported rest upgrades without consuming the room and explains non-upgradable cards', () => {
    const state = start(); state.phase = 'rest'; state.currentNode = 1;
    state.deck = [card('touch-grass')];
    expect(isCardUpgradable(state.deck[0]!)).toBe(false);
    expect(getCardPresentation(null, state.deck[0]!).text).toContain('Cannot be upgraded');
    expect(() => act(state, { type: 'rest', option: 'upgrade', uid: 'touch-grass' })).toThrow('available upgrade');
    expect(state.phase).toBe('rest');
  });
  it('shares live damage, merged Block and upgrade values between rules and presentation', () => {
    const state = attackingFixture(); state.combat!.weak = 1;
    const kick = { ...card('wheel-kick'), level: 1, mergeLevel: 1 };
    state.combat!.hand = [kick];
    const values = cardValues(kick, state, state.combat!.enemies[0]);
    const presentation = getCardPresentation(state, kick, { target: state.combat!.enemies[0] });
    expect(presentation.parts.some(part => part.value === values.damage && part.base === 6)).toBe(true);
    const after = act(state, { type: 'play', uid: kick.uid });
    expect(state.combat!.enemies[0]!.hp - after.combat!.enemies[0]!.hp).toBe(values.damage);
    expect(getCardPresentation(null, card('sunflower-stash', 'stash', 1)).text).toContain('Gain 8 Block');
    expect(getCardPresentation(null, card('3am-dash', 'dash', 1)).text).toContain('Deal 10 damage');
    expect(getCardPresentation(null, card('full-moon-run')).text).toContain('×2 Mult');
    expect(getCardPresentation(null, card('ape-in')).text).toContain('−2 Seeds');
  });
  it.each([
    ['full-moon-run', 0, 2], ['ape-in', 0, 3], ['genesis-seed', 0, 1.2], ['genesis-seed', 1, 1.3],
    ['wheely-overclock', 0, 1 + day.peakRpm / 1000], ['wheely-overclock', 1, 1 + day.peakRpm / 750],
  ] as const)('shows the golden multiplier actually resolved by %s at upgrade %i', (id, level, baseFactor) => {
    for (const golden of [false, true]) {
      const state = attackingFixture(); state.map[state.currentNode]!.jackpot = golden;
      const played = card(id, id, level); state.combat!.hand = [played];
      const expected = baseFactor * (golden ? 2 : 1);
      const parts = getCardPresentation(state, played).parts;
      expect(parts.some(part => part.value === expected)).toBe(true);
      if (golden) {
        const neutralBase = id === 'wheely-overclock' ? 1 + day.peakRpm / 1000 : id === 'genesis-seed' ? 1.2 : baseFactor;
        expect(parts.some(part => part.value === expected && part.base === neutralBase && part.value > part.base)).toBe(true);
      }
      let resolved = act(state, { type: 'play', uid: id });
      if (CARDS[id]!.type === 'power') resolved = act(resolved, { type: 'endTurn' });
      expect(resolved.combat!.multiply / state.combat!.multiply).toBeCloseTo(expected);
    }
  });
  it('keeps a selected enemy’s Vulnerable and golden room effects out of detached previews', () => {
    const state = attackingFixture(); state.map[state.currentNode]!.jackpot = true;
    state.combat!.enemies[0]!.vulnerable = 2;
    const target = state.combat!.enemies[0]!, kick = card('wheel-kick');
    expect(getCardPresentation(state, kick, { target }).text).toContain('Deal 9 damage');
    expect(getCardPresentation(null, kick, { target }).text).toContain('Deal 6 damage');
    expect(getCardPresentation(state, kick, { target, preview: true }).text).toContain('Deal 6 damage');
    expect(getCardPresentation(state, card('full-moon-run'), { preview: true }).text).toContain('×2 Mult');
    state.phase = 'rest';
    expect(getCardPresentation(state, kick, { target }).text).toContain('Deal 6 damage');
    expect(getCardPresentation(state, card('full-moon-run')).text).toContain('×2 Mult');
  });
  it.each([['overrun', 15, 5], ['wheel-spin', 9, 3]] as const)('describes %s upgrade scaling with a single final rounding', (id, damage, coefficient) => {
    const state = attackingFixture();
    state.combat!.turnCards = ['gm', 'gsqueek'];
    state.map[state.currentNode]!.tier = 2;
    const upgraded = card(id, id, 1); state.combat!.hand = [upgraded];
    const shown = getCardPresentation(state, upgraded);
    expect(shown.text).toContain(`Deal ${damage} damage`);
    expect(shown.text).toContain(`Formula: round(${coefficient} ×`);
    expect(shown.text).toContain('× 1.5), rounding once');
    expect(shown.parts.some(part => part.value === 1.5 && part.base === 1)).toBe(true);
    const preview = getCardPresentation(null, upgraded);
    expect(preview.text).toContain('× 1.5), rounding once');
    const resolved = act(state, { type: 'play', uid: id });
    expect(state.combat!.enemies[0]!.hp - resolved.combat!.enemies[0]!.hp).toBe(damage);
  });
  it('disables a spent Touch Grass and caps Buildooooor growth at 12 base damage', () => {
    const state = attackingFixture(); state.touchGrassUsed = true;
    expect(cardPlayDisabledReason(state, card('touch-grass'))).toContain('already used');
    state.combat!.hand = [card('touch-grass')];
    expect(() => act(state, { type: 'play', uid: 'touch-grass' })).toThrow('once per run');
    expect(cardValues(card('buildooooor'), state).rawDamage).toBe(7);
    state.buildCount = 1; expect(cardValues(card('buildooooor'), state).rawDamage).toBe(8);
    state.buildCount = 100; expect(cardValues(card('buildooooor'), state).rawDamage).toBe(12);
  });
});
