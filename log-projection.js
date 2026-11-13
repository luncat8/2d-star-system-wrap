// owns: logarithmic camera, inverse mapping and follow transitions
// edit for: projection and camera behavior

const LOG_TAU = 2 * Math.PI;
const GROUND = 0.86;
// a followed body pins its surface higher: the strip below is the log depth cutaway
const GROUND_BODY = 0.62;
const TOP = 0.04;
// the fitted log span is sampled and damped: it widens at once when a body recedes,
// holds through an orbit-sized swing, and only closes fast when it is far too wide
const FIT_MS = 400;
const FIT_GROW_MS = 200;
const FIT_HOLD_MS = 90000;
const FIT_CLOSE_MS = 500;
const FIT_CLOSE_RATIO = 0.85;
const fit = { range: 1, target: 1, at: 0, time: 0, ready: false };
const camera = { px: 0, py: 0, scale: 1, ox: 0, oy: 0, x: 0, y: 0, target: -1, transition: null };
const anchor = { qx: 0, qy: 0, rx: 0, ry: 0, ref: 1, body: -1 };

function cameraReset() {
	const s = view.w * 6;
	const linear = (Math.min(view.w, view.h) - 80) / 7.6;
	const d = s / Math.max(linear, 1);
	camera.px = 0;
	camera.py = -d;
	camera.scale = s;
	camera.ox = view.w / 2;
	camera.oy = view.h / 2 + s * Math.log(d);
	camera.target = -1;
	camera.transition = null;
	fit.ready = false;
}

function cameraProject(x, y) {
	const dx = x - camera.px, dy = y - camera.py;
	camera.x = camera.ox + camera.scale * Math.atan2(dx, dy);
	camera.y = camera.oy - camera.scale * Math.log(Math.max(Math.sqrt(dx * dx + dy * dy), 1e-12));
}

function cameraUnproject(x, y) {
	const a = (x - camera.ox) / camera.scale;
	const d = Math.exp((camera.oy - y) / camera.scale);
	camera.x = camera.px + d * Math.sin(a);
	camera.y = camera.py + d * Math.cos(a);
}

// farthest surface extent of the whole system from a pole
function cameraMaxExtent(px, py) {
	let max = 0;
	for (let i = 0; i < system.nb; i++) {
		const ex = px - system.wx[i], ey = py - system.wy[i];
		const d = Math.sqrt(ex * ex + ey * ey) + system.radius[i];
		if (d > max) max = d;
	}
	return max;
}

function cameraFitRange(px, py, ref) {
	return Math.max(Math.log(cameraMaxExtent(px, py) / ref), 0.2);
}

// scale mapping the log range [ref, farthest extent] above `line`, so every body fits
function cameraFitScale(px, py, ref, line) {
	return (line - TOP) * view.h / cameraFitRange(px, py, ref);
}

// the span widens quickly when a body recedes and narrows slowly when it returns, so the
// farthest body stays fitted without the whole system breathing at the orbit period
function cameraFitDamped(px, py, ref, line, now) {
	if (!fit.ready) {
		fit.range = fit.target = cameraFitRange(px, py, ref);
		fit.at = fit.time = now; fit.ready = true;
	} else if (now - fit.at >= FIT_MS) {
		fit.target = cameraFitRange(px, py, ref);
		fit.at = now;
	}
	const dt = Math.min(Math.max(now - fit.time, 0), 100);
	fit.time = now;
	const tau = fit.target > fit.range ? FIT_GROW_MS
		: fit.target < fit.range * FIT_CLOSE_RATIO ? FIT_CLOSE_MS : FIT_HOLD_MS;
	fit.range += (fit.target - fit.range) * (1 - Math.exp(-dt / tau));
	return (line - TOP) * view.h / fit.range;
}

