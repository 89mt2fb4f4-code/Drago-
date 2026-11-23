// Mission Control — shell (Drago spec §8.7).
// Builds the Mission Control frame around the God's Eye map, based on the
// Mission Control mockup: top bar (brand · GLOBE/CITY/MAP · place/time/LIVE),
// left rail (Mission Brief + data layers), right rail (Drago, Focus,
// Signals), bottom command bar. Upstream God's Eye UI stays in the DOM (their
// code drives it); theme.css restyles or hides it.
//
// HONESTY RULE: nothing here shows invented numbers. Anything Drago will feed
// later shows "—" or "awaiting Drago" until real data exists.
import * as Cesium from 'cesium';
import { HOME_CITY, flyToHomeCity } from './home.js';
import { attachCctvSplit } from './cctvSplit.js';
import { attachMapToggle } from './mapToggle.js';
import { attachCctvCard } from './cctvCard.js';
import { attachIcons } from './icons.js';
import { attachHudFrame } from './hudFrame.js';
import { attachCategoryToggles } from './categoryToggle.js';

const TZ = 'America/New_York';
const root = document.documentElement;
root.classList.add('mc');

// Mission Control is already dark. Tell the Dark Reader extension to leave
// it alone: it otherwise repaints the Arwes frames with the text colour,
// giving pale/white panels with unreadable text.
if (!document.querySelector('meta[name="darkreader-lock"]')) {
  const lock = document.createElement('meta');
  lock.name = 'darkreader-lock';
  document.head.append(lock);
}

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const fmt = (opts, d = new Date()) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts }).format(d);

function stamp() {
  const day = fmt({ month: 'long', day: 'numeric' }).toUpperCase();
  const dayShort = fmt({ month: 'short', day: 'numeric' }).toUpperCase();
  const time = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
  const tz = fmt({ timeZoneName: 'short' }).split(' ').pop();
  return { day, dayShort, time, tz };
}

// ── persistent toggles (View = upstream display panels, Tools = dock) ──
// → <html data-mc-open-view / data-mc-open-tools>. Must NOT be data-mc-view:
// that name belongs to the GLOBE/CITY/MAP buttons (a clash once made every
// click on the page fly back to the home city).
const flag = (k) => `mcOpen${k[0].toUpperCase()}${k.slice(1)}`;
function setOpen(key, open) {
  root.dataset[flag(key)] = open ? 'open' : '';
  document
    .querySelectorAll(`[data-mc-toggle="${key}"]`)
    .forEach((b) => b.setAttribute('aria-pressed', String(open)));
  try { localStorage.setItem(`mc.${key}`, open ? '1' : '0'); } catch {}
}
const isOpen = (key) => root.dataset[flag(key)] === 'open';

const LOGO = `<svg class="mc-logo" width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
  <circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" stroke-width="1.2"/>
  <circle cx="15" cy="15" r="5.5" fill="none" stroke="var(--mc-purple)" stroke-width="1.5"/>
  <circle cx="15" cy="15" r="1.6" fill="var(--mc-purple)"/>
  <line x1="15" y1="0" x2="15" y2="6" stroke="currentColor" stroke-width="1.2"/>
  <line x1="15" y1="24" x2="15" y2="30" stroke="currentColor" stroke-width="1.2"/>
  <line x1="0" y1="15" x2="6" y2="15" stroke="currentColor" stroke-width="1.2"/>
  <line x1="24" y1="15" x2="30" y2="15" stroke="currentColor" stroke-width="1.2"/></svg>`;

function panel(id, code, title, meta, body) {
  return `<section class="mc-panel" id="${id}">
    <header class="mc-panel-head"><span class="mc-code">${code}</span><h2>${title}</h2><span class="mc-meta">${meta}</span></header>
    <div class="mc-panel-body">${body}</div></section>`;
}

