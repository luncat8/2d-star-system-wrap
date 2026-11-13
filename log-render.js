// owns: rendering projected bodies, atmosphere, interior layers, orbits, stars and resizing
// edit for: visual styling and curve sampling

const CURVE_N = 256;
const curveX = new Float64Array(CURVE_N + 1), curveY = new Float64Array(CURVE_N + 1);
// the unit circle and the screen-column ray directions are shared by every curve and every
// fill in a frame, so they are tabled once instead of spending trig per sample (plan 0.8)
const curveCos = new Float64Array(CURVE_N + 1), curveSin = new Float64Array(CURVE_N + 1);
const columnSin = new Float64Array(CURVE_N + 1), columnCos = new Float64Array(CURVE_N + 1);
let curveSamples = CURVE_N, curveMinX = 0, curveMaxX = 0;
let columnW = -1, columnOx = NaN, columnScale = NaN;
const starsX = new Float32Array(220), starsY = new Float32Array(220);
let renderSeed = 7213;

function renderInit() {
	for (let s = 0; s <= CURVE_N; s++) {
		const a = LOG_TAU * s / CURVE_N;
		curveCos[s] = Math.cos(a); curveSin[s] = Math.sin(a);
	}
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

// Sample count from the projected extent and a 0.25 px chord budget: a 3 px body needs 16
// points, an orbit across a full log period needs most of the table. A cusp is sharper than
// its box, so it can reach ~1 px. A power-of-two stride keeps the table indices exact.
function curveStride(D, r) {
	const period = LOG_TAU * camera.scale;
	const spanX = 2 * camera.scale * Math.asin(Math.min(1, r / D));
	const spanY = r < D ? camera.scale * Math.log((D + r) / (D - r)) : period;
	const radius = Math.max(0.5 * Math.max(spanX, Math.min(spanY, period)), 0.25);
	const need = Math.PI / Math.acos(1 - 0.25 / radius);
	let stride = 1;
	while (stride < 16 && CURVE_N / (2 * stride) >= need) stride *= 2;
	return stride;
}

// The sample angle is fixed per index, so its cos/sin come from the table: a sample costs one
// atan2, one log and one sqrt, then the screen lap is chosen against the previous sample.
function renderCurve(cx, cy, r) {
	const dx = cx - camera.px, dy = cy - camera.py;
	const scale = camera.scale, ox = camera.ox, oy = camera.oy, period = LOG_TAU * scale;
	const stride = curveStride(Math.sqrt(dx * dx + dy * dy), r), n = CURVE_N / stride;
	let minX = Infinity, maxX = -Infinity;
	for (let k = 0; k <= n; k++) {
		const t = k * stride;
		const sx = dx + r * curveCos[t], sy = dy + r * curveSin[t];
		const dist = Math.sqrt(sx * sx + sy * sy);
		let x = ox + scale * Math.atan2(sx, sy);
		curveY[k] = oy - scale * Math.log(Math.max(dist, 1e-12));
		if (k) x -= period * Math.round((x - curveX[k - 1]) / period);
		curveX[k] = x;
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
	}
	curveSamples = n; curveMinX = minX; curveMaxX = maxX;
}

// One path per curve with every visible lap as a subpath: the fills and strokes of the copies
// are one draw call, and the seam between touching laps is covered instead of blended twice.
function renderCurveCopies(ctx, fill) {
	const period = LOG_TAU * camera.scale;
	const first = Math.ceil(-curveMaxX / period), last = Math.floor((view.w - curveMinX) / period);
	ctx.beginPath();
	for (let c = first; c <= last; c++) {
		const shift = c * period;
		ctx.moveTo(curveX[0] + shift, curveY[0]);
		for (let s = 1; s <= curveSamples; s++) ctx.lineTo(curveX[s] + shift, curveY[s]);
		if (fill) ctx.closePath();
	}
	if (fill) ctx.fill(); else ctx.stroke();
}

// A sphere containing the logarithm's pole covers everything below its ray intersections.
// Its ray direction per screen column only depends on the camera, so it is cached.
function columnCache() {
	if (columnW === view.w && columnOx === camera.ox && columnScale === camera.scale) return;
	columnW = view.w; columnOx = camera.ox; columnScale = camera.scale;
	const step = view.w / CURVE_N;
	for (let s = 0; s <= CURVE_N; s++) {
		const a = (s * step - camera.ox) / camera.scale;
		columnSin[s] = Math.sin(a); columnCos[s] = Math.cos(a);
	}
}

function enclosingY(dx, dy, d2, r, column) {
	const dot = dx * columnSin[column] + dy * columnCos[column];
	const d = dot + Math.sqrt(Math.max(0, dot * dot + r * r - d2));
	return camera.oy - camera.scale * Math.log(Math.max(d, 1e-12));
}

function enclosingTrace(ctx, dx, dy, r, backwards) {
	columnCache();
	const d2 = dx * dx + dy * dy, step = view.w / CURVE_N;
	if (backwards) {
		for (let s = CURVE_N; s >= 0; s--) ctx.lineTo(s * step, enclosingY(dx, dy, d2, r, s));
		return;
	}
	for (let s = 0; s <= CURVE_N; s++) {
		const y = enclosingY(dx, dy, d2, r, s);
		if (s) ctx.lineTo(s * step, y); else ctx.moveTo(0, y);
	}
}

// A band is the strip between its own boundary and the next one, not another fill of
// everything below it: nested solid fills repaint the same pixels once per band.
function renderEnclosingStrip(ctx, dx, dy, rOuter, rInner) {
	const d2 = dx * dx + dy * dy;
	ctx.beginPath();
	enclosingTrace(ctx, dx, dy, rOuter, false);
	// an inner sphere that does not contain the pole has no lower half plane: the band then
	// runs to the bottom edge, like the deepest one
	if (rInner > 0 && d2 < rInner * rInner) enclosingTrace(ctx, dx, dy, rInner, true);
	else { ctx.lineTo(view.w, view.h + 1); ctx.lineTo(0, view.h + 1); }
	ctx.closePath(); ctx.fill();
}

// The top band draws in the body colour, so the cutaway joins the body's sky appearance.
// The air sphere is the strip above the surface; both sides are the same log scale.
function renderEnclosingBody(ctx, i) {
	const dx = system.wx[i] - camera.px, dy = system.wy[i] - camera.py;
	const R = system.radius[i], d2 = dx * dx + dy * dy;
	const profile = interiorProfiles[system.profile[i]], bands = profile.bands;
	const air = R * profile.air;
	if (d2 < air * air) {
		ctx.fillStyle = profile.airColor;
		renderEnclosingStrip(ctx, dx, dy, air, R);
	}
	let outer = R;
	for (let b = 0; b < bands.length; b++) {
		const inner = bands[b].inner * R;
		if (d2 < outer * outer) {
			ctx.fillStyle = b ? bands[b].color : system.color[i];
			renderEnclosingStrip(ctx, dx, dy, outer, inner);
		}
		outer = inner;
	}
}

function renderBandLabel(ctx, name, top, bottom) {
	if (bottom < 0 || top > view.h) return;
	const y0 = Math.max(top, 0), y1 = Math.min(bottom, view.h);
	if (y1 - y0 < 14) return;
	ctx.strokeText(name, view.w / 2, (y0 + y1) / 2);
	ctx.fillText(name, view.w / 2, (y0 + y1) / 2);
}

// Names sit in the middle of their band, and only the flat follow view is labelled:
// off centre the boundaries are curves and a centred label would miss its band.
function renderLayerLabels(ctx, i) {
	const dx = system.wx[i] - camera.px, dy = system.wy[i] - camera.py;
	const R = system.radius[i], near = R * 0.02;
	if (dx * dx + dy * dy > near * near) return;
	const profile = interiorProfiles[system.profile[i]], bands = profile.bands;
	ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	ctx.fillStyle = 'rgba(246,249,255,0.95)';
	ctx.strokeStyle = 'rgba(5,6,10,0.8)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
	const ground = camera.oy - camera.scale * Math.log(R);
	renderBandLabel(ctx, profile.airName, camera.oy - camera.scale * Math.log(R * profile.air), ground);
	let yTop = ground;
	for (let b = 0; b < bands.length; b++) {
		const r = bands[b].inner * R;
		const yBottom = r > 0 ? camera.oy - camera.scale * Math.log(r) : view.h;
		renderBandLabel(ctx, bands[b].name, yTop, yBottom);
		yTop = yBottom;
	}
	ctx.lineWidth = 1; ctx.textBaseline = 'alphabetic';
}

function renderGroundIndex() {
	const px = camera.px, py = camera.py;
	let ground = -1;
	for (let i = 0; i < system.nb; i++) {
		const dx = system.wx[i] - px, dy = system.wy[i] - py, r = system.radius[i];
		if (dx * dx + dy * dy < r * r) ground = i;
	}
	return ground;
}

function renderFrame() {
	const ctx = view.ctx;
	ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, view.w, view.h);
	ctx.fillStyle = '#8492b0';
	for (let i = 0; i < starsX.length; i++) ctx.fillRect(starsX[i] * view.w, starsY[i] * view.h, i % 9 ? 1 : 2, i % 9 ? 1 : 2);
	const ground = renderGroundIndex();
	ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(160,180,255,0.2)';
	for (let i = 0; i < system.nb; i++) {
		const p = system.parent[i];
		// the orbit under the pole runs through it, so its log image is singular: it whips a
		// full period instead of drawing a ring (findings: curve through the pole)
		if (p < 0 || i === ground) continue;
		renderCurve(system.wx[p], system.wy[p], system.orbitA[i]); renderCurveCopies(ctx, false);
	}
	for (let i = 0; i < system.nb; i++) {
		if (i === ground) { renderEnclosingBody(ctx, i); continue; }
		ctx.fillStyle = system.color[i];
		renderCurve(system.wx[i], system.wy[i], system.radius[i]); renderCurveCopies(ctx, true);
	}
	ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#d5dfef';
	const period = LOG_TAU * camera.scale;
	for (let i = 0; i < system.nb; i++) {
		if (i === ground) continue;
		const dx = system.wx[i] - camera.px, dy = system.wy[i] - camera.py, r = system.radius[i];
		const d2 = dx * dx + dy * dy;
		if (d2 <= r * r) continue;
		cameraProject(system.wx[i], system.wy[i]);
		const x = camera.x - period * Math.round((camera.x - view.w / 2) / period);
		if (x < -40 || x > view.w + 40 || camera.y < -20 || camera.y > view.h + 20) continue;
		const size = camera.scale * Math.asin(Math.min(1, r / Math.sqrt(d2)));
		ctx.fillText(system.name[i], x, camera.y - Math.max(4, size) - 6);
	}
	if (ground >= 0) renderLayerLabels(ctx, ground);
}

if (typeof module !== 'undefined') module.exports = { renderInit, renderResize, renderFrame, renderCurve, renderEnclosingBody, renderLayerLabels };
