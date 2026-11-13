// owns: logarithmic camera, inverse mapping and follow transitions
// edit for: projection and camera behavior

const LOG_TAU = 2 * Math.PI;
const camera = { px: 0, py: 0, scale: 1, ox: 0, oy: 0, x: 0, y: 0, target: -1, transition: null };

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

function cameraFollow(i, now) {
	cameraProject(system.wx[i], system.wy[i] + system.radius[i]);
	const period = LOG_TAU * camera.scale;
	const x = camera.x - period * Math.round((camera.x - view.w / 2) / period);
	camera.target = i;
	camera.transition = { start: now, px: camera.px, py: camera.py, scale: camera.scale, x: x, y: camera.y };
}

function cameraStep(now) {
	if (camera.target < 0) return;
	const i = camera.target, tr = camera.transition;
	const scale = view.w / LOG_TAU;
	const logY = Math.log(system.radius[i]) + view.h * 0.86 / scale;
	if (!tr) {
		camera.px = system.wx[i]; camera.py = system.wy[i];
		camera.scale = scale; camera.ox = view.w / 2; camera.oy = scale * logY;
		return;
	}
	const t = Math.max(0, Math.min(1, (now - tr.start) / 1800));
	const k = t * t * (3 - 2 * t);
	camera.px = tr.px + (system.wx[i] - tr.px) * k;
	camera.py = tr.py + (system.wy[i] - tr.py) * k;
	camera.scale = tr.scale + (scale - tr.scale) * k;
	const ax = system.wx[i] - camera.px, ay = system.wy[i] + system.radius[i] - camera.py;
	camera.ox = tr.x + (view.w / 2 - tr.x) * k - camera.scale * Math.atan2(ax, ay);
	camera.oy = tr.y + (view.h * 0.86 - tr.y) * k + camera.scale * Math.log(Math.max(Math.hypot(ax, ay), 1e-12));
	if (t === 1) camera.transition = null;
}

if (typeof module !== 'undefined') module.exports = { camera, cameraReset, cameraProject, cameraUnproject, cameraFollow, cameraStep };
