// smoke: loads page scripts in index.html order into one vm context, drives frames,
// checks transition continuity + wrap end-state math. run: node experiments/smoke.js

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srcs = [];
const re = /<script src="([^"]+)"><\/script>/g;
let m;
while ((m = re.exec(html)) !== null) srcs.push(m[1]);

const ctxStub = {
	globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
	setTransform() {}, fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
	closePath() {}, fill() {}, stroke() {}, arc() {}, fillText() {},
};
const els = {
	c: { style: {}, width: 0, height: 0, addEventListener() {}, getContext: () => ctxStub },
	wrapBox: { checked: false, addEventListener() {} },
	stageSplit: { value: '35', addEventListener() {} },
	stageValue: { textContent: '' },
	skyWait: { addEventListener() {} }, soilStart: { addEventListener() {} },
	strokeOver: { addEventListener() {} },
	previewBody: { value: '', appendChild() {} }, previewTransition: { addEventListener() {} },
};
let rafCb = null;
const sandbox = {
	document: { getElementById: id => els[id] || null, createElement: () => ({}) },
	window: { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, addEventListener() {} },
	requestAnimationFrame: cb => { rafCb = cb; return 1; },
	console,
};
vm.createContext(sandbox);
let src = srcs.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
src += '\n;globalThis.__api = { projection, system, view, projGoTo, projSetMode, projElemAt, SIL_N, ORBIT_SAMP, starX, starY, starA, starN };\n';
vm.runInContext(src, sandbox);

const api = sandbox.__api;
const P = api.projection, S = api.system, V = api.view;
const W = V.w, H = V.h, TAU = 2 * Math.PI;
const SIL_STEPS = [0, 37, 91, 150, 213, 255];
const ORB_STEPS = [0, 16, 32, 48, 64, 80, 96, 112];

let fails = 0;
const failNames = [];
function chk(cond, name) {
	if (cond) return;
	fails++;
	if (failNames.indexOf(name) < 0) failNames.push(name);
}

const prevX = new Float64Array(P.maxe).fill(NaN);
const prevY = new Float64Array(P.maxe).fill(NaN);
let maxJX = 0, maxJY = 0, worst = '', totalFrames = 0, scanning = true, scen = 'init';

function probeAt(e, x, y, tag) {
	if (!Number.isFinite(x) || !Number.isFinite(y)) {
		chk(false, 'finite:' + e);
		prevX[e] = NaN;
		return;
	}
	if (Number.isFinite(prevX[e])) {
		let dx = x - prevX[e];
		dx -= W * Math.round(dx / W);
		const dy = y - prevY[e];
		const fx = Math.abs(dx) / W, fy = Math.abs(dy) / H;
		if (fx > maxJX || fy > maxJY) {
			if (fx > maxJX) maxJX = fx;
			if (fy > maxJY) maxJY = fy;
			worst = tag + '@' + scen + ':t' + P.t.toFixed(2);
		}
	}
	prevX[e] = x;
	prevY[e] = y;
}

function probeElem(e, tag) {
	api.projElemAt(e, P.ewx[e], P.ewy[e]);
	if (P.sing) {
		prevX[e] = NaN; // hidden sample, garbage x by design
		return;
	}
	probeAt(e, P.ex, P.ey, tag);
}

let prevList = [];
function probeScan() {
	if (!scanning) return;
	for (let i = 0; i < S.nb; i++) probeAt(i, P.bx[i], P.by[i], 'body:' + S.name[i]);
	for (let b = 1; b < S.nb; b++) {
		for (const s of ORB_STEPS) probeElem(P.orbitBase + b * api.ORBIT_SAMP + s, 'orb:' + S.name[b]);
	}
	const cur = [];
	for (let j = 0; j < P.silN; j++) cur.push(P.silB[j]);
	for (const b of cur) if (prevList.indexOf(b) < 0) checkEmergence(b);
	prevList = cur;
	for (let b = 0; b < S.nb; b++) {
		let band = -1;
		for (let j = 0; j < P.silN; j++) if (P.silB[j] === b) band = P.silBand[j];
		const emerging = P.trans && P.trans.dst.sel === b;
		const disk = !P.trans && P.steady.kind === 0 && P.steady.sel === b;
		const visible = band >= 0.05 || emerging || disk;
		for (const s of SIL_STEPS) {
			const e = P.silBase + b * api.SIL_N + s;
			if (!visible) {
				prevX[e] = NaN;
				continue;
			}
			probeElem(e, 'sil:' + S.name[b]);
		}
	}
	for (let j = 0; j < P.silN; j++) chk(P.silBand[j] >= -0.001 && P.silBand[j] <= 1.001, 'band range');
}