function build() {
  document.title = 'Mission Control';
  const loader = document.querySelector('#loading-screen h2');
  if (loader) loader.textContent = 'MISSION CONTROL';

  // Top bar
  const top = h(`<header id="mc-topbar">
    <div class="mc-brand">${LOGO}<div><span class="mc-kicker">DRAGO · HORUS</span><span class="mc-sub">FIELD OPS</span></div></div>
    <div class="mc-plate">
      <svg class="mc-plate-edge" viewBox="0 0 640 84" aria-hidden="true">
        <path class="mc-plate-fill" d="M48 0 L592 0 L562 34 L504 34 L476 80 L164 80 L136 34 L78 34 Z" />
        <path class="mc-plate-line" d="M0 1 L48 1 L78 34 L136 34 L164 80 L476 80 L504 34 L562 34 L592 1 L640 1" />
        <path class="mc-plate-glow" d="M200 80 L440 80" />
        <path class="mc-plate-tick" d="M146 70 L154 70 M486 70 L494 70 M90 40 L124 40 M516 40 L550 40" />
      </svg>
      <div class="mc-wing mc-wing-l">
        <button type="button" class="mc-chip" data-mc-toggle="view" title="Display options (V)">VIEW</button>
      </div>
      <div class="mc-plate-core">
        <span class="mc-title">MISSION CONTROL</span>
        <nav class="mc-views" aria-label="Map view">
          <button type="button" data-mc-view="globe">GLOBE</button>
          <button type="button" data-mc-view="city">CITY</button>
          <button type="button" data-mc-view="map">MAP</button>
        </nav>
      </div>
      <div class="mc-wing mc-wing-r">
        <button type="button" class="mc-chip" data-mc-toggle="tools" title="Search · presets · voice (T)">TOOLS</button>
        <button type="button" class="mc-chip mc-end-scene" title="Stop the scene that is playing">END SCENE</button>
      </div>
    </div>
    <div class="mc-status">
      <button type="button" class="mc-chip mc-clean" aria-pressed="false" title="Hide every panel — map only (press again to bring them back)">CLEAN UI</button>
      <span class="mc-stamp"><span class="mc-place">${HOME_CITY.name.toUpperCase()}</span><i>·</i><span id="mc-day"></span><span id="mc-day-short"></span><i>·</i><span class="mc-clock"><b id="mc-time"></b> <span id="mc-tz"></span></span></span>
      <span class="mc-live"><i></i>LIVE</span>
    </div></header>`);

  // Left rail: Mission Brief (upstream data layers panel sits below it)
  const left = h(`<aside id="mc-left">${panel(
    'mc-brief', '01', 'MISSION BRIEF', 'PREP TIME',
    `<p class="mc-note">Drago's overnight prep, pinned to where it happens.</p>
     <ol class="mc-list">
       <li><span>01</span>Awaiting Drago — Prep Time not connected</li>
       <li><span>02</span>—</li>
       <li><span>03</span>—</li>
     </ol>`)}</aside>`);

  // Right rail: Drago · Focus · Signals
  const right = h(`<aside id="mc-right">
    <section class="mc-panel mc-drago">
      <div class="mc-orb" aria-hidden="true"><i></i><i></i><i></i></div>
      <div><span class="mc-kicker">DRAGO</span><strong>Offline · Mark 1 pending</strong>
      <span class="mc-quote">"Say a place and I'll pull it up."</span></div>
    </section>
    ${panel('mc-focus', '02', 'FOCUS', '<span id="mc-focus-coords">—</span>',
      `<div class="mc-focus-name" id="mc-focus-name">${HOME_CITY.name}</div>
       <div class="mc-tiles">
         <div><span>ALTITUDE</span><b id="mc-focus-alt">—</b></div>
         <div><span>HEADING</span><b id="mc-focus-hdg">—</b></div>
         <div><span>WEATHER</span><b>—</b></div>
         <div><span>LOCAL TIME</span><b id="mc-focus-time">—</b></div>
       </div>`)}
    ${panel('mc-signals', '03', 'SIGNALS', 'LEGION',
      `<ul class="mc-signals"><li><time>—</time>No signals yet · Legion not connected</li></ul>`)}
  </aside>`);

  // Bottom command bar
  const bottom = h(`<footer id="mc-command">
    <label class="mc-input"><span>DRAGO</span>
      <input type="text" disabled placeholder='"Drago, show me tomorrow&#39;s route."  — connects at Mark 1' /></label>
    <span class="mc-sources">SOURCES · PUBLIC FEEDS · ATTRIBUTION IN-MAP</span>
  </footer>`);

  // Frame decoration: notched corner brackets around the whole viewport (sci-fi HUD)
  const CORNER = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M2 44 V14 L14 2 H44" /><path class="mc-corner-tick" d="M2 52 V58 M52 2 H58" /></svg>';
  const frame = h(`<div id="mc-frame" aria-hidden="true"><i>${CORNER}</i><i>${CORNER}</i><i>${CORNER}</i><i>${CORNER}</i></div>`);

  document.body.append(frame, top, left, right, bottom);
  attachHudFrame(); // full-screen HUD outline
  attachIcons(); // clean line icons instead of upstream emoji

  // CLEAN UI: presses upstream's own Clean UI switch (VIEW → Display) and
  // theme.css hides every panel while it is on; the top bar stays so it can
  // be switched back, and the map credits stay (license).
  const cleanBtn = top.querySelector('.mc-clean');
  const paintClean = () =>
    cleanBtn.setAttribute('aria-pressed', String(document.body.classList.contains('ui-clean-view')));
  cleanBtn.addEventListener('click', () => {
    document.getElementById('clean-view-toggle')?.click();
    requestAnimationFrame(paintClean);
  });
  new MutationObserver(paintClean).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Clock
  const tick = () => {
    const s = stamp();
    top.querySelector('#mc-day').textContent = s.day;
    top.querySelector('#mc-day-short').textContent = s.dayShort;
    top.querySelector('#mc-time').textContent = s.time;
    top.querySelector('#mc-tz').textContent = s.tz;
  };
  tick();
  setInterval(tick, 10_000);

  // Scenes hide every panel while they play (upstream "recording mode"), STOP
  // included. Our top bar stays up, so END SCENE lives here (shown by CSS only
  // during playback) and presses upstream's own STOP.
  top.querySelector('.mc-end-scene').addEventListener('click', () => {
    document.getElementById('scene-stop-btn')?.click();
  });

  // No CRT look (its button is hidden in theme.css). Scenes can still switch
  // to it, so whenever it comes on, go back to Normal.
  new MutationObserver(() => {
    if (root.getAttribute('data-gev-style') === 'retro') {
      document.querySelector('.style-btn[data-style="normal"]')?.click();
    }
  }).observe(root, { attributes: true, attributeFilter: ['data-gev-style'] });

  // Toggles
  top.querySelectorAll('[data-mc-toggle]').forEach((b) =>
    b.addEventListener('click', () => setOpen(b.dataset.mcToggle, !isOpen(b.dataset.mcToggle))),
  );
  for (const key of ['view', 'tools']) {
    let saved = '0';
    try { saved = localStorage.getItem(`mc.${key}`) ?? '0'; } catch {}
    setOpen(key, saved === '1');
  }
  // Upstream's single-letter shortcuts (F layers, C cctv, H hud, 1-7 looks…)
  // ignore modifier keys, so Mac shortcuts like ⌘⌃F (full screen) or ⌘C also
  // fired them. Stop those before they reach upstream.
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey || e.altKey) && e.key.length === 1) e.stopImmediatePropagation();
  }, true);

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    const key = { v: 'view', t: 'tools' }[e.key.toLowerCase()];
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(key, !isOpen(key));
  }, true);
}

