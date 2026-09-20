# Educational Animation

For "explain X" requests: a concept, a number, a mechanism, a piece of math, a bit of history,
a system nobody can see. Read this whenever the piece is meant to teach.

## Contents
- [The rule](#the-rule)
- [The joke is the door](#the-joke-is-the-door)
- [Structure for an explainer](#structure-for-an-explainer)
- [Encoding abstract quantities](#encoding-abstract-quantities)
- [The five teaching patterns](#the-five-teaching-patterns)
- [Reveal order](#reveal-order)
- [Labels](#labels)
- [Honesty rules](#honesty-rules)
- [Picking the one thing](#picking-the-one-thing)
- [Explainer checklist](#explainer-checklist)

---

## The rule

**One concept. Shown, not narrated.**

**The smuggling test:** remove every joke from the piece. The concept must still be fully intact
and correct. If cutting the jokes leaves a hole in the explanation, the jokes were doing the
teaching — rebuild the explanation first, then build the jokes *around* it. This is what
`EDUCATION 5` means when a user dials it.
 An explainer that needs voiceover to be understood is a
script with decoration on it. The test: mute it, hide all text, and ask whether a viewer could
describe the mechanism afterward. If not, the animation isn't teaching — it's illustrating.

The show's existing math/signal pieces work because they *run the thing* and let the viewer
watch the outcome. That's the standard: **demonstrate, don't depict.**

## The joke is the door


Educational STOOPID is not "comedy to make medicine go down." The structure is the same spine:

- **Hook** — an absurd or wrong-feeling version of the situation. Something that shouldn't work, or a claim that sounds false.
- **Escalation** — run the mechanism; let it push further than intuition expects.
- **Flip** — the mechanism turns out to be *true*, and the intuition turns out to be the absurd party. In an explainer, the flip is usually **the reversal** or **the cost reveal**.
- **Release** — the plain true statement. This is the one place a flat declarative caption is fully earned.

So the comedy and the teaching are the same move: the absurd thing is real, and you just watched it happen.

## Structure for an explainer

15–30 seconds, typically:

| Beat | Time (of 20s) | Job |
|---|---|---|
| Setup | 0–2s | Show the system at rest, so the change means something |
| The question | 2–4s | Pose it *physically* — two lanes, a fork, a gap, a bet |
| Run it | 4–13s | The mechanism operates in real time, uninterrupted |
| Result | 13–16s | The outcome, held long enough to be undeniable |
| The plain line | 16–20s | The one sentence, on a still frame |

The single most common failure is compressing "run it" to make room for text. Protect "run it."
It's the entire piece.

## Encoding abstract quantities

Rank order for making a number visible (best first):

1. **Position** — where it sits on a line. Most accurately read.
2. **Length / height** — bars, columns, stacks, fill levels.
3. **Rate** — how fast something moves or accumulates. Excellent for comparisons, and only available in motion.
4. **Count** — discrete objects, up to ~20. Beyond that, count becomes texture.
5. **Area / size** — reads as "bigger" but is judged badly; never for precise comparison.
6. **Angle** — pie-type encodings; weak, avoid except for genuine part-of-whole.
7. **Color intensity** — good for a field, bad for a value.

Motion-specific encodings the show can own:
- **Race** — two or three agents under the same rule, starting together. Shows rate difference without a single number.
- **Fill** — a container filling at the rate in question, with a visible threshold.
- **Drain** — the same, inverted; instantly reads as cost.
- **Queue length** — waiting made physical.
- **Accumulating stack with a tipping point** — compounding, thresholds, systemic failure.
- **Ratchet** — one-way progress, showing irreversibility.

## The five teaching patterns

1. **Same start, same finish** — several agents, identical endpoints, one differing rule. The whole lesson is *which arrives first*. Works for physics, algorithms, strategies, interest rates.
2. **Run the rule** — show a simple local rule, then let it run until structure emerges. Cellular automata, growth patterns, network effects, habits. The lesson: complex outcome, trivial rule.
3. **Zoom out** — start at the scale where intuition works, pull back until it doesn't. Exponentials, statistics, scale of systems.
4. **Break it on purpose** — run the system correctly, then remove one component and watch the failure. Shows what the component was *for* far better than labelling it.
5. **Follow one unit** — track a single item through a whole system (one dollar, one message, one packet, one errand). Makes a pipeline comprehensible and creates an accidental protagonist.

Pick one pattern. Two patterns in one explainer means two concepts, which violates the rule.

## Reveal order

Motion first, name second. The eye should ask the question before the label answers it.

1. Show the behavior.
2. Let it repeat or complete once.
3. *Then* label it.
4. State the general claim last.

A label that arrives before the motion tells the viewer what to see, and they stop looking.

## Labels

- Units always. A number with no unit is noise.
- Tabular figures for anything counting, and comma separators — precision is the straight man.
- Label the axis once, at the moment it first matters, and leave it.
- One label on screen at a time.
- If you're labelling three things simultaneously, the staging is too dense — split it into two shots.

## Honesty rules

Comedy does not license misleading visuals. These are non-negotiable, because the show's whole
premise is "true underneath."

- **Bars start at zero.** Always.
- **Linear scale unless log is announced**, and if log, show it (mark the decades visibly).
- **Areas scale by area**, not by side length. Doubling a value doubles the area, not the width.
- **Speeds are proportional.** If A is 3× faster, it moves 3× faster on screen. Don't fudge for legibility — restage instead.
- **Say when it's schematic.** A simplified model gets a mono label saying so (`SCHEMATIC · NOT TO SCALE`) — fake-serious *and* honest.
- **No invented statistics.** If a real figure is needed and isn't supplied, leave the placeholder visible (`[FIGURE — source needed]`) rather than inventing a plausible number. The piece is unshippable with a fake number in it.
- **Don't fake a result.** If the simulated outcome depends on the physics being right, implement the physics; don't hand-animate the answer you want.

## Picking the one thing

A concept usually contains five teachable things. Choose by:

- **Which one is surprising?** Teach the counter-intuitive part; the rest is prerequisites the viewer can survive without.
- **Which one moves?** If a sub-idea has no physical behavior, it's a bad fit for 20 seconds of animation.
- **Which one changes behavior?** The part that makes someone act differently earns the flip.

State what you cut. "This piece does X; compound-interest-vs-inflation would be a second piece"
is good directing, not a shortfall.

## Explainer checklist

- One concept, nameable in a sentence with no "and".
- Mute test passed — mechanism legible with no audio and no captions.
- The mechanism actually runs; it isn't hand-animated to a predetermined answer.
- The surprising part gets the longest hold.
- Numbers honest: zero baselines, real proportions, units, no invented figures.
- Labels arrive after motion.
- The flip makes intuition the absurd party, not the viewer stupid. **Never punch down at the audience** — the show calls out behavior, not people.
- Release is one plain true line.

---

> **[CREATOR INPUT NEEDED]**
> - Which of the existing SIGNAL math pieces Dev considers the best *teaching* result, and why — that becomes the house benchmark for this file.
> - The subject areas he wants to explain regularly (money, media systems, physics, AI, errand-economics), so patterns can be pre-matched to recurring topics.
> - Whether educational pieces carry a distinct visual convention from bits (e.g. an item number, a spec strip) — documented from real pieces, not invented here.
