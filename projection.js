// owns: view state, flat/wrap projection math, transition machine, element angle trackers
// edit for: projection formulas, morph timing, short-arc / seam rules

const TAU = Math.PI * 2;
const PROJ_DUR = 3000;
const PROJ_MARGIN = 24;
const SOIL_FRAC = 0.1;
const SIL_N = 256;
// below this distance-to-pole (x body radius) an orbit sample's bearing is singular: hide it
const PROJ_SING = 1.2;

const projection = {
	phase: 0, // 0 steady flat, 1 steady wrap, 2 blending
	copies: 1,
	t: 0,
	now: 0,
	sing: 0,
	silN: 0,
	silB: new Int8Array(4),
	silBand: new Float64Array(4),
	bx: null, by: null, br: null,
	ex: 0, ey: 0,
	orbitSamp: 0, orbitBase: 0, silBase: 0, maxe: 0,
	ewx: null, ewy: null,
	steady: null, trans: null, queue: -2, // queue: body idx, -1 flat, -2 none
};

let thA = null, thC = null; // unwrapped bearings per element around source / destination centers
let cxs = null, cys = null; // collapsed icon-circle centers per role (0=source/steady, 2=destination) per body
let cosO = null, sinO = null, cosS = null, sinS = null, extentArr = null;

function projInit(orbitSamp) {
	const p = projection, nb = system.nb;
	p.orbitSamp = orbitSamp;
	p.orbitBase = nb;
	p.silBase = nb + nb * orbitSamp;
	p.maxe = p.silBase + nb * SIL_N;
	thA = new Float64Array(p.silBase);
	thC = new Float64Array(p.silBase);
	cxs = new Float64Array(3 * nb);
	cys = new Float64Array(3 * nb);
	p.ewx = new Float64Array(p.maxe);
	p.ewy = new Float64Array(p.maxe);
	p.bx = new Float64Array(nb);
	p.by = new Float64Array(nb);
	p.br = new Float64Array(nb);
	cosO = new Float64Array(orbitSamp);
	sinO = new Float64Array(orbitSamp);
	cosS = new Float64Array(SIL_N);
	sinS = new Float64Array(SIL_N);
	extentArr = new Float64Array(nb);
	for (let s = 0; s < orbitSamp; s++) {
		cosO[s] = Math.cos(TAU * s / orbitSamp);
		sinO[s] = Math.sin(TAU * s / orbitSamp);
	}
	for (let s = 0; s < SIL_N; s++) {
		cosS[s] = Math.cos(TAU * s / SIL_N);
		sinS[s] = Math.sin(TAU * s / SIL_N);
	}
	for (let i = 0; i < nb; i++) extentArr[i] = sysExtent(i);
	p.steady = projMakeFlat(0);
	p.trans = null;
	p.queue = -2;
	p.phase = 0;
	p.copies = 1;
	p.t = 0;
}

function projIconR(i) {
	const t = system.type[i];
	return t === 0 ? 9 : t === 1 ? 6 : 4;
}

function projMakeFlat(sel) {
	return { kind: 0, sel: sel, xoff: 0, s: 0, k: 0, yline: 0, dirY: 1, hfloor: 0, rc: system.radius[sel] };
}

// arrival puts the zenith body (parent, or first planet for the star) at screen center x
function projMakeWrap(sel) {
	const z = system.parent[sel] >= 0 ? system.parent[sel] : 1;
	const th = Math.atan2(system.wy[sel] - system.wy[z], system.wx[z] - system.wx[sel]);
	return { kind: 1, sel: sel, xoff: view.w / 2 - th * view.w / TAU, s: 0, k: 0, yline: 0, dirY: 1, hfloor: 0, rc: system.radius[sel] };
}

function projGoTo(i) {
	const p = projection;
	const cur = p.trans ? p.trans.dst : p.steady;
	if (cur.kind === 1 && cur.sel === i) {
		p.queue = -2;
		return;
	}
	projStartTo(projMakeWrap(i));
}

