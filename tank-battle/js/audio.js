// Sound effects synthesised with WebAudio. No recorded or original game audio is used.

export class Sound {
  constructor() {
    this.ctx = null;
    try { this.enabled = localStorage.getItem('tb.sound') !== 'off'; } catch { this.enabled = true; }
  }

  /** Must be called from a user gesture (browsers block audio before that). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem('tb.sound', on ? 'on' : 'off'); } catch {}
  }

  tone(f0, f1, dur, type = 'square', vol = 0.1, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol = 0.2, cutoff = 1200, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  notes(freqs, len, type = 'square', vol = 0.08) {
    freqs.forEach((f, i) => this.tone(f, f, len * 0.9, type, vol, i * len));
  }

  play(name) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'fire': this.tone(900, 300, 0.07, 'square', 0.06); break;
      case 'brick': this.noise(0.09, 0.25, 1600); break;
      case 'steel': this.tone(1400, 1300, 0.05, 'square', 0.05); this.tone(700, 650, 0.06, 'triangle', 0.08); break;
      case 'armor': this.tone(320, 260, 0.06, 'square', 0.08); break;
      case 'enemyDie': this.noise(0.35, 0.35, 900); this.tone(140, 40, 0.3, 'square', 0.06); break;
      case 'playerDie': this.noise(0.7, 0.4, 700); this.tone(220, 30, 0.6, 'sawtooth', 0.07); break;
      case 'baseDie': this.noise(1.0, 0.45, 500); this.tone(180, 25, 0.9, 'sawtooth', 0.08); break;
      case 'powerupAppear': this.notes([523, 659, 784], 0.06); break;
      case 'powerup': this.notes([784, 988, 1175, 1568], 0.05); break;
      case 'life': this.notes([523, 659, 784, 1047, 1319], 0.07); break;
      case 'stageStart': this.notes([392, 523, 659, 784, 659, 784, 1047], 0.09, 'triangle', 0.14); break;
      case 'gameOver': this.notes([392, 349, 330, 262], 0.2, 'triangle', 0.14); break;
      case 'pause': this.notes([659, 523], 0.08); break;
    }
  }
}
