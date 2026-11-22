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

export function createDarkImagery() {
  if (CARTO_KEY) {
    return new Cesium.UrlTemplateImageryProvider({
      url: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}@2x.png?key=${encodeURIComponent(CARTO_KEY)}`,
      tileWidth: 512,
      tileHeight: 512,
      maximumLevel: 19,
      credit: new Cesium.Credit(CARTO_CREDIT, true),
    });
  }
  return Cesium.ArcGisMapServerImageryProvider.fromUrl(
    'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer',
    { credit: ESRI_CREDIT, enablePickFeatures: false },
  );
}
