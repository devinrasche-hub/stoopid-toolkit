// STOOPID CHESS — the rules. Full legal chess on a 0x88 board.
// Shared by the browser game, the computer opponent, and (Phase 2) the server referee,
// so it has no DOM and no dependencies. Moves are plain integers; make/unmake is in place.

export const WHITE = 0, BLACK = 8;
export const PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
export const F_CAPTURE = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8, F_PROMO = 16;
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const CW_K = 1, CW_Q = 2, CB_K = 4, CB_Q = 8;
const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
const K_OFF = [1, -1, 16, -16, 17, 15, -17, -15];
const B_OFF = [17, 15, -17, -15];
const R_OFF = [1, -1, 16, -16];
const PIECE_CHARS = ' pnbrqk';
const STACK = 4096;

// move = from | to << 7 | promo << 14 | flags << 17
export const mFrom = m => m & 127;
export const mTo = m => (m >> 7) & 127;
export const mPromo = m => (m >> 14) & 7;
export const mFlags = m => m >> 17;
const enc = (from, to, flags, promo) => from | (to << 7) | ((promo || 0) << 14) | (flags << 17);

export const sqName = sq => 'abcdefgh'[sq & 7] + ((sq >> 4) + 1);
export const sqFromName = s => (s.charCodeAt(0) - 97) + (s.charCodeAt(1) - 49) * 16;
export const offBoard = sq => (sq & 0x88) !== 0;
export const sqColor = sq => ((sq >> 4) + (sq & 7)) & 1; // 0 = dark, 1 = light

// Zobrist keys from a fixed seed, as 32-bit halves (no BigInt in the hot path).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };
}
const rnd = mulberry32(0x5700F1D);
const Z_PIECE_LO = new Int32Array(16 * 128), Z_PIECE_HI = new Int32Array(16 * 128);
for (let i = 0; i < 16 * 128; i++) { Z_PIECE_LO[i] = rnd(); Z_PIECE_HI[i] = rnd(); }
const Z_CASTLE_LO = new Int32Array(16), Z_CASTLE_HI = new Int32Array(16);
for (let i = 0; i < 16; i++) { Z_CASTLE_LO[i] = rnd(); Z_CASTLE_HI[i] = rnd(); }
const Z_EP_LO = new Int32Array(8), Z_EP_HI = new Int32Array(8);
for (let i = 0; i < 8; i++) { Z_EP_LO[i] = rnd(); Z_EP_HI[i] = rnd(); }
const Z_SIDE_LO = rnd(), Z_SIDE_HI = rnd();

const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[0x00] = 15 & ~CW_Q; CASTLE_MASK[0x07] = 15 & ~CW_K; CASTLE_MASK[0x04] = 15 & ~(CW_K | CW_Q);
CASTLE_MASK[0x70] = 15 & ~CB_Q; CASTLE_MASK[0x77] = 15 & ~CB_K; CASTLE_MASK[0x74] = 15 & ~(CB_K | CB_Q);

export class Position {
  constructor(fen = START_FEN) {
    this.board = new Int8Array(128);
    this.kings = [0, 0];
    this.uMove = new Int32Array(STACK); this.uCap = new Int8Array(STACK);
    this.uCastle = new Int8Array(STACK); this.uEp = new Int16Array(STACK);
    this.uEpH = new Int8Array(STACK); this.uHalf = new Int16Array(STACK);
    this.hLo = new Int32Array(STACK); this.hHi = new Int32Array(STACK);
    this.load(fen);
  }

