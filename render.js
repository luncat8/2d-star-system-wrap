// owns: canvas drawing + resize
// edit for: visuals, colors, soil, orbit/silhouette sampling

const ORBIT_SAMP = 128;

// indexed by body type: star, planet, moon
const SOIL_COL = ['#7a2014', '#5e3a1e', '#6e6a66'];
const LINE_COL = ['#d24a24', '#8a5a33', '#9a9691'];

let ox = null, oy = null, osing = null, sx = null, sy = null;

function renderInit() {
	projInit(ORBIT_SAMP);
	ox = new Float64Array(ORBIT_SAMP);
	oy = new Float64Array(ORBIT_SAMP);
	osing = new Uint8Array(ORBIT_SAMP);
	sx = new Float64Array(SIL_N);
	sy = new Float64Array(SIL_N);
	renderResize();
}

function renderResize() {
	const dpr = window.devicePixelRatio || 1;
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
	const p = projection, w = view.w;
	const soilH = view.h * SOIL_FRAC;
	for (let j = 0; j < p.silN; j++) {
		const b = p.silB[j], band = p.silBand[j];
		const base = p.silBase + b * SIL_N;
		for (let s = 0; s < SIL_N; s++) {
			projElemAt(base + s, p.ewx[base + s], p.ewy[base + s]);
			sx[s] = p.ex;
			sy[s] = p.ey;
		}
		renderRelift(sx, null, SIL_N);
		const type = system.type[b];
		const off = (type === 1 ? 1 : -1) * band * soilH;
		for (let c = 0; c < p.copies; c++) renderSilCopy(ctx, b, type, band, off, (c - (p.copies - 1) / 2) * w);
	}
}

function renderSilCopy(ctx, b, type, band, off, dx) {
	ctx.beginPath();
	ctx.moveTo(sx[0] + dx, sy[0]);
	for (let s = 1; s < SIL_N; s++) ctx.lineTo(sx[s] + dx, sy[s]);
	ctx.globalAlpha = band;
	ctx.lineWidth = 2;
	ctx.strokeStyle = LINE_COL[type];
	ctx.stroke();
	if (Math.abs(off) < 0.5) ctx.closePath();
	else {
		ctx.lineTo(sx[SIL_N - 1] + dx, sy[SIL_N - 1] + off);
		for (let s = SIL_N - 2; s >= 0; s--) ctx.lineTo(sx[s] + dx, sy[s] + off);
		ctx.closePath();
	}
	ctx.globalAlpha = band;
	ctx.fillStyle = SOIL_COL[type];
	ctx.fill();
	ctx.globalAlpha = 1 - band;
	ctx.fillStyle = system.color[b];
	ctx.fill();
	ctx.globalAlpha = 1;
}

function renderBodyAlpha(i) {
	const p = projection;
	for (let j = 0; j < p.silN; j++) if (p.silB[j] === i) return 1 - p.silBand[j];
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
