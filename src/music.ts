import './music.css';

export type MusicScene = 'menu' | 'combat' | 'boss';
export const MUSIC_MUTE_KEY = 'squeekspire:v1:music-muted';
/** Music stays behind the existing synthesized card effects, even at full volume. */
export const MUSIC_MAX_GAIN = 0.14;

interface Track {
  bpm: number;
  roots: readonly number[];
  melody: readonly number[];
  arpeggio: readonly number[];
  wave: OscillatorType;
}

/** Original four-bar compositions. Notes are MIDI pitches; -1 means a rest. */
export const MUSIC_TRACKS: Readonly<Record<MusicScene, Track>> = {
  menu: {
    bpm: 88, roots: [48, 45, 53, 55], wave: 'triangle',
    melody: [72, -1, 76, 79, -1, 76, 74, -1, 72, -1, 67, 71, 74, -1, 71, -1],
    arpeggio: [0, 7, 12, 16, 7, 12, 19, 16],
  },
  combat: {
    bpm: 128, roots: [45, 48, 50, 52], wave: 'square',
    melody: [69, 72, -1, 76, 74, 72, 69, -1, 67, 69, 72, -1, 76, 79, 76, 72],
    arpeggio: [0, 7, 12, 15, 12, 7, 15, 19],
  },
  boss: {
    bpm: 152, roots: [38, 34, 36, 37], wave: 'square',
    melody: [74, -1, 77, 76, 74, 73, 69, -1, 70, 69, 73, 76, 77, 76, 73, 69],
    arpeggio: [0, 7, 12, 15, 11, 7, 12, 19],
  },
};

export function musicSceneForRun(screen: string, run: {
  phase: string; currentNode: number; map: readonly { kind: string }[];
} | null): MusicScene {
  if (screen !== 'run' || run?.phase !== 'combat') return 'menu';
  return run.map[run.currentNode]?.kind === 'boss' ? 'boss' : 'combat';
}

type Voice = { source: OscillatorNode | AudioBufferSourceNode; envelope: GainNode };
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function createBrowserContext(): AudioContext | null {
  const supported = globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  const Context = supported.AudioContext ?? supported.webkitAudioContext;
  return Context ? new Context() : null;
}

/** Browser-only presentation audio: never reads or changes the deterministic run. */
export class ChiptuneMusic {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextTime = 0;
  private gestureSeen = false;
  private visible = true;
  private _muted = false;
  private _volume = 35;
  private _scene: MusicScene = 'menu';
  private listeners = new Set<() => void>();

  constructor(private createContext = createBrowserContext) {
    try { this._muted = localStorage.getItem(MUSIC_MUTE_KEY) === 'true'; }
    catch { /* Private browsing still gets a session mute control. */ }
  }

