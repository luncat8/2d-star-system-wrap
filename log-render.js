// owns: rendering projected bodies, orbits, stars and resizing
// edit for: visual styling and curve sampling

const CURVE_N = 256;
const curveX = new Float64Array(CURVE_N + 1), curveY = new Float64Array(CURVE_N + 1);
const starsX = new Float32Array(220), starsY = new Float32Array(220);
let renderSeed = 7213;

function renderInit() {
	for (let i = 0; i < starsX.length; i++) {
		renderSeed = (Math.imul(renderSeed, 1664525) + 1013904223) >>> 0;
		starsX[i] = renderSeed / 4294967296;
		renderSeed = (Math.imul(renderSeed, 1664525) + 1013904223) >>> 0;
		starsY[i] = renderSeed / 4294967296;
	}
	renderResize();
	cameraReset();
}

function renderResize() {
	const oldW = view.w, oldH = view.h;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	view.w = window.innerWidth; view.h = window.innerHeight;
	view.canvas.width = Math.round(view.w * dpr); view.canvas.height = Math.round(view.h * dpr);
	view.canvas.style.width = view.w + 'px'; view.canvas.style.height = view.h + 'px';
	view.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	if (!oldW) return;
	const ratio = view.w / oldW;
	camera.scale *= ratio; camera.ox = view.w / 2 + (camera.ox - oldW / 2) * ratio;
	camera.oy = view.h / 2 + (camera.oy - oldH / 2) * ratio;
	if (camera.transition) cameraFollow(camera.target, view.now);
}

function renderCurve(cx, cy, r) {
	const period = LOG_TAU * camera.scale;
	for (let s = 0; s <= CURVE_N; s++) {
		const a = LOG_TAU * s / CURVE_N;
		cameraProject(cx + r * Math.cos(a), cy + r * Math.sin(a));
		curveX[s] = camera.x;
		curveY[s] = camera.y;
		if (s) curveX[s] -= period * Math.round((curveX[s] - curveX[s - 1]) / period);
	}
}

function renderCurveCopies(ctx, fill) {
	const period = LOG_TAU * camera.scale;
	let min = Infinity, max = -Infinity;
	for (let s = 0; s <= CURVE_N; s++) { min = Math.min(min, curveX[s]); max = Math.max(max, curveX[s]); }
	const first = Math.ceil(-max / period), last = Math.floor((view.w - min) / period);
	for (let c = first; c <= last; c++) {
		ctx.beginPath(); ctx.moveTo(curveX[0] + c * period, curveY[0]);
		for (let s = 1; s <= CURVE_N; s++) ctx.lineTo(curveX[s] + c * period, curveY[s]);
		if (fill) { ctx.closePath(); ctx.fill(); } else ctx.stroke();
	}
}

// A disk containing the logarithm's pole covers everything below its ray intersections.
function renderEnclosingBody(ctx, i) {
	const dx = system.wx[i] - camera.px, dy = system.wy[i] - camera.py, r = system.radius[i];
	ctx.beginPath();
	for (let s = 0; s <= CURVE_N; s++) {
		const x = view.w * s / CURVE_N;
		const a = (x - camera.ox) / camera.scale;
		const dot = dx * Math.sin(a) + dy * Math.cos(a);
		const d = dot + Math.sqrt(Math.max(0, dot * dot + r * r - dx * dx - dy * dy));
		const y = camera.oy - camera.scale * Math.log(Math.max(d, 1e-12));
		if (!s) ctx.moveTo(x, y); else ctx.lineTo(x, y);
	}
	ctx.lineTo(view.w, view.h + 1); ctx.lineTo(0, view.h + 1); ctx.closePath(); ctx.fill();
}

function renderFrame() {
	const ctx = view.ctx;
	ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, view.w, view.h);
	ctx.fillStyle = '#8492b0';
	for (let i = 0; i < starsX.length; i++) ctx.fillRect(starsX[i] * view.w, starsY[i] * view.h, i % 9 ? 1 : 2, i % 9 ? 1 : 2);
	ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(160,180,255,0.2)';
	for (let i = 1; i < system.nb; i++) {
		const p = system.parent[i];
		if (p < 0) continue;
		renderCurve(system.wx[p], system.wy[p], system.orbitA[i]); renderCurveCopies(ctx, false);
	}
	for (let i = 0; i < system.nb; i++) {
		ctx.fillStyle = system.color[i];
		if (Math.hypot(system.wx[i] - camera.px, system.wy[i] - camera.py) < system.radius[i]) renderEnclosingBody(ctx, i);
		else { renderCurve(system.wx[i], system.wy[i], system.radius[i]); renderCurveCopies(ctx, true); }
	}
	ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#d5dfef';
	for (let i = 0; i < system.nb; i++) {
		if (Math.hypot(system.wx[i] - camera.px, system.wy[i] - camera.py) <= system.radius[i]) continue;
		cameraProject(system.wx[i], system.wy[i]);
		const period = LOG_TAU * camera.scale;
		const x = camera.x - period * Math.round((camera.x - view.w / 2) / period);
		if (x < -40 || x > view.w + 40 || camera.y < -20 || camera.y > view.h + 20) continue;
		const r = camera.scale * Math.asin(Math.min(1, system.radius[i] / Math.hypot(system.wx[i] - camera.px, system.wy[i] - camera.py)));
		ctx.fillText(system.name[i], x, camera.y - Math.max(4, r) - 6);
	}
}

if (typeof module !== 'undefined') module.exports = { renderInit, renderResize, renderFrame, renderCurve, renderEnclosingBody };
