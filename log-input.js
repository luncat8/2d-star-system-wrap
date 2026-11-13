// owns: pointer gestures, body selection and free-flight controls
// edit for: interaction and keyboard bindings

const gesture = { active: false, dragging: false, id: 0, x: 0, y: 0, px: 0, py: 0, scale: 0, rx: 0, ry: 0, qx: 0, qy: 0, ref: 1 };
const flightKeys = new Set();

function inputInit() {
	const canvas = view.canvas;
	canvas.addEventListener('pointerdown', inputDown);
	canvas.addEventListener('pointermove', inputMove);
	canvas.addEventListener('pointerup', inputUp);
	canvas.addEventListener('pointercancel', inputCancel);
	window.addEventListener('keydown', inputKeyDown);
	window.addEventListener('keyup', inputKeyUp);
	window.addEventListener('blur', () => flightKeys.clear());
	const choice = $('bodyChoice');
	for (let i = 0; i < system.nb; i++) {
		const option = document.createElement('option');
		option.value = i; option.textContent = system.name[i]; choice.appendChild(option);
	}
	choice.value = String(system.nb - 1);
	$('followBody').addEventListener('click', () => inputFollow(Number(choice.value)));
	$('resetView').addEventListener('click', () => { cameraReset(); inputStatus(); });
}

function inputFollow(i) {
	cameraFollow(i, view.now);
	$('bodyChoice').value = String(i);
	inputStatus();
}

function inputStatus() {
	$('viewStatus').textContent = camera.target < 0 ? 'Free view' : 'Following ' + system.name[camera.target];
}

function inputDown(ev) {
	if (gesture.active || ev.button !== 0) return;
	cameraUnproject(ev.clientX, ev.clientY);
	gesture.active = true; gesture.dragging = false; gesture.id = ev.pointerId;
	gesture.x = ev.clientX; gesture.y = ev.clientY;
	gesture.px = camera.px; gesture.py = camera.py; gesture.scale = camera.scale;
	// ground state snapshot at press, so a moving body cannot reclassify mid-drag
	cameraAnchorGround(camera.x, camera.y);
	gesture.rx = anchor.rx; gesture.ry = anchor.ry;
	gesture.qx = anchor.qx; gesture.qy = anchor.qy; gesture.ref = anchor.ref;
	view.canvas.setPointerCapture(ev.pointerId);
}

function inputMove(ev) {
	if (!gesture.active || ev.pointerId !== gesture.id) return;
	const dx = ev.clientX - gesture.x, dy = ev.clientY - gesture.y;
	if (!gesture.dragging && Math.hypot(dx, dy) < 4) return;
	gesture.dragging = true;
	camera.target = -1; camera.transition = null;
	// downward progress to the ground line drives pole, bearing and zoom to the anchor's ground state
	const k = Math.max(0, Math.min(1, dy / Math.max(80, view.h * GROUND - gesture.y)));
	const d0 = Math.max(Math.hypot(gesture.rx - gesture.px, gesture.ry - gesture.py), 1e-9);
	const d = d0 * Math.pow(gesture.ref / d0, k);
	const b0 = Math.atan2(gesture.px - gesture.rx, gesture.py - gesture.ry);
	const db = ((Math.atan2(gesture.qx - gesture.rx, gesture.qy - gesture.ry) - b0 + Math.PI) % LOG_TAU + LOG_TAU) % LOG_TAU - Math.PI;
	const px = gesture.rx + d * Math.sin(b0 + db * k);
	const py = gesture.ry + d * Math.cos(b0 + db * k);
	camera.px = px; camera.py = py;
	// zoom density (1/s) lerps, so the visible log ring widens onto the system mid-drag
	const sEnd = cameraFitScale(gesture.qx, gesture.qy, gesture.ref);
	camera.scale = 1 / ((1 - k) / gesture.scale + k / sEnd);
	camera.ox = ev.clientX - camera.scale * Math.atan2(gesture.rx - px, gesture.ry - py);
	camera.oy = ev.clientY + camera.scale * Math.log(d);
	inputStatus();
}

function inputPick(x, y) {
	let best = -1, bestDistance = Infinity;
	const period = LOG_TAU * camera.scale;
	for (let i = 0; i < system.nb; i++) {
		const d = Math.hypot(system.wx[i] - camera.px, system.wy[i] - camera.py);
		if (d <= system.radius[i]) continue;
		cameraProject(system.wx[i], system.wy[i]);
		let dx = camera.x - x;
		dx -= period * Math.round(dx / period);
		const distance = Math.hypot(dx, camera.y - y);
		const r = camera.scale * Math.asin(Math.min(1, system.radius[i] / d));
		if (distance <= Math.max(10, r + 3) && distance < bestDistance) { best = i; bestDistance = distance; }
	}
	return best;
}

function inputUp(ev) {
	if (!gesture.active || ev.pointerId !== gesture.id) return;
	if (!gesture.dragging) {
		const i = inputPick(ev.clientX, ev.clientY);
		if (i >= 0) inputFollow(i);
	}
	gesture.active = false;
}

function inputCancel(ev) {
	if (gesture.active && ev.pointerId === gesture.id) gesture.active = false;
}

function inputKeyDown(ev) {
	if (/^(INPUT|SELECT)$/.test(ev.target.tagName)) return;
	const key = ev.key.toLowerCase();
	if (!['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) return;
	flightKeys.add(key); ev.preventDefault();
}

function inputKeyUp(ev) { flightKeys.delete(ev.key.toLowerCase()); }

function inputFlight(dt) {
	let x = Number(flightKeys.has('d') || flightKeys.has('arrowright')) - Number(flightKeys.has('a') || flightKeys.has('arrowleft'));
	let y = Number(flightKeys.has('w') || flightKeys.has('arrowup')) - Number(flightKeys.has('s') || flightKeys.has('arrowdown'));
	const length = Math.hypot(x, y);
	if (!length) return;
	const i = system.nb - 1, speed = 0.45 * dt / 1000 / length;
	system.wx[i] += x * speed; system.wy[i] += y * speed;
}

if (typeof module !== 'undefined') module.exports = { inputInit, inputDown, inputMove, inputUp, inputCancel, inputPick, inputFlight };
