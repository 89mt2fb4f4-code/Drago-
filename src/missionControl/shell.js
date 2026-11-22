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

const TZ = 'America/New_York';
const root = document.documentElement;
root.classList.add('mc');

const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const fmt = (opts, d = new Date()) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, ...opts }).format(d);

function stamp() {
  const day = fmt({ month: 'long', day: 'numeric' }).toUpperCase();
  const time = fmt({ hour: '2-digit', minute: '2-digit', hour12: false });
  const tz = fmt({ timeZoneName: 'short' }).split(' ').pop();
  return { day, time, tz };
}

// ── persistent toggles (View = upstream display panels, Tools = dock) ──
const flag = (k) => `mc${k[0].toUpperCase()}${k.slice(1)}`;
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
    <div class="mc-brand">${LOGO}<div><span class="mc-kicker">DRAGO · HORUS</span><span class="mc-title">MISSION CONTROL</span></div></div>
    <nav class="mc-views" aria-label="Map view">
      <button type="button" data-mc-view="globe">GLOBE</button>
      <button type="button" data-mc-view="city">CITY</button>
      <button type="button" data-mc-view="map">MAP</button>
    </nav>
    <div class="mc-status">
      <button type="button" class="mc-chip" data-mc-toggle="view" title="Display options (V)">VIEW</button>
      <button type="button" class="mc-chip" data-mc-toggle="tools" title="Search · presets · voice (T)">TOOLS</button>
      <span class="mc-sep"></span>
      <span class="mc-place">${HOME_CITY.name.toUpperCase().replace(', ', ' · ')}</span>
      <span class="mc-clock"><span id="mc-day"></span> <b id="mc-time"></b> <span id="mc-tz"></span></span>
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

  // Frame decoration: faint corner brackets around the whole viewport
  const frame = h(`<div id="mc-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>`);

  document.body.append(frame, top, left, right, bottom);

  // Clock
  const tick = () => {
    const s = stamp();
    top.querySelector('#mc-day').textContent = s.day;
    top.querySelector('#mc-time').textContent = s.time;
    top.querySelector('#mc-tz').textContent = s.tz;
  };
  tick();
  setInterval(tick, 10_000);

  // Toggles
  top.querySelectorAll('[data-mc-toggle]').forEach((b) =>
    b.addEventListener('click', () => setOpen(b.dataset.mcToggle, !isOpen(b.dataset.mcToggle))),
  );
  for (const key of ['view', 'tools']) {
    let saved = '0';
    try { saved = localStorage.getItem(`mc.${key}`) ?? '0'; } catch {}
    setOpen(key, saved === '1');
  }
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
  const views = document.querySelectorAll('[data-mc-view]');
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
