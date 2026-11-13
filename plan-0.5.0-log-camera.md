# plan 0.5.0 — logarithmic camera

## Projection

Map a world point relative to a camera pole with `x = ox + s atan2(dx, dy)` and
`y = oy - s log(hypot(dx, dy))`. The inverse uses the exponential and the same
angle. The horizontal period is `2πs`; render copies of sampled curves where
needed. A large pole distance and scale give an approximately linear overview.
A pole at a body's center and a period equal to the viewport width project its
surface to a horizontal line. Position that line at 86% of the screen height.
All body types use the same orientation and projection. Draw body boundaries
and orbits as transformed world curves; a disk containing the pole is filled
below its ray-circle intersection curve. Stars are a decorative screen-space backdrop.

## Interaction

A body click or dropdown selection smoothly moves the pole and scale to the
body while anchoring a surface point, then follows the moving body. Dragging
preserves the world point under the pointer, moving the pole toward it as the
drag goes down; the gesture interrupts follow. Dragging the point to the horizon reaches one-screen circumference (with an
80 px minimum gesture distance). Reset restores the overview.
WASD and arrow keys move Wanderer independently of the orbit simulation.

## Manual pass

- In landscape and portrait, click a planet, the sun, and a moon; verify a
  continuous transformation, flat ground below, and the rest of the system above.
- Follow Wanderer and fly in every direction; verify the horizon stays fixed.
- Drag empty space and a body down, sideways, and back up; verify the point
  under the pointer stays there and the projection changes smoothly.
- Inspect bodies and orbits crossing the horizontal seam, resizing and touch input.
- Open legacy.html and verify its original controls still work.
