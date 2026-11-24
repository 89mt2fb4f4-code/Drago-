// Mission Control — one palette for every data layer (spec §8.7).
//
// Rules (Boss, 2026-11-23: "clean and aesthetic, not crazy"):
//   • movement (planes, ships, trains) — soft lavender / violet
//   • military and official sensors — the palette blue
//   • the thing you selected or follow — white
//   • amber ONLY for real alerts (emergency squawk, big quake, jam…)
//   • far away: small and dim; up close: full size
// Upstream layer files import these instead of their own neon colours; each
// such edit is marked "Mission Control" and logged in README.md.

export const MC_COLORS = Object.freeze({
  // aircraft
  civil: '#c9bcff', // civilian planes
  military: '#6f9bff', // military planes (was amber)
  tracked: '#ffffff', // the plane you follow
  trailCivil: '#9b87ff',
  trailMilitary: '#5a86ff',
  alert: '#ffb547', // emergencies and other real alerts
  // satellites
  satStation: '#eceefa', // crewed stations
  satNav: '#7da2ff', // GPS / Galileo / GLONASS
  satGeo: '#b9a8ff', // geostationary belt
  satVisual: '#8a93c9', // everything else in the core catalogue
  satComms: '#4b4f86', // thousands of comms sats in DENSE mode: texture only
  satIss: '#d9ccff',
  orbit: '#9b87ff', // orbit lines
  // street traffic (flow speed)
  flowFree: '#b3a6ff', // moving freely: soft lavender (lighter than the violet roads)
  flowSlow: '#ffffff', // slow: white
  flowJam: '#ffb547', // jammed: amber (alert)
  flowUnknown: '#8a93c9', // no live flow data
  // transit modes
  bus: '#8f7dff',
  tram: '#b9a8ff',
  subway: '#5a86ff',
  rail: '#d9ccff',
  ferry: '#7fc0d8',
  transitOther: '#8a93c9',
  // bike share availability
  bikesMany: '#c9bcff',
  bikesSome: '#8f7dff',
  bikesFew: '#4f5ca8',
  // ships by type (and their card accents)
  shipTanker: '#c08cff',
  shipCargo: '#8fa8ff',
  shipPassenger: '#e2d9ff',
  shipFishing: '#7fc0d8',
  shipService: '#b0b6d6',
  shipTrail: '#8fa8ff',
});

/** "r, g, b" for CSS rgba() accents. */
export const mcRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

/** Far planes shrink to this fraction of their close-up size (was 0.5). */
export const MC_FAR_AIRCRAFT_SCALE = 0.22;
/** Close-up plane scale (was 3.0). */
export const MC_NEAR_AIRCRAFT_SCALE = 2.4;
