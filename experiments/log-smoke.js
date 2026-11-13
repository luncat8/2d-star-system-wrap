// owns: logarithmic projection and interaction smoke checks
// edit for: camera, selection, drag and free-flight invariants

const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const calls = [];
const ctx = { setTransform() {}, fillRect() {}, beginPath() { calls.push([]); },
	moveTo(x, y) { calls.at(-1).push([x, y]); }, lineTo(x, y) { calls.at(-1).push([x, y]); },
	closePath() {}, fill() {}, stroke() {}, fillText() {} };
function element() { return { style: {}, value: '', textContent: '', children: [], listeners: {},
	addEventListener(type, fn) { this.listeners[type] = fn; }, appendChild(x) { this.children.push(x); },
	getContext() { return ctx; }, setPointerCapture() {} }; }
const els = Object.fromEntries(['c', 'bodyChoice', 'followBody', 'resetView', 'viewStatus'].map(id => [id, element()]));
let raf;
const sandbox = { console, document: { getElementById: id => els[id], createElement: element },
	window: { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, addEventListener() {} },
	requestAnimationFrame: cb => { raf = cb; } };
vm.createContext(sandbox);
vm.runInContext(scripts.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n') +
	'\n;globalThis.api = { camera, cameraProject, cameraUnproject, cameraFollow, cameraStep, cameraReset, system, view, inputDown, inputMove, inputUp, inputPick, inputFlight, inputKeyDown, inputKeyUp, renderEnclosingBody, renderCurve, curveX, curveY, LOG_TAU };', sandbox);
const a = sandbox.api;
let fails = 0;
function check(ok, name) { if (!ok) { console.error('fail=' + name); fails++; } }
function near(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }
function pointer(x, y) { return { clientX: x, clientY: y, pointerId: 1, button: 0 }; }
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
check(near(a.camera.scale * a.LOG_TAU, a.view.w), 'one circumference');
a.cameraProject(a.system.wx[i], a.system.wy[i] + a.system.radius[i]);
check(near(a.camera.x, a.view.w / 2) && near(a.camera.y, a.view.h * 0.86), 'surface at bottom');
calls.length = 0; a.renderEnclosingBody(ctx, i);
const boundary = calls[0].slice(0, 257);
check(boundary.every(p => near(p[1], a.view.h * 0.86)), 'projected surface is flat');
const key = k => ({ key: k, target: { tagName: 'BODY' }, preventDefault() {} });
const oldX = a.system.wx[i], oldY = a.system.wy[i];
a.inputKeyDown(key('d')); a.inputKeyDown(key('w')); a.inputFlight(1000); a.inputKeyUp(key('d')); a.inputKeyUp(key('w')); a.cameraStep(2000);
check(a.system.wx[i] > oldX && a.system.wy[i] > oldY && near(a.camera.px, a.system.wx[i]) && near(a.camera.py, a.system.wy[i]), 'free flight follow');
for (const size of [[1200, 800], [420, 900]]) {
	a.view.w = size[0]; a.view.h = size[1];
	for (const body of [0, 3, 7]) {
		a.cameraReset(); a.cameraFollow(body, 0); a.cameraStep(1800);
		a.cameraProject(a.system.wx[body], a.system.wy[body] + a.system.radius[body]);
		check(near(a.camera.x, size[0] / 2) && near(a.camera.y, size[1] * 0.86), 'all bodies below sky');
		calls.length = 0; a.renderEnclosingBody(ctx, body);
		check(calls[0].slice(0, 257).every(p => near(p[1], size[1] * 0.86)), 'all surfaces projected');
	}
}
a.view.w = 1200; a.view.h = 800;
a.cameraReset(); a.inputDown(pointer(600, 200));
a.cameraUnproject(600, 200); const wx = a.camera.x, wy = a.camera.y;
for (let y = 210; y <= 700; y += 10) {
	a.inputMove(pointer(620, y)); a.cameraProject(wx, wy);
	check(near(a.camera.x, 620) && near(a.camera.y, y), 'drag anchor');
	check(Number.isFinite(a.camera.ox) && Number.isFinite(a.camera.oy), 'drag finite');
}
check(near(a.camera.scale * a.LOG_TAU, a.view.w), 'drag unwraps');
a.inputUp(pointer(620, 700));
check(a.camera.target === -1, 'drag cancels follow');
a.cameraProject(wx + 1, wy + 1); const px = a.camera.x, py = a.camera.y;
a.cameraUnproject(px, py); check(near(a.camera.x, wx + 1) && near(a.camera.y, wy + 1), 'inverse wrap');
raf(2100);
check(calls.flat().every(p => p.every(Number.isFinite)), 'render finite');
console.log('log_smoke result=' + (fails ? 'fail' : 'pass') + ' fails=' + fails);
if (fails) process.exitCode = 1;
