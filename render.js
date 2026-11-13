// owns: canvas drawing + resize
// edit for: visuals, colors, soil, orbit/silhouette sampling

const ORBIT_SAMP = 128;
const STAR_N = 256;
const STAR_ALPHA = [0.18, 0.4, 0.66];
const STAR_COL = '#cfd8ee';

// indexed by body type: star, planet, moon
const SOIL_COL = ['#7a2014', '#5e3a1e', '#6e6a66'];
const LINE_COL = ['#d24a24', '#8a5a33', '#9a9691'];

let ox = null, oy = null, osing = null, sx = null, sy = null;
let starX = null, starY = null, starS = null, starA = null, starN = 0;
let starSeed = 0x2f6e2b1;

function renderInit() {
	projInit(ORBIT_SAMP);
	ox = new Float64Array(ORBIT_SAMP);
	oy = new Float64Array(ORBIT_SAMP);
	osing = new Uint8Array(ORBIT_SAMP);
	sx = new Float64Array(SIL_N);
	sy = new Float64Array(SIL_N);
	renderStarsInit();
	renderResize();
}

// stars are screen-space and generated once: no parallax, no twinkle, no work on resize
function renderStarsInit() {
	const per = Math.ceil(STAR_N / STAR_ALPHA.length);
	starX = new Float32Array(STAR_N);
	starY = new Float32Array(STAR_N);
	starS = new Float32Array(STAR_N);
	starA = new Float32Array(STAR_N);
	let i = 0;
	for (let b = 0; b < STAR_ALPHA.length; b++) {
		for (let k = 0; k < per && i < STAR_N; k++, i++) {
			starX[i] = starRand();
			starY[i] = starRand();
			starS[i] = starRand() < 0.8 ? 1 : 2;
			starA[i] = STAR_ALPHA[b];
		}
	}
	starN = i;
}

