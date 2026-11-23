// Mission Control — names on the Vector Dark map (map-stack plan step 3).
//
// Names come from the same OpenFreeMap tiles the map is painted from:
// countries, states, cities, neighbourhoods, water, streets and landmarks.
// They are drawn as Cesium labels, not painted into the map, so they always
// face the screen (no stretching when the view tilts) and stay sharp.
//
// Clean by design:
//   • only while Vector Dark is the chosen map
//   • more names appear as you zoom in (streets and landmarks only up close)
//   • names never overlap: bigger places win, the rest hide
//   • the same street name is not repeated right next to itself
import * as Cesium from 'cesium';
import { loadSourceTile, VECTOR_MAP_ID } from './vectorMap.js';

const FONT = "'Space Grotesk', 'Inter', system-ui, sans-serif";
const OUTLINE = Cesium.Color.fromCssColorString('#05070f');

// kind → look, priority (higher wins a clash) and how close the camera must
// be (metres) before it shows.
const KINDS = {
  country: { font: `600 13px ${FONT}`, color: '#eceefa', upper: true, prio: 1000, near: Infinity },
  state: { font: `500 11px ${FONT}`, color: '#9b87ff', upper: true, prio: 900, near: 4.5e6 },
  city: { font: `600 14px ${FONT}`, color: '#eceefa', prio: 800, near: 1.5e6 },
  town: { font: `500 12px ${FONT}`, color: '#d6d2f2', prio: 700, near: 2e5 },
  water: { font: `italic 500 12px ${FONT}`, color: '#6f97ff', prio: 650, near: 6e5 },
  suburb: { font: `600 11px ${FONT}`, color: '#9b87ff', upper: true, prio: 620, near: 4e4 },
  village: { font: `500 11px ${FONT}`, color: '#b4aee0', prio: 600, near: 5e4 },
  neighbourhood: { font: `500 10px ${FONT}`, color: '#8a7be0', upper: true, prio: 560, near: 1.6e4 },
  street: { font: `500 11px ${FONT}`, color: '#aaa3da', prio: 400, near: 6e3 },
  poi: { font: `500 11px ${FONT}`, color: '#cfc6ff', prio: 300, near: 2.5e3 },
  building: { font: `600 11px ${FONT}`, color: '#e6e0ff', prio: 340, near: 3.5e3 },
};
const PLACE_KIND = {
  country: 'country', state: 'state', province: 'state', city: 'city', town: 'town',
  village: 'village', hamlet: 'village', suburb: 'suburb', quarter: 'suburb',
  neighbourhood: 'neighbourhood',
};
const STREET_PRIO = { motorway: 60, trunk: 50, primary: 40, secondary: 30, tertiary: 20, minor: 10 };
const STREET_NEAR = { motorway: 1.6e4, trunk: 1.2e4, primary: 9e3, secondary: 6e3, tertiary: 4e3, minor: 2.4e3 };
// Small amenities that would only clutter the map.
const POI_SKIP = new Set([
  'information', 'shelter', 'toilets', 'bench', 'parking', 'bicycle_parking',
  'bicycle_rental', 'atm', 'post', 'waste_basket', 'drinking_water', 'telephone',
  'vending_machine', 'entrance', 'bus', 'railway', 'car', 'fuel', 'clothes',
  'shop', 'grocery', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream', 'laundry',
  'hairdresser', 'jewelry', 'alcohol_shop', 'mobile_phone', 'playground',
]);
const SAME_NAME_GAP = 320; // px between two copies of the same name
const MAX_SHOWN = { street: 16, poi: 6, building: 5 }; // keep it calm
const PAD_X = 12; // empty space kept around each name, px
const PAD_Y = 7;
const EDGE = 56; // keep names off the screen's top/bottom HUD edge, px
const OBSTACLES = '#gev-voice-control';

const measureCtx = document.createElement('canvas').getContext('2d');
const nameOf = (p) => String(p['name:en'] || p.name_en || p.name || '').trim();
const toDeg = Cesium.Math.toDegrees;

function tileToLonLat(z, x, y, px, py, extent) {
  const n = 2 ** z;
  const lon = ((x + px / extent) / n) * 360 - 180;
  const lat = toDeg(Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))));
  return [lon, lat];
}

// Anchor of a feature in tile units: the point itself, or the middle of the
// longest line part. Anchors in the tile's buffer belong to the neighbour.
function anchorOf(feature, extent) {
  const parts = feature.loadGeometry();
  let best = null;
  for (const part of parts) if (!best || part.length > best.length) best = part;
  if (!best?.length) return null;
  const pt = feature.type === 1 ? best[0] : best[Math.floor(best.length / 2)];
  if (pt.x < 0 || pt.y < 0 || pt.x >= extent || pt.y >= extent) return null;
  return pt;
}

