// owns: selection morph timing and line position
// edit for: duration, easing

const trans = {
	active: false,
	from: -1,
	to: -1,
	t: 0,
	dur: 3,
	eased: 0,
	line: 0,
	fromLine: 0,
	groundTop: 0,
	groundBot: 0,
	fromGroundTop: 0,
	fromGroundBot: 0,
};

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
	trans.active = true;
	trans.eased = 0;
	view.selected = i;
}

function updateTransition(dt) {
	if (trans.active) {
		trans.t += dt / trans.dur;
		if (trans.t >= 1) {
			trans.t = 1;
			trans.active = false;
		}
		trans.eased = easeInOutCubic(trans.t);
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