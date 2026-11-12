#!/usr/bin/env node
// owns: headless smoke for plan 0.1 (projection math + stub-canvas boot)
// edit for: smoke assertions

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

function projectionSmoke() {
	const files = ['js/world.js', 'js/transition.js', 'js/projection.js'].map(read);
	const test = `
const view = { W: 1200, H: 800, selected: -1 };
${files.join('\n')}
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); console.log('ok - ' + m); }
function near(a, b, e, m) { if (Math.abs(a - b) > e) throw new Error('FAIL: ' + m + ' got ' + a + ' want ' + b); console.log('ok - ' + m); }

initWorld();
ok(world.bodies.length === 10, 'body count 10');
ok(world.orbits.length === 9, 'orbit count 9');
ok(world.systemRadius === 1100, 'systemRadius 1100');

initProjection();
updateWorld(0);
const W = view.W;
const H = view.H;
const p = { x: 0, y: 0 };

mapProject(0, 0, p);
near(p.x, W / 2, 1e-9, 'map star x center');
near(p.y, H / 2, 1e-9, 'map star y center');

view.selected = 1;
updateTransition(0);
updateProjection(0.016);
const line = trans.line;
near(line, H * 0.9, 1e-9, 'planet line at 90% height');
near(trans.groundTop, H * 0.9, 1e-9, 'planet ground top');
near(trans.groundBot, H, 1e-9, 'planet ground bottom');

projectPoint(world.bodies[1].x, world.bodies[1].y, p);
near(p.x, W / 2, 1e-9, 'selected body x center');
near(p.y, line, 1e-9, 'selected body on line');

projectPoint(0, 0, p);
ok(p.y < line, 'star above planet line');

const moonOrbit = world.orbits[4];
ok(moonOrbit.center === 1 && moonOrbit.sat === 5, 'moon orbit around planet A');
let ymin = Infinity;
let ymax = -Infinity;
for (let i = 0; i < moonOrbit.N; i++) {
	projectPoint(world.bodies[1].x + moonOrbit.rel[i * 2], world.bodies[1].y + moonOrbit.rel[i * 2 + 1], p);
	if (p.y < ymin) ymin = p.y;
	if (p.y > ymax) ymax = p.y;
}
near(ymax - ymin, 0, 1e-3, 'circular moon orbit horizontal');

for (let i = 0; i < world.bodies.length; i++) {
	projectPoint(world.bodies[i].x, world.bodies[i].y, p);
	if (!isFinite(p.x) || !isFinite(p.y)) throw new Error('FAIL: body ' + i + ' not finite');
}
console.log('ok - all body projections finite');

const s = world.bodies[1];
projectPoint(s.x - 1000, s.y + 0.001, p);
const xLeft = p.x;
projectPoint(s.x - 1000, s.y - 0.001, p);
ok(xLeft > W * 0.9 && p.x < W * 0.1, 'azimuth seam wraps');

view.selected = -1;
trans.active = false;
trans.from = -1;
trans.to = -1;
initProjection();
startTransition(1);
let steps = 0;
while (trans.active && steps < 1000) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
	steps++;
}
ok(!trans.active, '3 s transition finished');
near(trans.line, H * 0.9, 1e-6, 'final planet line');
near(trans.groundBot - trans.groundTop, H * 0.1, 1e-6, 'final planet soil 10vh');

startTransition(0);
let guard = 0;
while (trans.active && trans.eased < 0.5 && guard++ < 1000) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
ok(trans.fromGroundTop >= H * 0.9 - 1e-6 && trans.groundBot <= H * 0.1 + 1e-6, 'planet->star ground stays at edges');
while (trans.active) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
near(trans.line, H * 0.1, 1e-6, 'star line at 10% height');
near(trans.groundBot - trans.groundTop, H * 0.1, 1e-6, 'star soil 10vh');

startTransition(1);
guard = 0;
while (trans.active && trans.eased < 0.5 && guard++ < 1000) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
ok(trans.fromGroundBot <= H * 0.1 + 1e-6 && trans.groundTop >= H * 0.9 - 1e-6, 'star->planet ground stays at edges');
while (trans.active) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
near(trans.line, H * 0.9, 1e-6, 'planet line at 90% height');

startTransition(5);
while (trans.active) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
near(trans.line, H * 0.1, 1e-6, 'moon line at 10% height');

view.selected = 1;
trans.active = false;
trans.from = -1;
trans.to = -1;
updateTransition(0);
updateProjection(1);
const prevX = [];
const cum = [];
for (let i = 0; i < world.bodies.length; i++) {
	projectPoint(world.bodies[i].x, world.bodies[i].y, p);
	prevX.push(p.x);
	cum.push(0);
}
startTransition(0);
while (trans.active) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
	for (let i = 0; i < world.bodies.length; i++) {
		projectPoint(world.bodies[i].x, world.bodies[i].y, p);
		let dx = p.x - prevX[i];
		if (dx > W / 2) dx -= W;
		if (dx < -W / 2) dx += W;
		cum[i] += Math.abs(dx);
		prevX[i] = p.x;
	}
}
let maxCum = 0;
for (let i = 0; i < cum.length; i++) if (cum[i] > maxCum) maxCum = cum[i];
ok(maxCum <= W / 2 + 1, 'wrap->wrap X takes the short arc');
console.log('projection smoke pass');
`;
	vm.runInNewContext(test, { console, Math, Float32Array, isFinite, Infinity, NaN });
}

