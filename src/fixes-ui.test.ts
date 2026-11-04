// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fallbackDay } from './game/data';
import { generateMap } from './game/map';
import { act, createRun, type CardInstance, type RunState } from './game/engine';

const card = (id: string, uid = id, level = 0, mergeLevel = 0): CardInstance => ({ id, uid, level, mergeLevel });
function click(selector: string): void {
  const element = document.querySelector<HTMLElement>(selector);
  expect(element, selector).not.toBeNull(); element!.click();
}
function fixture(kind: 'battle' | 'rest' | 'event' = 'battle'): RunState {
  const day = fallbackDay('2026-11-04'), map = generateMap(day);
  map[0] = { ...map[0], kind, enemyId: 'dust-mite', jackpot: false };
  return act(createRun(day, map, 'practice'), { type: 'enter', nodeId: 0 });
}
async function boot(state: RunState) {
  const data = await import('./game/data'), storage = await import('./game/storage');
  vi.spyOn(data, 'loadDay').mockResolvedValue(state.day);
  vi.spyOn(storage, 'loadActive').mockImplementation(mode => mode === 'practice' ? structuredClone(state) : null);
  vi.spyOn(storage, 'saveActive').mockImplementation(() => {});
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
  click('[data-action="resume"]');
  return storage;
}

