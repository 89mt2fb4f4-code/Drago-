// Mission Control — Visual Presets, opened from the map-button column
// (bottom right). Upstream keeps them in a hover tray in the bottom dock,
// which we hide. Here the layers button opens our own panel next to the
// column, and we move upstream's two sections into it:
//   • the looks (#style-buttons: Normal, NVG, FLIR, Anime, Noir, Snow)
//   • MAP SOURCE (.map-source-section: Dark, Google 3D, Bing, Esri, OSM)
// They are moved, not copied, so upstream's own click handlers, keyboard
// shortcuts (1-7) and map logic keep working unchanged.

const LOOK_ICONS = {
  normal: '<circle cx="12" cy="12" r="7"/>',
  retro: '<rect x="4" y="6" width="16" height="12" rx="2"/>',
  surveillance: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>',
  thermal: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/>',
  anime: '<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>',
  noir: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16a8 8 0 0 0 0-16z"/>',
  snow: '<path d="M12 3v18 M4.2 7.5l15.6 9 M4.2 16.5l15.6-9"/>',
};

export function attachMapToggle() {
  const column = document.getElementById('top-center-actions');
  const looks = document.getElementById('style-buttons');
  const source = document.querySelector('.map-source-section');
  if (!column || document.getElementById('mc-map-toggle')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'mc-map-toggle';
  btn.title = 'Visual presets';
  btn.setAttribute('aria-label', 'Visual presets');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'mc-presets');
  // 'layers' is in upstream's icon-font subset.
  btn.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">layers</span>';
  column.prepend(btn);

  const panel = document.createElement('section');
  panel.id = 'mc-presets';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Visual presets');
  panel.innerHTML = `
    <header class="mc-presets-head">
      <span>VISUAL PRESETS</span>
      <button type="button" class="mc-presets-close" aria-label="Close visual presets">×</button>
    </header>
    <div class="mc-presets-label">LOOK</div>`;
  if (looks) {
    looks.querySelectorAll('.style-btn').forEach((b) => {
      const svg = LOOK_ICONS[b.dataset.style];
      const icon = b.querySelector('.btn-icon');
      if (svg && icon) icon.innerHTML = `<svg class="mc-ico" viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
    });
    panel.append(looks);
  }
  if (source) panel.append(source);
  document.body.append(panel);

  // Sit just left of the button column, bottoms lined up.
  const place = () => {
    const r = column.getBoundingClientRect();
    panel.style.right = `${Math.round(innerWidth - r.left + 12)}px`;
    panel.style.bottom = `${Math.round(innerHeight - r.bottom)}px`;
  };
  const setOpen = (open) => {
    if (open) place();
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-pressed', String(open));
  };

  btn.addEventListener('click', () => setOpen(panel.hidden));
  panel.querySelector('.mc-presets-close').addEventListener('click', () => setOpen(false));
  // Close on a click elsewhere (but not on the map itself while dragging it).
  document.addEventListener('pointerdown', (e) => {
    if (panel.hidden || panel.contains(e.target) || btn.contains(e.target)) return;
    if (e.target.closest?.('.cesium-widget')) return;
    setOpen(false);
  }, true);
  // Capture phase: upstream handles Escape too and stops it.
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) { setOpen(false); btn.focus(); }
  }, true);
  addEventListener('resize', () => { if (!panel.hidden) place(); });
}
