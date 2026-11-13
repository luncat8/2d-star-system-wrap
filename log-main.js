// owns: boot and frame wiring
// edit for: startup and frame timing

const $ = id => document.getElementById(id);
const view = { canvas: null, ctx: null, w: 0, h: 0, now: 0 };
let previousTime = 0;

function frame(now) {
	const dt = previousTime ? Math.min(now - previousTime, 50) : 16;
	previousTime = now; view.now = now;
	sysStep(dt); inputFlight(dt); cameraStep(now); renderFrame();
	requestAnimationFrame(frame);
}

function boot() {
	view.canvas = $('c'); view.ctx = view.canvas.getContext('2d');
	sysInit(); sysStep(0); renderInit(); inputInit();
	window.addEventListener('resize', renderResize);
	requestAnimationFrame(frame);
}

boot();
