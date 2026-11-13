// owns: body table + kinematics, including a freely movable planet
// edit for: orbits, sizes, periods, colors, sim timing

const system = {
	nb: 0,
	name: null, type: null, parent: null,
	orbitA: null, radius: null, period: null, phase: null, color: null,
	wx: null, wy: null, rmax: null,
	time: 0,
};

// earth year = 60s, planets kepler-scaled; moon periods real-ratio (1d=0.164s), clamped >=2s
function sysInit() {
	const rows = [
		// name, type, parent, a, radius, period(s), phase, color
		['sun', 0, -1, 0, 0.090, 0, 0, '#ffd75e'],
		['mercury', 1, 0, 0.62, 0.020, 19.8, 0.4, '#b8a89a'],
		['venus', 1, 0, 0.95, 0.034, 37.5, 2.1, '#e8c468'],
		['earth', 1, 0, 1.30, 0.038, 60, 4.0, '#5b8dd9'],
		['mars', 1, 0, 1.80, 0.028, 97.9, 1.1, '#c96f4a'],
		['jupiter', 1, 0, 2.60, 0.085, 169.7, 5.3, '#d9a066'],
		['saturn', 1, 0, 3.40, 0.072, 253.5, 3.2, '#e0cf98'],
		['luna', 2, 3, 0.12, 0.012, 4.5, 0.7, '#cfcfcf'],
		['phobos', 2, 4, 0.055, 0.006, 2.0, 2.4, '#a08878'],
		['io', 2, 5, 0.15, 0.010, 2.0, 4.4, '#e8d060'],
		['callisto', 2, 5, 0.32, 0.013, 2.75, 1.9, '#9a8a7a'],
		['titan', 2, 6, 0.20, 0.012, 2.6, 5.8, '#d9a860'],
		['wanderer', 1, -1, 0, 0.045, 0, 0, '#75c5a0'],
	];
	const nb = rows.length;
	system.nb = nb;
	system.name = new Array(nb);
	system.type = new Int8Array(nb);
	system.parent = new Int8Array(nb);
	system.orbitA = new Float64Array(nb);
	system.radius = new Float64Array(nb);
	system.period = new Float64Array(nb);
	system.phase = new Float64Array(nb);
	system.color = new Array(nb);
	system.wx = new Float64Array(nb);
	system.wy = new Float64Array(nb);
	system.rmax = new Float64Array(nb);
	for (let i = 0; i < nb; i++) {
		const r = rows[i];
		system.name[i] = r[0];
		system.type[i] = r[1];
		system.parent[i] = r[2];
		system.orbitA[i] = r[3];
		system.radius[i] = r[4];
		system.period[i] = r[5];
		system.phase[i] = r[6];
		system.color[i] = r[7];
	}
	system.wx[nb - 1] = 1.6;
	system.wy[nb - 1] = -1.0;
	for (let i = 0; i < nb; i++) {
		const p = system.parent[i];
		system.rmax[i] = p < 0 ? 0 : system.rmax[p] + system.orbitA[i];
	}
}

function sysStep(dtMs) {
	system.time += Math.min(dtMs, 50) / 1000;
	const t = system.time;
	for (let i = 0; i < system.nb; i++) {
		const p = system.parent[i];
		if (p < 0) continue;
		const ang = system.phase[i] + 2 * Math.PI * t / system.period[i];
		system.wx[i] = system.wx[p] + system.orbitA[i] * Math.cos(ang);
		system.wy[i] = system.wy[p] + system.orbitA[i] * Math.sin(ang);
	}
}

if (typeof module !== 'undefined') module.exports = { system, sysInit, sysStep };
