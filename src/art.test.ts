import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { CARDS, ENEMIES } from './game/catalog';
import { cardArt, cardFlavor, nodeIcon, sceneArt, spriteArt } from './art';

describe('the original illustrated collection', () => {
  it('gives every catalog card a distinct illustration instead of the unknown-card fallback', () => {
    const pictures = Object.keys(CARDS).map(cardArt);
    expect(new Set(pictures).size).toBe(Object.keys(CARDS).length);
    for (const picture of pictures) expect(picture).not.toBe(cardArt('unknown-card'));
  });

  it('gives the player and every enemy a distinct sprite', () => {
    const ids = ['zoomie-gremlin', ...Object.keys(ENEMIES)];
    expect(new Set(ids.map(spriteArt)).size).toBe(ids.length);
  });

  it('keeps all illustrations self-contained, accessible, and valid inline SVG', () => {
    const window = new Window();
    const parser = new window.DOMParser();
    const pictures = [
      ...Object.keys(CARDS).map(cardArt),
      ...['zoomie-gremlin', ...Object.keys(ENEMIES)].map(spriteArt),
      ...(['camp', 'shop', 'rest', 'results', 'event'] as const).map(sceneArt),
      ...['battle', 'elite', 'boss', 'shop', 'rest', 'event', 'treasure'].map(nodeIcon),
    ];
    for (const picture of pictures) {
      const document = parser.parseFromString(picture, 'image/svg+xml');
      const svg = document.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
      expect(svg?.getAttribute('shape-rendering')).toBe('crispEdges');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      expect(svg?.querySelector('path,rect')).not.toBeNull();
      expect(document.querySelector('parsererror,image,script,foreignObject,a')).toBeNull();
      expect(picture).not.toMatch(/(?:href=|url\(|undefined|NaN)/);
    }
  });

  it('supplies flavor for every meme card without changing catalog rules', () => {
    const cards = Object.values(CARDS);
    const memeCards = cards.slice(cards.findIndex(card => card.id === 'maus-mode'));
    for (const card of memeCards) expect(card.flavor ?? cardFlavor(card.id)).toBeTruthy();
    expect(cardFlavor('unknown-card')).toBeUndefined();
  });
});
