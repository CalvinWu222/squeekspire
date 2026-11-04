import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let saved: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => { saved.set(key, value); },
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('presentation preferences', () => {
  it('uses safe defaults and persists every setting across module reloads', async () => {
    let preferences = await import('./preferences');
    expect(preferences.loadPreferences()).toEqual({
      volume: 35, animationSpeed: 'normal', reduceEffects: false, language: 'en',
    });
    const selected = { volume: 72, animationSpeed: 'fast', reduceEffects: true, language: 'en' } as const;
    preferences.savePreferences(selected);
    expect(JSON.parse(saved.get(preferences.PREFERENCES_KEY)!)).toEqual(selected);
    vi.resetModules();
    preferences = await import('./preferences');
    expect(preferences.loadPreferences()).toEqual(selected);
  });

  it('validates malformed storage and clamps volume without accepting truthy strings', async () => {
    const preferences = await import('./preferences');
    for (const input of ['{bad', 'null', '[]', '42', '"settings"']) {
      saved.set(preferences.PREFERENCES_KEY, input);
      expect(preferences.loadPreferences()).toEqual(preferences.DEFAULT_PREFERENCES);
    }
    saved.set(preferences.PREFERENCES_KEY, JSON.stringify({
      volume: 200, animationSpeed: 'warp', reduceEffects: 'false', language: 'xx',
    }));
    expect(preferences.loadPreferences()).toEqual({
      volume: 100, animationSpeed: 'normal', reduceEffects: false, language: 'en',
    });
    saved.set(preferences.PREFERENCES_KEY, JSON.stringify({ volume: -12, language: 'en' }));
    expect(preferences.loadPreferences()).toMatchObject({ volume: 0, language: 'en' });
    saved.set(preferences.PREFERENCES_KEY, JSON.stringify({ volume: '90' }));
    expect(preferences.loadPreferences().volume).toBe(35);
  });

  it('migrates legacy Chinese preferences to English while retaining other settings', async () => {
    const preferences = await import('./preferences');
    saved.set(preferences.PREFERENCES_KEY, JSON.stringify({
      volume: 72, animationSpeed: 'fast', reduceEffects: true, language: 'zh',
    }));
    const migrated = preferences.loadPreferences();
    expect(migrated).toEqual({ volume: 72, animationSpeed: 'fast', reduceEffects: true, language: 'en' });
    preferences.savePreferences(migrated);
    vi.resetModules();
    expect((await import('./preferences')).loadPreferences()).toEqual(migrated);
    expect(JSON.parse(saved.get(preferences.PREFERENCES_KEY)!).language).toBe('en');
  });

  it('keeps the latest session settings when reads or writes are blocked', async () => {
    const preferences = await import('./preferences');
    const initial = { ...preferences.DEFAULT_PREFERENCES, volume: 60 };
    preferences.savePreferences(initial);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: () => { throw new Error('quota'); },
    });
    preferences.savePreferences({ ...initial, volume: 0, language: 'en' });
    expect(preferences.loadPreferences()).toMatchObject({ volume: 0, language: 'en' });
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    });
    expect(preferences.loadPreferences()).toMatchObject({ volume: 0, language: 'en' });
    expect(() => preferences.savePreferences(initial)).not.toThrow();
  });

  it('returns copies so consumers cannot silently mutate saved settings', async () => {
    const preferences = await import('./preferences');
    const selected = { ...preferences.DEFAULT_PREFERENCES, volume: 51 };
    const result = preferences.savePreferences(selected);
    selected.volume = 1;
    result.volume = 2;
    const loaded = preferences.loadPreferences();
    expect(loaded.volume).toBe(51);
    loaded.volume = 3;
    expect(preferences.loadPreferences().volume).toBe(51);
  });

  it('adjusts only UI timing and gives reduced-motion preferences priority', async () => {
    const { DEFAULT_PREFERENCES, motionDuration } = await import('./preferences');
    expect(motionDuration({ ...DEFAULT_PREFERENCES }, 300, false)).toBe(300);
    expect(motionDuration({ ...DEFAULT_PREFERENCES, animationSpeed: 'slow' }, 300, false)).toBe(450);
    expect(motionDuration({ ...DEFAULT_PREFERENCES, animationSpeed: 'fast' }, 300, false)).toBe(180);
    expect(motionDuration({ ...DEFAULT_PREFERENCES, reduceEffects: true }, 300, false)).toBe(0);
    expect(motionDuration({ ...DEFAULT_PREFERENCES }, 300, true)).toBe(0);
    expect(motionDuration({ ...DEFAULT_PREFERENCES }, -1, false)).toBe(0);
    expect(motionDuration({ ...DEFAULT_PREFERENCES }, Number.NaN, false)).toBe(0);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    expect(motionDuration({ ...DEFAULT_PREFERENCES }, 300)).toBe(0);
  });
});
