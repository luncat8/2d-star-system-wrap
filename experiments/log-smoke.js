// owns: logarithmic projection and interaction smoke checks
// edit for: camera, selection, drag and free-flight invariants

const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^\"]+)\"><\/script>/g)].map(m => m[1]);
const calls = [], texts = [];
const ctx = { setTransform() {}, fillRect() {}, beginPath() { calls.push([]); },
	moveTo(x, y) { calls.at(-1).push([x, y]); }, lineTo(x, y) { calls.at(-1).push([x, y]); },
	closePath() {}, fill() {}, stroke() {}, strokeText() {}, fillText(t) { texts.push(t); } };
function element() { return { style: {}, value: '', textContent: '', children: [], listeners: {},
	addEventListener(type, fn) { this.listeners[type] = fn; }, appendChild(x) { this.children.push(x); },
	getContext() { return ctx; }, setPointerCapture() {} }; }
const els = Object.fromEntries(['c', 'bodyChoice', 'followBody', 'resetView', 'viewStatus'].map(id => [id, element()]));
let raf;
const sandbox = { console, document: { getElementById: id => els[id], createElement: element },
	window: { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, addEventListener() {} },
	requestAnimationFrame: cb => { raf = cb; } };
vm.createContext(sandbox);
vm.runInContext('"use strict";\n' + scripts.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n') +
	'\n;globalThis.api = { camera, anchor, system, view, interiorProfiles, inputDown, inputMove, inputUp, inputPick, inputFlight, inputKeyDown, inputKeyUp, renderEnclosingBody, renderLayerLabels, renderCurve, curveX, curveY, renderFrame, renderGroundIndex, cameraProject, cameraUnproject, cameraFollow, cameraStep, cameraReset, cameraFitScale, cameraFitDamped, cameraFitRange, fit, FIT_MS, FIT_GROW_MS, FIT_HOLD_MS, FIT_CLOSE_MS, FIT_CLOSE_RATIO, LOG_TAU, GROUND, GROUND_BODY, TOP };', sandbox);