/** Names found in one source tile. */
function namesInTile(tile, z, x, y) {
  const out = [];
  const add = (kind, text, pt, extent, prioBonus = 0, near) => {
    if (!text || !pt) return;
    const style = KINDS[kind];
    const [lon, lat] = tileToLonLat(z, x, y, pt.x, pt.y, extent);
    out.push({
      key: `${kind}|${text}|${lon.toFixed(4)}|${lat.toFixed(4)}`,
      kind, text: style.upper ? text.toUpperCase() : text, lon, lat,
      prio: style.prio + prioBonus, near: near ?? style.near,
    });
  };
  const each = (name, fn) => {
    const layer = tile?.layers?.[name];
    if (layer) for (let i = 0; i < layer.length; i++) fn(layer.feature(i), layer.extent);
  };
  each('place', (f, ext) => {
    const kind = PLACE_KIND[f.properties.class];
    if (kind) add(kind, nameOf(f.properties), anchorOf(f, ext), ext, -(Number(f.properties.rank) || 0) * 4);
  });
  each('water_name', (f, ext) => add('water', nameOf(f.properties), anchorOf(f, ext), ext));
  each('transportation_name', (f, ext) => {
    const cls = f.properties.class;
    if (f.type !== 2 || !(cls in STREET_PRIO)) return;
    add('street', nameOf(f.properties), anchorOf(f, ext), ext, STREET_PRIO[cls], STREET_NEAR[cls]);
  });
  each('poi', (f, ext) => {
    const p = f.properties;
    const rank = Number(p.rank) || 99;
    if (POI_SKIP.has(p.class) || POI_SKIP.has(p.subclass) || rank > 25) return;
    add('poi', nameOf(p), anchorOf(f, ext), ext, -rank * 4);
  });
  return out;
}

// Names other modules add (Overture buildings and places), by source id.
const extraNames = new Map();
let refreshSoon = () => {};
/**
 * Add or replace a set of names from another source. Each name:
 * { kind, text, lon, lat, prio?, near? } — kind is one of KINDS.
 */
export function setExtraNames(sourceId, names) {
  extraNames.set(sourceId, (names || []).filter((n) => KINDS[n.kind] && n.text).map((n) => {
    const style = KINDS[n.kind];
    const text = style.upper ? n.text.toUpperCase() : n.text;
    return {
      key: `${sourceId}|${n.kind}|${text}|${n.lon.toFixed(5)}|${n.lat.toFixed(5)}`,
      kind: n.kind, text, lon: n.lon, lat: n.lat,
      prio: n.prio ?? style.prio, near: n.near ?? style.near,
    };
  }));
  refreshSoon();
}

