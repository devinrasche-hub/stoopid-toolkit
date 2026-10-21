// STOOPID CHESS — the page. Board, input, clocks, the booth, the coach, the verdict.
// Rules come from core/rules.js; THE HOUSE runs in a Web Worker built from core/engine.js.
import { Position, START_FEN, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  F_CAPTURE, F_EP, F_CASTLE, F_PROMO, mFrom, mTo, mFlags, mPromo, sqName, offBoard, replay } from '../core/rules.js';
import { openingLine, boothLine, moveLine, classify, moveAccuracy, verdict, reasonText, winPct } from '../core/commentary.js';
import { LEVELS, settingsFor } from '../core/levels.js';

const $ = s => document.querySelector(s);
const GAME_KEY = 'stoopid-chess-game', PREFS_KEY = 'stoopid-chess-prefs', RECORD_KEY = 'stoopid-chess-record';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: play on */ } },
};
const colorOf = t => (t === WHITE ? 'w' : 'b');
const other = c => (c === 'w' ? 'b' : 'w');
const VALUES = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };
const START_COUNT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 };
const CODE = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
const MATE = 30000;

/* ==================== engine clients ==================== */
const ENGINE_SRC = document.getElementById('engine-src').textContent;
class EngineClient {
  constructor() { this.id = 0; this.pending = new Map(); this.start(); }
  start() {
    this.url = this.url || URL.createObjectURL(new Blob([ENGINE_SRC], { type: 'text/javascript' }));
    this.w = new Worker(this.url);
    this.w.onmessage = e => { const r = this.pending.get(e.data.id); if (r) { this.pending.delete(e.data.id); r(e.data); } };
  }
  run(fen, moves, opts) {
    return new Promise(res => { const id = ++this.id; this.pending.set(id, res); this.w.postMessage({ id, fen, moves, opts }); });
  }
  reset() {
    this.w.terminate();
    for (const r of this.pending.values()) r({ cancelled: true });
    this.pending.clear();
    this.start();
  }
}
const house = new EngineClient();
const analyst = new EngineClient();

/* ==================== state ==================== */
const prefs = Object.assign({ dots: true, danger: false, coach: true, eval: false, sound: true, theme: 'stoopid' }, store.get(PREFS_KEY, {}));
const record = Object.assign({ levels: {}, strength: 35 }, store.get(RECORD_KEY, {}));
let G = null;          // the saved game
let pos = null;        // live position
let A = [];            // analysis per ply: { score (White's view, cp), best (uci), bestSan, mate }
let Q = [];            // grade per move: { quality, acc }
let viewPly = 0;
let orientation = 'w';
let sel = -1, legal = [];
let arrows = [], marks = new Set(), hintArrow = null;
let thinking = false, promoOpen = false, pendingHint = -1, lastCaptured = 0;
let turnStart = performance.now();
let verdictShown = false;

function levelInfo() {
  if (G.level === 'adaptive') {
    const s = G.strength;
    const near = LEVELS.reduce((a, l) => (Math.abs(l.strength - s) < Math.abs(a.strength - s) ? l : a));
    return { name: 'MATCH ME', strength: s, tag: `≈ ${near.name}` };
  }
  const l = LEVELS.find(x => x.id === G.level) || LEVELS[2];
  return { name: l.name, strength: l.strength, tag: l.name };
}
function nameOf(c) {
  if (G.mode === 'ai') return c === G.human ? 'YOU' : 'THE HOUSE';
  return G.names[c] || (c === 'w' ? 'WHITE' : 'BLACK');
}
const isHouse = c => G.mode === 'ai' && c !== G.human;
const humanTurn = () => G.mode === 'local' || colorOf(pos.turn) === G.human;
const atLive = () => viewPly === G.moves.length;
const canInteract = () => !G.result && atLive() && humanTurn() && !promoOpen && !thinking;
const uciList = (n = G.moves.length) => G.moves.slice(0, n).map(m => m.uci);
const plyColor = ply => (ply % 2 === 0) === (G.startFen.split(' ')[1] !== 'b') ? 'w' : 'b';

function newGame(cfg) {
  house.reset(); analyst.reset();
  const human = cfg.mode === 'ai' ? (cfg.side === 'random' ? (Math.random() < .5 ? 'w' : 'b') : cfg.side) : null;
  G = {
    v: 1, id: Date.now(), mode: cfg.mode, human, level: cfg.level, strength: cfg.level === 'adaptive' ? record.strength : null,
    names: cfg.names || { w: '', b: '' }, clock: cfg.clock || null, startFen: START_FEN, moves: [],
    times: cfg.clock ? { w: cfg.clock.base * 1000, b: cfg.clock.base * 1000 } : null,
    result: null, hints: 0, takebacks: 0, recorded: false,
  };
  pos = new Position(G.startFen);
  A = []; Q = []; viewPly = 0; sel = -1; arrows = []; marks.clear(); hintArrow = null; thinking = false;
  lastCaptured = 0; verdictShown = false;
  orientation = G.mode === 'ai' ? G.human : 'w';
  turnStart = performance.now();
  save();
  buildBoard();
  render();
  const intro = G.mode === 'ai'
    ? `You’re ${G.human === 'w' ? 'White' : 'Black'} against THE HOUSE (${levelInfo().name}). ${openingLine()}`
    : `${nameOf('w')} vs ${nameOf('b')}. ${openingLine()}`;
  say(intro);
  analyze(0);
  if (isHouse(colorOf(pos.turn))) houseMove();
}

function save() { store.set(GAME_KEY, G); }

function resume() {
  const saved = store.get(GAME_KEY, null);
  if (!saved || saved.v !== 1) return false;
  try {
    pos = replay(saved.startFen, saved.moves.map(m => m.uci));
  } catch { return false; }
  G = saved;
  A = []; Q = []; viewPly = G.moves.length; verdictShown = !!G.result;
  orientation = G.mode === 'ai' ? G.human : (G.moves.length % 2 ? 'b' : 'w');
  if (G.mode === 'local') orientation = 'w';
  turnStart = performance.now();
  buildBoard();
  render();
  say(G.result ? 'Last game’s over. Review it, or start a new one.' : 'Welcome back. The board waited for you.');
  for (let i = 0; i <= G.moves.length; i++) analyze(i);
  if (!G.result && isHouse(colorOf(pos.turn))) houseMove();
  return true;
}

/* ==================== board DOM ==================== */
const boardEl = $('#board');
let squareEls = {}, piecesEl, arrowsEl;

function screenOf(sq) {
  const f = sq & 7, r = sq >> 4;
  return orientation === 'w' ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
}
function sqOf(col, row) { return orientation === 'w' ? (7 - row) * 16 + col : row * 16 + (7 - col); }

