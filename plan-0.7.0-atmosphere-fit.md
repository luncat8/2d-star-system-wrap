# plan 0.7.0 — atmosphere and fit damping

## atmosphere

The surface is the log origin in both directions: with the pole at the body centre,

	above   y = ground − s · log(d / R)
	below   y = ground + s · log(R / d)

so the sky and the cutaway are one scale measured from the surface. A body's atmosphere is the
band between its surface and `R · air`; its top edge is a log position like any other geometry
above the ground, not a screen-space strip.

`air` is per profile: 1.25 for rocky bodies and gas giants, 1.3 for the star (named corona). A real
100 km atmosphere is `1.6e-2 R` — about 2 px in a follow view — so the drawn band uses the upper
atmosphere/exosphere scale instead. The fraction is data: change the table to change the band, the
projection is untouched.

The haze is filled as one closed band between two enclosing curves (the air exit and the surface
exit), not as another full interior fill: only the strip between them costs pixels. Its colour is
a translucent profile colour, so orbit curves and stars below it read as hazed rather than hidden.
Labels use the same rule as the interior: the band is named in its middle when at least 14 px of it
are on screen, with a dark halo. The top interior band of a gas giant is therefore named
`envelope`; `atmosphere` belongs to the haze above the surface.

## fit damping

The fitted span `log(Rfar / R)` is a property of where every body currently is, so recomputing it
every frame pumps the zoom at the orbit period: following Earth, the raw fitted scale swings
95.5 – 105.4 (10 %) over 30 s. The camera samples and damps it instead.

- `FIT_MS = 400`: the target span is recomputed from the farthest surface extent four times a
  second, not every frame.
- the current span eases toward the target with a frame-rate independent EMA,
  `1 − exp(−dt / tau)`, `dt` clamped to 100 ms so a backgrounded tab cannot jump.
- asymmetry: a `tau` of 200 ms when the span must grow (a receding body is fitted at once),
  90 s when it only shrinks a little (an orbit-sized swing is held), and 500 ms when the target is
  below `FIT_CLOSE_RATIO = 0.85` of the span (a genuine re-fit, e.g. flying back into the system,
  stays responsive).
- the held span sits at the widest recent requirement, so the top margin has slack and no body
  clips; over a minute the damped scale stays within 2.4 % instead of 10 %.
- a follow transition ends by seeding the damped span from its own end scale, so the handover from
  the 1.8 s interpolation to the steady camera does not jump. Reset drops the seed.

Drags keep using the exact fit (`cameraFitScale`) as their target; only the steady follow is damped.

## files

- `log-system.js`: `air`, `airName`, `airColor` per profile; the gas top band is `envelope`.
- `log-render.js`: `enclosingY`, the enclosing band fill for the haze, labels on both sides of the
  surface.
- `log-projection.js`: `FIT_*` constants, the fit state, `cameraFitRange`, `cameraFitDamped`, the
  transition seed.
- `experiments/log-smoke.js`: air band geometry, label lists, fit sampling and asymmetry checks.

## invariants (the smoke asserts)

	air band            one path; its outer edge flat at oy − s log(R · air), its inner edge on the
	                    surface line; the height is s log(air)
	fills               one per interior band plus the air band; every interior fill ends at the
	                    bottom edge; the air band does not
	labels              air name first when its band clears 14 px, then the interior bands
	fit target          held for less than FIT_MS, then resampled from the body position
	fit grow            more than 20 % of the gap closed in one 100 ms step
	fit hold            less than 1 % for a 10 % overshoot
	fit close           more than 20× the hold for a 3× overshoot, still slower than grow
	fit reseed          after a follow, the steady scale equals the exact fitted scale

## validation

L0 `node --check` on the touched files, L1 `node experiments/log-smoke.js`. Stills at 1200×800 and
420×900 for Earth, the Sun and Jupiter. Manual: follow Earth for a minute and watch the horizon and
the system size; fly out and back in; click between bodies with different profiles.
