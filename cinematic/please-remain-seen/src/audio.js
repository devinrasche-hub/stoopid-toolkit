import { CUE, DURATION, NARRATION } from './timeline.js';
import { trackZ } from './shots.js';
import { mulberry32 } from './util.js';

// ─────────────────────────────────────────────────────────────────────────────
// Procedural soundtrack. Everything is scheduled from the timeline into any
// BaseAudioContext — the live one, or an OfflineAudioContext for a WAV export.
// Seeking or pausing tears the graph down and reschedules from the new time,
// so playback, scrubbing and export all produce the same sound.
// ─────────────────────────────────────────────────────────────────────────────

const ENV = {
  hum: [[0, 0], [0.3, 0], [3.5, 0.05], [17, 0.046], [24, 0.046], [24, 0.02], [39.95, 0.02], [40, 0], [47.6, 0], [48.9, 0.04],
        [68.6, 0.045], [68.7, 0.018], [69.5, 0.038], [71.4, 0.038], [71.5, 0.026], [74.2, 0.026], [74.3, 0.018], [78.6, 0.016], [80.6, 0], [90, 0]],
  room: [[0, 0], [0.5, 0], [4, 0.09], [23.95, 0.09], [24, 0], [47.6, 0], [48.9, 0.08], [67, 0.08], [74.2, 0.05], [78.6, 0.04], [80.8, 0], [90, 0]],
  hall: [[0, 0], [23.98, 0], [24, 0.12], [39.95, 0.12], [40, 0], [90, 0]],
  buzz: [[0, 0], [0.5, 0], [3, 0.0022], [23.95, 0.0022], [24, 0.006], [39.95, 0.006], [40, 0], [47.6, 0], [48.9, 0.002], [68.6, 0.002], [68.65, 0], [90, 0]],
  air: [[0, 0], [39.98, 0], [40, 0.018], [47.6, 0.018], [48.5, 0], [90, 0]],
  drone: [[0, 0.0], [12, 0.0], [18, 0.044], [23.95, 0.055], [24, 0.0385], [31, 0.055], [34, 0.088], [39.95, 0.11], [40, 0.0], [48.9, 0.0], [51, 0.044],
          [58, 0.066], [62, 0.088], [67, 0.077], [75, 0.11], [78.6, 0.0825], [80.6, 0.0], [90, 0.0]],
  pad: [[0, 0], [5, 0], [9, 0.012], [17, 0.02], [24, 0.025], [39.95, 0.03], [40, 0], [48.9, 0], [52, 0.02], [63, 0.035], [67, 0.03],
        [76, 0.025], [78.6, 0.012], [80.4, 0], [90, 0]],
  whine: [[0, 0], [1.2, 0], [1.8, 0.0014], [7.2, 0.0014], [7.21, 0.0007], [10, 0.0007], [10.01, 0], [76, 0], [76.01, 0.0014], [80.99, 0.0014],
          [81, 0], [82.4, 0], [83, 0.0009], [87.19, 0.0009], [87.2, 0], [90, 0]],
  hiss: [[0, 0], [81, 0], [81.5, 0.005], [87.19, 0.005], [87.2, 0], [90, 0]],
};

