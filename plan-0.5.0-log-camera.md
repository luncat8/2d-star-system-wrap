# plan 0.5.0 — logarithmic camera

## Projection

Map a world point relative to a camera pole with `x = ox + s atan2(dx, dy)` and
`y = oy − s log(hypot(dx, dy))`. The inverse uses the exponential and the same
angle. The horizontal period is `2πs`; render copies of sampled curves where
needed. A large pole distance and scale give an approximately linear overview.

Every view is the same map with a different pole and scale; there is no
per-case geometry. The ground state for any world anchor A places the pole and
fits the whole system on screen:

- pole: the centre of a body when A is inside its disk, otherwise the nearest
  surface point to A (the ground below).
- reference point R, kept 1:1 under the pointer: the anchor itself in free
  space, the body's top surface point when A is on a body. ref = |R − pole|.
- scale `s = (G−T)·H / max(log(Rfar/ref), 0.2)` where Rfar is the farthest
  surface extent of any body from the pole: the farthest body sits at the top
  margin T and ref at the anchor line, so every body always fits vertically.
  A body whose disk contains the pole is the ground: filled below its
  ray-circle intersection curve, its centre buried by design.
- orientation is not rotated; world up stays screen up.

With `G = 0.86`, `T = 0.04`: a follow view pins the body's surface to the
ground line and shows the rest of the system above it; a free-space anchor
shows the anchor on the ground line, dark space below it, and an azimuth
slice of the system above (the cylindrical wrap, `2πs` often exceeds W).

## Interaction

- Click (or dropdown Follow) a body: a 1.8 s smoothstep transition moves the
  pole to the body's centre, blends the scale toward the fitted scale and
  keeps a surface point anchored, sliding it to the ground line at screen
  centre. The steady follow re-fits every frame, so a moving body (orbit or
  free flight) keeps its surface flat at the bottom and every other body
  visible.
- Drag any world point: the same ground state computed for that point at
  press. Downward progress k (pointer start to the ground line) interpolates
  the pole distance in log space and the pole bearing on the short arc, and
  the zoom density 1/s linearly, so the visible log ring widens onto the
  system mid-drag instead of emptying; the reference point stays under the
  pointer at all k. Dragging a point inside a body ends at exactly that
  body's follow view, so drag and click share one transformation. Releasing
  keeps the view the manipulation left it in; a pure horizontal drag rotates
  the map around the anchor.
- Reset restores the overview. WASD and arrow keys move Wanderer
  independently of the orbit simulation.

## Manual pass

- Follow a planet, the sun and a moon; verify the surface stays flat at the
  bottom while every other body, including the farthest planet, stays on
  screen, and the view re-fits while the body moves.
- Follow Wanderer and fly in every direction; the horizon stays fixed and
  the system stays fitted.
- Press an empty point between the planets and drag it to the ground line;
  verify the space unwraps gradually, the point under the pointer never
  slips, and the whole system ends on screen (no deep zoom into nothing).
- Drag a body, sideways and back up; verify it ends at the same view a click
  gives.
- Inspect bodies and orbits crossing the horizontal seam, resizing and touch
  input. Open legacy.html and verify its original controls still work.
