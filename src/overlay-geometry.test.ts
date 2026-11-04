import { describe, expect, it } from 'vitest';
import { parseOverlayOptions } from './overlay-data';
import { fitOverlay, getOverlayGeometry, getOverlaySafeArea, getOverlaySourceSize } from './overlay-geometry';

describe('OBS source geometry', () => {
  it('shares stable shadow-inclusive source dimensions with setup', () => {
    expect(getOverlaySourceSize(parseOverlayOptions(''))).toEqual({ width: 1200, height: 284 });
    expect(getOverlaySourceSize(parseOverlayOptions('?layout=card'))).toEqual({ width: 440, height: 716 });
    expect(getOverlaySourceSize(parseOverlayOptions('?layout=card&density=min&show=status&scale=1.5'))).toEqual({ width: 528, height: 231 });
  });

  it('fits every anchor and scale uniformly inside all requested canvas shapes', () => {
    for (const [width, height] of [[1920, 1080], [1280, 720], [2560, 1440], [1080, 1920], [300, 100]]) {
      for (const layout of ['bar', 'card']) for (const density of ['full', 'compact', 'min']) {
        for (const scale of [.5, 1, 2]) for (const safe of ['none', 'moba', 'fps']) {
          for (const pos of ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']) {
            const options = parseOverlayOptions(`?layout=${layout}&density=${density}&scale=${scale}&safe=${safe}&pos=${pos}`);
            const result = fitOverlay(options, width, height);
            const geometry = getOverlayGeometry(options);
            const area = getOverlaySafeArea(width, height, options.safe);
            expect(result.scale).toBeGreaterThan(0);
            expect(result.scale).toBeLessThanOrEqual(scale);
            expect(result.left).toBeGreaterThanOrEqual(area.left - .00001);
            expect(result.top).toBeGreaterThanOrEqual(area.top - .00001);
            expect(result.left + geometry.stageWidth * result.scale).toBeLessThanOrEqual(area.left + area.width + .00001);
            expect(result.top + geometry.stageHeight * result.scale).toBeLessThanOrEqual(area.top + area.height + .00001);
          }
        }
      }
    }
  });

  it('anchors correctly rather than stretching a short source to fill it', () => {
    const options = parseOverlayOptions('?pos=bottom-right');
    expect(fitOverlay(options, 1920, 1080)).toEqual({ scale: 1, left: 720, top: 796 });
    const narrow = fitOverlay(options, 600, 600);
    expect(narrow).toEqual({ scale: .5, left: 0, top: 458 });
  });

  it('reserves the documented MOBA and FPS full-canvas gutters only on canvas sources', () => {
    expect(getOverlaySafeArea(1920, 1080, 'moba')).toEqual({ left: 57.599999999999994, top: 129.6, width: 1440, height: 691.2 });
    const fps = getOverlaySafeArea(1280, 720, 'fps');
    expect(fps.width).toBeCloseTo(1203.2);
    expect(fps.height).toBeCloseTo(489.6);
    expect(getOverlaySafeArea(440, 716, 'moba')).toEqual({ left: 0, top: 0, width: 440, height: 716 });
  });
});
