// CREDIT THEMES — draw any moment of a sequence onto a 1920×1080 canvas.
// Every pixel is a pure function of (sequence, t): no Math.random, no wall clock. Scrubbing the preview,
// rendering frame 812 headlessly and exporting a still card all produce the same image.
//
// Add a theme: add an entry to THEME_META (sequence.js) and to THEMES below with a draw(ctx, seq, loc, o).

import { THEME_META, timeline, locate } from './sequence.js';
import { rng, graphemes, clamp, pad } from './util.js';

export const W = 1920, H = 1080;
const SAFE = { x: 192, y: 108, w: 1536, h: 864 };          // 10% title-safe
const MONO = "'Courier New', 'Liberation Mono', 'DejaVu Sans Mono', monospace";
const SANS = "'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', 'DejaVu Sans', sans-serif";
const C = { teal: '#00FFC6', purple: '#8A2BE2', red: '#FF2D2D', orange: '#CC5500', gold: '#FFB347', pink: '#FF40CD', off: '#F2EEE6', dim: '#7d8a86' };

export function renderFrame(ctx, seq, t, opts = {}) {
  const tl = opts.timeline || timeline(seq);
  const loc = locate(seq, t, tl);
  const theme = THEMES[seq.theme] || THEMES.terminal;
  const o = { transparent: !!opts.transparent, frame: Math.round(loc.t * seq.fps), seq, warn: opts.onWarn || (() => {}) };
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
  theme.draw(ctx, seq, loc, o);
  ctx.restore();
  return loc;
}

// ── shared helpers ────────────────────────────────────────────────────────────
const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

/** Fade in over `inS`, out over `outS` at the end of the page. */
function envelope(loc, inS = 0.35, outS = 0.3, holdEnd = false) {
  const a = smooth(loc.pageT / inS);
  if (holdEnd) return a;
  return Math.min(a, smooth((loc.pageDur - loc.pageT) / outS));
}

function timecode(t, fps) {
  const f = Math.floor(t * fps), s = Math.floor(f / fps);
  return `${pad(Math.floor(s / 3600), 2)}:${pad(Math.floor(s / 60) % 60, 2)}:${pad(s % 60, 2)}:${pad(f % fps, 2)}`;
}

/** Fit text into maxW without dropping below minSize; truncate with an ellipsis as a last resort. */
function fit(ctx, text, maxW, size, minSize, font, o) {
  let s = size;
  ctx.font = font(s);
  while (ctx.measureText(text).width > maxW && s > minSize) { s -= 2; ctx.font = font(s); }
  if (ctx.measureText(text).width > maxW) {
    const g = graphemes(text);
    let n = g.length;
    while (n > 1 && ctx.measureText(g.slice(0, n).join('') + '…').width > maxW) n--;
    o && o.warn(`"${text}" clipped to fit at ${s}px`);
    text = g.slice(0, n).join('') + '…';
  }
  return { text, size: s };
}

function typed(text, pageT, start, cps) {
  const g = graphemes(text);
  const n = clamp(Math.floor((pageT - start) * cps), 0, g.length);
  return { s: g.slice(0, n).join(''), done: n >= g.length, n };
}

function scanlines(ctx, alpha, step = 4) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < H; y += step) ctx.fillRect(0, y, W, step / 2);
}

function staticNoise(ctx, seed, frame, amount, color = '255,255,255') {
  const r = rng(seed + ':n:' + frame);
  const n = Math.floor(2600 * amount);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = `rgba(${color},${(0.15 + r() * 0.5).toFixed(2)})`;
    ctx.fillRect(Math.floor(r() * W), Math.floor(r() * H), 2 + Math.floor(r() * 5), 2);
  }
}

function vignette(ctx, inner = '#000000', outerA = 0.65) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${outerA})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/** Text with a dark outline in transparent mode so it reads over any footage. */
function text(ctx, s, x, y, o, stroke = 6) {
  if (o.transparent) {
    ctx.save(); ctx.shadowBlur = 0; ctx.lineJoin = 'round'; ctx.lineWidth = stroke; ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(s, x, y); ctx.restore();
  }
  ctx.fillText(s, x, y);
}

