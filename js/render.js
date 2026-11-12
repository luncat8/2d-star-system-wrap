// owns: canvas drawing
// edit for: colors, icon sizes, line style

const BG = '#05060a';
const _rs = { x: 0, y: 0 };
const SOIL_HEX = ['#7a1f1f', '#5a3a24', '#3f3f46'];
const SOIL_RGB = [[122, 31, 31], [90, 58, 36], [63, 63, 70]];
const SOIL_RAMP = [];

function withAlpha(hex, a) {
	const n = parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

function classIndex(cls) {
	return cls === 'star' ? 0 : cls === 'planet' ? 1 : 2;
}

function soilColor(i) {
	return SOIL_HEX[classIndex(world.bodies[i].cls)];
}

function buildSoilRamp() {
	for (let a = 0; a < 3; a++) {
		SOIL_RAMP[a] = [];
		for (let b = 0; b < 3; b++) {
			const ca = SOIL_RGB[a];
			const cb = SOIL_RGB[b];
			const ramp = [];
			for (let k = 0; k < 64; k++) {
				const t = k / 63;
				const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
				const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
				const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
				ramp.push('rgb(' + r + ',' + g + ',' + bl + ')');
			}
			SOIL_RAMP[a][b] = ramp;
		}
	}
}

function initRender() {
	buildSoilRamp();
	for (let i = 0; i < world.bodies.length; i++) {
		const b = world.bodies[i];
		b.orbitColor = withAlpha(b.color, 0.22);
		b.glowColor = withAlpha(b.color, b.cls === 'star' ? 0.16 : 0.10);
	}
}

function drawScene() {
	ctx.fillStyle = BG;
	ctx.fillRect(0, 0, view.W, view.H);
	projectBodies();
	drawGround();
	drawOrbits();
	drawBodies();
	drawWrapLine();
}

function drawGround() {
	if (trans.active && trans.from >= 0 && skyOf(trans.from) !== skyOf(trans.to)) {
		drawBand(trans.fromGroundTop, trans.fromGroundBot, soilColor(trans.from));
		drawBand(trans.groundTop, trans.groundBot, soilColor(trans.to));
		return;
	}
	let top;
	let bot;
	let col;
	if (trans.active) {
		top = trans.groundTop;
		bot = trans.groundBot;
		const a = trans.from >= 0 ? classIndex(world.bodies[trans.from].cls) : classIndex(world.bodies[trans.to].cls);
		const b = classIndex(world.bodies[trans.to].cls);
		col = a === b ? SOIL_HEX[b] : SOIL_RAMP[a][b][Math.round(trans.eased * 63)];
	} else if (view.selected >= 0) {
		top = groundTop(view.selected);
		bot = groundBot(view.selected);
		col = soilColor(view.selected);
	} else {
		return;
	}
	drawBand(top, bot, col);
}

function drawBand(top, bot, col) {
	ctx.fillStyle = col;
	ctx.fillRect(0, top, view.W, bot - top);
}

function drawOrbits() {
	ctx.lineWidth = 1;
	const n = world.orbits.length;
	for (let k = 0; k < n; k++) {
		const o = world.orbits[k];
		const c = world.bodies[o.center];
		ctx.strokeStyle = world.bodies[o.sat].orbitColor;
		ctx.beginPath();
		const N = o.N;
		const rel = o.rel;
		let px = 0;
		let started = false;
		for (let i = 0; i <= N; i++) {
			const j = (i % N) * 2;
			projectPoint(c.x + rel[j], c.y + rel[j + 1], _rs);
			const x = _rs.x;
			const y = _rs.y;
			if (!started || Math.abs(x - px) > view.W * 0.25) {
				ctx.moveTo(x, y);
				started = true;
			} else {
				ctx.lineTo(x, y);
			}
			px = x;
		}
		ctx.stroke();
	}
}

function drawBodies() {
	const n = world.bodies.length;
	for (let i = 0; i < n; i++) {
		const b = world.bodies[i];
		if (!trans.active && i === view.selected) continue;
		if (trans.active && i === trans.from) {
			drawRise(b);
			continue;
		}
		if (trans.active && i === trans.to) {
			drawFlatten(b, trans.from < 0 ? mapRadius(b) : wrapRadius(b, trans.from));
			continue;
		}
		drawIcon(b);
	}
}

function drawIcon(b) {
	if (b.cls === 'star') {
		ctx.fillStyle = b.glowColor;
		ctx.beginPath();
		ctx.arc(b.sx, b.sy, b.sr * 2.4, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = b.color;
	ctx.beginPath();
	ctx.arc(b.sx, b.sy, b.sr, 0, Math.PI * 2);
	ctx.fill();
}

function drawFlatten(b, r0) {
	const ry = r0 * (1 - trans.eased);
	if (ry < 0.4) return;
	ctx.fillStyle = b.color;
	ctx.beginPath();
	ctx.ellipse(b.sx, b.sy, r0, ry, 0, 0, Math.PI * 2);
	ctx.fill();
}

function drawRise(b) {
	const ry = b.sr * trans.eased;
	if (ry < 0.4) return;
	if (b.cls === 'star') {
		ctx.globalAlpha = trans.eased;
		ctx.fillStyle = b.glowColor;
		ctx.beginPath();
		ctx.arc(b.sx, b.sy, b.sr * 2.4, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
	}
	ctx.fillStyle = b.color;
	ctx.beginPath();
	ctx.ellipse(b.sx, b.sy, b.sr, ry, 0, 0, Math.PI * 2);
	ctx.fill();
}

function drawWrapLine() {
	if (!trans.active && view.selected < 0) return;
	ctx.strokeStyle = 'rgba(255,255,255,0.14)';
	ctx.lineWidth = 1;
	lineAt(trans.line);
	if (trans.active && trans.from >= 0 && skyOf(trans.from) !== skyOf(trans.to)) lineAt(trans.fromLine);
}

function lineAt(y) {
	y = Math.round(y) + 0.5;
	ctx.beginPath();
	ctx.moveTo(0, y);
	ctx.lineTo(view.W, y);
	ctx.stroke();
}