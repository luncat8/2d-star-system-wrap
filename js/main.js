// owns: boot/wiring only. edit for: load order, boot, wiring
const $ = id => document.getElementById(id);
const canvas = $('c');
const ctx = canvas.getContext('2d');
const view = { W: 0, H: 0, dpr: 1, selected: -1 };

function resize() {
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	view.dpr = dpr;
	view.W = window.innerWidth;
	view.H = window.innerHeight;
	canvas.width = Math.round(view.W * dpr);
	canvas.height = Math.round(view.H * dpr);
	canvas.style.width = view.W + 'px';
	canvas.style.height = view.H + 'px';
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	initProjection();
}

let last = 0;

function frame(now) {
	const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
	last = now;
	updateWorld(dt);
	updateTransition(dt);
	updateProjection(dt);
	drawScene();
	requestAnimationFrame(frame);
}

function boot() {
	initWorld();
	initRender();
	initInput();
	resize();
	requestAnimationFrame(frame);
}

window.addEventListener('resize', resize);
boot();