// One-shot cues: [time, kind, options]
function cueList() {
  const L = [
    [CUE.crtRelay, 'relay', { gain: 0.5, pan: -0.25 }],
    [CUE.crtOn, 'crtOn', { gain: 0.38, pan: -0.25 }],
    [CUE.reverse, 'cut', {}],
    [CUE.metalFar1, 'metal', { gain: 0.32, pan: 0.55 }],
    [CUE.micDrift + 0.4, 'creak', { gain: 0.12, pan: 0.0 }],
    [CUE.chairTurnStart + 0.2, 'creak', { gain: 0.16, pan: 0.05, len: 4.2 }],
    [CUE.shadowCrossStart + 0.2, 'behind', { gain: 0.5, from: 0.9, to: -0.9, dur: 2.4 }],
    [29.2, 'metal', { gain: 0.26, pan: 0.0, far: true }],
    [CUE.viewers2, 'tick', { gain: 0.22, pan: 0.0 }],
    [CUE.behindRustle, 'behind', { gain: 0.65, from: -0.4, to: 0.35, dur: 1.6 }],
    [CUE.chime, 'chime', { gain: 0.07 }],
    [CUE.tearStart, 'tear', { gain: 0.26, dur: CUE.tearEnd - CUE.tearStart }],
    [55.6, 'metal', { gain: 0.2, pan: -0.6 }],
    [CUE.tallyOn, 'clunk', { gain: 0.36, pan: 0.35 }],
    [CUE.m3Off, 'crtOff', { gain: 0.3, pan: 0.6 }],
    [CUE.m3Off + 0.05, 'sag', { gain: 0.25 }],
    [CUE.m2Off, 'crtOff', { gain: 0.3, pan: 0.65 }],
    [CUE.m2Off + 0.05, 'clunk', { gain: 0.3, pan: -0.1 }],
    [CUE.m1Off, 'crtOff', { gain: 0.32, pan: 0.5 }],
    [CUE.viewersFinal, 'tick', { gain: 0.22, pan: -0.2 }],
    [CUE.relayEnd, 'relay', { gain: 0.35, pan: 0.0, dry: true }],
  ];
  // Ballast ticks as each corridor fixture dims overhead.
  for (let k = 0; k < 11; k++) {
    const fz = 1.5 - k * 3;
    for (let t = CUE.hallway; t < CUE.card; t += 0.02) {
      if (trackZ(t) < fz - 0.35) {
        if (k !== 5) L.push([t, 'ballast', { gain: 0.14, pan: (k % 2 ? 0.15 : -0.15) }]);
        break;
      }
    }
  }
  return L.sort((a, b) => a[0] - b[0]);
}

// ── Buffers ──────────────────────────────────────────────────────────────────
function noiseBuffer(ctx, seconds, color, seed) {
  const rnd = mulberry32(seed);
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = rnd() * 2 - 1;
      if (color === 'white') d[i] = w * 0.5;
      else if (color === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    }
    // short crossfade so the loop is seamless
    const f = Math.min(2048, n >> 2);
    for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }
  }
  return buf;
}

function impulse(ctx, seconds, seed, damp = 0.5) {
  const rnd = mulberry32(seed);
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const a = Math.pow(1 - t, 3.2);
      const k = 0.85 - damp * 0.8 * t;
      lp = lp * (1 - k) + (rnd() * 2 - 1) * k;
      d[i] = lp * a * (i < 40 ? i / 40 : 1);
    }
  }
  return buf;
}

// ── Engine ──────────────────────────────────────────────────────────────────
export class Soundtrack {
  constructor() {
    this.ctx = null;
    this.live = [];
    this.muted = false;
    this.playing = false;
    this.vo = {};
    this.from = 0;
    this.t0 = 0;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC({ latencyHint: 'playback' });
    this.bus = makeBus(this.ctx, this.ctx.destination);
    this.bus.master.gain.value = this.muted ? 0 : 1;
    this.recordDest = this.ctx.createMediaStreamDestination ? this.ctx.createMediaStreamDestination() : null;
    if (this.recordDest) this.bus.out.connect(this.recordDest);
    return this.ctx;
  }

  // Optional recorded narration: files named after NARRATION ids in `base`.
  async loadVO(base) {
    const ctx = this.ensure();
    if (!ctx) return;
    await Promise.all(NARRATION.map(async (n) => {
      for (const ext of ['mp3', 'wav', 'ogg']) {
        try {
          const r = await fetch(`${base}${n.id}.${ext}`);
          if (!r.ok) continue;
          this.vo[n.id] = await ctx.decodeAudioData(await r.arrayBuffer());
          return;
        } catch (e) { /* not present */ }
      }
    }));
  }

