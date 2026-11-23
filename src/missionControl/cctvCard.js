// Mission Control — CCTV as a flat, front-facing card (CLAUDE.md: "Camera
// pop-ups: flat, front-facing cards, never skewed at the camera's 3D angle").
//
// Upstream shows the active camera by projecting its frame onto the ground at
// the camera's 3D angle. We switch that projection off. The CCTV panel's
// small screen is the normal view (PREV / NEXT / picking a camera show there).
// FULL SCREEN opens a big centred card over a darkened map — from the button on
// the panel's small screen, or by clicking a camera marker on the map. It
// mirrors the panel's own frame:
//   • still cameras → the panel's <img> (same src, refreshed by upstream)
//   • live cameras  → the panel's <canvas>, copied every animation frame
// The card names the camera, says LIVE or STILL, and keeps the source credit.
// Nothing is invented: if the panel has no frame yet, the card says so.

import * as Cesium from 'cesium';

const $ = (id) => document.getElementById(id);

export function attachCctvCard(viewer) {
  const panelImg = $('cctv-frame');
  const panelVideo = $('cctv-video');
  const enableBtn = $('cctv-enable-btn');
  const select = $('cctv-camera-select');
  const badge = $('cctv-source-badge');
  const projectionBtn = $('cctv-projection-btn');
  if (!panelImg || !panelVideo || !enableBtn || $('mc-cctv-card')) return;

  const card = document.createElement('section');
  card.id = 'mc-cctv-card';
  card.setAttribute('aria-label', 'CCTV camera');
  card.hidden = true;
  card.innerHTML = `
    <header>
      <span class="mc-cctv-kind">STILL</span>
      <strong class="mc-cctv-name">—</strong>
      <button type="button" class="mc-cctv-close" title="Hide this card" aria-label="Hide camera card">×</button>
    </header>
    <div class="mc-cctv-media">
      <img alt="" />
      <canvas></canvas>
      <span class="mc-cctv-wait">Acquiring frame…</span>
    </div>
    <footer class="mc-cctv-credit">—</footer>`;
  // Dim the map behind the card so the feed reads bright; clicking the dimmed
  // area closes the card (same as ×).
  const backdrop = document.createElement('div');
  backdrop.id = 'mc-cctv-backdrop';
  backdrop.hidden = true;
  document.body.append(backdrop, card);

  const img = card.querySelector('img');
  const canvas = card.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const wait = card.querySelector('.mc-cctv-wait');
  let open = false; // full screen only when asked for
  let raf = 0;

  const enabled = () => enableBtn.classList.contains('active');
  const cameraId = () => select?.value || '';
  const isLive = () => !panelVideo.hidden;

  // Upstream's ground projection is the "skewed" view — keep it off.
  const projectionOff = () => {
    if (projectionBtn && /\bON\b/.test(projectionBtn.textContent)) projectionBtn.click();
    // The green wireframe view-cone ("COVERAGE") also clutters the map. Its
    // button cycles COVERAGE ON → VIEWSHED ON → OFF; step it to OFF once per
    // load (one click per second at most), then leave it to the user.
    const coverageBtn = $('cctv-coverage-btn');
    if (!coverageDone && coverageBtn) {
      if (/\bOFF\b/.test(coverageBtn.textContent)) coverageDone = true;
      else if (Date.now() - lastCoverageClick > 1000) {
        lastCoverageClick = Date.now();
        coverageBtn.click();
      }
    }
  };
  let coverageDone = false;
  let lastCoverageClick = 0;

  function copyVideo() {
    raf = 0;
    if (card.hidden || !isLive()) return;
    const w = panelVideo.width, h = panelVideo.height;
    if (w && h) {
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      try { ctx.drawImage(panelVideo, 0, 0); } catch { /* frame not ready */ }
    }
    raf = requestAnimationFrame(copyVideo);
  }

  function sync() {
    if (enabled()) projectionOff();
    const show = open && enabled() && Boolean(cameraId());
    card.hidden = !show;
    backdrop.hidden = !show;
    if (!show) { cancelAnimationFrame(raf); raf = 0; return; }
    const live = isLive();
    card.dataset.kind = live ? 'live' : 'still';
    card.querySelector('.mc-cctv-kind').textContent = live ? 'LIVE' : 'STILL';
    card.querySelector('.mc-cctv-name').textContent = select.selectedOptions[0]?.textContent || '—';
    card.querySelector('.mc-cctv-credit').textContent = badge?.textContent.trim() || '';
    const src = panelImg.currentSrc || panelImg.src || '';
    if (!live && src && img.src !== src) img.src = src;
    const hasFrame = live ? panelVideo.width > 0 : Boolean(src);
    wait.hidden = hasFrame;
    if (live && !raf) raf = requestAnimationFrame(copyVideo);
  }

  const dismiss = () => { open = false; sync(); };
  const openFull = () => { open = true; sync(); };

  // FULL SCREEN button on the panel's small screen
  const wrap = $('cctv-frame-wrap');
  if (wrap && !wrap.querySelector('.mc-cctv-full')) {
    const full = document.createElement('button');
    full.type = 'button';
    full.className = 'mc-cctv-full';
    full.title = 'Full screen';
    full.setAttribute('aria-label', 'Show this camera full screen');
    full.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5"/></svg>';
    full.addEventListener('click', openFull);
    wrap.append(full);
  }

  // Clicking a camera marker on the map opens it full screen (upstream selects
  // it on the same click; we open once that has happened).
  const canvasEl = viewer?.scene?.canvas;
  canvasEl?.addEventListener('click', (e) => {
    if (!enabled()) return;
    const r = canvasEl.getBoundingClientRect();
    const picked = viewer.scene.pick(new Cesium.Cartesian2(e.clientX - r.left, e.clientY - r.top));
    const id = typeof picked?.id === 'string' ? picked.id : null;
    if (!id || ![...(select?.options || [])].some((o) => o.value === id)) return;
    setTimeout(openFull, 250);
  });
  card.querySelector('.mc-cctv-close').addEventListener('click', dismiss);
  backdrop.addEventListener('click', dismiss);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !card.hidden) dismiss(); });

  // Follow upstream: camera changes, frame refreshes, CCTV on/off, live/still.
  const watch = (el, opts) => el && new MutationObserver(sync).observe(el, opts);
  watch(panelImg, { attributes: true, attributeFilter: ['src'] });
  watch(panelVideo, { attributes: true, attributeFilter: ['hidden', 'width', 'height'] });
  watch(enableBtn, { attributes: true, attributeFilter: ['class'], childList: true, characterData: true, subtree: true });
  watch(badge, { childList: true, characterData: true, subtree: true });
  select?.addEventListener('change', sync);
  setInterval(sync, 1500); // upstream also changes the camera without events (auto hop)
  // (while full screen, the card follows the active camera)
  sync();
}