export function attachVectorLabels(viewer) {
  const scene = viewer.scene;
  const camera = scene.camera;
  const labels = scene.primitives.add(new Cesium.LabelCollection({ scene }));
  const items = new Map(); // key → { ...name, label, position, w, h }
  let ordered = []; // items, highest priority first
  let active = false;
  let gen = 0;

  const isVectorActive = () =>
    document.querySelector('.map-stack-chip.active')?.dataset.stackId === VECTOR_MAP_ID;

  // Where the camera looks, and how far away that is.
  function viewFocus() {
    if (scene.mode === Cesium.SceneMode.SCENE2D) {
      const c = camera.positionCartographic;
      return { lon: toDeg(c.longitude), lat: toDeg(c.latitude), dist: c.height };
    }
    const mid = new Cesium.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
    const hit = camera.pickEllipsoid(mid, scene.globe.ellipsoid);
    if (hit) {
      const c = Cesium.Cartographic.fromCartesian(hit);
      return { lon: toDeg(c.longitude), lat: toDeg(c.latitude), dist: Cesium.Cartesian3.distance(camera.positionWC, hit) };
    }
    const c = camera.positionCartographic;
    return { lon: toDeg(c.longitude), lat: toDeg(c.latitude), dist: c.height };
  }

  async function refresh() {
    if (!active || scene.mode === Cesium.SceneMode.MORPHING) return;
    const my = ++gen;
    const { lon, lat, dist } = viewFocus();
    const z = Math.max(2, Math.min(14, Math.round(Math.log2(5e7 / Math.max(dist, 1)))));
    const n = 2 ** z;
    const latR = Cesium.Math.toRadians(Math.max(-85, Math.min(85, lat)));
    const cx = Math.floor(((lon + 180) / 360) * n);
    const cy = Math.floor(((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n);
    // Whole world at the lowest zoom (16 tiles); else the tiles around the view.
    const r = z <= 2 ? n : z >= 12 ? 2 : 1;
    const jobs = [];
    const picked = new Set();
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const y = cy + dy;
        if (y < 0 || y >= n) continue;
        const x = (((cx + dx) % n) + n) % n;
        if (picked.has(`${x}/${y}`)) continue;
        picked.add(`${x}/${y}`);
        jobs.push(loadSourceTile(z, x, y).then((t) => namesInTile(t, z, x, y), () => []));
      }
    }
    const found = (await Promise.all(jobs)).flat();
    if (my !== gen || !active) return;
    for (const list of extraNames.values()) found.push(...list);

    const keep = new Set();
    for (const name of found) {
      keep.add(name.key);
      if (items.has(name.key)) continue;
      const style = KINDS[name.kind];
      measureCtx.font = style.font;
      const position = Cesium.Cartesian3.fromDegrees(name.lon, name.lat, 0);
      const label = labels.add({
        position,
        text: name.text,
        font: style.font,
        fillColor: Cesium.Color.fromCssColorString(style.color),
        outlineColor: OUTLINE,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: false,
      });
      items.set(name.key, { ...name, label, position, w: measureCtx.measureText(name.text).width, h: parseInt(style.font.match(/(\d+)px/)[1], 10) });
    }
    for (const [key, item] of items) {
      if (!keep.has(key)) {
        labels.remove(item.label);
        items.delete(key);
      }
    }
    ordered = [...items.values()].sort((a, b) => b.prio - a.prio);
    declutter();
  }

  // Show the most important names that fit; hide the rest.
  const win = new Cesium.Cartesian2();
  function declutter() {
    if (!active || scene.mode === Cesium.SceneMode.MORPHING) return;
    const is3d = scene.mode === Cesium.SceneMode.SCENE3D;
    const occluder = is3d ? new Cesium.EllipsoidalOccluder(Cesium.Ellipsoid.WGS84, camera.positionWC) : null;
    const height2d = is3d ? 0 : camera.positionCartographic.height;
    const W = scene.canvas.clientWidth;
    const H = scene.canvas.clientHeight;
    const boxes = [];
    const seen = new Map(); // text → screen points already used
    const count = {};
    const canvas = scene.canvas;
    const rect = canvas.getBoundingClientRect();
    // A name under a panel or button would fight with its text: only draw
    // it where the map itself is on top (HUD lines let clicks through).
    const onMap = (x, y) => document.elementFromPoint(rect.left + x, rect.top + y) === canvas;
    // Click-through boxes (voice control) still cover the map: keep clear.
    for (const el of document.querySelectorAll(OBSTACLES)) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) boxes.push([r.left - rect.left, r.top - rect.top, r.right - rect.left, r.bottom - rect.top]);
    }
    for (const item of ordered) {
      let show = false;
      const dist = is3d ? Cesium.Cartesian3.distance(camera.positionWC, item.position) : height2d;
      if (dist <= item.near && (!occluder || occluder.isPointVisible(item.position))) {
        const p = Cesium.SceneTransforms.worldToWindowCoordinates(scene, item.position, win);
        if (p && p.x > 0 && p.y > EDGE && p.x < W && p.y < H - EDGE && (count[item.kind] || 0) < (MAX_SHOWN[item.kind] ?? Infinity)) {
          const b = [p.x - item.w / 2 - PAD_X, p.y - item.h / 2 - PAD_Y, p.x + item.w / 2 + PAD_X, p.y + item.h / 2 + PAD_Y];
          const clash = boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
          const twins = seen.get(item.text) || [];
          const near = twins.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < SAME_NAME_GAP);
          if (!clash && !near && onMap(p.x - item.w / 2, p.y) && onMap(p.x, p.y) && onMap(p.x + item.w / 2, p.y)) {
            show = true;
            boxes.push(b);
            twins.push([p.x, p.y]);
            seen.set(item.text, twins);
            count[item.kind] = (count[item.kind] || 0) + 1;
          }
        }
      }
      if (item.label.show !== show) item.label.show = show;
    }
    scene.requestRender();
  }

  function setActive(on) {
    if (on === active) return;
    active = on;
    labels.show = on;
    if (on) safe(refresh)();
    else {
      gen++;
      labels.removeAll();
      items.clear();
      ordered = [];
      scene.requestRender();
    }
  }

  // Never let a label problem stop the map drawing (see README, item 13).
  function safe(fn) {
    return () => {
      try {
        const r = fn();
        if (r?.catch) r.catch((err) => console.warn('[Mission Control] labels skipped:', err));
      } catch (err) {
        console.warn('[Mission Control] labels skipped:', err);
      }
    };
  }

  let queued = false;
  const declutterSoon = () => {
    if (queued || !active) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; safe(declutter)(); });
  };
  let refreshTimer = 0;
  refreshSoon = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(safe(refresh), 150);
  };
  camera.changed.addEventListener(declutterSoon);
  camera.moveEnd.addEventListener(safe(refresh));
  scene.morphComplete.addEventListener(safe(refresh));

  // Follow the map choice (chips re-render, so watch the whole row).
  const chips = document.getElementById('map-stack-chips');
  const sync = () => setActive(isVectorActive());
  if (chips) {
    new MutationObserver(sync).observe(chips, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }
  sync();
  setTimeout(sync, 3000); // the first map choice can land after startup
}