// ground state for a world anchor: pole target q, 1:1 reference point r
// (the anchor itself in free space, the top surface point on a body), ref = |r - q|
function cameraAnchorGround(ax, ay) {
	for (let i = 0; i < system.nb; i++) {
		const ex = ax - system.wx[i], ey = ay - system.wy[i];
		const d = Math.sqrt(ex * ex + ey * ey);
		if (d < system.radius[i]) {
			anchor.qx = system.wx[i]; anchor.qy = system.wy[i];
			anchor.rx = system.wx[i]; anchor.ry = system.wy[i] + system.radius[i];
			anchor.ref = system.radius[i]; anchor.body = i;
			return;
		}
	}
	// in free space the pole lands on the nearest surface point: the ground below
	let ref = Infinity, bi = -1;
	for (let i = 0; i < system.nb; i++) {
		const ex = ax - system.wx[i], ey = ay - system.wy[i];
		const d = Math.sqrt(ex * ex + ey * ey) - system.radius[i];
		if (d < ref) { ref = d; bi = i; }
	}
	ref = Math.max(ref, 1e-4);
	const dx = ax - system.wx[bi], dy = ay - system.wy[bi];
	const dl = Math.sqrt(dx * dx + dy * dy);
	anchor.qx = system.wx[bi] + system.radius[bi] * dx / dl;
	anchor.qy = system.wy[bi] + system.radius[bi] * dy / dl;
	anchor.rx = ax; anchor.ry = ay;
	anchor.ref = ref; anchor.body = -1;
}

function cameraFollow(i, now) {
	cameraProject(system.wx[i], system.wy[i] + system.radius[i]);
	const period = LOG_TAU * camera.scale;
	const x = camera.x - period * Math.round((camera.x - view.w / 2) / period);
	camera.target = i;
	camera.transition = { start: now, px: camera.px, py: camera.py, scale: camera.scale,
		endScale: cameraFitScale(system.wx[i], system.wy[i], system.radius[i], GROUND_BODY), x: x, y: camera.y };
}

function cameraStep(now) {
	if (camera.target < 0) return;
	const i = camera.target, tr = camera.transition;
	if (!tr) {
		camera.px = system.wx[i]; camera.py = system.wy[i];
		camera.ox = view.w / 2;
		camera.scale = cameraFitDamped(system.wx[i], system.wy[i], system.radius[i], GROUND_BODY, now);
		camera.oy = view.h * GROUND_BODY + camera.scale * Math.log(system.radius[i]);
		return;
	}
	const t = Math.max(0, Math.min(1, (now - tr.start) / 1800));
	const k = t * t * (3 - 2 * t);
	camera.px = tr.px + (system.wx[i] - tr.px) * k;
	camera.py = tr.py + (system.wy[i] - tr.py) * k;
	camera.scale = Math.exp(Math.log(tr.scale) + (Math.log(tr.endScale) - Math.log(tr.scale)) * k);
	const ax = system.wx[i] - camera.px, ay = system.wy[i] + system.radius[i] - camera.py;
	camera.ox = tr.x + (view.w / 2 - tr.x) * k - camera.scale * Math.atan2(ax, ay);
	camera.oy = tr.y + (view.h * GROUND_BODY - tr.y) * k + camera.scale * Math.log(Math.max(Math.sqrt(ax * ax + ay * ay), 1e-12));
	if (t < 1) return;
	camera.transition = null;
	fit.range = (GROUND_BODY - TOP) * view.h / tr.endScale;
	fit.target = cameraFitRange(system.wx[i], system.wy[i], system.radius[i]);
	fit.at = fit.time = now; fit.ready = true;
}

if (typeof module !== 'undefined') module.exports = { camera, anchor, fit, GROUND, GROUND_BODY, TOP, FIT_MS, FIT_GROW_MS, FIT_HOLD_MS, FIT_CLOSE_MS, FIT_CLOSE_RATIO, cameraReset, cameraProject, cameraUnproject, cameraMaxExtent, cameraFitRange, cameraFitScale, cameraFitDamped, cameraAnchorGround, cameraFollow, cameraStep };
