// owns: canvas click + wrap checkbox
// edit for: interaction bindings

function inputInit() {
	view.canvas.addEventListener('pointerdown', inputClick);
	$('wrapBox').addEventListener('change', inputMode);
}

function inputClick(ev) {
	const i = projPick(ev.clientX, ev.clientY);
	if (i < 0) return;
	projGoTo(i);
}

function inputMode() {
	projSetMode($('wrapBox').checked);
}

// checkbox mirrors the effective target mode, including mid-transition retargets
function inputSync() {
	const p = projection;
	let w;
	if (p.queue !== -2) w = p.queue >= 0;
	else w = (p.trans ? p.trans.dst : p.steady).kind === 1;
	const box = $('wrapBox');
	if (box.checked !== w) box.checked = w;
}

if (typeof module !== 'undefined') module.exports = { inputInit, inputClick, inputMode, inputSync };
