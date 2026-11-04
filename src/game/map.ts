import { mulberry32 } from './rng.js';
import type { DayData, MapNode } from './types.js';

const battleEnemies = [
  ['dust-mite', 'queue-snake', 'seed-thief', 'sybil-swarm'],
  ['queue-snake', 'fud-moth', 'oracle-acolyte', 'liquidity-leech'],
  ['fud-moth', 'sybil-swarm', 'liquidity-leech', 'stale-sprite'],
];
const eliteEnemies = ['oracle-judge', 'difficulty-adjuster', 'stale-ghost'];

const recoverySlots = [2, 3, 4, 5, 6];
const shopSlots = [1, 2, 3, 4, 5, 6];
const isCombat = (kind: MapNode['kind']) => ['battle', 'elite', 'boss'].includes(kind);

/** The 24 hourly buckets are the actual nodes. Routes may skip one hour, never an act gate. */
export function generateMap(day: DayData): MapNode[] {
  if (day.hours.length !== 24) throw new Error('A map requires exactly 24 hourly buckets');
  const random = mulberry32(day.seed);
  const peak = Math.max(1, ...day.hours.map((hour) => hour.work));
  const active = day.hours.filter((hour) => hour.work > 0).length;
  const jackpotCount = Math.min(active, 1 + Math.floor(random() * 3));
  const jackpotHours = new Set([...day.hours]
    .filter((hour) => hour.work > 0)
    .sort((a, b) => b.work - a.work || a.hour - b.hour)
    .slice(0, jackpotCount)
    .map((hour) => hour.hour));

  const map: MapNode[] = day.hours.map((hour, id) => {
    const act = Math.floor(id / 8) + 1;
    const gate = id % 8 === 7;
    const jackpot = jackpotHours.has(hour.hour);
    const tier = hour.work === 0 ? 0 : Math.max(1, Math.ceil(hour.work / peak * 4));
    const roll = random();
    let kind: MapNode['kind'];
    if (id === 23) kind = 'boss';
    else if (gate) kind = 'elite';
    else if (hour.work === 0) kind = roll < 0.55 ? 'rest' : 'shop';
    else {
      const eventChance = Math.min(0.4, 0.1 + hour.settlements / Math.max(1, hour.activeRounds) * 0.025);
      kind = roll < eventChance ? 'event' : 'battle';
    }
    return { id, act, hour: hour.hour, kind, work: hour.work, tier, jackpot, enemyId: '', connections: [] as number[] };
  });

  for (let act = 0; act < 3; act++) {
    const offset = act * 8;
    // Work still determines tier, gold hours and the riskiest early fork. Recovery
    // placement favors quieter hours, with seed-based tie breaking, and no two
    // shops/rests are adjacent. Each act has exactly one of each.
    const pairs = recoverySlots.flatMap(rest => shopSlots
      .filter(shop => Math.abs(rest - shop) >= 2 && !map[offset + rest]!.jackpot && !map[offset + shop]!.jackpot)
      .map(shop => ({ rest, shop, weight: map[offset + rest]!.work + map[offset + shop]!.work
        - map[offset + rest - 1]!.work * 0.6 + random() * peak * 0.1 })));
    const ordered = pairs.sort((a, b) => a.weight - b.weight || a.rest - b.rest || a.shop - b.shop);
    const placement = ordered.find(({ rest, shop }) => shopSlots.some(local => ![rest, shop, rest - 1].includes(local)
      && !map[offset + local]!.jackpot)) ?? ordered[0]!;
    const risk = offset + placement.rest - 1;
    for (let local = 0; local < 7; local++) {
      const n = map[offset + local]!;
      if (local === placement.rest) n.kind = 'rest';
      else if (local === placement.shop) n.kind = 'shop';
      else if (n.kind === 'shop' || n.kind === 'rest') n.kind = 'event';
      // Opening each act with a normal fight prevents a gate-to-gate elite chain.
      if (local === 0 || n.jackpot) n.kind = 'battle';
    }
    map[risk]!.kind = map[risk]!.work > 0 ? 'elite' : 'battle';
    // One visible, peaceful relic room in every act. Preserve recovery, the
    // optional elite, act openings and actual-work jackpot combat rooms.
    const treasure = shopSlots.filter(local => ![placement.rest, placement.shop, placement.rest - 1].includes(local)
      && !map[offset + local]!.jackpot)
      .sort((a, b) => map[offset + a]!.work - map[offset + b]!.work || a - b)[0]
      // Three jackpots can occupy every spare room in one act. In that case
      // treasure replaces the optional pre-rest fight, never required rooms.
      ?? placement.rest - 1;
    map[offset + treasure]!.kind = 'treasure';
    // The fork offers an optional relic/gold fight versus immediate recovery.
    // A late optional elite can also skip its rest and challenge the act gate;
    // therefore at most two elites can be consecutive on any legal route.
    map[risk - 1]!.connections.push(risk + 1);
  }

  for (const n of map) {
    const { id, act, kind } = n;
    const gate = id % 8 === 7;
    let enemyId = '';
    if (kind === 'boss') enemyId = 'squeektoshi';
    else if (kind === 'elite') enemyId = eliteEnemies[act - 1];
    else if (kind === 'battle') {
      const pool = battleEnemies[act - 1];
      enemyId = pool[Math.floor(random() * pool.length)];
    }
    const connections: number[] = [];
    if (id < 23) connections.push(id + 1);
    // Branches rejoin before the next gate: ids 7, 15 and 23 cannot be bypassed.
    if (!gate && id % 8 < 6 && random() < 0.7
      && (map[id + 1]!.kind !== map[id + 2]!.kind || isCombat(map[id + 1]!.kind) !== isCombat(map[id + 2]!.kind))) connections.push(id + 2);
    n.enemyId = enemyId;
    n.connections = [...new Set([...connections, ...n.connections])].sort((a, b) => a - b);
  }
  return map;
}
