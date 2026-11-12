# 2D Solar System — Wrap Projection

## Goal

A 2D solar-system view that can wrap onto any body. Selecting a body flies the camera to it and re-projects the scene so the body's surface becomes a flat horizontal line. The rest of the system is projected into the sky on a logarithmic distance scale, so every body stays visible on one screen.

View only. Orbit shapes, body positions, and time are inputs; this document does not change them.

## Scope

- One star, planets, moons.
- Single full-window canvas, plain `<script>` tags, no build.
- Initial state: free 2D top-down map of the whole system.
- Interaction: click a body to wrap onto it.
- No physics, no camera drag, no zoom controls, no un-wrap in this version.

## World model

- Star at the origin.
- Each body has a 2D position `p`, radius `R`, class (`star`, `planet`, `moon`), and color.
- Orbits: planets around the star, moons around their planet. Circular or elliptical; positions are evaluated from time. Simple motion, no perturbations.
- Selected body `S`; every other body `B`.

## Screen layout

Canvas `W × H`, origin top-left. The wrap line is horizontal.

### Planet selected

```
Y
^   sky: other bodies, orbits
|   [star]  [moon]  [planet]
|   ------------------------------ wrap line, Y = H - 10vh
|   [soil]                      10vh, brown
+---------------------------------> X
```

### Star or moon selected

```
Y
^   [soil]                      10vh, red / gray
|   ------------------------------ wrap line, Y = 10vh
|   [planet]  [moon]  [star]
|   sky: other bodies, orbits (far = bottom)
+---------------------------------> X
```

- `10vh` is the soil thickness. The line is the inner edge of the soil band.
- Planet: soil below the line. Star/moon: soil above the line.
- Sky occupies the rest of the canvas.
- Soil colors: planet brown, star red, moon gray.
- Background: near-black.
- Wrap line: 1 px, low alpha.

## Projection

### Map projection (`w = 0`)

- Star at the center of the canvas.
- `s = min(W, H) / (2 * max_orbit_radius * 1.1)`.
- `X = W / 2 + (p.x - star.x) * s`.
- `Y = H / 2 - (p.y - star.y) * s`.
- All orbits fit with padding.

### X — azimuth

- `d = |p_B - p_S|`.
- `φ = atan2(p_B.y - p_S.y, p_B.x - p_S.x)`, normalized to `[-π, π)`.
- `X = (φ + π) / (2π) * W`; wraps at the edges.
- The selected body's perimeter maps to the full width: `2π` rad → `W` px. This is wrap-x.
- Other bodies use the same angular scale: angular radius `α` → `α / (2π) * W` px.

### Y — log distance

- `d_min = R_S` (selected body's surface).
- `d_max = max(d_B)` over all bodies, smoothed with an exponential moving average so the scale does not jump.
- `u = (log d - log d_min) / (log d_max - log d_min)`, clamped to `[0, 1]`.
- Planet sky (above): `Y = Y_line - u * H_sky`, `H_sky = Y_line`.
- Star/moon sky (below): `Y = Y_line + u * H_sky`, `H_sky = H - Y_line`.
- `d = d_min` → wrap line; `d = d_max` → far edge of the sky.
- Circular orbit: constant `d` → constant `Y` → horizontal line. Elliptical orbit: `d` varies → the line bends.

### Body icons

- Non-selected bodies: filled circles.
- `α = R_B / d` (small-angle).
- `r = clamp(α / (2π) * W, r_min, r_max)`.
- Per class: star `8..40 px` + glow, planet `3..24 px`, moon `2..12 px`.
- Selected body: not drawn as an icon; its surface is the wrap line.

### Orbits

- Planet orbits around the star: sample `N = 128` points, map each with the same `(X, Y)` function, draw a polyline.
- Moon orbits around their planet: same, centered on the planet.
- Skip the selected body's own orbit (`d = 0` at the center).
- Orbit lines: 1 px, low alpha, color by body.

## Transition

- Duration: 3 s.
- Only a projection transformation: same canvas, same bodies, same background. No fade, no crossfade, no scene redraw.
- One parameter `w ∈ [0,1]`: `0` = map, `1` = wrap.
- `Y_line(w) = lerp(edge, Y_line_final, e)`, where `e = ease(w)`.
  - Planet: `edge = H`, `Y_line_final = H - 10vh`.
  - Star/moon: `edge = 0`, `Y_line_final = 10vh`.
- Ground band: between the edge and `Y_line(w)`; no alpha fade.
- Wrap projection uses `Y_line(w)` and `H_sky(w)`, so the bodies and the line move together.
- Each body's screen position: `lerp(P_map, P_wrap(w), e)`.
- Selected body's icon: vertical radius `r * (1 - e)`, flattening into the line.
- Orbit polylines: lerp point-by-point.
- Easing: `easeInOutCubic` or similar. Exact path is an implementer choice.
- Click during a transition: ignored.

## Interaction

- Hit test: click/tap within a body's icon radius + 6 px.
- Click a body → start a 3 s transition to wrap around it.
- The ground is not a hit target.
- After the transition, the wrap view is active; click another visible body to re-center.

## Open decisions

- Easing and fly path.
- Log base and `d_max` smoothing time.
- Whether the wrap line is visible before the transition ends.
- Moon orbit rendering (always, or only when the moon's planet is in view).
- Background stars.
- Labels and hit radius.
- Return-to-map interaction.

## Implementation shape

- `index.html` — canvas and script order.
- `js/main.js` — boot/wiring.
- `js/world.js` — body definitions and orbit positions.
- `js/projection.js` — map and wrap projection.
- `js/render.js` — draw.
- `js/input.js` — hit test and selection.
- `js/transition.js` — 3 s morph.
- Preallocate orbit sample and screen buffers; no per-frame allocations.

## Validation

Manual pass list:

1. Initial map shows the star, all planets, all moons, and orbit lines.
2. Click a planet: 3 s morph, no fade; ends with the planet ground at the bottom, star/moons in the sky, orbits visible.
3. Click a moon: ground at the top (gray soil above), planet/star below; the moon's orbit around its planet is a horizontal line.
4. Click the star: red soil at the top, planets below.
5. Circular orbit check: a moon on a circular orbit around the selected planet stays on a horizontal line; an elliptical orbit bends.
6. Wrap-x: a body crossing the ±π azimuth boundary wraps without a jump.
7. Log fit: the farthest body is near the far edge of the sky; the nearest body is near the wrap line; no body is off-screen.
8. Performance: 60 fps.

Automated: `node --check` on all touched JS files.