function buildBoard() {
  boardEl.innerHTML = '';
  squareEls = {};
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const sq = sqOf(col, row);
    const d = document.createElement('div');
    d.className = 'sq' + ((((sq >> 4) + (sq & 7)) & 1) ? '' : ' d');
    d.dataset.sq = sq;
    d.setAttribute('role', 'gridcell');
    if (col === 0) d.insertAdjacentHTML('beforeend', `<span class="co rk">${(sq >> 4) + 1}</span>`);
    if (row === 7) d.insertAdjacentHTML('beforeend', `<span class="co fl">${'abcdefgh'[sq & 7]}</span>`);
    boardEl.appendChild(d);
    squareEls[sq] = d;
  }
  piecesEl = document.createElement('div');
  piecesEl.className = 'pieces';
  boardEl.appendChild(piecesEl);
  arrowsEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  arrowsEl.setAttribute('viewBox', '0 0 8 8');
  arrowsEl.setAttribute('class', 'arrows');
  boardEl.appendChild(arrowsEl);
  $('#evalbar').classList.toggle('flipped', orientation === 'b');
}

function shownPos() { return atLive() ? pos : replay(G.startFen, uciList(viewPly)); }

function render(anim) {
  const p = shownPos();
  renderPieces(p, anim);
  renderMarks(p);
  renderArrows();
  renderPlayers(p);
  renderMoves();
  renderEval();
  renderButtons();
}

function placeEl(el, sq) {
  const { col, row } = screenOf(sq);
  el.style.transform = `translate(${col * 100}%, ${row * 100}%)`;
}

function renderPieces(p, anim) {
  piecesEl.innerHTML = '';
  const moving = {};
  if (anim) {
    moving[mTo(anim)] = mFrom(anim);
    if (mFlags(anim) & F_CASTLE) {
      const from = mFrom(anim), to = mTo(anim);
      moving[to > from ? from + 1 : from - 1] = to > from ? from + 3 : from - 4;
    }
  }
  const animated = [];
  for (let sq = 0; sq < 128; sq++) {
    if (offBoard(sq)) { sq += 7; continue; }
    const code = p.pieceAt(sq);
    if (!code) continue;
    const el = document.createElement('div');
    el.className = 'piece ' + code;
    el.dataset.sq = sq;
    if (moving[sq] !== undefined && !reduceMotion) { placeEl(el, moving[sq]); animated.push([el, sq]); }
    else placeEl(el, sq);
    piecesEl.appendChild(el);
    const name = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' }[code[1]];
    squareEls[sq].setAttribute('aria-label', `${sqName(sq)} ${code[0] === 'w' ? 'white' : 'black'} ${name}`);
  }
  for (let sq = 0; sq < 128; sq++) {
    if (offBoard(sq)) { sq += 7; continue; }
    if (!p.board[sq]) squareEls[sq].setAttribute('aria-label', sqName(sq));
  }
  if (animated.length) {
    piecesEl.getBoundingClientRect();
    for (const [el, sq] of animated) { el.classList.add('anim'); placeEl(el, sq); }
  }
}

function renderMarks(p) {
  for (const k in squareEls) squareEls[k].classList.remove('last', 'selected', 'target', 'cap', 'check', 'danger', 'marked', 'hover');
  const last = viewPly > 0 ? G.moves[viewPly - 1] : null;
  if (last) {
    squareEls[sqIndex(last.uci.slice(0, 2))].classList.add('last');
    squareEls[sqIndex(last.uci.slice(2, 4))].classList.add('last');
  }
  if (p.inCheck()) squareEls[p.kings[p.turn >> 3]].classList.add('check');
  for (const m of marks) squareEls[m].classList.add('marked');
  if (sel >= 0 && atLive()) {
    squareEls[sel].classList.add('selected');
    if (prefs.dots) for (const m of legal) if (mFrom(m) === sel) {
      const to = mTo(m);
      squareEls[to].classList.add('target');
      if (mFlags(m) & F_CAPTURE) squareEls[to].classList.add('cap');
    }
  }
  if (prefs.danger && atLive() && !G.result) {
    const mine = G.mode === 'ai' ? (G.human === 'w' ? WHITE : BLACK) : p.turn;
    for (const sq of piecesInDanger(p, mine)) squareEls[sq].classList.add('danger');
  }
}
const sqIndex = name => (name.charCodeAt(0) - 97) + (name.charCodeAt(1) - 49) * 16;

// Own pieces the opponent can take for free, or take with something cheaper.
function piecesInDanger(p, color) {
  const them = color ^ 8, out = [];
  for (let sq = 0; sq < 128; sq++) {
    if (offBoard(sq)) { sq += 7; continue; }
    const pc = p.board[sq];
    if (!pc || (pc & 8) !== color || (pc & 7) === KING) continue;
    if (!p.isAttacked(sq, them)) continue;
    const defended = p.isAttacked(sq, color);
    const byPawn = (pc & 7) > PAWN && pawnHits(p, sq, them);
    if (!defended || byPawn) out.push(sq);
  }
  return out;
}
function pawnHits(p, sq, by) {
  const a = by === WHITE ? [sq - 15, sq - 17] : [sq + 15, sq + 17];
  return a.some(s => !offBoard(s) && p.board[s] === (PAWN | by));
}

function renderArrows() {
  let html = '<defs>' +
    '<marker id="ah-user" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--arrow)"/></marker>' +
    '<marker id="ah-hint" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--hint)"/></marker>' +
    '</defs>';
  const list = arrows.map(a => ({ ...a, kind: 'user' }));
  if (hintArrow && atLive()) list.push({ ...hintArrow, kind: 'hint' });
  if (!atLive() && viewPly > 0) {
    const q = Q[viewPly - 1], a = A[viewPly - 1];
    if (q && a && a.best && ['blunder', 'mistake', 'inaccuracy'].includes(q.quality)) {
      list.push({ from: sqIndex(a.best.slice(0, 2)), to: sqIndex(a.best.slice(2, 4)), kind: 'hint' });
    }
  }
  for (const a of list) {
    const s = screenOf(a.from), e = screenOf(a.to);
    const x1 = s.col + .5, y1 = s.row + .5, x2 = e.col + .5, y2 = e.row + .5;
    const color = a.kind === 'hint' ? 'var(--hint)' : 'var(--arrow)';
    const dx = Math.abs(e.col - s.col), dy = Math.abs(e.row - s.row);
    let d;
    if ((dx === 1 && dy === 2) || (dx === 2 && dy === 1)) {
      // Knight: an L, long leg first.
      const mx = dx === 2 ? x2 : x1, my = dx === 2 ? y1 : y2;
      d = `M${x1},${y1} L${mx},${my} L${shorten(mx, my, x2, y2)}`;
    } else d = `M${x1},${y1} L${shorten(x1, y1, x2, y2)}`;
    html += `<path d="${d}" stroke="${color}" stroke-width=".16" fill="none" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${a.kind})" opacity=".9"/>`;
  }
  arrowsEl.innerHTML = html;
}
function shorten(x1, y1, x2, y2) {
  const len = Math.hypot(x2 - x1, y2 - y1), k = Math.max(0, (len - .32) / len);
  return `${x1 + (x2 - x1) * k},${y1 + (y2 - y1) * k}`;
}