  get muted(): boolean { return this._muted; }
  get scene(): MusicScene { return this._scene; }
  get volume(): number { return this._volume; }
  get started(): boolean { return this.timer !== null; }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    listener();
    return () => this.listeners.delete(listener);
  }

  private emit(): void { this.listeners.forEach(listener => listener()); }
  private get allowed(): boolean {
    return this.gestureSeen && this.visible && !this._muted && this._volume > 0;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    try { localStorage.setItem(MUSIC_MUTE_KEY, String(muted)); } catch { /* Session fallback. */ }
    if (muted) this.pause();
    else void this.playIfAllowed();
    this.emit();
  }

  setVolume(volume: number): void {
    this._volume = Number.isFinite(volume) ? Math.max(0, Math.min(100, volume)) : 35;
    this.updateGain();
    if (this._volume === 0) this.pause();
    else void this.playIfAllowed();
  }

  setScene(scene: MusicScene): void {
    if (scene === this._scene) return;
    this._scene = scene;
    this.stopScheduler();
    void this.playIfAllowed();
    this.emit();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.pause();
    else void this.playIfAllowed();
  }

  /** Call synchronously from an interaction handler so Safari can resume audio. */
  async unlock(): Promise<void> {
    this.gestureSeen = true;
    await this.playIfAllowed();
  }

  private updateGain(): void {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(MUSIC_MAX_GAIN * this._volume / 100, this.context.currentTime, 0.025);
  }

  private async playIfAllowed(): Promise<void> {
    if (!this.allowed) return;
    try {
      if (!this.context) {
        this.context = this.createContext();
        if (!this.context) return;
        this.master = this.context.createGain();
        this.master.gain.value = MUSIC_MAX_GAIN * this._volume / 100;
        this.master.connect(this.context.destination);
        this.noise = this.makeNoise();
      }
      // Safari can also report "interrupted" after a device or tab interruption.
      if (this.context.state !== 'running') await this.context.resume();
      if (!this.allowed || this.context.state !== 'running' || this.timer !== null) return;
      this.step = 0;
      this.nextTime = this.context.currentTime + 0.035;
      this.timer = setInterval(() => this.schedule(), 40);
      this.schedule();
      this.emit();
    } catch { /* Unsupported or blocked Web Audio must never interrupt the game. */ }
  }

  private pause(): void {
    this.stopScheduler();
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
    this.emit();
  }

  private stopScheduler(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const { source, envelope } of this.voices) {
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setTargetAtTime(0.0001, now, 0.006);
      try { source.stop(now + 0.025); } catch { /* A voice may already have ended. */ }
    }
  }

  private makeNoise(): AudioBuffer {
    const buffer = this.context!.createBuffer(1, Math.ceil(this.context!.sampleRate * 0.08), this.context!.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x53514545;
    for (let i = 0; i < samples.length; i++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      // A fixed seed keeps the original percussion reproducible across visits.
      samples[i] = ((seed >>> 0) / 0xffffffff * 2 - 1) * (1 - i / samples.length);
    }
    return buffer;
  }

  private voice(source: Voice['source'], time: number, duration: number, level: number): void {
    const envelope = this.context!.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(level, time + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(envelope); envelope.connect(this.master!);
    const voice = { source, envelope };
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); envelope.disconnect(); this.voices.delete(voice); };
    source.start(time); source.stop(time + duration + 0.01);
  }

  private tone(note: number, time: number, duration: number, level: number, wave: OscillatorType): void {
    const source = this.context!.createOscillator();
    source.type = wave;
    source.frequency.setValueAtTime(frequency(note), time);
    this.voice(source, time, duration, level);
  }

  private percussion(time: number, kick: boolean): void {
    if (kick) {
      const source = this.context!.createOscillator();
      source.type = 'sine';
      source.frequency.setValueAtTime(this._scene === 'boss' ? 130 : 105, time);
      source.frequency.exponentialRampToValueAtTime(42, time + 0.09);
      this.voice(source, time, 0.11, 0.38);
    } else {
      const source = this.context!.createBufferSource();
      source.buffer = this.noise;
      source.playbackRate.value = 1.8;
      this.voice(source, time, 0.035, this._scene === 'menu' ? 0.04 : 0.10);
    }
  }

  private schedule(): void {
    if (!this.allowed || !this.context || this.context.state !== 'running') return;
    const track = MUSIC_TRACKS[this._scene], duration = 60 / track.bpm / 4;
    // Drop old beats after a stalled tab instead of playing an accumulated burst.
    if (this.nextTime < this.context.currentTime) this.nextTime = this.context.currentTime + 0.025;
    while (this.nextTime < this.context.currentTime + 0.16) {
      const beat = this.step % 16, bar = Math.floor(this.step / 16) % 4;
      const root = track.roots[bar], transpose = root - track.roots[0];
      const melody = track.melody[beat];
      if (melody >= 0) this.tone(melody + transpose, this.nextTime, duration * 1.5, 0.14, track.wave);
      if (this.step % (this._scene === 'menu' ? 2 : 1) === 0) {
        this.tone(root + 12 + track.arpeggio[this.step % 8], this.nextTime, duration * 0.65, 0.065, 'triangle');
      }
      if (beat % (this._scene === 'menu' ? 8 : 4) === 0) {
        this.tone(root + (beat === 8 ? 7 : 0), this.nextTime, duration * 2.6, 0.25, 'triangle');
        if (this._scene !== 'menu') this.percussion(this.nextTime, true);
      }
      if (beat % (this._scene === 'menu' ? 8 : 4) === 2 || (this._scene === 'boss' && beat % 4 === 3)) {
        this.percussion(this.nextTime, false);
      }
      this.step = (this.step + 1) % 64;
      this.nextTime += duration;
    }
  }

  /** Removes scheduled work; useful when replacing a page in an embedded host. */
  dispose(): void {
    this.stopScheduler();
    for (const { source, envelope } of this.voices) {
      source.onended = null;
      source.disconnect(); envelope.disconnect();
    }
    this.voices.clear();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null; this.master = null; this.noise = null;
    this.gestureSeen = false;
    this.listeners.clear();
  }
}

export const music = new ChiptuneMusic();
let mounted: { button: HTMLButtonElement; remove: () => void } | null = null;

/** Dock in a header, or keep a persistent control outside #app and its dialogs. */
export function mountMusicControls(host?: HTMLElement): () => void {
  if (mounted?.button.isConnected) {
    (host ?? document.body).append(mounted.button);
    mounted.button.classList.toggle('music-toggle-inline', !!host);
    return mounted.remove;
  }
  mounted?.remove();
  const button = document.createElement('button');
  button.id = 'music-toggle'; button.className = 'music-toggle'; button.type = 'button';
  const unsubscribe = music.subscribe(() => {
    button.setAttribute('aria-label', music.muted ? 'Unmute music' : 'Mute music');
    button.setAttribute('aria-pressed', String(music.muted));
    button.title = `${music.muted ? 'Unmute' : 'Mute'} original chiptune music`;
    button.innerHTML = `<span class="music-pixel" aria-hidden="true">${music.muted ? '×' : '♫'}</span><span>MUSIC ${music.muted ? 'OFF' : 'ON'}</span>`;
  });
  button.addEventListener('click', () => { music.setMuted(!music.muted); if (!music.muted) void music.unlock(); });
  const gesture = (event: Event) => {
    if (!button.isConnected) { remove(); return; }
    if (event.target instanceof Element && event.target.closest('#music-toggle')) return;
    if (event instanceof KeyboardEvent && (event.metaKey || event.ctrlKey || event.altKey || event.repeat)) return;
    void music.unlock();
  };
  const visibility = () => { if (button.isConnected) music.setVisible(!document.hidden); };
  const remove = () => {
    unsubscribe(); button.remove();
    document.removeEventListener('pointerdown', gesture, true);
    document.removeEventListener('keydown', gesture, true);
    document.removeEventListener('visibilitychange', visibility);
    if (mounted?.button === button) mounted = null;
  };
  document.addEventListener('pointerdown', gesture, { capture: true, passive: true });
  document.addEventListener('keydown', gesture, true);
  document.addEventListener('visibilitychange', visibility);
  (host ?? document.body).append(button);
  button.classList.toggle('music-toggle-inline', !!host);
  visibility();
  mounted = { button, remove };
  return remove;
}