const a = sandbox.api;
let fails = 0;
function check(ok, name) { if (!ok) { console.error('fail=' + name); fails++; } }
function near(x, y, eps = 1e-6) { return Math.abs(x - y) < eps; }
function pointer(x, y) { return { clientX: x, clientY: y, pointerId: 1, button: 0 }; }
// every non-ground body's far edge stays below the top margin; the ground body
// (disk containing the pole) is buried by design and may sink under the horizon
function farTopY(except) {
	let min = Infinity;
	for (let j = 0; j < a.system.nb; j++) {
		if (j === except) continue;
		const dx = a.system.wx[j] - a.camera.px, dy = a.system.wy[j] - a.camera.py;
		const d = Math.hypot(dx, dy), r = a.system.radius[j];
		if (d < r) continue;
		a.cameraProject(a.system.wx[j] + r * dx / d, a.system.wy[j] + r * dy / d);
		min = Math.min(min, a.camera.y);
	}
	return min;
}
function fitted(except, name) {
	for (let j = 0; j < a.system.nb; j++) {
		if (j === except) continue;
		const dx = a.system.wx[j] - a.camera.px, dy = a.system.wy[j] - a.camera.py;
		const d = Math.hypot(dx, dy), r = a.system.radius[j];
		if (d < r) continue;
		a.cameraProject(a.system.wx[j] + r * dx / d, a.system.wy[j] + r * dy / d);
		check(a.camera.y >= -2, name + ' ' + j);
	}
}
raf(100);
for (const point of [[0, 0], [1.5, -0.7], [-3, 2]]) {
	a.cameraProject(...point); const x = a.camera.x, y = a.camera.y;
	a.cameraUnproject(x, y);
	check(near(a.camera.x, point[0]) && near(a.camera.y, point[1]), 'inverse overview');
}
const i = a.system.nb - 1;
a.cameraProject(a.system.wx[i], a.system.wy[i]);
const bodyX = a.camera.x, bodyY = a.camera.y;
check(a.inputPick(bodyX, bodyY) === i, 'pick visible body');
a.inputDown(pointer(bodyX, bodyY)); a.inputUp(pointer(bodyX, bodyY));
check(a.camera.target === i, 'click follows');
for (let t = 100; t <= 1900; t += 20) {
	a.cameraStep(t);
	a.cameraProject(a.system.wx[i], a.system.wy[i] + a.system.radius[i]);
	check(Number.isFinite(a.camera.x) && Number.isFinite(a.camera.y), 'transition finite');
}
check(near(a.camera.px, a.system.wx[i]) && near(a.camera.py, a.system.wy[i]), 'follow pole');
a.cameraProject(a.system.wx[i], a.system.wy[i] + a.system.radius[i]);
check(near(a.camera.x, a.view.w / 2) && near(a.camera.y, a.view.h * a.GROUND_BODY), 'surface at body line');
check(near(farTopY(i), a.view.h * a.TOP), 'farthest body at top margin');
fitted(i, 'follow fits');
calls.length = 0; a.renderEnclosingBody(ctx, i);
const bands = a.interiorProfiles[a.system.profile[i]].bands;
const air = a.interiorProfiles[a.system.profile[i]].air;
check(calls.length === bands.length + 1, 'one fill per band plus air');
// a band is the strip between its boundary and the next one, not a repaint of everything below
check(calls.slice(1, -1).every(c => c.length === 514), 'band strips span both boundaries');
check(near(calls.at(-1).at(-1)[1], a.view.h + 1), 'deepest band reaches the bottom');
const airY = a.camera.oy - a.camera.scale * Math.log(a.system.radius[i] * air);
check(calls[0].slice(0, 257).every(p => near(p[1], airY)), 'air above surface');
check(calls[0].slice(257).every(p => near(p[1], a.camera.oy - a.camera.scale * Math.log(a.system.radius[i]))), 'air band meets surface');
check(near(a.camera.oy - a.camera.scale * Math.log(a.system.radius[i]) - airY, a.camera.scale * Math.log(air)), 'air log height');
for (let b = 0; b < bands.length; b++) {
	const rTop = b ? bands[b - 1].inner * a.system.radius[i] : a.system.radius[i];
	const y = a.camera.oy - a.camera.scale * Math.log(rTop);
	check(calls[b + 1].slice(0, 257).every(p => near(p[1], y)), 'flat band boundary ' + b);
	if (!b) continue;
	const yPrev = a.camera.oy - a.camera.scale * Math.log(b === 1 ? a.system.radius[i] : bands[b - 2].inner * a.system.radius[i]);
	check(Math.abs((calls[b + 1][0][1] - yPrev) - a.camera.scale * Math.log((b === 1 ? 1 : bands[b - 2].inner) / bands[b - 1].inner)) < 1e-6, 'log depth band ' + b);
}
texts.length = 0; a.renderLayerLabels(ctx, i);
check(texts.join('|') === 'atmosphere|mantle|outer core|inner core', 'layer labels');
const key = k => ({ key: k, target: { tagName: 'BODY' }, preventDefault() {} });
const oldX = a.system.wx[i], oldY = a.system.wy[i];
a.inputKeyDown(key('d')); a.inputKeyDown(key('w')); a.inputFlight(1000); a.inputKeyUp(key('d')); a.inputKeyUp(key('w')); a.cameraStep(2000);
check(a.system.wx[i] > oldX && a.system.wy[i] > oldY && near(a.camera.px, a.system.wx[i]) && near(a.camera.py, a.system.wy[i]), 'free flight follow');
fitted(i, 'flight refits');
// fit damping: sampled every FIT_MS, widens at once, holds a swing, closes fast when far off
const keepX = a.system.wx[i], keepY = a.system.wy[i];
a.fit.ready = false; a.cameraStep(3000);
const baseRange = a.fit.range;
a.fit.range = baseRange * 0.5; a.fit.target = baseRange; a.fit.at = 0; a.fit.time = 3000;
a.cameraStep(3100);
const growFrac = (a.fit.range - baseRange * 0.5) / (baseRange * 0.5);
check(near(a.fit.target, baseRange) && growFrac > 0.2, 'fit span grows fast');
a.fit.range = baseRange * 1.1; a.fit.target = baseRange; a.fit.at = 0; a.fit.time = 3200;
a.cameraStep(3300);
const holdFrac = (baseRange * 1.1 - a.fit.range) / (baseRange * 0.1);
a.fit.range = baseRange * 3; a.fit.target = baseRange; a.fit.at = 0; a.fit.time = 3400;
a.cameraStep(3500);
const closeFrac = (baseRange * 3 - a.fit.range) / (baseRange * 2);
check(holdFrac < 0.01 && closeFrac > holdFrac * 20 && closeFrac < growFrac, 'fit span holds, then closes');
a.fit.ready = false; a.cameraStep(4100);
check(near(a.camera.scale, a.cameraFitScale(keepX, keepY, a.system.radius[i], a.GROUND_BODY)), 'fit reseeds exact');
for (const size of [[1200, 800], [420, 900]]) {
	a.view.w = size[0]; a.view.h = size[1];
	for (const body of [0, 3, 7]) {
		a.cameraReset(); a.cameraFollow(body, 0); a.cameraStep(1800);
		a.cameraProject(a.system.wx[body], a.system.wy[body] + a.system.radius[body]);
		check(near(a.camera.x, size[0] / 2) && near(a.camera.y, size[1] * a.GROUND_BODY), 'all bodies below sky');
		check(near(farTopY(body), size[1] * a.TOP), 'top margin ' + size[0]);
		fitted(body, 'fit ' + size[0] + 'x' + size[1] + ' body ' + body);
		calls.length = 0; a.renderEnclosingBody(ctx, body);
		const profile = a.interiorProfiles[a.system.profile[body]];
		check(calls.length === profile.bands.length + 1, 'bands ' + body);
		check(calls[1].slice(0, 257).every(p => near(p[1], size[1] * a.GROUND_BODY)), 'all surfaces projected');
	}
}
a.view.w = 1200; a.view.h = 800;
const profileLabels = ['atmosphere|mantle|outer core|inner core', 'corona|convective zone|radiative zone|core', 'atmosphere|envelope|metallic hydrogen|core'];
for (let body = 0; body < a.system.nb; body++) {
	a.cameraReset(); a.cameraFollow(body, 0); a.cameraStep(1800);
	calls.length = 0; a.renderEnclosingBody(ctx, body);
	check(calls.length === a.interiorProfiles[a.system.profile[body]].bands.length + 1, 'profile bands ' + body);
	texts.length = 0; a.renderLayerLabels(ctx, body);
	check(texts.join('|') === profileLabels[a.system.profile[body]], 'profile labels ' + body);
}
// the orbit under the pole is singular: while following, the body's own orbit is not drawn
let drawn = [];
sandbox.__drawn = drawn;
sandbox.__nativeCurve = a.renderCurve;
vm.runInContext('renderCurve = function (cx, cy, r) { __drawn.push([cx, cy, r]); __nativeCurve(cx, cy, r); };', sandbox);
a.cameraReset(); a.cameraFollow(3, 0); a.cameraStep(1800);
check(a.renderGroundIndex() === 3, 'ground is the followed body');
drawn = sandbox.__drawn;
drawn.length = 0; a.renderFrame();
check(drawn.some(c => c[2] === a.system.orbitA[1]), 'other orbits drawn');
check(!drawn.some(c => c[2] === a.system.orbitA[3] && c[0] === a.system.wx[0] && c[1] === a.system.wy[0]), 'own orbit skipped');
vm.runInContext('renderCurve = __nativeCurve;', sandbox);
a.cameraReset(); a.inputDown(pointer(600, 200));
a.cameraUnproject(600, 200); const wx = a.camera.x, wy = a.camera.y;
for (let y = 210; y <= 700; y += 10) {
	a.inputMove(pointer(620, y)); a.cameraProject(wx, wy);
	check(near(a.camera.x, 620) && near(a.camera.y, y), 'drag anchor');
	check(Number.isFinite(a.camera.ox) && Number.isFinite(a.camera.oy), 'drag finite');
}
check(near(a.camera.px, a.anchor.qx) && near(a.camera.py, a.anchor.qy), 'drag pole ground');
check(near(a.camera.scale, a.cameraFitScale(a.anchor.qx, a.anchor.qy, a.anchor.ref, a.GROUND)), 'drag fit scale');
fitted(-1, 'drag fits');
a.inputUp(pointer(620, 700));
check(a.camera.target === -1, 'drag cancels follow');
a.cameraReset();
a.cameraProject(a.system.wx[3], a.system.wy[3]);
const bx = a.camera.x - a.LOG_TAU * a.camera.scale * Math.round((a.camera.x - a.view.w / 2) / (a.LOG_TAU * a.camera.scale));
const by = a.camera.y, r3 = a.system.radius[3];
a.inputDown(pointer(bx, by));
a.inputMove(pointer(bx + 40, a.view.h * a.GROUND_BODY + 200));
a.cameraProject(a.system.wx[3], a.system.wy[3] + r3);
check(near(a.camera.x, bx + 40) && near(a.camera.y, a.view.h * a.GROUND_BODY + 200), 'body drag anchors surface');
check(near(a.camera.px, a.system.wx[3]) && near(a.camera.py, a.system.wy[3]), 'body drag pole centre');
fitted(3, 'body drag fits');
a.inputUp(pointer(bx + 40, a.view.h * a.GROUND_BODY + 200));
// pole off the body centre: a band whose inner sphere no longer contains it runs to the bottom
a.camera.px = a.system.wx[3] + r3 * 0.4; a.camera.py = a.system.wy[3];
calls.length = 0; a.renderEnclosingBody(ctx, 3);
check(calls.flat().every(p => p.every(Number.isFinite)), 'off-centre bands finite');
a.cameraProject(wx + 1, wy + 1); const px = a.camera.x, py = a.camera.y;
a.cameraUnproject(px, py); check(near(a.camera.x, wx + 1) && near(a.camera.y, wy + 1), 'inverse wrap');
raf(2100);
check(calls.flat().every(p => p.every(Number.isFinite)), 'render finite');
console.log('log_smoke result=' + (fails ? 'fail' : 'pass') + ' fails=' + fails);
if (fails) process.exitCode = 1;