function renderPlayers(p) {
  const top = other(orientation), bottom = orientation;
  const counts = { w: {}, b: {} };
  for (let sq = 0; sq < 128; sq++) {
    if (offBoard(sq)) { sq += 7; continue; }
    const pc = p.board[sq];
    if (pc) { const c = colorOf(pc & 8); counts[c][pc & 7] = (counts[c][pc & 7] || 0) + 1; }
  }
  const material = c => Object.entries(counts[c]).reduce((s, [t, n]) => s + VALUES[t] * n, 0);
  const diff = material('w') - material('b');
  for (const [id, c] of [['#player-top', top], ['#player-bottom', bottom]]) {
    const el = $(id);
    el.className = 'player ' + (c === 'w' ? 'white' : 'black') + (colorOf(p.turn) === c && !G.result ? ' to-move' : '');
    el.querySelector('.name').textContent = nameOf(c);
    el.querySelector('.tag').textContent = isHouse(c) && levelInfo().tag !== 'THE HOUSE' ? levelInfo().tag : '';
    // Pieces this player has taken = the opponent's missing pieces.
    const opp = other(c);
    let caps = '';
    for (const t of [5, 4, 3, 2, 1]) {
      const missing = Math.max(0, START_COUNT[t] - (counts[opp][t] || 0));
      for (let i = 0; i < missing; i++) caps += `<i class="piece-icon ${opp}${CODE[t]}"></i>`;
    }
    const lead = c === 'w' ? diff : -diff;
    el.querySelector('.caps').innerHTML = caps + (lead > 0 ? `<b>+${lead}</b>` : '');
    const clock = el.querySelector('.clock');
    clock.hidden = !G.clock;
  }
  renderClocks();
}

function renderMoves() {
  const ol = $('#moves');
  if (!G.moves.length) { ol.innerHTML = '<li class="none"><span class="empty">NO MOVES YET. THE BOARD IS LISTENING.</span></li>'; }
  else {
    const blackFirst = G.startFen.split(' ')[1] === 'b';
    let html = '', i = 0, n = 1;
    const cell = idx => {
      const m = G.moves[idx], q = Q[idx];
      const mark = q ? { blunder: '??', mistake: '?', inaccuracy: '?!', best: '★' }[q.quality] || '' : '';
      return `<button class="mv${viewPly === idx + 1 ? ' cur' : ''}" data-ply="${idx + 1}">${m.san}${mark ? `<span class="mk ${q.quality}">${mark}</span>` : ''}</button>`;
    };
    if (blackFirst) { html += `<li><span class="n">${n}.</span><span></span>${cell(0)}</li>`; i = 1; n++; }
    for (; i < G.moves.length; i += 2, n++) {
      html += `<li><span class="n">${n}.</span>${cell(i)}${i + 1 < G.moves.length ? cell(i + 1) : '<span></span>'}</li>`;
    }
    if (G.result) html += `<li><span class="n"></span><span class="mv" style="cursor:default;color:var(--teal)">${G.result.result}</span><span></span></li>`;
    ol.innerHTML = html;
    // Scroll the list itself (never the page — on phones that would yank the board away).
    const cur = ol.querySelector('.cur');
    if (cur) {
      const top = cur.offsetTop, bottom = top + cur.offsetHeight; // .moves is the offsetParent
      if (top < ol.scrollTop) ol.scrollTop = top;
      else if (bottom > ol.scrollTop + ol.clientHeight) ol.scrollTop = bottom - ol.clientHeight;
    } else if (atLive()) ol.scrollTop = ol.scrollHeight;
  }
  $('#viewing').hidden = atLive();
}

function renderEval() {
  const bar = $('#evalbar');
  bar.hidden = !prefs.eval;
  if (!prefs.eval) return;
  const a = A[viewPly];
  if (!a) return;
  // The fill is White's share; .flipped anchors it to the top when White is at the top.
  bar.querySelector('.fill').style.height = winPct(a.score) + '%';
  bar.querySelector('.num').textContent = a.mate ? `M${Math.abs(a.mate)}` : (a.score / 100).toFixed(1);
}

function renderButtons() {
  const live = !G.result;
  $('#btn-undo').disabled = !G.moves.length || (G.mode === 'ai' && G.moves.length === 1 && isHouse(plyColor(0)));
  $('#btn-hint').disabled = !live || !humanTurn() || !atLive();
  $('#btn-draw').disabled = !live || G.moves.length < 2;
  $('#btn-resign').disabled = !live;
  const lv = G.mode === 'ai' ? levelInfo() : null;
  $('#subtitle').textContent = G.mode === 'ai' ? `VS THE HOUSE — ${lv.name}${G.level === 'adaptive' ? ` (${lv.strength})` : ''}` : 'PASS & PLAY';
  const rec = Object.entries(record.levels).map(([id, r]) => {
    const name = id === 'adaptive' ? 'MATCH ME' : (LEVELS.find(l => l.id === id) || {}).name;
    return name ? `${name} ${r.w}W ${r.l}L ${r.d}D` : '';
  }).filter(Boolean).join(' · ');
  $('#record-line').textContent = rec ? `YOUR RECORD VS THE HOUSE — ${rec}. MATCH ME strength: ${record.strength}.` : '';
}

/* ==================== the booth ==================== */
let boothQuality = null;
function say(text, quality) {
  const el = $('#booth-line');
  el.textContent = text;
  el.className = quality ? 'q-' + quality : '';
  void el.offsetWidth;
  el.classList.add('fresh');
  boothQuality = quality || null;
}

/* ==================== moving ==================== */
function refreshLegal() { legal = pos.legalMoves(); }

function select(sq) {
  sel = sq;
  if (sq >= 0) refreshLegal();
  render();
}

function tryUserMove(from, to, dragged) {
  const options = legal.filter(m => mFrom(m) === from && mTo(m) === to);
  if (!options.length) return false;
  if (options.length > 1) { askPromotion(from, to, options, dragged); return true; }
  commit(options[0], { dragged });
  return true;
}

