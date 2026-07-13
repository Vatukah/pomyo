import { AudioDB } from "../db/audioDb";
export const MAX_VOLUMN = 4;

// AudioManager.ts
export class AudioManager {
  private static sharedCtx = new AudioContext();
  private audioContext: AudioContext;
  private buffers: Map<string, AudioBuffer>;
  private lastPlay: number = 0;
  private MIN_INTERVAL = 50;
  private db = new AudioDB();

  private oneShotSources: Map<string, AudioBufferSourceNode[]>;
  private loopSources: Map<
    string,
    { source: AudioBufferSourceNode; gain: GainNode }
  >;

  private masterGain: GainNode;

  constructor(useShare = true) {
    this.audioContext = useShare ? AudioManager.sharedCtx : new AudioContext();
    this.buffers = new Map();

    this.oneShotSources = new Map();
    this.loopSources = new Map();

    // Master output gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.audioContext.destination);
  }

  /** Preload a single sound file */
  async loadSound(name: string, url: string): Promise<void> {
    if (this.buffers.has(name)) return;

    // 1) Check IndexedDB
    let raw = await this.db.get(url);

    // 2) Fetch + Cache if not found
    if (!raw) {
      const res = await fetch(url);
      raw = await res.arrayBuffer();
      this.db.set(url, raw); // store for next time
    }

    // 3) Decode and store AudioBuffer in memory
    const decoded = await this.audioContext.decodeAudioData(raw.slice(0));
    this.buffers.set(name, decoded);
  }

  /** Preload multiple */
  async loadAll(
    sounds: Record<string, string>,
    timeout = 2000,
  ): Promise<boolean> {
    const load = Promise.all(
      Object.entries(sounds).map(([name, url]) => this.loadSound(name, url)),
    ).then(() => true);

    const timedOut = new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(false), timeout),
    );

    return Promise.race([load, timedOut]);
  }

  /** Play simple one-shot sound */
  play(
    name: string,
    options?: { volume?: number; pitch?: number },
    isDemo: boolean = false,
  ) {
    const buffer = this.buffers.get(name);
    if (!buffer) return console.warn(`AudioManager: ${name} not loaded`);

    const now = performance.now();
    if (now - this.lastPlay < this.MIN_INTERVAL) return;
    this.lastPlay = now;
    if (this.audioContext.state === "suspended") this.audioContext.resume();

    const { volume = 0.5, pitch = 1 } = options || {};

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = pitch;

    const gain = this.audioContext.createGain();
    gain.gain.value = volume;

    source.connect(gain).connect(this.masterGain);

    if (!this.oneShotSources.has(name)) {
      this.oneShotSources.set(name, []);
    }

    this.oneShotSources.get(name)!.push(source);

    if (isDemo && source.buffer.duration > 5) {
      source.start(0, 0, 5);
    } else {
      source.start();
    }

    source.onended = () => {
      const list = this.oneShotSources.get(name);
      if (!list) return;

      this.oneShotSources.set(
        name,
        list.filter((s) => s !== source),
      );

      source.disconnect();
      gain.disconnect();
    };
  }

  /** 🔁 Start loop sound (supports fade in) */
  loop(name: string, volume = 0.4, fadeMs = 200) {
    if (this.loopSources.has(name)) return; // already looping

    const buffer = this.buffers.get(name);
    if (!buffer) return console.warn(`AudioManager: ${name} not loaded`);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.audioContext.createGain();
    gain.gain.setValueAtTime(0, this.audioContext.currentTime); // fade from 0

    source.connect(gain).connect(this.masterGain);

    this.loopSources.set(name, { source, gain });

    source.start();

    // Fade in
    gain.gain.linearRampToValueAtTime(
      volume,
      this.audioContext.currentTime + fadeMs / 1000,
    );
  }

  setLoopVolume(name: string, volume: number) {
    const loop = this.loopSources.get(name);
    if (!loop) return;

    loop.gain.gain.setTargetAtTime(
      volume,
      this.audioContext.currentTime,
      0.05, // smooth fade, no clicks
    );
  }

  /** ⏹ Stop loop (with fade out) */
  stopLoop(name: string, fadeMs = 200) {
    const entry = this.loopSources.get(name);
    if (!entry) return;

    const { source, gain } = entry;

    const now = this.audioContext.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);

    source.stop(now + fadeMs / 1000 + 0.05); // tiny buffer
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };

    this.loopSources.delete(name);
  }

  /** Stop ALL loops */
  stopAllLoops() {
    [...this.loopSources.keys()].forEach((name) => this.stopLoop(name));
  }

  /** Stop one-shot sound */
  stop(name: string) {
    this.oneShotSources.get(name)?.forEach((source) => source.stop());
    this.oneShotSources.set(name, []);
  }

  stopAll() {
    [...this.oneShotSources.keys()].forEach((name) => this.stop(name));
  }

  /** Global volume */
  setMasterVolume(volume: number) {
    this.masterGain.gain.linearRampToValueAtTime(
      volume,
      this.audioContext.currentTime + 0.2,
    );
  }

  /** Unlock for iOS/Android */
  unlock() {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }
}
