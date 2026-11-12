# 2D Solar System — Wrap View Polish

Optional polish on top of the wrap projection. Each item ships alone and does not change the base projection except item D.

## Scope

- Star field, labels, hint, optional fly-pan transition, optional log1p distance mapping.
- No new bodies, no physics, no un-wrap, no zoom or drag.

## A. Star field

- 256 static points, normalized `u, v` in `[0, 1]`, radius `0.6..1.2` px, alpha `0.15..0.8`, white.
- Generated once at boot with a seeded PRNG; stored in `Float32Array`s.
- Screen-space: not projected, no parallax, no twinkle.
- Draw after the background fill, before the ground.
- Resize uses the normalized coordinates; no regeneration.

## B. Labels and hint

- Name above each icon: 12 px system-ui, centered, alpha 0.75.
- Selected body has no icon and no label.
- During a transition the label follows the projected position; hide it when the icon's vertical radius is under 4 px.
- Hint at the top-left: 13 px, alpha 0.6, "Click a body to wrap around it"; during a transition "Wrapping <name>".
- No collision handling; overlap at the map scale is accepted.

## C. Fly-pan transition

- 1.5 s pan + 1.5 s projection morph = 3 s.
- Phase 1: the map camera center lerps to the target; the projection parameter eases to 0. Map scale stays fixed.
- Phase 2: the projection parameter eases 0 to 1 with the camera locked to the target.
- The map projection gains a camera center; the star-centered map becomes camera-centered.
- Wrap to wrap keeps the single 3 s morph: there is no map to pan in.
- During phase 1 the scene is still a map, so X is linear (no short-arc wrap). The short-arc rule applies only to the wrap to wrap morph.

## D. log1p distance mapping

- `u = log(1 + d / rS) / log(1 + dmax / rS)` replaces `(log d - log rS) / (log dmax - log rS)`.
- Removes the `d <= rS` clamp; the selected body's own orbit becomes a smooth curve through the line.
- Cost: the line becomes the center plane, not the surface; near bodies sit higher.

## Implementation shape

- `js/render.js` — star field, labels, hint.
- `js/projection.js`, `js/transition.js` — fly-pan camera and phase timing.
- `js/projection.js` — log1p mapping.

## Validation

- `node --check` on touched files.
- Headless: star count finite; selected body has no label; fly-pan ends centered; log1p altitude assertions.
- Manual: star field in map and wrap; labels readable at 1280x800 and 800x600; pan reads as a flight; log1p sky distribution.

## Open decisions

- Star density and brightness.
- Label decluttering at the map scale.
- Fly-pan path for wrap to wrap.