function commit(m, opts = {}) {
  const now = performance.now();
  const mover = colorOf(pos.turn);
  const legalNow = pos.legalMoves();
  const san = pos.san(m, legalNow);
  const flags = mFlags(m);
  const capturedType = flags & F_EP ? PAWN : (pos.board[mTo(m)] & 7);
  const movedType = pos.board[mFrom(m)] & 7;
  const recapture = G.moves.length > 0 && capturedType && G.moves[G.moves.length - 1].uci.slice(2, 4) === sqName(mTo(m));

  if (G.clock) {
    if (G.moves.length >= 2) G.times[mover] -= now - turnStart;
    if (G.moves.length >= 1) G.times[mover] += G.clock.inc * 1000;
  }
  turnStart = now;

  pos.make(m);
  G.moves.push({ uci: pos.uci(m), san });
  viewPly = G.moves.length;
  sel = -1; hintArrow = null; arrows = []; marks.clear();
  const st = pos.status();
  render(opts.dragged ? null : m);
  sfx(st.over ? 'end' : san.includes('+') ? 'check' : flags & F_CASTLE ? 'castle' : capturedType ? 'capture' : 'move');

  const ev = {
    who: nameOf(mover), san, movedType, capturedType, check: san.includes('+'), mate: san.includes('#'),
    castle: !!(flags & F_CASTLE), promoType: flags & F_PROMO ? mPromo(m) : 0, ep: !!(flags & F_EP),
    isHouse: isHouse(mover), recapture, lastCapturedType: lastCaptured,
  };
  lastCaptured = capturedType;
  if (!st.over) say(moveLine(ev));
  save();
  analyze(G.moves.length);

  if (st.over) { endGame(st.result, st.reason); return; }
  if (isHouse(colorOf(pos.turn))) houseMove();
}

function askPromotion(from, to, options, dragged) {
  promoOpen = true;
  const color = colorOf(pos.turn);
  const { col, row } = screenOf(to);
  const box = document.createElement('div');
  box.className = 'promo';
  box.style.left = (col * 12.5) + '%';
  const downward = row === 0;
  box.style[downward ? 'top' : 'bottom'] = '0';
  const order = [QUEEN, KNIGHT, ROOK, BISHOP];
  const buttons = order.map(t => `<button type="button" data-t="${t}" class="piece-bg ${color}${CODE[t]}" aria-label="Promote to ${['', '', 'knight', 'bishop', 'rook', 'queen'][t]}"></button>`);
  box.innerHTML = (downward ? buttons : buttons.reverse()).join('') + '<button type="button" class="x" data-t="0">✕</button>';
  if (!downward) box.insertBefore(box.lastChild, box.firstChild);
  boardEl.appendChild(box);
  box.querySelector('[data-t="5"]').focus();
  box.addEventListener('pointerdown', e => e.stopPropagation());
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const t = +b.dataset.t;
    box.remove(); promoOpen = false;
    if (t) commit(options.find(m => mPromo(m) === t), { dragged });
    else { sel = -1; render(); }
  });
}

/* ==================== THE HOUSE ==================== */
async function houseMove() {
  const gameId = G.id, ply = G.moves.length;
  thinking = true;
  renderButtons();
  const lv = levelInfo();
  let opts = settingsFor(lv.strength);
  if (ply < 6 && lv.strength >= 60) opts = { depth: 4, noise: 22 }; // vary openings so THE HOUSE isn't a script
  if (G.clock && opts.timeMs) {
    const left = G.times[colorOf(pos.turn)];
    opts.timeMs = Math.max(80, Math.min(opts.timeMs, left / 30 + G.clock.inc * 800));
  }
  const slow = setTimeout(() => { if (thinking && G.id === gameId) say(boothLine('houseThinks')); }, 900);
  const started = performance.now();
  const r = await house.run(G.startFen, uciList(), opts);
  clearTimeout(slow);
  if (r.cancelled || G.id !== gameId || G.moves.length !== ply || G.result) return;
  const wait = 380 - (performance.now() - started);
  if (wait > 0) await new Promise(res => setTimeout(res, wait));
  if (G.id !== gameId || G.moves.length !== ply || G.result) return;
  thinking = false;
  const m = r.uci && pos.moveFromUci(r.uci);
  if (!m) { thinking = false; renderButtons(); return; }
  commit(m, {});
}

/* ==================== the coach ==================== */
function analyze(ply) {
  if (A[ply]) return;
  const gameId = G.id;
  const p = ply === G.moves.length ? pos : replay(G.startFen, uciList(ply));
  const st = p.status();
  if (st.over) {
    A[ply] = { score: st.reason === 'checkmate' ? (p.turn === WHITE ? -MATE : MATE) : 0, best: '', bestSan: '', mate: 0 };
    onAnalysis(ply);
    return;
  }
  const line = uciList(ply).join(' ');
  analyst.run(G.startFen, uciList(ply), { timeMs: 220, depth: 14 }).then(r => {
    // Drop results for a line that a takeback has since erased.
    if (r.cancelled || r.error || G.id !== gameId || ply > G.moves.length || uciList(ply).join(' ') !== line || A[ply]) return;
    const q = ply === G.moves.length ? pos : replay(G.startFen, uciList(ply));
    const bm = r.uci && q.moveFromUci(r.uci);
    A[ply] = { score: r.white ? r.score : -r.score, best: r.uci, bestSan: bm ? q.san(bm) : '', mate: r.white ? r.mate : -r.mate };
    onAnalysis(ply);
  });
}

function grade(i) {
  if (Q[i] || !A[i] || !A[i + 1] || !G.moves[i]) return false;
  const mover = plyColor(i), sign = mover === 'w' ? 1 : -1;
  const before = sign * A[i].score, after = sign * A[i + 1].score;
  const isBest = G.moves[i].uci === A[i].best && G.moves.length > 0;
  Q[i] = { quality: classify(before, after, isBest), acc: moveAccuracy(before, after), bestSan: A[i].bestSan };
  return true;
}

function onAnalysis(ply) {
  const graded = [];
  if (ply > 0 && grade(ply - 1)) graded.push(ply - 1);
  if (grade(ply)) graded.push(ply);
  for (const i of graded) {
    const q = Q[i];
    if (i === G.moves.length - 1 && atLive() && !G.result && prefs.coach && boothQuality === null) {
      const mover = plyColor(i), m = G.moves[i];
      const loud = ['blunder', 'mistake'].includes(q.quality) || (q.quality === 'best' && !isHouse(mover) && Math.random() < .35);
      if (loud && !(isHouse(mover) && q.quality !== 'blunder')) {
        say(moveLine({ who: nameOf(mover), san: m.san, quality: q.quality, bestSan: q.bestSan, isHouse: isHouse(mover) }), q.quality === 'best' ? 'best' : q.quality);
      }
    }
  }
  if (graded.length) renderMoves();
  if (ply === viewPly) renderEval();
  if (pendingHint === ply && A[ply]) showHint();
  if (G.result && !verdictShown) maybeVerdict();
}

