// STOOPID CHESS — the booth. Commentator lines and end-of-game verdicts.
// Pure functions: the app hands over what happened, this hands back words.

const LINES = {
  open: [
    'The board is set. Nobody has made a mistake yet (enjoy this part).',
    'Sixteen pieces each. Same rules for everybody. Let’s see what you do with them.',
    'Fresh board. Clean slate. The pawns are nervous.',
  ],
  quiet: [
    '{who} plays {san}. Quiet move. Quiet moves are where plans live.',
    '{san}. Nothing loud — just positioning (the long game).',
    '{who} with {san}. The board noticed, even if nobody else did.',
    '{san}. Patience is a move too.',
    '{who} plays {san} and lets it breathe.',
  ],
  capture: {
    1: ['{who} takes a pawn. Small things add up.', '{san} — a pawn leaves the building.', 'Pawn down. (They knew the risks.)'],
    2: ['The knight is gone. Nobody ever understood how it moved anyway.', '{san} — a horse has been retired.'],
    3: ['{san}. A bishop, removed from the conversation.', 'There goes the bishop (diagonally, as always).'],
    4: ['{san} — a whole rook. That one’s going to be felt.', 'Rook gone. The corners just got lonelier.'],
    5: ['{san}. THE QUEEN. Somebody is going to think about this one tonight.', 'The queen is off the board. Take a breath — everybody.'],
  },
  trade: ['Even trade. Everybody gave something up.', 'A fair exchange. (Fair is underrated.)'],
  check: ['Check. The king has to deal with it — no rescheduling.', '{san}. Check. Kings hate being looked at like that.', 'Check. Move, block, or capture. Those are the options.'],
  castle: ['{who} castles. Home is where the rook is.', '{san}. King tucked in, rook stretched out. Responsible.', '{who} castles — safety first, chaos later.'],
  promo: ['A pawn walked the whole board and became a {piece}. Still swinging.', '{san}! Started as a pawn. Look at it now.'],
  ep: ['En passant. Yes, that’s a real rule. No, we didn’t make it up.', '{san} — en passant. The pawn that tried to sneak by didn’t.'],
  best: ['{san}. That’s the move. The engine nodded.', 'Best move on the board. (Somebody’s been practicing.)', '{san} — exactly right.'],
  inaccuracy: ['{san} is fine. {best} was a little better (a little).', 'Hmm. {best} was cleaner — but this isn’t over.'],
  mistake: ['{san}. That one gives something back — {best} was stronger.', 'A slip. {best} kept more of the advantage. (Breathe. Keep going.)'],
  blunder: ['Oof. {best} was right there. (It’s fine. It’s not fine.)', '{san}?? The board shifted under {who}. {best} was the move.', 'That’s a big one. {best} would have held it together.'],
  houseThinks: ['THE HOUSE is thinking…', 'THE HOUSE is doing math. Lots of it.', 'THE HOUSE considers its options (all of them).'],
  houseBlunder: ['Did THE HOUSE just… slip? Take it.', 'THE HOUSE made a human mistake. Strange times.'],
  hint: ['Look at {best}. (You didn’t hear it from us.)', 'Hint: {best}. Asking for help is a strong move too.'],
  takeback: ['Takeback. Everybody deserves a second draft.', 'Rewind. No judgment (a little judgment).'],
};

const pick = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const PIECE_NAMES = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };

export function openingLine(rng) { return pick(LINES.open, rng); }
export function boothLine(key, vars = {}, rng) { return fill(pick(LINES[key], rng), vars); }