function projSetMode(w) {
	const p = projection;
	const cur = p.trans ? p.trans.dst : p.steady;
	if (cur.kind === (w ? 1 : 0)) {
		p.queue = -2;
		return;
	}
	projStartTo(w ? projMakeWrap(cur.sel) : projMakeFlat(cur.sel));
}

function projStartTo(dst) {
	const p = projection;
	if (p.trans) {
		p.queue = dst.kind === 1 ? dst.sel : -1;
		return;
	}
	projFillWorld();
	p.trans = { sa: p.steady, dst: dst, t0: p.now, raw: 0, split: settings.split, skyWait: settings.skyWait, soilStart: settings.soilStart };
	p.t = 0;
	p.copies = 3;
	if (dst.kind === 1) projInitTrackers(dst);
}

function projComplete() {
	const p = projection;
	p.steady = p.trans.dst;
	thA.set(thC);
	p.trans = null;
	p.t = 0;
	p.phase = p.steady.kind;
	p.copies = p.steady.kind === 1 ? 3 : 1;
	const q = p.queue;
	p.queue = -2;
	if (q >= 0) projStartTo(projMakeWrap(q));
	else if (q === -1) projStartTo(projMakeFlat(p.steady.sel));
}

function projStep(now) {
	const p = projection;
	p.now = now;
	if (p.trans) {
		const t = (now - p.trans.t0) / PROJ_DUR;
		if (t >= 1) projComplete();
		else {
			p.trans.raw = Math.max(0, t);
			p.t = surfaceSkyTime(p.trans.raw, p.trans.split, p.trans.skyWait);
		}
	}
	projUpdateState(p.steady);
	if (p.trans) {
		projUpdateState(p.trans.sa);
		projUpdateState(p.trans.dst);
	}
	projFillWorld();
	projSilList();
	if (p.steady.kind === 1 || p.trans) projUnwrapLive();
	projCollapse();
	projBodyScreen();
}

function projUpdateState(st) {
	const w = view.w, h = view.h;
	if (st.kind === 0) {
		st.s = (Math.min(w, h) / 2 - PROJ_MARGIN) / extentArr[st.sel];
		return;
	}
	const planet = system.type[st.sel] === 1;
	st.dirY = planet ? -1 : 1;
	st.yline = planet ? h * (1 - SOIL_FRAC) : h * SOIL_FRAC;
	let dmax = 0;
	for (let i = 0; i < system.nb; i++) {
		if (i === st.sel) continue;
		const d = Math.hypot(system.wx[i] - system.wx[st.sel], system.wy[i] - system.wy[st.sel]);
		if (d > dmax) dmax = d;
	}
	let hmax = Math.log(Math.max(dmax, st.rc * 1.001) / st.rc);
	if (hmax < 1) hmax = 1;
	st.k = (h * (1 - SOIL_FRAC) - PROJ_MARGIN) / hmax;
	st.hfloor = -(h * SOIL_FRAC + 8) / st.k;
}

function projFillWorld() {
	const p = projection, nb = system.nb, os = p.orbitSamp;
	for (let i = 0; i < nb; i++) {
		p.ewx[i] = system.wx[i];
		p.ewy[i] = system.wy[i];
	}
	for (let b = 1; b < nb; b++) {
		const pa = system.parent[b], a = system.orbitA[b];
		const cx = system.wx[pa], cy = system.wy[pa];
		const base = p.orbitBase + b * os;
		for (let s = 0; s < os; s++) {
			p.ewx[base + s] = cx + a * cosO[s];
			p.ewy[base + s] = cy + a * sinO[s];
		}
	}
	for (let b = 0; b < nb; b++) {
		const r = system.radius[b], cx = system.wx[b], cy = system.wy[b];
		const base = p.silBase + b * SIL_N;
		for (let s = 0; s < SIL_N; s++) {
			p.ewx[base + s] = cx + r * cosS[s];
			p.ewy[base + s] = cy + r * sinS[s];
		}
	}
}

