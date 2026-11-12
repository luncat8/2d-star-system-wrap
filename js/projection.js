// owns: map and wrap projection, log scale smoothing
// edit for: projection math, log scale

const proj = {
	scale: 1,
	ready: false,
	lastS: -2,
	dmaxFrom: 0,
	dmaxTo: 0,
	fromLogDmin: 0,
	fromLogRange: 1,
	toLogDmin: 0,
	toLogRange: 1,
};

const INV_TAU = 1 / (Math.PI * 2);
const _pa = { x: 0, y: 0 };
const _pb = { x: 0, y: 0 };
const _ps = { x: 0, y: 0 };

function initProjection() {
	proj.scale = Math.min(view.W, view.H) / (2 * world.systemRadius * 1.1);
}

function skyOf(i) {
	return world.bodies[i].cls === 'planet' ? -1 : 1;
}

function mapProject(wx, wy, out) {
	const st = world.bodies[0];
	out.x = view.W * 0.5 + (wx - st.x) * proj.scale;
	out.y = view.H * 0.5 - (wy - st.y) * proj.scale;
}

function wrapProject(wx, wy, S, line, skyDir, logDmin, logRange, out) {
	const b = world.bodies[S];
	const dx = wx - b.x;
	const dy = wy - b.y;
	const d = Math.sqrt(dx * dx + dy * dy);
	let u = (Math.log(d > 1e-6 ? d : 1e-6) - logDmin) / logRange;
	u = u < 0 ? 0 : u > 1 ? 1 : u;
	out.x = (Math.atan2(dy, dx) + Math.PI) * INV_TAU * view.W;
	out.y = skyDir < 0 ? line - u * line : line + u * (view.H - line);
}

function projectPoint(wx, wy, out) {
	if (!trans.active) {
		if (view.selected < 0) {
			mapProject(wx, wy, out);
			return;
		}
		wrapProject(wx, wy, view.selected, trans.line, skyOf(view.selected), proj.toLogDmin, proj.toLogRange, out);
		return;
	}
	if (trans.from < 0) mapProject(wx, wy, _pa);
	else wrapProject(wx, wy, trans.from, trans.fromLine, skyOf(trans.from), proj.fromLogDmin, proj.fromLogRange, _pa);
	wrapProject(wx, wy, trans.to, trans.line, skyOf(trans.to), proj.toLogDmin, proj.toLogRange, _pb);
	const e = trans.eased;
	if (trans.from < 0) out.x = _pa.x + (_pb.x - _pa.x) * e;
	else {
		out.x = _pa.x + wrapDelta(_pa.x, _pb.x) * e;
		out.x -= Math.floor(out.x / view.W) * view.W;
	}
	out.y = _pa.y + (_pb.y - _pa.y) * e;
}

// wrap-x is an angle: take the short arc, not the long way through the seam
function wrapDelta(a, b) {
	let d = b - a;
	if (d > view.W * 0.5) d -= view.W;
	else if (d < -view.W * 0.5) d += view.W;
	return d;
}

function maxDistanceTo(S) {
	const s = world.bodies[S];
	let m = 0;
	for (let i = 0; i < world.bodies.length; i++) {
		if (i === S) continue;
		const b = world.bodies[i];
		const dx = b.x - s.x;
		const dy = b.y - s.y;
		const d = Math.sqrt(dx * dx + dy * dy);
		if (d > m) m = d;
	}
	return m;
}

function setLog(side, S, dmax) {
	const r = world.bodies[S].r;
	const dmin = r > 1e-3 ? r : 1e-3;
	const ld = Math.log(dmin);
	const hi = dmax > dmin * 1.0001 ? dmax : dmin * 1.0001;
	const lr = Math.log(hi) - ld;
	if (side === 'from') {
		proj.fromLogDmin = ld;
		proj.fromLogRange = lr > 1e-3 ? lr : 1e-3;
	} else {
		proj.toLogDmin = ld;
		proj.toLogRange = lr > 1e-3 ? lr : 1e-3;
	}
}

function updateProjection(dt) {
	const S = trans.active ? trans.to : view.selected;
	if (S < 0) return;
	const target = maxDistanceTo(S);
	if (!proj.ready) {
		proj.dmaxFrom = target;
		proj.dmaxTo = target;
		proj.lastS = S;
		proj.ready = true;
	} else if (S !== proj.lastS) {
		if (trans.active && trans.from >= 0) proj.dmaxFrom = proj.dmaxTo;
		proj.dmaxTo = target;
		proj.lastS = S;
	} else {
		const k = 1 - Math.exp(-dt / 0.35);
		proj.dmaxTo += (target - proj.dmaxTo) * k;
		if (!trans.active) proj.dmaxFrom = proj.dmaxTo;
	}
	if (trans.active && trans.from >= 0) setLog('from', trans.from, proj.dmaxFrom);
	setLog('to', S, proj.dmaxTo);
}

function mapRadius(b) {
	const r = b.r * proj.scale;
	return r < 2.5 ? 2.5 : r > 44 ? 44 : r;
}

function wrapRadius(b, S) {
	const s = world.bodies[S];
	const dx = b.x - s.x;
	const dy = b.y - s.y;
	const d = Math.sqrt(dx * dx + dy * dy);
	const a = b.r / (d > 1e-3 ? d : 1e-3);
	const r = a * INV_TAU * view.W;
	let lo;
	let hi;
	if (b.cls === 'star') { lo = 8; hi = 40; }
	else if (b.cls === 'planet') { lo = 3; hi = 24; }
	else { lo = 2; hi = 12; }
	return r < lo ? lo : r > hi ? hi : r;
}

function bodyRadius(i) {
	const b = world.bodies[i];
	if (!trans.active) {
		if (view.selected < 0) return mapRadius(b);
		return wrapRadius(b, view.selected);
	}
	const rFrom = trans.from < 0 ? mapRadius(b) : wrapRadius(b, trans.from);
	const rTo = wrapRadius(b, trans.to);
	return rFrom + (rTo - rFrom) * trans.eased;
}

function projectBodies() {
	const n = world.bodies.length;
	for (let i = 0; i < n; i++) {
		const b = world.bodies[i];
		projectPoint(b.x, b.y, _ps);
		b.sx = _ps.x;
		b.sy = _ps.y;
		b.sr = bodyRadius(i);
	}
}