  setMuted(m) {
    this.muted = m;
    if (this.bus) this.bus.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03);
  }

  play(from) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.stopNodes();
    if (ctx.state === 'suspended') ctx.resume();
    this.from = from;
    this.t0 = ctx.currentTime + 0.06;
    this.live = schedule(ctx, this.bus, from, this.t0, this.vo);
    this.playing = true;
  }

  pause() { this.stopNodes(); this.playing = false; }

  stopNodes() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const n of this.live) { try { n.stop(now + 0.01); } catch (e) { /* already stopped */ } }
    if (this.live.gains) for (const g of this.live.gains) { try { g.disconnect(); } catch (e) { /* noop */ } }
    this.live = [];
  }

  // Timeline time according to the audio clock.
  time() {
    if (!this.ctx || !this.playing) return null;
    return this.from + (this.ctx.currentTime - this.t0);
  }

  get running() { return this.ctx && this.ctx.state === 'running'; }

  async renderBuffer(sr = 48000) {
    const off = new OfflineAudioContext(2, sr * DURATION, sr);
    const bus = makeBus(off, off.destination);
    schedule(off, bus, 0, 0, this.vo);
    return off.startRendering();
  }

  async renderWav() {
    return encodeWav(await this.renderBuffer());
  }
}

function makeBus(ctx, destination) {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.35;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
  const out = ctx.createGain();
  out.gain.value = 0.8;
  master.connect(comp); comp.connect(lim); lim.connect(out); out.connect(destination);

  const room = ctx.createConvolver(); room.buffer = impulse(ctx, 1.6, 101, 0.5);
  const hall = ctx.createConvolver(); hall.buffer = impulse(ctx, 4.2, 202, 0.7);
  const roomRet = ctx.createGain(); roomRet.gain.value = 0.35;
  const hallRet = ctx.createGain(); hallRet.gain.value = 0.42;
  room.connect(roomRet); roomRet.connect(master);
  hall.connect(hallRet); hallRet.connect(master);

  const buffers = {
    white: noiseBuffer(ctx, 4, 'white', 7),
    pink: noiseBuffer(ctx, 6, 'pink', 8),
    brown: noiseBuffer(ctx, 8, 'brown', 9),
  };
  return { master, out, room, hall, buffers };
}

