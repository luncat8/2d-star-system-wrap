// owns: pointer hit test and selection
// edit for: hit radius, input mapping

function initInput() {
	canvas.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(e) {
	if (trans.active) return;
	const x = e.clientX;
	const y = e.clientY;
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
	if (best >= 0) startTransition(best);
}