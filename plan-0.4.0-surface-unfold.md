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

Both endpoints carry the state's pan, so a panned flat view sinks from where it is and arrives at
the screen edge.

## timing

3 s total, `PROJ_DUR` unchanged. Ground path stages on its own schedule:

	sink   t in [0.00, 0.35]   smoothstep
	unfold t in [0.35, 1.00]   smoothstep
	departure: fold [0.00, 0.55], fly out [0.55, 1.00]

The sky keeps its current blend across the whole 3 s, so the world recedes while the surface is
still approaching, and the horizon opens into an already-wrapped sky.

## rendering

- fill: the visible run of the curve plus the two points where it leaves the screen edge; closed
  along the edge, never along a chord between the ends. At `e = 1` this is identical to the current
  10vh band, so the steady state does not change.
- stroke: the same visible run only. The closing edge is never stroked.
- soil/body crossfade: band 0 during the sink, 0 → 1 over the first half of the unfold — the body
  face becomes soil exactly while it turns into the horizon.
- three copies stay: the curve is one period wide, and its ends are the copies' seam.

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

- `surface.js` (new, owns the sink/unfold/fold geometry and the schedule):
  edit for the arc family, timing, edge hiding.
- `projection.js`: a ground body's silhouette comes from `surface.js` for the transition, from the
  existing line/disk code in the steady states. No new projection formulas. Stays under 500 lines.
- `render.js`: ground fill closes on the screen edge, stroke only on the visible run.
- `experiments/smoke.js`: the invariants above.
- `main.js`, `index.html`: load `surface.js` after `projection.js`.

## validation

- L0: `node --check` on every touched file.
- L1: the invariant table above, swept over `e` in 100 steps, for a planet and a star ground, at
  1200x800 and at 420x900.
- L1: existing scenarios (flat→wrap, wrap→wrap, retarget, queue, wrap→flat) still pass with the
  same continuity numbers, max 0.0168 W against the 0.25 limit.
- L1: no frame has a ground-curve chord longer than `soilH` inside the viewport.
- L2: ascii dump of five frames through flat→wrap(earth) and wrap(earth)→wrap(luna): the dome
  must widen monotonically and the line must arrive flat at the edge.
- manual: click Earth from flat (dome rises out of the bottom edge, opens left and right, no slab,
  no diagonal); click a moon and the sun (mirrored at the top); wrap→wrap (one surface folds back
  into the bottom edge while the other opens at the top); toggle the checkbox mid-morph; resize
  mid-unfold; pan, then click a body.

## open decisions

- exact stage split (0.35) and whether the sky should wait for the unfold to start.
- soil colour during the sink: body colour until the unfold, or start the crossfade in the sink.
- whether the stroke should be drawn over the fill (a crisp surface line) or under it (today's look).
- whether a very narrow window should clamp the band so the ends stay further from the corners.
