// Mission Control — "where is this?" for the Focus panel, without a key or
// a geocoding service. Everything comes from data the app already has:
//   • nearest city / town / village: OpenFreeMap place names (the same
//     tiles Vector Dark is drawn from, usually already cached)
//   • state / province and country: Natural Earth borders bundled with
//     upstream (src/data/local_data/natural_earth, public domain)
//   • open water: Natural Earth marine areas (Lake Erie, Atlantic Ocean…)
// Result looks like "Buffalo, NY", "Toronto, ON", "Paris, France",
// "Ontario, Canada", "Lake Erie" — or null when nothing is known.
import { decodeRing, polygonsContain } from '../data/adminBoundaries.js';
import { loadBundledJson } from '../data/bundledJson.js';
import { naturalRegionAtPoint } from '../data/naturalEarthRegions.js';
import { loadSourceTile } from './vectorMap.js';

const ADMIN1_URL = new URL('../data/local_data/natural_earth/states_provinces.json', import.meta.url);
const COUNTRIES_URL = new URL('../data/local_data/natural_earth/countries.json', import.meta.url);
const COUNTIES_URL = new URL('../data/local_data/us_census_counties/counties.json', import.meta.url);

// Countries where people write the short state code: "Buffalo, NY".
const POSTAL_COUNTRIES = new Set(['US', 'CA', 'AU']);
const SHORT_COUNTRY = { 'United States of America': 'USA', 'United Kingdom': 'UK' };
const PLACE_WEIGHT = { city: 0.6, town: 0.85, village: 1 }; // bigger places win ties
const TILE_Z = 11;

function indexPack(pack) {
  const decimals = pack.meta?.decimals ?? 3;
  return (pack.features || []).map((f) => {
    const polygons = f.polygons.map((poly) => poly.map((ring) => decodeRing(ring, f.d ?? decimals)));
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const [outer] of polygons) {
      for (const [lon, lat] of outer) {
        if (lon < w) w = lon;
        if (lon > e) e = lon;
        if (lat < s) s = lat;
        if (lat > n) n = lat;
      }
    }
    return { f, polygons, box: [w, s, e, n] };
  });
}

const packs = new Map();
function pack(url) {
  const key = String(url);
  if (!packs.has(key)) {
    packs.set(key, loadBundledJson(url).then(indexPack).catch((err) => {
      packs.delete(key);
      throw err;
    }));
  }
  return packs.get(key);
}

async function unitRecordAt(url, lat, lon) {
  for (const u of await pack(url)) {
    const [w, s, e, n] = u.box;
    if (lon < w || lon > e || lat < s || lat > n) continue;
    if (polygonsContain(u.polygons, lat, lon)) return u;
  }
  return null;
}
async function unitAt(url, lat, lon) {
  return (await unitRecordAt(url, lat, lon))?.f ?? null;
}

/**
 * The country ('country') or state/province ('state') under a point, with
 * its shape: { f: Natural Earth record, polygons: [[outer, ...holes]] of
 * [lon, lat], box: [w, s, e, n] } — or null (open sea).
 */
export function adminUnitAt(level, lat, lon) {
  return unitRecordAt(level === 'state' ? ADMIN1_URL : COUNTRIES_URL, lat, lon);
}

/**
 * The parts inside a region, with shapes: the states/provinces of a country,
 * or the counties of a US state (US Census, bundled). [] when there are none.
 */
export async function unitsWithin(parentLevel, parent) {
  if (parentLevel === 'country') {
    const iso2 = /^[A-Z]{2}$/.test(parent.iso2 || '') ? parent.iso2 : null;
    return (await pack(ADMIN1_URL)).filter((u) => (iso2 ? u.f.iso2 === iso2 : u.f.country === parent.name));
  }
  if (parentLevel === 'state' && parent.iso2 === 'US' && parent.postal) {
    return (await pack(COUNTIES_URL)).filter((u) => u.f.st === parent.postal);
  }
  return [];
}

const toRad = (d) => (d * Math.PI) / 180;
function km(lat1, lon1, lat2, lon2) {
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Nearest city/town/village within maxKm, from OpenFreeMap place points. */
async function nearestLocality(lat, lon, maxKm) {
  const n = 2 ** TILE_Z;
  const fx = ((lon + 180) / 360) * n;
  const r = toRad(Math.max(-85, Math.min(85, lat)));
  const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  const jobs = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = (((Math.floor(fx) + dx) % n) + n) % n;
      const y = Math.floor(fy) + dy;
      if (y < 0 || y >= n) continue;
      jobs.push(loadSourceTile(TILE_Z, x, y).then((t) => ({ t, x, y }), () => null));
    }
  }
  let best = null;
  for (const res of await Promise.all(jobs)) {
    const layer = res?.t?.layers?.place;
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const weight = PLACE_WEIGHT[f.properties.class];
      if (!weight || f.type !== 1) continue;
      const pt = f.loadGeometry()[0]?.[0];
      if (!pt) continue;
      const plon = ((res.x + pt.x / layer.extent) / n) * 360 - 180;
      const plat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (res.y + pt.y / layer.extent)) / n))) * 180) / Math.PI;
      const d = km(lat, lon, plat, plon);
      if (d > maxKm) continue;
      const score = d * weight;
      const p = f.properties;
      const name = String(p['name:en'] || p.name_en || p.name || '').trim();
      if (name && (!best || score < best.score)) best = { name, score };
    }
  }
  return best?.name ?? null;
}

