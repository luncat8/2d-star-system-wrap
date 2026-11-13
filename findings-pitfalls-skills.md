# findings

## wrap/cylindrical projection continuity (plan 0.1)

- lifted x = theta*W/TAU is periodic. draw every element at x-W, x, x+W and exact-W jumps
  (atan2 seam, lap drift) become invisible. copy offset = (c - (copies-1)/2)*w:
  the naive (c-1)*w puts the single flat-mode copy one screen left — nothing renders,
  and a math-only smoke never sees it (positions mod W are still correct).
- never choose the wrap lap per-point per-frame (round-to-nearest of src vs dst x):
  the branch flips mid-transition and screen sides exchange — the draft's "cross-direction X"
  bug. choose the lap once at transition start (short arc from the element's current screen x),
  then track the bearing unwrapped per element per frame.
- unwrap with d -= TAU*round(d/TAU). single `if (d > PI) d -= TAU` correction fails when
  |d| > 3*PI — a tracker 2 laps below principal (an orbiting moon after seconds of steady wrap)
  pops a full 2PI when it crosses the atan2 seam.
- log-polar of any curve passing through the pole is degenerate: bearing flips PI within a frame
  at the crossing → x whips ~W/2. selected body's own orbit: give it an analytic buried
  representation (line one soil-depth under the surface) instead of tracking. other orbits the
  pole crosses over time: flag samples with d < ~1.2*rc singular, clamp under the soil, skip in
  the polyline. both cases are hidden behind the soil band in steady state.
- ground-line <-> icon handover without a pop: (1) silhouette samples of a body that is not the
  state's ground must collapse exactly onto its icon circle in that state, (2) drive soil offset,
  soil<->body color crossfade and icon alpha from one band factor in [0,1]. at band=0 the
  silhouette IS the icon circle and the flat disk at the same time.
- own-silhouette line: space samples at W/(N-1) (not W/N) so the last point lands exactly one
  period from the first — adjacent copies' ribbons meet with no hairline gap at the seam.

## vm smoke pattern for no-build canvas pages

- concat index.html's <script src> files in order into ONE vm.runInContext script with an
  epilogue `globalThis.__api = {...}` — top-level const/let in vm are context-lexical,
  NOT sandbox properties, so exports must be explicit.
- stub: document.getElementById -> element table; canvas ctx -> object of no-op methods +
  settable props; requestAnimationFrame -> capture callback, drive manually with fake ts.
- run the concatenated page scripts with a leading `"use strict";`: the page is classic non-strict
  js, so a missing `let` silently creates a global and a math test never sees it. strict turns it
  into a ReferenceError at the first render call.
- continuity assertion that catches seam/lap bugs: per-element per-frame periodic screen delta
  < 0.25 screen; skip samples flagged singular or invisible (garbage x by design).
- ascii-dump projected positions (grid of chars, 3 copies + relift like the renderer): catches
  draw-transform and coverage bugs the numeric checks can't see. cheap, no browser needed.

## seam coverage vs polyline breaking

- breaking a polyline where screen x jumps (|dx| > 0.25W) hides the seam for curves and does
  nothing for the bodies: a single-copy azimuth map makes an icon teleport a full W at the seam
  (measured 0.9997W with 10 bodies). the same break leaves a visible gap in any orbit that
  crosses the seam mid-screen.
- draw x−W, x, x+W and relift instead: the seam becomes an exact-W translate, and the same copies
  let the flat state draw only its central copy. keep polyline breaking for samples that are
  singular by design (pole crossings), where the gap sits behind the soil.
- the shortest arc must be chosen once per element at transition start, not per frame from the
  current x: per-frame choice flips when the two states are near antipodal and the sides exchange
  mid-morph (measured 0.3853W per frame at t=0.46 on all ordered pair sweep).
- copies cost 3x draw calls on sampled curves only; measure before optimizing it away
  (2.7 ms/frame in the vm harness: 12 bodies, 128-sample orbits, 256-sample silhouettes).

## high-dpi

- clamp devicePixelRatio to 2 for the backing store. fill scales with dpr^2 and the scene draws
  three copies of every sampled curve; a 3x screen is 2.25x the fill of a 2x one for no visible
  gain at 1 px orbits and 2 px stars.

## log view: the scale is a fit, not a constant

- a fixed scale (e.g. one circumference = W) makes every other decision wrong: in a
  follow view the far bodies sit s·log(d/r) above the ground line and leave the screen
  top; in an empty-space drag the same scale deep-zooms toward the grabbed patch and
  the whole system is off-screen ("nothing good at all").
- fit instead: s = (G−T)·H / max(log(Rfar/ref), 0.2) — ref at the anchor/ground line,
  Rfar (farthest surface extent from the pole) at the top margin. re-fit live per frame
  so a moving followed body keeps the whole system in view; the cost is one 13-body loop.
- the drag's mid path is what reveals a bad zoom law: interpolating the scale in log
  space (sqrt(s0·s1) mid) leaves the visible log ring too narrow — the system sits in
  the gap below the screen for half the gesture. lerp the zoom density 1/s linearly:
  the ring widens steadily onto the system and every body stays on screen.
- a body anchor must track a surface point (top of the disk), not the grab point:
  the grab sits at |A−c|, which is 0 for a centre grab (log(0) in the anchoring) and
  ≠ the reference distance otherwise. the surface point is also the click-follow anchor,
  so drag and click end at the same view.
- a body whose disk contains the pole may legitimately sit below the ground line
  (buried centre, fill below its surface curve) — assertions must skip it, not fail.

## drag: camera pan, not a scrub

- a drag must work from any point on the canvas, not only on a body: a gesture that needs a hit
  target is undiscoverable, and the morph already has a timer. press + no movement = the click.
- do not ease the offset while the pointer is down (the view lags the finger); track 1:1 and carry
  the release velocity out with a decay. that is what "smooth" means for direct manipulation.
- keep the offset in the projection state, not in a global: transitions then interpolate it like
  any other projected component, and every state starts at pan 0, so a tap recentres on its own.
- in wrap the x offset is a rotation (period W, no clamp); y stays 0 — the ground line is pinned to
  a screen side by the projection, so a vertical pan has nothing to move.
- with 3-copy drawing, pan periodically: offset the copy loop by pan mod W. widening the copy count
  to cover a large offset doubles the draw cost for nothing.
- a scrubbed morph (drag distance = morph progress) is the alternative. rejected: it needs a hit
  target and it fights the timer; the projection is a view, not a manipulator.

## surface unfold (design, plan 0.4.0)

- requirement: the ground surface enters and leaves through the screen edge, and the perimeter's
  cut is never inside the viewport.
- a per-sample lerp from the icon circle to the line opens the loop at once: mid-morph the curve
  spans the width while its ends are inside the view (measured 602 px closing chord at t = 0.5,
  y span 4 px), so the ribbon fill closes across the screen — a soil slab and a break line.
- instead keep arc length constant = W and let curvature go to zero: `rho = W/phi`, `phi = 2π(1−e)`,
  `x = xoff + rho sin(u/rho)`, `y = yline + dir·rho (1 − cos(u/rho))`, `u` in [−W/2, W/2]. at e = 0
  it is a circle, at e = 1 a straight line, and the mapping is isometric at every e.
- with `Rg = W/(2π)` the half-covered disk (centre on the edge) shows exactly half the perimeter,
  π·Rg = W/2: the handover point between "sink to the edge" and "unfold" is exact, not tuned.
- the cut is the pair of ends `u = ±W/2`: 2·Rg beyond the edge at e = 0, reaching the screen corners
  only at e = 1. when an end first comes back into view it is `4·soilH²/(3W)` from a corner
  (7 px at 1200x800), inside the soil fill.
- fill the visible run plus the two points on the edge, and stroke the visible run only: the
  closing edge must never be drawn, or the slab comes back.

## underground: log depth needs a fixed horizon

- a log-radius map already gives the wanted underground scale: px/km = s/d grows with depth, so
  deep layers get hundreds of pixels and a surface layer a hairline. no second projection is needed;
  only the followed body's surface line has to move up to expose the strip below it.
- pin the surface line as a screen fraction (0.62 H), not a fixed number of visible decades:
  a fixed decade count moves the line with Rfar and the horizon drifts while the body orbits.
  the depth span then varies per body (2.4 e-folds for the star, 3.6 for a small moon).
- layers as nested enclosing-sphere fills: fill inside the outermost boundary, then inside each
  deeper boundary, outermost first. every deeper sphere is inside the previous one, so no clipping;
  skip a sphere that does not contain the pole.
- label a band only when >= 14 px of it are visible (11 px text). a realistic crust is ~1 px at
  any useful depth span, so the top band stays unlabelled by design; a dark strokeText halo keeps
  the names readable on both dark and bright band colours.
- the surface is the log origin both ways; draw the atmosphere as the band between its outer and
  the surface enclosing curves. filling the air sphere and painting the body over it costs another
  full-height interior fill for a 30 px strip.
- a realistic atmosphere (100 km) is ~2 px on this scale. pick the band height from the log
  position you want to debug, not from a screen-space minimum, or the top edge stops matching the
  geometry below it.

## fit: a per-frame fit pumps with the orbits

- recomputing the fitted span every frame makes the zoom breathe at the orbit period: following
  Earth, the raw fitted scale swings 10 % over 30 s. sample the target every ~400 ms and ease the
  span with a time-based EMA (dt clamped, so a tab switch does not jump).
- use an asymmetric rate: fast when the span must grow (a receding body is fitted at once), a long
  hold for small overshoots (an orbit-sized swing is not worth following), and a fast close when
  the span is far too wide (>15 %), so flying back into the system still refits quickly.
- the held span sits at the widest recent requirement: top margin has slack, nothing clips, and
  the visible scale variation drops from 10 % to 2.4 % per minute.
- seed the damped span from the follow transition's end scale; otherwise the handover from the
  timed interpolation to the steady camera jumps by one EMA step.

## log view: the orbit of the body under the pole is not drawable

- a followed body's centre is a point of its own orbit, and the pole is the log origin: the image
  of a circle through the pole whips a whole period along the surface line and leaves the top arc
  in two near-vertical strokes. measured on a follow of earth: 125 px between the drawn polyline
  and the curve, 330 px jumps between adjacent samples, streaks over the whole sky.
- no sampling can fix a singularity. skip the orbit of the body whose disk contains the pole — the
  same index that already selects the interior cutaway — and keep every other orbit: they only
  touch the pole at their closest approach, where the image has a cusp.
- a smoke that renders and compares positions finds this cheaply: patch the global `renderCurve`
  inside the sandbox and record its arguments, then assert the parent/radius pair is absent.

## frame cost: measure in the page's realm, not inside a vm context

- a `vm.createContext` sandbox routes every global lookup through a named-property interceptor:
  `Math.cos` went from 25 to 215 ns, and the same 14 ms frame measured 0.8 ms once the sources
  were concatenated into one `new Function` body in the main realm. attribution inside a vm is
  usable, absolute numbers are not.
- concat the index.html scripts, append `;return { ... }` and call it with `document`, `window`,
  `requestAnimationFrame` as parameters. top-level `const`/`function` become function locals, and
  `typeof module` stays undefined so the node guards are skipped.
- two of the numbers that matter cannot be seen in node at all: path points per frame (issued
  `lineTo` calls) and filled area (shoelace over the fill path, before clipping). log both.

## log view: sample counts belong to the projection, not to a constant

- a constant 256 samples is 7x too many for the overview (3-4 px bodies) and 3x too many for a
  follow view (most bodies under 20 px), and it is what the frame spent most of its time on.
- derive the count from the projected extent, `span = max(2·s·asin(r/D), s·log((D+r)/(D-r)))`,
  and a chord budget, `n = π/acos(1 - e/(span/2))`. snap `n` to a power-of-two divisor of the
  table size so the table index of a sample stays exact (`CURVE_N / stride`).
- the box-based estimate misses cusps (a cusp is sharper than a circle of the same diameter):
  0.25 px budget gave 1.3 px worst case on a 20 % alpha orbit line. acceptable; state it.
- tabled `cos`/`sin` per sample index turns a sample into atan2 + log + sqrt. `Math.hypot` is
  3-4x `Math.sqrt(a*a + b*b)` and the coordinates are world units, so the square is safe.

## nested interior fills repaint the frame once per band

- filling each band from its own boundary to the bottom edge paints 0.38 H of screen once per
  band: 1.2 screens of raster per frame for a 0.38 H image.
- fill the strip between the band boundary and the next one, as the atmosphere band already did.
  same pixels, same colours, a third of the raster. a band whose inner sphere does not contain
  the pole has no lower half plane — that band runs to the bottom edge like the deepest one.
- the same merge works for wrap copies: every visible lap as a subpath of one path means one
  fill/stroke per curve instead of one per lap, and touching laps are not blended twice at the seam.
