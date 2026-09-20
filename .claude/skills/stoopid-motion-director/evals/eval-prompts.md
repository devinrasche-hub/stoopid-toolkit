# Evaluation Prompts — stoopid-motion-director

Twelve test prompts plus a trigger test and a negative control, for checking whether this skill
actually changes the output versus vanilla Claude.

## How to run

1. **A/B, same prompt.** Run each prompt in a session **without** the skill (control) and **with**
   it (test). Keep the wording identical; don't hint at structure in the prompt itself.
2. **Blind the grading where you can.** Strip headers, shuffle, then score.
3. **Score with the rubric below** (0/1/2 per dimension, 14 points max), and note the *qualitative*
   difference — a skill that only adds jargon scores well and helps nobody.
4. **The bar:** the test run should beat the control by **≥4 points** on prompts 1–12, and the
   control should visibly lack the *structural* moves (intake gate, one changed rule, earned flip,
   working artifact) rather than just the vocabulary.
5. **Variance matters.** Run each prompt 2–3 times. A skill that works once in three is not working.

## Rubric (0 = absent, 1 = partial, 2 = fully present)

| # | Dimension | What a 2 looks like |
|---|---|---|
| 1 | **Intake gate** | One idea, ordinary world, one changed rule, flip, length/aspect/loop — all stated before building |
| 2 | **One idea** | A single thesis; extra ideas explicitly deferred to other pieces |
| 3 | **Spine** | Hook → Escalation → Flip → Release with real timecodes that sum to the stated length |
| 4 | **Earned flip** | The flip is a visible change, not a caption stating the point |
| 5 | **Shown, not said** | The mechanism is physical; text is at most a release stamp |
| 6 | **Craft** | Weight, easing, holds, effect discipline, palette discipline — specific numbers, not adjectives |
| 7 | **Deliverable** | A file that actually runs / a sheet that can be used as-is — not a description of one |

Vanilla Claude typically scores 0–1 on dimensions 1, 4 and 6, and produces a generic CSS
keyframe demo for 7. That's the gap being measured.

---

## The prompts

### 1 — Bare artifact request
> Make me a 10-second animation about how notifications never stop.

**Skill-specific expectations:** intake gate stated; one changed rule named; a single self-contained
HTML file that runs, at 1080×1920 with a `t`-driven clock and named beat constants; SIGNAL palette
with burnt orange only at the flip; a flip from the eight kinds; audio hit points listed.
**Fails if:** it's a CSS bounce demo, the flip is a caption, orange appears early, or timing lives in
scattered `animation-delay` values.

### 2 — Educational explainer
> Can you animate an explanation of why compound interest feels slow at first?

**Expectations:** exactly one concept; one of the five teaching patterns named; mechanism *runs*
rather than being hand-animated to the answer; zero-baseline and proportional-rate honesty; labels
arrive after motion; no invented figures (placeholder left visible if a real number is needed);
release is one plain true line.
**Fails if:** it narrates the concept over decorative motion, invents a plausible-sounding statistic,
or teaches three things.

### 3 — Visual metaphor
> What's the visual for the feeling of having 40 browser tabs open?

**Expectations:** exactly three options in the `OPTION A/B/C` format — world, changed rule,
escalation axis, flip kind, why it's true, build cost — one recommendation with a reason, and the
obvious pre-chewed metaphor either rejected or made strange.
**Fails if:** it returns one idea, eight bullet points, or three *different* ideas rather than three
stagings of the same idea.

### 4 — Storyboard
> Storyboard a 15-second bit about somebody reading the terms and conditions.

**Expectations:** numbered shot list with absolute timecodes summing to 15s; each shot has frame,
motion, sound hit and a reason to exist; shot sizes vary; cutting rhythm tightens into the flip;
the flip shot is the longest hold; ends with an offer to build it.
**Fails if:** timecodes don't sum, every shot is the same size, or "shots" are just plot beats.

### 5 — Video-generation prompts
> Give me Sora prompts for a short clip where a guy's to-do list starts writing itself.

**Expectations:** one action per clip, 4–6 shots; a verbatim style block repeated in every prompt;
camera stated explicitly; palette written as a restriction; negatives include text/captions/logos;
the *precision* work (list text, counters, stamp) explicitly moved to the coded/edit layer;
IN-EDIT notes per shot; loop strategy named; fallbacks for risky shots.
**Fails if:** prompts contain on-screen text requests, multiple actions per clip, or no continuity kit.

### 6 — Seamless loop
> Make a loop I can post that's about waiting for a page to load.

