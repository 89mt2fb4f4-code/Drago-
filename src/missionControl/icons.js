// Mission Control — clean line icons instead of upstream's colourful emoji.
// Thin single-colour outline glyphs (24×24, stroke = currentColor), drawn in a
// small ring like the water-plant reference. Upstream re-renders layer rows,
// so a MutationObserver keeps swapping any emoji that comes back.

const P = {
  satellite: 'M5 9l4-4 4 4-4 4z M15 15l4-4 4 4-4 4z M11 11l2 2 M13 7l4 4 M7 13l4 4 M3 21l3-3',
  plane: 'M21 12l-8-2-3-7H8l1 7-5 1-2-2H1l1 4-1 4h1l2-2 5 1-1 7h2l3-7 8-2z',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4',
  antenna: 'M12 13v8 M8 21h8 M9 10a4 4 0 0 1 6 0 M6 7a8 8 0 0 1 12 0 M12 13a1 1 0 1 0 0-.01',
  car: 'M4 16v-4l2-5h12l2 5v4z M4 16v2h3v-2 M17 16v2h3v-2 M8 13h.01 M16 13h.01',
  bus: 'M6 3h12a1 1 0 0 1 1 1v12H5V4a1 1 0 0 1 1-1z M5 10h14 M8 19v-3 M16 19v-3 M8 13h.01 M16 13h.01',
  bike: 'M6 18a3 3 0 1 0 0-.01 M18 18a3 3 0 1 0 0-.01 M6 18l4-7h5l3 7 M10 11l-1-3H7 M15 11l1-3h2',
  cctv: 'M3 9l12-4 2 6-12 4z M6 14l1 4h4 M17 8l3 1-1 3',
  camera: 'M3 8h4l2-3h6l2 3h4v11H3z M12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  rocket: 'M12 2c3 2 4.5 6 4.5 10L12 16.5 7.5 12C7.5 8 9 4 12 2z M9 17l-2 4 M15 17l2 4 M12 9h.01',
  quake: 'M2 12h4l2-5 3 10 3-8 2 3h6',
  fire: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 1 1 2 2 3 2 0-2-1-4 0-6z',
  wind: 'M3 9h11a3 3 0 1 0-3-3 M3 15h15a3 3 0 1 1-3 3',
  cloud: 'M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5',
  compass: 'M12 3a9 9 0 1 0 .01 0 M15.5 8.5l-2 5-5 2 2-5z',
  server: 'M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01',
  dam: 'M3 20h18 M5 20V8l4-2v14 M13 20v-8l6 3v5',
  cable: 'M3 12c3-4 6 4 9 0s6 4 9 0 M3 17c3-4 6 4 9 0s6 4 9 0',
  ship: 'M3 16l2 4h14l2-4z M5 16v-5h14v5 M12 11V4 M9 7h6',
  sparkle: 'M12 3v5 M12 16v5 M3 12h5 M16 12h5 M7 7l2 2 M15 15l2 2 M17 7l-2 2 M7 17l2-2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4',
  square: 'M5 5h14v14H5z',
  target: 'M12 3a9 9 0 1 0 .01 0 M12 8a4 4 0 1 0 .01 0',
  alert: 'M12 3l10 18H2z M12 10v5 M12 18h.01',
  ring: 'M12 7a5 5 0 1 0 .01 0',
};

// Upstream layer id → icon (unknown ids fall back to a plain ring).
const BY_LAYER = {
  satellites: 'satellite', flights: 'plane', military: 'shield', 'military-awareness': 'shield',
  'military-installations': 'shield', 'local-adsb': 'antenna', traffic: 'car', transit: 'bus',
  bikeshare: 'bike', cctv: 'cctv', 'recent-imagery': 'satellite', 'street-level': 'camera',
  'alpr-cameras': 'camera', 'rocket-launches': 'rocket', earthquakes: 'quake',
  'fire-perimeters': 'fire', 'local-firms': 'fire', 'gnss-integrity': 'antenna',
  's2-ghostmaps': 'layers', wind: 'wind', 'air-quality': 'wind', 'weather-satellite': 'cloud',
  'weather-radar': 'cloud', 'weather-lightning': 'cloud', 'weather-cyclones': 'cloud',
  directions: 'compass', 'local-datacenters': 'server', 'local-dams': 'dam',
  'telegeography-submarine-cables': 'cable', radio: 'antenna', 'ais-live-vessels': 'ship',
};
// Emoji / symbol → icon for the loose icons in the Display panel.
const BY_GLYPH = { '✈': 'plane', '✨': 'sparkle', '🔍': 'search', '□': 'square', '◎': 'target', '⚠': 'alert', '🛸': 'ring' };

const EMOJI = /\p{Extended_Pictographic}|[□◎⚠]/u;
const svg = (name) =>
  `<svg class="mc-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[name] || P.ring}"/></svg>`;

function swap(el) {
  if (el.querySelector(':scope > .mc-ico') || !EMOJI.test(el.textContent)) return;
  const row = el.closest('[data-layer-id]');
  const glyph = [...el.textContent.trim()][0] || '';
  const name = (row && BY_LAYER[row.dataset.layerId]) || BY_GLYPH[glyph] || 'ring';
  el.innerHTML = svg(name);
  el.classList.add('mc-ico-host');
}

export function attachIcons() {
  const run = () =>
    document.querySelectorAll('.data-icon, .pp-icon').forEach(swap);
  run();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; run(); });
  }).observe(document.body, { childList: true, subtree: true });
}
