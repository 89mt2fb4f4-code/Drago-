// Mission Control — the globe from far away (look borrowed from a 21st.dev
// "3D globe" component, rebuilt inside Cesium so every layer still works):
//   • auto-spin: when the whole globe is in view and Boss hasn't touched
//     anything for a few seconds, it turns slowly west → east like the real
//     Earth. Any click, scroll, touch or key stops it at once. On any map
//     source, Vector Dark included. Switch in Visual Presets → GLOBE.
//   • a violet glow around the globe's edge (Cesium's sky atmosphere, tinted)
//   • a faint latitude / longitude grid, only when zoomed far out
import * as Cesium from 'cesium';
import { holdContinuousRender, releaseContinuousRender } from '../renderGovernor.js';

const STORE = 'mc-globe-spin';
const SPIN_DEG_PER_SEC = 2; // a full turn in 3 minutes
const IDLE_MS = 3000; // wait this long after the last touch
const GLOBE_VIEW_M = 6_000_000; // camera height that counts as "whole globe"
const GRID_FROM_M = 3_000_000;
const GRID_STEP_DEG = 15;
const GRID_HEIGHT_M = 12_000; // just above the highest terrain
const HOLD_ID = 'mc-globe-spin';

function loadSpin() {
  try { return localStorage.getItem(STORE) !== 'off'; } catch { return true; }
}
function saveSpin(on) {
  try { localStorage.setItem(STORE, on ? 'on' : 'off'); } catch { /* fine */ }
}

function addGrid(scene) {
  const lines = scene.primitives.add(new Cesium.PolylineCollection());
  const material = Cesium.Material.fromType('Color', {
    color: Cesium.Color.fromCssColorString('#9b87ff').withAlpha(0.16),
  });
  const line = (points) => lines.add({
    positions: Cesium.Cartesian3.fromDegreesArrayHeights(points),
    width: 1,
    material,
  });
  for (let lon = -180; lon < 180; lon += GRID_STEP_DEG) { // meridians
    const pts = [];
    for (let lat = -80; lat <= 80; lat += 2) pts.push(lon, lat, GRID_HEIGHT_M);
    line(pts);
  }
  for (let lat = -75; lat <= 75; lat += GRID_STEP_DEG) { // parallels
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 2) pts.push(lon, lat, GRID_HEIGHT_M);
    line(pts);
  }
  lines.show = false;
  return lines;
}

export function attachGlobeLook(viewer) {
  const scene = viewer.scene;
  const camera = scene.camera;

  // ---- glow: Cesium's sky atmosphere, shifted from blue to violet ----
  if (scene.skyAtmosphere) {
    scene.skyAtmosphere.show = true;
    scene.skyAtmosphere.hueShift = 0.12;
    scene.skyAtmosphere.saturationShift = 0.05;
    scene.skyAtmosphere.brightnessShift = -0.15;
  }

  // ---- grid ----
  const grid = addGrid(scene);
  const height = () => camera.positionCartographic?.height ?? 0;
  const updateGrid = () => {
    // 3D globe only: on the flat MAP it reads as graph paper.
    const show = height() > GRID_FROM_M && scene.mode === Cesium.SceneMode.SCENE3D;
    if (grid.show !== show) {
      grid.show = show;
      scene.requestRender();
    }
  };
  camera.changed.addEventListener(updateGrid);
  scene.morphComplete.addEventListener(updateGrid);
  updateGrid();

  // ---- auto-spin ----
  let enabled = loadSpin();
  let lastInput = Date.now();
  let spinning = false;
  let lastFrame = 0;
  const touched = () => { lastInput = Date.now(); };
  for (const type of ['pointerdown', 'wheel', 'touchstart']) {
    scene.canvas.addEventListener(type, touched, { passive: true, capture: true });
  }
  addEventListener('keydown', touched, true);

  const shouldSpin = () =>
    enabled &&
    !document.hidden &&
    scene.mode === Cesium.SceneMode.SCENE3D &&
    !viewer.trackedEntity &&
    !camera._currentFlight && // Cesium's own fly-to in progress
    height() > GLOBE_VIEW_M &&
    Date.now() - lastInput > IDLE_MS;

  function setSpinning(on) {
    if (on === spinning) return;
    spinning = on;
    if (on) {
      lastFrame = performance.now();
      holdContinuousRender(HOLD_ID);
    } else {
      releaseContinuousRender(HOLD_ID);
    }
  }

  scene.preRender.addEventListener(() => {
    if (!spinning) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    try {
      // Moving the camera westward (longitude going down) makes the Earth
      // appear to turn eastward, like the real one.
      camera.rotate(Cesium.Cartesian3.UNIT_Z, Cesium.Math.toRadians(SPIN_DEG_PER_SEC) * dt);
    } catch (err) {
      console.warn('[Mission Control] globe spin stopped:', err);
      setSpinning(false);
    }
  });
  // Check a few times a second whether to start or stop.
  setInterval(() => setSpinning(shouldSpin()), 250);

  // ---- Visual Presets → GLOBE: Auto-spin switch ----
  const panel = document.getElementById('mc-presets');
  if (panel) {
    const section = document.createElement('div');
    section.className = 'mc-relief mc-globe-look';
    section.innerHTML = `
      <div class="mc-presets-label"><span>GLOBE</span></div>
      <button type="button" class="mc-relief-toggle" role="switch">
        <span>Auto-spin</span><small>turns when zoomed out and idle</small>
        <span class="mc-group-switch" aria-hidden="true"><span class="mc-group-knob"></span></span>
      </button>`;
    const btn = section.querySelector('button');
    const sync = () => {
      btn.setAttribute('aria-checked', String(enabled));
      btn.querySelector('.mc-group-switch').dataset.state = enabled ? 'on' : 'off';
    };
    btn.addEventListener('click', () => {
      enabled = !enabled;
      saveSpin(enabled);
      lastInput = Date.now(); // start after the usual pause
      sync();
    });
    sync();
    panel.append(section);
  }
}
