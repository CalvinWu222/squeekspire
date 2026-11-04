// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fallbackDay } from './game/data';
import { generateMap } from './game/map';
import { act, createRun, type RunState } from './game/engine';

function click(selector: string): void {
  const button = document.querySelector<HTMLButtonElement>(selector);
  expect(button, selector).not.toBeNull(); button!.click();
}
function fixture(kind: 'shop' | 'rest' | 'map' = 'shop', gold = 100): RunState {
  const day = fallbackDay('2026-11-04'); day.priceMultiplier = 1;
  const map = generateMap(day);
  map[0] = { ...map[0]!, kind: kind === 'map' ? 'shop' : kind, jackpot: false };
  const state = createRun(day, map, 'practice');
  const s = kind === 'map' ? state : act(state, { type: 'enter', nodeId: 0 });
  s.gold = gold;
  if (kind === 'shop') s.shop = { removePrice: 50, offers: [
    { kind: 'card', id: 'wheel-kick', price: 50, sold: false },
    { kind: 'relic', id: 'genesis', price: 120, sold: false },
    { kind: 'card', id: 'cheek-pouch', price: 75, sold: false },
  ] };
  return s;
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
const balance = (location: string) => document.querySelector(`[data-coin-balance="${location}"]`);
const buy = (index: number) => document.querySelector<HTMLButtonElement>(`[data-action="buy"][data-index="${index}"]`)!;

describe('coins and affordability at shop, route and rest decisions', () => {
  beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
    localStorage.clear(); document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline fixture')));
  });
  afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('announces the current coins at the shop top and beside the sticky leave button', async () => {
    await boot(fixture());
    for (const location of ['shop-top', 'shop-footer']) {
      expect(balance(location)!.textContent).toBe('YOUR COINS100 SQK');
      expect(balance(location)!.getAttribute('aria-live')).toBe('polite');
    }
    expect(balance('shop-footer')!.closest('.encounter-footer')!.querySelector('[data-action="leave"]')).not.toBeNull();
  });

  it('updates both balances and every offer immediately after buying a card', async () => {
    const s = fixture(), storage = await boot(s);
    expect(buy(2).disabled).toBe(false);
    click('[data-action="buy"][data-index="0"]');
    expect(balance('shop-top')!.textContent).toBe('YOUR COINS50 SQK');
    expect(balance('shop-footer')!.textContent).toBe('YOUR COINS50 SQK');
    expect(buy(0).disabled).toBe(true); expect(buy(0).textContent).toContain('Sold');
    expect(buy(2).disabled).toBe(true);
    expect(buy(2).closest('.shop-item')!.classList.contains('unaffordable')).toBe(true);
    expect(buy(2).querySelector('.unaffordable-price')!.textContent).toBe('75 coins');
    const saved = vi.mocked(storage.saveActive).mock.calls.at(-1)![0];
    expect(saved.gold).toBe(50); expect(saved.deck).toHaveLength(s.deck.length + 1);
  });

  it('updates coins and the owned relic after a relic purchase', async () => {
    const storage = await boot(fixture('shop', 150));
    click('[data-action="buy"][data-index="1"]');
    expect(balance('shop-top')!.textContent).toContain('30 SQK');
    expect(balance('shop-footer')!.textContent).toContain('30 SQK');
    expect(vi.mocked(storage.saveActive).mock.calls.at(-1)![0].relics).toContain('genesis');
    expect(buy(0).disabled).toBe(true); expect(buy(2).disabled).toBe(true);
  });

  it('greys and disables unaffordable cards and relics while retaining their red prices', async () => {
    const storage = await boot(fixture('shop', 10));
    for (let i = 0; i < 3; i++) {
      expect(buy(i).disabled).toBe(true);
      expect(buy(i).closest('.unaffordable')).not.toBeNull();
      expect(buy(i).querySelector('.unaffordable-price')!.textContent).toMatch(/\d+ coins/);
      expect(buy(i).textContent).toContain('Not enough coins');
      buy(i).click();
    }
    expect(document.querySelector<HTMLButtonElement>('[data-action="remove"]')!.disabled).toBe(true);
    expect(document.querySelector<HTMLSelectElement>('#remove-card')!.disabled).toBe(true);
    expect(document.querySelector('.shop-remove .unaffordable-price')!.textContent).toBe('50 coins');
    expect(storage.saveActive).not.toHaveBeenCalled();
  });

  it('allows spending the exact balance and then blocks further purchases and removal', async () => {
    await boot(fixture('shop', 50));
    expect(buy(0).disabled).toBe(false);
    click('[data-action="buy"][data-index="0"]');
    expect(balance('shop-top')!.textContent).toContain('0 SQK');
    expect(balance('shop-footer')!.textContent).toContain('0 SQK');
    expect(buy(0).disabled).toBe(true); expect(buy(1).disabled).toBe(true); expect(buy(2).disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('[data-action="remove"]')!.disabled).toBe(true);
  });

  it('refreshes coins, the removal price and affordability after removing a chosen card', async () => {
    const s = fixture(), storage = await boot(s);
    const select = document.querySelector<HTMLSelectElement>('#remove-card')!;
    const removed = s.deck[1]!.uid; select.value = removed;
    click('[data-action="remove"]');
    expect(balance('shop-top')!.textContent).toContain('50 SQK');
    expect(balance('shop-footer')!.textContent).toContain('50 SQK');
    expect(document.querySelector<HTMLButtonElement>('[data-action="remove"]')!.disabled).toBe(true);
    expect(document.querySelector('.shop-remove .unaffordable-price')!.textContent).toBe('75 coins');
    expect(document.querySelectorAll('#remove-card option')).toHaveLength(s.deck.length - 1);
    const saved = vi.mocked(storage.saveActive).mock.calls.at(-1)![0];
    expect(saved.gold).toBe(50); expect(saved.deck.some(c => c.uid === removed)).toBe(false);
  });

  it('disables removal when only one card remains even when the player can afford it', async () => {
    const s = fixture(); s.deck = s.deck.slice(0, 1);
    const storage = await boot(s);
    expect(document.querySelector<HTMLButtonElement>('[data-action="remove"]')!.disabled).toBe(true);
    expect(document.querySelector<HTMLSelectElement>('#remove-card')!.disabled).toBe(true);
    expect(document.querySelector('.shop-remove')!.textContent).toContain('Keep at least one card');
    click('[data-action="remove"]'); expect(storage.saveActive).not.toHaveBeenCalled();
  });

  it.each(['map', 'rest'] as const)('shows an explicit current balance on the %s screen', async phase => {
    await boot(fixture(phase, 287));
    expect(balance(phase)!.textContent).toBe('YOUR COINS287 SQK');
  });

  it('carries the updated balance from a purchase to the route map', async () => {
    await boot(fixture());
    click('[data-action="buy"][data-index="0"]'); click('.shop-footer [data-action="leave"]');
    expect(balance('map')!.textContent).toBe('YOUR COINS50 SQK');
    expect(balance('shop-top')).toBeNull();
  });

  it('preserves and displays coins on the route after resting', async () => {
    const s = fixture('rest', 287); s.hp = 40;
    await boot(s); click('[data-action="heal"]');
    expect(balance('map')!.textContent).toBe('YOUR COINS287 SQK');
  });
});
