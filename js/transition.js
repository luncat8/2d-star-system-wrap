// owns: selection morph timing, scrub state and line position
// edit for: duration, easing, settle speed

const trans = {
	active: false,
	from: -1,
	to: -1,
	t: 0,
	dur: 3,
	eased: 0,
	drag: false,
	settle: false,
	settleFrom: 0,
	settleTo: 0,
	settleT: 0,
	settleDur: 0.3,
	line: 0,
	fromLine: 0,
	groundTop: 0,
	groundBot: 0,
	fromGroundTop: 0,
	fromGroundBot: 0,
};

const SETTLE_MIN = 0.15;
const SETTLE_RANGE = 0.35;

function easeInOutCubic(t) {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function bodyLine(i) {
	return world.bodies[i].cls === 'planet' ? view.H * 0.9 : view.H * 0.1;
}

function edgeFor(i) {
	return world.bodies[i].cls === 'planet' ? view.H : 0;
}

function groundTop(i) {
	return world.bodies[i].cls === 'planet' ? view.H * 0.9 : 0;
}

function groundBot(i) {
	return world.bodies[i].cls === 'planet' ? view.H : view.H * 0.1;
}

function startTransition(i) {
	if (trans.active || i === view.selected) return;
	trans.from = view.selected;
	trans.to = i;
	trans.t = 0;
	trans.eased = 0;
	trans.active = true;
	trans.drag = false;
	trans.settle = false;
	view.selected = i;
}

function startScrub(i) {
	if (trans.active || i === view.selected) return false;
	trans.from = view.selected;
	trans.to = i;
	trans.t = 0;
	trans.eased = 0;
	trans.active = true;
	trans.drag = true;
	trans.settle = false;
	return true;
}

function scrubTo(p) {
	if (!trans.active || !trans.drag) return;
	const u = p > 0 ? (p > 1 ? 1 : p) : 0;
	trans.t = u;
	trans.eased = u;
}

function continueAsClick() {
	if (!trans.active || !trans.drag) return;
	trans.drag = false;
	trans.settle = false;
	trans.t = 0;
	trans.eased = 0;
	trans.dur = 3;
	view.selected = trans.to;
}

function settleTransition(to) {
	if (!trans.active) return;
	const target = to >= 1 ? 1 : 0;
	const dist = Math.abs(target - trans.t);
	trans.drag = false;
	if (dist < 1e-4) {
		trans.t = target;
		trans.eased = target;
		finishTransition(target >= 1 ? trans.to : trans.from);
		return;
	}
	trans.settle = true;
	trans.settleFrom = trans.t;
	trans.settleTo = target;
	trans.settleT = 0;
	trans.settleDur = SETTLE_MIN + SETTLE_RANGE * dist;
}

function finishTransition(sel) {
	trans.active = false;
	trans.drag = false;
	trans.settle = false;
	if (sel >= 0) view.selected = sel;
}

function updateTransition(dt) {
	if (trans.active) {
		if (trans.drag) {
			// t and eased are driven by the drag
		} else if (trans.settle) {
			trans.settleT += dt / trans.settleDur;
			if (trans.settleT >= 1) {
				trans.t = trans.settleTo;
				trans.eased = trans.t;
				finishTransition(trans.settleTo >= 1 ? trans.to : trans.from);
			} else {
				const k = easeInOutCubic(trans.settleT);
				trans.t = trans.settleFrom + (trans.settleTo - trans.settleFrom) * k;
				trans.eased = trans.t;
			}
		} else {
			trans.t += dt / trans.dur;
			if (trans.t >= 1) {
				trans.t = 1;
				finishTransition(trans.to);
			}
			trans.eased = easeInOutCubic(trans.t);
		}
	} else {
		trans.eased = 1;
	}
	const to = trans.active ? trans.to : view.selected;
	if (to < 0) {
		trans.line = 0;
		trans.groundTop = 0;
		trans.groundBot = 0;
		return;
	}
	const tl = bodyLine(to);
	if (!trans.active) {
		trans.line = tl;
		trans.groundTop = groundTop(to);
		trans.groundBot = groundBot(to);
		return;
	}
	const fl = trans.from < 0 ? edgeFor(to) : bodyLine(trans.from);
	if (trans.from < 0) {
		trans.fromLine = fl;
		trans.line = fl + (tl - fl) * trans.eased;
		trans.fromGroundTop = fl;
		trans.fromGroundBot = fl;
		trans.groundTop = fl + (groundTop(to) - fl) * trans.eased;
		trans.groundBot = fl + (groundBot(to) - fl) * trans.eased;
		return;
	}
	const from = trans.from;
	if (skyOf(from) === skyOf(to)) {
		const ft = groundTop(from);
		const fb = groundBot(from);
		trans.fromLine = fl;
		trans.line = fl + (tl - fl) * trans.eased;
		trans.fromGroundTop = ft + (groundTop(to) - ft) * trans.eased;
		trans.fromGroundBot = fb + (groundBot(to) - fb) * trans.eased;
		trans.groundTop = trans.fromGroundTop;
		trans.groundBot = trans.fromGroundBot;
		return;
	}
	const dir = skyOf(to);
	const shift = view.H * 0.1 * dir;
	const e = trans.eased;
	trans.fromLine = fl + shift * e;
	trans.fromGroundTop = groundTop(from) + shift * e;
	trans.fromGroundBot = groundBot(from) + shift * e;
	const edge = edgeFor(to);
	trans.line = edge + (tl - edge) * e;
	trans.groundTop = groundTop(to) - shift * (1 - e);
	trans.groundBot = groundBot(to) - shift * (1 - e);
}