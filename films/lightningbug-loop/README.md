# THE LIFE OF A LIGHTNING BUG — 27 s loop

A diagram that learned how to feel. 1080×1080, 27.0 s, 324 frames drawn on
twos at 12 fps and packed out at 24. One canvas, every frame computed in
JavaScript, score synthesized in code against the same cut list. No sprites,
no video, no base64.

**Set it to repeat.** 27.0 cuts back onto 0.0.

## Two languages, cut hard

**Paper plates** — cream stock, brown ink that doubles and misses register,
directional hatching instead of gradients, faint construction arcs that run
off the form, wide diagonal dusk stripes. Grain reseeds every drawn frame.

**Navy plates** — near-black indigo, thin lavender linework, hex lattices,
measurement ticks and lab brackets. Grain holds almost still.

**Overlay language** — thin chartreuse rings, arcs and guide lines laid on top
of the illustration to mark photons, flash codes and chemical yield.

Palette is dusk paper: wet-soil umber, leaf sage, cream, dusty rose twilight,
and a single hot chartreuse. That accent is the magenta of the reference — it
appears only when something ignites. One exception, used once: the red of the
wrong answer at 18.0.

## The cut list

| t | mode | plate |
|---|---|---|
| 0.00 | paper | cold open. The adult, huge, on one blade of timothy. One dew bead |
| 1.25 | navy | smash cut. A photon is born |
| 2.00 | navy | the egg: lattice sphere, double outline, two nuclei that divide to four. Soil-horizon ticks, a lab bracket. The sphere glows dimly on its own |
| 6.00 | navy | push in, lattice to stipple, chartreuse splits the shell |
| 7.00 | paper | the glowworm takes a snail. Overlapping armour, a lantern already burning at the tail |
| 9.00 | navy | pupa: a soil chamber rewriting its own wiring. The future lantern lights as two stacked nodes |
| 10.00 | paper | the teneral adult beside the split pupal skin. Wings soft, one weak pulse |
| 12.00 | paper | **macro: the lantern as a floor of photocyte tiles.** This is the shot the compound eye gets in the reference |
| 13.00 | navy | cross-section: four wells feeding one chamber, fibre bundles up the abdomen |
| 14.00 | paper | first flight over the meadow plate. Moss, a snail shell, clover, a fallen petal |
| 16.00 | paper | pull back. The meadow is a dark bowl and the hero is small |
| 18.00 | paper | a wrong answer — too soon, too bright. Red arcs, a red arrow, no gore |
| 19.00 | paper | courtship. He draws a J of light; she answers with one delayed blink |
| 21.00 | paper | she lays a row of pale spheres. Each takes the glow on the way out |
| 23.00 | paper | night count. Tallies cut into a fence post — nights, not days |
| 24.50 | paper | false dawn. A dew bead acts as a fisheye holding an inherited glow |
| 26.00 | navy | back to the egg, two nuclei lit. The cut matches frame 0 |

Every cut lands on the 1/12 s grid. Shots run 0.75–2.0 s except the egg, which
is staged internally (draw-on, nuclei, division, stipple) so 4 s never sits.

## The anchor

The lantern. It takes the role the compound eye and the flight arcs play in
the reference — it gets the macro mosaic, the system diagram and the whole
annotation language, and it is in all 324 frames: as the photon, the egg's own
dim light, the larva's tail, the pupa's two nodes, the first weak pulse, the
J, the eggs leaving her, and the two nuclei at the end.

Light pops on ones — three drawn frames, never a fade. A flash is a ring that
expands and dies, never a streak. Wings buzz on twos.

## Sound

Low soil drone under the navy plates, a dry plucked figure on the paper
plates, every lantern pulse a sine that blooms and dies under 200 ms,
courtship as a falling phrase then one answering tick. The final beat reuses
the opening photon tone so the ear accepts the loop.

## Rendering

```sh
node pwrender.mjs lightningbug27.html --grid 24 --ar 1:1   # look at this first
node pwrender.mjs lightningbug27.html --ar 1:1             # mp4 + contact sheet + score
```

`pwrender.mjs` is the container-only driver; see `films/lightspeed/README.md`.
On a normal machine use the skill's own `scripts/render.mjs`.
