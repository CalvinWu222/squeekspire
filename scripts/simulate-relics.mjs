import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Reproduce the actual pre-fix implementation from history, rather than a
// second hand-written approximation of its probabilities.
const baselineRef = '612b709';
const sampleCount = 200;
const root = process.cwd();
const scratch = await mkdtemp(path.join(os.tmpdir(), 'squeekspire-relic-survey-'));

async function loadVariant(label, ref) {
  const directory = path.join(scratch, label);
  await mkdir(path.join(directory, 'src', 'game'), { recursive: true });
  await writeFile(path.join(directory, 'package.json'), '{"type":"module"}\n');
  await cp(path.join(root, 'fixtures'), path.join(directory, 'fixtures'), { recursive: true });
  const files = ref
    ? execFileSync('git.exe', ['ls-tree', '-r', '--name-only', ref, 'src/game'], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).map(file => path.basename(file))
    : await readdir(path.join(root, 'src', 'game'));
  for (const file of files.filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))) {
    const source = ref
      ? execFileSync('git.exe', ['show', `${ref}:src/game/${file}`], { cwd: root, encoding: 'utf8' })
      : await readFile(path.join(root, 'src', 'game', file), 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    await writeFile(path.join(directory, 'src', 'game', file.replace(/\.ts$/, '.js')), output);
  }
  const moduleUrl = name => pathToFileURL(path.join(directory, 'src', 'game', `${name}.js`)).href;
  return { ...await import(moduleUrl('engine')), ...await import(moduleUrl('map')), ...await import(moduleUrl('data')), ...await import(moduleUrl('catalog')) };
}

