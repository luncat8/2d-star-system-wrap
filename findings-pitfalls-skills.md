# findings / pitfalls / skills

## wrap projection

- selected body's orbit passes through its own center (d=0): log(0) is -inf. clamp d to 1e-6 and clamp u to [0,1]. do not skip the orbit: the draft wants projection-only, skipping is a scene change. break the polyline when screen X jumps > W*0.25 (azimuth seam at ±pi).
- Y is log distance from the selected body: a body at constant distance from it (a selected moon's parent planet) is horizontal; the selected body's own orbit is a curve through it. a moon on a circular orbit around the selected planet is the horizontal case.
- ground side switch (planet <-> star/moon): scroll, do not lerp the band across the screen. old band exits to its own edge, new band enters from the opposite edge, both 10vh, middle stays clear. direction from the target side (planet -> up, star/moon -> down). same side keeps the lerped band and the 64-step soil LUT; no per-frame string build.
- wrap->wrap morph: keep dmaxFrom (old smoothed) and dmaxTo (new target, set immediately) separate, plus separate logDmin/logRange per side, else the old view jumps at t=0.
- wrap->wrap re-center: the outgoing selected body is the ground (never drawn) at t=0, so draw it rising with ry = r*eased (drawRise). skipping it for the whole morph leaves it invisible, then it pops in at full size on the completion frame.
- X uses one angular scale for every body: 2*pi -> W. that is the selected body's perimeter unrolled; other bodies get alpha/(2*pi)*W, clamped per class.
- wrap-x is periodic: lerp it on the short arc (wrap delta into [-W/2,W/2], then wrap the result into [0,W)). raw lerp sends any body near the +-pi seam the long way through the screen center. only wrap->wrap; map->wrap X is linear, shortest-arc would teleport edge bodies.
- no browser/puppeteer/playwright in the sandbox. a stub canvas Proxy plus vm concatenation of all six files runs the real boot/frame/input path headless.
