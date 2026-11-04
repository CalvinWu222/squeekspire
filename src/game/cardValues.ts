import { CARDS } from './catalog.js';
import type { CardInstance, EnemyState, RunState } from './engine.js';

const effectUpgrades = new Set(['seed-snack', 'water-bottle', 'night-owl', 'fluff-up', 'ser', 'insomnia', 'genesis-seed', 'wheely-overclock', 'wheel-spin', 'overrun', 'buildooooor', 'peak-rpm', 'gas-war', 'moar']);
/** Cards without a rule change are deliberately excluded from every upgrade source. */
export function isCardUpgradable(card: CardInstance): boolean {
  const definition = CARDS[card.id];
  return card.level === 0 && !!definition && (!!definition.damage || !!definition.block || effectUpgrades.has(card.id));
}
export function cardAmount(card: CardInstance, base: number): number {
  return Math.round(base * (card.level > 0 ? 1.5 : 1) * 1.1 ** card.mergeLevel);
}
export function baseDamage(card: CardInstance): number {
  if (card.id === '3am-dash' && card.level > 0) return Math.round(10 * 1.1 ** card.mergeLevel);
  return cardAmount(card, CARDS[card.id]!.damage ?? 0);
}
/** Golden rooms double every multiplier trigger; shared by the resolver and card face. */
export function triggerFactor(state: RunState | null, factor: number): number {
  return factor * (state?.phase === 'combat' && state.map[state.currentNode]?.jackpot ? 2 : 1);
}
export function cardValues(card: CardInstance, state: RunState | null = null, target?: EnemyState) {
  const c = state?.phase === 'combat' ? state.combat : undefined;
  const n = state && state.currentNode >= 0 ? state.map[state.currentNode] : undefined;
  const definition = CARDS[card.id]!;
  const cost = definition.cost === 'X' ? c?.energy ?? 0 : Math.max(0, definition.cost - (c?.powers.nocturnal && n?.jackpot ? 1 : 0));
  let damage = baseDamage(card);
  if (card.id === 'wheel-spin') damage = cardAmount(card, (n?.tier ?? 0) * 3);
  if (card.id === 'overrun') damage = cardAmount(card, (c?.turnCards.length ?? 0) * 5);
  if (card.id === 'buildooooor') damage = cardAmount(card, 7 + Math.min(5, (state?.buildCount ?? 0) + (!state?.buildCount && state?.relics.includes('early-buildooooor') ? 4 : 0)));
  if (card.id === 'peak-rpm') damage = cardAmount(card, Math.round(cost * (state?.day.peakRpm ?? 0) / 100));
  if (card.id === 'gas-war') damage = cardAmount(card, 6 * (cost + (n?.jackpot ? 1 : 0)) ** 2);
  if (card.id === 'moar') damage = cardAmount(card, c?.lastAttackDamage ?? 0);
  const rawDamage = damage;
  damage = Math.round(Math.max(0, damage) * (c && target?.vulnerable ? 1.5 : 1) * (c?.weak ? 0.75 : 1));
  const block = card.id === 'cheek-pouch' && card.level > 0 ? Math.round(8 * 1.1 ** card.mergeLevel) : cardAmount(card, definition.block ?? 0);
  const genesisBaseFactor = card.level ? 1.3 : 1.2;
  const overclockBaseFactor = 1 + (state?.day.peakRpm ?? 0) / (card.level ? 750 : 1000);
  return { cost, rawDamage, damage, block, draw: card.id === 'seed-snack' ? card.level ? 2 : 1 : card.id === 'insomnia' ? card.level ? 2 : 1 : card.id === 'sniff' ? 2 : 1,
    heal: cardAmount(card, 4), weak: 1, vulnerable: card.level ? 3 : 2, reduction: card.level ? 3 : 2,
    serTargets: card.level ? 2 : 1, genesisBaseFactor, genesisFactor: triggerFactor(state, genesisBaseFactor), nightSqueeks: card.level ? 2 : 1,
    overclockBaseFactor, overclockFactor: triggerFactor(state, overclockBaseFactor), fullMoonFactor: triggerFactor(state, 2), apeInFactor: triggerFactor(state, 3) };
}
export interface CardPresentationPart { text: string; value?: number; base?: number; }
export interface CardPresentation { text: string; parts: CardPresentationPart[]; }
/** The same values drive the resolver, live card face, accessible text, and upgrade preview. */
export function getCardPresentation(state: RunState | null, card: CardInstance, options: { target?: EnemyState; preview?: boolean } = {}): CardPresentation {
  const live = options.preview ? null : state;
  const current = cardValues(card, live, options.target);
  const baseline = cardValues({ ...card, level: 0, mergeLevel: 0 }, live, options.target);
  // Damage comparisons include temporary Weak/Vulnerable against an unmodified attack.
  const unmodified = cardValues({ ...card, level: 0, mergeLevel: 0 }, live);
  const parts: CardPresentationPart[] = [];
  const words = (text: string) => parts.push({ text });
  const number = (value: number, base = value) => parts.push({ text: String(Number(value.toFixed(2))), value, base });
  const dmg = () => number(current.damage, unmodified.rawDamage);
  const block = () => number(current.block, baseline.block);
  const damageFormula = (base: number, variable: string) => {
    words('Formula: round('); number(base); words(` × ${variable}`);
    if (card.level) { words(' × '); number(1.5, 1); }
    if (card.mergeLevel) { words(' × 1.1^'); number(card.mergeLevel, 0); }
    words('), rounding once.');
  };
  const id = card.id;
  if (CARDS[id]!.damage || ['wheel-spin', 'overrun', 'buildooooor', 'peak-rpm', 'gas-war', 'moar'].includes(id)) {
    words('Deal '); dmg(); words(id === 'double-lap' ? ' damage twice. ' : id === 'pellet-toss' ? ' damage to ALL enemies. ' : ' damage. ');
  }
  if (CARDS[id]!.block) { words('Gain '); block(); words(' Block. '); }
  switch (id) {
    case 'wheel-kick': words('+'); number(current.rawDamage, baseline.rawDamage); words(' Squeeks.'); break;
    case '3am-dash': words('Apply '); number(current.vulnerable, baseline.vulnerable); words(' Vulnerable.'); break;
    case 'tail-whip': words('Apply 1 Weak.'); break;
    case 'double-lap': words('+1 Chain.'); break;
    case 'seed-snack': words('Draw '); number(current.draw, baseline.draw); words('. +1 Chain.'); break;
    case 'sniff': words('Draw 2, then discard the oldest card.'); break;
    case 'sunflower-stash': words('Next turn: +1 Seed.'); break;
    case 'water-bottle': words('Heal '); number(live ? Math.min(current.heal, live.maxHp - live.hp) : current.heal, baseline.heal); words(' HP. Exhaust.'); break;
    case 'squeek': words('+0.5 Mult this turn.'); break;
    case 'wheel-brake': words('Preserve your Chain.'); break;
    case 'cage-climb': words('Draw 1.'); break;
    case 'night-owl': words('Every turn: +'); number(current.nightSqueeks, baseline.nightSqueeks); words(' base Squeeks.'); break;
    case 'fluff-up': words('Reduce each enemy attack hit this turn by '); number(current.reduction, baseline.reduction); words('.'); break;
    case 'oracle-ping': words('Inspect the next 3 draws. Choose which card is drawn first; the other cards keep their order.'); break;
    case 'block-reward': words('If lethal, gain 15 Gold.'); break;
    case 'buildooooor': words('Run growth: +1 damage per play, capped at +5.'); break;
    case 'overrun': damageFormula(5, 'cards already played this turn'); break;
    case 'wheel-spin': damageFormula(3, 'this hour’s work tier'); break;
    case 'peak-rpm': words('Damage scaling ×'); number((card.level ? 1.5 : 1) * 1.1 ** card.mergeLevel, 1); words(' of X × peak RPM / 100. Spend all Seeds. +'); number(current.cost); words(' Mult this turn.'); break;
    case 'gas-war': words('Damage scaling ×'); number((card.level ? 1.5 : 1) * 1.1 ** card.mergeLevel, 1); words(' of 6 × X². Spend all Seeds. Squeeks ×'); number((current.cost + (live && live.currentNode >= 0 && live.map[live.currentNode]?.jackpot ? 1 : 0)) ** 2); words('. Zoomies adds 1 Seed to X.'); break;
    case 'moar': words('Repeat ×'); number((card.level ? 1.5 : 1) * 1.1 ** card.mergeLevel, 1); words(' the previous attack’s base damage. Exhaust.'); break;
    case 'ser': words('Change the next '); number(current.serTargets, baseline.serTargets); words(' attacking enemy intent(s) to Block.'); break;
    case 'insomnia': words('Draw +'); number(current.draw, baseline.draw); words(' each turn. Lose 2 HP at turn end.'); break;
    case 'genesis-seed': words('Every turn: ×'); number(current.genesisFactor, baseline.genesisBaseFactor); words(' Mult. Stacks.'); break;
    case 'wheely-overclock': words('Every turn: ×'); number(current.overclockFactor, baseline.overclockBaseFactor); words(' Mult. Formula: 1 + peak RPM / '); words(card.level ? '750' : '1000'); words('. RPM bonus scaling: ×'); number(card.level ? 4 / 3 : 1, 1); words('. Stacks.'); break;
    case 'exit-liquidity': words('Transfer all your Weak and FUD to the selected enemy. FUD halves its next attack turn; transferred FUD does not penalize this card.'); break;
    case 'full-moon-run': words('×'); number(current.fullMoonFactor, 2); words(' Mult this battle.'); break;
    case 'ape-in': words('×'); number(current.apeInFactor, 3); words(' Mult. Next turn: −2 Seeds.'); break;
    case 'gud-tek': words('Choose an upgradable card in hand to upgrade this battle, or an upgraded card for ×1.5 Squeeks.'); break;
    case 'merge': words('Choose two equal-level copies. Confirm to combine them: +10% stats. Once per act. Level cap 100.'); break;
    default: if (!parts.length) words(CARDS[id]!.text.replace(/\s*Upgrade:.*$/, '')); break;
  }
  if (CARDS[id]!.exhaust && !parts.some(p => p.text.includes('Exhaust'))) words(' Exhaust.');
  if (!isCardUpgradable({ ...card, level: 0 })) words(' Cannot be upgraded.');
  return { text: parts.map(p => p.text).join('').trim(), parts };
}
export interface MergeCandidate { pair: [string, string]; first: CardInstance; second: CardInstance; result: CardInstance; }
export function mergeCandidates(state: RunState): MergeCandidate[] {
  const result: MergeCandidate[] = [];
  for (let i = 0; i < state.deck.length; i++) for (let j = i + 1; j < state.deck.length; j++) {
    const first = state.deck[i]!, second = state.deck[j]!;
    const definition = CARDS[first.id]!;
    const hasStats = !!definition.damage || !!definition.block || ['water-bottle', 'wheel-spin', 'overrun', 'buildooooor', 'peak-rpm', 'gas-war', 'moar'].includes(first.id);
    if (hasStats && first.id === second.id && first.level === second.level && first.mergeLevel === second.mergeLevel && first.mergeLevel < 100) result.push({ pair: [first.uid, second.uid], first, second, result: { ...first, mergeLevel: first.mergeLevel + 1 } });
  }
  return result;
}
export function cardPlayDisabledReason(state: RunState, card: CardInstance): string | undefined {
  if (card.id === 'touch-grass' && state.touchGrassUsed) return 'Once per run — already used';
  if (card.id === 'merge' && state.currentNode >= 0 && state.mergeActs.includes(state.map[state.currentNode]!.act)) return 'Merge already used this act';
  if (card.id === 'merge' && !mergeCandidates(state).length) return 'Needs two matching equal-level cards';
  if (card.id === 'gud-tek' && !state.combat?.hand.some(k => k.uid !== card.uid && (k.level > 0 || isCardUpgradable(k)))) return 'No upgradable card in hand';
  if (state.combat && cardValues(card, state).cost > state.combat.energy) return 'Not enough Seeds';
  return undefined;
}
