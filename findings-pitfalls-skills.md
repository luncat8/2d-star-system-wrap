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

## drag to wrap (design, not implemented)

- a drag on a body should scrub the same morph a click animates, not pan a camera: progress =
  distance moved toward the target's ground edge (planet down, star/moon up) over the distance
  from the press to that edge. the wrap projection is its own zoom; no camera offset, no zoom.
- while dragging, drive the morph parameter linearly from the pointer and ease only the release
  settle (p > 0.5 settles in, else back) — an eased scrub lags the finger and jumps when the
  settle starts.
- start the scrub on pointerdown and treat no movement beyond a few px as a click, so the tap path
  is unchanged.
- a scrubbed morph needs the parameter drivable from outside the timer and a clean return to t=0:
  reverting must restore the source state with no transition object left alive, or the next click
  starts from a frozen blend.
- press-time pops (target invisible at t=0, a wrap line with no source, glow mismatch) belong to a
  dual from/to scene. a silhouette-collapse morph has none of them: at t=0 the target is already
  its icon circle, so there is nothing to special-case.
