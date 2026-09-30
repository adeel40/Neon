// Procedural audio via the Web Audio API — no asset files required, so the game
// is fully self-contained. This gives us synthwave-style music whose layers
// fade in as intensity rises, plus SFX with pitch variation.
//
// Honest note: real synthwave from samples would sound better, but bundling
// audio files here would bloat the repo and need hosting. Synthesis keeps it
// zero-dependency and demonstrates the adaptive-intensity system cleanly.
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.enabled = true;
    this.musicVolume = 0.35;
    this.sfxVolume = 0.5;
    this._layers = [];
    this._started = false;
    this._intensity = 0;
    this._lastStep = 0;
    this._step = 0;
  }

  // Must be called from a user gesture (browser autoplay policy).
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.master);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  setIntensity(v) { this._intensity = Math.max(0, Math.min(1, v)); }

  // ---- SFX --------------------------------------------------------------
  play(type) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    switch (type) {
      case 'shoot':   this._blip(880, 0.05, 'square', 0.12, 0.15); break;
      case 'hit':     this._blip(220, 0.06, 'sawtooth', 0.14, 0.1); break;
      case 'kill':    this._blip(140, 0.10, 'triangle', 0.16, 0.2); break;
      case 'shock':   this._sweep(120, 40, 0.35); break;
      case 'levelup': this._arp([523, 659, 784, 1046], 0.09); break;
      case 'hurt':    this._sweep(400, 80, 0.25); break;
      case 'chest':   this._arp([440, 587, 740, 880, 1174], 0.08); break;
      default: break;
    }
  }

  _blip(freq, dur, wave, gain, pitchVar) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    const f = freq * (1 + (Math.random() - 0.5) * pitchVar); // pitch variation
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _sweep(from, to, dur) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _arp(freqs, step) {
    const t = this.ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      const st = t + i * step;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.16, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + step * 1.6);
      o.connect(g); g.connect(this.sfxGain);
      o.start(st); o.stop(st + step * 1.8);
    });
  }

  // ---- Adaptive music: a simple synthwave bassline + layered arps -------
  // Called every frame; sequences 16th notes and scales layer gains by
  // intensity so the track "builds" as the horde grows.
  updateMusic(now) {
    if (!this.ctx || !this.enabled || !this._started) return;
    const bpm = 118;
    const stepDur = 60 / bpm / 4; // 16th notes
    if (now - this._lastStep < stepDur) return;
    this._lastStep = now;
    const step = this._step++ % 16;

    // Layer 1 (always on): bass root pattern in A minor.
    const bass = [110, 110, 0, 110, 87, 0, 110, 0, 98, 98, 0, 98, 110, 0, 130, 0];
    if (bass[step]) this._note(bass[step], 'square', 0.10, stepDur * 1.4);

    // Layer 2 (intensity > 0.33): off-beat pluck.
    if (this._intensity > 0.33 && step % 2 === 1) {
      const plk = [0, 220, 0, 262, 0, 196, 0, 262, 0, 220, 0, 294, 0, 262, 0, 330];
      if (plk[step]) this._note(plk[step], 'triangle', 0.06 * this._intensity, stepDur);
    }

    // Layer 3 (intensity > 0.66): high arp lead.
    if (this._intensity > 0.66 && step % 4 === 0) {
      const lead = 440 * [1, 1.25, 1.5, 2][(step / 4) | 0];
      this._note(lead, 'sawtooth', 0.05 * this._intensity, stepDur * 2);
    }
  }

  _note(freq, wave, gain, dur) {
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  startMusic() { this._started = true; this._step = 0; this._lastStep = 0; }
  stopMusic() { this._started = false; }

  setMusicVolume(v) { this.musicVolume = v; if (this.musicGain) this.musicGain.gain.value = v; }
  setSfxVolume(v) { this.sfxVolume = v; if (this.sfxGain) this.sfxGain.gain.value = v; }
}
