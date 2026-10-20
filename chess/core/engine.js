// STOOPID CHESS — THE HOUSE. A classic alpha-beta engine: iterative deepening, transposition table,
// quiescence, null-move pruning, late-move reductions. Strength is tuned down with depth limits and
// noise at the root, so the weaker levels make human-looking mistakes instead of random ones.

import { Position, WHITE, BLACK, PAWN, KNIGHT, BISHOP, ROOK, QUEEN, KING,
  F_CAPTURE, F_PROMO, mFrom, mTo, mFlags, mPromo, offBoard } from './rules.js';

export const MATE = 30000;
const INF = 32000, MAX_PLY = 64;
const VALUE = [0, 100, 320, 330, 500, 900, 0];
const PHASE = [0, 0, 1, 1, 2, 4, 0];

// Piece-square tables (Tomasz Michniewski's "simplified evaluation"), a8 first, from White's side.
const PST = [null,
  [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
   0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
   -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
   -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
   -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
   0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
];
const KING_END = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30,
  -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];
const PASSED = [0, 5, 10, 20, 35, 60, 100, 0]; // by ranks advanced

const pstIndex = (sq, color) => color === WHITE ? (7 - (sq >> 4)) * 8 + (sq & 7) : (sq >> 4) * 8 + (sq & 7);

// Static evaluation in centipawns from the side to move's point of view.
export function evaluate(pos) {
  const b = pos.board;
  let mg = 0, eg = 0, phase = 0;
  const bishops = [0, 0];
  const pawnFiles = [new Int8Array(8), new Int8Array(8)];
  const pawnMost = [new Int8Array(8).fill(-1), new Int8Array(8).fill(8)]; // white: most advanced rank; black: lowest
  for (let sq = 0; sq < 128; sq++) {
    if (offBoard(sq)) { sq += 7; continue; }
    const p = b[sq];
    if (!p) continue;
    const t = p & 7, c = p & 8, sign = c === WHITE ? 1 : -1, ci = c >> 3;
    const idx = pstIndex(sq, c);
    if (t === KING) {
      mg += sign * PST[KING][idx]; eg += sign * KING_END[idx];
      continue;
    }
    const v = VALUE[t] + PST[t][idx];
    mg += sign * v; eg += sign * v;
    phase += PHASE[t];
    if (t === BISHOP) bishops[ci]++;
    else if (t === PAWN) {
      const f = sq & 7, r = sq >> 4;
      pawnFiles[ci][f]++;
      if (ci === 0) { if (r > pawnMost[0][f]) pawnMost[0][f] = r; }
      else if (r < pawnMost[1][f]) pawnMost[1][f] = r;
    }
  }
  let struct = 0;
  for (let ci = 0; ci < 2; ci++) {
    const sign = ci === 0 ? 1 : -1, own = pawnFiles[ci];
    if (bishops[ci] >= 2) struct += sign * 30;
    for (let f = 0; f < 8; f++) {
      if (!own[f]) continue;
      if (own[f] > 1) struct -= sign * 12 * (own[f] - 1);
      if ((f === 0 || !own[f - 1]) && (f === 7 || !own[f + 1])) struct -= sign * 12 * own[f];
    }
  }
  // Passed pawns: no enemy pawn ahead on the same or neighbouring files. Worth more as the board empties.
  let passed = 0;
  for (let f = 0; f < 8; f++) {
    const wr = pawnMost[0][f];
    if (wr >= 0) {
      let free = true;
      for (let g = Math.max(0, f - 1); g <= Math.min(7, f + 1); g++) if (pawnMost[1][g] < 8 && pawnMostAnyAbove(b, g, wr, BLACK)) free = false;
      if (free) passed += PASSED[wr];
    }
    const br = pawnMost[1][f];
    if (br < 8) {
      let free = true;
      for (let g = Math.max(0, f - 1); g <= Math.min(7, f + 1); g++) if (pawnMost[0][g] >= 0 && pawnMostAnyBelow(b, g, br, WHITE)) free = false;
      if (free) passed -= PASSED[7 - br];
    }
  }
  if (phase > 24) phase = 24;
  const score = ((mg * phase + eg * (24 - phase)) / 24 | 0) + struct + ((passed * (40 - phase)) / 40 | 0);
  return (pos.turn === WHITE ? score : -score) | 0;
}
function pawnMostAnyAbove(b, f, r, color) {
  for (let rr = r + 1; rr < 7; rr++) if (b[rr * 16 + f] === (PAWN | color)) return true;
  return false;
}
function pawnMostAnyBelow(b, f, r, color) {
  for (let rr = r - 1; rr > 0; rr--) if (b[rr * 16 + f] === (PAWN | color)) return true;
  return false;
}

const TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
const EXACT = 1, LOWER = 2, UPPER = 3;

export class Engine {
  constructor() {
    this.ttKey = new Int32Array(TT_SIZE);
    this.ttMove = new Int32Array(TT_SIZE);
    this.ttScore = new Int16Array(TT_SIZE);
    this.ttDepth = new Int8Array(TT_SIZE);
    this.ttFlag = new Int8Array(TT_SIZE);
    this.moves = new Int32Array(MAX_PLY * 256);
    this.scores = new Int32Array(MAX_PLY * 256);
    this.killers = new Int32Array(MAX_PLY * 2);
    this.history = new Int32Array(16 * 128);
  }

  clear() {
    this.ttKey.fill(0); this.ttMove.fill(0); this.ttDepth.fill(0); this.ttFlag.fill(0);
    this.history.fill(0);
  }

  // opts: { depth, timeMs, noise (cp of root jitter), rng }
  // Returns { move, uci, score, depth, nodes, mate } — score from the side to move's view.
  search(pos, opts = {}) {
    const maxDepth = Math.min(opts.depth || 32, MAX_PLY - 8);
    const timeMs = opts.timeMs || 0;
    const noise = opts.noise || 0;
    const rng = opts.rng || Math.random;
    this.pos = pos;
    this.nodes = 0;
    this.stopped = false;
    this.deadline = timeMs ? Date.now() + timeMs : Infinity;
    this.killers.fill(0);
    for (let i = 0; i < this.history.length; i++) this.history[i] >>= 2;

    const root = pos.legalMoves();
    if (!root.length) return { move: 0, uci: '', score: pos.inCheck() ? -MATE : 0, depth: 0, nodes: 0, mate: 0 };
    if (root.length === 1 && !noise) return this.result(root[0], this.quickScore(pos, root[0]), 1);

    if (noise) return this.searchNoisy(pos, root, maxDepth, noise, rng);

    let best = root[0], bestScore = -INF, done = 0;
    for (let depth = 1; depth <= maxDepth; depth++) {
      const score = this.negamax(depth, -INF, INF, 0, true);
      if (this.stopped) break;
      best = this.probeMove(pos) || best;
      bestScore = score; done = depth;
      if (Math.abs(score) > MATE - MAX_PLY) break; // found a forced mate; deeper won't change it
      if (timeMs && Date.now() > this.deadline - timeMs * 0.55) break; // next iteration won't finish
    }
    if (!done) bestScore = this.quickScore(pos, best);
    return this.result(best, bestScore, done);
  }

  // Score every root move at a fixed shallow depth, add noise, take the best. Human-shaped weakness.
  searchNoisy(pos, root, depth, noise, rng) {
    let best = root[0], bestNoisy = -INF, bestScore = 0;
    for (const m of root) {
      pos.make(m);
      const s = -this.negamax(depth - 1, -INF, INF, 1, true);
      pos.unmake();
      const jitter = gauss(rng) * noise;
      if (s + jitter > bestNoisy) { bestNoisy = s + jitter; best = m; bestScore = s; }
    }
    return this.result(best, bestScore, depth);
  }

  quickScore(pos, m) {
    pos.make(m);
    const s = -this.quiesce(-INF, INF, 1);
    pos.unmake();
    return s;
  }

  result(move, score, depth) {
    const mate = Math.abs(score) > MATE - MAX_PLY ? Math.sign(score) * Math.ceil((MATE - Math.abs(score)) / 2) : 0;
    return { move, uci: this.pos.uci(move), score, depth, nodes: this.nodes, mate };
  }

  probeMove(pos) {
    const i = pos.hashLo & TT_MASK;
    return this.ttKey[i] === pos.hashHi ? this.ttMove[i] : 0;
  }

  checkTime() {
    if ((++this.nodes & 2047) === 0 && Date.now() > this.deadline) this.stopped = true;
  }

  negamax(depth, alpha, beta, ply, allowNull) {
    const pos = this.pos;
    this.checkTime();
    if (this.stopped) return 0;
    if (ply > 0) {
      if (pos.halfmove >= 100 || pos.repetitions() > 0 || pos.insufficientMaterial()) return 0;
      // Mate-distance pruning
      alpha = Math.max(alpha, -MATE + ply); beta = Math.min(beta, MATE - ply - 1);
      if (alpha >= beta) return alpha;
    }
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, ply);
    if (ply >= MAX_PLY - 1) return evaluate(pos);

