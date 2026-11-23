// Mission Control — Overture Maps on the Vector Dark map (map-stack plan step 4).
//
//   • 3D buildings: real footprints and heights (height, or floors × 3.3 m;
//     towers come as parts with their own base and top). Up close only.
//   • Names: named buildings (taller first) and public places from Overture
//     Places — hotels, museums, parks, stations, venues… Never phone numbers,
//     emails or other details, and not private services (law offices,
//     clinics, home services): we watch the city, not people.
//
// Data is read straight from Overture's public PMTiles files with small
// range requests (see pmtiles.js); nothing is downloaded or stored. The
// newest Overture release is picked automatically. Only while Vector Dark
// is the chosen map, and only in the 3D views.
import * as Cesium from 'cesium';
import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';
import { openPmtiles } from './pmtiles.js';
import { VECTOR_MAP_ID } from './vectorMap.js';
import { setExtraNames } from './vectorLabels.js';
import { reliefState } from './relief.js';

const BUCKET = 'https://overturemaps-extras-us-west-2.s3.amazonaws.com';
const FALLBACK_RELEASE = '2026-11-18.0';
const Z = 14; // Overture places exist only at 14; buildings are fullest there
const BUILDINGS_WITHIN = 9000; // m from camera to the point in view
const PLACES_WITHIN = 3500;
const KEEP_TILES = 16;
const FLOOR_M = 3.3;
const DEFAULT_HEIGHT_M = 7;
// Names, kept fresh (Boss, 2026-11-23): building names come from OSM tags
// that can be years old, so only landmarks this tall get one, and a fresh
// Overture place inside the footprint replaces it.
const LANDMARK_HEIGHT_M = 40;
const PLACE_MIN_CONFIDENCE = 0.9;
// Places known only from a business registry (a company filing) may not be
// a real place on the street.
const REGISTRY_ONLY = new Set(['BrightQuery']);
const OVERTURE_INTERNAL = new Set(['Overture', 'Overture-signals']);

export const OVERTURE_CREDIT_HTML =
  '<a href="https://overturemaps.org" target="_blank" rel="noopener">© Overture Maps Foundation</a>';

// Public places worth a name on the map (Overture basic_category).
const PLACE_KINDS = new Set([
  'hotel', 'lodging', 'museum', 'art_gallery', 'historic_site', 'theatre_venue',
  'music_venue', 'performing_arts_venue', 'cinema', 'movie_theater', 'park',
  'library', 'college_university', 'train_station', 'public_transit_facility_or_service',
  'airport', 'courthouse', 'city_hall', 'police_station', 'fire_station', 'hospital',
  'stadium_or_arena', 'sport_stadium', 'arena', 'landmark_and_historical_building',
  'monument', 'tourist_attraction', 'attraction', 'zoo', 'aquarium',
  'convention_center', 'event_venue', 'shopping_center', 'shopping_mall',
  'casino', 'marina', 'beach', 'brewery', 'post_office',
]);

const LOW = Cesium.Color.fromCssColorString('#1c2144');
const TALL = Cesium.Color.fromCssColorString('#5a46c9');
const toDeg = Cesium.Math.toDegrees;

// ---------- data access -------------------------------------------------

let releasesPromise = null;
function releases() {
  releasesPromise ??= fetch(`${BUCKET}/?list-type=2&prefix=tiles/&delimiter=/`)
    .then((r) => (r.ok ? r.text() : ''))
    .then((xml) => {
      const list = [...xml.matchAll(/<Prefix>tiles\/(\d{4}-\d{2}-\d{2}\.\d+)\/<\/Prefix>/g)].map((m) => m[1]);
      return [...new Set([...list, FALLBACK_RELEASE])].sort().reverse();
    })
    .catch(() => [FALLBACK_RELEASE]);
  return releasesPromise;
}

const themes = new Map();
function theme(name) {
  if (!themes.has(name)) {
    themes.set(name, (async () => {
      // Newest release first; a release still uploading falls back to older.
      for (const release of (await releases()).slice(0, 3)) {
        const pm = openPmtiles(`${BUCKET}/tiles/${release}/${name}.pmtiles`);
        try {
          await pm.header();
          return pm;
        } catch { /* try the next release */ }
      }
      throw new Error(`Overture ${name} tiles unavailable`);
    })().catch((err) => {
      themes.delete(name);
      throw err;
    }));
  }
  return themes.get(name);
}

