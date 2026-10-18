// Web Audio: a low space-room tone, the impact, and a rumble that follows how
// fast the collision is turning motion into heat. All synthesized, no samples.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.dest = ctx.createMediaStreamDestination();
    comp.connect(this.dest);

    // brown noise source, shared
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    this.noiseBuf = buf;

    // room tone
    const hum = ctx.createOscillator(), hum2 = ctx.createOscillator(), hg = ctx.createGain();
    hum.frequency.value = 41; hum2.frequency.value = 61.7; hg.gain.value = 0.035;
    hum.connect(hg); hum2.connect(hg); hg.connect(this.master);
    hum.start(); hum2.start();

    // rumble bed driven by heating rate
    const rn = ctx.createBufferSource(); rn.buffer = buf; rn.loop = true;
    this.rumbleF = ctx.createBiquadFilter(); this.rumbleF.type = 'lowpass'; this.rumbleF.frequency.value = 120;
    this.rumbleG = ctx.createGain(); this.rumbleG.gain.value = 0;
    rn.connect(this.rumbleF).connect(this.rumbleG).connect(this.master);
    rn.start();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  // 0..1
  rumble(level) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rumbleG.gain.setTargetAtTime(Math.min(1, level) * 0.9, t, 0.25);
    this.rumbleF.frequency.setTargetAtTime(70 + 380 * Math.min(1, level), t, 0.3);
  }

  launch() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(260, t + 1.4);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(f).connect(g).connect(this.master);
    o.start(t); o.stop(t + 1.7);
  }

  // strength 0..1
  impact(strength) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, s = Math.max(0.25, Math.min(1, strength));
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(90, t + 3.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.6 * s, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 5 + 3 * s);
    n.connect(f).connect(g).connect(this.master);
    n.start(t); n.stop(t + 9);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(24, t + 4);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.9 * s, t + 0.05); og.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    o.connect(og).connect(this.master);
    o.start(t); o.stop(t + 5.2);
  }

  verdict() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [523.25, 392].forEach((fr, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t + i * 0.16); g.gain.exponentialRampToValueAtTime(0.12, t + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.9);
      o.connect(g).connect(this.master); o.start(t + i * 0.16); o.stop(t + i * 0.16 + 1);
    });
  }
}
