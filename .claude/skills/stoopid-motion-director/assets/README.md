# assets/

Shared material for pieces built with this skill. Artifacts ship as **one self-contained file**,
so treat these as sources to copy from, not runtime dependencies.

| File | What it is |
|---|---|
| `visual-tokens.json` | Palette (with meanings), type stack, aspect specs and safe areas, timing/easing numbers, physics values, texture limits, control defaults, beat budgets. The single source for values quoted across the reference files. |
| `ui-kit.svg` | Generic system-chrome sprite — dialog, progress bar, checkbox, toggle, cursor, spinner, now-serving ticket, form row, stamp frame, document label. For the "cheap system dialog appearing inside reality" register. Strokes use `currentColor`, so the piece sets the palette. |

## Deliberately missing

**No STOOPID wordmark, logo, or Eye mark.** Those are real brand assets, and a plausible-looking
reconstruction would be worse than none — it would end up in a published piece.

> **[CREATOR INPUT NEEDED]** — drop the real files in here when convenient:
> - `stoopid-logo.svg` — the wordmark as used on SIGNAL-layer (digital/video) pieces.
> - Any lower-third, endcard, or bumper furniture that should appear on every piece.
> - Note the two-layer rule from the brand system: the Eye mark is the ARTIFACT layer and does
>   **not** belong on `@xbSTOOPID` output, so label whatever lands here with where it may be used.
>
> Until then, pieces use the `@stoopidshow` mono watermark and corner brackets, which are already
> house practice in the toolkit artifacts.