async function readTile(name, x, y) {
  const bytes = await (await theme(name)).getTile(Z, x, y);
  return bytes ? new VectorTile(new PbfReader(bytes)) : null;
}

// ---------- geometry ----------------------------------------------------

function tileLonLat(x, y, px, py, extent) {
  const n = 2 ** Z;
  const lon = ((x + px / extent) / n) * 360 - 180;
  const lat = toDeg(Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + py / extent)) / n))));
  return [lon, lat];
}

const signedArea = (ring) => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[i].x - ring[j].x) * (ring[i].y + ring[j].y);
  }
  return sum;
};

/** Polygons of one feature as [{ outer:[lon,lat…], holes:[[…]] }], MVT ring rules. */
function polygonsOf(feature, x, y) {
  const extent = feature.extent;
  const polys = [];
  let ccw;
  for (const ring of feature.loadGeometry()) {
    const area = signedArea(ring);
    if (area === 0 || ring.length < 4) continue;
    if (ccw === undefined) ccw = area < 0;
    const flat = [];
    let prev = null;
    for (let i = 0; i < ring.length - 1; i++) { // last point repeats the first
      const pt = ring[i];
      if (prev && prev.x === pt.x && prev.y === pt.y) continue;
      prev = pt;
      flat.push(...tileLonLat(x, y, pt.x, pt.y, extent));
    }
    if (flat.length < 6) continue;
    if (ccw === area < 0) polys.push({ outer: flat, holes: [] });
    else polys.at(-1)?.holes.push(flat);
  }
  return polys;
}

function centroid(flat) {
  let lon = 0;
  let lat = 0;
  const n = flat.length / 2;
  for (let i = 0; i < flat.length; i += 2) { lon += flat[i]; lat += flat[i + 1]; }
  return [lon / n, lat / n];
}

const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : undefined);
function heightsOf(p) {
  const top = num(p.height) ?? (num(p.num_floors) ? num(p.num_floors) * FLOOR_M : DEFAULT_HEIGHT_M);
  const base = num(p.min_height) ?? (num(p.min_floor) ? num(p.min_floor) * FLOOR_M : 0);
  return { base: Math.max(0, Math.min(base, top - 1)), top: Math.max(top, 2) };
}
/** True when every outside source of a place is a business registry. */
function registryOnly(sources) {
  let list;
  try { list = JSON.parse(sources || '[]'); } catch { return false; }
  const outside = list.map((s) => s?.dataset).filter((d) => d && !OVERTURE_INTERNAL.has(d));
  return outside.length > 0 && outside.every((d) => REGISTRY_ONLY.has(d));
}

