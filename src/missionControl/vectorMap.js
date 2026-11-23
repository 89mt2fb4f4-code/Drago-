// Mission Control — "Vector Dark" map (trial; map-stack plan step 2).
//
// Instead of a finished picture from a tile server, we fetch the map DATA
// (OpenFreeMap vector tiles, OpenMapTiles schema: water, roads, buildings…)
// and paint every tile ourselves with the Mission Control palette. These are
// the same tiles a MapLibre map would use; the painter is ours so it needs no
// new library and plugs into Cesium like any other map — data layers on top
// are untouched.
//
// Keyless. Names (streets, places) are NOT painted into the tiles on purpose:
// painted text stretches when the 3D view tilts. They come next, as separate
// screen-facing labels.
import * as Cesium from 'cesium';
import { PbfReader } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

export const VECTOR_MAP_ID = 'vector';
const TILEJSON_URL = 'https://tiles.openfreemap.org/planet';
const SOURCE_MAX_ZOOM = 14; // OpenMapTiles stops at 14; deeper = zoom into a z14 tile
const SIZE = 512;

export const VECTOR_MAP_ATTRIBUTION_HTML =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '© <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

// Palette (spec §8.7): navy base, purple/violet/blue accents, no amber.
const C = {
  land: '#10132a',
  green: '#11172c', // parks, woods: barely there
  water: '#020309',
  waterway: '#0e1533',
  gridMinor: 'rgba(70, 52, 150, 0.35)',
  gridMajor: 'rgba(109, 77, 255, 0.45)',
  aeroway: '#141831',
  building: '#1a1f3a',
  buildingEdge: '#2a3158',
  rail: '#262b47',
  path: '#1c1a3a',
  road: {
    motorway: '#6d4dff',
    trunk: '#5a42d6',
    primary: '#4a38ac',
    secondary: '#3a2f88',
    tertiary: '#30296f',
    minor: '#241f52',
    service: '#1d1a40',
  },
  border2: 'rgba(155, 135, 255, 0.75)', // countries
  border4: 'rgba(109, 77, 255, 0.45)', // states / provinces
};

// Road width in px at zoom 14, then scaled by zoom.
const ROAD_W14 = { motorway: 3.4, trunk: 3, primary: 2.6, secondary: 2.1, tertiary: 1.8, minor: 1.2, service: 0.8 };
// Roads come in after borders as you zoom: highways from 6, streets from 12.
const ROAD_MIN_Z = { motorway: 6, trunk: 7, primary: 8, secondary: 10, tertiary: 11, minor: 12, service: 14 };
const zoomScale = (z) => Math.min(6, Math.max(0.35, 2 ** ((z - 14) * 0.6)));

let tileUrlPromise = null;
function tileUrlTemplate() {
  // The TileJSON names the current (versioned) tile set.
  tileUrlPromise ??= fetch(TILEJSON_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`OpenFreeMap TileJSON HTTP ${r.status}`);
      return r.json();
    })
    .then((j) => {
      const url = j?.tiles?.[0];
      if (typeof url !== 'string' || !url.startsWith('https://tiles.openfreemap.org/')) {
        throw new Error('OpenFreeMap TileJSON has no tile URL');
      }
      return url;
    })
    .catch((err) => {
      tileUrlPromise = null; // allow a retry later
      throw err;
    });
  return tileUrlPromise;
}

