// owns: frame cost of the log view per view state
// edit for: the counters and the states that get measured

const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');

// The page scripts become one function body in this realm. A vm context routes every global
// through the sandbox interceptor and inflated the same frame from 0.8 to 14 ms (findings).
function loadPage() {
	const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
	const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
	const source = scripts.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
	const ops = { pathCmds: 0, fills: 0, strokes: 0, fillPx: 0 };
	let points = [], countFills = false;
	const ctx = {
		setTransform() {}, fillRect() {}, strokeText() {}, fillText() {}, closePath() {},
		beginPath() { points = []; },
		moveTo(x, y) { ops.pathCmds++; if (countFills) points.push([x, y]); },
		lineTo(x, y) { ops.pathCmds++; if (countFills) points.push([x, y]); },
		fill() {
			ops.fills++;
			if (!countFills) return;
			let area = 0;
			for (let i = 0, j = points.length - 1; i < points.length; j = i++)
				area += points[j][0] * points[i][1] - points[i][0] * points[j][1];
			ops.fillPx += Math.abs(area) / 2;
		},
		stroke() { ops.strokes++; },
	};
	const element = () => ({ style: {}, value: '', textContent: '', children: [], listeners: {},
		addEventListener(type, fn) { this.listeners[type] = fn; }, appendChild(x) { this.children.push(x); },
		getContext: () => ctx, setPointerCapture() {} });
	const elements = new Map();
	const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); }, createElement: element };
	const window = { innerWidth: 1200, innerHeight: 800, devicePixelRatio: 2, addEventListener() {} };
	const page = new Function('document', 'window', 'requestAnimationFrame', '"use strict";\n' + source +
		'\n;return { system, view, camera, fit, renderFrame, cameraReset, cameraFollow, cameraStep, sysStep };')(document, window, () => {});
	return { page, ops, count(fills) { countFills = fills; } };
}

const { page, ops, count } = loadPage();
const reset = () => { for (const key in ops) ops[key] = 0; };
function bench(view) {
	for (let i = 0; i < 40; i++) page.renderFrame();
	reset(); count(true); page.renderFrame(); count(false);
	const frame = Object.assign({}, ops);
	const frames = 400, start = process.hrtime.bigint();
	for (let i = 0; i < frames; i++) page.renderFrame();
	const ms = Number(process.hrtime.bigint() - start) / 1e6 / frames;
	console.log('view=' + view + ' ms_frame=' + ms.toFixed(3) + ' path_cmds=' + frame.pathCmds +
		' fills=' + frame.fills + ' strokes=' + frame.strokes + ' fill_px=' + Math.round(frame.fillPx) +
		' screen_px=' + (page.view.w * page.view.h));
}
function follow(i) {
	page.cameraReset(); page.cameraFollow(i, 0); page.cameraStep(1800);
	for (let k = 0; k < 40; k++) { page.sysStep(16); page.cameraStep(1800 + k * 16); }
}

bench('overview');
for (const i of [3, 0, 5, 7]) { follow(i); bench('follow_' + page.system.name[i]); }
page.cameraReset();
bench('overview_reset');