function schedule(ctx, bus, from, t0, vo) {
  const nodes = [];
  nodes.gains = [];
  const at = (t) => t0 + Math.max(0, t - from);
  const endT = at(DURATION) + 0.2;

  const envelope = (param, keys) => {
    let v0 = keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [ta, va] = keys[i], [tb, vb] = keys[i + 1];
      if (from >= ta && from <= tb) { v0 = tb > ta ? va + (vb - va) * (from - ta) / (tb - ta) : vb; break; }
      if (from > tb) v0 = vb;
    }
    param.setValueAtTime(v0, t0);
    for (const [t, v] of keys) if (t > from) param.linearRampToValueAtTime(v, at(t));
  };
  const gain = (v = 1, dest = bus.master) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); nodes.gains.push(g); return g; };
  const osc = (type, freq, dest, detune = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    o.connect(dest); o.start(t0); o.stop(endT); nodes.push(o); return o;
  };
  const loop = (buf, dest, rate = 1) => {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    s.connect(dest); s.start(t0, (from * 0.37) % buf.duration); s.stop(endT); nodes.push(s); return s;
  };
  const filter = (type, f, Q = 0.7, dest) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q; b.connect(dest); return b; };
  const panner = (p, dest) => { const s = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (!s) return dest; s.pan.value = p; s.connect(dest); return s; };

  // ── Beds ──
  { // transformer hum
    const g = gain(0); envelope(g.gain, ENV.hum);
    const lp = filter('lowpass', 900, 0.5, g);
    [[60, 'sine', 0.5, 0], [120, 'sine', 0.38, 3], [180, 'triangle', 0.12, -4], [240, 'sine', 0.09, 2], [300, 'sine', 0.05, 0], [360, 'sine', 0.025, 5]]
      .forEach(([f, ty, a, d]) => { const pg = gain(a, lp); osc(ty, f, pg, d); });
  }
  { // room tone
    const g = gain(0); envelope(g.gain, ENV.room);
    loop(bus.buffers.brown, filter('bandpass', 260, 0.6, g), 1);
    const g2 = gain(0, bus.room); envelope(g2.gain, ENV.room.map(([t, v]) => [t, v * 0.5]));
    loop(bus.buffers.pink, filter('lowpass', 700, 0.5, g2), 0.5);
  }
  { // corridor tone (reverberant)
    const g = gain(0); envelope(g.gain, ENV.hall);
    const send = gain(0.6, bus.hall);
    g.connect(send);
    const lp = filter('lowpass', 1100, 0.5, g);
    loop(bus.buffers.pink, lp, 0.8);
  }
  { // fluorescent buzz
    const g = gain(0); envelope(g.gain, ENV.buzz);
    const bp = filter('bandpass', 3100, 3, g);
    osc('sawtooth', 120, bp);
    osc('sawtooth', 120.4, bp);
  }
  { // sterile card air
    const g = gain(0); envelope(g.gain, ENV.air);
    loop(bus.buffers.pink, filter('highpass', 1800, 0.5, g), 1);
  }
  { // low swells: two beating sines a semitone apart, filtered
    const g = gain(0); envelope(g.gain, ENV.drone);
    const lp = filter('lowpass', 140, 0.5, g);
    osc('sine', 41.2, gain(0.6, lp)); osc('sine', 43.65, gain(0.5, lp)); osc('sine', 82.4, gain(0.15, lp), 6);
  }
  { // ultraviolet pad
    const g = gain(0); envelope(g.gain, ENV.pad);
    const lp = filter('lowpass', 520, 0.8, g);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 180;
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t0); lfo.stop(endT); nodes.push(lfo);
    const send = gain(0.5, bus.room); g.connect(send);
    osc('triangle', 146.83, gain(0.5, lp), -4); osc('triangle', 155.56, gain(0.4, lp), 3); osc('triangle', 220.0, gain(0.25, lp), -2);
  }
  { // CRT line whine
    const g = gain(0); envelope(g.gain, ENV.whine);
    osc('sine', 15734, g);
  }
  { // the last hiss before silence
    const g = gain(0); envelope(g.gain, ENV.hiss);
    loop(bus.buffers.pink, filter('lowpass', 3000, 0.5, g), 1);
  }

  // ── One-shots ──
  const W = bus.buffers.white;
  const burst = (t, dur, dest, { rate = 1, offset = 0 } = {}) => {
    const s = ctx.createBufferSource(); s.buffer = W; s.playbackRate.value = rate;
    s.connect(dest); s.start(t, offset % (W.duration - dur - 0.01), dur); nodes.push(s); return s;
  };
  const envGain = (dest, t, a, peak, d) => {
    const g = ctx.createGain(); g.connect(dest); nodes.gains.push(g);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    return g;
  };
  const tone = (t, f, dest, { type = 'sine', a = 0.003, d = 0.3, peak = 1, f2 = null } = {}) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
    o.connect(envGain(dest, t, a, peak, d)); o.start(t); o.stop(t + a + d + 0.05); nodes.push(o);
  };

  const FX = {
    relay(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const verb = o.dry ? null : gain(o.gain * 0.3, bus.room);
      [0, 0.017].forEach((dt, i) => {
        const bp = filter('bandpass', i ? 1300 : 2100, 6, envGain(p, t + dt, 0.0005, i ? 0.6 : 1, 0.03));
        burst(t + dt, 0.04, bp, { offset: 0.3 + i });
        tone(t + dt, i ? 900 : 1600, p, { d: 0.035, peak: 0.25 });
        if (verb) burst(t + dt, 0.03, filter('bandpass', 1800, 3, envGain(verb, t + dt, 0.0005, 1, 0.02)), { offset: 1.1 });
      });
    },
    crtOn(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t, 70, p, { d: 0.5, peak: 0.6, f2: 38 });
      const am = gain(0, p);
      am.gain.setValueAtTime(0, t); am.gain.linearRampToValueAtTime(0.2, t + 0.15); am.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      const o1 = ctx.createOscillator(); o1.frequency.value = 60; o1.connect(am); o1.start(t); o1.stop(t + 1.3); nodes.push(o1);
      burst(t + 0.05, 0.6, filter('bandpass', 4200, 0.8, envGain(p, t + 0.05, 0.01, 0.35, 0.5)), { offset: 0.7 });
      tone(t + 0.1, 11000, p, { d: 0.6, peak: 0.01, f2: 15700, a: 0.2 });
    },
    crtOff(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      burst(t, 0.03, filter('lowpass', 900, 0.7, envGain(p, t, 0.001, 1, 0.05)), { offset: 2.2 });
      tone(t, 15600, p, { d: 0.4, peak: 0.012, f2: 5000 });
      burst(t + 0.02, 0.3, filter('bandpass', 3500, 1, envGain(p, t + 0.02, 0.005, 0.25, 0.25)), { offset: 1.7 });
      tone(t, 60, p, { d: 0.35, peak: 0.4, f2: 35 });
      const v = gain(o.gain * 0.4, bus.room);
      burst(t, 0.05, filter('bandpass', 1200, 1, envGain(v, t, 0.001, 1, 0.05)), { offset: 2.9 });
    },
    metal(t, o) {
      const dry = gain(o.gain * 0.35);
      const p = panner(o.pan || 0, dry);
      const wet = gain(o.gain * 1.1, bus.hall);
      const lp = filter('lowpass', o.far ? 520 : 800, 0.7, p); lp.connect(wet);
      [87, 141, 213.5, 379, 561, 822].forEach((f, i) => tone(t + i * 0.004, f, lp, { d: 2.2 + (i % 3), peak: 0.22 / (1 + i * 0.4), f2: f * 0.985 }));
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.connect(envGain(lp, t + 0.1, 0.25, 0.4, 1.4));
      bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(260, t + 1.6);
      burst(t + 0.1, 1.7, bp, { offset: 0.4, rate: 0.6 });
    },
    creak(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      const v = gain(o.gain * 0.5, bus.room);
      const len = o.len || 1.6;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 12; bp.connect(p); bp.connect(v);
      bp.frequency.setValueAtTime(410, t); bp.frequency.linearRampToValueAtTime(330, t + len);
      const g = ctx.createGain(); g.connect(bp); nodes.gains.push(g);
      g.gain.setValueAtTime(0, t);
      const rnd = mulberry32(Math.floor(t * 100));
      for (let k = 0; k < len * 9; k++) { const tk = t + k / 9 + rnd() * 0.05; g.gain.setTargetAtTime(rnd() * 0.8, tk, 0.03); }
      g.gain.setTargetAtTime(0, t + len, 0.1);
      const s = ctx.createOscillator(); s.type = 'sawtooth'; s.frequency.value = 38; s.connect(g); s.start(t); s.stop(t + len + 0.6); nodes.push(s);
    },
    behind(t, o) {
      // Cloth and a soft weight shift, placed behind the listener with HRTF.
      const g = gain(o.gain);
      let dest = g, pn = null;
      if (ctx.createPanner) {
        pn = ctx.createPanner(); pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 1;
        pn.connect(g);
        const set = (p, v, tt) => { if (p && p.linearRampToValueAtTime) { p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, tt); } };
        if (pn.positionX) {
          pn.positionX.setValueAtTime(o.from, t); pn.positionY.setValueAtTime(0, t); pn.positionZ.setValueAtTime(1.4, t);
          set(pn.positionX, o.to, t + o.dur);
        } else pn.setPosition(o.from, 0, 1.4);
        dest = pn;
      }
      const bp = filter('bandpass', 2300, 0.9, dest);
      const rnd = mulberry32(Math.floor(t * 31));
      const steps = Math.round(o.dur * 2.2);
      for (let k = 0; k < steps; k++) {
        const tk = t + (k / steps) * o.dur + rnd() * 0.1;
        burst(tk, 0.35, filter('bandpass', 1800 + rnd() * 1400, 0.8, envGain(bp, tk, 0.08, 0.5 + rnd() * 0.3, 0.25)), { offset: rnd() * 3 });
        tone(tk + 0.05, 95 + rnd() * 20, dest, { d: 0.18, peak: 0.25, f2: 70 });
      }
    },
    tick(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t, 1500, p, { d: 0.03, peak: 0.6 });
      burst(t, 0.02, filter('highpass', 3000, 0.7, envGain(p, t, 0.0005, 0.4, 0.015)), { offset: 0.9 });
    },
    chime(t, o) {
      const g = gain(o.gain);
      tone(t, 1318.5, g, { d: 1.1, peak: 1 });
      tone(t, 2637, g, { d: 0.6, peak: 0.28 });
      tone(t, 3955.5, g, { d: 0.25, peak: 0.08 });
    },
    tear(t, o) {
      const g = gain(o.gain);
      const v = gain(o.gain * 0.25, bus.room);
      const rnd = mulberry32(4242);
      const dur = o.dur * 0.55;
      const n = 70;
      for (let k = 0; k < n; k++) {
        const tk = t + (k / n) * dur + rnd() * 0.01;
        const f = 1400 + rnd() * 2600;
        const bp = filter('bandpass', f, 1.2, envGain(g, tk, 0.001, 0.4 + rnd() * 0.6, 0.012 + rnd() * 0.02));
        bp.connect(v);
        burst(tk, 0.04, bp, { offset: rnd() * 3 });
      }
      // the two halves pulling away
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.connect(envGain(g, t + dur * 0.8, 0.15, 0.35, o.dur * 0.6));
      lp.frequency.setValueAtTime(2500, t + dur * 0.8); lp.frequency.exponentialRampToValueAtTime(300, t + o.dur * 1.2);
      burst(t + dur * 0.8, o.dur, lp, { offset: 1.3 });
    },
    clunk(t, o) {
      FX.relay(t, { gain: o.gain * 0.8, pan: o.pan });
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t + 0.01, 72, p, { d: 0.3, peak: 0.7, f2: 48 });
      tone(t + 0.01, 880, p, { d: 0.08, peak: 0.12 });
    },
    sag(t, o) {
      const g = gain(o.gain);
      tone(t, 120, g, { type: 'triangle', a: 0.05, d: 0.9, peak: 0.25, f2: 96 });
    },
    ballast(t, o) {
      const p = panner(o.pan || 0, gain(o.gain));
      tone(t, 2400, p, { d: 0.06, peak: 0.25 });
      burst(t, 0.04, filter('bandpass', 3000, 2, envGain(p, t, 0.0005, 0.4, 0.03)), { offset: 2.4 });
      const h = gain(o.gain * 0.5, bus.hall);
      tone(t, 120, h, { type: 'sawtooth', d: 0.6, peak: 0.05, f2: 100 });
    },
    cut() {},
  };

  for (const [t, kind, o] of cueList()) {
    if (t < from - 0.01) continue;
    FX[kind](at(t), o);
  }

  // Recorded narration, if provided
  for (const n of NARRATION) {
    const buf = vo[n.id];
    if (!buf || n.start + buf.duration < from) continue;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = gain(0.95); s.connect(g);
    const r = gain(0.12, bus.room); s.connect(r);
    const offset = Math.max(0, from - n.start);
    s.start(at(n.start), offset);
    nodes.push(s);
  }
  return nodes;
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
  const ab = new ArrayBuffer(44 + n * ch * 2);
  const v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}