// Small cache of decoded source tiles: deep zoom levels reuse one z14 tile.
const CACHE_MAX = 160;
const cache = new Map();
export function loadSourceTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const p = tileUrlTemplate()
    .then((tpl) => fetch(tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y)))
    .then((r) => {
      if (r.status === 204 || r.status === 404) return null; // no data here
      if (!r.ok) throw new Error(`OpenFreeMap tile HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => (buf && buf.byteLength ? new VectorTile(new PbfReader(new Uint8Array(buf))) : null))
    .catch((err) => {
      cache.delete(key);
      throw err;
    });
  cache.set(key, p);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return p;
}

function eachFeature(tile, layerName, fn) {
  const layer = tile?.layers?.[layerName];
  if (!layer) return;
  for (let i = 0; i < layer.length; i++) fn(layer.feature(i), layer.extent);
}

// Build one path for a feature in tile pixels.
function tracePath(ctx, feature, extent, scale, ox, oy, closed) {
  const k = (SIZE / extent) * scale;
  ctx.beginPath();
  for (const ring of feature.loadGeometry()) {
    for (let i = 0; i < ring.length; i++) {
      const px = ring[i].x * k - ox;
      const py = ring[i].y * k - oy;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    if (closed) ctx.closePath();
  }
}

function fillLayer(ctx, tile, layerName, color, geo, filter) {
  ctx.fillStyle = color;
  eachFeature(tile, layerName, (f, extent) => {
    if (f.type !== 3 || (filter && !filter(f.properties))) return;
    tracePath(ctx, f, extent, geo.scale, geo.ox, geo.oy, true);
    ctx.fill('evenodd');
  });
}

function paint(ctx, tile, zoom, geo) {
  ctx.fillStyle = C.land;
  ctx.fillRect(0, 0, SIZE, SIZE);
  if (!tile) return;
  const s = zoomScale(zoom);

  fillLayer(ctx, tile, 'landcover', C.green, geo, (p) => p.class === 'wood' || p.class === 'grass');
  fillLayer(ctx, tile, 'park', C.green, geo);

  // Water, with the faint tactical grid of the Dark map inside it.
  ctx.save();
  ctx.beginPath();
  let hasWater = false;
  eachFeature(tile, 'water', (f, extent) => {
    if (f.type !== 3) return;
    hasWater = true;
    const k = (SIZE / extent) * geo.scale;
    for (const ring of f.loadGeometry()) {
      ring.forEach((pt, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, pt.x * k - geo.ox, pt.y * k - geo.oy));
      ctx.closePath();
    }
  });
  if (hasWater) {
    ctx.fillStyle = C.water;
    ctx.fill('evenodd');
    ctx.clip('evenodd');
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.gridMinor;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    for (const p of [128, 256, 384]) {
      ctx.moveTo(p, 0); ctx.lineTo(p, SIZE);
      ctx.moveTo(0, p); ctx.lineTo(SIZE, p);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = C.gridMajor;
    ctx.beginPath();
    ctx.moveTo(0.5, 0); ctx.lineTo(0.5, SIZE);
    ctx.moveTo(0, 0.5); ctx.lineTo(SIZE, 0.5);
    ctx.stroke();
  }
  ctx.restore();

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.waterway;
  eachFeature(tile, 'waterway', (f, extent) => {
    if (f.type !== 2) return;
    ctx.lineWidth = (f.properties.class === 'river' ? 1.6 : 0.8) * s;
    tracePath(ctx, f, extent, geo.scale, geo.ox, geo.oy, false);
    ctx.stroke();
  });

  fillLayer(ctx, tile, 'aeroway', C.aeroway, geo);

  if (zoom >= 13) {
    fillLayer(ctx, tile, 'building', C.building, geo);
    if (zoom >= 15) {
      ctx.strokeStyle = C.buildingEdge;
      ctx.lineWidth = 0.8;
      eachFeature(tile, 'building', (f, extent) => {
        if (f.type !== 3) return;
        tracePath(ctx, f, extent, geo.scale, geo.ox, geo.oy, true);
        ctx.stroke();
      });
    }
  }

  // Roads: small ones first so big roads draw on top.
  const ORDER = ['path', 'rail', 'service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'motorway'];
  const buckets = new Map(ORDER.map((k) => [k, []]));
  eachFeature(tile, 'transportation', (f, extent) => {
    if (f.type !== 2) return;
    const cls = f.properties.class;
    const key = cls === 'path' || cls === 'track' ? 'path'
      : cls === 'rail' || cls === 'transit' ? 'rail'
      : ROAD_W14[cls] ? cls : null;
    if (key) buckets.get(key).push([f, extent]);
  });
  for (const key of ORDER) {
    const list = buckets.get(key);
    if (!list.length) continue;
    if (key === 'path') {
      if (zoom < 15) continue;
      ctx.strokeStyle = C.path;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
    } else if (key === 'rail') {
      if (zoom < 11) continue;
      ctx.strokeStyle = C.rail;
      ctx.lineWidth = Math.max(0.6, 0.9 * s);
      ctx.setLineDash([6, 4]);
    } else {
      if (zoom < ROAD_MIN_Z[key]) continue;
      ctx.strokeStyle = C.road[key];
      ctx.lineWidth = Math.max(0.5, ROAD_W14[key] * s);
      ctx.setLineDash([]);
    }
    for (const [f, extent] of list) {
      if (f.properties.brunnel === 'tunnel') continue;
      tracePath(ctx, f, extent, geo.scale, geo.ox, geo.oy, false);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);

  // Borders only once you're closer than the whole globe: countries from
  // zoom 4 (a continent fills the screen), states from zoom 6. Never on the
  // sea. Coastlines still show through the land/water colours.
  eachFeature(tile, 'boundary', (f, extent) => {
    if (f.type !== 2 || f.properties.maritime === 1) return;
    const level = f.properties.admin_level;
    if (!(level === 2 && zoom >= 4) && !(level === 4 && zoom >= 6)) return;
    ctx.strokeStyle = level === 2 ? C.border2 : C.border4;
    ctx.lineWidth = level === 2 ? 1.2 : 0.8;
    ctx.setLineDash(level === 2 ? [] : [4, 3]);
    tracePath(ctx, f, extent, geo.scale, geo.ox, geo.oy, false);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function makeCanvas() {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(SIZE, SIZE);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  return c;
}

/** Cesium imagery provider that paints OpenFreeMap vector tiles. */
class VectorDarkImageryProvider {
  constructor() {
    this.tilingScheme = new Cesium.WebMercatorTilingScheme();
    this.rectangle = this.tilingScheme.rectangle;
    this.tileWidth = SIZE;
    this.tileHeight = SIZE;
    this.minimumLevel = 0;
    this.maximumLevel = 19;
    this.tileDiscardPolicy = undefined;
    this.errorEvent = new Cesium.Event();
    this.credit = new Cesium.Credit(VECTOR_MAP_ATTRIBUTION_HTML, true);
    this.proxy = undefined;
    this.hasAlphaChannel = false;
  }
  getTileCredits() {
    return undefined;
  }
  pickFeatures() {
    return undefined;
  }
  async requestImage(x, y, level) {
    const z = Math.min(level, SOURCE_MAX_ZOOM);
    const d = level - z; // levels beyond the source: zoom into the parent tile
    const sx = x >> d;
    const sy = y >> d;
    const scale = 2 ** d;
    const geo = { scale, ox: (x - sx * scale) * SIZE, oy: (y - sy * scale) * SIZE };
    const tile = await loadSourceTile(z, sx, sy);
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    if (canvas.transferToImageBitmap) {
      // Cesium uploads ImageBitmaps as-is (its own loader makes them
      // pre-flipped), so paint upside down to match.
      ctx.translate(0, SIZE);
      ctx.scale(1, -1);
      paint(ctx, tile, level, geo);
      return canvas.transferToImageBitmap();
    }
    paint(ctx, tile, level, geo);
    return canvas;
  }
}

export function createVectorDarkImagery() {
  return new VectorDarkImageryProvider();
}