// a body entering the silhouette set must start collapsed at its icon, not fly in from elsewhere
function checkEmergence(b) {
	for (const s of SIL_STEPS) {
		const e = P.silBase + b * api.SIL_N + s;
		api.projElemAt(e, P.ewx[e], P.ewy[e]);
		let dx = P.ex - P.bx[b];
		dx -= W * Math.round(dx / W);
		chk(Math.abs(dx) < 40 && Math.abs(P.ey - P.by[b]) < 40, 'emergence:' + S.name[b]);
	}
}

let ts = 0;
function frames(n) {
	for (let i = 0; i < n; i++) {
		ts += 16.7;
		const cb = rafCb;
		cb(ts);
		totalFrames++;
		probeScan();
	}
}

function runUntil(pred, maxFrames) {
	let n = 0;
	while (!pred() && n < maxFrames) {
		frames(1);
		n++;
	}
	return pred();
}

function bearingX(cx, cy, wx, wy, xoff) {
	return Math.atan2(cy - wy, wx - cx) * (W / TAU) + xoff;
}

function pdiff(a, b) {
	let d = a - b;
	return d - W * Math.round(d / W);
}

let zenithErr = 0, bearingErr = 0, flatErr = 0;
function checkZenith(sel, zbody) {
	const st = P.trans ? P.trans.dst : P.steady;
	const x = bearingX(S.wx[sel], S.wy[sel], S.wx[zbody], S.wy[zbody], st.xoff);
	const e = Math.abs(pdiff(x, W / 2));
	if (e > zenithErr) zenithErr = e;
	chk(e < 5, 'zenith');
}

function checkBearingToX() {
	const st = P.steady;
	let err = 0;
	for (let i = 0; i < S.nb; i++) {
		if (i === st.sel) continue;
		const e = Math.abs(pdiff(P.bx[i], bearingX(S.wx[st.sel], S.wy[st.sel], S.wx[i], S.wy[i], st.xoff)));
		if (e > err) err = e;
	}
	if (err > bearingErr) bearingErr = err;
	chk(err < 1.5, 'bearing->x');
}

let altErr = 0;
// steady wrap: every body must sit at its log altitude on the fitted scale
function checkAltitudes() {
	const st = P.steady;
	let err = 0;
	for (let i = 0; i < S.nb; i++) {
		if (i === st.sel) continue;
		const d = Math.hypot(S.wx[i] - S.wx[st.sel], S.wy[i] - S.wy[st.sel]);
		const y = st.yline + st.dirY * st.k * Math.log(d / st.rc);
		err = Math.max(err, Math.abs(P.by[i] - y));
	}
	if (err > altErr) altErr = err;
	chk(err < 1.5, 'log altitude y');
}

// own orbit must be buried off-screen; own silhouette must ride the surface line
function checkBuriedOwnOrbit(sel, up) {
	const os = api.ORBIT_SAMP;
	for (const s of ORB_STEPS) {
		const e = P.orbitBase + sel * os + s;
		api.projElemAt(e, P.ewx[e], P.ewy[e]);
		chk(up ? P.ey < 0 : P.ey > H, 'own orbit buried:' + S.name[sel]);
		chk(P.sing === 0, 'own orbit not sing');
	}
	for (const s of SIL_STEPS) {
		const e = P.silBase + sel * api.SIL_N + s;
		api.projElemAt(e, P.ewx[e], P.ewy[e]);
		const yline = up ? H * 0.1 : H * 0.9;
		chk(Math.abs(P.ey - yline) < 1, 'own sil on line:' + S.name[sel]);
	}
}

function checkStars() {
	chk(api.starN === 256, 'star count');
	let inRange = true, bucketed = true;
	for (let i = 0; i < api.starN; i++) {
		if (!(api.starX[i] >= 0 && api.starX[i] < 1 && api.starY[i] >= 0 && api.starY[i] < 1)) inRange = false;
		if (i && api.starA[i] < api.starA[i - 1]) bucketed = false;
	}
	chk(inRange, 'star coords normalized');
	chk(bucketed, 'star alpha buckets contiguous');
	console.log('stars plan=0.2 n=' + api.starN + ' buckets=3 mode=screen_space');
}

// ---- scenario ----
chk(P.phase === 0 && P.steady.sel === 0 && P.copies === 1, 'initial state');
chk(els.wrapBox.checked === false, 'initial checkbox');
checkStars();
frames(30);

scen = 'flat->wrap(earth)';
api.projGoTo(3);
frames(1);
chk(els.wrapBox.checked === true, 'checkbox syncs on goTo');
checkZenith(3, 0);
chk(runUntil(() => P.phase === 1 && !P.trans, 250), 'wrap(earth) completes');
checkBearingToX();
checkAltitudes();
chk(P.steady.sel === 3, 'sel=earth');
const ylineP = H * 0.9;
chk(P.by[7] < ylineP - 10 && P.by[7] > 0, 'luna above soil, on screen');
chk(P.by[0] < P.by[7], 'sun higher than luna');
for (let i = 0; i < S.nb; i++) if (i !== 3) chk(P.by[i] >= -2 && P.by[i] <= H + 2, 'body on screen:' + i);
checkBuriedOwnOrbit(3, false);
frames(120);

