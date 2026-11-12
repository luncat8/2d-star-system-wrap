// owns: pointer hit test, selection and drag-to-wrap scrub
// edit for: hit radius, drag slop, settle threshold

const DRAG_SLOP = 5;
const drag = { active: false, moved: false, x0: 0, y0: 0, body: -1, dir: 0 };

function initInput() {
	canvas.addEventListener('pointerdown', onPointerDown);
	canvas.addEventListener('pointermove', onPointerMove);
	canvas.addEventListener('pointerup', onPointerUp);
	canvas.addEventListener('pointercancel', onPointerCancel);
}

function onPointerDown(e) {
	if (trans.active) return;
	drag.active = true;
	drag.moved = false;
	drag.x0 = e.clientX;
	drag.y0 = e.clientY;
	drag.body = pickBody(e.clientX, e.clientY);
	drag.dir = drag.body < 0 ? 0 : world.bodies[drag.body].cls === 'planet' ? 1 : -1;
	if (drag.body >= 0) startScrub(drag.body);
	if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
	if (!drag.active) return;
	const dx = e.clientX - drag.x0;
	const dy = e.clientY - drag.y0;
	if (!drag.moved && dx * dx + dy * dy < DRAG_SLOP * DRAG_SLOP) return;
	drag.moved = true;
	if (drag.body < 0 || !trans.active || !trans.drag) return;
	scrubTo(dragProgress(e.clientY));
}

function onPointerUp(e) {
	if (!drag.active) return;
	const moved = drag.moved;
	const body = drag.body;
	if (moved && trans.active && trans.drag) scrubTo(dragProgress(e.clientY));
	drag.active = false;
	drag.moved = false;
	drag.body = -1;
	if (!moved) {
		if (body >= 0) continueAsClick();
		return;
	}
	if (!trans.active || !trans.drag) return;
	settleTransition(trans.t > 0.5 ? 1 : 0);
}

function onPointerCancel() {
	if (!drag.active) return;
	drag.active = false;
	drag.moved = false;
	drag.body = -1;
	if (trans.active && trans.drag) settleTransition(0);
}

function dragProgress(y) {
	if (drag.dir > 0) {
		const span = view.H - drag.y0;
		return span > 1 ? (y - drag.y0) / span : y > drag.y0 ? 1 : 0;
	}
	const span = drag.y0;
	return span > 1 ? (drag.y0 - y) / span : y < drag.y0 ? 1 : 0;
}

function pickBody(x, y) {
	let best = -1;
	let bestD = Infinity;
	const n = world.bodies.length;
	for (let i = 0; i < n; i++) {
		if (i === view.selected) continue;
		const b = world.bodies[i];
		const dx = x - b.sx;
		const dy = y - b.sy;
		const d2 = dx * dx + dy * dy;
		const rr = b.sr + 6 > 12 ? b.sr + 6 : 12;
		if (d2 <= rr * rr && d2 < bestD) {
			bestD = d2;
			best = i;
		}
	}
	return best;
}