/* ==================== clocks ==================== */
function timeLeft(c) {
  if (!G.clock) return 0;
  let t = G.times[c];
  if (!G.result && colorOf(pos.turn) === c && G.moves.length >= 2) t -= performance.now() - turnStart;
  return Math.max(0, t);
}
function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  if (ms < 10000) return (ms / 1000).toFixed(1);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function renderClocks() {
  if (!G || !G.clock) return;
  for (const [id, c] of [['#player-top', other(orientation)], ['#player-bottom', orientation]]) {
    const el = $(id + ' .clock'), t = timeLeft(c);
    el.textContent = fmt(t);
    const running = !G.result && colorOf(pos.turn) === c && G.moves.length >= 2;
    el.classList.toggle('running', running && t >= 20000);
    el.classList.toggle('low', t < 20000);
  }
}
setInterval(() => {
  if (!G || !G.clock || G.result) return;
  renderClocks();
  const c = colorOf(pos.turn);
  if (G.moves.length >= 2 && timeLeft(c) <= 0) {
    G.times[c] = 0;
    // Flagging only loses if the other side could still mate.
    if (canMate(pos, other(c) === 'w' ? WHITE : BLACK)) endGame(c === 'w' ? '0-1' : '1-0', 'timeout');
    else endGame('1/2-1/2', 'timeout-insufficient');
  }
}, 100);
function canMate(p, color) {
  let minors = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (offBoard(sq)) { sq += 7; continue; }
    const pc = p.board[sq];
    if (!pc || (pc & 8) !== color) continue;
    const t = pc & 7;
    if (t === PAWN || t === ROOK || t === QUEEN) return true;
    if (t === KNIGHT || t === BISHOP) minors++;
  }
  return minors >= 2;
}

/* ==================== game end ==================== */
function endGame(result, reason) {
  if (G.result) return;
  if (G.clock && G.moves.length >= 2 && reason !== 'timeout') {
    G.times[colorOf(pos.turn)] -= performance.now() - turnStart;
  }
  G.result = { result, reason };
  thinking = false; sel = -1;
  house.reset();
  save();
  recordResult();
  render();
  const winner = result === '1-0' ? 'w' : result === '0-1' ? 'b' : null;
  const head = winner ? `${nameOf(winner)} ${nameOf(winner) === 'YOU' ? 'WIN' : 'WINS'} ${reasonText(reason)}.` : `Draw ${reasonText(reason)}.`;
  say(`${head} The court is deliberating…`);
  sfx('end');
  // Wait for the coach to grade the last moves, then hand down the verdict.
  for (let i = 0; i <= G.moves.length; i++) analyze(i);
  setTimeout(() => maybeVerdict(true), 4500);
  maybeVerdict();
}

function recordResult() {
  if (G.mode !== 'ai' || G.recorded) return;
  G.recorded = true;
  const r = G.result.result;
  const outcome = r === '1/2-1/2' ? 'd' : ((r === '1-0') === (G.human === 'w') ? 'w' : 'l');
  const key = G.level;
  record.levels[key] = record.levels[key] || { w: 0, l: 0, d: 0 };
  record.levels[key][outcome]++;
  if (G.level === 'adaptive') {
    record.strength = Math.max(0, Math.min(100, record.strength + (outcome === 'w' ? 8 : outcome === 'l' ? -8 : 2)));
  }
  store.set(RECORD_KEY, record);
  save();
}

function statsFor(c) {
  let acc = 0, n = 0, blunders = 0, mistakes = 0, moves = 0;
  G.moves.forEach((m, i) => {
    if (plyColor(i) !== c) return;
    moves++;
    const q = Q[i];
    if (!q) return;
    acc += q.acc; n++;
    if (q.quality === 'blunder') blunders++;
    if (q.quality === 'mistake') mistakes++;
  });
  return { accuracy: n ? acc / n : null, blunders, mistakes, moves, hints: G.mode === 'ai' && c === G.human ? G.hints : 0 };
}

function maybeVerdict(force) {
  if (!G.result || verdictShown) return;
  const allGraded = G.moves.every((_, i) => Q[i]);
  if (!allGraded && !force) return;
  verdictShown = true;
  const { result, reason } = G.result;
  const winner = result === '1-0' ? 'w' : result === '0-1' ? 'b' : null;
  let subject, outcome;
  if (G.mode === 'ai') { subject = G.human; outcome = !winner ? 'draw' : winner === G.human ? 'win' : 'loss'; }
  else { subject = winner || 'w'; outcome = winner ? 'win' : 'draw'; }
  const st = statsFor(subject);
  if (G.mode === 'local' && !winner) {
    const o = statsFor('b');
    if (st.accuracy != null && o.accuracy != null) st.accuracy = (st.accuracy + o.accuracy) / 2;
    st.blunders += o.blunders;
  }
  const v = verdict(outcome, { ...st, reason });
  const resultText = winner ? `${nameOf(winner)} ${nameOf(winner) === 'YOU' ? 'WIN' : 'WINS'} ${reasonText(reason).toUpperCase()}` : `DRAW ${reasonText(reason).toUpperCase()}`;
  lastVerdict = { ...v, resultText, stats: st, subject, outcome };
  $('#v-word').textContent = v.verdict;
  $('#v-word').classList.toggle('stupid', v.verdict === 'STUPID');
  $('#v-result').textContent = resultText + (G.mode === 'ai' ? ` · ${levelInfo().name}` : '');
  $('#v-title').textContent = v.title;
  $('#v-ruling').textContent = v.ruling;
  const statCell = (b, s) => `<div><b>${b}</b><span>${s}</span></div>`;
  $('#v-stats').innerHTML = statCell(st.accuracy == null ? '—' : Math.round(st.accuracy) + '%', 'ACCURACY') +
    statCell(st.blunders, 'BLUNDERS') + statCell(st.mistakes, 'MISTAKES') + statCell(st.moves, 'MOVES');
  say(`${resultText}. The verdict: ${v.verdict} — ${v.title}.`);
  renderMoves();
  setTimeout(() => { if (!$('#dlg-new').open) $('#dlg-verdict').showModal(); }, 600);
}
let lastVerdict = null;