scen = 'wrap(earth)->wrap(luna)';
api.projGoTo(7);
frames(1);
checkZenith(7, 3);
chk(runUntil(() => P.phase === 1 && !P.trans, 250), 'wrap(luna) completes');
checkBearingToX();
checkAltitudes();
chk(P.steady.sel === 7, 'sel=luna');
const ylineM = H * 0.1;
chk(P.by[3] > ylineM + 10 && P.by[3] < H, 'earth below moon soil, on screen');
chk(P.by[0] > P.by[3], 'sun lower than earth (bigger log distance)');
chk(P.br[3] > 0, 'earth icon pickable');
checkBuriedOwnOrbit(7, true);
frames(60);

scen = 'wrap->flat';
api.projSetMode(false);
frames(1);
chk(els.wrapBox.checked === false, 'checkbox syncs on setMode');
chk(runUntil(() => !P.trans, 250), 'flat completes');
chk(P.phase === 0 && P.copies === 1, 'flat steady');
chk(Math.abs(P.bx[7] - W / 2) < 2 && Math.abs(P.by[7] - H / 2) < 2, 'sel centered in flat');
for (let i = 0; i < S.nb; i++) {
	const ex = W / 2 + (S.wx[i] - S.wx[7]) * P.steady.s;
	const ey = H / 2 - (S.wy[i] - S.wy[7]) * P.steady.s;
	flatErr = Math.max(flatErr, Math.abs(P.bx[i] - ex), Math.abs(P.by[i] - ey));
}
chk(flatErr < 1.5, 'flat linear formula');

scen = 'retarget';
api.projGoTo(4);
frames(60);
api.projGoTo(5);
chk(runUntil(() => P.phase === 1 && !P.trans, 300), 'retarget completes');
chk(P.steady.sel === 5, 'retarget sel=jupiter');

scen = 'queue';
api.projGoTo(1);
frames(25);
api.projGoTo(2);
frames(25);
chk(P.trans && P.queue === 2, 'transition queued');
api.projGoTo(6);
chk(P.queue === 6, 'queued');
chk(runUntil(() => !P.trans && P.steady.sel === 6 && P.queue === -2, 700), 'queue drains');

scen = 'wrap(saturn)->wrap(sun)';
api.projGoTo(0);
frames(1);
checkZenith(0, 1);
chk(runUntil(() => P.phase === 1 && !P.trans, 250), 'wrap(sun) completes');
checkBearingToX();
checkAltitudes();
for (let i = 1; i < S.nb; i++) chk(P.by[i] > H * 0.1 + 10 && P.by[i] <= H + 2, 'star soil: bodies below top line:' + i);

scen = 'wrap(sun)->flat';
api.projSetMode(false);
chk(runUntil(() => !P.trans, 250), 'flat(sun) completes');
chk(P.phase === 0 && P.steady.sel === 0 && P.copies === 1, 'flat(sun) steady');
chk(Math.abs(P.bx[0] - W / 2) < 2, 'sun centered');

scen = 'perf';
scanning = false;
api.projGoTo(3);
runUntil(() => P.phase === 1 && !P.trans, 250);
const t0 = process.hrtime.bigint();
frames(300);
const msPerFrame = Number(process.hrtime.bigint() - t0) / 1e6 / 300;

chk(maxJX < 0.25, 'x continuity');
chk(maxJY < 0.25, 'y continuity');
console.log('smoke plan=0.1 result=' + (fails ? 'fail' : 'pass') + ' frames=' + totalFrames + ' fails=' + (failNames.join(',') || 'none'));
console.log('jumps plan=0.1 maxx=' + maxJX.toFixed(4) + ' maxy=' + maxJY.toFixed(4) + ' limit=0.25 units=screen_frac worst=' + worst);
console.log('zenith plan=0.1 err_px=' + zenithErr.toFixed(2) + ' limit_px=5');
console.log('bearing plan=0.1 err_px=' + bearingErr.toFixed(2) + ' limit_px=1.5');
console.log('altitude plan=0.1 err_px=' + altErr.toFixed(2) + ' limit_px=1.5');
console.log('flat plan=0.1 err_px=' + flatErr.toFixed(2) + ' limit_px=1.5');
console.log('perf plan=0.1 ms_per_frame=' + msPerFrame.toFixed(2) + ' state=wrap bodies=' + S.nb);
process.exit(fails ? 1 : 0);
