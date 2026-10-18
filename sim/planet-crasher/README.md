# PLANET CRASHER — source

VAULT item 035. Published as `../../stoopid_planet_crasher.html` (one self-contained file, three.js inlined, nothing loads from a CDN).

```
npm install
npm run dev      # live dev server
npm run build    # single-file build, copied to the repo root
npm run snapshot -- --scn moon --t 7,10,16,26 --n 1024   # headless stills + numbers
npm run e2e      # UI smoke test: launch, verdict card, hide-UI, phone layout
```

Snapshot extras: `--energy 1` prints an energy audit at each time, `--q "zn=0.2&zt=0.05&mu=0.3"` overrides normal damping (`zn`), sliding damping (`zt`) and the friction cap (`mu`) for tuning.

## How the physics works

- **Every planet is particles.** A planet is the N points of a hexagonal close-packed lattice nearest its centre, layered by depth: iron core, rock mantle, then a surface shell of land / ocean / ice / desert drawn from smooth noise (`src/planets.js`).
- **Gravity is exact.** Each particle sums the pull of every other particle on the GPU (direct N-body, O(N²), Plummer-softened at half a particle). Units: G = 1, the target has mass 1 and radius 1.
- **Contact is a damped spring.** Overlapping particles push apart with a spring that stiffens as it's crushed, plus light damping and capped sliding friction. Repulsion only, so nothing is glued. Damping and friction are kept low because molten planets behave like fluids: with stickier settings Theia's debris got swallowed instead of reaching orbit. All pairs share one contact period of 24 steps; the step size is set from the impact speed so a particle moves at most 15% of its width per step (`src/sim.js`).
- **Vapour pushes.** Material heated past full vaporization gets an ideal-gas pressure (energy-conserving SPH form, cubic-spline kernel). Expansion work comes out of its heat and compression puts heat back. The effect is real but modest: a head-on twin collision at 3.6× escape speed kept 68% of the mass in one piece without it and 60% with it. (OBLITERATE uses 6×.)
- **The glow is real heat.** Energy the damping removes from the motion is added to the particles as heat. An energy audit (`PC.energy()` in the console) shows kinetic + gravitational + heat holding steady through impact to within about 1%. After that, heat radiates away with a 30-unit time constant (about 7 hours for Earth), which is the one deliberate leak. Heat is turned into kelvin with rock-like heat capacity and latent heats for melting and vaporizing, then into blackbody colour.
- **The approach is exact too.** The two-body problem is integrated backwards from the moment of contact, so the impactor arrives at the chosen speed (in multiples of mutual escape speed) and angle.
- **The outcome is measured, not scripted.** Every ten frames the state is read back and clumped (friends-of-friends). The HUD reports the largest remnant, debris bound in orbit around it, debris leaving for good, and the hottest 1%. The verdict uses the Leinhardt & Stewart outcome regimes (merger, partial accretion, hit-and-run, erosion, super-catastrophic disruption) plus "debris disk" when more than 0.4% of the mass stays in orbit.
- **Real units** come from the target's real mass and radius: speeds in km/s, time in hours, energy in joules and Chicxulubs (4.2×10²³ J).

## Limits (on purpose, or because of the particle count)

- The smallest thing it can resolve is one particle: about 1,000 km across at 4K particles on Earth. "Asteroid" is really a small moon.
- Particles are a granular stand-in for rock and water. The only pressure besides contact is the vapour term, every material uses rock's heat capacities (hot water glows like hot rock), and cooling is a simple exponential, so it's qualitatively right and quantitatively loose. Real giant-impact work uses SPH with millions of particles and proper equations of state.
- Results it reproduces at 2K particles: Make the Moon ends as a merged Earth with ~2% of the mass in an orbiting disk (the canonical result is about 2%). Hit-and-Run keeps the impactor going. A head-on twin at 6× escape speed erodes the target to about a quarter of the combined mass.
- Cost grows with N²: 16K particles needs a strong desktop GPU.
- Needs WebGL2 with floating-point render targets (almost every desktop browser, most recent phones).

## Files

| File | What |
|---|---|
| `src/sim.js` | GPU ping-pong integrator, materials table, readback |
| `src/planets.js` | planet / impactor recipes, lattice builder, two-body approach, packing |
| `src/render.js` | sphere-impostor particles with heat glow, sky, stars, sun, atmosphere, aim line |
| `src/analysis.js` | friends-of-friends clumps, bound / escaping debris, outcome classes |
| `src/audio.js` | synthesized room tone, launch, impact, heating rumble |
| `src/verdicts.js` | the Court of Physics |
| `src/main.js` | scene, UI, crash lifecycle, HUD, snap / record, test hooks (`window.PC`) |
| `scripts/` | publish to repo root, headless snapshots, UI smoke test |
