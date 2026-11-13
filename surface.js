// owns: edge-based ground transitions and their timing
// edit for: sink, unfold and soil crossfade geometry

function surfaceEase(t) {
	t = Math.max(0, Math.min(1, t));
	return t * t * (3 - 2 * t);
}

function surfaceSkyTime(t, split, wait) {
	return surfaceEase(wait ? (t - split) / (1 - split) : t);
}

function surfaceSoilTime(t, split, start) {
	const begin = start === 'sink' ? 0 : split;
	return surfaceEase((t - begin) / (split + (1 - split) * 0.5 - begin));
}

// Writes a period of the surface into the renderer's reusable buffers.
function surfacePoints(st, other, role, t, split, b, x, y) {
	const w = view.w, h = view.h;
	const dir = system.type[b] === 1 ? 1 : -1;
	const edge = dir === 1 ? h : 0;
	const rg = w / TAU;
	const center = projRelift(st.xoff);
	if (t < split) {
		const k = surfaceEase(t / split);
		let x0 = projEvalX(other, role === 0 ? thA : thC, role, b, system.wx[b]);
		const y0 = projEvalY(other, role, b, system.wx[b], system.wy[b]);
		x0 = center + (x0 - center) - w * Math.round((x0 - center) / w);
		const cx = x0 + (center - x0) * k;
		const cy = y0 + (edge - y0) * k;
		const r0 = other.kind === 0 ? system.radius[b] * other.s : projIconR(b);
		const r = r0 + (rg - r0) * k;
		for (let s = 0; s < SIL_N; s++) {
			const a = TAU * (s / (SIL_N - 1) - 0.5);
			x[s] = cx + r * Math.sin(a);
			y[s] = cy - dir * r * Math.cos(a);
		}
		return;
	}
	const e = surfaceEase((t - split) / (1 - split));
	const phi = TAU * (1 - e);
	const line = edge - dir * rg + (st.yline - (edge - dir * rg)) * e;
	for (let s = 0; s < SIL_N; s++) {
		const u = w * (s / (SIL_N - 1) - 0.5);
		const a = u * phi / w;
		x[s] = center + (phi < 1e-8 ? u : w * Math.sin(a) / phi);
		y[s] = line + (phi < 1e-8 ? 0 : dir * w * 2 * Math.sin(a / 2) ** 2 / phi);
	}
}

if (typeof module !== 'undefined') module.exports = { surfaceEase, surfaceSkyTime, surfaceSoilTime, surfacePoints };
