// owns: logarithmic camera, inverse mapping and follow transitions
// edit for: projection and camera behavior

const LOG_TAU = 2 * Math.PI;
const GROUND = 0.86;
const TOP = 0.04;
const camera = { px: 0, py: 0, scale: 1, ox: 0, oy: 0, x: 0, y: 0, target: -1, transition: null };
const anchor = { qx: 0, qy: 0, rx: 0, ry: 0, ref: 1 };

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
}

function cameraProject(x, y) {
	const dx = x - camera.px, dy = y - camera.py;
	camera.x = camera.ox + camera.scale * Math.atan2(dx, dy);
	camera.y = camera.oy - camera.scale * Math.log(Math.max(Math.hypot(dx, dy), 1e-12));
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
		const d = Math.hypot(px - system.wx[i], py - system.wy[i]) + system.radius[i];
		if (d > max) max = d;
	}
	return max;
}

// scale mapping the log range [ref, farthest extent] onto the screen, so every body fits
function cameraFitScale(px, py, ref) {
	const range = Math.max(Math.log(cameraMaxExtent(px, py) / ref), 0.2);
	return (GROUND - TOP) * view.h / range;
}

// ground state for a world anchor: pole target q, 1:1 reference point r
// (the anchor itself in free space, the top surface point on a body), ref = |r - q|
function cameraAnchorGround(ax, ay) {
	for (let i = 0; i < system.nb; i++) {
		const d = Math.hypot(ax - system.wx[i], ay - system.wy[i]);
		if (d < system.radius[i]) {
			anchor.qx = system.wx[i]; anchor.qy = system.wy[i];
			anchor.rx = system.wx[i]; anchor.ry = system.wy[i] + system.radius[i];
			anchor.ref = system.radius[i];
			return;
		}
	}
	// in free space the pole lands on the nearest surface point: the ground below
	let ref = Infinity, bi = -1;
	for (let i = 0; i < system.nb; i++) {
		const d = Math.hypot(ax - system.wx[i], ay - system.wy[i]) - system.radius[i];
		if (d < ref) { ref = d; bi = i; }
	}
	ref = Math.max(ref, 1e-4);
	const dx = ax - system.wx[bi], dy = ay - system.wy[bi];
	const dl = Math.hypot(dx, dy);
	anchor.qx = system.wx[bi] + system.radius[bi] * dx / dl;
	anchor.qy = system.wy[bi] + system.radius[bi] * dy / dl;
	anchor.rx = ax; anchor.ry = ay;
	anchor.ref = ref;
}

function cameraFollow(i, now) {
	cameraProject(system.wx[i], system.wy[i] + system.radius[i]);
	const period = LOG_TAU * camera.scale;
	const x = camera.x - period * Math.round((camera.x - view.w / 2) / period);
	camera.target = i;
	camera.transition = { start: now, px: camera.px, py: camera.py, scale: camera.scale,
		endScale: cameraFitScale(system.wx[i], system.wy[i], system.radius[i]), x: x, y: camera.y };
}

function cameraStep(now) {
	if (camera.target < 0) return;
	const i = camera.target, tr = camera.transition;
	const scale = cameraFitScale(system.wx[i], system.wy[i], system.radius[i]);
	if (!tr) {
		camera.px = system.wx[i]; camera.py = system.wy[i];
		camera.scale = scale; camera.ox = view.w / 2;
		camera.oy = view.h * GROUND + scale * Math.log(system.radius[i]);
		return;
	}
	const t = Math.max(0, Math.min(1, (now - tr.start) / 1800));
	const k = t * t * (3 - 2 * t);
	camera.px = tr.px + (system.wx[i] - tr.px) * k;
	camera.py = tr.py + (system.wy[i] - tr.py) * k;
	camera.scale = Math.exp(Math.log(tr.scale) + (Math.log(tr.endScale) - Math.log(tr.scale)) * k);
	const ax = system.wx[i] - camera.px, ay = system.wy[i] + system.radius[i] - camera.py;
	camera.ox = tr.x + (view.w / 2 - tr.x) * k - camera.scale * Math.atan2(ax, ay);
	camera.oy = tr.y + (view.h * GROUND - tr.y) * k + camera.scale * Math.log(Math.max(Math.hypot(ax, ay), 1e-12));
	if (t === 1) camera.transition = null;
}

if (typeof module !== 'undefined') module.exports = { camera, anchor, GROUND, cameraReset, cameraProject, cameraUnproject, cameraMaxExtent, cameraFitScale, cameraAnchorGround, cameraFollow, cameraStep };
