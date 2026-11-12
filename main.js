// owns: boot/wiring: $, shared view object, resize, frame loop
// edit for: load order, boot, wiring

const $ = id => document.getElementById(id);
const view = { canvas: null, ctx: null, w: 0, h: 0 };

let prevTs = 0;

function frame(ts) {
	sysStep(prevTs ? ts - prevTs : 16);
	prevTs = ts;
	renderFrame(ts);
	inputSync();
	requestAnimationFrame(frame);
}

function boot() {
	view.canvas = $('c');
	view.ctx = view.canvas.getContext('2d');
	sysInit();
	renderInit();
	inputInit();
	window.addEventListener('resize', renderResize);
	requestAnimationFrame(frame);
}

boot();

if (typeof module !== 'undefined') module.exports = { $, view, frame, boot };
