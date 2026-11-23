// Mission Control — the globe from far away (look borrowed from a 21st.dev
// "3D globe" component, rebuilt inside Cesium so every layer still works):
//   • auto-spin: when the whole globe is in view and Boss hasn't touched
//     anything for a few seconds, it turns slowly west → east like the real
//     Earth. Any click, scroll, touch or key stops it at once. On any map
//     source, Vector Dark included. Switch in Visual Presets → GLOBE.
//   • a violet glow around the globe's edge (Cesium's sky atmosphere, tinted)
//   • a faint latitude / longitude grid, only when zoomed far out
//   • on satellite maps (Esri, Bing, Google 3D): the "photo globe" look —
//     lit from the upper right like a real sphere, a soft night side, and a
//     natural blue atmosphere glow. Cesium fades the lighting and haze out as
//     you zoom in, so up close it is the plain satellite photo again.
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
const SATELLITE_STACKS = new Set(['esri-imagery', 'bing-aerial', 'bing-labels', 'photoreal']);
// Lighting + haze are full from ~9,000 km out and gone below ~3,000 km.
const LOOK_FULL_M = 9_000_000;
const LOOK_GONE_M = 3_000_000;

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

  const globe = scene.globe;
  const sunLight = scene.light; // Cesium's default, restored on dark maps
  // A light that sits up and to the right of the viewer, like the 21st.dev
  // globe, re-aimed every frame so the lit side always faces Boss.
  const viewLight = new Cesium.DirectionalLight({ direction: new Cesium.Cartesian3(1, 0, 0), intensity: 2.4 });
  const tmp = new Cesium.Cartesian3();
  const aimLight = () => {
    const d = viewLight.direction;
    Cesium.Cartesian3.multiplyByScalar(camera.rightWC, -0.5, d);
    Cesium.Cartesian3.add(d, Cesium.Cartesian3.multiplyByScalar(camera.upWC, -0.35, tmp), d);
    Cesium.Cartesian3.add(d, Cesium.Cartesian3.multiplyByScalar(camera.directionWC, 0.8, tmp), d);
    Cesium.Cartesian3.normalize(d, d);
  };
  let satelliteLook = null;

  function setLook(satellite) {
    if (satellite === satelliteLook) return;
    satelliteLook = satellite;
    const sky = scene.skyAtmosphere;
    if (satellite) {
      if (sky) Object.assign(sky, { show: true, hueShift: 0, saturationShift: 0.1, brightnessShift: 0.1 });
      Object.assign(globe, {
        showGroundAtmosphere: true,
        enableLighting: true,
        lightingFadeOutDistance: LOOK_GONE_M,
        lightingFadeInDistance: LOOK_FULL_M,
        nightFadeOutDistance: LOOK_GONE_M,
        nightFadeInDistance: LOOK_FULL_M,
      });
      aimLight();
      scene.light = viewLight;
    } else {
      // Dark maps: violet edge glow, black oceans, no day/night.
      if (sky) Object.assign(sky, { show: true, hueShift: 0.12, saturationShift: 0.05, brightnessShift: -0.15 });
      globe.showGroundAtmosphere = false;
      globe.enableLighting = false;
      scene.light = sunLight;
    }
    updateGrid();
    scene.requestRender();
  }
  scene.preRender.addEventListener(() => {
    if (satelliteLook && scene.light === viewLight) aimLight();
  });

  // ---- grid (dark maps only; on photos it reads as clutter) ----
  const grid = addGrid(scene);
  const height = () => camera.positionCartographic?.height ?? 0;
  function updateGrid() {
    const show = !satelliteLook && height() > GRID_FROM_M && scene.mode !== Cesium.SceneMode.MORPHING;
    if (grid.show !== show) {
      grid.show = show;
      scene.requestRender();
    }
  }
  camera.changed.addEventListener(updateGrid);
  scene.morphComplete.addEventListener(updateGrid);

  // Follow the map source (chips re-render, so watch the whole row).
  const activeStack = () => document.querySelector('.map-stack-chip.active')?.dataset.stackId;
  const syncLook = () => {
    try { setLook(SATELLITE_STACKS.has(activeStack())); } catch (err) { console.warn('[Mission Control] globe look skipped:', err); }
  };
  const chips = document.getElementById('map-stack-chips');
  if (chips) new MutationObserver(syncLook).observe(chips, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  syncLook();
  setTimeout(syncLook, 3000);

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
