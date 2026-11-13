# plan 0.8.0 — render cost and the orbit under the pole

## the orbit under the pole is not drawable

The camera pole is the log origin, and a followed body's centre is a point of its own orbit.
The log image of a circle through the pole is singular: the bearing sweeps a full turn while the
distance goes to zero, so the sampled curve leaves the top arc, runs down to the surface line,
sweeps a whole horizontal period hugging it and drops to infinite depth. Measured on a follow of
Earth: the drawn orbit is 125 px away from the curve it represents, with 330 px jumps between
adjacent samples.

An orbit cannot be seen from its own ground, so the body that contains the pole does not draw its
orbit. The rule is the same one that decides the interior cutaway: `renderGroundIndex` is the body
whose disk contains the pole, that body is filled as an enclosing cutaway, and its orbit is
skipped. Other bodies' orbits are unaffected — they pass near the pole at their closest approach
and only show a cusp there.

## sampling

A curve is sampled at 256 angles. Most of those samples are wasted: in the overview a body is
3–4 px across, and in a follow view most bodies are under 20 px, yet every one of them cost 256
projections plus the same number of path points on every copy. Four changes, all in `log-render.js`:

- the sample angles are fixed per index, so `cos`/`sin` are tabled once at init instead of spent
  per sample. A sample now costs one `atan2`, one `log` and one `sqrt`.
- the sample count comes from the projected extent, `span = max(2·s·asin(r/D), s·log((D+r)/(D−r)))`,
  and a 0.25 px chord budget, `n = π / acos(1 − 0.25/(span/2))`, floored at 16 and capped at 256.
  The stride is a power of two (1, 2, 4, 8, 16), so the table index of a sample stays exact.
  A cusp is sharper than its box: the worst measured chord error is 1.3 px (Venus' orbit seen from
  Earth, a 20 % alpha line), everything else stays under 0.3 px.
- the enclosing fill's ray direction per screen column depends only on `camera.ox`, `camera.scale`
  and `view.w`, so the columns are cached and rebuilt only when one of those changes.
- the visible laps of one curve are drawn as subpaths of a single path, so a curve costs one
  `fill`/`stroke` instead of one per lap and the seam between touching laps is not blended twice.

`Math.hypot` is 3–4× slower than `Math.sqrt(a*a+b*b)` and the coordinates are world or screen
units, far from the overflow range that buys hypot its accuracy. The hot paths use the square.

## interior bands are strips

Each interior band filled from its own boundary to the bottom edge, painting over the band above:
four 0.38 H fills per frame to produce a 0.38 H image, 1.2 screens of raster per frame. A band is
the strip between its own boundary and the next one, exactly as the atmosphere became in 0.7.0.
The same pixels are covered, once. A band whose inner sphere does not contain the pole has no
lower half plane; that band then runs to the bottom edge, as the deepest one does.

## measured

`node experiments/log-perf.js`, 1200×800, dpr 2, frames of one view state:

	                     before                        after
	overview       0.72 ms  6168 pts  0.8 kpx    0.08 ms   872 pts  0.8 kpx
	follow earth   0.88 ms 13372 pts  1.21 Mpx   0.11 ms  4614 pts  0.40 Mpx
	follow sun     0.83 ms 13629 pts  1.25 Mpx   0.11 ms  5162 pts  0.41 Mpx
	follow jupiter 0.79 ms 11828 pts  0.92 Mpx   0.08 ms  3583 pts  0.40 Mpx
	follow luna    0.79 ms 16970 pts  1.27 Mpx   0.10 ms  4676 pts  0.40 Mpx

`pts` are path points per frame, `kpx/Mpx` the filled area per frame (shoelace, unclipped).
Draw calls per frame in a follow view: 25 fills + 26 strokes → 17 fills + 10 strokes. Raster and
canvas call cost moved with them; the numbers above are the JavaScript side only.

## invariants (the smoke asserts)

	band strips        every interior band but the deepest spans both of its boundaries (514 pts)
	deepest band       ends on the bottom edge
	off centre pole    an enclosing fill stays finite when the pole leaves an inner sphere
	own orbit          the followed body's orbit is not sampled, other orbits still are

## files

- `log-render.js`: sample table, `curveStride`, curve and strip rendering, ground index, orbit rule.
- `log-projection.js`, `log-input.js`: `sqrt` in the hot paths; status text written on change.
- `log-system.js`: `system.free` names the freely flown row that flight drives.
- `experiments/log-perf.js`: per-state frame cost, machine format.
- `experiments/log-smoke.js`: strip, off-centre and own-orbit assertions.

## validation

L0 `node --check` on the touched files, L1 `node experiments/log-smoke.js`, L2 both legacy smoke
scripts (unchanged files). Stills and the ascii dump of overview, follow and drag states. Manual:
follow a body and confirm its own orbit is gone and no streak crosses the sky, compare the band
colours and labels against the previous build, drag in and out of a body, resize.