  load(fen) {
    const parts = fen.trim().split(/\s+/);
    if (parts.length < 4) throw new Error('Bad FEN: ' + fen);
    this.board.fill(0);
    const rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('Bad FEN board: ' + fen);
    let kingsSeen = [0, 0];
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '8') { f += +ch; continue; }
        const t = PIECE_CHARS.indexOf(ch.toLowerCase());
        if (t < 1 || f > 7) throw new Error('Bad FEN piece: ' + fen);
        const color = ch === ch.toLowerCase() ? BLACK : WHITE;
        const sq = (7 - r) * 16 + f;
        this.board[sq] = t | color;
        if (t === KING) { this.kings[color >> 3] = sq; kingsSeen[color >> 3]++; }
        f++;
      }
      if (f !== 8) throw new Error('Bad FEN row: ' + fen);
    }
    if (kingsSeen[0] !== 1 || kingsSeen[1] !== 1) throw new Error('FEN needs one king each: ' + fen);
    this.turn = parts[1] === 'b' ? BLACK : WHITE;
    this.castling = 0;
    if (parts[2] !== '-') for (const ch of parts[2]) this.castling |= { K: CW_K, Q: CW_Q, k: CB_K, q: CB_Q }[ch] || 0;
    // Drop rights the board can't back up (rook or king not home).
    if (this.board[0x04] !== KING || this.board[0x07] !== ROOK) this.castling &= ~CW_K;
    if (this.board[0x04] !== KING || this.board[0x00] !== ROOK) this.castling &= ~CW_Q;
    if (this.board[0x74] !== (KING | BLACK) || this.board[0x77] !== (ROOK | BLACK)) this.castling &= ~CB_K;
    if (this.board[0x74] !== (KING | BLACK) || this.board[0x70] !== (ROOK | BLACK)) this.castling &= ~CB_Q;
    this.ep = parts[3] !== '-' ? sqFromName(parts[3]) : -1;
    this.halfmove = parts[4] ? parseInt(parts[4], 10) || 0 : 0;
    this.fullmove = parts[5] ? parseInt(parts[5], 10) || 1 : 1;
    this.sp = 0;
    this.computeHash();
  }

  computeHash() {
    let lo = 0, hi = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (offBoard(sq)) { sq += 7; continue; }
      const p = this.board[sq];
      if (p) { lo ^= Z_PIECE_LO[p * 128 + sq]; hi ^= Z_PIECE_HI[p * 128 + sq]; }
    }
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    if (this.turn === BLACK) { lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI; }
    this.hashLo = lo; this.hashHi = hi;
    this.epH = -1;
    this.hashEp();
  }

  // The en-passant square only counts toward position identity when a capture is actually there.
  hashEp() {
    if (this.ep < 0) return;
    const pawnSq = this.ep + (this.turn === WHITE ? -16 : 16);
    const enemy = PAWN | this.turn;
    if ((!offBoard(pawnSq - 1) && this.board[pawnSq - 1] === enemy) ||
        (!offBoard(pawnSq + 1) && this.board[pawnSq + 1] === enemy)) {
      const f = this.ep & 7;
      this.hashLo ^= Z_EP_LO[f]; this.hashHi ^= Z_EP_HI[f]; this.epH = f;
    }
  }

  isAttacked(sq, by) {
    const b = this.board;
    if (by === WHITE) {
      if (!offBoard(sq - 15) && b[sq - 15] === PAWN) return true;
      if (!offBoard(sq - 17) && b[sq - 17] === PAWN) return true;
    } else {
      if (!offBoard(sq + 15) && b[sq + 15] === (PAWN | BLACK)) return true;
      if (!offBoard(sq + 17) && b[sq + 17] === (PAWN | BLACK)) return true;
    }
    const kn = KNIGHT | by, kg = KING | by;
    for (let i = 0; i < 8; i++) {
      let t = sq + N_OFF[i];
      if (!offBoard(t) && b[t] === kn) return true;
      t = sq + K_OFF[i];
      if (!offBoard(t) && b[t] === kg) return true;
    }
    const bi = BISHOP | by, ro = ROOK | by, qu = QUEEN | by;
    for (let i = 0; i < 4; i++) {
      let d = B_OFF[i], t = sq + d;
      while (!offBoard(t)) {
        const p = b[t];
        if (p) { if (p === bi || p === qu) return true; break; }
        t += d;
      }
      d = R_OFF[i]; t = sq + d;
      while (!offBoard(t)) {
        const p = b[t];
        if (p) { if (p === ro || p === qu) return true; break; }
        t += d;
      }
    }
    return false;
  }

  inCheck(color = this.turn) { return this.isAttacked(this.kings[color >> 3], color ^ 8); }

  // Pseudo-legal moves into buf from index n; returns the new end. capsOnly = captures + queen promotions.
  gen(buf, n, capsOnly) {
    const b = this.board, c = this.turn, them = c ^ 8;
    const dir = c === WHITE ? 16 : -16;
    const startRank = c === WHITE ? 1 : 6, promoRank = c === WHITE ? 6 : 1;
    for (let sq = 0; sq < 128; sq++) {
      if (offBoard(sq)) { sq += 7; continue; }
      const p = b[sq];
      if (!p || (p & 8) !== c) continue;
      const t = p & 7;
      if (t === PAWN) {
        const rank = sq >> 4, one = sq + dir;
        if (b[one] === 0) {
          if (rank === promoRank) {
            buf[n++] = enc(sq, one, F_PROMO, QUEEN);
            if (!capsOnly) {
              buf[n++] = enc(sq, one, F_PROMO, KNIGHT);
              buf[n++] = enc(sq, one, F_PROMO, ROOK);
              buf[n++] = enc(sq, one, F_PROMO, BISHOP);
            }
          } else if (!capsOnly) {
            buf[n++] = enc(sq, one, 0);
            if (rank === startRank && b[one + dir] === 0) buf[n++] = enc(sq, one + dir, F_DOUBLE);
          }
        }
        for (let s = -1; s <= 1; s += 2) {
          const to = one + s;
          if (offBoard(to)) continue;
          const q = b[to];
          if (q && (q & 8) === them) {
            if (rank === promoRank) {
              buf[n++] = enc(sq, to, F_CAPTURE | F_PROMO, QUEEN);
              if (!capsOnly) {
                buf[n++] = enc(sq, to, F_CAPTURE | F_PROMO, KNIGHT);
                buf[n++] = enc(sq, to, F_CAPTURE | F_PROMO, ROOK);
                buf[n++] = enc(sq, to, F_CAPTURE | F_PROMO, BISHOP);
              }
            } else buf[n++] = enc(sq, to, F_CAPTURE);
          } else if (to === this.ep) {
            buf[n++] = enc(sq, to, F_CAPTURE | F_EP);
          }
        }
      } else if (t === KNIGHT || t === KING) {
        const offs = t === KNIGHT ? N_OFF : K_OFF;
        for (let i = 0; i < 8; i++) {
          const to = sq + offs[i];
          if (offBoard(to)) continue;
          const q = b[to];
          if (!q) { if (!capsOnly) buf[n++] = enc(sq, to, 0); }
          else if ((q & 8) === them) buf[n++] = enc(sq, to, F_CAPTURE);
        }
      } else {
        const diag = t === BISHOP || t === QUEEN, ortho = t === ROOK || t === QUEEN;
        for (let i = 0; i < 8; i++) {
          const d = K_OFF[i];
          const isDiag = i >= 4;
          if (isDiag ? !diag : !ortho) continue;
          let to = sq + d;
          while (!offBoard(to)) {
            const q = b[to];
            if (!q) { if (!capsOnly) buf[n++] = enc(sq, to, 0); }
            else { if ((q & 8) === them) buf[n++] = enc(sq, to, F_CAPTURE); break; }
            to += d;
          }
        }
      }
    }
    if (!capsOnly && this.castling) {
      if (c === WHITE) {
        if ((this.castling & CW_K) && !b[0x05] && !b[0x06] && b[0x07] === ROOK &&
            !this.isAttacked(0x04, them) && !this.isAttacked(0x05, them) && !this.isAttacked(0x06, them))
          buf[n++] = enc(0x04, 0x06, F_CASTLE);
        if ((this.castling & CW_Q) && !b[0x03] && !b[0x02] && !b[0x01] && b[0x00] === ROOK &&
            !this.isAttacked(0x04, them) && !this.isAttacked(0x03, them) && !this.isAttacked(0x02, them))
          buf[n++] = enc(0x04, 0x02, F_CASTLE);
      } else {
        if ((this.castling & CB_K) && !b[0x75] && !b[0x76] && b[0x77] === (ROOK | BLACK) &&
            !this.isAttacked(0x74, them) && !this.isAttacked(0x75, them) && !this.isAttacked(0x76, them))
          buf[n++] = enc(0x74, 0x76, F_CASTLE);
        if ((this.castling & CB_Q) && !b[0x73] && !b[0x72] && !b[0x71] && b[0x70] === (ROOK | BLACK) &&
            !this.isAttacked(0x74, them) && !this.isAttacked(0x73, them) && !this.isAttacked(0x72, them))
          buf[n++] = enc(0x74, 0x72, F_CASTLE);
      }
    }
    return n;
  }

  make(m) {
    const b = this.board, sp = this.sp;
    const from = m & 127, to = (m >> 7) & 127, flags = m >> 17, promo = (m >> 14) & 7;
    const piece = b[from], c = this.turn;
    let captured = b[to];
    this.uMove[sp] = m; this.uCastle[sp] = this.castling; this.uEp[sp] = this.ep;
    this.uEpH[sp] = this.epH; this.uHalf[sp] = this.halfmove;
    this.hLo[sp] = this.hashLo; this.hHi[sp] = this.hashHi;
    this.sp = sp + 1;

    let lo = this.hashLo, hi = this.hashHi;
    if (this.epH >= 0) { lo ^= Z_EP_LO[this.epH]; hi ^= Z_EP_HI[this.epH]; }
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];

    lo ^= Z_PIECE_LO[piece * 128 + from]; hi ^= Z_PIECE_HI[piece * 128 + from];
    b[from] = 0;
    if (flags & F_EP) {
      const capSq = to + (c === WHITE ? -16 : 16);
      captured = b[capSq];
      lo ^= Z_PIECE_LO[captured * 128 + capSq]; hi ^= Z_PIECE_HI[captured * 128 + capSq];
      b[capSq] = 0;
    } else if (captured) {
      lo ^= Z_PIECE_LO[captured * 128 + to]; hi ^= Z_PIECE_HI[captured * 128 + to];
    }
    this.uCap[sp] = captured;
    const placed = promo ? (promo | c) : piece;
    b[to] = placed;
    lo ^= Z_PIECE_LO[placed * 128 + to]; hi ^= Z_PIECE_HI[placed * 128 + to];
    if (flags & F_CASTLE) {
      const rFrom = to > from ? from + 3 : from - 4, rTo = to > from ? from + 1 : from - 1;
      const rook = b[rFrom];
      b[rTo] = rook; b[rFrom] = 0;
      lo ^= Z_PIECE_LO[rook * 128 + rFrom] ^ Z_PIECE_LO[rook * 128 + rTo];
      hi ^= Z_PIECE_HI[rook * 128 + rFrom] ^ Z_PIECE_HI[rook * 128 + rTo];
    }
    if ((piece & 7) === KING) this.kings[c >> 3] = to;
    this.halfmove = ((piece & 7) === PAWN || captured) ? 0 : this.halfmove + 1;
    this.ep = (flags & F_DOUBLE) ? from + (c === WHITE ? 16 : -16) : -1;
    if (c === BLACK) this.fullmove++;
    this.turn = c ^ 8;
    lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI;
    this.hashLo = lo; this.hashHi = hi; this.epH = -1;
    this.hashEp();
  }

  unmake() {
    const b = this.board, sp = --this.sp;
    const m = this.uMove[sp];
    const from = m & 127, to = (m >> 7) & 127, flags = m >> 17;
    this.turn ^= 8;
    const c = this.turn;
    const piece = (flags & F_PROMO) ? (PAWN | c) : b[to];
    b[from] = piece;
    if (flags & F_EP) {
      b[to] = 0;
      b[to + (c === WHITE ? -16 : 16)] = this.uCap[sp];
    } else b[to] = this.uCap[sp];
    if (flags & F_CASTLE) {
      const rFrom = to > from ? from + 3 : from - 4, rTo = to > from ? from + 1 : from - 1;
      b[rFrom] = b[rTo]; b[rTo] = 0;
    }
    if ((piece & 7) === KING) this.kings[c >> 3] = from;
    this.castling = this.uCastle[sp]; this.ep = this.uEp[sp]; this.epH = this.uEpH[sp];
    this.halfmove = this.uHalf[sp];
    this.hashLo = this.hLo[sp]; this.hashHi = this.hHi[sp];
    if (c === BLACK) this.fullmove--;
  }

  // Pass the turn (search only — null-move pruning). Must be paired with unmakeNull.
  makeNull() {
    const sp = this.sp;
    this.uMove[sp] = 0; this.uEp[sp] = this.ep; this.uEpH[sp] = this.epH; this.uHalf[sp] = this.halfmove;
    this.uCastle[sp] = this.castling; this.hLo[sp] = this.hashLo; this.hHi[sp] = this.hashHi;
    this.sp = sp + 1;
    if (this.epH >= 0) { this.hashLo ^= Z_EP_LO[this.epH]; this.hashHi ^= Z_EP_HI[this.epH]; }
    this.ep = -1; this.epH = -1; this.halfmove++;
    this.turn ^= 8; this.hashLo ^= Z_SIDE_LO; this.hashHi ^= Z_SIDE_HI;
  }
  unmakeNull() {
    const sp = --this.sp;
    this.turn ^= 8;
    this.ep = this.uEp[sp]; this.epH = this.uEpH[sp]; this.halfmove = this.uHalf[sp];
    this.hashLo = this.hLo[sp]; this.hashHi = this.hHi[sp];
  }

  // Make m if it doesn't leave the mover's king attacked. Returns true if made.
  tryMake(m) {
    const mover = this.turn;
    this.make(m);
    if (this.isAttacked(this.kings[mover >> 3], this.turn)) { this.unmake(); return false; }
    return true;
  }

  legalMoves() {
    const buf = new Int32Array(256), n = this.gen(buf, 0, false), out = [];
    for (let i = 0; i < n; i++) if (this.tryMake(buf[i])) { this.unmake(); out.push(buf[i]); }
    return out;
  }

  hasLegalMove() {
    const buf = new Int32Array(256), n = this.gen(buf, 0, false);
    for (let i = 0; i < n; i++) if (this.tryMake(buf[i])) { this.unmake(); return true; }
    return false;
  }

  // How many earlier times the current position occurred (same side to move, rights, ep).
  repetitions() {
    let count = 0;
    const stop = Math.max(0, this.sp - this.halfmove);
    for (let i = this.sp - 2; i >= stop; i -= 2)
      if (this.hLo[i] === this.hashLo && this.hHi[i] === this.hashHi) count++;
    return count;
  }

  insufficientMaterial() {
    let minors = 0, bishopColors = 0, knights = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (offBoard(sq)) { sq += 7; continue; }
      const t = this.board[sq] & 7;
      if (!t || t === KING) continue;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      minors++;
      if (t === KNIGHT) knights++;
      else bishopColors |= 1 << sqColor(sq);
    }
    if (minors <= 1) return true;
    return knights === 0 && bishopColors !== 3; // only bishops, all on one square color
  }

  // { over, result: '1-0' | '0-1' | '1/2-1/2' | '*', reason }
  status() {
    if (!this.hasLegalMove()) {
      if (this.inCheck()) return { over: true, result: this.turn === WHITE ? '0-1' : '1-0', reason: 'checkmate' };
      return { over: true, result: '1/2-1/2', reason: 'stalemate' };
    }
    if (this.insufficientMaterial()) return { over: true, result: '1/2-1/2', reason: 'insufficient' };
    if (this.repetitions() >= 2) return { over: true, result: '1/2-1/2', reason: 'threefold' };
    if (this.halfmove >= 100) return { over: true, result: '1/2-1/2', reason: 'fifty' };
    return { over: false, result: '*', reason: '' };
  }

  fen() {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 16 + f];
        if (!p) { empty++; continue; }
        if (empty) { s += empty; empty = 0; }
        const ch = PIECE_CHARS[p & 7];
        s += (p & 8) ? ch : ch.toUpperCase();
      }
      if (empty) s += empty;
      if (r) s += '/';
    }
    let cs = '';
    if (this.castling & CW_K) cs += 'K';
    if (this.castling & CW_Q) cs += 'Q';
    if (this.castling & CB_K) cs += 'k';
    if (this.castling & CB_Q) cs += 'q';
    return `${s} ${this.turn === WHITE ? 'w' : 'b'} ${cs || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.halfmove} ${this.fullmove}`;
  }

  uci(m) {
    const p = mPromo(m);
    return sqName(mFrom(m)) + sqName(mTo(m)) + (p ? PIECE_CHARS[p] : '');
  }

  // Standard algebraic notation for a legal move in the current position.
  san(m, legal = this.legalMoves()) {
    const from = mFrom(m), to = mTo(m), flags = mFlags(m), t = this.board[from] & 7;
    let s;
    if (flags & F_CASTLE) s = to > from ? 'O-O' : 'O-O-O';
    else if (t === PAWN) {
      s = (flags & F_CAPTURE ? 'abcdefgh'[from & 7] + 'x' : '') + sqName(to);
      if (flags & F_PROMO) s += '=' + PIECE_CHARS[mPromo(m)].toUpperCase();
    } else {
      s = PIECE_CHARS[t].toUpperCase();
      const rivals = legal.filter(o => o !== m && mTo(o) === to && (this.board[mFrom(o)] & 7) === t);
      if (rivals.length) {
        const sameFile = rivals.some(o => (mFrom(o) & 7) === (from & 7));
        const sameRank = rivals.some(o => (mFrom(o) >> 4) === (from >> 4));
        if (!sameFile) s += 'abcdefgh'[from & 7];
        else if (!sameRank) s += (from >> 4) + 1;
        else s += sqName(from);
      }
      if (flags & F_CAPTURE) s += 'x';
      s += sqName(to);
    }
    this.make(m);
    if (this.inCheck()) s += this.hasLegalMove() ? '+' : '#';
    this.unmake();
    return s;
  }

  moveFromUci(str) {
    const s = String(str).trim().toLowerCase();
    return this.legalMoves().find(m => this.uci(m) === s) || 0;
  }

  moveFromSan(str) {
    const clean = x => x.replace(/[+#!?]/g, '').replace(/0/g, 'O').replace(/=/g, '');
    const want = clean(String(str).trim());
    if (!want) return 0;
    const legal = this.legalMoves();
    const exact = legal.find(m => clean(this.san(m, legal)) === want);
    if (exact) return exact;
    // Forgiving input: lower-case piece letters ("nf3"), or a pawn capture written without the file.
    const lower = want.toLowerCase();
    const loose = legal.filter(m => clean(this.san(m, legal)).toLowerCase() === lower);
    return loose.length === 1 ? loose[0] : (this.moveFromUci(want) || 0);
  }

  // The 64 squares as 'wK' / 'bp'-style codes (a8 first, like the board is drawn) for the UI.
  pieceAt(sq) {
    const p = this.board[sq];
    if (!p) return '';
    return ((p & 8) ? 'b' : 'w') + PIECE_CHARS[p & 7].toUpperCase();
  }

  clone() {
    const p = new Position(this.fen());
    return p;
  }
}

// Replays a game from a start FEN and a list of UCI moves; throws on an illegal move.
export function replay(startFen, uciMoves) {
  const pos = new Position(startFen || START_FEN);
  for (const u of uciMoves || []) {
    const m = pos.moveFromUci(u);
    if (!m) throw new Error('Illegal move in history: ' + u);
    pos.make(m);
  }
  return pos;
}

export function perft(pos, depth) {
  if (depth === 0) return 1;
  const buf = new Int32Array(256), n = pos.gen(buf, 0, false);
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (!pos.tryMake(buf[i])) continue;
    total += depth === 1 ? 1 : perft(pos, depth - 1);
    pos.unmake();
  }
  return total;
}
