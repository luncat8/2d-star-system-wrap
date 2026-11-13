// owns: visual transition settings and replay controls
// edit for: adjustable surface and sky presentation

const settings = { split: 0.35, skyWait: false, soilStart: 'unfold', strokeOver: false };

function settingsInit() {
	const split = $('stageSplit'), value = $('stageValue');
	split.addEventListener('input', () => {
		settings.split = Number(split.value) / 100;
		value.textContent = split.value + '%';
	});
	$('skyWait').addEventListener('change', ev => { settings.skyWait = ev.target.checked; });
	$('soilStart').addEventListener('change', ev => { settings.soilStart = ev.target.value; });
	$('strokeOver').addEventListener('change', ev => { settings.strokeOver = ev.target.checked; });
	const bodies = $('previewBody');
	for (let i = 0; i < system.nb; i++) {
		const option = document.createElement('option');
		option.value = i;
		option.textContent = system.name[i];
		bodies.appendChild(option);
	}
	bodies.value = '3';
	$('previewTransition').addEventListener('click', () => {
		projInit(ORBIT_SAMP);
		projStep(projection.now);
		projGoTo(Number(bodies.value));
	});
}

if (typeof module !== 'undefined') module.exports = { settings, settingsInit };
