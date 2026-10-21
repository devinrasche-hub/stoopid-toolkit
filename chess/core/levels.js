// STOOPID CHESS — how hard THE HOUSE tries. Shared by the page (menus) and the engine (settings).

// Strength 0..100 → search settings. Below 60 the engine plays shallow and noisy (human-looking
// mistakes); above it, it thinks longer with no noise. The named levels are points on this scale.
export function settingsFor(strength) {
  const s = Math.max(0, Math.min(100, strength));
  if (s < 60) {
    const depth = s < 20 ? 1 : s < 40 ? 2 : 3;
    return { depth, noise: Math.round(260 - s * 3.6), timeMs: 0 };
  }
  return { depth: 32, noise: 0, timeMs: Math.round(150 + (s - 60) * 60) };
}

export const LEVELS = [
  { id: 'beans', name: 'BEANS', strength: 8, blurb: 'Just learned how the horse moves (the horse is still a mystery)' },
  { id: 'rookie', name: 'ROOKIE', strength: 30, blurb: 'Knows the rules. Forgets them under pressure' },
  { id: 'regular', name: 'REGULAR', strength: 52, blurb: 'Plays at the park on Sundays' },
  { id: 'smart', name: 'STOOPID SMART', strength: 72, blurb: 'Thinks before moving (a rare skill)' },
  { id: 'house', name: 'THE HOUSE', strength: 100, blurb: 'The house always wins. Probably' },
];