// ev: { who, san, movedType, capturedType, check, mate, castle, promoType, ep, quality, bestSan, isHouse }
export function moveLine(ev, rng = Math.random) {
  const v = { who: ev.who, san: ev.san, best: ev.bestSan || 'something else', piece: PIECE_NAMES[ev.promoType] || 'queen' };
  if (ev.quality === 'blunder' || ev.quality === 'mistake') {
    if (ev.isHouse) return fill(pick(LINES.houseBlunder, rng), v);
    return fill(pick(LINES[ev.quality], rng), v);
  }
  if (ev.promoType) return fill(pick(LINES.promo, rng), v);
  if (ev.ep) return fill(pick(LINES.ep, rng), v);
  if (ev.castle) return fill(pick(LINES.castle, rng), v);
  if (ev.capturedType) {
    if (ev.recapture && ev.capturedType === ev.lastCapturedType) return fill(pick(LINES.trade, rng), v);
    return fill(pick(LINES.capture[ev.capturedType] || LINES.capture[1], rng), v);
  }
  if (ev.check) return fill(pick(LINES.check, rng), v);
  if (ev.quality === 'best' && !ev.isHouse) return fill(pick(LINES.best, rng), v);
  if (ev.quality === 'inaccuracy' && !ev.isHouse) return fill(pick(LINES.inaccuracy, rng), v);
  return fill(pick(LINES.quiet, rng), v);
}

// Win probability (0–100) for a centipawn score, the curve Lichess publishes for accuracy.
export function winPct(cp) {
  const c = Math.max(-2000, Math.min(2000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1);
}

// before/after in centipawns from the mover's point of view.
export function classify(before, after, isBest) {
  const loss = winPct(before) - winPct(after);
  if (isBest) return 'best';
  if (loss >= 15) return 'blunder';
  if (loss >= 10) return 'mistake';
  if (loss >= 5) return 'inaccuracy';
  return 'good';
}

export function moveAccuracy(before, after) {
  const loss = Math.max(0, winPct(before) - winPct(after));
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));
}

const REASONS = {
  checkmate: 'by checkmate', resign: 'by resignation', timeout: 'on time', stalemate: 'by stalemate',
  threefold: 'by threefold repetition', fifty: 'by the fifty-move rule', insufficient: 'by insufficient material',
  agreement: 'by agreement', 'timeout-insufficient': 'on time vs. insufficient material',
};
export const reasonText = r => REASONS[r] || '';

// The card. outcome: 'win' | 'loss' | 'draw' from the point of view of `who`.
// stats: { accuracy (0-100 or null), blunders, mistakes, moves, hints, reason, levelName }
export function verdict(outcome, stats, rng = Math.random) {
  const acc = stats.accuracy == null ? null : Math.round(stats.accuracy);
  const b = stats.blunders || 0;
  const how = reasonText(stats.reason);
  let v = 'STOOPID', title, ruling;
  if (outcome === 'win') {
    if (stats.reason === 'checkmate') title = pick(['CHECKMATE, CERTIFIED', 'THE KING HAS LEFT THE CHAT', 'CASE CLOSED'], rng);
    else if (stats.reason === 'timeout') title = 'THE CLOCK TESTIFIED';
    else title = 'WIN ON THE RECORD';
    ruling = acc != null && acc >= 85
      ? `Won ${how} at ${acc}% accuracy. That’s not luck — that’s practice showing up.`
      : b >= 2
        ? `Won ${how} with ${b} blunders along the way. Messy. Still counts. (Especially counts.)`
        : `Won ${how}. You saw the board and you trusted it.`;
  } else if (outcome === 'loss') {
    if (b >= 3 && (acc == null || acc < 60)) {
      v = 'STUPID';
      title = pick(['THE BOARD WINS THIS ROUND', 'HUNG OUT TO DRY', 'A LEARNING EXPERIENCE (LOUD)'], rng);
      ruling = `${b} blunders. The court has seen worse — not recently. Rematch is free.`;
    } else {
      title = pick(['LOST THE GAME, KEPT THE PLOT', 'DEFEATED, NOT DONE', 'THE COMEBACK STARTS HERE'], rng);
      ruling = acc != null
        ? `Lost ${how}, but played ${acc}% accurate. Losing well is a skill nobody talks about.`
        : `Lost ${how}. Every strong player has a pile of these. Add it to yours.`;
    }
  } else {
    title = stats.reason === 'stalemate' ? 'STALEMATE (TECHNICALLY PEACE)' : 'NOBODY LOST';
    ruling = `Drawn ${how}. Nobody won, nobody lost — that counts for something.`;
  }
  if (stats.hints) ruling += ` Hints used: ${stats.hints}.`;
  return { verdict: v, title, ruling };
}
