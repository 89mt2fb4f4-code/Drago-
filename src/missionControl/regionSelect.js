// Mission Control — click a country or state to highlight it, with its facts
// in a REGION card on the right (Pinterest refs: glowing region outline +
// side info panel).
//
//   • double-click: zoomed out (> 3,000 km) countries; closer: states /
//     provinces. (Double, so ordinary clicks and drags never select.)
//   • inside the highlight, the next level's lines appear as you zoom in:
//     a country's states/provinces, a US state's counties
//   • looks lifted off the map: violet top with a glowing edge, a deep-violet
//     depth edge and a soft shadow towards the bottom-right of the screen
//   • REGION card: name, type, capital, population (with its year), area,
//     currency, a short description and a Wikipedia link. Facts come from
//     Wikidata and Wikipedia (free, no key); shape and area from the Natural
//     Earth borders bundled with upstream. Anything unknown shows "—".
//   • a double-click on a marker (camera, plane…) is left to that marker;
//     double-clicking the same region again, open sea, × or Esc clears it.
//     Off while upstream's draw / imagery-box tools are in use.
//   • not at street level (camera closer than 150 km), where clicks are
//     about the city, not the state.
import * as Cesium from 'cesium';
import { adminUnitAt, unitsWithin } from './placeName.js';

const STATE_WITHIN_M = 3_000_000;
const MIN_VIEW_M = 150_000;
const MAX_RINGS = 60; // biggest parts only (islands add up fast)
// Inner lines appear as you zoom in: a country's states from 7,500 km,
// a US state's counties from 1,200 km (camera distance to the lines).
const INNER_FROM_M = { country: 7_500_000, state: 1_200_000 };
const INNER = Cesium.Color.fromCssColorString('#c9bcff').withAlpha(0.45);
const GLOW = Cesium.Color.fromCssColorString('#9b87ff');
const CORE = Cesium.Color.fromCssColorString('#e4dcff');
// Nearly solid, so the depth layer underneath can't show through as a seam.
const FILL = Cesium.Color.fromCssColorString('#5a45dc').withAlpha(0.85); // the region's top
const DEPTH = Cesium.Color.fromCssColorString('#2a1f70'); // its thick edge
const SHADOW = Cesium.Color.BLACK.withAlpha(0.7);
const SHADOW_SOFT = Cesium.Color.BLACK.withAlpha(0.4);

