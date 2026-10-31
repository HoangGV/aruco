/* Synthesized gameshow sound effects using Web Audio API */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private soundEnabled = true;

  start() {
    if (!this.ctx && typeof window !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -15;
        compressor.knee.value = 14;
        compressor.ratio.value = 7;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.18;

        this.bus = this.ctx.createGain();
        this.bus.gain.value = 0.8;
        this.bus.connect(compressor);
        compressor.connect(this.ctx.destination);
      } catch (e) {
        console.warn('AudioContext not supported', e);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  tone(f: number, d = 0.15, type: OscillatorType = 'sine', gain = 0.3, delay = 0, endFrequency: number | null = null) {
    if (!this.ctx || !this.bus || !this.soundEnabled) return;
    try {
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (endFrequency) {
        o.frequency.exponentialRampToValueAtTime(endFrequency, t + d);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);

      o.connect(g);
      g.connect(this.bus);
      o.start(t);
      o.stop(t + d + 0.02);
    } catch {}
  }

  noise(d = 0.15, gain = 0.25, delay = 0, frequency = 2000) {
    if (!this.ctx || !this.bus || !this.soundEnabled) return;
    try {
      if (!this.noiseBuffer) {
        const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const a = b.getChannelData(0);
        for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
        this.noiseBuffer = b;
      }
      const src = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + delay;

      src.buffer = this.noiseBuffer;
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = 0.7;

      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);

      src.connect(filter);
      filter.connect(g);
      g.connect(this.bus);
      src.start(t);
      src.stop(t + d);
    } catch {}
  }

  kick(delay = 0, gain = 0.45) {
    this.tone(125, 0.19, 'sine', gain, delay, 40);
  }

  opening() {
    this.start();
    [196, 246.94, 293.66, 392].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.28, i * 0.12));
    this.kick(0.02, 0.7);
    this.noise(0.35, 0.3, 0.35, 1200);
  }

  tick(n: number) {
    this.start();
    if (n <= 5) {
      this.tone(1050, 0.17, 'sine', 0.48);
      this.tone(525, 0.1, 'triangle', 0.2, 0.19);
      this.kick(0, 0.35);
    } else {
      this.tone(700, 0.075, 'sine', 0.25);
      if (n % 5 === 0) this.kick(0, 0.18);
    }
  }

  reveal(ok: boolean, eliminated = 0) {
    this.start();
    this.kick(0, 0.65);
    this.noise(0.36, 0.4, 0, 1000);
    if (ok) {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => {
        this.tone(f, 0.5, 'triangle', 0.4, 0.13 + i * 0.12);
        this.tone(f * 2, 0.32, 'sine', 0.12, 0.13 + i * 0.12);
      });
      [523.25, 659.25, 783.99].forEach(f => this.tone(f, 1.0, 'triangle', 0.25, 0.85));
    } else {
      this.tone(430, 0.42, 'sawtooth', 0.13, 0.1, 210);
      this.tone(220, 0.6, 'triangle', 0.38, 0.25, 110);
    }
    if (eliminated > 0) {
      this.tone(92, 0.25, 'sine', 0.25, ok ? 1.7 : 0.65, 50);
    }
  }

  beep() {
    this.start();
    this.tone(880, 0.09, 'sine', 0.25);
  }
}

export const gameAudio = new SoundEngine();
