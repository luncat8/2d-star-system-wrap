// owns: pointer gestures, body selection and free-flight controls
// edit for: interaction and keyboard bindings

const gesture = { active: false, dragging: false, id: 0, x: 0, y: 0, wx: 0, wy: 0, px: 0, py: 0, scale: 0, distance: 0 };
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
	gesture.wx = camera.x; gesture.wy = camera.y;
	gesture.px = camera.px; gesture.py = camera.py; gesture.scale = camera.scale;
	gesture.distance = Math.hypot(camera.x - camera.px, camera.y - camera.py);
	view.canvas.setPointerCapture(ev.pointerId);
}

function inputMove(ev) {
	if (!gesture.active || ev.pointerId !== gesture.id) return;
	const dx = ev.clientX - gesture.x, dy = ev.clientY - gesture.y;
	if (!gesture.dragging && Math.hypot(dx, dy) < 4) return;
	gesture.dragging = true;
	camera.target = -1; camera.transition = null;
	const k = Math.max(0, Math.min(1, dy / Math.max(80, view.h * 0.86 - gesture.y)));
	const endDistance = Math.max(gesture.distance / gesture.scale * 0.3, 1e-5);
	const poleProgress = 1 - (1 - k) ** 3;
	camera.px = gesture.px + (gesture.wx - gesture.px) * poleProgress;
	camera.py = gesture.py + (gesture.wy - endDistance - gesture.py) * poleProgress;
	camera.scale = gesture.scale + (view.w / LOG_TAU - gesture.scale) * k;
	const ax = gesture.wx - camera.px, ay = gesture.wy - camera.py;
	camera.ox = ev.clientX - camera.scale * Math.atan2(ax, ay);
	camera.oy = ev.clientY + camera.scale * Math.log(Math.max(Math.hypot(ax, ay), 1e-12));
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
