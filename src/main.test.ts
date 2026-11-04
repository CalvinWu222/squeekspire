// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RunMode } from './game/types';

function click(selector: string): void {
  const button = document.querySelector<HTMLElement>(selector);
  expect(button, `Expected UI control ${selector}`).not.toBeNull();
  button!.click();
}

async function boot(): Promise<void> {
  await import('./main');
  await vi.waitFor(() => expect(document.querySelector('.hero-title')).not.toBeNull());
}

function begin(mode: RunMode): void {
  click('[data-action="start"]');
  click(`[data-action="mode"][data-mode="${mode}"]`);
  click('[data-action="begin"]');
  expect(document.querySelector('.combat-panel')).not.toBeNull();
}

describe('playable single-page flow without opening a browser', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-04T05:00:00Z'));
    localStorage.clear();
    window.location.hash = '';
    document.body.innerHTML = '<div id="app"></div>';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline smoke test')));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the title focused and claims the daily attempt only when the selected character begins', async () => {
    await boot();
    expect(document.querySelector('footer.site-footer')?.textContent).toContain('Unofficial fan-made game, not affiliated with Squeekchain');
    expect(document.querySelector('.map-node, .leaderboard-row, [data-action="export"]')).toBeNull();
    expect(document.querySelector('[data-action="resume"]')).toBeNull();
    for (const action of ['start', 'collection', 'help', 'settings']) {
      expect(document.querySelector(`[data-action="${action}"]`)).not.toBeNull();
    }
    click('[data-action="start"]');
    for (const mode of ['daily', 'practice', 'endless']) {
      expect(document.querySelector(`[data-action="mode"][data-mode="${mode}"]`)).not.toBeNull();
    }
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
    click('[data-action="mode"][data-mode="daily"]');
    expect(document.body.textContent).toContain('Zoomie Gremlin');
    for (const name of ['Seed Hoarder', 'Professional Napper']) {
      const locked = Array.from(document.querySelectorAll<HTMLButtonElement>('button:disabled')).find(button => button.textContent?.includes(name));
      expect(locked, `${name} should be visibly locked`).toBeDefined();
    }
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
    click('[data-action="begin"]');
    expect(document.querySelector('.combat-panel')).not.toBeNull();
    expect(document.querySelector('.map-panel')).toBeNull();
    expect(JSON.parse(localStorage.getItem('squeekspire:v1:official-days')!)).toEqual(['2026-11-04']);
    const { replayRun } = await import('./game/engine');
    const saved = JSON.parse(localStorage.getItem('squeekspire:v1:active:daily')!);
    const replay = replayRun(saved);
    expect(replay.phase).toBe('combat');
    expect(replay.log.some(action => action.type === 'enter')).toBe(true);
    expect(replay.combat!.turn).toBe(1);
  });

  it('targets an attack, ends the turn, and records abandonment once in the secondary menu', async () => {
    await boot();
    begin('daily');
    const before = Number(document.querySelector('.energy-display strong')!.textContent);
    const savedBeforeSelection = localStorage.getItem('squeekspire:v1:active:daily');
    const card = document.querySelector<HTMLButtonElement>('.hand .card.attack:not(:disabled)');
    expect(card).not.toBeNull();
    const cost = Number(card!.querySelector('.card-cost')!.textContent);
    card!.click();
    expect(Number(document.querySelector('.energy-display strong')!.textContent)).toBe(before);
    expect(localStorage.getItem('squeekspire:v1:active:daily')).toBe(savedBeforeSelection);
    click('.enemy-card:not(.defeated)');
    expect(Number(document.querySelector('.energy-display strong')!.textContent)).toBe(before - cost);
    click('[data-action="end-turn"]');
    expect(document.querySelector('.combat-header .chip')!.textContent).toContain('TURN 2');
    expect(document.querySelector('[data-action="abandon"]')).toBeNull();
    click('[data-action="more"]');
    click('[data-action="abandon"]');
    expect(document.querySelector('.run-result')).not.toBeNull();
    expect(document.querySelector('.leaderboard-row')).toBeNull();
    click('[data-action="more"]');
    expect(document.querySelectorAll('.leaderboard-row')).toHaveLength(1);
    click('[data-action="close"]');
    click('[data-action="home"]');
    expect(document.querySelector('[data-action="resume"]')).toBeNull();
    expect(JSON.parse(localStorage.getItem('squeekspire:v1:official-days')!)).toEqual(['2026-11-04']);
  });

  it('opens the complete codex and starts practice without consuming an official attempt', async () => {
    await boot();
    click('[data-action="collection"]');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelectorAll('.catalog-grid .card').length).toBeGreaterThan(30);
    click('[data-action="collection-tab"][data-tab="relics"]');
    expect(document.querySelectorAll('.collection-entry .relic-source')).toHaveLength(15);
    expect(document.querySelector('.relic-source')?.textContent).toContain('Starting relic');
    expect(document.body.textContent).toContain('Treasure room');
    click('[data-action="close"]');
    begin('practice');
    click('.chain-help summary');
    expect(document.querySelector('.chain-help[open] .chain-rules')?.textContent).toContain('Taking enemy damage does not break Chain');
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
    click('[data-action="more"]');
    click('[data-action="abandon"]');
    expect(document.body.textContent).toContain('PRACTICE RUN');
    click('[data-action="again"][data-mode="practice"]');
    expect(document.querySelector('.run-result')).toBeNull();
    expect(document.querySelector('.combat-panel')).not.toBeNull();
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
  });

  it('expires endless at five minutes and keeps its leaderboard separate', async () => {
    await boot();
    begin('endless');
    await vi.advanceTimersByTimeAsync(301_000);
    expect(document.querySelector('.run-result')).not.toBeNull();
    expect(document.body.textContent).toContain('ENDLESS RUN');
    click('[data-action="more"]');
    expect(document.querySelectorAll('.leaderboard-row')).toHaveLength(1);
    click('[data-action="board"][data-mode="daily"]');
    expect(document.querySelectorAll('.leaderboard-row')).toHaveLength(0);
    expect(localStorage.getItem('squeekspire:v1:official-days')).toBeNull();
  });
});