const toRad = (d) => (d * Math.PI) / 180;
function ringAreaKm2(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    sum += toRad(lon2 - lon1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((sum * 6371 * 6371) / 2);
}
const polyArea = ([outer, ...holes]) => ringAreaKm2(outer) - holes.reduce((a, h) => a + ringAreaKm2(h), 0);

const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');
function fmtBig(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return fmtInt(n);
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- facts (Wikidata + Wikipedia), cached per region ----------

const facts = new Map();
async function wikidataFacts(level, code) {
  // Only well-formed ISO codes go into the query.
  const ok = level === 'country' ? /^[A-Z]{2}$/.test(code) : /^[A-Z]{2}-[A-Z0-9]{1,3}$/.test(code);
  if (!ok) return null;
  const prop = level === 'country' ? 'P297' : 'P300';
  const query = `SELECT ?pop ?popDate ?capitalLabel ?currencyLabel ?title WHERE {
    ?item wdt:${prop} "${code}" .
    OPTIONAL { ?item p:P1082 ?ps . ?ps ps:P1082 ?pop ; wikibase:rank ?rank .
               FILTER(?rank != wikibase:DeprecatedRank) OPTIONAL { ?ps pq:P585 ?popDate } }
    OPTIONAL { ?item wdt:P36 ?capital }
    ${level === 'country' ? 'OPTIONAL { ?item wdt:P38 ?currency }' : ''}
    OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?title }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 300`;
  const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error(`Wikidata HTTP ${res.status}`);
  const rows = (await res.json())?.results?.bindings || [];
  let pop = null;
  const capitals = new Set();
  const currencies = new Set();
  let title = null;
  for (const r of rows) {
    const p = Number(r.pop?.value);
    const d = r.popDate?.value ?? '';
    if (Number.isFinite(p) && (!pop || d > pop.date)) pop = { value: p, date: d };
    if (r.capitalLabel?.value && !/^Q\d+$/.test(r.capitalLabel.value)) capitals.add(r.capitalLabel.value);
    if (r.currencyLabel?.value && !/^Q\d+$/.test(r.currencyLabel.value)) currencies.add(r.currencyLabel.value);
    title ??= r.title?.value ?? null;
  }
  return { pop, capitals: [...capitals], currencies: [...currencies], title };
}

async function wikipediaSummary(title) {
  if (!title) return null;
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  if (!res.ok) return null;
  const j = await res.json();
  if (j.type === 'disambiguation') return null;
  // Keep the card short: cut at a sentence end near 300 characters
  // (abbreviations like "U.S." make sentence splitting unreliable).
  let text = String(j.extract || '').trim();
  if (text.length > 300) {
    const cut = text.lastIndexOf('. ', 300);
    text = cut > 80 ? text.slice(0, cut + 1) : `${text.slice(0, 300)}…`;
  }
  return { text, url: j.content_urls?.desktop?.page ?? null };
}

function loadFacts(level, f) {
  const code = level === 'country' ? String(f.iso2 || '').toUpperCase() : String(f.iso || '').toUpperCase();
  const key = `${level}:${code || f.name}`;
  if (!facts.has(key)) {
    facts.set(key, (async () => {
      const wd = await wikidataFacts(level, code).catch(() => null);
      // Countries without a usable ISO code: try the article by name.
      const title = wd?.title ?? (level === 'country' ? f.name : null);
      const wiki = await wikipediaSummary(title).catch(() => null);
      return { ...(wd || {}), wiki };
    })().catch(() => {
      facts.delete(key);
      return null;
    }));
  }
  return facts.get(key);
}

// ---------- module ----------

export function attachRegionSelect(viewer) {
  const scene = viewer.scene;
  const layer = new Cesium.CustomDataSource('mc-region');
  viewer.dataSources.add(layer);
  let current = null; // { key, unit, level }
  let ask = 0;

  // ---- REGION card, between Focus and Signals ----
  const signals = document.getElementById('mc-signals');
  const card = document.createElement('section');
  card.className = 'mc-panel mc-region';
  card.id = 'mc-region';
  card.hidden = true;
  card.innerHTML = `
    <header class="mc-panel-head"><span class="mc-code">03</span><h2>REGION</h2><span class="mc-meta" data-r="kind">—</span>
      <button type="button" class="mc-region-close" aria-label="Clear the selected region">×</button></header>
    <div class="mc-panel-body">
      <div class="mc-focus-name" data-r="name">—</div>
      <p class="mc-region-desc" data-r="desc">—</p>
      <div class="mc-tiles">
        <div><span>CAPITAL</span><b data-r="capital">—</b></div>
        <div><span data-r="poplabel">POPULATION</span><b data-r="pop">—</b></div>
        <div><span>AREA</span><b data-r="area">—</b></div>
        <div><span data-r="extralabel">CURRENCY</span><b data-r="extra">—</b></div>
      </div>
      <div class="mc-region-actions">
        <button type="button" data-r="zoom">ZOOM TO</button>
        <a data-r="link" target="_blank" rel="noopener" hidden>WIKIPEDIA ↗</a>
      </div>
      <div class="mc-region-src">Natural Earth · Wikidata · Wikipedia</div>
    </div>`;
  {
    const code = signals?.querySelector('.mc-code');
    if (code) code.textContent = '04';
  }
  // Where the card lives: at the top of upstream's right panel stack when
  // that is showing (its layout then moves CCTV / weather cards below it);
  // otherwise in our right column, before Signals.
  function dock() {
    const rail = document.getElementById('right-context-rail');
    if (rail && getComputedStyle(rail).display !== 'none') {
      if (rail.firstElementChild !== card) rail.prepend(card);
    } else if (signals) {
      if (card.nextElementSibling !== signals) signals.before(card);
    } else {
      document.getElementById('mc-right')?.append(card);
    }
  }
  dock();
  const $ = (k) => card.querySelector(`[data-r="${k}"]`);

  function clear() {
    ask++;
    current = null;
    layer.entities.removeAll();
    shadows = [];
    shadowHeading = null;
    card.hidden = true;
    delete document.documentElement.dataset.mcRegion; // globe may spin again
    scene.requestRender();
  }
  card.querySelector('.mc-region-close').addEventListener('click', clear);
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) { clear(); }
  }, true);
  $('zoom').addEventListener('click', () => {
    if (!current) return;
    const [w, s, e, n] = current.unit.box;
    const padLon = (e - w) * 0.15;
    const padLat = (n - s) * 0.15;
    viewer.camera.flyTo({
      destination: Cesium.Rectangle.fromDegrees(
        Math.max(-180, w - padLon), Math.max(-89, s - padLat), Math.min(180, e + padLon), Math.min(89, n + padLat)),
      duration: 1.4,
    });
  });

  // The selected region looks lifted off the map (Pinterest ref), faked the
  // way 3D map cards do it, all drawn flat on the ground so edges stay clean:
  //   top    — the region, filled violet, glowing edge
  //   depth  — a deep-violet copy just below-right: reads as the slab's edge
  //   shadow — a soft dark copy further below-right (two layers = soft edge)
  // "Below-right" is measured on screen, so it follows the map's rotation.
  let shadows = [];
  let shadowHeading = null;
  function sizeOf(unit) {
    const [w, s, e, n] = unit.box;
    const lat = (s + n) / 2;
    return { lat, diagKm: Math.hypot((e - w) * 111 * Math.cos(toRad(lat)), (n - s) * 111) };
  }
  // Shift [lon, lat] rings towards screen down-right by `factor` × region size.
  function shifted(ring, unit, factor) {
    const { lat, diagKm } = sizeOf(unit);
    const h = scene.camera.heading; // clockwise from north
    let ex = -Math.sin(h) + 0.7 * Math.cos(h); // screen down + some screen right
    let ny = -Math.cos(h) - 0.7 * Math.sin(h);
    const len = Math.hypot(ex, ny);
    ex /= len; ny /= len;
    const km = diagKm * factor;
    const dLon = (ex * km) / (111 * Math.max(0.2, Math.cos(toRad(lat))));
    const dLat = (ny * km) / 111;
    return ring.map(([lon, la]) => [lon + dLon, Math.max(-89.9, Math.min(89.9, la + dLat))]);
  }
  const hierarchyOf = (outer, holes) => new Cesium.PolygonHierarchy(
    Cesium.Cartesian3.fromDegreesArray(outer.flat()),
    holes.map((h) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(h.flat()))),
  );
  const biggest = (unit) => unit.polygons
    .map((p) => ({ p, a: polyArea(p) }))
    .sort((x, y) => y.a - x.a)
    .slice(0, MAX_RINGS)
    .map(({ p }) => p);
  const groundFill = (outer, holes, color, zIndex) => layer.entities.add({
    polygon: {
      hierarchy: hierarchyOf(outer, holes),
      material: color,
      classificationType: Cesium.ClassificationType.TERRAIN,
      arcType: Cesium.ArcType.RHUMB, // same edges as the outline (borders like 49°N are parallels)
      zIndex,
    },
  });

  function drawShadow(unit) {
    for (const e of shadows) layer.entities.remove(e);
    shadows = [];
    shadowHeading = scene.camera.heading;
    const [, s, , n] = unit.box;
    if (n - s >= 80) return; // giant polar shapes: no depth
    const parts = biggest(unit);
    for (const [factor, color, z] of [
      [0.085, SHADOW_SOFT, 0],
      [0.055, SHADOW, 1],
      [0.028, DEPTH, 2],
    ]) {
      for (const [outer, ...holes] of parts) {
        shadows.push(groundFill(shifted(outer, unit, factor), holes.map((h) => shifted(h, unit, factor)), color, z));
      }
    }
  }

  function draw(unit) {
    layer.entities.removeAll();
    shadows = [];
    drawShadow(unit);
    const [, s, , n] = unit.box;
    const fill = n - s < 80; // giant polar shapes: outline only
    for (const [outer, ...holes] of biggest(unit)) {
      if (fill) groundFill(outer, holes, FILL, 3);
      const positions = Cesium.Cartesian3.fromDegreesArray([...outer, outer[0]].flat());
      layer.entities.add({
        polyline: {
          positions,
          width: 9,
          clampToGround: true,
          arcType: Cesium.ArcType.RHUMB,
          zIndex: 4,
          material: new Cesium.PolylineGlowMaterialProperty({ color: GLOW.withAlpha(0.85), glowPower: 0.3, taperPower: 1 }),
        },
      });
      layer.entities.add({
        polyline: { positions, width: 1.5, clampToGround: true, arcType: Cesium.ArcType.RHUMB, zIndex: 5, material: CORE.withAlpha(0.95) },
      });
    }
    scene.requestRender();
    drawInner(unit);
  }

  // The next level's lines inside the highlight (states, or US counties).
  async function drawInner(unit) {
    const key = current?.key;
    const level = current?.level;
    const parts = await unitsWithin(level, unit.f).catch(() => []);
    if (!parts.length || current?.key !== key) return;
    const far = new Cesium.DistanceDisplayCondition(0, INNER_FROM_M[level]);
    const rings = parts.flatMap((part) => part.polygons.map((p) => p[0])).filter((ring) => ring?.length >= 4);
    for (const outer of rings.slice(0, 1500)) { // every part (e.g. both halves of Michigan), capped
      layer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([...outer, outer[0]].flat()),
          width: 1,
          clampToGround: true,
          arcType: Cesium.ArcType.RHUMB,
          zIndex: 3,
          material: INNER,
          distanceDisplayCondition: far,
        },
      });
    }
    scene.requestRender();
  }
  // Keep the shadow falling towards the bottom-right after the map turns.
  scene.camera.moveEnd.addEventListener(() => {
    try {
      if (!current || shadowHeading === null) return;
      const d = Math.abs(Cesium.Math.negativePiToPi(scene.camera.heading - shadowHeading));
      if (d > 0.35) { drawShadow(current.unit); scene.requestRender(); }
    } catch (err) { console.warn('[Mission Control] region shadow skipped:', err); }
  });

  async function show(unit, level) {
    const my = ++ask;
    const f = unit.f;
    const isCountry = level === 'country';
    const countryShort = f.country === 'United States of America' ? 'USA' : f.country;
    $('name').textContent = f.name;
    $('kind').textContent = isCountry ? 'COUNTRY' : `${String(f.type || 'REGION').toUpperCase()} · ${String(countryShort || '').toUpperCase()}`;
    $('area').textContent = `≈ ${fmtBig(unit.polygons.reduce((a, p) => a + polyArea(p), 0))} km²`;
    $('extralabel').textContent = isCountry ? 'CURRENCY' : 'CODE';
    for (const k of ['capital', 'pop', 'extra']) $(k).textContent = '…';
    if (!isCountry) $('extra').textContent = f.postal || f.iso || '—';
    $('poplabel').textContent = 'POPULATION';
    $('desc').textContent = 'Loading facts…';
    $('link').hidden = true;
    dock();
    card.hidden = false;
    document.documentElement.dataset.mcRegion = 'on'; // pauses the globe spin

    const info = await loadFacts(level, f);
    if (my !== ask) return;
    $('capital').textContent = info?.capitals?.length ? info.capitals.slice(0, 2).join(' · ') : '—';
    $('pop').textContent = info?.pop ? fmtBig(info.pop.value) : '—';
    const year = info?.pop?.date?.slice(0, 4);
    $('poplabel').textContent = year ? `POPULATION · ${year}` : 'POPULATION';
    if (isCountry) $('extra').textContent = info?.currencies?.length ? info.currencies[0] : '—';
    $('desc').textContent = info?.wiki?.text || '—';
    if (info?.wiki?.url) {
      $('link').href = info.wiki.url;
      $('link').hidden = false;
    }
  }

  // ---- double-clicks on the map ----
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  handler.setInputAction(async (click) => {
    try {
      if (scene.mode === Cesium.SceneMode.MORPHING) return;
      // Upstream's draw and imagery-box tools finish shapes with a double-click.
      const body = document.body.classList;
      if (body.contains('gev-drawing') || body.contains('gev-imagery-box')) return;
      // Markers (cameras, planes…) keep their own click. Our names and our
      // own outline don't count as markers.
      const picked = scene.pick(click.position);
      const ours = picked?.id && layer.entities.contains?.(picked.id);
      const label = picked?.primitive instanceof Cesium.Label;
      if (picked && !ours && !label) return;

      const ray = scene.camera.getPickRay(click.position);
      const hit = (scene.mode === Cesium.SceneMode.SCENE3D && scene.globe.pick(ray, scene)) ||
        scene.camera.pickEllipsoid(click.position, scene.globe.ellipsoid);
      if (!hit) return;
      const viewM = scene.mode === Cesium.SceneMode.SCENE3D
        ? Cesium.Cartesian3.distance(scene.camera.positionWC, hit)
        : scene.camera.positionCartographic.height;
      if (viewM < MIN_VIEW_M) return;
      const c = Cesium.Cartographic.fromCartesian(hit);
      const lat = Cesium.Math.toDegrees(c.latitude);
      const lon = Cesium.Math.toDegrees(c.longitude);

      let level = viewM > STATE_WITHIN_M ? 'country' : 'state';
      let unit = await adminUnitAt(level, lat, lon);
      if (!unit && level === 'state') {
        level = 'country';
        unit = await adminUnitAt(level, lat, lon);
      }
      if (!unit) { clear(); return; } // open sea
      const key = `${level}:${unit.f.iso || unit.f.iso2 || unit.f.name}`;
      if (current?.key === key) { clear(); return; } // same region again
      current = { key, unit, level };
      draw(unit);
      show(unit, level);
    } catch (err) {
      console.warn('[Mission Control] region select skipped:', err);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
}