// ── Viewer-dependent parts (called from app/controls.js) ──────────────
export function attachMissionControl(viewer) {
  // Restyle v2: no ground-atmosphere haze, so oceans stay dark and land reads
  // violet like the reference globe (the haze washed the globe pale).
  viewer.scene.globe.showGroundAtmosphere = false;
  attachCctvSplit(viewer); // CCTV: STILL IMAGES / LIVE VIDEO tabs
  attachMapToggle(); // one-click Dark ⇄ Satellite in the map-button column
  attachCategoryToggles(); // one switch per Data Layers category
  attachCctvCard(viewer); // CCTV full screen: button on the small screen, or click a camera on the map
  const views = document.querySelectorAll('#mc-topbar button[data-mc-view]');
  const setActive = (v) => views.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mcView === v)));
  setActive('city');

  const to3D = () => {
    if (viewer.scene.mode !== Cesium.SceneMode.SCENE3D) viewer.scene.morphTo3D(0.8);
  };
  views.forEach((b) =>
    b.addEventListener('click', () => {
      const v = b.dataset.mcView;
      setActive(v);
      if (v === 'map') {
        viewer.scene.morphTo2D(0.8);
      } else if (v === 'globe') {
        to3D();
        setTimeout(() => document.getElementById('reset-globe-view')?.click(), 850);
      } else {
        to3D();
        setTimeout(() => flyToHomeCity(viewer), 850);
      }
    }),
  );

  // Scope (circular viewport mask) is hidden in theme.css, so make sure it is
  // off too — otherwise a saved "on" would leave a mask with no switch.
  setTimeout(() => {
    const scope = document.getElementById('scope-toggle');
    if (scope?.checked) {
      scope.checked = false;
      scope.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, 0);

  // Focus panel: what the camera is looking at (real numbers only)
  const $ = (id) => document.getElementById(id);
  const update = () => {
    if (viewer.isDestroyed()) return;
    const cam = viewer.camera;
    const canvas = viewer.scene.canvas;
    const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
    const hit = cam.pickEllipsoid(center, viewer.scene.globe.ellipsoid);
    const alt = cam.positionCartographic?.height;
    $('mc-focus-alt').textContent = Number.isFinite(alt)
      ? alt > 10000 ? `${(alt / 1000).toFixed(0)} KM` : `${alt.toFixed(0)} M`
      : '—';
    $('mc-focus-hdg').textContent = `${Cesium.Math.toDegrees(cam.heading).toFixed(0).padStart(3, '0')}°`;
    if (!hit) {
      $('mc-focus-coords').textContent = '—';
      $('mc-focus-name').textContent = 'Orbit';
      $('mc-focus-time').textContent = '—';
      return;
    }
    const c = Cesium.Cartographic.fromCartesian(hit);
    const lat = Cesium.Math.toDegrees(c.latitude);
    const lon = Cesium.Math.toDegrees(c.longitude);
    $('mc-focus-coords').textContent =
      `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toFixed(3)}° ${lon >= 0 ? 'E' : 'W'}`;
    const nearHome = Math.abs(lat - HOME_CITY.lat) < 0.5 && Math.abs(lon - HOME_CITY.lon) < 0.6;
    $('mc-focus-name').textContent = nearHome ? HOME_CITY.name : 'Unknown area';
    // Solar local time from longitude (exact zone names come with geocoding later)
    const off = Math.round(lon / 15);
    const now = new Date(Date.now() + off * 3600_000);
    $('mc-focus-time').textContent = nearHome
      ? fmt({ hour: '2-digit', minute: '2-digit', hour12: false })
      : `${now.toISOString().slice(11, 16)} UTC${off >= 0 ? '+' : ''}${off}`;
  };
  viewer.camera.changed.addEventListener(update);
  viewer.camera.percentageChanged = 0.05;
  update();
  setInterval(update, 30_000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', build, { once: true });
} else {
  build();
}