describe('playtest fixes at the decision surface', () => {
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
  });
  afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('inspects Oracle draws, cancels for free, then records the second choice only after confirmation', async () => {
    const s = fixture();
    s.combat!.hand = [card('oracle-ping')];
    s.combat!.draw = [card('wheel-kick', 'draw3'), card('cheek-pouch', 'draw2'), card('seed-snack', 'draw1')];
    const storage = await boot(s);
    click('.hand [data-id="oracle-ping"]');
    expect(document.querySelector('.modal-card-choice')).not.toBeNull();
    expect(Array.from(document.querySelectorAll<HTMLElement>('[data-action="choose-card"]'), e => e.dataset.uid)).toEqual(['draw1', 'draw2', 'draw3']);
    expect(document.querySelector<HTMLButtonElement>('[data-action="confirm-play"]')!.disabled).toBe(true);
    click('[data-action="choose-card"][data-index="1"]');
    expect(document.querySelector('.choice-outcome')!.textContent).toContain('Cheek Pouch');
    click('[data-action="cancel-play"]');
    expect(storage.saveActive).not.toHaveBeenCalled();
    click('.hand [data-id="oracle-ping"]'); click('[data-action="choose-card"][data-index="1"]');
    expect(storage.saveActive).not.toHaveBeenCalled();
    click('[data-action="confirm-play"]');
    const expected = act(s, { type: 'play', uid: 'oracle-ping', target: 'e0', choice: 1 });
    expect(storage.saveActive).toHaveBeenLastCalledWith(expected);
    expect(expected.combat!.draw.at(-1)!.uid).toBe('draw2');
    expect(expected.log.at(-1)).toMatchObject({ choice: 1 });
  });

  it('requires an eligible Gud Tek target and upgrades the second chosen hand card', async () => {
    const s = fixture();
    s.combat!.hand = [card('gud-tek'), card('gm'), card('cheek-pouch'), card('wheel-kick')];
    const storage = await boot(s);
    click('.hand [data-id="gud-tek"]');
    expect(document.querySelector<HTMLButtonElement>('[data-action="choose-card"][data-index="0"]')!.disabled).toBe(true);
    click('[data-action="choose-card"][data-index="1"]'); click('[data-action="confirm-play"]');
    const saved = vi.mocked(storage.saveActive).mock.calls.at(-1)![0];
    expect(saved.log.at(-1)).toMatchObject({ choice: 1 });
    expect(saved.combat!.hand.find(c => c.id === 'cheek-pouch')!.level).toBe(1);
    expect(saved.combat!.hand.find(c => c.id === 'wheel-kick')!.level).toBe(0);
  });

  it.each([{ id: 'overrun', damage: 8 }, { id: 'gas-war', damage: 36 }])('previews $id using the actual state after Gud Tek pays its cost', async ({ id, damage }) => {
    const s = fixture();
    s.combat!.energy = 3; s.combat!.turnCards = [];
    s.combat!.hand = [card('gud-tek'), card(id)];
    const storage = await boot(s);
    click('.hand [data-id="gud-tek"]');
    click('[data-action="choose-card"][data-index="0"]');
    expect(document.querySelector('.choice-outcome')!.textContent).toContain(`Deal ${damage} damage.`);
    expect(storage.saveActive).not.toHaveBeenCalled();
    click('[data-action="confirm-play"]');
    const saved = vi.mocked(storage.saveActive).mock.calls.at(-1)![0];
    expect(saved.combat!.energy).toBe(2);
    expect(document.querySelector(`.hand [data-id="${id}"] .card-description`)!.textContent).toContain(`Deal ${damage} damage.`);
  });

  it('keeps Vulnerable target modifiers out of static codex and deck previews', async () => {
    const s = fixture();
    s.combat!.enemies[0]!.vulnerable = 2;
    s.combat!.hand = [card('wheel-kick')];
    s.deck = [card('wheel-kick', 'deck-kick')];
    await boot(s);
    expect(document.querySelector('.hand .card-description')!.textContent).toContain('Deal 9 damage.');
    click('[data-action="deck"]');
    expect(document.querySelector('.modal-deck .card-description')!.textContent).toContain('Deal 6 damage.');
  });

  it('shows the exact Merge pair and result and charges only after confirmation', async () => {
    const s = fixture();
    s.deck = [card('wheel-kick', 'kick1'), card('wheel-kick', 'kick2'), card('cheek-pouch', 'pouch1'), card('cheek-pouch', 'pouch2'), card('merge')];
    s.combat!.hand = [card('merge')];
    const storage = await boot(s);
    click('.hand [data-id="merge"]');
    const pair = document.querySelector<HTMLSelectElement>('#merge-pair')!;
    pair.value = '1'; pair.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelector('.merge-result [data-id="cheek-pouch"]')).not.toBeNull();
    expect(document.querySelector('.merge-result .card-description')!.textContent).toContain('6 Block');
    expect(storage.saveActive).not.toHaveBeenCalled();
    click('[data-action="cancel-play"]'); expect(storage.saveActive).not.toHaveBeenCalled();
    click('.hand [data-id="merge"]');
    const second = document.querySelector<HTMLSelectElement>('#merge-pair')!;
    second.value = '1'; second.dispatchEvent(new Event('change', { bubbles: true }));
    click('[data-action="confirm-play"]');
    const saved = vi.mocked(storage.saveActive).mock.calls.at(-1)![0];
    expect(saved.log.at(-1)).toMatchObject({ mergePair: ['pouch1', 'pouch2'] });
    expect(saved.deck.find(c => c.uid === 'pouch1')!.mergeLevel).toBe(1);
    expect(saved.deck.some(c => c.uid === 'pouch2')).toBe(false);
  });

  it('visibly disables a spent Touch Grass and displays computed upgraded and reduced values', async () => {
    const s = fixture(); s.touchGrassUsed = true;
    s.combat!.weak = 1;
    s.combat!.hand = [card('touch-grass'), card('wheel-kick'), card('sunflower-stash', 'stash', 1)];
    const storage = await boot(s);
    const grass = document.querySelector<HTMLButtonElement>('.hand [data-id="touch-grass"]')!;
    expect(grass.disabled).toBe(true); expect(grass.textContent).toContain('Once per run — already used');
    grass.click(); expect(storage.saveActive).not.toHaveBeenCalled();
    expect(document.querySelector('.hand [data-id="wheel-kick"] .card-value.reduced')!.textContent).toBe('5');
    expect(document.querySelector('.hand [data-id="sunflower-stash"] .card-value.buffed')!.textContent).toBe('8');
    expect(document.querySelector('.hand [data-id="sunflower-stash"]')!.getAttribute('aria-label')).toContain('8 Block');
  });

  it('opens mobile skill previews without playing, with explicit play and cancel', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    const s = fixture(); s.combat!.hand = [card('cheek-pouch')];
    const storage = await boot(s);
    click('.hand [data-id="cheek-pouch"]');
    expect(document.querySelector('.large-card-preview .card-description')!.textContent).toContain('5 Block');
    expect(storage.saveActive).not.toHaveBeenCalled();
    click('[data-action="cancel-play"]'); expect(storage.saveActive).not.toHaveBeenCalled();
    click('.hand [data-id="cheek-pouch"]'); click('[data-action="preview-play"]');
    expect(storage.saveActive).toHaveBeenLastCalledWith(act(s, { type: 'play', uid: 'cheek-pouch', target: 'e0' }));
  });

  it.each(['en', 'zh'] as const)('shows English rest outcomes and upgrade previews with saved %s preferences', async language => {
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ language }));
    const s = fixture('rest'); s.hp = 69;
    s.deck.push(card('gm', 'not-upgradable'), card('insomnia', 'real-upgrade'));
    const storage = await boot(s);
    expect(document.querySelector('[data-action="heal"]')!.textContent).toContain('Heal 3 (to full)');
    expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
    expect(document.querySelector('#upgrade-card [value="not-upgradable"]')).toBeNull();
    const select = document.querySelector<HTMLSelectElement>('#upgrade-card')!;
    select.value = 'real-upgrade'; select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(document.querySelectorAll('.upgrade-preview .card-description')[1].textContent).toContain('Draw +2');
    click('[data-action="upgrade"]');
    expect(vi.mocked(storage.saveActive).mock.calls.at(-1)![0].deck.find(c => c.uid === 'real-upgrade')!.level).toBe(1);
  });

  it.each(['en', 'zh'] as const)('explains capped event HP changes and the card pool in English with saved %s preferences', async language => {
    localStorage.setItem('squeekspire:v2:preferences', JSON.stringify({ language }));
    const s = fixture('event'); s.hp = 1;
    await boot(s);
    expect(document.querySelector('[data-action="event"][data-index="0"]')!.textContent).toContain('lose 0 HP (1 → 1)');
    expect(document.querySelector('[data-action="event"][data-index="1"]')!.textContent).toContain('Sleep Cam');
    expect(document.querySelector('[data-action="event"][data-index="1"]')!.textContent).toContain('Heal 10');
    expect(document.body.innerHTML).not.toMatch(/[\u3400-\u9fff]/u);
  });

  it('uses distinct relic glyphs and opens an accessible tap tooltip without changing the run', async () => {
    const s = fixture(); s.relics = ['midnight-wheel', 'diamond-hands', 'live-camera'];
    const storage = await boot(s);
    const icons = Array.from(document.querySelectorAll('.top-relic svg'), element => element.innerHTML);
    expect(new Set(icons).size).toBe(3);
    click('[data-action="relic"][data-id="diamond-hands"]');
    expect(document.querySelector('.modal-relic')!.textContent).toContain('Retain your hand');
    expect(storage.saveActive).not.toHaveBeenCalled();
  });

  it('renders explainable per-battle scoring and damage totals on the result screen', async () => {
    const s = fixture(); s.combat!.squeeks = 30; s.combat!.multiply = 2; s.combat!.damageTaken = 4; s.damageTaken = 4;
    s.combat!.enemies.forEach(enemy => enemy.hp = 0);
    const won = act(s, { type: 'endTurn' });
    // Keep a legal finished fight snapshot, then abandon the remaining route through the UI.
    won.phase = 'map';
    await boot(won); click('[data-action="more"]'); click('[data-action="abandon"]');
    expect(document.querySelector('.score-breakdown')).not.toBeNull();
    expect(document.querySelector('.score-table tbody tr')).not.toBeNull();
    expect(document.querySelector('.score-breakdown')!.textContent).toContain('Damage taken4 HP');
    expect(document.querySelector('.score-breakdown')!.textContent).toContain('Base Squeeks30');
  });

  it('preserves tiny trigger factors and explains when the minimum multiplier wins', async () => {
    const s = fixture();
    s.combat!.squeeks = 30;
    s.combat!.multiply = 0.000005;
    s.combat!.enemies.forEach(enemy => enemy.hp = 0);
    const won = act(s, { type: 'endTurn' });
    won.phase = 'map';
    await boot(won); click('[data-action="more"]'); click('[data-action="abandon"]');
    const row = document.querySelector('.score-table tbody tr')!.textContent;
    expect(row).toContain('triggers 5.00e-6');
    expect(row).toContain('floor 1');
    expect(row).toContain('×1');
  });
});
