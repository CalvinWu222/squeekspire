// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { GUIDE_PAGE_COUNT, guideMarkup, t, wheelArt, type MenuKey } from './guide';

function renderGuide(page: number): HTMLDivElement {
  const container = document.createElement('div');
  container.innerHTML = guideMarkup('en', page);
  return container;
}

describe('English visual tip guide', () => {
  it('provides English text for every menu key', () => {
    const keys: MenuKey[] = [
      'start', 'continue', 'codex', 'help', 'settings', 'more', 'back', 'daily', 'practice',
      'endless', 'chooseMode', 'chooseCharacter', 'begin', 'volume', 'speed', 'reduceEffects', 'language',
      'seeds', 'needMoreSeeds', 'leaveShop', 'continueRoute',
    ];
    for (const key of keys) {
      expect(t('en', key)).toBeTruthy();
      expect(t('en', key)).not.toMatch(/[\u3400-\u9fff]/);
    }
  });

  it('keeps sunflower Seeds as the card energy in the menu and basic instructions', () => {
    expect(t('en', 'seeds')).toBe('Seeds');
    expect(t('en', 'needMoreSeeds')).toContain('SEEDS');
    expect(guideMarkup('en', 0)).toContain('3 Seeds');
    expect(guideMarkup('en', 0)).toContain('small seed on a card shows its cost');
    expect(renderGuide(0).querySelector('.guide-copy')?.textContent).toContain('Spend sunflower Seeds');
    expect(renderGuide(0).querySelector('.guide-art svg')?.getAttribute('aria-label')).toContain('sunflower Seeds');
  });

  it('renders five compact, distinct illustrated tips with reachable accessible navigation', () => {
    expect(GUIDE_PAGE_COUNT).toBe(5);
    const titles = new Set<string>();
    for (let page = 0; page < GUIDE_PAGE_COUNT; page++) {
      const container = renderGuide(page);
      const title = container.querySelector('.guide-copy h2')!.textContent!;
      titles.add(title);
      expect(container.querySelectorAll('.guide-copy p')).toHaveLength(1);
      expect(container.querySelector('.guide-copy p')!.textContent!.length).toBeLessThan(110);
      expect(container.innerHTML).not.toMatch(/[\u3400-\u9fff]/);
      const art = container.querySelector('.guide-art svg[role="img"]');
      expect(art?.getAttribute('aria-label')).toBeTruthy();
      expect(art?.querySelectorAll('path').length).toBeGreaterThan(0);
      const slide = container.querySelector(`[data-guide-page="${page}"]`)!;
      expect(slide.getAttribute('aria-roledescription')).toBeTruthy();
      expect(slide.getAttribute('aria-label')).toContain(`${page + 1}`);
      expect(container.querySelector('.guide-dot[aria-current="page"]')?.getAttribute('data-page')).toBe(String(page));
      expect(container.querySelectorAll('.guide-dot')).toHaveLength(5);
      expect(container.querySelectorAll('.guide-dot[aria-current="page"]')).toHaveLength(1);
      for (const button of container.querySelectorAll<HTMLButtonElement>('.guide-nav button')) {
        expect(button.getAttribute('aria-label')).toBeTruthy();
        expect(button.dataset.action).toBe('guide-page');
        expect(Number(button.dataset.page)).toBeGreaterThanOrEqual(0);
        expect(Number(button.dataset.page)).toBeLessThan(5);
      }
    }
    expect(titles.size).toBe(5);
  });

  it('teaches Seeds, intent and block, ending a turn, routes, then captured run influence', () => {
    const lines = Array.from({ length: GUIDE_PAGE_COUNT }, (_, page) => renderGuide(page).querySelector('.guide-copy')!.textContent!);
    expect(lines[0]).toContain('Spend sunflower Seeds');
    expect(lines[1]).toContain('enemy intent');
    expect(lines[1]).toContain('block');
    expect(lines[2]).toContain('End Turn');
    expect(lines[2]).toContain('draw fresh cards and refill');
    expect(lines[3]).toContain('lit route on the map');
    expect(lines[4]).toContain('Captured snapshot');
    expect(lines[4]).toContain('routes, encounters, rewards & prices');
    expect(lines[4]).toContain('daily refresh coming soon');
  });

  it('keeps complete rules behind an initially collapsed native details outside the swipe card', () => {
    const container = renderGuide(0);
    const details = container.querySelector<HTMLDetailsElement>('details.guide-details')!;
    expect(details.open).toBe(false);
    expect(details.closest('.guide-page')).toBeNull();
    expect(details.querySelector('summary')!.textContent).toBe('More details');
    expect(details.querySelectorAll('h3')).toHaveLength(4);
    expect(guideMarkup('en', 0)).toContain('click the card and then its target');
    expect(guideMarkup('en', 0)).toContain('block');
    expect(guideMarkup('en', 0)).toContain('×1.1 chain, capped at 20');
    expect(guideMarkup('en', 0)).toContain('Gold Zoomies hours double multiplicative triggers');
    expect(guideMarkup('en', 0)).toContain('captured real hamster run snapshot');
    expect(guideMarkup('en', 2)).toContain('does not multiply the damage');
    expect(guideMarkup('en', 3)).toContain('each UTC day, resetting at 00:00 UTC');
    expect(guideMarkup('en', 3)).not.toMatch(/Beijing|Shanghai|UTC\+8/);
    expect(guideMarkup('en', 3)).toContain('Starting the run uses your attempt, even if you abandon it');
    expect(guideMarkup('en', 3)).toContain('five-minute');
    expect(guideMarkup('en', 3)).toContain('Local leaderboard (this device)');
    expect(guideMarkup('en', 3)).toContain('resets the attempt allowance, not the captured data snapshot');
  });

  it('clamps invalid page indices and disables impossible previous/next navigation', () => {
    expect(guideMarkup('en', -10)).toContain('data-guide-page="0"');
    expect(guideMarkup('en', Number.NaN)).toContain('data-guide-page="0"');
    expect(guideMarkup('en', 10)).toContain('data-guide-page="4"');
    expect(guideMarkup('en', 2.8)).toContain('data-guide-page="2"');
    const first = renderGuide(0);
    expect(first.querySelector<HTMLButtonElement>('.guide-nav > button:first-child')?.disabled).toBe(true);
    const last = renderGuide(4);
    expect(last.querySelector<HTMLButtonElement>('.guide-nav > button:last-child')?.disabled).toBe(true);
  });

  it('provides original inline wheel art with separately animatable rotor and hamster', () => {
    const container = document.createElement('div');
    container.innerHTML = wheelArt();
    expect(container.querySelector('svg[shape-rendering="crispEdges"]')).not.toBeNull();
    expect(container.querySelector('.wheel-rotor path')).not.toBeNull();
    expect(container.querySelector('.wheel-hamster path')).not.toBeNull();
    expect(container.querySelector('image')).toBeNull();
  });
});