/* ==================== verdict card (PNG) ==================== */
const pieceImages = {};
function pieceImage(code) {
  if (!pieceImages[code]) { const img = new Image(); img.src = PIECE_URL[code]; pieceImages[code] = img; }
  return pieceImages[code];
}
async function downloadCard() {
  if (!lastVerdict) return;
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const codes = Object.keys(PIECE_URL);
  await Promise.all(codes.map(c => { const img = pieceImage(c); return img.complete ? 0 : new Promise(r => { img.onload = img.onerror = r; }); }));
  const css = getComputedStyle(document.body);
  const light = css.getPropertyValue('--sq-light').trim(), dark = css.getPropertyValue('--sq-dark').trim();
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  const teal = '#00FFC6', purple = '#8A2BE2', red = '#FF2D2D';
  const bracket = (cx, cy, dx, dy, col) => { x.strokeStyle = col; x.lineWidth = 5; x.beginPath(); x.moveTo(cx + dx * 60, cy); x.lineTo(cx, cy); x.lineTo(cx, cy + dy * 60); x.stroke(); };
  bracket(40, 40, 1, 1, teal); bracket(W - 40, H - 40, -1, -1, teal); bracket(W - 40, 40, -1, 1, purple); bracket(40, H - 40, 1, -1, purple);
  x.textAlign = 'center'; x.fillStyle = '#fff';
  x.font = 'bold 44px "Courier New", monospace';
  x.fillText('STOOPID CHESS', W / 2, 120);
  x.fillStyle = purple; x.font = '24px "Courier New", monospace';
  x.fillText('THE VERDICT', W / 2, 170);
  const word = lastVerdict.verdict;
  x.fillStyle = word === 'STUPID' ? red : teal;
  x.font = 'bold 150px "Courier New", monospace';
  x.shadowColor = x.fillStyle; x.shadowBlur = 30;
  x.fillText(word, W / 2, 320);
  x.shadowBlur = 0;
  x.fillStyle = '#bbb'; x.font = '26px "Courier New", monospace';
  x.fillText(lastVerdict.resultText, W / 2, 375);
  x.fillStyle = '#fff'; x.font = 'bold 34px "Courier New", monospace';
  x.fillText(lastVerdict.title, W / 2, 432);
  // Final position
  const bs = 520, bx = (W - bs) / 2, by = 470, s = bs / 8;
  const fin = pos;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = orientation === 'w' ? (7 - r) * 16 + f : r * 16 + (7 - f);
    x.fillStyle = (((sq >> 4) + (sq & 7)) & 1) ? light : dark;
    x.fillRect(bx + f * s, by + r * s, s - 1, s - 1);
    const code = fin.pieceAt(sq);
    if (code) x.drawImage(pieceImage(code), bx + f * s, by + r * s, s, s);
  }
  x.strokeStyle = teal; x.lineWidth = 2; x.strokeRect(bx - 6, by - 6, bs + 12, bs + 12);
  // Ruling, wrapped
  x.fillStyle = '#ddd'; x.font = '27px "Courier New", monospace';
  const words = lastVerdict.ruling.split(' ');
  let line = '', y = by + bs + 70;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (x.measureText(t).width > W - 200) { x.fillText(line, W / 2, y); y += 38; line = w; } else line = t;
  }
  if (line) x.fillText(line, W / 2, y);
  const st = lastVerdict.stats;
  x.fillStyle = teal; x.font = 'bold 30px "Courier New", monospace';
  x.fillText(`${st.accuracy == null ? '—' : Math.round(st.accuracy) + '%'} ACCURACY · ${st.blunders} BLUNDERS · ${st.moves} MOVES`, W / 2, H - 120);
  x.fillStyle = '#666'; x.font = '24px "Courier New", monospace';
  x.fillText('@stoopidshow · THE STOOPID SHOW', W / 2, H - 70);
  cv.toBlob(b => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `stoopid-chess-verdict-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

/* ==================== PGN ==================== */
function pgn() {
  const d = new Date(G.id);
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const tags = {
    Event: G.mode === 'ai' ? `STOOPID CHESS vs THE HOUSE (${levelInfo().name})` : 'STOOPID CHESS — pass & play',
    Site: 'THE STOOPID SHOW', Date: date, White: nameOf('w'), Black: nameOf('b'),
    Result: G.result ? G.result.result : '*',
  };
  if (G.clock) tags.TimeControl = `${G.clock.base}+${G.clock.inc}`;
  if (G.result) tags.Termination = reasonText(G.result.reason) || 'normal';
  let out = Object.entries(tags).map(([k, v]) => `[${k} "${String(v).replace(/"/g, "'")}"]`).join('\n') + '\n\n';
  let line = '';
  G.moves.forEach((m, i) => {
    const tok = (i % 2 === 0 ? `${i / 2 + 1}. ` : '') + m.san + ' ';
    if ((line + tok).length > 80) { out += line.trimEnd() + '\n'; line = ''; }
    line += tok;
  });
  return out + line + (G.result ? G.result.result : '*') + '\n';
}

/* ==================== sound ==================== */
let AC = null;
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function audio() {
  if (!prefs.sound) return null;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
  } catch { return null; }
  return AC;
}
function knock(ac, t, freq, dur, gain) {
  const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = 'triangle'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * .55, t + dur);
  f.type = 'lowpass'; f.frequency.value = freq * 3;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + .02);
}
function hiss(ac, t, dur, gain) {
  const n = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1800; s.buffer = n; g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t);
}
function sfx(kind) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + .01;
  if (kind === 'move') knock(ac, t, 420, .09, .5);
  else if (kind === 'capture') { knock(ac, t, 300, .12, .6); hiss(ac, t, .07, .35); }
  else if (kind === 'castle') { knock(ac, t, 420, .08, .45); knock(ac, t + .09, 380, .09, .45); }
  else if (kind === 'check') { knock(ac, t, 420, .08, .45); knock(ac, t + .02, 880, .18, .18); }
  else if (kind === 'end') [523, 659, 784].forEach((fq, i) => knock(ac, t + i * .11, fq, .5, .22));
}