function domSmoke() {
	const order = ['js/world.js', 'js/projection.js', 'js/render.js', 'js/transition.js', 'js/input.js', 'js/main.js'];
	const src = order.map(read).join('\n') + '\n globalThis.__state = { world, trans, view };';
	let rafCb = null;
	const calls = {};
	const ellipses = [];
	const ctx = new Proxy({}, {
		get(t, k) {
			if (k in t) return t[k];
			if (k === 'ellipse') return (...a) => { calls.ellipse = (calls.ellipse || 0) + 1; ellipses.push(a); };
			return () => { calls[k] = (calls[k] || 0) + 1; };
		},
		set(t, k, v) { t[k] = v; return true; },
	});
	const listeners = {};
	const winListeners = {};
	const canvas = {
		width: 0,
		height: 0,
		style: {},
		getContext: () => ctx,
		addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
	};
	const window = {
		innerWidth: 1200,
		innerHeight: 800,
		devicePixelRatio: 1,
		addEventListener: (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); },
	};
	const sandbox = {
		console, Math, Float32Array, isFinite, Infinity, NaN, parseInt,
		document: { getElementById: id => (id === 'c' ? canvas : null) },
		window,
		requestAnimationFrame: cb => { rafCb = cb; return 1; },
	};
	vm.runInNewContext(src, sandbox, { filename: 'bundle.js' });

	const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('ok - ' + m); };
	const frame = t => { const cb = rafCb; rafCb = null; if (!cb) throw new Error('no raf'); cb(t); };
	const S = sandbox.__state;

	let t = 0;
	frame(t += 16);
	ok(canvas.width === 1200 && canvas.height === 800, 'canvas sized');
	ok(calls.fillRect > 0 && calls.arc > 0, 'draw calls issued');

	const target = S.world.bodies[1];
	const click = (x, y) => { for (const fn of listeners.pointerdown || []) fn({ clientX: x, clientY: y }); };
	click(target.sx, target.sy);
	ok(S.trans.active && S.trans.to === 1, 'click starts transition');
	click(S.world.bodies[2].sx, S.world.bodies[2].sy);
	ok(S.trans.to === 1, 'click during transition ignored');
	for (let i = 0; i < 200 && S.trans.active; i++) frame(t += 16);
	ok(!S.trans.active && S.view.selected === 1, 'transition completes');
	ok(S.trans.groundTop === 800 * 0.9 && S.trans.groundBot === 800, 'ground at bottom');

	click(S.world.bodies[0].sx, S.world.bodies[0].sy);
	for (let i = 0; i < 200 && S.trans.active; i++) frame(t += 16);
	ok(S.view.selected === 0 && S.trans.groundTop === 0, 're-center to star');

	click(S.world.bodies[1].sx, S.world.bodies[1].sy);
	ok(S.trans.active && S.trans.to === 1, 'wrap->wrap starts');
	let rose = false;
	for (let i = 0; i < 200 && S.trans.active; i++) {
		ellipses.length = 0;
		frame(t += 16);
		const s = S.world.bodies[0];
		for (let j = 0; j < ellipses.length; j++) {
			const e = ellipses[j];
			if (e[0] === s.sx && e[1] === s.sy && e[3] > 0 && e[3] < e[2]) rose = true;
		}
	}
	ok(rose, 'outgoing body rises during wrap->wrap');

	sandbox.window.innerWidth = 900;
	sandbox.window.innerHeight = 600;
	for (const fn of winListeners.resize || []) fn();
	frame(t += 16);
	ok(canvas.width === 900 && S.view.W === 900, 'resize updates canvas and view');

	for (let i = 0; i < 600; i++) frame(t += 16);
	ok(isFinite(S.world.t), 'long run stable');
	console.log('dom smoke pass');
}

projectionSmoke();
domSmoke();