// Mission Control — CCTV as a flat, front-facing card (CLAUDE.md: "Camera
// pop-ups: flat, front-facing cards, never skewed at the camera's 3D angle").
//
// Upstream shows the active camera by projecting its frame onto the ground at
// the camera's 3D angle. We switch that projection off and instead mirror the
// CCTV panel's own frame into a card floating near the top centre:
//   • still cameras → the panel's <img> (same src, refreshed by upstream)
//   • live cameras  → the panel's <canvas>, copied every animation frame
// The card names the camera, says LIVE or STILL, and keeps the source credit.
// Nothing is invented: if the panel has no frame yet, the card says so.

const $ = (id) => document.getElementById(id);

export function attachCctvCard() {
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
  let dismissedFor = null;
  let raf = 0;

  const enabled = () => enableBtn.classList.contains('active');
  const cameraId = () => select?.value || '';
  const isLive = () => !panelVideo.hidden;

  // Upstream's ground projection is the "skewed" view — keep it off.
  const projectionOff = () => {
    if (projectionBtn && /\bON\b/.test(projectionBtn.textContent)) projectionBtn.click();
  };

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
    const show = enabled() && cameraId() && dismissedFor !== cameraId();
    card.hidden = !show;
    backdrop.hidden = !show;
    if (!show) { cancelAnimationFrame(raf); raf = 0; return; }
    projectionOff();
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

  const dismiss = () => {
    dismissedFor = cameraId(); // comes back when another camera is chosen
    sync();
  };
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
  sync();
}
