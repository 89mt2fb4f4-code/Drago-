// Mission Control — one-click Dark ⇄ Satellite map switch.
// Upstream keeps map sources three clicks deep (TOOLS → Visual Presets → Map
// Source). This adds a button to the map-button column that presses
// upstream's own map-source chip, so all map logic stays upstream's.
const DARK = 'dark';
const SATELLITE = 'esri-imagery';

const chip = (id) => document.querySelector(`.map-stack-chip[data-stack-id="${id}"]`);
const activeStack = () => document.querySelector('.map-stack-chip.active')?.dataset.stackId;

export function attachMapToggle() {
  const column = document.getElementById('top-center-actions');
  if (!column || document.getElementById('mc-map-toggle')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'mc-map-toggle';
  // 'layers' is in upstream's icon-font subset (satellite/map icons are not);
  // the icon turns cyan while satellite is on.
  btn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">layers</span>';
  column.prepend(btn);

  const paint = () => {
    const sat = activeStack() === SATELLITE;
    btn.setAttribute('aria-pressed', String(sat));
    const label = sat ? 'Switch to the dark map' : 'Switch to satellite';
    btn.title = label;
    btn.setAttribute('aria-label', label);
  };

  btn.addEventListener('click', () => {
    chip(activeStack() === SATELLITE ? DARK : SATELLITE)?.click();
    setTimeout(paint, 50);
  });
  window.addEventListener('gev:map-stack-changed', paint);
  paint();
}
