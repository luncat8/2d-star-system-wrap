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
