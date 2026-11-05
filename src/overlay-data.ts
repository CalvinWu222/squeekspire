import { getGameDay, loadPublishedDay } from './game/data';
import type { DayData } from './game/types';

export type OverlaySection = 'status' | 'boss' | 'board';
export type OverlayPosition = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';

export interface OverlayOptions {
  layout: 'bar' | 'card';
  scale: number;
  show: OverlaySection[];
  bg: 'transparent' | 'dark';
  pos: OverlayPosition;
  opacity: number;
  density: 'full' | 'compact' | 'min';
  safe: 'none' | 'moba' | 'fps';
  motion: 'normal' | 'low';
}

export interface HamsterStatus {
  state: 'spinning' | 'idle' | 'unavailable';
  rpm?: number;
  distanceMeters?: number;
  observedAt?: string;
  reason?: string;
}

const SECTIONS: OverlaySection[] = ['status', 'boss', 'board'];
const STATUS_URL = 'https://api.squeekchain.com/v1/status';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Invalid URL values fall back to a useful, visible overlay. */
export function parseOverlayOptions(search: string): OverlayOptions {
  const params = new URLSearchParams(search);
  const scaleValue = params.get('scale')?.trim();
  const scale = scaleValue ? Number(scaleValue) : 1;
  const opacityValue = params.get('opacity')?.trim();
  const opacity = opacityValue ? Number(opacityValue) : 1;
  const requested = (params.get('show') ?? '').split(',').map(value => value.trim());
  const show = [...new Set(requested.filter((value): value is OverlaySection => SECTIONS.includes(value as OverlaySection)))];
  return {
    layout: params.get('layout') === 'card' ? 'card' : 'bar',
    scale: Number.isFinite(scale) ? Math.min(2, Math.max(0.5, scale)) : 1,
    show: show.length ? show : [...SECTIONS],
    bg: params.get('bg') === 'dark' ? 'dark' : 'transparent',
    pos: (['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'] as const).find(value => value === params.get('pos')) ?? 'top-left',
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.25, opacity)) : 1,
    density: params.get('density') === 'compact' ? 'compact' : params.get('density') === 'min' ? 'min' : 'full',
    safe: params.get('safe') === 'moba' ? 'moba' : params.get('safe') === 'fps' ? 'fps' : 'none',
    motion: params.get('motion') === 'low' || params.get('low-motion') === '1' ? 'low' : 'normal',
  };
}

function unavailable(reason: string): HamsterStatus {
  return { state: 'unavailable', reason };
}

/** Public hardware measurements only: never infer idle from a failed or stale request. */
export function parseHamsterStatus(value: unknown, now = Date.now()): HamsterStatus {
  if (!record(value) || !record(value.oracle) || value.oracle.state !== 'accepted') {
    return unavailable('Oracle unavailable or unaccepted');
  }
  const measurement = value.measurement;
  if (!record(measurement) || measurement.freshness !== 'online') {
    return unavailable('Waiting for a fresh hamster measurement');
  }
  if (measurement.coreStatus !== 'SPINNING' && measurement.coreStatus !== 'IDLE') {
    return unavailable('Hamster state unavailable');
  }
  const observedAt = typeof measurement.observedAt === 'string' && Number.isFinite(Date.parse(measurement.observedAt))
    ? measurement.observedAt : undefined;
  if (observedAt && nonnegative(measurement.staleAfterSeconds)
    && now - Date.parse(observedAt) > measurement.staleAfterSeconds * 1000) {
    return unavailable('Waiting for a fresh hamster measurement');
  }
  return {
    state: measurement.coreStatus === 'SPINNING' ? 'spinning' : 'idle',
    ...(nonnegative(measurement.rpmMilli) ? { rpm: measurement.rpmMilli / 1000 } : {}),
    ...(nonnegative(measurement.distanceMm) ? { distanceMeters: measurement.distanceMm / 1000 } : {}),
    ...(observedAt ? { observedAt } : {}),
  };
}

export async function fetchHamsterStatus(): Promise<HamsterStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(STATUS_URL, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return unavailable('Hamster API temporarily unavailable');
    return parseHamsterStatus(await response.json());
  } catch {
    return unavailable('Hamster API temporarily unavailable');
  } finally {
    clearTimeout(timer);
  }
}

/** Same validated dated/latest/fixture chain as play, without another live status request. */
export function fetchOverlayDay(now = new Date()): Promise<DayData> {
  return loadPublishedDay(getGameDay(now));
}
