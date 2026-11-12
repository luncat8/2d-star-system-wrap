# findings / pitfalls / skills

## wrap projection

- selected body's orbit passes through its own center (d=0): log(0) is -inf. clamp d to 1e-6 and clamp u to [0,1]. do not skip the orbit: the draft wants projection-only, skipping is a scene change. break the polyline when screen X jumps > W*0.25 (azimuth seam at ±pi).
- Y is log distance from the selected body: a body at constant distance from it (a selected moon's parent planet) is horizontal; the selected body's own orbit is a curve through it. a moon on a circular orbit around the selected planet is the horizontal case.
- ground side switch (planet <-> star/moon): scroll, do not lerp the band across the screen. old band exits to its own edge, new band enters from the opposite edge, both 10vh, middle stays clear. direction from the target side (planet -> up, star/moon -> down). same side keeps the lerped band and the 64-step soil LUT; no per-frame string build.
- wrap->wrap morph: keep dmaxFrom (old smoothed) and dmaxTo (new target, set immediately) separate, plus separate logDmin/logRange per side, else the old view jumps at t=0.
- wrap->wrap re-center: the outgoing selected body is the ground (never drawn) at t=0, so draw it rising with ry = r*eased (drawRise). skipping it for the whole morph leaves it invisible, then it pops in at full size on the completion frame.
- X uses one angular scale for every body: 2*pi -> W. that is the selected body's perimeter unrolled; other bodies get alpha/(2*pi)*W, clamped per class.
- wrap-x is periodic: lerp it on the short arc (wrap delta into [-W/2,W/2], then wrap the result into [0,W)). raw lerp sends any body near the +-pi seam the long way through the screen center. only wrap->wrap; map->wrap X is linear, shortest-arc would teleport edge bodies.
- no browser/puppeteer/playwright in the sandbox. a stub canvas Proxy plus vm concatenation of the source files runs the real boot/frame/input path headless.

## drag to wrap

- the drag is a scrubbed transition, not a camera pan: same from/to/eased projection as a click, driven by the pointer's distance to the target's ground edge (planet down, star/moon up). no map camera, no log-window offset.
- use e = p (linear) while dragging; ease only the release settle. an eased scrub lags the finger and jumps when the settle starts.
- start the scrub on pointerdown so a click is reliable; at e=0 the target is drawn via drawFlatten, so fade the star glow with 1-e and hide the map-edge wrap line (there is no from line), otherwise the press pops.
- drag progress is a fraction of the distance to the ground edge, so a body already near its ground needs only a short drag; the slop and p > 0.5 threshold keep a click from wrapping.
