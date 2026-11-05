// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOverlayUrl, mountOverlaySetup } from './overlay-setup';
import { parseOverlayOptions } from './overlay-data';
import { getOverlaySourceSize } from './overlay-geometry';

describe('OBS setup controls', () => {
  let dispose: (() => void) | undefined;
  const change = (selector: string, checked = true) => {
    const input = document.querySelector<HTMLInputElement>(selector)!;
    input.checked = checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const source = () => new URL(document.querySelector<HTMLInputElement>('[data-os-url]')!.value);
  const select = (name: string, value: string) => {
    const input = document.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  beforeEach(() => {
    // The browser suite verifies iframe loading. Unit tests only need its source URL.
    const sources = new WeakMap<HTMLIFrameElement, string>();
    vi.spyOn(HTMLIFrameElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLIFrameElement, value: string) { sources.set(this, value); });
    vi.spyOn(HTMLIFrameElement.prototype, 'src', 'get').mockImplementation(function (this: HTMLIFrameElement) { return sources.get(this) || ''; });
    document.body.innerHTML = '<div id="app"></div>';
    window.history.replaceState({}, '', '/overlay/setup');
  });
  afterEach(() => {
    dispose?.();
    dispose = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds an explicit same-origin OBS source URL', () => {
    const url = new URL(buildOverlayUrl('https://squeekspire.example', parseOverlayOptions('?layout=card&scale=0.75&show=status,board&pos=bottom-left&opacity=0.75&density=compact&safe=moba&motion=low')));
    expect(url.origin).toBe('https://squeekspire.example');
    expect(url.pathname).toBe('/overlay');
    expect(Object.fromEntries(url.searchParams)).toEqual({ layout: 'card', scale: '0.75', show: 'status,board', bg: 'transparent', pos: 'bottom-left', opacity: '0.75', density: 'compact', safe: 'moba', motion: 'low' });
  });

  it('keeps the URL, preview and OBS source dimensions in sync with controls', () => {
    dispose = mountOverlaySetup();
    expect(source().searchParams.get('show')).toBe('status,boss,board');
    expect(document.querySelector('[data-os-size]')!.textContent).toBe('1920 × 1080 PX');
    change('input[name="layout"][value="card"]');
    change('input[name="bg"][value="dark"]');
    expect(document.querySelector('[data-os-bg-note]')!.textContent).toContain('fills the entire source');
    change('input[name="show"][value="boss"]', false);
    const range = document.querySelector<HTMLInputElement>('#os-scale')!;
    range.value = '1.5';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Object.fromEntries(source().searchParams)).toEqual({ layout: 'card', scale: '1.5', show: 'status,board', bg: 'dark', pos: 'top-left', opacity: '1', density: 'full', safe: 'none', motion: 'low' });
    expect(document.querySelector<HTMLIFrameElement>('[data-os-preview]')!.src).toBe(source().href);
    expect(document.querySelector<HTMLAnchorElement>('[data-os-open]')!.href).toBe(source().href);
    expect(document.querySelector('[data-os-width]')!.textContent).toBe('1920');
    expect(document.querySelector('[data-os-height]')!.textContent).toBe('1080');
    select('source', 'tight');
    const tight = getOverlaySourceSize(parseOverlayOptions(source().search));
    expect(document.querySelector('[data-os-width]')!.textContent).toBe(String(tight.width));
    expect(document.querySelector('[data-os-height]')!.textContent).toBe(String(tight.height));
    expect(document.querySelector<HTMLSelectElement>('#os-canvas')!.disabled).toBe(true);
  });

  it('retains the last enabled panel and explains the constraint', () => {
    dispose = mountOverlaySetup();
    change('input[name="show"][value="boss"]', false);
    change('input[name="show"][value="board"]', false);
    change('input[name="show"][value="status"]', false);
    expect(source().searchParams.get('show')).toBe('status');
    expect(document.querySelector<HTMLInputElement>('input[name="show"][value="status"]')!.checked).toBe(true);
    expect(document.querySelector('[data-os-show-note]')!.textContent).toContain('at least one panel');
  });

  it('uses configured query parameters safely and clamps the preview scale', () => {
    window.history.replaceState({}, '', '/overlay/setup?layout=card&scale=10&show=status,unknown&bg=dark');
    dispose = mountOverlaySetup();
    expect(source().searchParams.get('scale')).toBe('2');
    expect(source().searchParams.get('show')).toBe('status');
    expect(document.querySelector('[data-os-size]')!.textContent).toBe('1920 × 1080 PX');
  });

  it('preserves placement and readability controls in the copied source and preview', () => {
    dispose = mountOverlaySetup();
    select('pos', 'bottom-right');
    select('safe', 'moba');
    select('density', 'min');
    select('motion', 'normal');
    const opacity = document.querySelector<HTMLInputElement>('#os-opacity')!;
    opacity.value = '0.65';
    opacity.dispatchEvent(new Event('input', { bubbles: true }));
    expect(source().searchParams.get('pos')).toBe('bottom-right');
    expect(source().searchParams.get('safe')).toBe('moba');
    expect(source().searchParams.get('density')).toBe('min');
    expect(source().searchParams.get('motion')).toBe('normal');
    expect(source().searchParams.get('opacity')).toBe('0.65');
    expect(document.querySelector('[data-os-opacity-label]')!.textContent).toBe('65%');
    expect(document.querySelector('[data-os-placement]')!.textContent).toContain('right 22%');
    expect(document.querySelector<HTMLIFrameElement>('[data-os-preview]')!.src).toBe(source().href);
  });

  it('offers every supported anchor without falling back to the default', () => {
    dispose = mountOverlaySetup();
    for (const position of ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']) {
      select('pos', position);
      expect(source().searchParams.get('pos')).toBe(position);
    }
  });

  it('matches each canvas preset without changing the overlay scale or aspect ratio', () => {
    dispose = mountOverlaySetup();
    for (const [value, width, height] of [['1280x720', '1280', '720'], ['2560x1440', '2560', '1440'], ['1080x1920', '1080', '1920']]) {
      select('canvas', value);
      expect(document.querySelector('[data-os-width]')!.textContent).toBe(width);
      expect(document.querySelector('[data-os-height]')!.textContent).toBe(height);
      const frame = document.querySelector<HTMLIFrameElement>('[data-os-preview]')!;
      expect(frame.style.width).toBe(`${width}px`);
      expect(frame.style.height).toBe(`${height}px`);
      expect(frame.style.transform).toMatch(/^scale\([\d.]+\)$/);
      expect(source().searchParams.get('scale')).toBe('1');
    }
  });

  it('shows small-text guidance and preserves explicit initial parameters', () => {
    window.history.replaceState({}, '', '/overlay/setup?scale=.5&density=compact&pos=right&safe=fps&motion=normal&opacity=.5&canvas=1280x720');
    dispose = mountOverlaySetup();
    expect(source().searchParams.get('motion')).toBe('normal');
    expect(source().searchParams.get('pos')).toBe('right');
    expect(source().searchParams.get('density')).toBe('compact');
    expect(source().searchParams.get('opacity')).toBe('0.5');
    expect(document.querySelector('[data-os-readability]')!.textContent).toContain('Small text warning');
    expect(document.querySelector('[data-os-size]')!.textContent).toBe('1280 × 720 PX');
    expect(document.querySelector('[data-os-source-note]')!.textContent).toContain('fits uniformly');
  });

  it('recommends a compact bar or minimal card for 720p and flags taller cards near webcams', () => {
    window.history.replaceState({}, '', '/overlay/setup?layout=card&density=compact&safe=moba&canvas=1280x720');
    dispose = mountOverlaySetup();
    expect(document.querySelector('[data-os-readability]')!.textContent).toContain('Compact bar or Minimal card');
    expect(document.querySelector('[data-os-readability]')!.textContent).toContain('bottom-left webcam');
    expect(document.querySelector('[data-os-readability]')!.textContent).toContain('Full detail can still be too small');
    select('density', 'min');
    expect(document.querySelector('[data-os-readability]')!.textContent).not.toContain('bottom-left webcam');
  });

  it('copies the current URL and shows clear clipboard feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    dispose = mountOverlaySetup();
    document.querySelector<HTMLButtonElement>('[data-os-copy]')!.click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith(source().href);
    expect(document.querySelector('[data-os-copy-status]')!.textContent).toContain('URL copied');
  });

  it('selects the source for manual copy when clipboard permission is denied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) } });
    dispose = mountOverlaySetup();
    const select = vi.spyOn(document.querySelector<HTMLInputElement>('[data-os-url]')!, 'select');
    document.querySelector<HTMLButtonElement>('[data-os-copy]')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(select).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-os-copy-status]')!.textContent).toContain('press Ctrl+C');
  });

  it('restores page state and removes the live preview on disposal', () => {
    document.title = 'Original title';
    dispose = mountOverlaySetup();
    expect(document.body.classList.contains('os-body')).toBe(true);
    dispose(); dispose = undefined;
    expect(document.title).toBe('Original title');
    expect(document.body.classList.contains('os-body')).toBe(false);
    expect(document.querySelector('iframe')).toBeNull();
  });
});