/* ==================== input: pointer ==================== */
let drag = null, rightFrom = -1;
function squareAt(e) {
  const r = boardEl.getBoundingClientRect();
  const col = Math.floor((e.clientX - r.left) / (r.width / 8)), row = Math.floor((e.clientY - r.top) / (r.height / 8));
  if (col < 0 || col > 7 || row < 0 || row > 7) return -1;
  return sqOf(col, row);
}
boardEl.addEventListener('contextmenu', e => e.preventDefault());
boardEl.addEventListener('pointerdown', e => {
  if (promoOpen) return;
  const sq = squareAt(e);
  if (sq < 0) return;
  if (e.button === 2) { rightFrom = sq; return; }
  if (e.button !== 0) return;
  audio(); // unlock sound on iOS with the first touch
  if (arrows.length || marks.size) { arrows = []; marks.clear(); renderArrows(); renderMarks(shownPos()); }
  if (!canInteract()) {
    if (!atLive() && !G.result) toast('YOU’RE LOOKING AT AN EARLIER MOVE — TAP BACK TO LIVE');
    return;
  }
  if (sel >= 0 && sq !== sel && legal.some(m => mFrom(m) === sel && mTo(m) === sq)) { tryUserMove(sel, sq, false); return; }
  const pc = pos.board[sq];
  if (pc && (pc & 8) === pos.turn) {
    const wasSelected = sel === sq;
    if (!wasSelected) select(sq);
    const el = piecesEl.querySelector(`.piece[data-sq="${sq}"]`);
    drag = { from: sq, el, x0: e.clientX, y0: e.clientY, moved: false, wasSelected, id: e.pointerId };
    boardEl.setPointerCapture(e.pointerId);
  } else if (sel >= 0) select(-1);
});
boardEl.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 4) return;
  drag.moved = true;
  const r = boardEl.getBoundingClientRect(), s = r.width / 8;
  drag.el.classList.add('dragging');
  drag.el.style.transform = `translate(${e.clientX - r.left - s / 2}px, ${e.clientY - r.top - s / 2}px)`;
  const over = squareAt(e);
  if (over !== drag.over) {
    if (drag.over >= 0 && squareEls[drag.over]) squareEls[drag.over].classList.remove('hover');
    drag.over = over;
    if (over >= 0) squareEls[over].classList.add('hover');
  }
});
function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;
  if (d.over >= 0 && squareEls[d.over]) squareEls[d.over].classList.remove('hover');
  if (!d.moved) {
    if (d.wasSelected) select(-1);
    return;
  }
  const to = cancelled ? -1 : squareAt(e);
  if (to >= 0 && to !== d.from && tryUserMove(d.from, to, true)) return;
  d.el.classList.remove('dragging');
  placeEl(d.el, d.from);
}
boardEl.addEventListener('pointerup', e => {
  if (e.button === 2 && rightFrom >= 0) {
    const to = squareAt(e);
    if (to === rightFrom) { marks.has(to) ? marks.delete(to) : marks.add(to); renderMarks(shownPos()); }
    else if (to >= 0) {
      const i = arrows.findIndex(a => a.from === rightFrom && a.to === to);
      if (i >= 0) arrows.splice(i, 1); else arrows.push({ from: rightFrom, to });
      renderArrows();
    }
    rightFrom = -1;
    return;
  }
  endDrag(e, false);
});
boardEl.addEventListener('pointercancel', e => endDrag(e, true));

/* ==================== input: buttons, keys ==================== */
function goTo(ply) {
  viewPly = Math.max(0, Math.min(G.moves.length, ply));
  sel = -1;
  if (!atLive() && viewPly > 0) {
    const q = Q[viewPly - 1], m = G.moves[viewPly - 1];
    const moveNo = Math.floor((viewPly - 1) / 2) + 1, dots = plyColor(viewPly - 1) === 'w' ? '.' : '…';
    if (q && ['blunder', 'mistake', 'inaccuracy'].includes(q.quality)) say(`${moveNo}${dots} ${m.san} — ${q.quality}. ${q.bestSan} was better (the teal arrow).`, q.quality === 'blunder' ? 'blunder' : null);
    else if (q && q.quality === 'best') say(`${moveNo}${dots} ${m.san} — best move.`, 'best');
    else say(`${moveNo}${dots} ${m.san}.`);
  }
  render();
}
$('#moves').addEventListener('click', e => { const b = e.target.closest('[data-ply]'); if (b) goTo(+b.dataset.ply); });
$('#nav-first').onclick = () => goTo(0);
$('#nav-prev').onclick = () => goTo(viewPly - 1);
$('#nav-next').onclick = () => goTo(viewPly + 1);
$('#nav-last').onclick = () => goTo(G.moves.length);
$('#nav-live').onclick = () => goTo(G.moves.length);
$('#btn-flip').onclick = () => { orientation = other(orientation); buildBoard(); render(); };

$('#btn-undo').onclick = () => {
  if (!G.moves.length) return;
  house.reset();
  const wasThinking = thinking;
  thinking = false;
  let n = 1;
  if (G.mode === 'ai' && !wasThinking && !G.result && G.moves.length >= 2 && isHouse(plyColor(G.moves.length - 1))) n = 2;
  if (G.mode === 'ai' && G.result && isHouse(plyColor(G.moves.length - 1)) && G.moves.length >= 2) n = 2;
  G.moves.splice(G.moves.length - n, n);
  A.length = Math.min(A.length, G.moves.length + 1);
  Q.length = Math.min(Q.length, G.moves.length);
  if (G.result) { G.result = null; verdictShown = false; }
  G.takebacks++;
  pos = replay(G.startFen, uciList());
  viewPly = G.moves.length; sel = -1; hintArrow = null; lastCaptured = 0;
  turnStart = performance.now();
  save();
  render();
  say(boothLine('takeback'));
  analyze(G.moves.length);
  if (isHouse(colorOf(pos.turn))) houseMove();
};

function showHint() {
  pendingHint = -1;
  const a = A[G.moves.length];
  if (!a || !a.best || !atLive() || G.result) return;
  hintArrow = { from: sqIndex(a.best.slice(0, 2)), to: sqIndex(a.best.slice(2, 4)) };
  G.hints++;
  save();
  say(boothLine('hint', { best: a.bestSan }), 'best');
  renderArrows();
}
$('#btn-hint').onclick = () => {
  if (!canInteract()) return;
  if (A[G.moves.length]) showHint();
  else { pendingHint = G.moves.length; say('Thinking about it… (one second)'); analyze(G.moves.length); }
};

function confirmDlg(title, text, yes = 'YES', no = 'NO') {
  return new Promise(res => {
    const d = $('#dlg-confirm');
    $('#confirm-title').textContent = title; $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = yes; $('#confirm-no').textContent = no;
    d.returnValue = '';
    d.onclose = () => res(d.returnValue === 'yes');
    d.showModal();
  });
}
$('#btn-resign').onclick = async () => {
  if (G.result) return;
  const c = G.mode === 'ai' ? G.human : colorOf(pos.turn);
  const ok = await confirmDlg('RESIGN?', G.mode === 'ai' ? 'Tip your king to THE HOUSE? (No shame. Rematch is one tap away.)' : `${nameOf(c)}, tip your king?`, 'RESIGN', 'KEEP PLAYING');
  if (ok && !G.result) endGame(c === 'w' ? '0-1' : '1-0', 'resign');
};
$('#btn-draw').onclick = async () => {
  if (G.result) return;
  if (G.mode === 'local') {
    const offerer = colorOf(pos.turn), taker = other(offerer);
    const ok = await confirmDlg('DRAW OFFERED', `${nameOf(offerer)} offers a draw. ${nameOf(taker)} — accept?`, 'ACCEPT', 'DECLINE');
    if (ok && !G.result) endGame('1/2-1/2', 'agreement');
    else say(`${nameOf(taker)} declines. The game goes on.`);
    return;
  }
  // THE HOUSE takes a draw when it's worse off, or when a long game has gone dead level.
  const a = A[G.moves.length];
  const houseView = a ? (G.human === 'w' ? -a.score : a.score) : 0;
  if (a && (houseView <= -150 || (G.moves.length >= 60 && Math.abs(houseView) <= 25))) { say('THE HOUSE accepts. A handshake across the board.'); endGame('1/2-1/2', 'agreement'); }
  else say(pickOne(['THE HOUSE declines. (It likes its chances.)', 'Draw declined. THE HOUSE wants to see how this ends.']));
};
const pickOne = l => l[Math.floor(Math.random() * l.length)];

