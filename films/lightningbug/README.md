# THE LIFE OF A LIGHTNING BUG

A 24-second hand-drawn film in the fruit-fly look: ink on warm paper, hatching
along every form, thin blue construction lines, chalk-on-navy blueprint
interludes. 288 frames drawn on twos at 12 fps, out at 24, 1080×1920.

A firefly spends its whole life sending a signal and waiting for an answer.
Then we turn the porch light on.

Built with `.claude/skills/hand-drawn-canvas-animation/`, styled off that
skill's fruit-fly reference (`references/reference-films.md`).

## The shots

| t | scene | what it shows |
|---|---|---|
| 0.0 | dusk | a lightning bug on a grass blade, lantern idling, construction ring around him |
| 1.5 | blot | a bristly ink blob wipes the shot over to its chalk render |
| 2.0 | chemistry | two reagents drift together and burst. No heat marks — that is the point |
| 3.5 | eggs | underground. A clutch self-draws, and every egg is already faintly lit |
| 5.0 | glowworm | the larva crawls a soil line toward a snail shell, tail lit, camera following |
| 7.0 | pupa | one white frame, then a chalk spiral |
| 7.5 | emerge | wing cases lift, wings unfold, the lamp comes on for the first time |
| 9.0 | code | he flashes from the air, she answers from a blade on a fixed delay |
| 11.5 | codecard | the same exchange as dashes on two lines, the delay bracketed |
| 12.0 | fatale | a third light answers with the right code. It is not her. Snap |
| 14.5 | field | a whole field of them, half of it falling into sync as the camera pulls back |
| 17.0 | porch | a hard wedge of porch light floods in and washes the signal out |
| 19.5 | stubborn | one bug on the edge of the glare, still flashing into it |
| 21.5 | sign-off | SIGNAL / RECEIVED |

**Anchor** (skill rule 11): the lantern. The yellow-green glow is in all 288
frames — as the reaction, the egg, the larva's tail, the adult's lamp, and last
as the one light still going. It takes its two inks once from `paperInk` so it
stays the same colour in the shots where the palette changes underneath it.

## What's true in it

- Firefly light is a chemical reaction that runs at almost no waste heat. The
  chemistry shot has no heat marks on purpose.
- The larvae glow too — they're called glowworms, and they hunt snails.
- The flash is a species-specific code, and the female's answer comes after a
  set delay. That delay is what the blueprint card diagrams.
- *Photuris* females mimic another species' answer code to lure males in and
  eat them. That's the fatale shot, and it isn't embellished.
- Light pollution drowns the signal out. That's the porch.

## No text

Nothing on screen but the sign-off. The blueprint interludes explain with
lines, the way the reference film does — which is the skill's checklist rule
this repo's other film deliberately broke. This one doesn't.

## Rendering

```sh
node pwrender.mjs lightningbug.html --grid 24     # look at this first
node pwrender.mjs lightningbug.html --only 0,120  # spot frames, full size
node pwrender.mjs lightningbug.html               # mp4 + contact sheet + score
```

`pwrender.mjs` is the container-only driver (see `films/lightspeed/README.md`
for why). On a normal machine use the skill's own `scripts/render.mjs`.
Captions need a handwriting font installed or they fall back to a serif.
