// Mission Control — dark basemap (Drago spec §8.7).
// With CARTO_API_KEY in .env → CARTO Dark Matter (sharp @2x tiles).
//   Free key: carto.com/basemaps/apikey — free for non-commercial use up to
//   5M tile requests/month. The key is visible in the browser by design;
//   restrict it to localhost (and your tunnel domain later) in CARTO.
// Without a key → Esri Dark Gray Canvas (keyless fallback).
import * as Cesium from 'cesium';

export const DARK_MAP_ID = 'dark';
const CARTO_KEY = String(import.meta.env?.CARTO_API_KEY || '').trim();

const CARTO_CREDIT =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';
const ESRI_CREDIT =
  '<a href="https://www.esri.com" target="_blank" rel="noopener">Powered by Esri</a> — Esri, HERE, Garmin, © OpenStreetMap contributors';

export const DARK_MAP_ATTRIBUTION_HTML = CARTO_KEY ? CARTO_CREDIT : ESRI_CREDIT;

// Restyle v2: recolour each CARTO tile as it loads (reference video look).
// CARTO Dark Matter paints land near-black (14,14,14) and water a bluish grey
// (44,53,60), so water is found by its blue tint, not by darkness:
//   water  → pure black
//   land   → dark slate grey
//   roads (darker than land) → dim purple
//   land + buildings (greys up to ~38) → dark slate grey
//   lines + place names (clearly brighter) → purple, brightest → lavender.
const LAND = [30, 31, 36];
const ROAD = [52, 40, 104]; // streets (dim purple)
const PURPLE = [124, 98, 255]; // borders, road edges
const LAVENDER = [206, 192, 255]; // bright lines, place names
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function recolorTile(image) {
  const w = image.width;
  const h = image.height;
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const water = clamp01((b - r - 4) / 12); // bluish tint → 1
    const lum = (r + g + b) / 3;
    // Greys up to ~38 are land + buildings: keep them grey (slate), just
    // lifted so buildings read a touch lighter than land.
    const lift = Math.max(0, lum - 14);
    const gR = LAND[0] + lift, gG = LAND[1] + lift, gB = LAND[2] + lift * 1.15;
    // Clearly brighter pixels are lines + place names → purple → lavender.
    const line = clamp01((lum - 40) / 70);
    let R, G, B;
    if (line < 0.5) {
      const t = line / 0.5;
      R = gR + (PURPLE[0] - gR) * t;
      G = gG + (PURPLE[1] - gG) * t;
      B = gB + (PURPLE[2] - gB) * t;
    } else {
      const t = (line - 0.5) / 0.5;
      R = PURPLE[0] + (LAVENDER[0] - PURPLE[0]) * t;
      G = PURPLE[1] + (LAVENDER[1] - PURPLE[1]) * t;
      B = PURPLE[2] + (LAVENDER[2] - PURPLE[2]) * t;
    }
    // Roads: CARTO draws them darker than land (~9). Make them dim purple so
    // streets read as lines and only water is pure black.
    const road = clamp01((13 - lum) / 4) * (1 - water);
    if (road > 0) {
      R += (ROAD[0] - R) * road;
      G += (ROAD[1] - G) * road;
      B += (ROAD[2] - B) * road;
    }
    const keep = 1 - water; // water fades to black
    d[i] = R * keep;
    d[i + 1] = G * keep;
    d[i + 2] = B * keep;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.transferToImageBitmap();
}

export function createDarkImagery() {
  if (CARTO_KEY) {
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png?key=${encodeURIComponent(CARTO_KEY)}`,
      tileWidth: 512,
      tileHeight: 512,
      maximumLevel: 19,
      credit: new Cesium.Credit(CARTO_CREDIT, true),
    });
    const request = provider.requestImage.bind(provider);
    provider.requestImage = (x, y, level, req) => {
      const pending = request(x, y, level, req);
      return pending && Promise.resolve(pending).then((image) =>
        typeof OffscreenCanvas === 'function' ? recolorTile(image) : image,
      );
    };
    return provider;
  }
  return Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer',
    { credit: ESRI_CREDIT, enablePickFeatures: false },
  );
}
