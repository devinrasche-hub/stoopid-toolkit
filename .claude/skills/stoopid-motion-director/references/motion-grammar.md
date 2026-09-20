# Motion Grammar

How STOOPID things move. Read this before writing any animation code.

## Contents
- [The clock pattern](#the-clock-pattern)
- [Timing numbers that read on a phone](#timing-numbers-that-read-on-a-phone)
- [Easing vocabulary](#easing-vocabulary)
- [Weight: anticipate, overshoot, settle](#weight-anticipate-overshoot-settle)
- [Holds are motion](#holds-are-motion)
- [The house motion palette](#the-house-motion-palette)
- [Camera language in 2D](#camera-language-in-2d)
- [Frame-rate feel](#frame-rate-feel)
- [Effects discipline](#effects-discipline)
- [Text in motion](#text-in-motion)
- [Seamless loops](#seamless-loops)
- [Sound-shaped motion](#sound-shaped-motion)
- [Implementation choices](#implementation-choices)
- [Physics cheat sheet](#physics-cheat-sheet)

---

## The clock pattern

One time value drives everything. Never scatter `animation-delay` values across a stylesheet —
a director has to be able to retime a beat in one line.

```js
// ---- BEATS (seconds) — retime the piece here and nowhere else ----
const HOOK = 1.2, ESC = 4.0, FLIP = 2.4, REL = 1.6;
const T_HOOK = HOOK, T_ESC = T_HOOK + ESC, T_FLIP = T_ESC + FLIP, TOTAL = T_FLIP + REL;
const LOOP = true;                       // seamless cycle vs land-and-hold

let t0 = null;
function frame(now){
  if (t0 === null) t0 = now;
  let t = (now - t0) / 1000;
  if (LOOP) t %= TOTAL;                  // modulo the clock, never accumulate state
  draw(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// local beat progress, 0..1 — the workhorse
const p = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
```

Rules that follow from this:
- **Draw from `t`, never from accumulated state.** `x += v` drifts, desyncs on a dropped frame, and cannot loop. `x = f(t)` is scrubbable, loopable and reproducible.
- Where integration is genuinely the point (physics races, particles), integrate with a **fixed step** and reset cleanly at cycle start.
- Beat constants get names, not magic numbers.

## Timing numbers that read on a phone

A phone viewer at 1× with sound off, thumb hovering. Be legible fast.

| Event | Duration |
|---|---|
| Something appears / snaps in | 80–150 ms |
| A move the eye must follow | 250–400 ms |
| A big object repositioning | 500–800 ms |
| Hold on a reveal so it registers | 400–700 ms |
| Hold on the flip | 600–1000 ms — the longest hold in the piece |
| Hard cut between micro-shots | 1 frame (no transition) |
| Minimum shot length | 0.5 s (any shorter reads as a glitch, which is a different tool) |
| Readable word on screen | 0.3 s per word, floor of 1.0 s |

**The flip gets the longest hold in the piece.** That hold *is* the punctuation.

## Easing vocabulary

| Feel | CSS / cubic-bezier | Use for |
|---|---|---|
| Snap | `cubic-bezier(.2,0,0,1)` | Stamps, cuts, counters, decisions |
| Weighted arrival | `cubic-bezier(.16,1,.3,1)` | Objects landing, panels settling |
| Anticipate then go | `cubic-bezier(.68,-.55,.27,1.55)` | Cartoon launch, recoil, springy failure |
| Mechanical | `linear` | Machines, conveyors, scrolling feeds, credits |
| Drift | `cubic-bezier(.4,0,.6,1)` | Floating, breathing, ambience |

In JS:
```js
const easeOut  = p => 1 - Math.pow(1 - p, 3);
const easeIn   = p => p * p * p;
const easeBoth = p => p < .5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
const overshoot = (p, k = 1.7) => 1 + (k + 1) * Math.pow(p - 1, 3) + k * Math.pow(p - 1, 2);
const spring = (p, freq = 8, decay = 6) =>
  1 - Math.exp(-decay * p) * Math.cos(freq * Math.PI * p);
```

**`linear` is a choice, not a default.** Use it when the thing is genuinely a machine. Everything
alive gets eased, or the piece reads as a slideshow.

## Weight: anticipate, overshoot, settle

Any significant move is three parts, and the whole thing fits in ~400 ms:

1. **Anticipation** (~15% of duration) — small move *against* the coming direction. Squat before the jump, pull back before the punch.
2. **Action** (~60%) — fast, eased out, with squash/stretch along the travel axis.
3. **Settle** (~25%) — overshoot 4–12% past target, then one small return. Heavier object → smaller overshoot, longer settle.

Scale of weight: a light thing overshoots a lot and settles instantly; a heavy thing barely
overshoots and takes two beats to stop. Getting this relationship right is most of what makes
absurd objects feel real — and rule 4 of the skill says they must.

Squash/stretch preserves volume: `scaleX = 1/√scaleY`. Never squash without a reason (impact,
acceleration) and always recover within 200 ms.

## Holds are motion

New animators fill every frame. A STOOPID piece breathes:

- **Beat before the break.** Establish the ordinary world, hold ~300 ms, *then* break the rule.
- **Freeze on impact.** 2–3 frames of total stillness at a hit makes it hit harder than any shake.
- **The flip hold.** Everything stops except one small continuing motion (a drip, a counter, a blink). The stillness is the "oh."
- **Post-release hold.** 300–500 ms of dead air before loop or end, so the last image sticks.

## The house motion palette

Reusable moves that fit this show. Combine, don't decorate.

- **The escalating counter** — a number that keeps going up past the point of reason, with correct comma formatting. Precision is the straight man.
- **The obedient machine** — a mechanism that keeps performing its function on an absurd input, perfectly, forever.
- **The queue** — things lining up and waiting. Queues make systems visible and are funny at any length.
- **The stack that tips** — accumulation with an exact failure threshold. The viewer starts predicting the collapse, which is the joke doing your work.
- **The calm anchor** — one element refusing to react while the frame spirals.
- **The literalizer** — a metaphor that stops being figurative on screen (the plate is actually full; the bar is actually raised).
- **The pull-back** — a reveal by widening: what looked like the whole situation was one cell of a grid.
- **The stamp** — a verdict/label slamming in at the release, 90 ms, snap easing, slight rotation, then still.
- **The drain** — a meter, battery, balance or patience level emptying in real time.
- **The wrong-direction fall** — one law of physics inverted, everything else obedient.

## Camera language in 2D

Even with no camera, you have one: transform the world, not the objects.

- **Push in** (scale 1 → 1.08 over 800 ms) — pressure, attention, "look closer."
- **Pull back** (1 → 0.6) — the primary flip device. Context arrives as scale.
- **Whip pan** — 120–180 ms lateral blur-slide, used *between* micro-shots to fake a cut with continuity.
- **Hard cut** — one frame, no transition. Free, fast, and the most underused tool in web animation.
- **Handheld** — 1–2 px of low-frequency noise on the world transform. Use it on "real" footage parody only; it costs legibility on a phone.
- **Shake** — impacts only, ≤6 px, ≤200 ms, decaying. Never ambient.
- **Rack focus** — a CSS blur swap between foreground and background layers to move attention without moving the camera.

Keep a single `worldTransform` (translate, scale, rotate) applied once per frame, so camera
moves never have to be baked into every object.

## Frame-rate feel

- **60 fps smooth** — default. Modern, clean, matches the show's digital surface.
- **12 fps stepped** — quantize `t` to `Math.floor(t*12)/12` for a hand-drawn or "cheap cartoon" register. Very effective for one escalation rung, then back to smooth.
- **8 fps stepped** — deliberately janky; reads as a broken system or bad GIF. Use as a joke about the medium, briefly.
- **Mixed** — a stepped foreground character over a smooth background is a strong, cheap look.

## Effects discipline

Glitch, scanlines, chromatic aberration, RGB split, VHS noise: **punctuation, not wallpaper.**

- Effects land on **hit points** — the rule break, each escalation rung, the flip, the stamp.
- One glitch burst: 80–200 ms, then gone completely.
- Scanlines/noise may run continuously at low opacity (≤8%) as texture; that's grain, not an effect.
- Never glitch during the flip hold. The flip needs clarity — that's the entire word "clarity" in Absurd Clarity.
- If everything shakes, nothing is emphasized. Budget: at most 3 effect hits in a 15-second piece.

## Text in motion

- Text supports; motion carries. (Skill rule 7.)
- One text element on screen at a time. Two competing readables = neither is read.
- Type in, cut in, or stamp in — don't fade in. Fades read as "corporate motion graphics."
- Counters and numbers are *motion*, not text: they animate, they earn their place.
- The Release stamp is the one place a caption may carry weight, because by then the idea has already been shown.
- Minimum 1.0 s on screen, plus 0.3 s per word.

## Seamless loops

A loop is a promise: frame N is indistinguishable from frame 0. Four ways to keep it:

1. **Modulo the clock.** `t %= TOTAL` with every property computed as `f(t)`. Guarantees the cycle as long as nothing accumulates.
2. **Cyclic functions.** Anything built on `sin`/`cos` of `2πt/TOTAL` loops by construction. Multiple elements can use different *integer* multiples of the base frequency and still close.
3. **Palindrome.** Play 0→1→0 with `p = 1 - Math.abs(1 - 2*(t/TOTAL))`. Always seamless; reads as "boomerang," so it suits pendulums, breathing and pumping, not narrative.
4. **Hide the seam in a cut.** End on a hard cut to the opening frame, ideally masked by a stamp, a whip pan or a 2-frame black. The most useful trick for *narrative* loops, where the story genuinely ends somewhere else.

Loop checklist:
- No `x += v` anywhere. No randomness unless seeded and reset at cycle start (`rng = mulberry32(SEED)` at `t ≈ 0`).
- Particles: their lifetimes must divide `TOTAL`, or spawn them from `f(t)` instead of a pool.
- Trails and canvas smear: clear fully at cycle start, or the first loop looks different from the fifth.
- Text: retype or re-stamp each cycle; don't leave it on screen across the seam.
- **Verify** by playing at least three cycles and watching the seam, not by reasoning about it.

Narrative loops carry an extra payoff: the Release *becomes* the Hook. The escalation starting
over is itself the joke about the system — the funniest available use of a loop in this show's
register.

## Sound-shaped motion

Deliverables are usually silent (autoplay reality), and the show's audio is added in CapCut.
So: **animate the hit points a sound designer would want**, and say what they are when handing over.

- Put visible impacts on a regular grid where possible (0.5 s / 1.0 s), so music can be cut to the piece.
- List the hits in the handoff: "hits at 0.9s, 2.4s, 4.0s (flip), 6.2s (stamp)."
- Never rely on audio to explain a beat. If the piece only works with a voiceover, it's a script, not an animation.

## Implementation choices

| Need | Use |
|---|---|
| Layout-ish motion, few elements, crisp text | **CSS transforms + a JS clock** driving custom properties |
| Shapes, strokes, masks, line-draw reveals, diagram behavior | **SVG + JS** (`stroke-dasharray` for draw-on, `<clipPath>` for reveals) |
| Many objects, particles, physics, trails, pixel effects | **Canvas 2D** at true pixel size (the house default for recorded pieces) |
| Heavy 3D or shaders | Avoid unless the idea requires it — it costs the one-file, no-dependency contract |

Performance: one `requestAnimationFrame` loop, all drawing inside it. Cap device pixel ratio
at 2. Prefer `transform` and `opacity` for CSS work (compositor-only). Precompute static
geometry outside the loop.

## Physics cheat sheet

For a 1080×1920 stage, values that look right on a phone:

| Quantity | Value |
|---|---|
| Gravity | 2000–3000 px/s² (≈980 reads floaty and dreamlike — sometimes exactly right) |
| Terminal-ish drag | `v *= 0.98` per frame at 60 fps |
| Bounce restitution | 0.4–0.6 (fun), 0.2 (dead weight), 0.85 (rubber) |
| Comfortable travel speed | 600–1200 px/s |
| Fast whip | 3000+ px/s with a 2–3 frame motion-blur smear |
| Impact squash | scaleY 0.7–0.85 for 60–120 ms, then spring back |
| Rotation on tumble | 180–540°/s, eased out |

---

> **[CREATOR INPUT NEEDED]**
> - Dev's preferred default register: 60 fps smooth vs stepped 12 fps, and whether handheld/VHS
>   motion is house style for motion pieces or reserved for footage parody.
> - The recorded-output spec his edit actually wants (frame rate, capture length, whether pieces
>   are screen-recorded from the browser or exported some other way) — the timing advice here
>   assumes a screen recording at 60 fps.
> - Any move from his existing pieces that should be added to the house motion palette above,
>   named the way he already refers to it.