function starRand() {
	starSeed = (starSeed + 0x6d2b79f5) | 0;
	let t = Math.imul(starSeed ^ (starSeed >>> 15), 1 | starSeed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function renderStars(ctx) {
	const w = view.w, h = view.h;
	ctx.fillStyle = STAR_COL;
	let a = -1;
	// buckets are contiguous, so globalAlpha changes once per bucket per frame
	for (let i = 0; i < starN; i++) {
		if (starA[i] !== a) ctx.globalAlpha = a = starA[i];
		ctx.fillRect(starX[i] * w, starY[i] * h, starS[i], starS[i]);
	}
	ctx.globalAlpha = 1;
}

function renderResize() {
	// cap at 2: fill cost is dpr^2 and every sampled curve is drawn 3 times
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const w = window.innerWidth, h = window.innerHeight;
	view.canvas.width = Math.round(w * dpr);
	view.canvas.height = Math.round(h * dpr);
	view.canvas.style.width = w + 'px';
	view.canvas.style.height = h + 'px';
	view.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	view.w = w;
	view.h = h;
}

function renderFrame(now) {
	projStep(now);
	const ctx = view.ctx;
	ctx.fillStyle = '#05060a';
	ctx.fillRect(0, 0, view.w, view.h);
	renderStars(ctx);
	renderOrbits(ctx);
	renderGround(ctx);
	renderBodies(ctx);
	renderLabels(ctx);
}

// unwraps x-laps along the curve (skipping singular samples), then anchors its head
// into the central copy; exact-W jumps are invisible under 3-copy drawing
function renderRelift(x, sing, n) {
	const w = view.w;
	let anchor = -1;
	for (let s = 0; s < n; s++) {
		if (sing && sing[s]) continue;
		if (anchor >= 0) x[s] -= w * Math.round((x[s] - x[anchor]) / w);
		anchor = s;
	}
	for (let s = 0; s < n; s++) {
		if (sing && sing[s]) continue;
		const sh = -w * Math.round((x[s] - w / 2) / w);
		for (let q = 0; q < n; q++) x[q] += sh;
		return;
	}
}

function renderOrbits(ctx) {
	const p = projection, w = view.w, os = p.orbitSamp;
	ctx.lineWidth = 1;
	ctx.strokeStyle = 'rgba(160,180,255,0.18)';
	for (let b = 1; b < system.nb; b++) {
		const base = p.orbitBase + b * os;
		for (let s = 0; s < os; s++) {
			projElemAt(base + s, p.ewx[base + s], p.ewy[base + s]);
			ox[s] = p.ex;
			oy[s] = p.ey;
			osing[s] = p.sing;
		}
		renderRelift(ox, osing, os);
		for (let c = 0; c < p.copies; c++) {
			const dx = (c - (p.copies - 1) / 2) * w;
			ctx.beginPath();
			let pen = false;
			for (let s = 0; s < os; s++) {
				if (osing[s]) {
					pen = false;
					continue;
				}
				if (pen) ctx.lineTo(ox[s] + dx, oy[s]);
				else ctx.moveTo(ox[s] + dx, oy[s]);
				pen = true;
			}
			ctx.stroke();
		}
	}
}

function renderGround(ctx) {
	const p = projection, tr = p.trans;
	if (!tr) {
		if (p.steady.kind === 1) renderSurface(ctx, p.steady, null, 0, 1, 0.35, 'unfold');
		return;
	}
	if (tr.sa.kind === 1 && !(tr.dst.kind === 1 && tr.dst.sel === tr.sa.sel))
		renderSurface(ctx, tr.sa, tr.dst, 2, 1 - tr.raw, tr.split, tr.soilStart);
	if (tr.dst.kind === 1)
		renderSurface(ctx, tr.dst, tr.sa, 0, tr.raw, tr.split, tr.soilStart);
}

function renderSurface(ctx, st, other, role, t, split, soilStart) {
	const b = st.sel, type = system.type[b], dir = type === 1 ? 1 : -1;
	const band = surfaceSoilTime(t, split, soilStart);
	if (other) surfacePoints(st, other, role, t, split, b, sx, sy);
	else {
		const center = projRelift(st.xoff);
		for (let s = 0; s < SIL_N; s++) {
			sx[s] = center + view.w * (s / (SIL_N - 1) - 0.5);
			sy[s] = st.yline;
		}
	}
	for (let c = -1; c <= 1; c++) renderSurfaceCopy(ctx, b, type, band, dir, c * view.w, other && t < split);
}

function renderSurfaceStroke(ctx, type, band, dx) {
	ctx.beginPath();
	ctx.moveTo(sx[0] + dx, sy[0]);
	for (let s = 1; s < SIL_N; s++) ctx.lineTo(sx[s] + dx, sy[s]);
	ctx.globalAlpha = band;
	ctx.lineWidth = 2;
	ctx.strokeStyle = LINE_COL[type];
	ctx.stroke();
}

function renderSurfaceCopy(ctx, b, type, band, dir, dx, disk) {
	if (!settings.strokeOver) renderSurfaceStroke(ctx, type, band, dx);
	ctx.beginPath();
	ctx.moveTo(sx[0] + dx, sy[0]);
	for (let s = 1; s < SIL_N; s++) ctx.lineTo(sx[s] + dx, sy[s]);
	if (!disk) {
		const edge = dir === 1 ? view.h : 0;
		ctx.lineTo(sx[SIL_N - 1] + dx, edge);
		ctx.lineTo(sx[0] + dx, edge);
	}
	ctx.closePath();
	ctx.globalAlpha = 1;
	ctx.fillStyle = system.color[b];
	ctx.fill();
	ctx.globalAlpha = band;
	ctx.fillStyle = SOIL_COL[type];
	ctx.fill();
	if (settings.strokeOver) renderSurfaceStroke(ctx, type, band, dx);
	ctx.globalAlpha = 1;
}

function renderBodyAlpha(i) {
	const p = projection, tr = p.trans;
	if (!tr) return p.steady.kind === 1 && p.steady.sel === i ? 0 : 1;
	if (tr.sa.kind === 1 && tr.sa.sel === i) return 0;
	if (tr.dst.kind === 1 && tr.dst.sel === i) return 0;
	return 1;
}

function renderBodies(ctx) {
	const p = projection, w = view.w;
	for (let i = 0; i < system.nb; i++) {
		const alpha = renderBodyAlpha(i);
		if (alpha <= 0.02) continue;
		const r = projIconR(i);
		ctx.globalAlpha = alpha;
		for (let c = 0; c < p.copies; c++) {
			const x = p.bx[i] + (c - (p.copies - 1) / 2) * w;
			if (x < -20 || x > w + 20) continue;
			if (system.type[i] === 0) {
				ctx.beginPath();
				ctx.arc(x, p.by[i], r * 2.2, 0, TAU);
				ctx.fillStyle = 'rgba(255,200,90,0.15)';
				ctx.fill();
			}
			ctx.beginPath();
			ctx.arc(x, p.by[i], r, 0, TAU);
			ctx.fillStyle = system.color[i];
			ctx.fill();
		}
	}
	ctx.globalAlpha = 1;
}

function renderLabels(ctx) {
	const p = projection, w = view.w;
	ctx.font = '11px system-ui, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillStyle = '#cfd6e6';
	for (let i = 0; i < system.nb; i++) {
		const alpha = renderBodyAlpha(i);
		if (alpha <= 0.05) continue;
		ctx.globalAlpha = alpha;
		for (let c = 0; c < p.copies; c++) {
			const x = p.bx[i] + (c - (p.copies - 1) / 2) * w;
			if (x < -40 || x > w + 40) continue;
			ctx.fillText(system.name[i], x, p.by[i] - projIconR(i) - 6);
		}
	}
	ctx.globalAlpha = 1;
	ctx.textAlign = 'left';
}

if (typeof module !== 'undefined') module.exports = { renderInit, renderResize, renderFrame, ORBIT_SAMP };
