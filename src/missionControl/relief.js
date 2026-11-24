// Mission Control — Relief mode: a dark "mission briefing" terrain look.
//
// Real terrain heights (the keyless Re:Earth / Mapterhorn terrain the app
// already loads) drawn with:
//   • hill shading — slopes facing a fixed light from the north-west glow
//     lavender, slopes facing away fall into navy shadow. Flat ground is left
//     untouched, so the dark map, roads, water and names stay visible.
//   • contour lines — thin purple lines every 50–500 m of height (closer
//     together as you zoom in)
//   • height exaggeration — 1×, 1.5×, 2× or 3×, so hills read as hills
// Switched in Visual Presets → TERRAIN. The choice is remembered on this
// computer only. Works with any map source.
import * as Cesium from 'cesium';

const STORE = 'mc-relief';
const EXAGGERATIONS = [1, 1.5, 2, 3];
const DEFAULTS = { on: false, exaggeration: 1.5 };
const REGION_MOVE_KM = 50; // re-anchor the exaggeration after a move this big

// Hill shading from slope + aspect (Cesium: aspect 0 = facing east, counter-
// clockwise). Light from the north-west, 45° up. Slopes become grey-violet
// shaded relief; flat ground fades back to the map underneath, so city
// streets, water and names stay readable.
const SHADER = `
czm_material czm_getMaterial(czm_materialInput mi) {
  czm_material m = czm_getDefaultMaterial(mi);
  const float Z = 0.785398;  // light 45° from straight up
  const float A = 2.356194;  // light from the north-west
  float hs = cos(Z) * cos(mi.slope) + sin(Z) * sin(mi.slope) * cos(A - mi.aspect);
  vec3 shade = mix(vec3(0.02, 0.02, 0.07), vec3(0.64, 0.61, 0.80), pow(clamp(hs * 1.15, 0.0, 1.0), 1.6));
  float hill = smoothstep(0.07, 0.3, mi.slope); // 0 below ~4° (city embankments), 1 from ~17°
  float shadeAlpha = hill * strength;
  // Contours: thin lines, every 5th one brighter (index contours).
  float h = mi.height;
  float w = max(abs(dFdx(h)), abs(dFdy(h))) * czm_pixelRatio;
  // Distance to the nearest contour, in metres; soft edges (anti-aliased).
  float d = abs(mod(h + spacing * 0.5, spacing) - spacing * 0.5);
  float d5 = abs(mod(h + spacing * 2.5, spacing * 5.0) - spacing * 2.5);
  float line = w > 0.0 ? 1.0 - smoothstep(0.0, w * 1.2, d) : 0.0;
  bool index = d5 < spacing * 0.5;
  float lineAlpha = line * (index ? lineColor.a : lineColor.a * 0.4);
  m.diffuse = mix(shade, lineColor.rgb, lineAlpha);
  m.alpha = max(shadeAlpha, lineAlpha);
  return m;
}`;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (saved && typeof saved.on === 'boolean' && EXAGGERATIONS.includes(saved.exaggeration)) return saved;
  } catch { /* private window or blocked storage */ }
  return { ...DEFAULTS };
}
function save(state) {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* fine */ }
}

/** Current Relief state, for other modules: { on, exaggeration }. */
export let reliefState = { ...DEFAULTS };
let setTemporary = null;
/**
 * Switch Relief for a while without saving it (scenes use this).
 * Returns a function that puts Boss's own setting back.
 */
export function overrideRelief(next) {
  return setTemporary ? setTemporary(next) : () => {};
}

