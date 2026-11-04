import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChiptuneMusic, MUSIC_MAX_GAIN, MUSIC_MUTE_KEY, MUSIC_TRACKS, musicSceneForRun } from './music';

function audioFixture() {
  const param = () => ({
    value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
  });
  const oscillators: Array<ReturnType<typeof source>> = [];
  const gains: Array<{ gain: ReturnType<typeof param>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  function source() {
    return { frequency: param(), playbackRate: param(), type: '', buffer: null, onended: null,
      connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
  }
  const context = {
    state: 'suspended', currentTime: 0, sampleRate: 44100, destination: {},
    resume: vi.fn(async () => { context.state = 'running'; }),
    suspend: vi.fn(async () => { context.state = 'suspended'; }),
    close: vi.fn(async () => { context.state = 'closed'; }),
    createGain: vi.fn(() => { const gain = { gain: param(), connect: vi.fn(), disconnect: vi.fn() }; gains.push(gain); return gain; }),
    createBuffer: vi.fn((_channels: number, size: number) => ({ getChannelData: () => new Float32Array(size) })),
    createOscillator: vi.fn(() => { const oscillator = source(); oscillators.push(oscillator); return oscillator; }),
    createBufferSource: vi.fn(() => source()),
  };
  const createContext = vi.fn(() => context as unknown as AudioContext);
  return { context, createContext, oscillators, gains };
}

const controllers: ChiptuneMusic[] = [];
const controller = (factory?: () => AudioContext | null) => {
  const value = new ChiptuneMusic(factory); controllers.push(value); return value;
};
let storage: Map<string, string>;

beforeEach(() => {
  vi.useFakeTimers();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  });
});
afterEach(() => {
  controllers.splice(0).forEach(value => value.dispose());
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('original procedural chiptune music', () => {
  it('creates no audio before an interaction, then starts one quiet sequencer', async () => {
    const audio = audioFixture(), player = controller(audio.createContext);
    player.setVolume(35); player.setScene('combat'); player.setVisible(true);
    vi.advanceTimersByTime(2000);
    expect(audio.createContext).not.toHaveBeenCalled();
    expect(player.started).toBe(false);

    await player.unlock(); await player.unlock();
    expect(audio.createContext).toHaveBeenCalledTimes(1);
    expect(audio.context.resume).toHaveBeenCalledTimes(1);
    expect(player.started).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    expect(audio.gains[0].gain.value).toBeCloseTo(MUSIC_MAX_GAIN * 0.35);
    expect(audio.oscillators.length).toBeGreaterThan(0);
    for (const oscillator of audio.oscillators) {
      expect(oscillator.start.mock.calls[0][0]).toBeGreaterThanOrEqual(0.025);
      expect(oscillator.start.mock.calls[0][0]).toBeLessThan(0.16);
      expect(oscillator.stop).toHaveBeenCalledTimes(1);
    }
  });

  it('persists mute and stops scheduled voices without making a context for a muted visit', async () => {
    storage.set(MUSIC_MUTE_KEY, 'true');
    const audio = audioFixture(), player = controller(audio.createContext);
    await player.unlock();
    expect(player.muted).toBe(true);
    expect(audio.createContext).not.toHaveBeenCalled();
    player.setMuted(false); await player.unlock();
    expect(storage.get(MUSIC_MUTE_KEY)).toBe('false');
    expect(player.started).toBe(true);
    player.setMuted(true);
    expect(storage.get(MUSIC_MUTE_KEY)).toBe('true');
    expect(player.started).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(audio.context.suspend).toHaveBeenCalledTimes(1);
    expect(audio.oscillators.every(voice => voice.stop.mock.calls.at(-1)?.[0] === 0.025)).toBe(true);
    expect(controller().muted).toBe(true);
  });

  it('uses different original pitches and tempos and replaces voices on scene changes', async () => {
    expect(new Set(Object.values(MUSIC_TRACKS).map(track => track.bpm)).size).toBe(3);
    expect(new Set(Object.values(MUSIC_TRACKS).map(track => track.melody.join(','))).size).toBe(3);
    const audio = audioFixture(), player = controller(audio.createContext);
    await player.unlock();
    const oldVoices = [...audio.oscillators];
    const menuPitch = oldVoices[0].frequency.setValueAtTime.mock.calls[0][0];
    player.setScene('boss');
    const bossVoice = audio.oscillators[oldVoices.length];
    expect(player.scene).toBe('boss');
    expect(bossVoice.frequency.setValueAtTime.mock.calls[0][0]).not.toBe(menuPitch);
    expect(oldVoices.every(voice => voice.stop.mock.calls.at(-1)?.[0] === 0.025)).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    const count = audio.oscillators.length;
    player.setScene('boss');
    expect(audio.oscillators).toHaveLength(count);
  });

  it('pauses in background and at zero volume, then resumes only after an initial gesture', async () => {
    const audio = audioFixture(), player = controller(audio.createContext);
    player.setVolume(0); await player.unlock();
    expect(audio.createContext).not.toHaveBeenCalled();
    player.setVolume(35); await player.unlock();
    player.setVisible(false);
    expect(player.started).toBe(false);
    player.setVisible(true); await player.unlock();
    expect(player.started).toBe(true);
    player.setVolume(0);
    expect(player.started).toBe(false);
    player.setVolume(150); await player.unlock();
    expect(player.volume).toBe(100);
    expect(audio.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(MUSIC_MAX_GAIN, 0, 0.025);
  });

  it('silently tolerates unsupported audio, rejected resume and blocked browser storage', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); },
    });
    const unavailable = controller(() => null);
    expect(() => unavailable.setMuted(true)).not.toThrow();
    unavailable.setMuted(false);
    await expect(unavailable.unlock()).resolves.toBeUndefined();
    const audio = audioFixture(); audio.context.resume.mockRejectedValue(new Error('interaction required'));
    const player = controller(audio.createContext);
    await expect(player.unlock()).resolves.toBeUndefined();
    expect(player.started).toBe(false);
  });

  it('does not start if muted while the browser is still resuming audio', async () => {
    const audio = audioFixture(), player = controller(audio.createContext);
    let finishResume!: () => void;
    audio.context.resume.mockImplementation(() => new Promise<void>(resolve => {
      finishResume = () => { audio.context.state = 'running'; resolve(); };
    }));
    const pending = player.unlock();
    player.setMuted(true);
    finishResume(); await pending;
    expect(player.started).toBe(false);
    expect(audio.oscillators).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps hidden visits silent and disconnects every voice on disposal', async () => {
    const audio = audioFixture(), player = controller(audio.createContext);
    player.setVisible(false);
    await player.unlock();
    expect(audio.createContext).not.toHaveBeenCalled();
    player.setVisible(true); await player.unlock();
    expect(player.started).toBe(true);
    player.dispose();
    expect(player.started).toBe(false);
    expect(audio.context.close).toHaveBeenCalledTimes(1);
    expect(audio.oscillators.every(voice => voice.disconnect.mock.calls.length === 1)).toBe(true);
    expect(audio.oscillators.every(voice => voice.onended === null)).toBe(true);
    player.setVolume(50);
    expect(audio.createContext).toHaveBeenCalledTimes(1);
  });

  it('uses combat and boss tracks only for active battles', () => {
    const state = { phase: 'combat', currentNode: 1, map: [{ kind: 'battle' }, { kind: 'boss' }] };
    expect(musicSceneForRun('run', state)).toBe('boss');
    expect(musicSceneForRun('run', { ...state, currentNode: 0 })).toBe('combat');
    expect(musicSceneForRun('run', { ...state, phase: 'reward' })).toBe('menu');
    expect(musicSceneForRun('camp', state)).toBe('menu');
    expect(musicSceneForRun('leaderboard', null)).toBe('menu');
  });
});