**Expectations:** frame N == frame 0 by construction — modulo clock, no accumulated state, seeded
randomness reset at cycle start; loop strategy named; a note that the loop was verified across ≥3
cycles; ideally the narrative loop where the release becomes the hook.
**Fails if:** it uses `x += v`, leaves canvas trails across the seam, or claims seamlessness without
a verification step.

### 7 — Aspect adaptation
> I have this 16:9 animation. Make it work for TikTok.

**Expectations:** re-blocking, not cropping — escalation axis re-chosen for the vertical frame,
positions re-derived from the stage constants, type re-sized, safe areas applied (top ~180px,
bottom ~420px, right ~160px on a 1080×1920 stage), beats and clock unchanged.
**Fails if:** it scales the canvas, sets `object-fit: cover`, or only changes the viewport meta.

### 8 — Script adaptation
> Here's a script beat: "I finally organized my whole garage. Then I bought a second garage."
> Turn it into something animated.

**Expectations:** the dialogue is deleted and rebuilt as physical events; at most one line of text,
at the release; one idea selected if the beat contains several, with the discard stated; 5–30s scope
with the cut in scope named as a choice.
**Fails if:** it animates a character *saying* the line, or keeps the joke purely verbal.

### 9 — The randomness trap
> Make it really random and chaotic — like, anything can happen.

**Expectations:** pushes back in a sentence or two — absurdity is a wrong rule followed correctly,
randomness has nothing to subvert — then delivers chaos *with* a rule (one law broken, escalating
hard), so the user gets the energy they asked for without the incoherence. Proceeds; doesn't stall.
**Fails if:** it delivers unrelated events in sequence, or refuses to build anything.

### 10 — The two-idea trap
> I want a 15-second piece about how AI is making everyone lazy AND how nobody proofreads anymore.

**Expectations:** names the two ideas, picks one (with a reason), proposes the other as a second
piece, and ships the one. The One Idea rule applied out loud.
**Fails if:** it crams both in, or asks which one and stops without delivering anything.

### 11 — The verbal-explanation trap
> Animate this: "attention is the only real currency."

**Expectations:** refuses to put the sentence on screen as the mechanism; finds the physical
staging (attention with mass, a price, a queue, a meter, a transaction); the abstract noun becomes
an object with behavior; text at most at the release.
**Fails if:** the piece is the sentence typing itself, or kinetic typography carrying the idea.

### 12 — Ambiguous trigger
> This is funny — my dog waits by the door ten minutes before I get home, every day.

**Expectations:** the skill triggers on an observation with no animation verb; offers the piece
(intake gate filled in from the observation, a proposed flip) rather than just agreeing it's funny.
Reads the room: proposes, doesn't dump 400 lines of code unasked.
**Fails if:** it replies conversationally with no motion thinking at all, or ignores the creative
opportunity entirely.

---

## Trigger test (description quality)

Run these with the skill installed and check whether it loads. Target: **all seven** load it.

1. "make this move"
2. "can you visualize this for me"
3. "what would this look like as a clip"
4. "I need a 6 second loop for the feed"
5. "break this into shots"
6. "write me Veo prompts for a 10 second thing"
7. "make the square version of this"

## Negative control (should NOT load, or should load and stay out of the way)

1. "Fix the CSS on this landing page so the header stops jumping."
2. "Summarize this episode transcript."
3. "Write an X post about tonight's drop." *(this is `stoo-voice` / `stoopid-episode` territory)*

A skill that fires on all three is over-triggering; the cost is a worse answer to a non-animation
question. If control 3 loads this skill *instead of* the voice skills, tighten the description.

---

## What "meaningfully different from vanilla" means here

Generic Claude, given prompt 1, reliably produces: a bell icon, CSS keyframes, a caption of the
joke, pastel colors, and no flip. The differences worth measuring:

| Vanilla behavior | Skill behavior |
|---|---|
| Starts coding immediately | States the intake gate first, then builds |
| Idea stated in a caption | Idea staged as a physical event |
| "Animation" = things fading and sliding in | Weight, anticipation, holds, one long flip hold |
| Random cute details | One changed rule, escalated on one axis |
| Ends by repeating the opening | Ends on a flip the viewer resolves themselves |
| Generic web colors and fonts | SIGNAL palette with orange rationed to the flip |
| Aspect change = crop | Aspect change = re-blocking |
| Video prompts = one paragraph of adjectives | Per-shot sheet, continuity kit, precision moved to code |
| Silent about limits | Says what it cut, what's schematic, what needs a real figure |

---

> **[CREATOR INPUT NEEDED]** — after the first real runs: record which prompts produced output Dev
> would actually post, and which produced something technically correct but off-voice. Off-voice
> passes are the most useful signal for revising `creative-dna.md`.
