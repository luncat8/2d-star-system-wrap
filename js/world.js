// owns: world model, body definitions, orbit motion
// edit for: bodies, orbit elements, motion

const TAU = Math.PI * 2;

const world = {
	bodies: [],
	orbits: [],
	t: 0,
	systemRadius: 1,
};

function makeBody(cls, x, y, r, color) {
	return { cls, x, y, r, color, sx: 0, sy: 0, sr: 0, orbitColor: '#fff', glowColor: '#fff' };
}

function makeOrbit(center, sat, a, b, rot, th0, om) {
	const N = 128;
	const rel = new Float32Array(N * 2);
	const cr = Math.cos(rot);
	const sr = Math.sin(rot);
	for (let i = 0; i < N; i++) {
		const th = i / N * TAU;
		const rx = a * Math.cos(th);
		const ry = b * Math.sin(th);
		rel[i * 2] = rx * cr - ry * sr;
		rel[i * 2 + 1] = rx * sr + ry * cr;
	}
	return { center, sat, a, b, rot, th0, om, N, rel };
}

function initWorld() {
	const B = world.bodies;
	const O = world.orbits;
	B.length = 0;
	O.length = 0;
	world.t = 0;

	const pDefs = [
		{ a: 280, e: 0.05, rot: 0.3, th0: 0.4, per: 42, r: 24, color: '#c98b5e' },
		{ a: 470, e: 0.12, rot: 1.1, th0: 2.1, per: 70, r: 32, color: '#5fbf7f' },
		{ a: 700, e: 0.28, rot: 2.4, th0: 4.0, per: 110, r: 20, color: '#d96b4a' },
		{ a: 980, e: 0.06, rot: 0.8, th0: 5.3, per: 160, r: 28, color: '#6fa8dc' },
	];
	const mDefs = [
		{ p: 0, a: 75, r: 9, color: '#d8d8d8', th0: 0.2, per: 10 },
		{ p: 1, a: 95, r: 11, color: '#cfcfcf', th0: 1.3, per: 14 },
		{ p: 1, a: 150, r: 7, color: '#bdbdbd', th0: 4.1, per: 22 },
		{ p: 2, a: 80, r: 8, color: '#d2d2d2', th0: 2.6, per: 12 },
		{ p: 3, a: 120, r: 10, color: '#c4c4c4', th0: 5.0, per: 18 },
	];

	B.push(makeBody('star', 0, 0, 70, '#ffcf6b'));

	const planetIdx = [];
	const planetA = [];
	for (let i = 0; i < pDefs.length; i++) {
		const d = pDefs[i];
		const idx = B.length;
		planetIdx.push(idx);
		planetA.push(d.a);
		B.push(makeBody('planet', d.a, 0, d.r, d.color));
		const b = d.a * Math.sqrt(1 - d.e * d.e);
		O.push(makeOrbit(0, idx, d.a, b, d.rot, d.th0, TAU / d.per));
	}

	let radius = 0;
	for (let i = 0; i < mDefs.length; i++) {
		const d = mDefs[i];
		const idx = B.length;
		B.push(makeBody('moon', d.a, 0, d.r, d.color));
		O.push(makeOrbit(planetIdx[d.p], idx, d.a, d.a, 0, d.th0, TAU / d.per));
		const reach = planetA[d.p] + d.a;
		if (reach > radius) radius = reach;
	}
	for (let i = 0; i < planetA.length; i++) {
		if (planetA[i] > radius) radius = planetA[i];
	}
	world.systemRadius = radius;
	updateWorld(0);
}

function updateWorld(dt) {
	world.t += dt;
	const t = world.t;
	const B = world.bodies;
	const O = world.orbits;
	for (let k = 0; k < O.length; k++) {
		const o = O[k];
		const c = B[o.center];
		const sat = B[o.sat];
		const th = o.th0 + o.om * t;
		const rx = o.a * Math.cos(th);
		const ry = o.b * Math.sin(th);
		const cr = Math.cos(o.rot);
		const sr = Math.sin(o.rot);
		sat.x = c.x + rx * cr - ry * sr;
		sat.y = c.y + rx * sr + ry * cr;
	}
}