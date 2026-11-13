# plan 0.6.0 — underground scale

## goal

A followed body shows its interior below the surface. The vertical scale is relative to the
surface: distance from the body centre is logarithmic, so the pixel scale per kilometre grows with
depth. Surface layers compress into a hairline, deep layers get hundreds of pixels. Named layers
make that scale visible and give the projection a reference to debug.

## projection

The logarithmic camera already maps the distance `d` from the pole to `y = oy − s log d`. Put the
pole at the followed body's centre and the surface (`d = R`) on a screen line; below it,

	depth in log units = log(R / d),  pixels = s · log(R / d)

so depth is almost linear in radius near the surface and accelerates toward the centre, and the
scale `s/d` grows with depth. No second projection is needed — the underground is the same map.

The surface line of a followed body is `GROUND_BODY = 0.62 H`, leaving `0.38 H` for the interior.
The sky is fitted above it:

	s = (GROUND_BODY − TOP) · H / max(log(Rfar / R), 0.2)

with `Rfar` the farthest surface extent from the body centre, so the farthest body stays on the top
margin, the surface stays on its line, and the camera re-fits while a body orbits or flies.

A fixed screen line is preferred to a fixed number of visible decades: with a fixed decade count
the line itself moves as `Rfar` changes and the horizon drifts under a moving body. Fixed in
screen space, the visible depth span is `(1 − GROUND_BODY) / s` log units — about 2.4 e-folds for
the star, 2.9 for a planet, 3.6 for a small moon. The centre is at infinite distance by
construction; the deepest band simply continues to the bottom edge.

Free-space anchors keep `GROUND = 0.86 H`: space below the anchor is dark, there is no interior.

## layers

One profile per body class, selected by the `profile` column of the body table. Bands run from the
surface inward; `inner` is a fraction of the body radius.

	rocky   crust 0.99    mantle 0.546   outer core 0.191   inner core 0
	star    photosphere 0.98   convective 0.7   radiative 0.28   core 0
	gas     envelope 0.84      metallic hydrogen 0.25            core 0

The top band draws in the body's own colour, so the cutaway joins the body's sky appearance;
deeper bands use their profile colours. The haze above the surface, which uses the same scale with
the opposite sign, is plan 0.7.0. A band's log thickness is `log(inner_prev / inner_curr)`,
so equal log ratios draw equally tall: a crust of tens of kilometres is a hairline next to a core
of thousands. That is the property the scale is chosen for, not a defect.

## rendering

Nested enclosing-sphere fills. For a sphere of radius `r` that contains the pole, the surface on
each screen column is the forward ray exit

	d(a) = dot + sqrt(dot² + r² − D²)

with `D` the pole-to-centre distance. Fill from that curve to the bottom edge with the band
colour, outermost sphere first: every deeper sphere is inside and paints over the previous band, so
bands need no clipping. A layer whose sphere does not contain the pole is skipped (only its
containing layers exist in that view); the steady follow puts the pole exactly at the centre,
where every boundary is a flat horizontal line.

Labels are drawn only in the flat follow view (pole within 2% of the radius from the centre):
a band is labelled in its middle when at least 14 px of it are on screen, with a dark halo for
contrast. The hairline surface band therefore stays unlabelled, which is the point of the scale.

## interaction

- Clicking or following a body transitions to the fitted view with the surface on `GROUND_BODY`.
- A drag's target line comes from its anchor: `GROUND_BODY` for a point inside a body, `GROUND`
  for free space. `k = 1` at that line, so a drag that reaches the line ends exactly at the follow
  view; dragging past it keeps the reference point under the pointer and shifts the whole map.
- The steady follow pins the pole at the centre and re-fits the sky every frame.

## invariants (the smoke asserts)

	surface on a follow            H · GROUND_BODY
	farthest far point             H · TOP
	interior fills                 one per band, each reaching the bottom edge
	band boundaries                flat, at oy − s log(r), spaced s log(r_prev / r_inner)
	labels                         every band with a visible height >= 14 px
	free-space drag                still ends on H · GROUND

## files

- `log-system.js`: interior profiles and the per-body profile index.
- `log-projection.js`: `GROUND_BODY`, a fit scale parameterised by the ground line, follow and
  transition targets.
- `log-render.js`: enclosing-sphere fills, layer bands, labels.
- `log-input.js`: per-anchor drag target line.
- `experiments/log-smoke.js`: layer geometry, label and top-margin checks.
- `index.html`: the hint mentions the layers.

## validation

L0 `node --check` on the touched files, L1 `node experiments/log-smoke.js`. Legacy smoke scripts
are unaffected because the legacy files are unchanged.

Manual: follow the star, a planet, a gas giant and a moon; compare band heights against the log
ratios; verify the labels sit inside their bands and stay clear of the HUD; resize to a narrow
window; drag from free space into a body and out again.
