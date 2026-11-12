# 2D Solar System — Wrap Projection

## Goal

A 2D solar-system view that can wrap onto any body. Selecting a body re-projects the scene so that body's surface becomes a flat horizontal line; the rest of the system is folded into the sky on a logarithmic distance scale, so every body stays on one screen.

View only. Orbit shapes, body positions, and time are inputs; this document does not change them.

## Scope

- One star, planets, moons.
- Single full-window canvas.
- Initial state: free 2D top-down map of the whole system.
- Interaction: click a body to wrap onto it.
- No physics

## World model

- Star at the origin.
- Each body: 2D position `p`, radius `R`, class (`star`, `planet`, `moon`), color.
- Orbits: planets around the star, moons around their planet. Circular or elliptical; positions are evaluated from time. No perturbations.
- Selected body `S`; every other body `B`.
- `systemRadius` = farthest orbit reach (planet apoapsis, or planet orbit radius + moon orbit radius, whichever is larger).

## Screen layout

Canvas `W × H`, origin top-left. The wrap line is horizontal and separates the ground band from the sky.

- Planet selected: sky above, wrap line at `0.9H`, soil band from `0.9H` to `H`.
- Star or moon selected: soil band from `0` to `0.1H`, wrap line at `0.1H`, sky below.
- `0.1H` is the soil thickness (10vh).
- Soil colors: planet brown, star red, moon gray.
- Background near-black.
- Wrap line: 1 px, low alpha.

## Projection

### Map projection

- Centered on the star.
- `s = min(W, H) / (2 * systemRadius * 1.1)`.
- `X = W/2 + (p.x - star.x) * s`.
- `Y = H/2 - (p.y - star.y) * s`.
- All orbits fit with padding.

### Wrap projection

Centered on `S`. For a world point `p`:

- `dx = p.x - S.x`, `dy = p.y - S.y`, `d = sqrt(dx * dx + dy * dy)`.
- `phi = atan2(dy, dx)`, in `[-pi, pi]`.

#### X — azimuth

- `X = (phi + pi) / (2 * pi) * W`, so `X` is in `[0, W)`.
- One angular scale for every body: `2 * pi` rad maps to `W` px. The selected body's perimeter unrolls to the full width; other bodies keep the same scale.

#### Y — log distance

- `d_min = max(S.R, 1e-3)`.
- `d_max = max(|p_B - S|)` over all other bodies, smoothed with an exponential moving average (time constant ~0.35 s) so a re-center does not jump the scale.
- `u = clamp((ln(max(d, 1e-6)) - ln d_min) / (ln d_max - ln d_min), 0, 1)`.
- If `d_max <= d_min * 1.0001`, use `d_min * 1.0001` as the upper bound.
- Planet sky (above): `Y = line - u * line`, `line = 0.9H`.
- Star/moon sky (below): `Y = line + u * (H - line)`, `line = 0.1H`.
- `d = d_min` maps to the wrap line; `d = d_max` maps to the far edge of the sky.
- Circular orbit around `S`: constant `d` gives constant `Y`, a horizontal line. Elliptical orbit: `d` varies, so the line bends.

### Body icons

- Non-selected bodies: filled circles.
- Angular radius `alpha = R_B / d`; `r = alpha / (2 * pi) * W`.
- Clamp per class: star `[8, 40]` px plus glow, planet `[3, 24]` px, moon `[2, 12]` px.
- Selected body: not drawn as an icon; its surface is the wrap line.

### Orbits

- Sample `N = 128` points around the parent body.
- Map every sample with the same `(X, Y)` function.
- Draw every orbit. A selected planet's or moon's own orbit passes through its center (`d = 0`); clamp `d` to `1e-6` and `u` to `0` there.
- Break the polyline when `|dX| > W * 0.25` (the azimuth seam at `phi = ±pi`).
- 1 px, low alpha, color by body.

## Transition

- Duration: 3 s.
- Projection transformation only: same canvas, same bodies, same background. No fade, no crossfade, no scene redraw.
- One parameter `e` in `[0, 1]`: `0` = map, `1` = wrap. `e = easeInOutCubic(t)` with `t = elapsed / 3`.
- A click during a transition is ignored.

### Map → wrap