    const ti = pos.hashLo & TT_MASK;
    let ttMove = 0;
    if (this.ttKey[ti] === pos.hashHi) {
      ttMove = this.ttMove[ti];
      if (ply > 0 && this.ttDepth[ti] >= depth) {
        let s = this.ttScore[ti];
        if (s > MATE - MAX_PLY) s -= ply; else if (s < -MATE + MAX_PLY) s += ply;
        const f = this.ttFlag[ti];
        if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
      }
    }

    if (allowNull && !inCheck && ply > 0 && depth >= 3 && beta < MATE - MAX_PLY && hasPieces(pos)) {
      pos.makeNull();
      const s = -this.negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.unmakeNull();
      if (this.stopped) return 0;
      if (s >= beta) return beta;
    }

    const base = ply * 256;
    const n = pos.gen(this.moves, base, false);
    this.scoreMoves(base, n, ttMove, ply);

    const alpha0 = alpha;
    let best = -INF, bestMove = 0, legal = 0;
    for (let i = base; i < n; i++) {
      const m = this.pickNext(i, n);
      if (!pos.tryMake(m)) continue;
      legal++;
      const quiet = !(mFlags(m) & (F_CAPTURE | F_PROMO));
      let s;
      if (legal > 1 && depth >= 3 && quiet && !inCheck && legal > 4 && !pos.inCheck()) {
        s = -this.negamax(depth - 2, -alpha - 1, -alpha, ply + 1, true);
        if (s > alpha) s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        s = -this.negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (s > best) {
        best = s; bestMove = m;
        if (s > alpha) {
          alpha = s;
          if (s >= beta) {
            if (quiet) {
              const k = ply * 2;
              if (this.killers[k] !== m) { this.killers[k + 1] = this.killers[k]; this.killers[k] = m; }
              this.history[pos.board[mFrom(m)] * 128 + mTo(m)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;

    let stored = best;
    if (stored > MATE - MAX_PLY) stored += ply; else if (stored < -MATE + MAX_PLY) stored -= ply;
    this.ttKey[ti] = pos.hashHi; this.ttMove[ti] = bestMove; this.ttScore[ti] = stored;
    this.ttDepth[ti] = depth;
    this.ttFlag[ti] = best >= beta ? LOWER : best > alpha0 ? EXACT : UPPER;
    return best;
  }

  quiesce(alpha, beta, ply) {
    const pos = this.pos;
    this.checkTime();
    if (this.stopped) return 0;
    const stand = evaluate(pos);
    if (ply >= MAX_PLY - 1) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const base = ply * 256;
    const n = pos.gen(this.moves, base, true);
    this.scoreMoves(base, n, 0, ply);
    for (let i = base; i < n; i++) {
      const m = this.pickNext(i, n);
      if (!(mFlags(m) & F_PROMO) && stand + VALUE[pos.board[mTo(m)] & 7] + 200 < alpha) continue; // delta pruning
      if (!pos.tryMake(m)) continue;
      const s = -this.quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (this.stopped) return 0;
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }

  scoreMoves(base, n, ttMove, ply) {
    const b = this.pos.board, k0 = this.killers[ply * 2], k1 = this.killers[ply * 2 + 1];
    for (let i = base; i < n; i++) {
      const m = this.moves[i];
      let s;
      if (m === ttMove) s = 10000000;
      else if (mFlags(m) & (F_CAPTURE | F_PROMO)) {
        const victim = (mFlags(m) & F_CAPTURE) ? (b[mTo(m)] & 7) || PAWN : 0;
        s = 1000000 + VALUE[victim] * 10 - VALUE[b[mFrom(m)] & 7] / 10 + (mPromo(m) === QUEEN ? 8000 : 0);
      } else if (m === k0) s = 900000;
      else if (m === k1) s = 800000;
      else s = Math.min(this.history[b[mFrom(m)] * 128 + mTo(m)], 700000);
      this.scores[i] = s;
    }
  }

  pickNext(i, n) {
    let bi = i, bs = this.scores[i];
    for (let j = i + 1; j < n; j++) if (this.scores[j] > bs) { bs = this.scores[j]; bi = j; }
    if (bi !== i) {
      const tm = this.moves[i]; this.moves[i] = this.moves[bi]; this.moves[bi] = tm;
      const ts = this.scores[i]; this.scores[i] = this.scores[bi]; this.scores[bi] = ts;
    }
    return this.moves[i];
  }
}

function hasPieces(pos) {
  const c = pos.turn, b = pos.board;
  for (let sq = 0; sq < 128; sq++) {
    if (offBoard(sq)) { sq += 7; continue; }
    const p = b[sq];
    if (p && (p & 8) === c && (p & 7) !== PAWN && (p & 7) !== KING) return true;
  }
  return false;
}

function gauss(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