function gridSlots(n, cols, x, y, w, h, maxRowH = 128) {
  const rows = Math.ceil(n / cols), out = [];
  const cw = w / cols, rh = Math.min(maxRowH, h / Math.max(rows, 1));
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i / rows), r = i % rows;     // fill column-first, like a credits roll
    out.push({ x: x + c * cw, y: y + r * rh, w: cw, h: rh });
  }
  return out;
}

function columnsFor(n) { return n <= 4 ? 1 : 2; }

/** A small drawn Bean (no image assets). */
function bean(ctx, x, y, s, rot, fill = C.gold) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.68, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(s * 0.1, s * 0.05, s * 0.55, s * 0.12, -0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-s * 0.45, -s * 0.3, s * 0.18, s * 0.1, -0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function pageLabel(loc) {
  const n = loc.seg.pages.length;
  return n > 1 ? `PAGE ${loc.pi + 1}/${n}` : '';
}

// ══════════════════════════════════════════════════════════════════════════════
// THE TERMINAL — retro command line. Typed names, blinking cursor, status lines.
// ══════════════════════════════════════════════════════════════════════════════
function drawTerminal(ctx, seq, loc, o) {
  const F = (s, b = true) => `${b ? 'bold ' : ''}${s}px ${MONO}`;
  const green = C.teal;
  if (!o.transparent) {
    ctx.fillStyle = '#020806'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, H);
    g.addColorStop(0, 'rgba(0,255,198,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const cursorOn = Math.floor(loc.t * 2.2) % 2 === 0;
  const seg = loc.seg;

  // status bar
  ctx.globalAlpha = 1;
  ctx.font = F(24, false); ctx.fillStyle = 'rgba(0,255,198,0.55)';
  ctx.textAlign = 'left';
  text(ctx, `STOOPID-OS 2.3 // CREDITS.DEPT // TTY0`, SAFE.x, SAFE.y - 30, o, 4);
  ctx.textAlign = 'right';
  text(ctx, `EP ${pad(seq.episode.number)} · ${timecode(loc.t, seq.fps)}`, SAFE.x + SAFE.w, SAFE.y - 30, o, 4);
  ctx.fillStyle = 'rgba(0,255,198,0.25)'; ctx.fillRect(SAFE.x, SAFE.y - 16, SAFE.w, 2);
  ctx.textAlign = 'left';

  const a = envelope(loc, 0.12, 0.22, seg.kind === 'final');
  ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(0,255,198,0.55)'; ctx.shadowBlur = o.transparent ? 0 : 14;

  const prompt = (line, y, start = 0, cps = 48, size = 30) => {
    const tp = typed(line, loc.pageT, start, cps);
    ctx.font = F(size, false); ctx.fillStyle = 'rgba(0,255,198,0.75)';
    text(ctx, tp.s, SAFE.x, y, o, 4);
    return tp;
  };

  if (seg.kind === 'ident') {
    if (!o.transparent) staticNoise(ctx, seq.seed, o.frame, clamp(1 - loc.pageT / 1.2, 0.08, 1), '0,255,198');
    const l1 = prompt('> RECEIVING END OF TRANSMISSION ...', SAFE.y + 60, 0.2, 40);
    if (loc.pageT > 0.9) {
      const sz = 150, y = H / 2 + 20;
      ctx.font = F(sz); ctx.fillStyle = green; ctx.textAlign = 'center';
      const jit = loc.pageT < 1.4 ? (rng(seq.seed + o.frame)() - 0.5) * 18 : 0;
      text(ctx, 'THE STOOPID SHOW', W / 2 + jit, y, o, 10);
      ctx.font = F(32, false); ctx.fillStyle = C.off;
      const sub = typed(seg.subtitle, loc.pageT, 1.5, 36);
      text(ctx, sub.s, W / 2, y + 80, o, 4);
      ctx.textAlign = 'left';
    }
    if (loc.pageT > 3.0 || (l1.done && loc.pageT > loc.pageDur * 0.75)) {
      ctx.font = F(30, false); ctx.fillStyle = green;
      text(ctx, '[ OK ] SIGNAL ACQUIRED. GRATITUDE ROUTINE STARTING.', SAFE.x, SAFE.y + SAFE.h - 10, o, 4);
    }
  } else if (seg.kind === 'final') {
    drawFinalLines(ctx, seg, loc, o, { font: F, lead: C.off, big: green, aside: 'rgba(0,255,198,0.7)', card: green, typedCps: 40, cursor: cursorOn, align: 'left' });
  } else {
    const q = `> SELECT name FROM ${seg.key || 'credits'} WHERE consent = TRUE;`;
    prompt(q, SAFE.y + 44, 0, 70, 28);
    const titleY = SAFE.y + 140;
    ctx.font = F(68); ctx.fillStyle = C.off;
    const tt = fit(ctx, seg.title, SAFE.w, 68, 48, (s) => F(s), o);
    ctx.font = F(tt.size); text(ctx, tt.text, SAFE.x, titleY, o, 8);
    ctx.font = F(30, false); ctx.fillStyle = 'rgba(0,255,198,0.8)';
    text(ctx, seg.subtitle || '', SAFE.x, titleY + 50, o, 4);
    const top = titleY + 110, bottom = SAFE.y + SAFE.h - 70;
    const items = loc.page.items;

    if (seg.kind === 'leaderboard') {
      drawBoard(ctx, seg, loc, o, { x: SAFE.x, y: top, w: SAFE.w, h: bottom - top, font: F, color: C.off, accent: green, beans: C.gold, box: true });
    } else if (seg.kind === 'creators') {
      const rh = Math.min(210, (bottom - top) / Math.max(items.length, 1));
      items.forEach((it, i) => {
        const y = top + i * rh + 56, start = 0.45 + i * 0.35;
        ctx.fillStyle = green; ctx.font = F(52);
        const tp = typed(`${it.name}`, loc.pageT, start, 30);
        const f = fit(ctx, it.name, SAFE.w * 0.62, 56, 44, (s) => F(s), o);
        ctx.font = F(f.size); text(ctx, tp.done ? f.text : tp.s, SAFE.x, y, o, 7);
        if (tp.done) {
          ctx.font = F(32, false); ctx.fillStyle = C.off;
          const bits = [it.handle ? '@' + it.handle : '', it.label].filter(Boolean).join('  ·  ');
          text(ctx, bits, SAFE.x, y + 44, o, 4);
        }
      });
    } else if (seg.kind === 'empty') {
      ctx.font = F(44); ctx.fillStyle = C.off; ctx.textAlign = 'center';
      text(ctx, typed(seg.note, loc.pageT, 0.4, 30).s, W / 2, H / 2 + 40, o, 6); ctx.textAlign = 'left';
    } else {
      const cols = columnsFor(items.length);
      const slots = gridSlots(items.length, cols, SAFE.x, top, SAFE.w, bottom - top);
      let lastTyping = null;
      items.forEach((it, i) => {
        const sl = slots[i], start = 0.5 + i * 0.16;
        const label = it.role ? `${it.name}` : it.name;
        ctx.font = F(46);
        const f = fit(ctx, label, sl.w - 40, 46, 40, (s) => F(s), o);
        const tp = typed(f.text, loc.pageT, start, 34);
        ctx.font = F(f.size); ctx.fillStyle = it.more || it.anon ? C.gold : C.off;
        const y = sl.y + Math.min(sl.h, 120) * 0.62;
        text(ctx, tp.s, sl.x, y, o, 6);
        if (it.role && tp.done) {
          ctx.font = F(28, false); ctx.fillStyle = green;
          text(ctx, it.role.toUpperCase(), sl.x, y + 36, o, 4);
        }
        if (!tp.done && tp.n > 0) lastTyping = { x: sl.x + ctx.measureText(tp.s).width + 6, y };
      });
      if (lastTyping && cursorOn) { ctx.fillStyle = green; ctx.fillRect(lastTyping.x, lastTyping.y - 38, 22, 44); }
    }

    // footer: notice + page label
    ctx.font = F(26, false); ctx.textAlign = 'left';
    if (seg.notice) { ctx.fillStyle = C.gold; text(ctx, `NOTICE: ${seg.notice}`, SAFE.x, SAFE.y + SAFE.h - 6, o, 4); }
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(0,255,198,0.6)';
    text(ctx, pageLabel(loc), SAFE.x + SAFE.w, SAFE.y + SAFE.h - 6, o, 4);
    ctx.textAlign = 'left';
  }
  ctx.shadowBlur = 0; ctx.globalAlpha = 1;
  if (!o.transparent) { scanlines(ctx, 0.22); vignette(ctx); }
}

// ══════════════════════════════════════════════════════════════════════════════
// MIDNIGHT BROADCAST — black, clean white, slow dissolves, dry.
// ══════════════════════════════════════════════════════════════════════════════
function drawMidnight(ctx, seq, loc, o) {
  const F = (s, w = 600) => `${w} ${s}px ${SANS}`;
  if (!o.transparent) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  const seg = loc.seg;
  // corner bug + timestamp, always on
  ctx.globalAlpha = 0.6; ctx.fillStyle = C.off; ctx.font = F(22, 500);
  ctx.textAlign = 'left'; text(ctx, `STOOPID · EP ${pad(seq.episode.number)}`, SAFE.x, H - 70, o, 3);
  ctx.textAlign = 'right'; text(ctx, `LIVE  ${timecode(loc.t, seq.fps)}`, SAFE.x + SAFE.w, H - 70, o, 3);
  ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(SAFE.x + SAFE.w - 212, H - 78, 6, 0, Math.PI * 2);
  if (Math.floor(loc.t) % 2 === 0) ctx.fill();
  ctx.textAlign = 'center';

  const a = envelope(loc, 0.7, 0.6, seg.kind === 'final');
  ctx.globalAlpha = a;
  const drift = (1 - ease(loc.pageT / 1.2)) * 14;

  if (seg.kind === 'ident') {
    const r = ease((loc.pageT - 0.3) / 1.2);
    ctx.globalAlpha = a * r;
    ctx.fillStyle = C.off; ctx.font = F(26, 500);
    text(ctx, spaced('END OF TRANSMISSION'), W / 2, H / 2 - 120, o, 4);
    ctx.font = F(124, 800); text(ctx, 'THE STOOPID SHOW', W / 2, H / 2 + 30 + drift, o, 10);
    ctx.fillStyle = 'rgba(242,238,230,0.25)'; ctx.fillRect(W / 2 - 300 * r, H / 2 + 80, 600 * r, 2);
    ctx.globalAlpha = a * ease((loc.pageT - 1.6) / 1);
    ctx.fillStyle = 'rgba(242,238,230,0.75)'; ctx.font = F(28, 400);
    text(ctx, seg.subtitle, W / 2, H / 2 + 140, o, 4);
    if (!o.transparent) staticNoise(ctx, seq.seed, o.frame, 0.05);
  } else if (seg.kind === 'final') {
    drawFinalLines(ctx, seg, loc, o, { font: (s, b) => F(s, b === false ? 400 : 700), lead: C.off, big: C.off, aside: 'rgba(242,238,230,0.7)', card: C.off, typedCps: 0, align: 'center' });
  } else {
    ctx.fillStyle = 'rgba(242,238,230,0.6)'; ctx.font = F(24, 500);
    text(ctx, spaced(seg.subtitle ? 'PRESENTED IN GRATITUDE' : 'WITH THANKS'), W / 2, SAFE.y + 40, o, 3);
    ctx.fillStyle = C.off;
    const t = fit(ctx, seg.title, SAFE.w, 60, 44, (s) => F(s, 800), o);
    ctx.font = F(t.size, 800); text(ctx, t.text, W / 2, SAFE.y + 120 + drift, o, 7);
    ctx.font = F(28, 400); ctx.fillStyle = 'rgba(242,238,230,0.7)';
    text(ctx, seg.subtitle || '', W / 2, SAFE.y + 172 + drift, o, 4);
    ctx.fillStyle = 'rgba(242,238,230,0.2)'; ctx.fillRect(W / 2 - 80, SAFE.y + 205, 160, 2);
    const top = SAFE.y + 250, bottom = SAFE.y + SAFE.h - 90;
    const items = loc.page.items;
    if (seg.kind === 'leaderboard') {
      ctx.textAlign = 'left';
      drawBoard(ctx, seg, loc, o, { x: SAFE.x + 160, y: top, w: SAFE.w - 320, h: bottom - top, font: (s, b) => F(s, b === false ? 400 : 700), color: C.off, accent: 'rgba(242,238,230,0.6)', beans: C.gold, box: false });
    } else if (seg.kind === 'creators') {
      const rh = Math.min(210, (bottom - top) / Math.max(items.length, 1));
      items.forEach((it, i) => {
        ctx.globalAlpha = a * ease((loc.pageT - 0.4 - i * 0.35) / 0.8);
        const y = top + i * rh + rh * 0.42;
        const f = fit(ctx, it.name, SAFE.w - 200, 56, 44, (s) => F(s, 700), o);
        ctx.fillStyle = C.off; ctx.font = F(f.size, 700); text(ctx, f.text, W / 2, y, o, 6);
        ctx.font = F(30, 400); ctx.fillStyle = 'rgba(242,238,230,0.7)';
        text(ctx, [it.handle ? '@' + it.handle : '', it.label].filter(Boolean).join('   ·   '), W / 2, y + 46, o, 4);
      });
    } else if (seg.kind === 'empty') {
      ctx.font = F(40, 500); ctx.fillStyle = C.off; text(ctx, seg.note, W / 2, H / 2 + 60, o, 5);
    } else {
      const cols = columnsFor(items.length);
      const slots = gridSlots(items.length, cols, SAFE.x, top, SAFE.w, bottom - top);
      items.forEach((it, i) => {
        const sl = slots[i];
        ctx.globalAlpha = a * ease((loc.pageT - 0.35 - i * 0.07) / 0.7);
        const cx = sl.x + sl.w / 2, y = sl.y + Math.min(sl.h, 130) * 0.55;
        const f = fit(ctx, it.name, sl.w - 60, 52, 40, (s) => F(s, 600), o);
        ctx.fillStyle = it.more || it.anon ? C.gold : C.off; ctx.font = F(f.size, 600);
        text(ctx, f.text, cx, y, o, 6);
        if (it.role) { ctx.font = F(26, 400); ctx.fillStyle = 'rgba(242,238,230,0.65)'; text(ctx, spaced(it.role.toUpperCase()), cx, y + 38, o, 3); }
      });
    }
    ctx.globalAlpha = a * 0.85;
    ctx.font = F(24, 500); ctx.fillStyle = 'rgba(242,238,230,0.7)';
    if (seg.notice) text(ctx, seg.notice, W / 2, SAFE.y + SAFE.h - 30, o, 3);
    ctx.textAlign = 'right'; text(ctx, pageLabel(loc), SAFE.x + SAFE.w, SAFE.y + 40, o, 3);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
  if (!o.transparent) { scanlines(ctx, 0.08, 3); vignette(ctx, '#000', 0.5); }
}

function spaced(s) { return s.split('').join(' '); }

// ══════════════════════════════════════════════════════════════════════════════
// DEPARTMENT OF BEANS — arcade. Pixel tiles, counters that count, Beans that bounce.
// ══════════════════════════════════════════════════════════════════════════════
function drawBeans(ctx, seq, loc, o) {
  const F = (s, b = true) => `${b ? 'bold ' : ''}${s}px ${MONO}`;
  const seg = loc.seg;
  if (!o.transparent) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#14062e'); g.addColorStop(1, '#05010d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(138,43,226,0.22)'; ctx.lineWidth = 2;
    const off = (loc.t * 40) % 60;                         // scrolling floor grid
    for (let y = H * 0.84; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y + (off % 30)); ctx.lineTo(W, y + (off % 30)); ctx.stroke(); }
    for (let x = -W; x < W * 2; x += 120) { ctx.beginPath(); ctx.moveTo(W / 2, H * 0.84); ctx.lineTo(x, H); ctx.stroke(); }
  }
  // marquee
  ctx.textAlign = 'center'; ctx.font = F(28); ctx.fillStyle = C.pink;
  const blink = Math.floor(loc.t * 3) % 2 === 0;
  text(ctx, `1UP  EP-${pad(seq.episode.number)}     HI-SCORE: GRATITUDE     CREDIT ${blink ? '01' : '  '}`, W / 2, SAFE.y - 30, o, 4);
  const a = envelope(loc, 0.2, 0.25, seg.kind === 'final');
  ctx.globalAlpha = a;
  const hard = (s, x, y, col, sh = 6) => {        // pixel drop-shadow
    ctx.fillStyle = '#000'; ctx.fillText(s, x + sh, y + sh); ctx.fillStyle = col; text(ctx, s, x, y, o, 6);
  };

  if (seg.kind === 'ident') {
    const p = ease(loc.pageT / 1.1);
    ctx.font = F(140); hard('THE STOOPID SHOW', W / 2, H / 2 - 20 + (1 - p) * -400, C.gold, 10);
    ctx.font = F(34); if (loc.pageT > 1.4) hard(seg.subtitle, W / 2, H / 2 + 70, C.off, 4);
    if (loc.pageT > 2.2 && blink) { ctx.font = F(44); hard('PRESS START TO BE THANKED', W / 2, H / 2 + 200, C.teal, 5); }
  } else if (seg.kind === 'final') {
    drawFinalLines(ctx, seg, loc, o, { font: F, lead: C.off, big: C.gold, aside: C.teal, card: C.pink, typedCps: 0, align: 'center', pixel: true });
  } else {
    ctx.font = F(64);
    const t = fit(ctx, seg.title, SAFE.w, 64, 46, (s) => F(s), o);
    ctx.font = F(t.size); hard(t.text, W / 2, SAFE.y + 70, C.gold, 6);
    ctx.font = F(28, false); ctx.fillStyle = C.teal; text(ctx, seg.subtitle || '', W / 2, SAFE.y + 118, o, 4);
    const top = SAFE.y + 170, bottom = SAFE.y + SAFE.h - 80;
    const items = loc.page.items;
    ctx.textAlign = 'left';
    if (seg.kind === 'leaderboard') {
      drawBoard(ctx, seg, loc, o, { x: SAFE.x + 60, y: top, w: SAFE.w - 120, h: bottom - top, font: F, color: C.off, accent: C.teal, beans: C.gold, box: false, arcade: true });
    } else if (seg.kind === 'creators') {
      const rh = Math.min(210, (bottom - top) / Math.max(items.length, 1));
      items.forEach((it, i) => {
        const p = ease((loc.pageT - 0.3 - i * 0.3) / 0.5);
        const y = top + i * rh, x = SAFE.x + (1 - p) * -600;
        ctx.globalAlpha = a * p;
        ctx.strokeStyle = C.purple; ctx.lineWidth = 4; ctx.strokeRect(x, y + 10, SAFE.w, rh - 24);
        bean(ctx, x + 60, y + rh / 2 - 4, 26, 0.4 + Math.sin(loc.t * 4 + i) * 0.3);
        const f = fit(ctx, it.name, SAFE.w - 180, 52, 42, (s) => F(s), o);
        ctx.font = F(f.size); hard(f.text, x + 120, y + rh / 2 - 6, C.off, 4);
        ctx.font = F(30, false); ctx.fillStyle = C.teal;
        text(ctx, [it.handle ? '@' + it.handle : '', it.label].filter(Boolean).join('  ·  '), x + 120, y + rh / 2 + 38, o, 4);
      });
    } else if (seg.kind === 'empty') {
      ctx.textAlign = 'center'; ctx.font = F(44); hard(seg.note, W / 2, H / 2 + 40, C.off, 4);
    } else {
      const cols = columnsFor(items.length);
      const slots = gridSlots(items.length, cols, SAFE.x, top, SAFE.w, bottom - top);
      items.forEach((it, i) => {
        const sl = slots[i], p = ease((loc.pageT - 0.3 - i * 0.09) / 0.35);
        if (p <= 0) return;
        ctx.globalAlpha = a * p;
        const pad_ = 14, bh = Math.min(sl.h - 16, it.role ? 112 : 84);
        ctx.fillStyle = 'rgba(138,43,226,0.25)'; ctx.fillRect(sl.x + pad_, sl.y + 6, sl.w - pad_ * 2, bh);
        ctx.strokeStyle = it.featured ? C.gold : 'rgba(138,43,226,0.9)'; ctx.lineWidth = 3; ctx.strokeRect(sl.x + pad_, sl.y + 6, sl.w - pad_ * 2, bh);
        bean(ctx, sl.x + pad_ + 38, sl.y + 6 + bh / 2, 15, 0.5, it.more || it.anon ? C.teal : C.gold);
        const f = fit(ctx, it.name, sl.w - pad_ * 2 - 90, 44, 40, (s) => F(s), o);
        ctx.font = F(f.size); ctx.fillStyle = it.more || it.anon ? C.gold : C.off;
        text(ctx, f.text, sl.x + pad_ + 70, sl.y + 6 + (it.role ? 50 : bh / 2 + 15), o, 5);
        if (it.role) { ctx.font = F(26, false); ctx.fillStyle = C.teal; text(ctx, it.role.toUpperCase(), sl.x + pad_ + 70, sl.y + 90, o, 4); }
      });
    }
    ctx.globalAlpha = a; ctx.font = F(26, false); ctx.textAlign = 'center';
    if (seg.notice) { ctx.fillStyle = C.pink; text(ctx, seg.notice, W / 2, SAFE.y + SAFE.h - 20, o, 4); }
    ctx.textAlign = 'right'; ctx.fillStyle = C.teal; text(ctx, pageLabel(loc), SAFE.x + SAFE.w, SAFE.y + SAFE.h - 20, o, 4);
  }
  // marching Beans along the bottom edge (action-safe zone, not title-safe)
  ctx.globalAlpha = 1;
  if (!o.transparent || seg.kind === 'ident') {
    for (let i = 0; i < 14; i++) {
      const x = ((i * 150 + loc.t * 120) % (W + 200)) - 100;
      const hop = Math.abs(Math.sin(loc.t * 5 + i * 0.9)) * 18;
      bean(ctx, x, H - 46 - hop, 13, Math.sin(loc.t * 3 + i) * 0.4, i % 5 === 0 ? C.teal : C.gold);
    }
  }
  ctx.textAlign = 'left';
  if (!o.transparent) scanlines(ctx, 0.12, 4);
}

// ── shared pieces ─────────────────────────────────────────────────────────────

/** Leaderboard table used by all themes. Beans count up; positions are the feed's real positions. */
function drawBoard(ctx, seg, loc, o, s) {
  const rows = loc.page.items, n = Math.max(rows.length, 1);
  const rh = Math.min(118, s.h / (n + 1));
  const big = clamp(Math.round(rh * 0.5), 40, 58);
  const cols = { pos: s.x, name: s.x + 200, beans: s.x + s.w };
  ctx.font = s.font(26, false); ctx.fillStyle = s.accent; ctx.textAlign = 'left';
  text(ctx, 'POS', cols.pos, s.y + 28, o, 3); text(ctx, 'PLAYER', cols.name, s.y + 28, o, 3);
  ctx.textAlign = 'right'; text(ctx, 'BEANS', cols.beans, s.y + 28, o, 3);
  if (s.box) { ctx.fillStyle = 'rgba(0,255,198,0.35)'; ctx.fillRect(s.x, s.y + 44, s.w, 2); }
  rows.forEach((r, i) => {
    const start = 0.35 + i * 0.22, p = ease((loc.pageT - start) / 0.45);
    if (p <= 0) return;
    const y = s.y + rh * (i + 1) + big * 0.55;
    const save = ctx.globalAlpha; ctx.globalAlpha = save * p;
    const first = (r.rank ?? r.pos) === 1;
    ctx.textAlign = 'left'; ctx.font = s.font(big); ctx.fillStyle = first ? s.beans : s.color;
    text(ctx, (r.tied ? 'T-' : '') + String(r.rank ?? r.pos).padStart(2, '0'), cols.pos, y, o, 6);
    const f = fit(ctx, r.name, s.w - 200 - 330, big, 40, (z) => s.font(z), o);
    ctx.font = s.font(f.size); ctx.fillStyle = s.color; text(ctx, f.text, cols.name, y, o, 6);
    const count = Math.round(r.beans * ease((loc.pageT - start) / 1.3));
    ctx.textAlign = 'right'; ctx.font = s.font(big); ctx.fillStyle = s.beans;
    text(ctx, count.toLocaleString('en-US'), cols.beans - (s.arcade ? 60 : 0), y, o, 6);
    if (s.arcade) bean(ctx, cols.beans - 24, y - big * 0.32, big * 0.32, 0.5);
    if (first && s.arcade && Math.floor(loc.t * 4) % 2 === 0 && p >= 1) {
      ctx.font = s.font(24); ctx.fillStyle = C.pink; ctx.textAlign = 'left';
      text(ctx, '★ HI-SCORE', cols.name, y - big - 4, o, 3);
    }
    ctx.globalAlpha = save;
  });
  ctx.textAlign = 'left'; ctx.font = s.font(24, false); ctx.fillStyle = s.accent;
  const foot = [seg.asof ? `SNAPSHOT ${seg.asof}` : '', seg.note, 'REAL BEANS · STOOPIDTV ARCADE'].filter(Boolean).join('   ·   ');
  text(ctx, foot, s.x, s.y + s.h + 4, o, 3);
}

/** The final transmission: timed lines from the chosen end card. */
function drawFinalLines(ctx, seg, loc, o, s) {
  const ec = seg.endCard, d = loc.pageDur, t = loc.pageT;
  const cardP = (t - ec.cardAt * d) / 0.5;
  const linesA = cardP > 0 ? 1 - smooth(cardP) : 1;
  const cx = s.align === 'center' ? W / 2 : SAFE.x;
  ctx.textAlign = s.align;
  let y = SAFE.y + 230;
  for (const ln of ec.lines) {
    const st = ln.at * d;
    if (t < st) break;
    const p = ease((t - st) / 0.5);
    ctx.globalAlpha = linesA * (s.typedCps ? 1 : p);
    const size = ln.style === 'big' ? 120 : ln.style === 'lead' ? 52 : 44;
    const font = (z) => s.font(z, ln.style !== 'aside');
    const f = fit(ctx, ln.text, SAFE.w, size, 40, font, o);
    ctx.font = font(f.size);
    ctx.fillStyle = ln.style === 'big' ? s.big : ln.style === 'lead' ? s.lead : s.aside;
    const shown = s.typedCps ? typed(f.text, t, st, s.typedCps).s : f.text;
    text(ctx, shown, cx, y + (ln.style === 'big' ? 70 : 0), o, ln.style === 'big' ? 10 : 6);
    y += ln.style === 'big' ? 200 : 90;
  }
  if (cardP > 0) {
    ctx.globalAlpha = smooth(cardP);
    ctx.textAlign = 'center';
    const f = fit(ctx, ec.card, SAFE.w, 96, 56, (z) => s.font(z), o);
    ctx.font = s.font(f.size); ctx.fillStyle = s.card;
    if (s.pixel) { ctx.fillStyle = '#000'; ctx.fillText(f.text, W / 2 + 8, H / 2 + 38); ctx.fillStyle = s.card; }
    text(ctx, f.text, W / 2, H / 2 + 30, o, 10);
    if (s.cursor) { const w = ctx.measureText(f.text).width; ctx.fillRect(W / 2 + w / 2 + 14, H / 2 - 40, 34, 76); }
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

export const THEMES = {
  terminal: { ...THEME_META.terminal, id: 'terminal', draw: drawTerminal },
  midnight: { ...THEME_META.midnight, id: 'midnight', draw: drawMidnight },
  beans: { ...THEME_META.beans, id: 'beans', draw: drawBeans },
};