/** Point-in-polygon on a flat [lon, lat, …] ring. */
function inside(lon, lat, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const nameOf = (p) => {
  if (p['@name']) return String(p['@name']).trim();
  try { return String(JSON.parse(p.names || '{}').primary || '').trim(); } catch { return ''; }
};

// ---------- module ------------------------------------------------------

export function attachOverture(viewer) {
  const scene = viewer.scene;
  const camera = scene.camera;
  const credit = new Cesium.Credit(OVERTURE_CREDIT_HTML, true); // on screen, like the map's
  const tiles = new Map(); // "x/y" → { primitive?, names, lastUsed, loading }
  const placeNames = new Map(); // "x/y" → names
  let active = false;
  let broken = false; // set if Cesium ever fails to draw our buildings
  let gen = 0;
  let creditOn = false;
  // Relief can stretch terrain heights; buildings are placed at real height,
  // so they'd sink or float. Show them only at 1×.
  let heightsTrue = !reliefState.on || reliefState.exaggeration === 1;
  window.addEventListener('mc:relief', (e) => {
    heightsTrue = !e.detail?.on || e.detail.exaggeration === 1;
    safeRefresh();
  });

  const isVectorActive = () =>
    document.querySelector('.map-stack-chip.active')?.dataset.stackId === VECTOR_MAP_ID;

  function setCredit(on) {
    if (on === creditOn) return;
    creditOn = on;
    if (on) viewer.creditDisplay.addStaticCredit(credit);
    else viewer.creditDisplay.removeStaticCredit(credit);
  }

  function focus() {
    const mid = new Cesium.Cartesian2(scene.canvas.clientWidth / 2, scene.canvas.clientHeight / 2);
    const hit = camera.pickEllipsoid(mid, scene.globe.ellipsoid);
    const c = hit ? Cesium.Cartographic.fromCartesian(hit) : camera.positionCartographic;
    const dist = hit ? Cesium.Cartesian3.distance(camera.positionWC, hit) : camera.positionCartographic.height;
    const n = 2 ** Z;
    const lat = Cesium.Math.clamp(c.latitude, -1.48, 1.48);
    const fx = ((toDeg(c.longitude) + 180) / 360) * n;
    const fy = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n;
    return { fx, fy, dist };
  }

  async function groundHeight(lon, lat) {
    const carto = Cesium.Cartographic.fromDegrees(lon, lat);
    try {
      const [s] = await Cesium.sampleTerrainMostDetailed(scene.terrainProvider, [carto]);
      if (Number.isFinite(s?.height)) return s.height;
    } catch { /* fall through */ }
    return scene.globe.getHeight(carto) ?? 0;
  }

  async function buildTile(key, x, y) {
    const entry = { primitive: null, names: [], lastUsed: Date.now(), loading: true };
    tiles.set(key, entry);
    try {
      const vt = await readTile('buildings', x, y);
      const [clon, clat] = tileLonLat(x, y, 2048, 2048, 4096);
      const ground = await groundHeight(clon, clat);
      const instances = [];
      const names = [];
      for (const layerName of ['building', 'building_part']) {
        const layer = vt?.layers?.[layerName];
        if (!layer) continue;
        for (let i = 0; i < layer.length; i++) {
          const f = layer.feature(i);
          const p = f.properties;
          if (f.type !== 3 || p.is_underground === true || p.is_underground === 'true') continue;
          if (layerName === 'building' && (p.has_parts === true || p.has_parts === 'true')) continue;
          const { base, top } = heightsOf(p);
          const color = Cesium.Color.lerp(LOW, TALL, Math.min(1, top / 150), new Cesium.Color());
          const polys = polygonsOf(f, x, y);
          for (const poly of polys) {
            const hierarchy = new Cesium.PolygonHierarchy(
              Cesium.Cartesian3.fromDegreesArray(poly.outer),
              poly.holes.map((h) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(h))),
            );
            instances.push(new Cesium.GeometryInstance({
              geometry: new Cesium.PolygonGeometry({
                polygonHierarchy: hierarchy,
                height: ground + base,
                extrudedHeight: ground + top,
                vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
              }),
              attributes: { color: Cesium.ColorGeometryInstanceAttribute.fromColor(color) },
            }));
          }
          const name = nameOf(p);
          if (name && polys[0] && top >= LANDMARK_HEIGHT_M) {
            const [lon, lat] = centroid(polys[0].outer);
            names.push({ kind: 'building', text: name, lon, lat, prio: 340 + Math.min(top, 200) / 2, ring: polys[0].outer });
          }
        }
      }
      entry.names = names;
      if (instances.length && !broken) {
        entry.primitive = scene.primitives.add(new Cesium.Primitive({
          geometryInstances: instances,
          appearance: new Cesium.PerInstanceColorAppearance({ translucent: false, closed: true }),
          asynchronous: true,
          allowPicking: false, // clicks go to cameras and other markers
          releaseGeometryInstances: true,
          shadows: Cesium.ShadowMode.DISABLED,
        }));
        entry.primitive.show = active;
      }
    } catch (err) {
      console.warn('[Mission Control] Overture buildings skipped for a tile:', err);
      tiles.delete(key);
      return;
    } finally {
      entry.loading = false;
    }
    scene.requestRender();
  }

  async function loadPlaces(key, x, y) {
    placeNames.set(key, []);
    try {
      const vt = await readTile('places', x, y);
      const layer = vt?.layers?.place;
      const out = [];
      for (let i = 0; layer && i < layer.length; i++) {
        const f = layer.feature(i);
        const p = f.properties;
        if (!PLACE_KINDS.has(p.basic_category) || (num(p.confidence) ?? 0) < PLACE_MIN_CONFIDENCE) continue;
        if (p.operating_status && p.operating_status !== 'open') continue;
        if (registryOnly(p.sources)) continue;
        const name = nameOf(p);
        const pt = f.loadGeometry()[0]?.[0];
        if (!name || !pt) continue;
        const [lon, lat] = tileLonLat(x, y, pt.x, pt.y, f.extent);
        out.push({ kind: 'poi', text: name, lon, lat, prio: 300 + Math.round(num(p.confidence) * 20) });
      }
      placeNames.set(key, out);
    } catch (err) {
      placeNames.delete(key);
      console.warn('[Mission Control] Overture places skipped for a tile:', err);
    }
  }

  function publishNames(wanted, wantedPlaces) {
    const places = wantedPlaces.flatMap((key) => placeNames.get(key) || []);
    const names = [...places];
    for (const key of wanted) {
      for (const b of tiles.get(key)?.names || []) {
        // A fresh place inside this building wins over its OSM name.
        if (places.some((pl) => inside(pl.lon, pl.lat, b.ring))) continue;
        names.push(b);
      }
    }
    setExtraNames('overture', names);
  }

  async function refresh() {
    const my = ++gen;
    const in3d = scene.mode === Cesium.SceneMode.SCENE3D;
    const { fx, fy, dist } = in3d ? focus() : { fx: 0, fy: 0, dist: Infinity };
    const near = active && in3d && dist <= BUILDINGS_WITHIN;
    const showBuildings = near && heightsTrue;
    setCredit(active);
    const wanted = [];
    const wantedPlaces = [];
    if (near) {
      const cx = Math.floor(fx);
      const cy = Math.floor(fy);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        wanted.push(`${cx + dx}/${cy + dy}`);
      }
      if (dist <= PLACES_WITHIN) {
        // The 2 × 2 block of tiles nearest the point in view.
        const sx = fx - cx < 0.5 ? -1 : 1;
        const sy = fy - cy < 0.5 ? -1 : 1;
        for (const [dx, dy] of [[0, 0], [sx, 0], [0, sy], [sx, sy]]) wantedPlaces.push(`${cx + dx}/${cy + dy}`);
      }
    }
    for (const [key, t] of tiles) if (t.primitive) t.primitive.show = showBuildings && wanted.includes(key);
    const jobs = [];
    for (const key of wanted) {
      const t = tiles.get(key);
      if (t) { t.lastUsed = Date.now(); continue; }
      const [x, y] = key.split('/').map(Number);
      jobs.push(buildTile(key, x, y));
    }
    for (const key of wantedPlaces) {
      if (placeNames.has(key)) continue;
      const [x, y] = key.split('/').map(Number);
      jobs.push(loadPlaces(key, x, y));
    }
    publishNames(wanted, wantedPlaces);
    if (!jobs.length) return;
    await Promise.all(jobs);
    if (my !== gen) return;
    for (const [key, t] of tiles) if (t.primitive) t.primitive.show = showBuildings && wanted.includes(key);
    publishNames(wanted, wantedPlaces);
    // Forget the oldest tiles beyond the budget.
    const idle = [...tiles].filter(([k, t]) => !wanted.includes(k) && !t.loading).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    while (tiles.size > KEEP_TILES && idle.length) {
      const [k, t] = idle.shift();
      if (t.primitive) scene.primitives.remove(t.primitive);
      tiles.delete(k);
    }
    while (placeNames.size > 12) placeNames.delete(placeNames.keys().next().value);
    scene.requestRender();
  }

  const safeRefresh = () => {
    refresh().catch((err) => console.warn('[Mission Control] Overture skipped:', err));
  };

  // Safety net: if Cesium fails while drawing, drop our buildings for this
  // session and restart the map's drawing loop, rather than freezing.
  scene.renderError.addEventListener((_scene, err) => {
    if (broken || ![...tiles.values()].some((t) => t.primitive)) return;
    broken = true;
    console.warn('[Mission Control] Overture buildings switched off after a draw error:', err);
    for (const t of tiles.values()) if (t.primitive) scene.primitives.remove(t.primitive);
    tiles.clear();
    setTimeout(() => { viewer.useDefaultRenderLoop = true; }, 0);
  });

  function sync() {
    const on = isVectorActive();
    if (on === active) return;
    active = on;
    if (!on) setExtraNames('overture', []);
    safeRefresh();
  }

  camera.moveEnd.addEventListener(safeRefresh);
  scene.morphComplete.addEventListener(safeRefresh);
  const chips = document.getElementById('map-stack-chips');
  if (chips) {
    new MutationObserver(sync).observe(chips, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }
  sync();
  setTimeout(sync, 3000);
}