$('#typemove').addEventListener('submit', e => {
  e.preventDefault();
  const inp = $('#typed'), txt = inp.value.trim();
  if (!txt) return;
  if (!canInteract()) { toast(G.result ? 'THE GAME IS OVER' : 'NOT YOUR MOVE'); return; }
  const m = pos.moveFromSan(txt);
  if (!m) { toast(`“${txt}” ISN’T A LEGAL MOVE HERE`); return; }
  inp.value = '';
  refreshLegal();
  commit(m, {});
});

$('#btn-pgn-copy').onclick = async () => {
  try { await navigator.clipboard.writeText(pgn()); toast('PGN COPIED'); } catch { toast('COPY BLOCKED — USE SAVE PGN'); }
};
$('#btn-pgn-save').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([pgn()], { type: 'application/x-chess-pgn' }));
  a.download = `stoopid-chess-${new Date(G.id).toISOString().slice(0, 10)}.pgn`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

document.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowLeft') { goTo(viewPly - 1); e.preventDefault(); }
  else if (e.key === 'ArrowRight') { goTo(viewPly + 1); e.preventDefault(); }
  else if (e.key === 'Home') goTo(0);
  else if (e.key === 'End') goTo(G.moves.length);
  else if (e.key === 'f' || e.key === 'F') $('#btn-flip').click();
  else if (e.key === 'u' || e.key === 'U') { if (!$('#btn-undo').disabled) $('#btn-undo').click(); }
  else if (e.key === 'h' || e.key === 'H') { if (!$('#btn-hint').disabled) $('#btn-hint').click(); }
});

let toastTimer;
function toast(t) {
  const el = $('#toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ==================== training wheels ==================== */
function applyPrefs() {
  document.body.dataset.theme = prefs.theme;
  $('#opt-dots').checked = prefs.dots; $('#opt-danger').checked = prefs.danger; $('#opt-coach').checked = prefs.coach;
  $('#opt-eval').checked = prefs.eval; $('#opt-sound').checked = prefs.sound; $('#opt-theme').value = prefs.theme;
}
for (const [id, key] of [['#opt-dots', 'dots'], ['#opt-danger', 'danger'], ['#opt-coach', 'coach'], ['#opt-eval', 'eval'], ['#opt-sound', 'sound']]) {
  $(id).addEventListener('change', e => { prefs[key] = e.target.checked; store.set(PREFS_KEY, prefs); if (G) render(); });
}
$('#opt-theme').addEventListener('change', e => { prefs.theme = e.target.value; store.set(PREFS_KEY, prefs); applyPrefs(); });

/* ==================== new game dialog ==================== */
const pickState = { mode: 'ai', side: 'w', clock: 'none', level: 'regular' };
function renderLevels() {
  const opts = [...LEVELS.map(l => ({ id: l.id, name: l.name, blurb: l.blurb, rec: record.levels[l.id] })),
    { id: 'adaptive', name: 'MATCH ME', blurb: `Learns your level as you play — now at ${record.strength}/100. Win and it climbs.`, rec: record.levels.adaptive }];
  $('#levels').innerHTML = opts.map(o => `<button type="button" class="lvl${pickState.level === o.id ? ' on' : ''}" data-id="${o.id}"><b>${o.name}</b><span>${o.blurb}</span><em>${o.rec ? `${o.rec.w}-${o.rec.l}-${o.rec.d}` : ''}</em></button>`).join('');
}
$('#levels').addEventListener('click', e => { const b = e.target.closest('.lvl'); if (b) { pickState.level = b.dataset.id; renderLevels(); } });
document.querySelectorAll('#dlg-new .seg').forEach(seg => {
  seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    pickState[seg.dataset.name] = b.dataset.v;
    if (seg.dataset.name === 'mode') {
      document.querySelectorAll('.for-ai').forEach(x => (x.hidden = b.dataset.v !== 'ai'));
      document.querySelectorAll('.for-local').forEach(x => (x.hidden = b.dataset.v !== 'local'));
    }
  });
});
function openNewGame() {
  if (G) {
    pickState.mode = G.mode; pickState.level = G.level || pickState.level;
    if (G.mode === 'ai') pickState.side = pickState.side || 'w';
  }
  document.querySelectorAll('#dlg-new .seg').forEach(seg => {
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.v === pickState[seg.dataset.name]));
  });
  document.querySelectorAll('.for-ai').forEach(x => (x.hidden = pickState.mode !== 'ai'));
  document.querySelectorAll('.for-local').forEach(x => (x.hidden = pickState.mode !== 'local'));
  if (G && G.mode === 'local') { $('#name-w').value = G.names.w || ''; $('#name-b').value = G.names.b || ''; }
  renderLevels();
  $('#dlg-new').showModal();
}
$('#btn-new').onclick = async () => {
  if (G && !G.result && G.moves.length >= 2) {
    const ok = await confirmDlg('START OVER?', 'This game isn’t finished. Starting a new one ends it (it won’t count as a loss).', 'NEW GAME', 'KEEP PLAYING');
    if (!ok) return;
  }
  openNewGame();
};
$('#new-cancel').onclick = () => $('#dlg-new').close();
$('#newgame-form').addEventListener('submit', () => {
  const clock = pickState.clock === 'none' ? null : { base: +pickState.clock.split('+')[0], inc: +pickState.clock.split('+')[1] };
  newGame({
    mode: pickState.mode, side: pickState.side, level: pickState.mode === 'ai' ? pickState.level : null, clock,
    names: { w: $('#name-w').value.trim().toUpperCase(), b: $('#name-b').value.trim().toUpperCase() },
  });
});

$('#v-review').onclick = () => { $('#dlg-verdict').close(); if (document.activeElement) document.activeElement.blur(); goTo(0); toast('◀ ▶ TO REPLAY · ?? BLUNDER · ? MISTAKE · ★ BEST'); };
$('#v-card').onclick = () => downloadCard();
$('#v-rematch').onclick = () => {
  $('#dlg-verdict').close();
  const side = G.mode === 'ai' ? other(G.human) : null;
  const names = G.mode === 'local' ? { w: G.names.b, b: G.names.w } : G.names;
  newGame({ mode: G.mode, side, level: G.level, clock: G.clock, names });
};

/* ==================== boot ==================== */
applyPrefs();
if (!resume()) newGame({ mode: 'ai', side: 'w', level: 'regular', clock: null });
