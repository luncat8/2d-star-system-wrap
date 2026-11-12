#!/usr/bin/env node
// owns: headless smoke for projection and drag-to-wrap scrub (math + stub-canvas boot)
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

view.selected = -1;
trans.active = false;
trans.from = -1;
trans.to = -1;
trans.drag = false;
trans.settle = false;
ok(startScrub(1) === true, 'scrub starts on a body');
ok(trans.active && trans.drag && trans.from === -1 && trans.to === 1, 'scrub from map to planet');
ok(view.selected === -1, 'scrub start keeps the current selection');
scrubTo(0.5);
updateTransition(0.2);
near(trans.t, 0.5, 1e-9, 'drag holds the scrub progress');
near(trans.eased, 0.5, 1e-9, 'drag drives eased directly');
near(trans.line, H + (H * 0.9 - H) * 0.5, 1e-6, 'scrub line follows the progress');
settleTransition(1);
guard = 0;
while (trans.active && guard++ < 1000) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
ok(!trans.active && view.selected === 1, 'scrub past halfway settles into wrap');
near(trans.eased, 1, 1e-6, 'scrub settle reaches full wrap');
near(trans.line, H * 0.9, 1e-6, 'scrub settle final line');

view.selected = -1;
trans.active = false;
trans.from = -1;
trans.to = -1;
trans.drag = false;
trans.settle = false;
startScrub(1);
scrubTo(0.4);
settleTransition(0);
guard = 0;
while (trans.active && guard++ < 1000) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
ok(!trans.active && view.selected === -1, 'scrub below halfway returns to the map');
near(trans.eased, 0, 1e-6, 'scrub cancel reaches the map state');

view.selected = -1;
trans.active = false;
trans.from = -1;
trans.to = -1;
trans.drag = false;
trans.settle = false;
startScrub(1);
continueAsClick();
ok(trans.active && !trans.drag && view.selected === 1, 'no-drag release continues as a click');
ok(trans.t === 0 && trans.eased === 0, 'click continuation starts from the map');
guard = 0;
while (trans.active && guard++ < 1000) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
ok(!trans.active && view.selected === 1, 'click continuation completes');

view.selected = 1;
trans.active = false;
trans.from = -1;
trans.to = -1;
trans.drag = false;
trans.settle = false;
updateTransition(0);
updateProjection(0.016);
ok(startScrub(0) === true, 'scrub starts from wrap');
ok(trans.from === 1 && trans.to === 0 && view.selected === 1, 'wrap scrub keeps the current selection');
scrubTo(0.25);
updateTransition(0.016);
near(trans.eased, 0.25, 1e-9, 'wrap scrub drives eased directly');
settleTransition(0);
guard = 0;
while (trans.active && guard++ < 1000) {
	updateTransition(1 / 60);
	updateProjection(1 / 60);
}
ok(!trans.active && view.selected === 1, 'wrap scrub cancel keeps the original body');
console.log('projection smoke pass');
`;
	vm.runInNewContext(test, { console, Math, Float32Array, isFinite, Infinity, NaN });
}

function domSmoke() {
	const order = ['js/world.js', 'js/projection.js', 'js/render.js', 'js/transition.js', 'js/input.js', 'js/main.js'];
	const src = order.map(read).join('\n') + '\n globalThis.__state = { world, trans, view, proj };';
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
	const fire = (type, x, y) => { for (const fn of listeners[type] || []) fn({ clientX: x, clientY: y }); };
	const down = (x, y) => fire('pointerdown', x, y);
	const move = (x, y) => fire('pointermove', x, y);
	const up = (x, y) => fire('pointerup', x, y);
	const click = (x, y) => { down(x, y); up(x, y); };
	const run = () => { for (let i = 0; i < 200 && S.trans.active; i++) frame(t += 16); };

	down(50, 50);
	move(150, 150);
	up(150, 150);
	ok(!S.trans.active, 'drag on empty space does nothing');

	down(target.sx, target.sy);
	move(target.sx + 1, target.sy + 1);
	move(target.sx, target.sy + 50);
	ok(S.trans.active && S.trans.drag, 'drag starts a scrub');
	ok(S.trans.eased > 0 && S.trans.eased < 0.5, 'short drag scrubs below halfway');
	ok(S.view.selected === -1, 'scrub does not select before release');
	up(target.sx, target.sy + 50);
	ok(!S.trans.drag && S.trans.settle, 'short drag settles back');
	frame(t += 16);
	run();
	ok(!S.trans.active && S.view.selected === -1, 'short drag returns to the map');
	ok(Math.abs(S.trans.eased) < 1e-6, 'scrub cancel reaches the map state');

	const yTo = target.sy + (S.view.H - target.sy) * 0.7;
	down(target.sx, target.sy);
	move(target.sx + 1, target.sy + 1);
	move(target.sx, yTo);
	ok(S.trans.active && S.trans.drag, 'long drag starts a scrub');
	ok(S.trans.eased > 0.5, 'long drag scrubs past halfway');
	up(target.sx, yTo);
	ok(!S.trans.drag && S.trans.settle, 'long drag settles forward');
	run();
	ok(!S.trans.active && S.view.selected === 1, 'long drag settles into wrap');
	ok(S.trans.groundTop === 800 * 0.9 && S.trans.groundBot === 800, 'ground at bottom');
	ok(!S.trans.drag && !S.trans.settle, 'scrub state clears');

	click(S.world.bodies[2].sx, S.world.bodies[2].sy);
	ok(S.trans.active && S.trans.to === 2 && !S.trans.drag, 'click starts transition');
	click(S.world.bodies[0].sx, S.world.bodies[0].sy);
	ok(S.trans.to === 2, 'click during transition ignored');
	run();
	ok(!S.trans.active && S.view.selected === 2, 'transition completes');
	ok(S.trans.groundTop === 800 * 0.9 && S.trans.groundBot === 800, 'ground at bottom');

	click(S.world.bodies[0].sx, S.world.bodies[0].sy);
	ok(S.trans.active && S.trans.to === 0, 're-center to star starts');
	const toBefore = S.trans.to;
	down(100, 100);
	move(200, 200);
	up(200, 200);
	ok(S.trans.to === toBefore && !S.trans.drag, 'drag during transition ignored');
	run();
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

	const star = S.world.bodies[0];
	down(star.sx, star.sy);
	move(star.sx + 1, star.sy + 1);
	move(star.sx, star.sy * 0.3);
	ok(S.trans.active && S.trans.drag && S.trans.from === 1 && S.trans.to === 0, 'wrap drag starts a scrub');
	ok(S.trans.eased > 0.5, 'wrap drag scrubs past halfway');
	up(star.sx, star.sy * 0.3);
	run();
	ok(!S.trans.active && S.view.selected === 0, 'wrap drag settles onto the star');

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