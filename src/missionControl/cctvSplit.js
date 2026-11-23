// Mission Control — CCTV split into two categories: STILL IMAGES (snapshots
// refreshed every few seconds) and LIVE VIDEO (moving streams).
//
// Our file only. Upstream keeps one camera list; we add two tabs to its CCTV
// panel and drive everything through upstream's own camera dropdown:
//   • the dropdown hides cameras of the other kind,
//   • PREV / NEXT / NEAREST pick within the chosen kind, then "choose" that
//     camera in the dropdown, so upstream selects it and flies there as usual.
//   • AUTO HOP stays within the chosen kind (small upstream edit, see below).
// Map markers still show every camera.
import * as Cesium from 'cesium';

const VIDEO_TYPES = new Set(['hls', 'mp4', 'webm', 'mjpeg', 'video', 'live', 'stream']);
const KEY = 'mc.cctvKind';
const kindOf = (feedType) =>
  VIDEO_TYPES.has(String(feedType || '').toLowerCase()) ? 'video' : 'image';

export function attachCctvSplit(viewer) {
  const panel = document.getElementById('cctv-panel');
  const select = document.getElementById('cctv-camera-select');
  const prev = document.getElementById('cctv-prev-btn');
  const next = document.getElementById('cctv-next-btn');
  const nearest = document.getElementById('cctv-nearest-btn');
  const header = panel?.querySelector('.panel-header');
  if (!panel || !select || !header || panel.querySelector('.mc-cctv-kinds')) return;

  /** camera id → { kind, lat, lon } (from the same list upstream loads) */
  const cams = new Map();
  let kind = 'image';
  try { kind = localStorage.getItem(KEY) === 'video' ? 'video' : 'image'; } catch {}
  // AUTO HOP and upstream's nearest-camera search read this (see the
  // "Mission Control" lines in src/layers/cctv/navigation.js).
  document.documentElement.dataset.mcCctvKind = kind;

  const tabs = document.createElement('div');
  tabs.className = 'mc-cctv-kinds';
  tabs.setAttribute('role', 'tablist');
  tabs.innerHTML = `
    <button type="button" role="tab" data-kind="image">STILL IMAGES <b>—</b></button>
    <button type="button" role="tab" data-kind="video">LIVE VIDEO <b>—</b></button>`;
  header.after(tabs);

  const visibleIds = () =>
    [...select.options].filter((o) => !o.hidden).map((o) => o.value);
  const matches = (id) => (cams.get(id)?.kind ?? 'image') === kind;

  function filterOptions() {
    for (const o of select.options) o.hidden = cams.size > 0 && !matches(o.value);
  }

  function paintTabs() {
    const count = { image: 0, video: 0 };
    for (const c of cams.values()) count[c.kind]++;
    for (const b of tabs.querySelectorAll('button')) {
      const on = b.dataset.kind === kind;
      b.setAttribute('aria-selected', String(on));
      b.querySelector('b').textContent = cams.size ? count[b.dataset.kind].toLocaleString() : '—';
    }
  }

  /** Choose a camera through upstream's own dropdown (selects + flies). */
  function choose(id) {
    if (!id) return;
    select.value = id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function nearestOfKind() {
    const carto = viewer.camera.positionCartographic;
    if (!carto) return null;
    const lat0 = Cesium.Math.toDegrees(carto.latitude);
    const lon0 = Cesium.Math.toDegrees(carto.longitude);
    let best = null;
    let bestD = Infinity;
    for (const id of visibleIds()) {
      const c = cams.get(id);
      if (!c) continue;
      const dLat = c.lat - lat0;
      const dLon = (c.lon - lon0) * Math.cos((lat0 * Math.PI) / 180);
      const d = dLat * dLat + dLon * dLon;
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  function step(dir) {
    const ids = visibleIds();
    if (!ids.length) return;
    const i = ids.indexOf(select.value);
    choose(ids[(i + dir + ids.length) % ids.length]);
  }

  function setKind(k) {
    kind = k;
    document.documentElement.dataset.mcCctvKind = k; // read by upstream auto-hop
    try { localStorage.setItem(KEY, k); } catch {}
    filterOptions();
    paintTabs();
    // Showing a camera of the other kind? Jump to the nearest of this kind.
    if (select.value && !matches(select.value) && !select.disabled) choose(nearestOfKind());
  }

  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-kind]');
    if (b) setKind(b.dataset.kind);
  });

  // Take over PREV / NEXT / NEAREST (capture phase, before upstream's handler)
  // only once the categories are known and the camera list is live.
  const takeOver = (btn, fn) =>
    btn?.addEventListener('click', (e) => {
      if (!cams.size || select.disabled) return; // let upstream handle it (e.g. turning CCTV on)
      e.stopImmediatePropagation();
      fn();
    }, true);
  takeOver(prev, () => step(-1));
  takeOver(next, () => step(1));
  takeOver(nearest, () => choose(nearestOfKind()));

  // Upstream rebuilds the dropdown when the list changes: re-apply the filter.
  new MutationObserver(filterOptions).observe(select, { childList: true });

  fetch('/api/cctv/sources')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const rows = Array.isArray(d) ? d : d?.sources;
      if (!Array.isArray(rows)) return;
      for (const r of rows) {
        if (r?.id == null) continue;
        cams.set(String(r.id), { kind: kindOf(r.feedType || r.type), lat: +r.lat, lon: +r.lon });
      }
      filterOptions();
      paintTabs();
    })
    .catch(() => {}); // no categories → panel works exactly as upstream
  paintTabs();
}
