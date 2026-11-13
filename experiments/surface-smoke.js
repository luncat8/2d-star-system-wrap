// owns: surface geometry and settings integration checks
// edit for: transition controls, replay and edge geometry

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
let calls = [];
const ctx = {
	setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {},
	fill() { calls.push('fill'); }, stroke() { calls.push('stroke'); }, arc() {}, fillText() {},
};
function element(value = '') {
	return { value, checked: false, style: {}, listeners: {}, children: [],
		addEventListener(type, fn) { this.listeners[type] = fn; },
		appendChild(child) { this.children.push(child); },
		getContext() { return ctx; },
		dispatch(type) { this.listeners[type]({ target: this }); } };
}
const ids = ['c', 'wrapBox', 'stageSplit', 'stageValue', 'skyWait', 'soilStart', 'strokeOver', 'previewBody', 'previewTransition'];
const els = Object.fromEntries(ids.map(id => [id, element()]));
els.stageSplit.value = '35';
let raf;
const sandbox = { document: { getElementById: id => els[id], createElement: () => element() },
	window: { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, addEventListener() {} },
	requestAnimationFrame: cb => { raf = cb; }, console };
vm.createContext(sandbox);
vm.runInContext(scripts.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n') +
	'\n;globalThis.api = { settings, surfacePoints, surfaceSoilTime, surfaceSkyTime, projGoTo, projStep, projection, system, view, SIL_N, renderSurfaceCopy };', sandbox);
const a = sandbox.api;
let fails = 0;
function check(ok, name) { if (!ok) { console.error('fail=' + name); fails++; } }
function near(x, y, tolerance = 1e-6) { return Math.abs(x - y) <= tolerance; }
raf(100);
check(els.previewBody.children.length === a.system.nb && els.previewBody.value === '3', 'preview choices');
els.stageSplit.value = '50'; els.stageSplit.dispatch('input');
els.skyWait.checked = true; els.skyWait.dispatch('change');
els.soilStart.value = 'sink'; els.soilStart.dispatch('change');
els.strokeOver.checked = true; els.strokeOver.dispatch('change');
check(a.settings.split === 0.5 && els.stageValue.textContent === '50%' && a.settings.skyWait && a.settings.soilStart === 'sink' && a.settings.strokeOver, 'controls');
els.previewTransition.dispatch('click');
check(a.projection.trans.dst.sel === 3 && a.projection.trans.split === 0.5, 'replay');
els.stageSplit.value = '25'; els.stageSplit.dispatch('input');
check(a.projection.trans.split === 0.5, 'timing fixed during transition');
a.projGoTo(7);
check(a.projection.queue === 7, 'selection queued during transition');
a.projGoTo(3);
check(a.projection.queue === -2, 'queued selection cancelled');
els.previewBody.value = '7'; els.previewTransition.dispatch('click');
check(a.projection.trans.dst.sel === 7 && a.projection.trans.split === 0.25 && a.projection.steady.kind === 0, 'replay resets and applies timing');
check(near(a.surfaceSkyTime(0.25, 0.5, true), 0) && a.surfaceSkyTime(0.25, 0.5, false) > 0, 'sky delay');
check(a.surfaceSoilTime(0.25, 0.5, 'sink') > 0 && near(a.surfaceSoilTime(0.25, 0.5, 'unfold'), 0), 'soil start');
for (const [w, h] of [[1200, 800], [420, 900]]) {
	a.view.w = w; a.view.h = h;
	for (const b of [0, 3, 7]) {
		a.projStep(100);
		const st = { sel: b, kind: 1, xoff: w / 2, yline: a.system.type[b] === 1 ? h * 0.9 : h * 0.1 };
		const other = a.projection.trans.sa;
		const x = new Float64Array(a.SIL_N), y = new Float64Array(a.SIL_N);
		for (let i = 0; i <= 100; i++) {
			const t = 0.35 + 0.65 * i / 100;
			a.surfacePoints(st, other, 0, t, 0.35, b, x, y);
			let len = 0, maxGap = 0;
			for (let s = 1; s < x.length; s++) {
				const gap = Math.hypot(x[s] - x[s - 1], y[s] - y[s - 1]);
				len += gap; maxGap = Math.max(maxGap, gap);
			}
			check(Math.abs(len - w) < 0.1 && maxGap <= w / (a.SIL_N - 1) + 0.1, 'arc length and gaps');
			if (i === 0) check(near((y[0] + y[(a.SIL_N - 1) >> 1]) / 2, a.system.type[b] === 1 ? h : 0, 0.1), 'half cover');
			if (i === 100) check(near(x[x.length - 1] - x[0], w) && near(y[0], st.yline), 'line endpoint');
		}
	}
}
const xx = new Float64Array(a.SIL_N), yy = new Float64Array(a.SIL_N);
a.surfacePoints({sel: 3, kind: 1, xoff: 210, yline: 810}, a.projection.trans.sa, 0, 1, 0.35, 3, xx, yy);
calls = []; a.settings.strokeOver = true; a.renderSurfaceCopy(ctx, 3, 1, 1, 1, 0, false);
check(calls.join(',') === 'fill,fill,stroke', 'stroke over');
calls = []; a.settings.strokeOver = false; a.renderSurfaceCopy(ctx, 3, 1, 1, 1, 0, false);
check(calls.join(',') === 'stroke,fill,fill', 'stroke under');
console.log('surface result=' + (fails ? 'fail' : 'pass') + ' geometry_sizes=2 body_types=3 samples=101 fails=' + fails);
process.exit(fails ? 1 : 0);
