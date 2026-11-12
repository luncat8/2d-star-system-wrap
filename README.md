# 2d star system wrap

2d solar system that unrolls any body's surface into a flat wrapping horizon.
click a body: 3s morph flies there and wraps around it — planet soil at the bottom,
star/moon soil at the top, X wraps (perimeter = screen width), Y = log altitude, auto-fit.
the checkbox toggles flat (centered 2d, linear scale) vs wrap projection. view only, no physics.

## run

open index.html in a browser (file:// works), or serve the folder: python3 -m http.server.
validate: node experiments/smoke.js
