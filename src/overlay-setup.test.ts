// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOverlayUrl, mountOverlaySetup } from './overlay-setup';

describe('OBS setup controls', () => {
  let dispose: (() => void) | undefined;
  const change = (selector: string, checked = true) => {
    const input = document.querySelector<HTMLInputElement>(selector)!;
    input.checked = checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const source = () => new URL(document.querySelector<HTMLInputElement>('[data-os-url]')!.value);
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
    const url = new URL(buildOverlayUrl('https://squeekspire.example', { layout: 'card', scale: 0.75, show: ['status', 'board'], bg: 'transparent' }));
    expect(url.origin).toBe('https://squeekspire.example');
    expect(url.pathname).toBe('/overlay');
    expect(Object.fromEntries(url.searchParams)).toEqual({ layout: 'card', scale: '0.75', show: 'status,board', bg: 'transparent' });
  });

  it('keeps the URL, preview and OBS source dimensions in sync with controls', () => {
    dispose = mountOverlaySetup();
    expect(source().searchParams.get('show')).toBe('status,boss,board');
    expect(document.querySelector('[data-os-size]')!.textContent).toBe('1200 × 260 PX');
    change('input[name="layout"][value="card"]');
    change('input[name="bg"][value="dark"]');
    change('input[name="show"][value="boss"]', false);
    const range = document.querySelector<HTMLInputElement>('#os-scale')!;
    range.value = '1.5';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(Object.fromEntries(source().searchParams)).toEqual({ layout: 'card', scale: '1.5', show: 'status,board', bg: 'dark' });
    expect(document.querySelector<HTMLIFrameElement>('[data-os-preview]')!.src).toBe(source().href);
    expect(document.querySelector<HTMLAnchorElement>('[data-os-open]')!.href).toBe(source().href);
    expect(document.querySelector('[data-os-width]')!.textContent).toBe('660');
    expect(document.querySelector('[data-os-height]')!.textContent).toBe('1200');
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
    expect(Object.fromEntries(source().searchParams)).toEqual({ layout: 'card', scale: '2', show: 'status', bg: 'dark' });
    expect(document.querySelector('[data-os-size]')!.textContent).toBe('880 × 1600 PX');
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
