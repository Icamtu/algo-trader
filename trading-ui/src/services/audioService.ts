/**
 * AetherDesk Institutional Audio Engine
 * Aesthetic: Military HUD / Industrial Telemetry
 * Tech: Web Audio API (Zero Latency)
 */

class AudioService {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor() {
    // Context is initialized on first user interaction to comply with browser policies
  }

  private initContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.5; // Default volume
      this.masterGain.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  private createEnvelope(gainNode: GainNode, attack: number, decay: number, sustain: number, release: number) {
    if (!this.context) return;
    const now = this.context.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + attack);
    gainNode.gain.exponentialRampToValueAtTime(sustain, now + attack + decay);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + attack + decay + release);
  }

  /**
   * Metallic Blit (BUY Confirm)
   * 880Hz -> 1760Hz Sweep
   */
  public playConfirm() {
    this.initContext();
    if (!this.context || !this.masterGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, this.context.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    this.createEnvelope(gain, 0.01, 0.05, 0.1, 0.1);
    osc.start();
    osc.stop(this.context.currentTime + 0.3);
  }

  /**
   * Low-freq Thud (SELL Execute)
   * 110Hz with Noise Burst
   */
  public playExecute() {
    this.initContext();
    if (!this.context || !this.masterGain) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.context.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    this.createEnvelope(gain, 0.005, 0.1, 0.01, 0.2);
    osc.start();
    osc.stop(this.context.currentTime + 0.4);
  }

  /**
   * Percussive Click (CANCEL Snap)
   */
  public playSnap() {
    this.initContext();
    if (!this.context || !this.masterGain) return;

    const bufferSize = this.context.sampleRate * 0.02;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const gain = this.context.createGain();

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    this.createEnvelope(gain, 0.001, 0.01, 0.001, 0.01);
    noise.start();
    noise.stop(this.context.currentTime + 0.05);
  }

  /**
   * Dual-tone Dissonance (FAILURE Warning)
   * 220Hz + 230Hz
   */
  public playWarning() {
    this.initContext();
    if (!this.context || !this.masterGain) return;

    [220, 230].forEach(freq => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      osc.connect(gain);
      gain.connect(this.masterGain!);

      this.createEnvelope(gain, 0.05, 0.1, 0.5, 0.3);
      osc.start();
      osc.stop(this.context!.currentTime + 0.5);
    });
  }

  public setVolume(value: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, value));
    }
  }
}

export const audioService = new AudioService();
