# 2D Solar System — Drag to Wrap

## Goal

Dragging a body toward its ground edge scrubs the same projection morph as a click. The drag distance controls the morph; release past halfway settles into the wrap, otherwise the view returns.

## Scope

- Press a body and drag vertically.
- Planet: drag down toward the bottom soil. Star/moon: drag up toward the top soil.
- No pan, no wheel/pinch zoom, no camera offset.
- A click without a drag keeps the 3 s timed morph.

## Interaction

- `pointerdown` on a body starts a scrub at progress `0`. The current selection stays selected until the scrub completes or cancels.
- `pointermove` sets `p = distance moved toward the ground edge / distance from the start to that edge`, clamped to `[0, 1]`.
  - Planet: denominator `H - y0`.
  - Star/moon: denominator `y0`.
- The projection uses `e = p` (linear, direct manipulation).
- `pointerup`: `p > 0.5` settles to `1`; otherwise to `0`.
- No drag: `continueAsClick` starts the timed 3 s morph.
- `pointercancel`: settle to `0`.
- Drag on empty space does nothing.

## Projection

- The scrub reuses the existing transition projection: `from`, `to`, `eased`.
- `e = 0` is exactly the from state; `e = 1` is the target wrap.
- The wrap line, ground band, and selected body's line position are the same as the click morph.

## Settling

- `settleDur = 0.15 + 0.35 * |target - p|` seconds.
- The settle progress uses `easeInOutCubic`, starting at `p`, so there is no jump on release.
- Completion sets `view.selected = to`; cancel leaves the original selection.

## Implementation shape

- `js/transition.js` — scrub state, `scrubTo`, `settleTransition`, `continueAsClick`, `finishTransition`.
- `js/input.js` — `pickBody`, drag state, progress mapping, pointer handlers.
- `js/render.js` — incoming body glow fades with `1 - eased`; wrap line is hidden at `eased = 0`.
- `experiments/smoke.js` — scrub math and stub-canvas drag smoke.

## Validation

- `node --check` on touched JS.
- Headless: scrub start keeps the selection; drag holds `t`/`eased`; the line follows `p`; settle to wrap and cancel; no-drag click continuation; wrap-to-wrap scrub.
- Manual: drag a planet down, a moon/star up, release halfway, release early, click a body, drag on empty space.