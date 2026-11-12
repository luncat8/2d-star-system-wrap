# plan 0.3.0 — camera pan

## goal

Pan the view by dragging anywhere on the canvas, 1:1 with the pointer, in both projections.
A press that does not move is still a click that wraps. No zoom, no scroll wheel, no drag on the
body itself: the old "drag a body to scrub" idea is dropped — a drag is always the camera.

## state

- the screen offset lives in the projection state, not in a global: `panX`, `panY`, pixels.
- flat: both axes, free. wrap: `panX` only — it is a rotation of the cylinder (period W, so no
  clamp), and `panY` stays 0 because the ground line is fixed to a screen side by the projection.
- every state is built with pan 0 (`projMakeFlat` / `projMakeWrap`), so a tap on a body flies the
  camera back to the canonical arrival while the projection morph runs. A tap must never land the
  zenith off-centre.
- the offset is applied inside the per-state evaluation (after the projection formula, before the
  transition blend). Positions then lerp with pan like any other component: a wrap→flat morph
  from a panned view starts where the user left it and ends centred, for free.

## gesture

- `pointerdown` anywhere on the canvas starts a *press*, not a pan, and records the position.
- first move beyond 4 px turns the press into a drag. While dragging: `panX += dx`, `panY += dy`
  in flat only. No easing during the drag — easing the pointer lags the finger and is the classic
  reason a drag feels broken.
- `pointerup` after a drag: carry the velocity out with `v *= 0.9` per frame, stop under 30 px/s.
  Inertia is the only "smooth" knob; direct tracking is what makes it exact.
- `pointerup` without crossing the slop: it was a tap → `projPick` at the release point → wrap.
  The pick moves from `pointerdown` to `pointerup`; selecting on press would wrap on every drag.
- mid-morph: a drag mutates the live destination state (`trans.dst` if present, else `steady`), so
  the view keeps following the finger instead of freezing for the rest of the 3 s. The retarget
  queue is untouched.
- `pointercancel` drops the drag and keeps the current offset.

## consequences to keep straight

- picking already uses the per-frame drawn positions, so the pan is picked up there for free.
- the wrap's three copies are drawn at ±W; the pan shifts them, so coverage must still be 3 copies
  plus the pan magnitude, or the seam becomes visible at large offsets. Pan is periodic: offset the
  copy loop by `((panX % W) + W) % W` instead of widening the copy count.
- a panned wrap view means the zenith is no longer at the screen centre. The invariant becomes
  "zenith at the screen centre plus the state's pan", and the smoke's zenith check has to use it.
- resize keeps the offset in pixels. The view is a camera, the window is its frame.

## files

- `camera.js` (new, owns pan state + press/drag/inertia): edit for slop, decay, axis rules.
- `projection.js`: states gain `panX/panY`; apply in `projEvalX/Y`; no new formulas beyond that.
- `input.js`: pointerdown/move/up/cancel, tap-vs-drag decision, pick on release.
- `render.js`: copy offsets include the periodic pan.
- `main.js`, `index.html`: load `camera.js` after `projection.js`.
- `experiments/smoke.js`: gesture and offset assertions.

## validation

- L0: `node --check` on the touched files.
- L1: drag from each projection does not change the projection state, changes only the offset, and
  is monotone with the pointer (a synthetic 200 px drag moves the same body 200 px ± 0.5).
- L1: a tap still wraps (existing scenarios pass unchanged); a 10 px drag on a body pans and does
  not wrap; a tap during a morph still retargets.
- L1: inertia: after a 200 px drag released at 900 px/s the total extra travel is 60-100 px and the
  view is at rest within 0.6 s.
- L1: continuity numbers unchanged (max 0.0168 W, limit 0.25) with pan ≠ 0 in the scenario.
- L2: 3-copy coverage with `panX = W/2` and `panX = W`: no seam, no missing strip (ascii dump).
- manual: drag in flat, drag in wrap (sky rotates, ground stays), drag past a full lap, tap after a
  drag, tap a body mid-morph, resize mid-drag.

## open decisions

- inertia on/off and the decay constant (0.9 / 30 px/s above).
- whether `panY` should be allowed in wrap as a small parallax instead of hard zero.
- whether a tap on empty space should also recentre, or only a tap on a body.
