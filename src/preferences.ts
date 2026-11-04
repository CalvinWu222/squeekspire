/** Presentation settings never enter the run state or its deterministic replay. */
export type Language = 'en';
export type AnimationSpeed = 'slow' | 'normal' | 'fast';

export interface Preferences {
  volume: number;
  animationSpeed: AnimationSpeed;
  reduceEffects: boolean;
  language: Language;
}

export const PREFERENCES_KEY = 'squeekspire:v2:preferences';
export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  volume: 35,
  animationSpeed: 'normal',
  reduceEffects: false,
  language: 'en',
});

let sessionPreferences: Preferences | undefined;
let pendingWrite = false;

function validated(value: unknown): Preferences {
  const candidate = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    volume: typeof candidate.volume === 'number' && Number.isFinite(candidate.volume)
      ? Math.round(Math.max(0, Math.min(100, candidate.volume))) : DEFAULT_PREFERENCES.volume,
    animationSpeed: candidate.animationSpeed === 'slow' || candidate.animationSpeed === 'fast'
      ? candidate.animationSpeed : 'normal',
    reduceEffects: typeof candidate.reduceEffects === 'boolean'
      ? candidate.reduceEffects : DEFAULT_PREFERENCES.reduceEffects,
    language: 'en',
  };
}

/** A blocked or full localStorage still preserves settings for the current session. */
export function loadPreferences(): Preferences {
  if (pendingWrite && sessionPreferences) return { ...sessionPreferences };
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    sessionPreferences = validated(stored ? JSON.parse(stored) : undefined);
  } catch {
    sessionPreferences ??= { ...DEFAULT_PREFERENCES };
  }
  return { ...sessionPreferences };
}

export function savePreferences(preferences: Preferences): Preferences {
  sessionPreferences = validated(preferences);
  pendingWrite = true;
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(sessionPreferences));
    pendingWrite = false;
  } catch { /* Keep the in-memory copy when browser storage is unavailable. */ }
  return { ...sessionPreferences };
}

function prefersReducedMotion(): boolean {
  try { return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; }
  catch { return false; }
}

/** UI timing only. Never use this value to advance the combat engine. */
export function motionDuration(
  preferences: Preferences,
  normalMs: number,
  systemReduced = prefersReducedMotion(),
): number {
  if (preferences.reduceEffects || systemReduced || !Number.isFinite(normalMs)) return 0;
  const factor = preferences.animationSpeed === 'slow' ? 1.5
    : preferences.animationSpeed === 'fast' ? 0.6 : 1;
  return Math.round(Math.max(0, normalMs) * factor);
}