function projUnwrapLive() {
	const p = projection, tr = p.trans;
	if (tr) {
		if (tr.sa.kind === 1) projUnwrapTh(thA, tr.sa);
		if (tr.dst.kind === 1) projUnwrapTh(thC, tr.dst);
	} else if (p.steady.kind === 1) projUnwrapTh(thA, p.steady);
}

function projUnwrapTh(tr, st) {
	const p = projection, cx = system.wx[st.sel], cy = system.wy[st.sel];
	for (let e = 0; e < p.silBase; e++) {
		const th = Math.atan2(cy - p.ewy[e], p.ewx[e] - cx);
		tr[e] += angNorm(th - tr[e]);
	}
}

function angNorm(d) {
	return d - TAU * Math.round(d / TAU);
}

// short-arc init: each element's target bearing gets the lap whose x is nearest its current screen x
function projInitTrackers(dst) {
	const p = projection, cx = system.wx[dst.sel], cy = system.wy[dst.sel];
	const iw = view.w / TAU;
	for (let e = 0; e < p.silBase; e++) {
		const xsrc = projElemX(e, p.ewx[e], p.ewy[e]);
		const th = Math.atan2(cy - p.ewy[e], p.ewx[e] - cx);
		thC[e] = th + TAU * Math.round((xsrc - (th * iw + dst.xoff)) / view.w);
	}
}

function projIsOrbitElem(e) {
	const p = projection;
	return e >= p.orbitBase && e < p.silBase;
}

function projOrbitBody(e) {
	return ((e - projection.orbitBase) / projection.orbitSamp) | 0;
}

// silhouette of a body that is not the state's ground collapses to its icon circle in that state;
// own silhouette lifts to a line spanning exactly one period (step tuned so ends meet mod W);
// own orbit is degenerate in wrap (passes through the pole): a buried line under the surface
function projEvalX(st, tr, role, e, wx) {
	if (st.kind === 0) return view.w / 2 + (wx - system.wx[st.sel]) * st.s;
	const o = e - projection.silBase;
	if (o >= 0) {
		const b = (o / SIL_N) | 0, s = o - b * SIL_N;
		if (b === st.sel) return st.xoff - s * (view.w / (SIL_N - 1));
		return cxs[role * system.nb + b] + projIconR(b) * cosS[s];
	}
	if (projIsOrbitElem(e)) {
		const ob = e - projection.orbitBase;
		if (projOrbitBody(e) === st.sel) return st.xoff - (ob - st.sel * projection.orbitSamp) * (view.w / (projection.orbitSamp - 1));
	}
	return tr[e] * (view.w / TAU) + st.xoff;
}

function projEvalY(st, role, e, wx, wy) {
	const dy = wy - system.wy[st.sel];
	if (st.kind === 0) return view.h / 2 - dy * st.s;
	const dx = wx - system.wx[st.sel];
	const o = e - projection.silBase;
	if (o >= 0) {
		const b = (o / SIL_N) | 0;
		if (b !== st.sel) return cys[role * system.nb + b] - projIconR(b) * sinS[o - b * SIL_N];
		return st.yline; // own silhouette rides exactly on the surface line
	}
	const d = Math.sqrt(dx * dx + dy * dy);
	const buried = st.yline + st.dirY * st.k * st.hfloor;
	if (projIsOrbitElem(e)) {
		if (projOrbitBody(e) === st.sel) return buried; // own orbit passes through the pole: degenerate, buried
		if (d < st.rc * PROJ_SING) {
			projection.sing = 1;
			return buried;
		}
	} else if (d === 0) {
		return st.yline; // ground body's icon rests on its surface line
	}
	let h = Math.log(Math.max(d, st.rc * 1e-6) / st.rc);
	if (h < st.hfloor) h = st.hfloor;
	return st.yline + st.dirY * st.k * h;
}