export function attachRelief(viewer) {
  const scene = viewer.scene;
  const globe = scene.globe;
  const panel = document.getElementById('mc-presets');
  const state = load();
  const material = new Cesium.Material({
    fabric: {
      uniforms: {
        lineColor: Cesium.Color.fromCssColorString('#a796ff').withAlpha(0.5),
        spacing: 100.0,
        strength: 0.95,
      },
      source: SHADER,
    },
  });
  let anchor = null; // { lat, lon } where the exaggeration is centred

  // Contour spacing follows the zoom: 20 m up close … 1000 m from far away
  // (every 5th line brighter: 100 m … 5 km).
  function tuneSpacing() {
    const cam = scene.camera.positionCartographic;
    const h = cam.height - (globe.getHeight(cam) ?? 0); // height above the ground
    material.uniforms.spacing = h < 1500 ? 20 : h < 4000 ? 50 : h < 10000 ? 200 : h < 40000 ? 500 : 1000;
  }

  // Exaggeration grows heights away from a reference height. Using the
  // ground height where Boss is looking keeps that area (and markers placed
  // at real ground level, like cameras) where it is; only the hills grow.
  function reanchor(force) {
    if (!state.on || state.exaggeration === 1 || scene.mode !== Cesium.SceneMode.SCENE3D) return;
    const mid = new Cesium.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
    const hit = globe.pick(scene.camera.getPickRay(mid), scene) ?? scene.camera.pickEllipsoid(mid, globe.ellipsoid);
    if (!hit) return;
    const c = Cesium.Cartographic.fromCartesian(hit);
    const lat = Cesium.Math.toDegrees(c.latitude);
    const lon = Cesium.Math.toDegrees(c.longitude);
    if (!force && anchor) {
      const dKm = Math.hypot(lat - anchor.lat, (lon - anchor.lon) * Math.cos(c.latitude)) * 111;
      if (dKm < REGION_MOVE_KM) return;
    }
    anchor = { lat, lon };
    // The real (not stretched) ground height, straight from the terrain data.
    Cesium.sampleTerrainMostDetailed(scene.terrainProvider, [c])
      .then(([s]) => {
        if (!state.on || anchor?.lat !== lat || anchor?.lon !== lon || !Number.isFinite(s?.height)) return;
        scene.verticalExaggerationRelativeHeight = s.height;
        scene.requestRender();
      })
      .catch(() => { /* keep the previous reference */ });
  }

  function apply() {
    reliefState = { on: state.on, exaggeration: state.exaggeration };
    if (state.on) {
      tuneSpacing();
      globe.material = material;
      scene.verticalExaggeration = state.exaggeration;
      reanchor(true);
    } else {
      if (globe.material === material) globe.material = undefined;
      scene.verticalExaggeration = 1;
      scene.verticalExaggerationRelativeHeight = 0;
      anchor = null;
    }
    window.dispatchEvent(new CustomEvent('mc:relief', { detail: { ...reliefState } }));
    scene.requestRender();
    sync();
  }

  // ---- Visual Presets → TERRAIN section ----
  const section = document.createElement('div');
  section.className = 'mc-relief';
  section.innerHTML = `
    <div class="mc-presets-label"><span>TERRAIN</span></div>
    <button type="button" class="mc-relief-toggle" role="switch" aria-checked="false">
      <span>Relief</span><small>heights · shading · contours</small>
      <span class="mc-group-switch" aria-hidden="true"><span class="mc-group-knob"></span></span>
    </button>
    <div class="mc-relief-scale" role="group" aria-label="Height exaggeration">
      ${EXAGGERATIONS.map((x) => `<button type="button" class="mc-relief-chip" data-x="${x}">${x}×</button>`).join('')}
    </div>`;
  const toggle = section.querySelector('.mc-relief-toggle');
  const knob = toggle.querySelector('.mc-group-switch');
  function sync() {
    toggle.setAttribute('aria-checked', String(state.on));
    knob.dataset.state = state.on ? 'on' : 'off';
    for (const chip of section.querySelectorAll('.mc-relief-chip')) {
      const active = Number(chip.dataset.x) === state.exaggeration;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
      chip.disabled = !state.on;
    }
  }
  toggle.addEventListener('click', () => {
    state.on = !state.on;
    save(state);
    apply();
  });
  section.querySelector('.mc-relief-scale').addEventListener('click', (e) => {
    const chip = e.target.closest('.mc-relief-chip');
    if (!chip || !state.on) return;
    state.exaggeration = Number(chip.dataset.x);
    save(state);
    apply();
  });
  panel?.append(section);

  // Never let Relief stop the map drawing: any trouble turns it off.
  const safe = (fn) => (...args) => {
    try { fn(...args); } catch (err) { console.warn('[Mission Control] Relief skipped:', err); }
  };
  scene.camera.moveEnd.addEventListener(safe(() => {
    if (!state.on) return;
    tuneSpacing();
    reanchor(false);
    scene.requestRender();
  }));
  scene.morphComplete.addEventListener(safe(() => { anchor = null; reanchor(true); }));
  scene.renderError.addEventListener(() => {
    if (globe.material !== material) return;
    console.warn('[Mission Control] Relief switched off after a draw error');
    state.on = false;
    apply();
    setTimeout(() => { viewer.useDefaultRenderLoop = true; }, 0);
  });

  // `strength` (0–1) is how strongly slopes are painted; scenes use less
  // because their own glow (bloom) brightens the picture further.
  setTemporary = ({ strength, ...next }) => {
    const saved = { on: state.on, exaggeration: state.exaggeration };
    Object.assign(state, next);
    if (Number.isFinite(strength)) material.uniforms.strength = strength;
    apply();
    return () => {
      Object.assign(state, saved);
      material.uniforms.strength = 0.95;
      apply();
    };
  };

  apply();
}