function tileOf(lat, lon, z) {
  const n = 2 ** z;
  const r = toRad(Math.max(-85, Math.min(85, lat)));
  return { n, fx: ((lon + 180) / 360) * n, fy: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n };
}

/** Is the point inside a lake/sea polygon of the map tiles? */
async function inWater(lat, lon) {
  const { n, fx, fy } = tileOf(lat, lon, TILE_Z);
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  const tile = await loadSourceTile(TILE_Z, ((x % n) + n) % n, y);
  const layer = tile?.layers?.water;
  if (!layer) return false;
  const px = (fx - x) * layer.extent;
  const py = (fy - y) * layer.extent;
  for (let i = 0; i < layer.length; i++) {
    const f = layer.feature(i);
    if (f.type !== 3) continue;
    let hit = false; // even–odd over all rings handles islands and holes
    for (const ring of f.loadGeometry()) {
      for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
        const A = ring[a], B = ring[b];
        if ((A.y > py) !== (B.y > py) && px < ((B.x - A.x) * (py - A.y)) / (B.y - A.y) + A.x) hit = !hit;
      }
    }
    if (hit) return true;
  }
  return false;
}

/** Nearest lake/sea name (OpenFreeMap water_name), within 300 km. */
async function nearestWaterName(lat, lon) {
  const z = 6;
  const { n, fx, fy } = tileOf(lat, lon, z);
  const jobs = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const x = (((Math.floor(fx) + dx) % n) + n) % n;
      const y = Math.floor(fy) + dy;
      if (y >= 0 && y < n) jobs.push(loadSourceTile(z, x, y).then((t) => ({ t, x, y }), () => null));
    }
  }
  let best = null;
  for (const res of await Promise.all(jobs)) {
    const layer = res?.t?.layers?.water_name;
    if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i);
      const p = f.properties;
      const name = String(p['name:en'] || p.name_en || p.name || '').trim();
      if (!name) continue;
      for (const part of f.loadGeometry()) {
        for (const pt of part) {
          const plon = ((res.x + pt.x / layer.extent) / n) * 360 - 180;
          const plat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (res.y + pt.y / layer.extent)) / n))) * 180) / Math.PI;
          const d = km(lat, lon, plat, plon);
          if (d < 300 && (!best || d < best.d)) best = { name, d };
        }
      }
    }
  }
  return best?.name ?? null;
}

const cache = new Map();

/**
 * Name for the point the camera looks at.
 * @param {number} lat
 * @param {number} lon
 * @param {number} viewKm distance from the camera to that point, km
 * @returns {Promise<string|null>}
 */
export async function describePlace(lat, lon, viewKm) {
  const scale = viewKm > 2500 ? 'world' : viewKm > 250 ? 'region' : 'local';
  const key = `${lat.toFixed(scale === 'local' ? 2 : 1)},${lon.toFixed(scale === 'local' ? 2 : 1)},${scale}`;
  if (cache.has(key)) return cache.get(key);
  const [state, country] = await Promise.all([
    scale === 'world' ? null : unitAt(ADMIN1_URL, lat, lon).catch(() => null),
    unitAt(COUNTRIES_URL, lat, lon).catch(() => null),
  ]);
  let text = null;
  // Borders run out into lakes (Lake Erie is split between four states and
  // Ontario), so check for water first.
  const water = scale !== 'world' && await inWater(lat, lon).catch(() => false)
    ? await nearestWaterName(lat, lon).catch(() => null)
    : null;
  if (water) text = water;
  else if (country || state) {
    const countryName = country?.name ?? state?.country ?? '';
    const shortCountry = SHORT_COUNTRY[countryName] ?? countryName;
    if (scale === 'world') text = shortCountry || null;
    else {
      const locality = scale === 'local'
        ? await nearestLocality(lat, lon, Math.max(4, Math.min(40, viewKm * 0.5))).catch(() => null)
        : null;
      const usePostal = state?.postal && POSTAL_COUNTRIES.has(state.iso2);
      if (locality) text = `${locality}, ${usePostal ? state.postal : shortCountry}`;
      else if (state) text = `${state.name}, ${shortCountry}`;
      else text = shortCountry || null;
    }
  } else {
    const sea = await naturalRegionAtPoint(lat, lon).catch(() => null);
    text = sea?.label ?? null;
  }
  cache.set(key, text);
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return text;
}