function survey(game) {
  const floors = Array.from({ length: 25 }, (_, floor) => ({ floor, runsReaching: 0, seen: 0, acquired: 0, sources: {} }));
  const hourSources = {};
  const allSeen = new Set(), allAcquired = new Set();
  const sources = {};
  let totalDistinctSeen = 0, totalAcquired = 0, totalEncounters = 0;
  let smallestSeen = Infinity, largestSeen = 0;
  for (let sample = 0; sample < sampleCount; sample++) {
    const date = new Date(Date.UTC(2026, 0, 1 + sample)).toISOString().slice(0, 10);
    const day = game.fallbackDay(date);
    let state = game.createRun(day, game.generateMap(day), 'daily');
    const seen = new Set();
    let routeRng = (0x9e3779b9 ^ sample) >>> 0;
    const randomRoute = count => { routeRng = (Math.imul(routeRng, 1664525) + 1013904223) >>> 0; return Math.floor(routeRng / 2 ** 32 * count); };
    function observe(ids, source, acquired) {
      for (const id of ids) {
        totalEncounters++;
        sources[source] ??= { seen: 0, acquired: 0 };
        sources[source].seen++;
        floors[state.floor].seen++;
        floors[state.floor].sources[source] = (floors[state.floor].sources[source] ?? 0) + 1;
        const hour = state.currentNode + 1;
        const key = `${source}:${hour}`;
        hourSources[key] = (hourSources[key] ?? 0) + 1;
        seen.add(id); allSeen.add(id);
        if (acquired) {
          sources[source].acquired++;
          floors[state.floor].acquired++;
          allAcquired.add(id);
        }
      }
    }
    observe(state.relics, 'starting', true);
    floors[0].runsReaching++;
    while (state.phase !== 'won') {
      if (state.phase === 'map') {
        state = game.act(state, { type: 'enter', nodeId: state.reachable[randomRoute(state.reachable.length)] });
        floors[state.floor].runsReaching++;
        if (state.map[state.currentNode].kind === 'treasure') observe(state.reward.relic ? [state.reward.relic] : [], 'treasure', true);
      } else if (state.phase === 'combat') {
        const owned = new Set(state.relics);
        // An acquisition survey conditional on completing the route: force a
        // one-play win, while real reducers still generate all rewards/RNG.
        // This is explicitly not a combat-balance or player-win-rate estimate.
        state.combat.enemies.forEach(enemy => { enemy.hp = 1; enemy.block = 0; });
        state.combat.hand = [{ id: 'pellet-toss', uid: 'survey-attack', level: 0, mergeLevel: 0 }];
        state.combat.energy = 3;
        state = game.act(state, { type: 'play', uid: 'survey-attack' });
        observe(state.relics.filter(id => !owned.has(id)), state.map[state.currentNode].kind, true);
      } else if (state.phase === 'reward') state = game.act(state, { type: 'reward', cardId: null });
      else if (state.phase === 'rest') state = game.act(state, { type: 'rest', option: 'heal' });
      else if (state.phase === 'event') state = game.act(state, { type: 'event', option: 1 });
      else if (state.phase === 'shop') {
        const relicOffers = state.shop.offers.map((offer, index) => ({ ...offer, index })).filter(offer => offer.kind === 'relic');
        observe(relicOffers.map(offer => offer.id), 'shop', false);
        for (const offer of relicOffers.sort((a, b) => a.price - b.price)) {
          if (offer.price > state.gold) continue;
          state = game.act(state, { type: 'buy', index: offer.index });
          sources.shop.acquired++;
          floors[state.floor].acquired++;
          allAcquired.add(offer.id);
        }
        state = game.act(state, { type: 'leave' });
      } else throw new Error(`Unexpected phase ${state.phase}`);
    }
    totalDistinctSeen += seen.size;
    totalAcquired += state.relics.length;
    smallestSeen = Math.min(smallestSeen, seen.size); largestSeen = Math.max(largestSeen, seen.size);
  }
  return {
    runs: sampleCount,
    averageDistinctRelicsSeen: totalDistinctSeen / sampleCount,
    averageRelicEncounters: totalEncounters / sampleCount,
    averageRelicsAcquired: totalAcquired / sampleCount,
    distinctSeenRange: [smallestSeen, largestSeen],
    relicsSeenAcrossRuns: [...allSeen].sort(), relicsAcquiredAcrossRuns: [...allAcquired].sort(),
    sources: Object.fromEntries(Object.entries(sources).map(([key, value]) => [key, { averageSeen: value.seen / sampleCount, averageAcquired: value.acquired / sampleCount }])),
    floors: floors.filter(row => row.runsReaching).map(row => ({ ...row, averageSeen: row.seen / sampleCount, averageAcquired: row.acquired / sampleCount })),
    sourceMapHours: Object.fromEntries(Object.keys(sources).map(source => [source, Object.entries(hourSources).filter(([key]) => key.startsWith(`${source}:`)).map(([key]) => Number(key.split(':')[1])).sort((a, b) => a - b)])),
  };
}

try {
  const before = survey(await loadVariant('before', baselineRef));
  const after = survey(await loadVariant('after'));
  const result = {
    baselineRef, sampleCount,
    method: '200 deterministic daily seeds, 2026-01-01 through 2026-07-19, published fallback hourly data, uniform random legal route choices. Actual map/reward/shop reducers. Battles forced to one-play wins; skip card rewards, take peaceful events, buy affordable relics cheapest first and spend no gold elsewhere. Includes starting relic; seen is unique owned or offered IDs per run; encounters count repeat offers separately. Conditional on completing a run, not player win rates.',
    before, after,
  };
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0) await writeFile(path.resolve(root, process.argv[outputIndex + 1]), `${JSON.stringify(result, null, 2)}\n`);
  for (const [label, value] of Object.entries({ before, after })) console.log(`${label}: distinct seen ${value.averageDistinctRelicsSeen.toFixed(3)}, acquired ${value.averageRelicsAcquired.toFixed(3)}, encounters ${value.averageRelicEncounters.toFixed(3)}; unique acquired ${value.relicsAcquiredAcrossRuns.length}`);
} finally {
  // This path is made by mkdtemp above, and is restricted to our task prefix.
  if (path.dirname(scratch) !== path.resolve(os.tmpdir()) || !path.basename(scratch).startsWith('squeekspire-relic-survey-')) throw new Error('Unexpected scratch path');
  await rm(scratch, { recursive: true, force: true });
}