- Every body: `P = lerp(P_map, P_wrap(e), e)`, where `P_wrap` uses the animated line and log scale.
- Map X is linear, not periodic: lerp it directly, no short arc.
- The ground band grows from the target's edge to its final position: `edge = H` for a planet, `0` for a star/moon. The wrap line follows the inner edge of the band.

### Wrap → wrap

- Keep `dmaxFrom` (the old smoothed value) and `dmaxTo` (the new target, set immediately) separate, plus a separate `logDmin`/`logRange` for each side. Otherwise the old view jumps at `t = 0`.
- Same side: the line and band lerp to the new body's line; the soil color blends through a 64-step LUT.
- Side switch (planet to star/moon, or the reverse): the ground layer scrolls.
  - The old band exits toward its own edge: planet moves down, star/moon moves up. Offset `0.1H * e`.
  - The new band enters from its own edge and settles: planet enters from below, star/moon enters from above. Offset `0.1H * (1 - e)`.
  - The two bands stay within 10vh of their own edge and never meet.
  - Draw two bands and two wrap lines during the switch.
- X is periodic with period `W`. Interpolate it on the short arc:
  - `dX = wrapTo - wrapFrom`; wrap `dX` into `[-W/2, W/2]` by adding or subtracting `W`.
  - `X = wrapFrom + dX * e`; wrap `X` into `[0, W)`.
  - Raw linear interpolation sends any body near the `±pi` seam the long way through the screen center.
- Y is the linear lerp of the two projected Y values.

### Icons during transition

- Incoming selected body: flatten into the line, vertical radius `r * (1 - e)`.
- Outgoing selected body: rise out of the line, vertical radius `r * e`.
- Other bodies: normal icons at the interpolated position.

### Ground during transition

- Planet: soil below the line. Star/moon: soil above the line.
- Same side (planet to planet, star/moon to star/moon): one lerped band, blended soil color.
- Side switch: two bands and two lines, as above.

## Interaction

- Hit test: click or tap within a body's icon radius + 6 px (minimum 12 px).
- Click a body to start a 3 s transition to wrap around it.
- The ground is not a hit target.
- After the transition the wrap view is active; click another visible body to re-center.

## Invariants

- Screen X is an azimuth with period `W`. Any interpolation between two wrap projections takes the short arc; raw lerp is wrong at the seam.
- `d = 0` at the selected body: clamp before taking the log.
- Azimuth seam: break orbit polylines when `|dX| > W * 0.25`.
- `d_max` is smoothed so a re-center does not jump the log scale.
- A selected planet's or moon's own orbit passes through its center; clamp it, do not skip it.

## Implementation shape

- `index.html` — canvas and script order.
- `js/main.js` — boot/wiring, resize, frame loop.
- `js/world.js` — world model, bodies, orbits, motion.
- `js/projection.js` — map/wrap projection, log scale smoothing, per-point interpolation.
- `js/render.js` — background, ground, orbits, bodies, wrap line.
- `js/input.js` — hit test and selection.
- `js/transition.js` — morph state, line/ground geometry, timing/easing.
- `experiments/smoke.js` — headless projection math and stub-canvas boot/input smoke.

## Validation

Automated:

- `node --check` on touched JS.
- Headless projection math: map center, line and band positions, selected body on the line, circular orbit horizontal, azimuth seam wraps, wrap to wrap X takes the short arc, side-switch bands stay at the edges.

Manual pass list:

1. Initial map shows the star, all planets, all moons, and orbit lines.
2. Click a planet: 3 s morph, no fade; ends with the planet ground at the bottom, star/moons in the sky, orbits visible.
3. Click a moon: ground at the top (gray soil above), planet/star below. The parent planet is at a constant distance, so it renders on a horizontal line; the moon's own orbit is a curve through the moon.
4. Click the star: red soil at the top, planets below.
5. Circular orbit check: a moon on a circular orbit around the selected planet stays on a horizontal line; an elliptical orbit bends.
6. Wrap-x: a body crossing the `±pi` azimuth boundary wraps without a jump.
7. Log fit: the farthest body is near the far edge of the sky; the nearest body is near the wrap line; no body is off-screen.
8. Re-center: during a wrap to wrap morph, no body sweeps the long way across the screen; a body at the seam exits one edge and enters the other.
9. Performance: 60 fps.