function projElemX(e, wx, wy) {
	const p = projection, tr = p.trans;
	if (!tr) return projEvalX(p.steady, thA, 0, e, wx);
	let x = projEvalX(tr.sa, thA, 0, e, wx);
	if (p.t > 0) x += (projEvalX(tr.dst, thC, 2, e, wx) - x) * p.t;
	return x;
}

function projElemY(e, wx, wy) {
	const p = projection, tr = p.trans;
	if (!tr) return projEvalY(p.steady, 0, e, wx, wy);
	let y = projEvalY(tr.sa, 0, e, wx, wy);
	if (p.t > 0) y += (projEvalY(tr.dst, 2, e, wx, wy) - y) * p.t;
	return y;
}

function projElemAt(e, wx, wy) {
	const p = projection;
	p.ex = projElemX(e, wx, wy);
	p.sing = 0;
	p.ey = projElemY(e, wx, wy);
}

function projCollapse() {
	const p = projection, tr = p.trans;
	projCollapseRole(0, tr ? tr.sa : p.steady, thA);
	if (tr) {
		projCollapseRole(2, tr.dst, thC);
	}
}

function projCollapseRole(role, st, tr) {
	const p = projection;
	for (let j = 0; j < p.silN; j++) {
		const b = p.silB[j];
		if (b === st.sel) continue;
		cxs[role * system.nb + b] = projEvalX(st, tr, role, b, system.wx[b]);
		cys[role * system.nb + b] = projEvalY(st, role, b, system.wx[b], system.wy[b]);
	}
}

function projSilList() {
	const p = projection;
	p.silN = 0;
	projSilPush(p.steady.sel);
	if (p.trans) {
		projSilPush(p.trans.sa.sel);
		projSilPush(p.trans.dst.sel);
	}
}

function projSilPush(b) {
	const p = projection, tr = p.trans;
	for (let n = 0; n < p.silN; n++) if (p.silB[n] === b) return;
	let band = p.steady.kind === 1 && p.steady.sel === b ? 1 : 0;
	if (tr) {
		let src = tr.sa.kind === 1 && tr.sa.sel === b ? 1 : 0;
		const dst = tr.dst.kind === 1 && tr.dst.sel === b ? 1 : 0;
		band = src + (dst - src) * p.t;
	}
	p.silB[p.silN] = b;
	p.silBand[p.silN] = band;
	p.silN++;
}

function projRelift(x) {
	const w = view.w;
	return x - w * Math.round((x - w / 2) / w);
}

function projBodyScreen() {
	const p = projection;
	for (let i = 0; i < system.nb; i++) {
		projElemAt(i, p.ewx[i], p.ewy[i]);
		// relift into the central copy; exact-W jumps are invisible under 3-copy drawing
		p.bx[i] = projRelift(p.ex);
		p.by[i] = p.ey;
		p.br[i] = projIsGround(i) ? 0 : projIconR(i) + 6;
	}
	p.copies = p.trans || p.steady.kind === 1 ? 3 : 1;
}

function projIsGround(i) {
	const p = projection, tr = p.trans;
	if (!tr) return p.steady.kind === 1 && p.steady.sel === i;
	if (p.t <= 0.5) return false;
	return (tr.dst.kind === 1 && tr.dst.sel === i) || (tr.sa.kind === 1 && tr.sa.sel === i);
}

function projPick(mx, my) {
	const p = projection, w = view.w;
	let best = -1, bd = Infinity;
	for (let i = 0; i < system.nb; i++) {
		const r = p.br[i];
		if (r <= 0) continue;
		let dx = p.bx[i] - mx;
		if (p.copies === 3) dx -= w * Math.round(dx / w);
		const dy = p.by[i] - my;
		const d2 = dx * dx + dy * dy;
		if (d2 < r * r && d2 < bd) {
			bd = d2;
			best = i;
		}
	}
	return best;
}

if (typeof module !== 'undefined') {
	module.exports = {
		projection, projInit, projStep, projGoTo, projSetMode, projElemAt, projPick, projIconR,
		TAU, SOIL_FRAC, SIL_N, PROJ_MARGIN,
	};
}
