# plan 0.4.0 — surface unfold

## goal

The selected body's surface must leave the screen through the ground edge and come back from it.
Nothing of the surface, and none of its cut, may ever appear in the middle of the screen.

Two rules, in order:

1. a body that is the ground in one state and not in the other always travels through the screen
   edge: current appearance → half-covered disk at the edge → unrolled line (and the reverse).
2. the line is the body's perimeter, at constant arc length = W, never a stretched copy of the
   icon. Its cut point lives outside the screen until the two line ends reach the screen corners.

## why not a per-sample lerp

Blending each silhouette sample from its circle position to its slot on the line opens the closed
loop immediately: the two samples either side of the cut separate at once and travel to opposite
screen edges, so mid-morph the curve spans the whole width while its two ends sit inside the
viewport. The soil ribbon closes across that gap, so a screen-wide slab of soil appears in the
middle of the frame and the stroke ends in mid-air — a break line. Both disappear if the loop is
opened *at the screen edge* instead: the surface is a circular arc that flattens, and its cut is
kept beyond the edge until it is at the corners.

## geometry

Per state: `W`, `H`, `xoff`, `dirY` (+1 planet, −1 star/moon), `soilH = 0.1 H`,
`edgeY = H` for planets, `0` for star/moon, `yline` (final ground line: `H − soilH` / `soilH`).

Disk radius, the same rule the wrap already uses for x (perimeter = screen width):

	Rg = W / (2π)

Unfold parameter `e` in [0,1], arc parameter `u` in [−W/2, W/2] (arc length, so the mapping is
isometric for any `e`):

	phi  = 2π (1 − e)                     curvature: closed circle -> straight line
	rho  = W / phi                        (rho -> infinity at e = 1)
	x(u) = xoff + rho * sin(u / rho)
	y(u) = yline(e) + dirY * rho * (1 − cos(u / rho))
	yline(e) = (edgeY − dirY * Rg) + (yline − (edgeY − dirY * Rg)) * e

At `e = 0` this is exactly the disk of radius `Rg` centred on the ground edge: half of it is off
screen and exactly half of the perimeter (π·Rg = W/2) is visible — the half-covered body. At
`e = 1` it is the straight ground line, one full period wide, matching the steady state.

The two ends `u = ±W/2` are the cut. At `e = 0` they meet at the far side of the disk, `2·Rg`
beyond the edge. They rise toward `yline` while moving toward the corners, so they are outside the
view until the end; when an end first crosses back inside it is `4·soilH² / (3W)` from a corner
(7 px at 1200x800, 26 px at 420x900) and it is inside the soil, under the fill.

## sink phase (both directions)

Half-covered is the handover point between two straight-line animations, both in screen space:

- sink: radius `R_flat → Rg`, centre from the body's position in the other state to
  `(xoff, edgeY)`. The start appearance is whatever the body already looks like there — a true-size
  flat disk (flat state) or an icon circle (wrap state) — which is the same invariant the icon
  collapse already guarantees, so there is no extra case.
- unfold: the arc family above, from that half-covered disk to the line.
- departure is the same two paths run backwards: line → fold → half-covered disk → fly to the
  appearance the body has in the destination state.

Camera pan is a separate feature; the sink starts at the current unpanned body position.

## timing and controls

3 s total, `PROJ_DUR` unchanged. Sink and unfold each use smoothstep. The sink share is
adjustable from 10% to 70%, default 35%; departure follows the same path in reverse.
The sky can blend over the whole transition or wait for the initial sink-duration interval.
Soil crossfades from body colour starting either at the sink or at the unfold, reaching full soil
halfway through the unfold. The line can be drawn under or over the fill. Timing and soil choices
are captured at transition start; stroke order changes immediately. Replay resets to the flat view
and starts a transition to the selected body. Selection changes during a transition are queued,
with the latest choice winning, so an interrupted surface never jumps to a different arc.

## rendering

The sink is a closed disk, clipped by the viewport. During the unfold the curve is closed to the
ground edge for filling; the closing edge is never stroked. Three copies cover the periodic seam.
Body colour is opaque under the soil overlay throughout the crossfade.

## invariants (the smoke asserts these)

	arc length                     W ± 0.1 at every e
	sample gap                     <= W/(N-1) + 0.1 (4.7 px at W=1200): no chord
	visible run                    one contiguous block at every e
	cut inside the viewport        0 frames with |x_end| < W/2 - 30 before e = 0.97
	fill closing edge              inside the viewport: <= soilH above the edge, never W wide
	visible arc at e = 0           pi*Rg = W/2 ± 1
	half-cover                     disk centre y = edgeY ± 1 px at the sink/unfold handover
	steady state                   line spans W, band 10vh, existing 0.1.0 numbers unchanged

## files

- `surface.js`: sink/unfold geometry, sky and soil timing.
- `settings.js`, `index.html`: controls and replay.
- `projection.js`: transition timing and latest-choice queue.
- `render.js`: surface fill and configurable stroke ordering.
- `experiments/smoke.js`, `experiments/surface-smoke.js`: projection, geometry and control checks.

## validation

- `node --check` on touched JavaScript files; run both smoke scripts.
- Manual: compare both sky and soil choices and stroke order using Replay; vary the split.
- Manual: test planet, moon and star, wrap-to-wrap, toggle mid-transition and resize mid-unfold.
- Camera pan and its interaction with the transition remain in plan 0.3.

## open decisions

- whether a very narrow window should clamp the band so the ends stay further from the corners.
